import { createSupplyChainService, SupplyChainError } from "./supply-chain.mjs";

export function registerSupplyChainRoutes(app, { db, auth, requireActiveTenant, authLimiter }) {
  const service = createSupplyChainService(db);
  const actor = (res) => res.locals.authIdentity?.id ?? "";
  const tenant = (res) => res.locals.activeTenant?.id ?? "";
  const requireAdmin = (req, res, next) => {
    if (!["buyer_admin","seller_admin"].includes(res.locals.activeTenant?.role)) return res.status(403).json({ error: "tenant_admin_required" });
    return next();
  };
  const handle = (fn) => (req, res) => {
    try {
      const result = fn(req, res);
      res.setHeader("Cache-Control", "no-store");
      return res.status(result?.duplicate ? 200 : 201).json({ data: result });
    } catch (error) {
      if (error instanceof SupplyChainError) return res.status(error.status).json({ error: error.code });
      if (String(error?.code ?? "").startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "constraint_conflict" });
      return res.status(500).json({ error: "supply_chain_operation_failed" });
    }
  };
  const secured = [authLimiter, auth.authenticate, requireActiveTenant];

  app.post("/api/v1/supply/sites", ...secured, requireAdmin, handle((req,res) => service.createSite({
    tenantId:tenant(res),actorId:actor(res),siteCode:req.body?.siteCode,name:req.body?.name,siteType:req.body?.siteType,
    countryCode:req.body?.countryCode,addressText:req.body?.addressText,
  })));
  app.post("/api/v1/supply/lots", ...secured, handle((req,res) => service.receiveLot({
    tenantId:tenant(res),actorId:actor(res),siteId:req.body?.siteId,lotCode:req.body?.lotCode,productId:req.body?.productId,
    commodityName:req.body?.commodityName,quantityMilli:req.body?.quantityMilli,unit:req.body?.unit,
    harvestAt:req.body?.harvestAt,originEvidenceRef:req.body?.originEvidenceRef,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/lots/:lotId/inspections", ...secured, requireAdmin, handle((req,res) => service.inspectLot({
    tenantId:tenant(res),actorId:actor(res),lotId:req.params.lotId,siteId:req.body?.siteId,
    inspectionType:req.body?.inspectionType,result:req.body?.result,criteria:req.body?.criteria,
    findings:req.body?.findings,correctiveAction:req.body?.correctiveAction,evidenceRef:req.body?.evidenceRef,
  })));
  app.post("/api/v1/supply/processing", ...secured, handle((req,res) => service.processLot({
    tenantId:tenant(res),actorId:actor(res),siteId:req.body?.siteId,inputs:req.body?.inputs,outputs:req.body?.outputs,
    idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/movements", ...secured, handle((req,res) => service.moveStock({
    tenantId:tenant(res),actorId:actor(res),lotId:req.body?.lotId,fromSiteId:req.body?.fromSiteId,
    toSiteId:req.body?.toSiteId,quantityMilli:req.body?.quantityMilli,unit:req.body?.unit,idempotencyKey:req.get("idempotency-key"),
  })));
  app.get("/api/v1/supply/stock", ...secured, (req,res) => {
    try {
      const data=service.stock({tenantId:tenant(res),siteId:String(req.query.siteId??"")});
      res.setHeader("Cache-Control","no-store"); return res.json({data});
    } catch(error) { return res.status(error instanceof SupplyChainError?error.status:500).json({error:error instanceof SupplyChainError?error.code:"supply_chain_operation_failed"}); }
  });
  app.get("/api/v1/supply/lots/:lotId/trace", ...secured, (req,res) => {
    try {
      const data=service.trace({tenantId:tenant(res),lotId:req.params.lotId});
      res.setHeader("Cache-Control","no-store"); return res.json({data});
    } catch(error) { return res.status(error instanceof SupplyChainError?error.status:500).json({error:error instanceof SupplyChainError?error.code:"supply_chain_operation_failed"}); }
  });
  app.post("/api/v1/supply/handovers", ...secured, handle((req,res) => service.prepareHandover({
    tenantId:tenant(res),actorId:actor(res),lotId:req.body?.lotId,fromSiteId:req.body?.fromSiteId,toSiteId:req.body?.toSiteId,
    quantityMilli:req.body?.quantityMilli,unit:req.body?.unit,handoverCode:req.body?.handoverCode,
    idempotencyKey:req.get("idempotency-key"),carrierName:req.body?.carrierName,
    vehicleOrContainerRef:req.body?.vehicleOrContainerRef,sealNumber:req.body?.sealNumber,
  })));
  app.post("/api/v1/supply/handovers/:handoverId/dispatch", ...secured, handle((req,res) => service.dispatchHandover({
    tenantId:tenant(res),actorId:actor(res),handoverId:req.params.handoverId,idempotencyKey:req.get("idempotency-key"),
  })));
  app.post("/api/v1/supply/handovers/:handoverId/receive", ...secured, handle((req,res) => service.receiveHandover({
    tenantId:tenant(res),actorId:actor(res),handoverId:req.params.handoverId,
    receivedQuantityMilli:req.body?.receivedQuantityMilli,sealNumber:req.body?.sealNumber,
  })));
}
