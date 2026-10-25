-- Reference schema for the supply-chain MVP (SQLite).
-- Not yet wired into server startup or an application migration. Apply only through a reviewed migration.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS supply_sites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  site_code TEXT NOT NULL,
  name TEXT NOT NULL,
  site_type TEXT NOT NULL CHECK (site_type IN ('plantation','supplier','packing_house','warehouse','port_terminal','in_transit','buyer')),
  country_code TEXT,
  address_text TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, site_code)
);

CREATE TABLE IF NOT EXISTS supply_lots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lot_code TEXT NOT NULL,
  product_id TEXT NOT NULL,
  commodity_name TEXT NOT NULL,
  origin_site_id TEXT NOT NULL,
  harvest_at TEXT,
  received_at TEXT,
  quantity_declared REAL NOT NULL CHECK (quantity_declared > 0),
  unit TEXT NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 20),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','quarantined','released','blocked','closed')),
  origin_evidence_ref TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, lot_code),
  FOREIGN KEY (tenant_id, origin_site_id) REFERENCES supply_sites(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS lot_genealogy (
  tenant_id TEXT NOT NULL,
  parent_lot_id TEXT NOT NULL,
  child_lot_id TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('split_into','combined_into','processed_into','repacked_into','rejected_from')),
  input_quantity REAL NOT NULL CHECK (input_quantity > 0),
  input_unit TEXT NOT NULL,
  output_quantity REAL CHECK (output_quantity IS NULL OR output_quantity > 0),
  output_unit TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, parent_lot_id, child_lot_id, relationship),
  CHECK (parent_lot_id <> child_lot_id),
  FOREIGN KEY (tenant_id, parent_lot_id) REFERENCES supply_lots(tenant_id, id),
  FOREIGN KEY (tenant_id, child_lot_id) REFERENCES supply_lots(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt','transfer','packaging_consumption','production_output','adjustment','dispatch','return','write_off')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  reference_type TEXT,
  reference_id TEXT,
  occurred_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  note TEXT,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS inventory_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  movement_id TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  quantity_delta REAL NOT NULL CHECK (quantity_delta <> 0),
  unit TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id, movement_id) REFERENCES inventory_movements(tenant_id, id),
  FOREIGN KEY (tenant_id, lot_id) REFERENCES supply_lots(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES supply_sites(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_entries_balance
  ON inventory_entries(tenant_id, lot_id, site_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_status
  ON inventory_movements(tenant_id, status, occurred_at);

-- A posted movement cannot be edited; correction is a new compensating movement.
CREATE TRIGGER IF NOT EXISTS inventory_movement_posted_immutable
BEFORE UPDATE ON inventory_movements
WHEN OLD.status = 'posted' AND (
  NEW.tenant_id <> OLD.tenant_id OR NEW.idempotency_key <> OLD.idempotency_key OR
  NEW.movement_type <> OLD.movement_type OR NEW.occurred_at <> OLD.occurred_at OR
  NEW.recorded_by <> OLD.recorded_by OR COALESCE(NEW.reference_type,'') <> COALESCE(OLD.reference_type,'') OR
  COALESCE(NEW.reference_id,'') <> COALESCE(OLD.reference_id,'') OR COALESCE(NEW.note,'') <> COALESCE(OLD.note,'')
)
BEGIN SELECT RAISE(ABORT, 'posted_inventory_movement_is_immutable'); END;

CREATE TRIGGER IF NOT EXISTS inventory_entry_no_insert_after_post
BEFORE INSERT ON inventory_entries
WHEN (SELECT status FROM inventory_movements WHERE tenant_id=NEW.tenant_id AND id=NEW.movement_id) <> 'draft'
BEGIN SELECT RAISE(ABORT, 'inventory_movement_not_draft'); END;

CREATE TRIGGER IF NOT EXISTS inventory_entry_no_update
BEFORE UPDATE ON inventory_entries
BEGIN SELECT RAISE(ABORT, 'inventory_entries_are_append_only'); END;

CREATE TRIGGER IF NOT EXISTS inventory_entry_no_delete
BEFORE DELETE ON inventory_entries
BEGIN SELECT RAISE(ABORT, 'inventory_entries_are_append_only'); END;

-- Posting must be performed in a single DB transaction by the service:
-- validate all entries, reject negative resulting balances, then set status='posted'.
-- A production migration must also add a guarded posting transition/trigger.

CREATE TABLE IF NOT EXISTS quality_inspections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('receiving','grading','processing','pre_dispatch','port_gate','laboratory','other')),
  result TEXT NOT NULL CHECK (result IN ('pending','pass','conditional_pass','fail','hold')),
  inspected_at TEXT NOT NULL,
  inspector_id TEXT NOT NULL,
  criteria_json TEXT NOT NULL DEFAULT '{}',
  findings TEXT,
  corrective_action TEXT,
  evidence_ref TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id, lot_id) REFERENCES supply_lots(tenant_id, id),
  FOREIGN KEY (tenant_id, site_id) REFERENCES supply_sites(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_quality_lot_time
  ON quality_inspections(tenant_id, lot_id, inspected_at);

CREATE TABLE IF NOT EXISTS handovers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  handover_code TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  from_site_id TEXT NOT NULL,
  to_site_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','dispatched','received','rejected','cancelled')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  dispatch_at TEXT,
  received_at TEXT,
  dispatched_by TEXT NOT NULL,
  received_by TEXT,
  carrier_name TEXT,
  vehicle_or_container_ref TEXT,
  seal_number TEXT,
  discrepancy_note TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, handover_code),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, lot_id) REFERENCES supply_lots(tenant_id, id),
  FOREIGN KEY (tenant_id, from_site_id) REFERENCES supply_sites(tenant_id, id),
  FOREIGN KEY (tenant_id, to_site_id) REFERENCES supply_sites(tenant_id, id),
  CHECK (from_site_id <> to_site_id)
);

CREATE TABLE IF NOT EXISTS supply_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lot','inspection','movement','handover')),
  entity_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  content_sha256 TEXT,
  captured_at TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  retention_until TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supply_evidence_entity
  ON supply_evidence(tenant_id, entity_type, entity_id);
