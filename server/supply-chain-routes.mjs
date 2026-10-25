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
    } catch { /* Auditing must not mask the primary operation; CI/health checks verify schema readiness. */ }
  };
  const handle = (fn) => (req, res) => {
    try {
      const result = fn(req, res);
      audit(req,res,{action:`${req.method} ${req.route?.path??req.path}`,outcome:"success",entityId:result?.id??result?.lotId??result?.movementId??result?.handoverId??""});
      res.setHeader("Cache-Control", "no-store");
      return res.status(result?.duplicate ? 200 : 201).json({ data: result });
    } catch (error) {
      const denied = error instanceof SupplyChainError && error.status === 403;
      audit(req,res,{action:`${req.method} ${req.route?.path??req.path}`,outcome:denied?"denied":"failure",details:{errorCode:error instanceof SupplyChainError?error.code:String(error?.code??"internal_error")}});
      if (error instanceof SupplyChainError) return res.status(error.status).json({ error: error.code });
      if (String(error?.code ?? "").startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "constraint_conflict" });
      return res.status(500).json({ error: "supply_chain_operation_failed" });
    }
  };
  const secured = [authLimiter, auth.authenticate, requireActiveTenant];
  const siteAllowedForRoles = (roles,siteType) => roles.some(role => ({
    enterprise_admin: ["plantation","supplier","packing_house","warehouse","port_terminal","in_transit","buyer"].includes(siteType),
    supplier: ["supplier","plantation"].includes(siteType),
    warehouse: ["warehouse","packing_house"].includes(siteType),
    logistics: ["warehouse","in_transit","port_terminal"].includes(siteType),
    qc: ["supplier","plantation","packing_house","warehouse","port_terminal"].includes(siteType),
    buyer: siteType === "buyer",
    seller: ["supplier","plantation","packing_house"].includes(siteType),
    auditor: true,
  })[role] === true);
  const requireSiteScope = (req,res,next,siteId) => {
    const roles=res.locals.activeTenant?.roles??[];
    const target=db.prepare("SELECT site_type AS siteType,active FROM supply_sites WHERE tenant_id=? AND id=?").get(tenant(res),siteId);
    if (!target || target.active!==1 || !siteAllowedForRoles(roles,target.siteType)) {
      audit(req,res,{action:"site_scope_check",outcome:"denied",entityType:"site",entityId:siteId,details:{roles}});
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


  app.post("/api/v1/supply/sites", ...secured, requireEnterpriseRole("enterprise_admin"), handle((req,res) => service().createSite({
    tenantId:tenant(res),actorId:actor(res),siteCode:req.body?.siteCode,name:req.body?.name,siteType:req.body?.siteType,
    countryCode:req.body?.countryCode,addressText:req.body?.addressText,
  })));
  app.post("/api/v1/supply/lots", ...secured, requireEnterpriseRole("enterprise_admin","supplier","warehouse"), requireLotIntakeScope, handle((req,res) => service().receiveLot({
    tenantId:tenant(res),actorId:actor(res),siteId:req.body?.siteId,lotCode:req.body?.lotCode,productId:req.body?.productId,
    commodityName:req.body?.commodityName,quantityMilli:req.body?.quantityMilli,unit:req.body?.unit,
    harvestAt:req.body?.harvestAt,originEvidenceRef:req.body?.originEvidenceRef,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/lots/:lotId/inspections", ...secured, requireEnterpriseRole("enterprise_admin","qc"), handle((req,res) => service().inspectLot({
    tenantId:tenant(res),actorId:actor(res),lotId:req.params.lotId,siteId:req.body?.siteId,
    inspectionType:req.body?.inspectionType,result:req.body?.result,criteria:req.body?.criteria,
    findings:req.body?.findings,correctiveAction:req.body?.correctiveAction,evidenceRef:req.body?.evidenceRef,
  })));
  app.post("/api/v1/supply/processing", ...secured, requireEnterpriseRole("enterprise_admin","warehouse"), handle((req,res) => service().processLot({
    tenantId:tenant(res),actorId:actor(res),siteId:req.body?.siteId,inputs:req.body?.inputs,outputs:req.body?.outputs,
    lossQuantityMilli:req.body?.lossQuantityMilli,lossReason:req.body?.lossReason,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/movements", ...secured, requireEnterpriseRole("enterprise_admin","warehouse","logistics"), handle((req,res) => service().moveStock({
    tenantId:tenant(res),actorId:actor(res),lotId:req.body?.lotId,fromSiteId:req.body?.fromSiteId,
    toSiteId:req.body?.toSiteId,quantityMilli:req.body?.quantityMilli,unit:req.body?.unit,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/evidence", ...secured, requireEnterpriseRole("enterprise_admin","buyer","seller","supplier","warehouse","qc","logistics","auditor"), handle((req,res) => service().addEvidence({
    tenantId:tenant(res),actorId:actor(res),roles:res.locals.activeTenant?.roles??[],siteAllowed:(siteType)=>siteAllowedForRoles(res.locals.activeTenant?.roles??[],siteType),entityType:req.body?.entityType,entityId:req.body?.entityId,
    evidenceType:req.body?.evidenceType,storageUri:req.body?.storageUri,contentSha256:req.body?.contentSha256,
    capturedAt:req.body?.capturedAt,metadata:req.body?.metadata,retentionUntil:req.body?.retentionUntil,
  })));
  app.get("/api/v1/supply/stock", ...secured, requireEnterpriseRole("enterprise_admin","buyer","warehouse","qc","logistics","auditor"), requireStockSiteScope, (req,res) => {
    try {
      const data=service().stock({tenantId:tenant(res),siteId:String(req.query.siteId??"")});
      res.setHeader("Cache-Control","no-store"); return res.json({data});
    } catch(error) { return res.status(error instanceof SupplyChainError?error.status:500).json({error:error instanceof SupplyChainError?error.code:"supply_chain_operation_failed"}); }
  });
  app.get("/api/v1/supply/lots/:lotId/trace", ...secured, requireEnterpriseRole("enterprise_admin","buyer","seller","warehouse","qc","logistics","auditor"), (req,res) => {
    try {
      const data=service().trace({tenantId:tenant(res),lotId:req.params.lotId});
      res.setHeader("Cache-Control","no-store"); return res.json({data});
    } catch(error) { return res.status(error instanceof SupplyChainError?error.status:500).json({error:error instanceof SupplyChainError?error.code:"supply_chain_operation_failed"}); }
  });
  app.post("/api/v1/supply/handovers", ...secured, requireEnterpriseRole("enterprise_admin","warehouse","logistics"), handle((req,res) => service().prepareHandover({
    tenantId:tenant(res),actorId:actor(res),lotId:req.body?.lotId,fromSiteId:req.body?.fromSiteId,toSiteId:req.body?.toSiteId,
    quantityMilli:req.body?.quantityMilli,unit:req.body?.unit,handoverCode:req.body?.handoverCode,
    idempotencyKey:req.get("idempotency-key"),carrierName:req.body?.carrierName,
    vehicleOrContainerRef:req.body?.vehicleOrContainerRef,sealNumber:req.body?.sealNumber,
  })));
  app.post("/api/v1/supply/handovers/:handoverId/dispatch", ...secured, requireEnterpriseRole("enterprise_admin","logistics"), handle((req,res) => service().dispatchHandover({
    tenantId:tenant(res),actorId:actor(res),handoverId:req.params.handoverId,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/handovers/:handoverId/receive", ...secured, requireEnterpriseRole("enterprise_admin","warehouse","logistics","qc"), handle((req,res) => service().receiveHandover({
    tenantId:tenant(res),actorId:actor(res),handoverId:req.params.handoverId,
    receivedQuantityMilli:req.body?.receivedQuantityMilli,sealNumber:req.body?.sealNumber,
  })));
}
