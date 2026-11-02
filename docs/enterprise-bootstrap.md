# Initial Enterprise Bootstrap

This procedure creates the first administrator for a **new, isolated staging SQLite database**. It does not create or migrate the schema, contact Supabase, or provision an Auth account.

## Preconditions

1. Create a dedicated staging SQLite database. Do not use `server/data/api.sqlite` or a production database.
2. Confirm the database contains only synthetic staging data and has a verified backup.
3. Run `scripts/migrate-tenant-isolation.mjs` against that exact staging database.
4. Create the initial user in the dedicated Supabase staging project and obtain that user's UUID from the Supabase dashboard. Never put the user's password or access token in a command or repository.
5. Set `SINGLE_ENTERPRISE_ID` to the exact enterprise ID used by the backend.

## Generate a one-time bootstrap token

Generate a high-entropy token locally and keep it outside the repository:

```sh
export ENTERPRISE_BOOTSTRAP_TOKEN="$(openssl rand -hex 32)"
export ENTERPRISE_BOOTSTRAP_TOKEN_SHA256="$(printf '%s' "$ENTERPRISE_BOOTSTRAP_TOKEN" | sha256sum | awk '{print $1}')"
```

Do not commit either environment variable, print them in logs, or send them through chat. The script compares the token to its SHA-256 digest using a timing-safe comparison.

## Run once against the staging database

```sh
SINGLE_ENTERPRISE_ID="global-export" \
node scripts/bootstrap-enterprise.mjs \
  "/absolute/path/to/staging/api.sqlite" \
  "global-export" \
  "<supabase-user-uuid>" \
  "Global Export"
```

The script additionally requires `ENTERPRISE_BOOTSTRAP_TOKEN` and `ENTERPRISE_BOOTSTRAP_TOKEN_SHA256` in the process environment. It refuses the repository's default `server/data/api.sqlite` path and refuses to create a missing database file.

## Behavior and controls

- Creates one active `seller` tenant, one `seller_admin` membership, and one active `enterprise_admin` assignment.
- Writes the initial role grant to the append-only `enterprise_role_audit` table.
- Writes a singleton `enterprise_bootstrap_state` record so the operation cannot be repeated.
- Uses one immediate SQLite transaction; any failed insert rolls back the full bootstrap.
- Requires an empty tenant, membership, role, and role-audit registry. It never guesses or migrates legacy inquiry ownership.
- Does not store the bootstrap token or its hash in SQLite.
- Does not create a Supabase user. The supplied UUID must belong to a user created in the intended staging Supabase project.

After success, unset both bootstrap environment variables and use the existing audited role-provisioning process for subsequent role assignments. Review the database identity and audit row before connecting the mobile client.
