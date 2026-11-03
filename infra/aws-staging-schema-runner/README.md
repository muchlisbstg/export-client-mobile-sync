# AWS staging schema runner

## Decision

Provision a **separate, disposable-purpose EC2 runner** for schema reconciliation and synthetic-fixture validation. The existing application API and its production database are out of scope and must remain on their current infrastructure.

The initial target region is `ap-south-1` (Mumbai), matching the existing Supabase staging project's reported region. The initial instance shape is `t3.small` with a 30 GiB encrypted gp3 root volume.

## Security boundary

- Dedicated VPC and subnet.
- Security group has **no inbound rules**. Do not add SSH, RDP, HTTP, or application ingress.
- Administration is through AWS Systems Manager Session Manager.
- EC2 instance role is limited to `AmazonSSMManagedInstanceCore`.
- IMDSv2 is required; metadata hop limit is 1.
- Root EBS volume is encrypted and deleted with the instance.
- No production API credentials, Supabase service-role key, database password, or customer data are provisioned.
- The bootstrap installs only SQLite/PostgreSQL client utilities and does not connect to any database.
- Outbound traffic is currently open to support SSM and package installation. Before any source or database connection is enabled, narrow egress to the approved endpoints and document the data-flow.
- Do not copy `api.sqlite`, `-wal`, or `-shm` files to this host or GitHub.

## Deliberate deployment gate

`enable_instance` defaults to `false`. This baseline is **not permission to incur AWS charges**. Before creating billable resources:

1. Confirm the AWS account ID and that the intended account is authorized for this project.
2. Approve the monthly budget and billing alerts.
3. Configure a remote Terraform state backend with encryption, versioning, and state locking. Do not use an ephemeral GitHub Actions runner's local state for apply.
4. Configure GitHub Actions OIDC with a dedicated IAM role scoped to this repository and protected deployment environment. Do not store long-lived AWS access keys in GitHub.
5. Review VPC CIDR overlap, outbound destinations, retention, and destruction policy.
6. Obtain explicit approval for the first Terraform apply.

## Terraform workflow

From this directory:

```sh
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

These checks do not create AWS resources. Do not run `terraform apply` until the deployment gate above is complete.

For later access, use the output `ssm_start_session_command`. No inbound security-group rule or SSH private key is required.

## Data handling and approved scope

Allowed after separate source-owner approval:
- Read-only SQLite schema metadata/DDL extraction.
- Schema-only artifacts with source metadata and SHA-256.
- Synthetic fixture generation only after schema reconciliation.
- Tests against the dedicated Supabase staging project.

Not allowed:
- Exporting operational/customer rows.
- Importing production data to staging.
- Mutating the production SQLite database.
- Copying SQLite database/WAL/SHM files to GitHub or this runner.
- Connecting this runner to the production API.
- Deploying or migrating the production application.

## Cost notes

The EC2 instance, public IPv4 address, EBS storage, monitoring, and data transfer are billable. Actual charges vary by region, runtime, and AWS pricing changes. Stop or destroy the instance when the approved work window ends; retain or destroy the VPC/state only according to the approved retention plan.
