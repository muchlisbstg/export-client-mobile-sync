import crypto from "node:crypto";

const now = () => new Date().toISOString();
const jsonHash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const id = () => crypto.randomUUID();
const positiveInt = (value, field = "quantityMilli") => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new SupplyChainError(400, "invalid_quantity", `${field} must be a positive integer in thousandths of the declared unit`);
  return value;
};

export class SupplyChainError extends Error {
  constructor(status, code, message = code) { super(message); this.status = status; this.code = code; }
}

export function migrateSupplyChain(db) {
  const required = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tenants'").get();
  if (!required) throw new Error("tenant migration must run before supply-chain migration");
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supply_sites (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id),
        site_code TEXT NOT NULL, name TEXT NOT NULL,
        site_type TEXT NOT NULL CHECK(site_type IN ('plantation','supplier','packing_house','warehouse','port_terminal','in_transit','buyer')),
        country_code TEXT, address_text TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL, UNIQUE(tenant_id,id), UNIQUE(tenant_id,site_code)
      );
      CREATE TABLE IF NOT EXISTS supply_lots (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), lot_code TEXT NOT NULL,
        product_id TEXT NOT NULL, commodity_name TEXT NOT NULL,
        origin_site_id TEXT NOT NULL, current_status TEXT NOT NULL DEFAULT 'open'
          CHECK(current_status IN ('open','quarantined','released','blocked','closed')),
        unit TEXT NOT NULL CHECK(length(trim(unit)) BETWEEN 1 AND 20),
        harvest_at TEXT, received_at TEXT, origin_evidence_ref TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(tenant_id,id), UNIQUE(tenant_id,lot_code),
        FOREIGN KEY(tenant_id,origin_site_id) REFERENCES supply_sites(tenant_id,id)
      );
      CREATE TABLE IF NOT EXISTS lot_genealogy (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
        parent_lot_id TEXT NOT NULL, child_lot_id TEXT NOT NULL,
        relationship TEXT NOT NULL CHECK(relationship IN ('split_into','combined_into','processed_into','repacked_into','rejected_from')),
        input_quantity_milli INTEGER NOT NULL CHECK(input_quantity_milli > 0),
        output_quantity_milli INTEGER CHECK(output_quantity_milli IS NULL OR output_quantity_milli > 0),
        unit TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
        CHECK(parent_lot_id <> child_lot_id),
        FOREIGN KEY(tenant_id,parent_lot_id) REFERENCES supply_lots(tenant_id,id),
        FOREIGN KEY(tenant_id,child_lot_id) REFERENCES supply_lots(tenant_id,id),
        UNIQUE(tenant_id,parent_lot_id,child_lot_id,relationship)
      );
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
        movement_type TEXT NOT NULL CHECK(movement_type IN ('receipt','transfer','processing','dispatch','return','adjustment','write_off')),
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','reversed')),
        reference_type TEXT, reference_id TEXT, occurred_at TEXT NOT NULL, recorded_by TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(tenant_id,id), UNIQUE(tenant_id,idempotency_key),
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );
      CREATE TABLE IF NOT EXISTS inventory_entries (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, movement_id TEXT NOT NULL,
        lot_id TEXT NOT NULL, site_id TEXT NOT NULL,
        quantity_milli_delta INTEGER NOT NULL CHECK(quantity_milli_delta <> 0),
        unit TEXT NOT NULL, created_at TEXT NOT NULL,
        FOREIGN KEY(tenant_id,movement_id) REFERENCES inventory_movements(tenant_id,id),
        FOREIGN KEY(tenant_id,lot_id) REFERENCES supply_lots(tenant_id,id),
        FOREIGN KEY(tenant_id,site_id) REFERENCES supply_sites(tenant_id,id)
      );
      CREATE INDEX IF NOT EXISTS idx_supply_stock ON inventory_entries(tenant_id,lot_id,site_id);
      CREATE INDEX IF NOT EXISTS idx_supply_movements ON inventory_movements(tenant_id,status,occurred_at);
      CREATE TABLE IF NOT EXISTS quality_inspections (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, lot_id TEXT NOT NULL, site_id TEXT NOT NULL,
        inspection_type TEXT NOT NULL CHECK(inspection_type IN ('receiving','grading','processing','pre_dispatch','port_gate','laboratory','other')),
        result TEXT NOT NULL CHECK(result IN ('pending','pass','conditional_pass','fail','hold')),
        inspected_at TEXT NOT NULL, inspector_id TEXT NOT NULL, criteria_json TEXT NOT NULL DEFAULT '{}',
        findings TEXT, corrective_action TEXT, evidence_ref TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY(tenant_id,lot_id) REFERENCES supply_lots(tenant_id,id),
        FOREIGN KEY(tenant_id,site_id) REFERENCES supply_sites(tenant_id,id)
      );
      CREATE INDEX IF NOT EXISTS idx_supply_quality_lot ON quality_inspections(tenant_id,lot_id,inspected_at);
      CREATE TABLE IF NOT EXISTS handovers (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, handover_code TEXT NOT NULL,
        lot_id TEXT NOT NULL, from_site_id TEXT NOT NULL, to_site_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','dispatched','received','discrepancy','rejected','cancelled')),
        quantity_milli INTEGER NOT NULL CHECK(quantity_milli > 0), unit TEXT NOT NULL,
        dispatch_at TEXT, received_at TEXT, dispatched_by TEXT NOT NULL, received_by TEXT,
        carrier_name TEXT, vehicle_or_container_ref TEXT, seal_number TEXT, discrepancy_note TEXT,
        idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(tenant_id,handover_code), UNIQUE(tenant_id,idempotency_key),
        FOREIGN KEY(tenant_id,lot_id) REFERENCES supply_lots(tenant_id,id),
        FOREIGN KEY(tenant_id,from_site_id) REFERENCES supply_sites(tenant_id,id),
        FOREIGN KEY(tenant_id,to_site_id) REFERENCES supply_sites(tenant_id,id),
        CHECK(from_site_id <> to_site_id)
      );
      CREATE TABLE IF NOT EXISTS supply_evidence (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, entity_type TEXT NOT NULL
          CHECK(entity_type IN ('lot','inspection','movement','handover')),
        entity_id TEXT NOT NULL, evidence_type TEXT NOT NULL, storage_uri TEXT NOT NULL,
        content_sha256 TEXT, captured_at TEXT NOT NULL, uploaded_by TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}', retention_until TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );
      CREATE INDEX IF NOT EXISTS idx_supply_evidence_entity ON supply_evidence(tenant_id,entity_type,entity_id);
      CREATE TRIGGER IF NOT EXISTS inventory_entry_no_update BEFORE UPDATE ON inventory_entries
        BEGIN SELECT RAISE(ABORT,'inventory_entries_are_append_only'); END;
      CREATE TRIGGER IF NOT EXISTS inventory_entry_no_delete BEFORE DELETE ON inventory_entries
        BEGIN SELECT RAISE(ABORT,'inventory_entries_are_append_only'); END;
      CREATE TRIGGER IF NOT EXISTS inventory_entry_no_insert_after_post BEFORE INSERT ON inventory_entries
        WHEN (SELECT status FROM inventory_movements WHERE tenant_id=NEW.tenant_id AND id=NEW.movement_id) <> 'draft'
        BEGIN SELECT RAISE(ABORT,'inventory_movement_not_draft'); END;
      CREATE TRIGGER IF NOT EXISTS posted_movement_no_mutation BEFORE UPDATE ON inventory_movements
        WHEN OLD.status='posted' AND (
          NEW.tenant_id<>OLD.tenant_id OR NEW.idempotency_key<>OLD.idempotency_key OR
          NEW.payload_hash<>OLD.payload_hash OR NEW.movement_type<>OLD.movement_type OR
          NEW.occurred_at<>OLD.occurred_at OR NEW.recorded_by<>OLD.recorded_by OR
          NEW.reference_type IS NOT OLD.reference_type OR NEW.reference_id IS NOT OLD.reference_id OR
          NEW.created_at<>OLD.created_at OR NEW.status NOT IN ('posted','reversed')
        ) BEGIN SELECT RAISE(ABORT,'posted_inventory_movement_is_immutable'); END;
    `);
  })();
  return { applied: true, idempotent: true };
}

export function createSupplyChainService(db) {
  const site = db.prepare("SELECT id,site_type AS siteType,active FROM supply_sites WHERE tenant_id=? AND id=?");
  const lot = db.prepare("SELECT * FROM supply_lots WHERE tenant_id=? AND id=?");
  const balance = db.prepare("SELECT COALESCE(SUM(e.quantity_milli_delta),0) AS quantityMilli FROM inventory_entries e JOIN inventory_movements m ON m.tenant_id=e.tenant_id AND m.id=e.movement_id WHERE e.tenant_id=? AND e.lot_id=? AND e.site_id=? AND m.status='posted'");
  const requireSite = (tenantId, siteId) => {
    const value = site.get(tenantId, siteId);
    if (!value || value.active !== 1) throw new SupplyChainError(404, "site_not_found");
    return value;
  };
  const requireLot = (tenantId, lotId) => {
    const value = lot.get(tenantId, lotId);
    if (!value) throw new SupplyChainError(404, "lot_not_found");
    return value;
  };
  const ensureDispatchable = (tenantId, lotId) => {
    const value = requireLot(tenantId, lotId);
    if (value.current_status !== "released") throw new SupplyChainError(409, "lot_not_released");
    const latest = db.prepare("SELECT result FROM quality_inspections WHERE tenant_id=? AND lot_id=? ORDER BY inspected_at DESC, rowid DESC LIMIT 1").get(tenantId, lotId);
    if (latest && ["hold","fail","pending"].includes(latest.result)) throw new SupplyChainError(409, "quality_gate_blocked");
    return value;
  };
  function createMovement({tenantId, idempotencyKey, payload, movementType, recordedBy, referenceType = null, referenceId = null}) {
    if (!idempotencyKey || idempotencyKey.length > 160) throw new SupplyChainError(400, "idempotency_key_required");
    const hash = jsonHash({movementType,payload,referenceType,referenceId});
    const existing = db.prepare("SELECT id,payload_hash AS payloadHash,status FROM inventory_movements WHERE tenant_id=? AND idempotency_key=?").get(tenantId,idempotencyKey);
    if (existing) {
      if (existing.payloadHash !== hash) throw new SupplyChainError(409, "idempotency_conflict");
      return { id: existing.id, duplicate: true, status: existing.status };
    }
    const movementId = id(), time = now();
    db.prepare("INSERT INTO inventory_movements(id,tenant_id,idempotency_key,payload_hash,movement_type,status,reference_type,reference_id,occurred_at,recorded_by,created_at) VALUES(?,?,?,?,?,'draft',?,?,?,?,?)")
      .run(movementId,tenantId,idempotencyKey,hash,movementType,referenceType,referenceId,time,recordedBy,time);
    return { id: movementId, duplicate: false, status: "draft" };
  }
  function insertEntry(tenantId, movementId, lotId, siteId, delta, unit) {
    db.prepare("INSERT INTO inventory_entries(id,tenant_id,movement_id,lot_id,site_id,quantity_milli_delta,unit,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(id(),tenantId,movementId,lotId,siteId,delta,unit,now());
  }
  function postMovement(movementId, tenantId) {
    const negatives = db.prepare(`SELECT e.lot_id AS lotId,e.site_id AS siteId,e.unit,
      SUM(e.quantity_milli_delta) AS delta FROM inventory_entries e
      WHERE e.tenant_id=? AND e.movement_id=? GROUP BY e.lot_id,e.site_id,e.unit`).all(tenantId,movementId);
    for (const row of negatives) {
      const result = balance.get(tenantId,row.lotId,row.siteId).quantityMilli + row.delta;
      if (result < 0) throw new SupplyChainError(409,"insufficient_stock");
    }
    const count = db.prepare("SELECT COUNT(*) AS count FROM inventory_entries WHERE tenant_id=? AND movement_id=?").get(tenantId,movementId).count;
    if (count < 1) throw new SupplyChainError(400,"empty_movement");
    db.prepare("UPDATE inventory_movements SET status='posted' WHERE tenant_id=? AND id=? AND status='draft'").run(tenantId,movementId);
  }
  const inTxn = (fn) => db.transaction(fn).immediate();

  function createSite(input) {
    const {tenantId,siteCode,name,siteType,actorId} = input;
    if (!tenantId || !siteCode || !name || !actorId || !["plantation","supplier","packing_house","warehouse","port_terminal","in_transit","buyer"].includes(siteType)) throw new SupplyChainError(400,"invalid_site");
    const siteId=id();
    db.prepare("INSERT INTO supply_sites(id,tenant_id,site_code,name,site_type,country_code,address_text,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(siteId,tenantId,siteCode.trim(),name.trim(),siteType,input.countryCode??null,input.addressText??null,now());
    return {id:siteId,tenantId,siteCode:siteCode.trim(),name:name.trim(),siteType};
  }
  function receiveLot(input) {
    const {tenantId,siteId,lotCode,productId,commodityName,quantityMilli,unit,actorId,idempotencyKey} = input;
    positiveInt(quantityMilli);
    if (![tenantId,siteId,lotCode,productId,commodityName,unit,actorId].every(v=>typeof v==="string"&&v.trim())) throw new SupplyChainError(400,"invalid_lot");
    return inTxn(() => {
      requireSite(tenantId,siteId);
      const payload={siteId,lotCode,productId,commodityName,quantityMilli,unit,harvestAt:input.harvestAt??null,originEvidenceRef:input.originEvidenceRef??null};
      const hash=jsonHash({movementType:"receipt",payload});
      const prior=db.prepare("SELECT id,payload_hash AS payloadHash,status FROM inventory_movements WHERE tenant_id=? AND idempotency_key=?").get(tenantId,idempotencyKey);
      if (prior) {
        if(prior.payloadHash!==jsonHash({movementType:"receipt",payload,referenceType:"lot",referenceId:prior.reference_id})) throw new SupplyChainError(409,"idempotency_conflict");
        const old=db.prepare("SELECT id,lot_code AS lotCode FROM supply_lots WHERE tenant_id=? AND id=?").get(tenantId,prior.reference_id);
        return {lotId:old?.id,lotCode:old?.lotCode,movementId:prior.id,duplicate:true};
      }
      const lotId=id(), time=now();
      db.prepare("INSERT INTO supply_lots(id,tenant_id,lot_code,product_id,commodity_name,origin_site_id,current_status,unit,harvest_at,received_at,origin_evidence_ref,created_by,created_at) VALUES(?,?,?,?,?,?,'quarantined',?,?,?,?,?,?)")
        .run(lotId,tenantId,lotCode,productId,commodityName,siteId,unit,input.harvestAt??null,time,input.originEvidenceRef??null,actorId,time);
      const movement=createMovement({tenantId,idempotencyKey,payload,movementType:"receipt",recordedBy:actorId,referenceType:"lot",referenceId:lotId});
      insertEntry(tenantId,movement.id,lotId,siteId,quantityMilli,unit);
      postMovement(movement.id,tenantId);
      return {lotId,lotCode,movementId:movement.id,duplicate:false,status:"quarantined"};
    })();
  }
  function moveStock(input) {
    const {tenantId,lotId,fromSiteId,toSiteId,quantityMilli,unit,actorId,idempotencyKey}=input;
    positiveInt(quantityMilli);
    if(fromSiteId===toSiteId) throw new SupplyChainError(400,"same_site_transfer");
    return inTxn(()=>{
      requireSite(tenantId,fromSiteId); requireSite(tenantId,toSiteId);
      const l=requireLot(tenantId,lotId);
      if(l.unit!==unit) throw new SupplyChainError(409,"unit_mismatch");
      if(l.current_status!=="released") throw new SupplyChainError(409,"lot_not_released");
      const payload={lotId,fromSiteId,toSiteId,quantityMilli,unit};
      const movement=createMovement({tenantId,idempotencyKey,payload,movementType:"transfer",recordedBy:actorId});
      if(movement.duplicate) return {movementId:movement.id,duplicate:true};
      insertEntry(tenantId,movement.id,lotId,fromSiteId,-quantityMilli,unit);
      insertEntry(tenantId,movement.id,lotId,toSiteId,quantityMilli,unit);
      postMovement(movement.id,tenantId);
      return {movementId:movement.id,duplicate:false};
    })();
  }
  function processLot(input) {
    const {tenantId,siteId,inputs,outputs,actorId,idempotencyKey}=input;
    if(!Array.isArray(inputs)||!inputs.length||!Array.isArray(outputs)||!outputs.length) throw new SupplyChainError(400,"processing_inputs_outputs_required");
    const payload={siteId,inputs,outputs};
    return inTxn(()=>{
      const target=requireSite(tenantId,siteId);
      if(target.siteType!=="packing_house") throw new SupplyChainError(409,"packing_house_required");
      const movement=createMovement({tenantId,idempotencyKey,payload,movementType:"processing",recordedBy:actorId});
      if(movement.duplicate) return {movementId:movement.id,duplicate:true};
      for(const entry of inputs){
        positiveInt(entry.quantityMilli);
        const source=requireLot(tenantId,entry.lotId);
        ensureDispatchable(tenantId,entry.lotId);
        if(source.unit!==entry.unit) throw new SupplyChainError(409,"unit_mismatch");
        if(balance.get(tenantId,entry.lotId,siteId).quantityMilli<entry.quantityMilli) throw new SupplyChainError(409,"insufficient_stock");
        insertEntry(tenantId,movement.id,entry.lotId,siteId,-entry.quantityMilli,entry.unit);
      }
      const childLots=[];
      for(const output of outputs){
        positiveInt(output.quantityMilli);
        if(!output.lotCode||!output.productId||!output.commodityName||!output.unit) throw new SupplyChainError(400,"invalid_output_lot");
        const lotId=id(),time=now();
        db.prepare("INSERT INTO supply_lots(id,tenant_id,lot_code,product_id,commodity_name,origin_site_id,current_status,unit,received_at,created_by,created_at) VALUES(?,?,?,?,?,?,'quarantined',?,?,?,?)")
          .run(lotId,tenantId,output.lotCode,output.productId,output.commodityName,siteId,output.unit,time,actorId,time);
        insertEntry(tenantId,movement.id,lotId,siteId,output.quantityMilli,output.unit);
        childLots.push({id:lotId,lotCode:output.lotCode,quantityMilli:output.quantityMilli,unit:output.unit});
        let remaining=output.quantityMilli;
        for(const inputLot of inputs){
          const parent=requireLot(tenantId,inputLot.lotId);
          const qty=Math.min(inputLot.quantityMilli,remaining);
          if(qty>0){
            db.prepare("INSERT INTO lot_genealogy(id,tenant_id,parent_lot_id,child_lot_id,relationship,input_quantity_milli,output_quantity_milli,unit,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
              .run(id(),tenantId,parent.id,lotId,"processed_into",qty,qty,output.unit,actorId,time);
            remaining-=qty;
          }
          if(remaining<=0) break;
        }
      }
      postMovement(movement.id,tenantId);
      return {movementId:movement.id,duplicate:false,childLots};
    })();
  }
  function inspectLot(input) {
    const {tenantId,lotId,siteId,inspectionType,result,actorId}=input;
    if(!["receiving","grading","processing","pre_dispatch","port_gate","laboratory","other"].includes(inspectionType)||!["pending","pass","conditional_pass","fail","hold"].includes(result)) throw new SupplyChainError(400,"invalid_inspection");
    return inTxn(()=>{
      requireSite(tenantId,siteId); const l=requireLot(tenantId,lotId);
      const inspectionId=id(),time=now();
      db.prepare("INSERT INTO quality_inspections(id,tenant_id,lot_id,site_id,inspection_type,result,inspected_at,inspector_id,criteria_json,findings,corrective_action,evidence_ref,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(inspectionId,tenantId,lotId,siteId,inspectionType,result,time,actorId,JSON.stringify(input.criteria??{}),input.findings??null,input.correctiveAction??null,input.evidenceRef??null,time);
      const status=result==="pass"||result==="conditional_pass"?"released":result==="fail"?"blocked":result==="hold"||result==="pending"?"quarantined":l.current_status;
      db.prepare("UPDATE supply_lots SET current_status=? WHERE tenant_id=? AND id=?").run(status,tenantId,lotId);
      return {inspectionId,lotId,result,lotStatus:status};
    })();
  }
  function prepareHandover(input) {
    const {tenantId,lotId,fromSiteId,toSiteId,quantityMilli,unit,actorId,idempotencyKey,handoverCode}=input;
    positiveInt(quantityMilli);
    return inTxn(()=>{
      requireSite(tenantId,fromSiteId); requireSite(tenantId,toSiteId);
      const l=ensureDispatchable(tenantId,lotId);
      if(l.unit!==unit) throw new SupplyChainError(409,"unit_mismatch");
      const existing=db.prepare("SELECT id,idempotency_key AS idempotencyKey,quantity_milli AS quantityMilli,lot_id AS lotId FROM handovers WHERE tenant_id=? AND idempotency_key=?").get(tenantId,idempotencyKey);
      const payload={lotId,fromSiteId,toSiteId,quantityMilli,unit,handoverCode};
      if(existing){
        if(existing.lotId!==lotId||existing.quantityMilli!==quantityMilli) throw new SupplyChainError(409,"idempotency_conflict");
        return {id:existing.id,duplicate:true};
      }
      if(balance.get(tenantId,lotId,fromSiteId).quantityMilli<quantityMilli) throw new SupplyChainError(409,"insufficient_stock");
      const handoverId=id();
      db.prepare("INSERT INTO handovers(id,tenant_id,handover_code,lot_id,from_site_id,to_site_id,status,quantity_milli,unit,dispatched_by,idempotency_key,created_at,carrier_name,vehicle_or_container_ref,seal_number) VALUES(?,?,?,?,?,?,'prepared',?,?,?,?,?,?,?,?)")
        .run(handoverId,tenantId,handoverCode,lotId,fromSiteId,toSiteId,quantityMilli,unit,actorId,idempotencyKey,now(),input.carrierName??null,input.vehicleOrContainerRef??null,input.sealNumber??null);
      return {id:handoverId,duplicate:false,status:"prepared"};
    })();
  }
  function dispatchHandover(input) {
    const {tenantId,handoverId,actorId,idempotencyKey}=input;
    return inTxn(()=>{
      const h=db.prepare("SELECT * FROM handovers WHERE tenant_id=? AND id=?").get(tenantId,handoverId);
      if(!h) throw new SupplyChainError(404,"handover_not_found");
      if(h.status==="dispatched"||h.status==="received"||h.status==="discrepancy"){
        const m=db.prepare("SELECT id FROM inventory_movements WHERE tenant_id=? AND reference_type='handover' AND reference_id=?").get(tenantId,handoverId);
        if(m) return {handoverId,movementId:m.id,duplicate:true,status:h.status};
      }
      if(h.status!=="prepared") throw new SupplyChainError(409,"invalid_handover_state");
      ensureDispatchable(tenantId,h.lot_id);
      const movement=createMovement({tenantId,idempotencyKey,payload:{handoverId,lotId:h.lot_id,fromSiteId:h.from_site_id,toSiteId:h.to_site_id,quantityMilli:h.quantity_milli},movementType:"dispatch",recordedBy:actorId,referenceType:"handover",referenceId:handoverId});
      insertEntry(tenantId,movement.id,h.lot_id,h.from_site_id,-h.quantity_milli,h.unit);
      insertEntry(tenantId,movement.id,h.lot_id,h.to_site_id,h.quantity_milli,h.unit);
      postMovement(movement.id,tenantId);
      db.prepare("UPDATE handovers SET status='dispatched',dispatch_at=?,dispatched_by=? WHERE tenant_id=? AND id=? AND status='prepared'").run(now(),actorId,tenantId,handoverId);
      return {handoverId,movementId:movement.id,duplicate:false,status:"dispatched"};
    })();
  }
  function receiveHandover(input) {
    const {tenantId,handoverId,receivedQuantityMilli,actorId,sealNumber}=input;
    if(!Number.isSafeInteger(receivedQuantityMilli)||receivedQuantityMilli<0) throw new SupplyChainError(400,"invalid_received_quantity");
    return inTxn(()=>{
      const h=db.prepare("SELECT * FROM handovers WHERE tenant_id=? AND id=?").get(tenantId,handoverId);
      if(!h) throw new SupplyChainError(404,"handover_not_found");
      if(["received","discrepancy"].includes(h.status)) return {handoverId,duplicate:true,status:h.status,discrepancyNote:h.discrepancy_note};
      if(h.status!=="dispatched") throw new SupplyChainError(409,"handover_not_dispatched");
      const mismatch=receivedQuantityMilli!==h.quantity_milli||(h.seal_number&&sealNumber!==h.seal_number);
      const note=mismatch?`expected_quantity_milli=${h.quantity_milli};received_quantity_milli=${receivedQuantityMilli};seal_match=${!h.seal_number||sealNumber===h.seal_number}`:null;
      db.prepare("UPDATE handovers SET status=?,received_at=?,received_by=?,discrepancy_note=? WHERE tenant_id=? AND id=? AND status='dispatched'")
        .run(mismatch?"discrepancy":"received",now(),actorId,note,tenantId,handoverId);
      return {handoverId,duplicate:false,status:mismatch?"discrepancy":"received",discrepancyNote:note};
    })();
  }
  function stock(input) {
    requireSite(input.tenantId,input.siteId);
    return db.prepare(`SELECT l.id AS lotId,l.lot_code AS lotCode,l.product_id AS productId,l.commodity_name AS commodityName,l.current_status AS lotStatus,l.unit,
      COALESCE(SUM(CASE WHEN m.status='posted' THEN e.quantity_milli_delta ELSE 0 END),0) AS quantityMilli
      FROM supply_lots l LEFT JOIN inventory_entries e ON e.tenant_id=l.tenant_id AND e.lot_id=l.id AND e.site_id=?
      LEFT JOIN inventory_movements m ON m.tenant_id=e.tenant_id AND m.id=e.movement_id
      WHERE l.tenant_id=? GROUP BY l.id ORDER BY l.lot_code`).all(input.siteId,input.tenantId);
  }
  function trace(input) {
    const l=requireLot(input.tenantId,input.lotId);
    const parents=db.prepare(`SELECT p.id AS lotId,p.lot_code AS lotCode,g.relationship,g.input_quantity_milli AS inputQuantityMilli,g.unit FROM lot_genealogy g JOIN supply_lots p ON p.tenant_id=g.tenant_id AND p.id=g.parent_lot_id WHERE g.tenant_id=? AND g.child_lot_id=?`).all(input.tenantId,l.id);
    const children=db.prepare(`SELECT c.id AS lotId,c.lot_code AS lotCode,g.relationship,g.output_quantity_milli AS outputQuantityMilli,g.unit FROM lot_genealogy g JOIN supply_lots c ON c.tenant_id=g.tenant_id AND c.id=g.child_lot_id WHERE g.tenant_id=? AND g.parent_lot_id=?`).all(input.tenantId,l.id);
    const inspections=db.prepare("SELECT id,inspection_type AS inspectionType,result,inspected_at AS inspectedAt,inspector_id AS inspectorId,evidence_ref AS evidenceRef FROM quality_inspections WHERE tenant_id=? AND lot_id=? ORDER BY inspected_at").all(input.tenantId,l.id);
    const handovers=db.prepare("SELECT id,handover_code AS handoverCode,status,from_site_id AS fromSiteId,to_site_id AS toSiteId,quantity_milli AS quantityMilli,unit,dispatch_at AS dispatchAt,received_at AS receivedAt,discrepancy_note AS discrepancyNote FROM handovers WHERE tenant_id=? AND lot_id=? ORDER BY created_at").all(input.tenantId,l.id);
    return {lot:{id:l.id,lotCode:l.lot_code,productId:l.product_id,commodityName:l.commodity_name,status:l.current_status,unit:l.unit},parents,children,inspections,handovers};
  }
  return {createSite,receiveLot,moveStock,processLot,inspectLot,prepareHandover,dispatchHandover,receiveHandover,stock,trace};
}
