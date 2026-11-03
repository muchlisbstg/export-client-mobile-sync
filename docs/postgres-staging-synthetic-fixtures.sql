-- Synthetic-only validation fixture for docs/postgres-schema-draft.sql.
-- Run ONLY after the reviewed schema has been explicitly approved and applied to STAGING.
-- This script wraps all fixture writes in a transaction and rolls them back.
-- It does not contain customer data and must never be pointed at production.

BEGIN;

INSERT INTO app_private.tenants(id,tenant_type,display_name,status,created_at)
VALUES ('fixture-enterprise','seller','Synthetic Staging Enterprise','active',now());

INSERT INTO app_private.tenant_memberships(tenant_id,user_id,role,status,created_at)
VALUES ('fixture-enterprise','fixture-admin','seller_admin','active',now());

INSERT INTO app_private.enterprise_role_assignments(enterprise_id,user_id,role,status,granted_by,created_at)
VALUES ('fixture-enterprise','fixture-admin','enterprise_admin','active','fixture-bootstrap',now());

INSERT INTO app_private.products(id,name,category,origin,unit,active)
VALUES ('fixture-coffee','Synthetic Arabica','Coffee','Indonesia','kg',true);

INSERT INTO app_private.inquiries(
  id,tracking_code,customer_name,customer_email,destination_country,product_id,
  quantity,unit,status,created_at,origin_node_id,buyer_tenant_id,seller_tenant_id,tenant_migration_state
) VALUES (
  'fixture-inquiry','AAAAAAAAAAAAAAAAAAAAAAAA','Synthetic Buyer','buyer@example.invalid',
  'Japan','fixture-coffee',100.000000,'kg','received',now(),'fixture-node',
  NULL,'fixture-enterprise','unassigned'
);

INSERT INTO app_private.supply_sites(id,tenant_id,site_code,name,site_type,country_code,active,created_at)
VALUES
 ('fixture-farm','fixture-enterprise','SYN-FARM','Synthetic Farm','plantation','ID',true,now()),
 ('fixture-warehouse','fixture-enterprise','SYN-WH','Synthetic Warehouse','warehouse','ID',true,now());

INSERT INTO app_private.supply_lots(
  id,tenant_id,lot_code,product_id,commodity_name,origin_site_id,current_status,unit,
  harvest_at,received_at,created_by,created_at
) VALUES (
  'fixture-lot','fixture-enterprise','SYN-LOT-001','fixture-coffee',
  'Synthetic Arabica','fixture-farm','released','kg',now(),now(),'fixture-admin',now()
);

INSERT INTO app_private.inventory_movements(
  id,tenant_id,idempotency_key,payload_hash,movement_type,status,occurred_at,recorded_by,created_at
) VALUES (
  'fixture-receipt','fixture-enterprise','fixture-receipt-key','fixture-payload-hash',
  'receipt','draft',now(),'fixture-admin',now()
);

INSERT INTO app_private.inventory_entries(
  id,tenant_id,movement_id,lot_id,site_id,quantity_milli_delta,unit,created_at
) VALUES (
  'fixture-entry-receipt','fixture-enterprise','fixture-receipt',
  'fixture-lot','fixture-warehouse',100000,'kg',now()
);

UPDATE app_private.inventory_movements
SET status='posted'
WHERE tenant_id='fixture-enterprise' AND id='fixture-receipt';

DO $$
DECLARE stock bigint;
BEGIN
  SELECT COALESCE(SUM(e.quantity_milli_delta),0) INTO stock
  FROM app_private.inventory_entries e
  JOIN app_private.inventory_movements m
    ON m.tenant_id=e.tenant_id AND m.id=e.movement_id
  WHERE e.tenant_id='fixture-enterprise'
    AND e.lot_id='fixture-lot'
    AND e.site_id='fixture-warehouse'
    AND m.status='posted';

  IF stock <> 100000 THEN
    RAISE EXCEPTION 'fixture stock mismatch: expected 100000, got %',stock;
  END IF;
END $$;

-- Negative stock must be rejected when posting a movement.
INSERT INTO app_private.inventory_movements(
  id,tenant_id,idempotency_key,payload_hash,movement_type,status,occurred_at,recorded_by,created_at
) VALUES (
  'fixture-invalid-dispatch','fixture-enterprise','fixture-invalid-key','fixture-invalid-hash',
  'dispatch','draft',now(),'fixture-admin',now()
);

INSERT INTO app_private.inventory_entries(
  id,tenant_id,movement_id,lot_id,site_id,quantity_milli_delta,unit,created_at
) VALUES (
  'fixture-entry-invalid','fixture-enterprise','fixture-invalid-dispatch',
  'fixture-lot','fixture-warehouse',-100001,'kg',now()
);

DO $$
BEGIN
  BEGIN
    UPDATE app_private.inventory_movements
    SET status='posted'
    WHERE tenant_id='fixture-enterprise' AND id='fixture-invalid-dispatch';
    RAISE EXCEPTION 'expected insufficient_stock rejection did not occur';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%insufficient_stock%' THEN
      RAISE;
    END IF;
  END;
END $$;

-- Audit ledgers must reject mutation.
INSERT INTO app_private.supply_audit_events(
  event_id,tenant_id,actor_user_id,action,entity_type,entity_id,outcome,details_json,occurred_at
) VALUES (
  'fixture-audit','fixture-enterprise','fixture-admin','fixture_test',
  'lot','fixture-lot','success','{"fixture":true}'::jsonb,now()
);

DO $$
BEGIN
  BEGIN
    UPDATE app_private.supply_audit_events
    SET action='tampered'
    WHERE event_id='fixture-audit';
    RAISE EXCEPTION 'expected immutable audit rejection did not occur';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%audit_rows_are_append_only%' THEN
      RAISE;
    END IF;
  END;
END $$;

-- No fixture row persists after this point.
ROLLBACK;
