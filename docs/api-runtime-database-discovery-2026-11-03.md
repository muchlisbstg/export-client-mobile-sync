# API Runtime and Database Discovery — 3 November 2026

**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Code baseline:** `main` at `d4a267489986a4f4e2aab2c2e4a4ae3ddd24456e`  
**Investigation target selected by owner:** AWS Console, `ap-southeast-1` (Singapore)  
**Runtime service:** not yet identified

## 1. Repository evidence

- `package.json` exposes `dev:api = node server/index.mjs`; runtime is Node.js/Express.
- `server/index.mjs` selects:
  - `API_HOST`: defaults to `127.0.0.1`.
  - `API_PORT`: defaults to `4001`.
  - `API_DB_PATH`: `options.dbPath ?? process.env.API_DB_PATH ?? server/data/api.sqlite`.
- `.env.api.example` sets a local-development example path, `./server/data/api.sqlite`. This is an example, not proof of the deployed runtime path.
- No production API deployment manifest or confirmed runtime endpoint was established by this repository inspection.

## 2. AWS infrastructure evidence in this repository

The only AWS Terraform directory found is `infra/aws-staging-schema-runner`.

- Its stated purpose is a separate disposable schema-reconciliation runner, not the application API.
- Terraform variable `enable_instance` defaults to `false`.
- Its configured default region is `ap-south-1` (Mumbai), not the currently selected Console investigation region `ap-southeast-1` (Singapore).
- The EC2 resource is conditional on `enable_instance`.
- The README explicitly states that this baseline is not permission to incur AWS charges and requires budget, remote state, OIDC, network review, and explicit approval before apply.
- The GitHub Actions workflow is named **AWS staging runner Terraform validation**. It runs `terraform fmt -check`, `terraform init -backend=false`, and `terraform validate`; it does not run `terraform apply` or provision AWS resources.
- The runner bootstrap installs SQLite/PostgreSQL client utilities only. It does not launch the API or connect to a database.

**Conclusion:** the repository's AWS Terraform is not evidence that the API is hosted on EC2, ECS, Lambda, or any AWS service. The runner itself is not proven to exist.

## 3. Database evidence and boundary

- The source default is local SQLite at `server/data/api.sqlite`, unless `API_DB_PATH` overrides it.
- The previously inspected Termux SQLite file is not verified as the live API database.
- The Supabase staging project is a separate managed PostgreSQL target; it is not evidence of the production API database.
- No database identity, host, endpoint, or effective runtime `API_DB_PATH` has been verified.

## 4. Required read-only AWS Console discovery

In the AWS account authorized for this project, with region selector set to `Asia Pacific (Singapore) ap-southeast-1`:

1. EC2 → Instances: inspect only existing instances, state, Name tag, masked instance ID, VPC/subnet, IAM role name, and launch time. Do not connect, start, stop, modify, or launch.
2. ECS → Clusters → Services: inspect service names, desired/running task counts, launch type, and task-definition family. Do not execute commands or update services.
3. Lambda → Functions: inspect function names, runtime, handler, last-modified time, and VPC configuration. Do not reveal environment-variable values.
4. If absent, inspect API Gateway integrations, Elastic Beanstalk, App Runner, EKS, and Lightsail. Do not create or configure resources.
5. After the runtime is identified, inspect only database resource metadata and relationship (RDS/Aurora, DynamoDB, SQLite volume/container path, or external managed database). Do not connect or export data.

If all are empty, verify the AWS account selector and other regions only with the account owner. Do not enable Resource Explorer or create indexes/roles as part of discovery.

## 5. Next evidence required

Please provide the read-only inventory result for EC2, ECS, Lambda, and other services in `ap-southeast-1` (resource present / empty / access denied). Resource names and masked IDs are sufficient; do not share access keys, tokens, passwords, environment-variable values, database rows, or private keys.

After a runtime is identified, use a separately authorized read-only host/service inspection to establish the actual process entrypoint and effective `API_DB_PATH`. Only schema metadata and provenance are in scope. Do not export `api.sqlite`, WAL/SHM files, or operational rows.

## Status

**BLOCKED ON AWS ACCOUNT INVENTORY.** Repository source confirms the API's Node/Express entrypoint and SQLite fallback, but does not identify the deployed API service or its live database. No AWS resource was created or modified, and no operational data was accessed or exported.
