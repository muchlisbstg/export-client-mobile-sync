import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import pg from "pg";

const { Client } = pg;
const admin = new Client({ connectionString: process.env.PG_ADMIN_URL });
const pgA = new Client({ connectionString: process.env.PG_ADMIN_URL });
const pgB = new Client({ connectionString: process.env.PG_ADMIN_URL });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh06-temporal-"));
const sqlitePath = path.join(dir, "temporal.sqlite");
const sqA = new Database(sqlitePath);
const sqB = new Database(sqlitePath);
sqA.pragma("foreign_keys = ON");
sqB.pragma("foreign_keys = ON");
sqA.pragma("busy_timeout = 0");
sqB.pragma("busy_timeout = 0");
const results = [];
const record = (id, status, detail = {}) => results.push({ id, status, ...detail });

try {
  await Promise.all([admin.connect(), pgA.connect(), pgB.connect()]);
  await admin.query("DROP SCHEMA IF EXISTS gh06_temporal CASCADE");
  await admin.query("CREATE SCHEMA gh06_temporal");
  await admin.query("CREATE TABLE gh06_temporal.tenants(id text PRIMARY KEY)");
  await admin.query(`CREATE TABLE gh06_temporal.bindings(
    id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES gh06_temporal.tenants(id),
    effective_from timestamptz NOT NULL, effective_to timestamptz,
    CHECK(effective_to IS NULL OR effective_to > effective_from)
  )`);
  await admin.query(`CREATE FUNCTION gh06_temporal.reject_overlap() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM 1 FROM gh06_temporal.tenants WHERE id=NEW.tenant_id FOR UPDATE;
      IF EXISTS (
        SELECT 1 FROM gh06_temporal.bindings b
        WHERE b.tenant_id=NEW.tenant_id AND b.id IS DISTINCT FROM NEW.id
          AND (b.effective_to IS NULL OR NEW.effective_from < b.effective_to)
          AND (NEW.effective_to IS NULL OR b.effective_from < NEW.effective_to)
      ) THEN RAISE EXCEPTION 'binding_period_overlap'; END IF;
      RETURN NEW;
    END $$`);
  await admin.query(`CREATE TRIGGER binding_no_overlap BEFORE INSERT OR UPDATE
    ON gh06_temporal.bindings FOR EACH ROW EXECUTE FUNCTION gh06_temporal.reject_overlap()`);
  await admin.query("INSERT INTO gh06_temporal.tenants VALUES('tenant-a')");
  await pgA.query("SET search_path TO gh06_temporal,public");
  await pgB.query("SET search_path TO gh06_temporal,public");

  sqA.exec("CREATE TABLE tenants(id text PRIMARY KEY)");
  sqA.exec(`CREATE TABLE bindings(
    id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id),
    effective_from text NOT NULL, effective_to text,
    CHECK(effective_to IS NULL OR effective_to > effective_from)
  )`);
  sqA.exec(`CREATE TRIGGER binding_no_overlap BEFORE INSERT ON bindings
    WHEN EXISTS (
      SELECT 1 FROM bindings b
      WHERE b.tenant_id=NEW.tenant_id AND b.id<>NEW.id
        AND (b.effective_to IS NULL OR NEW.effective_from < b.effective_to)
        AND (NEW.effective_to IS NULL OR b.effective_from < NEW.effective_to)
    )
    BEGIN SELECT RAISE(ABORT,'binding_period_overlap'); END`);
  sqA.exec(`CREATE TRIGGER binding_no_overlap_update BEFORE UPDATE ON bindings
    WHEN EXISTS (
      SELECT 1 FROM bindings b
      WHERE b.tenant_id=NEW.tenant_id AND b.id<>NEW.id
        AND (b.effective_to IS NULL OR NEW.effective_from < b.effective_to)
        AND (NEW.effective_to IS NULL OR b.effective_from < NEW.effective_to)
    )
    BEGIN SELECT RAISE(ABORT,'binding_period_overlap'); END`);
  sqA.exec("INSERT INTO tenants VALUES('tenant-a')");

  const pid = (await pgB.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  await pgA.query("BEGIN");
  await pgA.query(
    "INSERT INTO bindings VALUES($1,$2,$3,$4)",
    ["binding-a", "tenant-a", "2026-01-01T00:00:00.000001Z", "2026-04-01T00:00:00.000000Z"],
  );
  await pgB.query("BEGIN");
  const competingInsert = pgB.query(
    "INSERT INTO bindings VALUES($1,$2,$3,$4)",
    ["binding-overlap", "tenant-a", "2026-02-01T00:00:00.000000Z", "2026-05-01T00:00:00.000000Z"],
  );
  let waitingForLock = false;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const state = await admin.query(
      "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
      [pid],
    );
    if (state.rows[0]?.wait_event_type === "Lock") {
      waitingForLock = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(waitingForLock, true, "second PostgreSQL writer must wait on the tenant serialization lock");
  await pgA.query("COMMIT");
  await assert.rejects(competingInsert, /binding_period_overlap/);
  await pgB.query("ROLLBACK");
  const pgCount = Number((await admin.query("SELECT count(*) FROM gh06_temporal.bindings")).rows[0].count);
  assert.equal(pgCount, 1);

  sqA.exec("BEGIN IMMEDIATE");
  sqA.prepare("INSERT INTO bindings VALUES(?,?,?,?)").run(
    "binding-a", "tenant-a", "2026-01-01T00:00:00.000001Z", "2026-04-01T00:00:00.000000Z",
  );
  assert.throws(() => sqB.exec("BEGIN IMMEDIATE"), (error) => error.code === "SQLITE_BUSY");
  sqA.exec("COMMIT");
  sqB.exec("BEGIN IMMEDIATE");
  assert.throws(
    () => sqB.prepare("INSERT INTO bindings VALUES(?,?,?,?)").run(
      "binding-overlap", "tenant-a", "2026-02-01T00:00:00.000000Z", "2026-05-01T00:00:00.000000Z",
    ),
    /binding_period_overlap/,
  );
  sqB.exec("ROLLBACK");
  const sqCount = Number(sqA.prepare("SELECT count(*) AS count FROM bindings").get().count);
  assert.equal(sqCount, 1);
  record("PAR-010 concurrent overlapping binding writes serialize; exactly one commits", "PASS", { postgres_committed: pgCount, sqlite_committed: sqCount });

  await pgA.query("INSERT INTO bindings VALUES($1,$2,$3,$4)", ["binding-adjacent", "tenant-a", "2026-04-01T00:00:00.000000Z", "2026-06-01T00:00:00.000000Z"]);
  sqA.prepare("INSERT INTO bindings VALUES(?,?,?,?)").run("binding-adjacent", "tenant-a", "2026-04-01T00:00:00.000000Z", "2026-06-01T00:00:00.000000Z");
  record("PAR-017 adjacent half-open effective periods are accepted", "PASS");

  await pgA.query("INSERT INTO bindings VALUES($1,$2,$3,$4)", ["binding-open", "tenant-a", "2026-06-01T00:00:00.000000Z", null]);
  sqA.prepare("INSERT INTO bindings VALUES(?,?,?,?)").run("binding-open", "tenant-a", "2026-06-01T00:00:00.000000Z", null);
  await assert.rejects(
    pgA.query("INSERT INTO bindings VALUES($1,$2,$3,$4)", ["binding-after-open", "tenant-a", "2026-07-01T00:00:00.000000Z", null]),
    /binding_period_overlap/,
  );
  assert.throws(
    () => sqA.prepare("INSERT INTO bindings VALUES(?,?,?,?)").run("binding-after-open", "tenant-a", "2026-07-01T00:00:00.000000Z", null),
    /binding_period_overlap/,
  );
  record("PAR-018 open-ended NULL effective_to is treated as infinity", "PASS");

  const pgPrecision = (await pgA.query(
    "SELECT to_char(effective_from AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS value FROM bindings WHERE id='binding-a'",
  )).rows[0].value;
  const sqlitePrecision = sqA.prepare("SELECT effective_from AS value FROM bindings WHERE id='binding-a'").get().value;
  assert.equal(pgPrecision, sqlitePrecision);
  record("PAR-019 UTC microsecond timestamp precision is preserved", "PASS", { canonical_timestamp: pgPrecision });

  const schemaFingerprint = createHash("sha256").update([
    "gh06_temporal.tenants(id text primary key)",
    "gh06_temporal.bindings(id,tenant_id,effective_from timestamptz,effective_to timestamptz)",
    "tenant-row serialization lock + half-open overlap predicate",
    "sqlite equivalents + BEGIN IMMEDIATE writer serialization",
  ].join("\\n")).digest("hex");
  console.log(JSON.stringify({
    suite: "GH-06 temporal/concurrency parity",
    versions: {
      postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
      sqlite: sqA.prepare("SELECT sqlite_version() AS version").get().version,
    },
    schemaFingerprint,
    results,
    passed: results.filter((x) => x.status === "PASS").length,
    failed: results.filter((x) => x.status === "FAIL").length,
    scope_note: "Disposable synthetic temporal fixture only; not the complete canonical production schema.",
  }, null, 2));
} catch (error) {
  record("PAR-016-SETUP", "FAIL", { error: error instanceof Error ? error.message : String(error) });
  console.log(JSON.stringify({ suite: "GH-06 temporal/concurrency parity", results, failed: 1 }, null, 2));
  process.exitCode = 1;
} finally {
  await pgA.query("ROLLBACK").catch(() => {});
  await pgB.query("ROLLBACK").catch(() => {});
  await Promise.all([pgA.end(), pgB.end(), admin.end()]);
  sqA.close();
  sqB.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
if (results.some((x) => x.status !== "PASS")) process.exitCode = 1;
