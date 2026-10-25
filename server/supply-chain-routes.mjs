import crypto from "node:crypto";
import { createSupplyChainService, SupplyChainError } from "./supply-chain.mjs";

export function registerSupplyChainRoutes(app, { db, auth, requireActiveTenant, requireEnterpriseRole, authLimiter }) {
  const service = () => createSupplyChainService(db);
  const actor = (res) => res.locals.authIdentity?.id ?? "";
  const tenant = (res) => res.locals.activeTenant?.id ?? "";
  const audit = (req,res,{action,outcome,entityType="route",entityId="",details={}}) => {
    try {
      db.prepare(`INSERT INTO supply_audit_events
        (event_id,tenant_id,actor_user_id,action,entity_type,entity_id,outcome,details_json,occurred_at,request_id)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
        crypto.randomUUID(),tenant(res),actor(res)||"anonymous",action,entityType,String(entityId||req.params?.lotId||""),
        outcome,JSON.stringify(details),new Date().toISOString(),String(req.get("x-request-id")??"").slice(0,120)||null
      );
      return true;
    } catch { return false; }
  };
  const handle = (fn) => (req, res) => {
    try {
      const result = db.transaction(() => {
        const value = fn(req, res);
        const recorded = audit(req,res,{action:`${req.method} ${req.route?.path??req.path}`,outcome:"success",entityId:value?.id??value?.lotId??value?.movementId??value?.handoverId??""});
        if (!recorded) {
          const error = new Error("audit_write_failed");
          error.code = "AUDIT_WRITE_FAILED";
          throw error;
        }
        return value;
      })();
      res.setHeader("Cache-Control", "no-store");
      return res.status(result?.duplicate ? 200 : 201).json({ data: result });
    } catch (error) {
      const denied = error instanceof SupplyChainError && error.status === 403;
      const auditRecorded = audit(req,res,{action:`${req.method} ${req.route?.path??req.path}`,outcome:denied?"denied":"failure",details:{errorCode:error instanceof SupplyChainError?error.code:String(error?.code??"internal_error")}});
      if (error?.code === "AUDIT_WRITE_FAILED" || !auditRecorded) {
        return res.status(503).json({ error: "audit_unavailable" });
      }
      if (error instanceof SupplyChainError) return res.status(error.status).json({ error: error.code });
      if (String(error?.code ?? "").startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "constraint_conflict" });
      return res.status(500).json({ error: "supply_chain_operation_failed" });
    }
  };
  const secured = [authLimiter, auth.authenticate, requireActiveTenant];
  const siteAllowedForRoles = (roles,siteType) => roles.some(role => ({
    enterprise_admin: ["plantation","supplier","packing_house","warehouse","port_terminal","in_transit","buyer"].includes(siteType),
    supplier: ["supplier","plantation"].includes(siteType),
    warehouse: ["supplier","warehouse","packing_house","port_terminal"].includes(siteType),
    logistics: ["warehouse","in_transit","port_terminal"].includes(siteType),
    qc: ["supplier","plantation","packing_house","warehouse","port_terminal"].includes(siteType),
    buyer: siteType === "buyer",
    seller: ["supplier","plantation","packing_house"].includes(siteType),
    auditor: true,
  })[role] === true);
  const requireSiteScope = (req,res,next,siteId) => {
    const roles=res.locals.activeTenant?.roles??[];
    const target=db.prepare("SELECT site_type AS siteType,active FROM supply_sites WHERE tenant_id=? AND id=?").get(tenant(res),siteId);
    const isAdmin=roles.includes("enterprise_admin");
    const assignment=isAdmin ? true : Boolean(db.prepare(
      "SELECT 1 FROM supply_site_assignments WHERE tenant_id=? AND user_id=? AND site_id=? AND status='active'"
    ).get(tenant(res),actor(res),siteId));
    if (!target || target.active!==1 || !siteAllowedForRoles(roles,target.siteType) || !assignment) {
      audit(req,res,{action:"site_scope_check",outcome:"denied",entityType:"site",entityId:siteId,details:{roles,assignmentRequired:!isAdmin}});
      return res.status(403).json({error:"site_scope_denied"});
    }
    return next();
  };
  const requireLotIntakeScope = (req,res,next) => {
    const roles = res.locals.activeTenant?.roles ?? [];
    if (!roles.some(role=>["enterprise_admin","warehouse","supplier"].includes(role))) return res.status(403).json({ error: "enterprise_role_forbidden" });
    return requireSiteScope(req,res,next,String(req.body?.siteId??"").trim());
  };
  const requireStockSiteScope = (req,res,next) => requireSiteScope(req,res,next,String(req.query.siteId??"").trim());
  const requireBodySiteScope = (field) => (req,res,next) => requireSiteScope(req,res,next,String(req.body?.[field]??"").trim());
  const requireTransferSiteScope = (req,res,next) => {
    const roles=res.locals.activeTenant?.roles??[];
    const isAdmin=roles.includes("enterprise_admin");
    for (const siteId of [String(req.body?.fromSiteId??"").trim(),String(req.body?.toSiteId??"").trim()]) {
      const target=db.prepare("SELECT site_type AS siteType,active FROM supply_sites WHERE tenant_id=? AND id=?").get(tenant(res),siteId);
      const assignment=isAdmin ? true : Boolean(db.prepare(
        "SELECT 1 FROM supply_site_assignments WHERE tenant_id=? AND user_id=? AND site_id=? AND status='active'"
      ).get(tenant(res),actor(res),siteId));
      if (!target || target.active!==1 || !siteAllowedForRoles(roles,target.siteType) || !assignment) {
        audit(req,res,{action:"site_scope_check",outcome:"denied",entityType:"site",entityId:siteId,details:{roles,assignmentRequired:!isAdmin}});
        return res.status(403).json({error:"site_scope_denied"});
      }
    }
    return next();
  };
  const requireHandoverSiteScope = (siteField) => (req,res,next) => {
    const column=siteField==="from"?"from_site_id":"to_site_id";
    const row=db.prepare("SELECT "+column+" AS siteId FROM handovers WHERE tenant_id=? AND id=?").get(tenant(res),String(req.params?.handoverId??""));
    if(!row) return res.status(404).json({error:"handover_not_found"});
    return requireSiteScope(req,res,next,row.siteId);
  };
  const requireLotSiteScope = (req,res,next) => {
    const row=db.prepare("SELECT origin_site_id AS siteId FROM supply_lots WHERE tenant_id=? AND id=?").get(tenant(res),String(req.params?.lotId??""));
    if(!row) return res.status(404).json({error:"lot_not_found"});
    return requireSiteScope(req,res,next,row.siteId);
  };


  app.post("/api/v1/supply/sites/:siteId/assignments", ...secured, requireEnterpriseRole("enterprise_admin"), (req,res) => {
    try {
      const data=db.transaction(() => {
        const siteId=String(req.params.siteId??"").trim();
        const userId=String(req.body?.userId??"").trim();
        if (!userId) throw new SupplyChainError(400,"user_id_required");
        const target=db.prepare("SELECT id FROM supply_sites WHERE tenant_id=? AND id=? AND active=1").get(tenant(res),siteId);
        if (!target) throw new SupplyChainError(404,"site_not_found");
        const now=new Date().toISOString();
        db.prepare(`INSERT INTO supply_site_assignments(tenant_id,user_id,site_id,status,granted_by,created_at,updated_at)
          VALUES(?,?,?,'active',?,?,?)
          ON CONFLICT(tenant_id,user_id,site_id) DO UPDATE SET status='active',granted_by=excluded.granted_by,updated_at=excluded.updated_at`)
          .run(tenant(res),userId,siteId,actor(res),now,now);
        if (!audit(req,res,{action:"site_assignment_grant",outcome:"success",entityType:"site",entityId:siteId,details:{userId}})) {
          const error=new Error("audit_write_failed"); error.code="AUDIT_WRITE_FAILED"; throw error;
        }
        return {tenantId:tenant(res),userId,siteId,status:"active"};
      })();
      return res.status(201).json({data});
    } catch(error) {
      if(error?.code==="AUDIT_WRITE_FAILED") return res.status(503).json({error:"audit_unavailable"});
      if(error instanceof SupplyChainError) return res.status(error.status).json({error:error.code});
      return res.status(500).json({error:"site_assignment_failed"});
    }
  });
  app.delete("/api/v1/supply/sites/:siteId/assignments/:userId", ...secured, requireEnterpriseRole("enterprise_admin"), (req,res) => {
    try {
      const data=db.transaction(() => {
        const siteId=String(req.params.siteId??"").trim();
        const userId=String(req.params.userId??"").trim();
        const result=db.prepare("UPDATE supply_site_assignments SET status='revoked',updated_at=? WHERE tenant_id=? AND user_id=? AND site_id=? AND status='active'")
          .run(new Date().toISOString(),tenant(res),userId,siteId);
        if (!result.changes) throw new SupplyChainError(404,"active_assignment_not_found");
        if (!audit(req,res,{action:"site_assignment_revoke",outcome:"success",entityType:"site",entityId:siteId,details:{userId}})) {
          const error=new Error("audit_write_failed"); error.code="AUDIT_WRITE_FAILED"; throw error;
        }
        return {tenantId:tenant(res),userId,siteId,status:"revoked"};
      })();
      return res.status(200).json({data});
    } catch(error) {
      if(error?.code==="AUDIT_WRITE_FAILED") return res.status(503).json({error:"audit_unavailable"});
      if(error instanceof SupplyChainError) return res.status(error.status).json({error:error.code});
      return res.status(500).json({error:"site_assignment_failed"});
    }
  });

  app.post("/api/v1/supply/sites", ...secured, requireEnterpriseRole("enterprise_admin"), handle((req,res) => service().createSite({
    tenantId:tenant(res),actorId:actor(res),siteCode:req.body?.siteCode,name:req.body?.name,siteType:req.body?.siteType,
    countryCode:req.body?.countryCode,addressText:req.body?.addressText,
  })));
  app.post("/api/v1/supply/lots", ...secured, requireEnterpriseRole("enterprise_admin","supplier","warehouse"), requireLotIntakeScope, handle((req,res) => service().receiveLot({
    tenantId:tenant(res),actorId:actor(res),siteId:req.body?.siteId,lotCode:req.body?.lotCode,productId:req.body?.productId,
    commodityName:req.body?.commodityName,quantityMilli:req.body?.quantityMilli,unit:req.body?.unit,
    harvestAt:req.body?.harvestAt,originEvidenceRef:req.body?.originEvidenceRef,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/lots/:lotId/inspections", ...secured, requireEnterpriseRole("enterprise_admin","qc"), requireBodySiteScope("siteId"), handle((req,res) => service().inspectLot({
    tenantId:tenant(res),actorId:actor(res),lotId:req.params.lotId,siteId:req.body?.siteId,
    inspectionType:req.body?.inspectionType,result:req.body?.result,criteria:req.body?.criteria,
    findings:req.body?.findings,correctiveAction:req.body?.correctiveAction,evidenceRef:req.body?.evidenceRef,
  })));
  app.post("/api/v1/supply/processing", ...secured, requireEnterpriseRole("enterprise_admin","warehouse"), requireBodySiteScope("siteId"), handle((req,res) => service().processLot({
    tenantId:tenant(res),actorId:actor(res),siteId:req.body?.siteId,inputs:req.body?.inputs,outputs:req.body?.outputs,
    lossQuantityMilli:req.body?.lossQuantityMilli,lossReason:req.body?.lossReason,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/movements", ...secured, requireEnterpriseRole("enterprise_admin","warehouse","logistics"), requireTransferSiteScope, handle((req,res) => service().moveStock({
    tenantId:tenant(res),actorId:actor(res),lotId:req.body?.lotId,fromSiteId:req.body?.fromSiteId,
    toSiteId:req.body?.toSiteId,quantityMilli:req.body?.quantityMilli,unit:req.body?.unit,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/evidence", ...secured, requireEnterpriseRole("enterprise_admin","buyer","seller","supplier","warehouse","qc","logistics","auditor"), handle((req,res) => service().addEvidence({
    tenantId:tenant(res),actorId:actor(res),roles:res.locals.activeTenant?.roles??[],siteAllowed:(siteType,siteId)=>siteAllowedForRoles(res.locals.activeTenant?.roles??[],siteType)&&(res.locals.activeTenant?.roles??[]).includes("enterprise_admin")||Boolean(db.prepare("SELECT 1 FROM supply_site_assignments WHERE tenant_id=? AND user_id=? AND site_id=? AND status='active'").get(tenant(res),actor(res),siteId))&&siteAllowedForRoles(res.locals.activeTenant?.roles??[],siteType),entityType:req.body?.entityType,entityId:req.body?.entityId,
    evidenceType:req.body?.evidenceType,storageUri:req.body?.storageUri,contentSha256:req.body?.contentSha256,
    capturedAt:req.body?.capturedAt,metadata:req.body?.metadata,retentionUntil:req.body?.retentionUntil,
  })));
  app.get("/api/v1/supply/stock", ...secured, requireEnterpriseRole("enterprise_admin","buyer","warehouse","qc","logistics","auditor"), requireStockSiteScope, (req,res) => {
    try {
      const data=service().stock({tenantId:tenant(res),siteId:String(req.query.siteId??"")});
      res.setHeader("Cache-Control","no-store"); return res.json({data});
    } catch(error) { return res.status(error instanceof SupplyChainError?error.status:500).json({error:error instanceof SupplyChainError?error.code:"supply_chain_operation_failed"}); }
  });
  app.get("/api/v1/supply/lots/:lotId/trace", ...secured, requireEnterpriseRole("enterprise_admin","buyer","seller","warehouse","qc","logistics","auditor"), requireLotSiteScope, (req,res) => {
    try {
      const data=service().trace({tenantId:tenant(res),lotId:req.params.lotId});
      res.setHeader("Cache-Control","no-store"); return res.json({data});
    } catch(error) { return res.status(error instanceof SupplyChainError?error.status:500).json({error:error instanceof SupplyChainError?error.code:"supply_chain_operation_failed"}); }
  });
  app.post("/api/v1/supply/handovers", ...secured, requireEnterpriseRole("enterprise_admin","warehouse","logistics"), requireTransferSiteScope, handle((req,res) => service().prepareHandover({
    tenantId:tenant(res),actorId:actor(res),lotId:req.body?.lotId,fromSiteId:req.body?.fromSiteId,toSiteId:req.body?.toSiteId,
    quantityMilli:req.body?.quantityMilli,unit:req.body?.unit,handoverCode:req.body?.handoverCode,
    idempotencyKey:req.get("idempotency-key"),carrierName:req.body?.carrierName,
    vehicleOrContainerRef:req.body?.vehicleOrContainerRef,sealNumber:req.body?.sealNumber,
  })));
  app.post("/api/v1/supply/handovers/:handoverId/dispatch", ...secured, requireEnterpriseRole("enterprise_admin","logistics"), requireHandoverSiteScope("from"), handle((req,res) => service().dispatchHandover({
    tenantId:tenant(res),actorId:actor(res),handoverId:req.params.handoverId,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/handovers/:handoverId/receive", ...secured, requireEnterpriseRole("enterprise_admin","warehouse","logistics","qc"), requireHandoverSiteScope("to"), handle((req,res) => service().receiveHandover({
    tenantId:tenant(res),actorId:actor(res),handoverId:req.params.handoverId,
    receivedQuantityMilli:req.body?.receivedQuantityMilli,sealNumber:req.body?.sealNumber,
  })));
}
