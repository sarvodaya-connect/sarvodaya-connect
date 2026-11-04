# Sarvodaya Connect TEST foundation

Preparation for manual, owner-driven deployment into the **existing** AWS account
in **Singapore (`ap-southeast-1`)**. This is not evidence of an AWS deployment or
successful integration. Follow the review process in `CONTRIBUTING.md` and the
[cost and application plan](../../../docs/aws-test-environment.md).

## First-stack resources and cost

| Resources | Configuration |
| --- | --- |
| Network | New `10.77.0.0/16` VPC; one public and two private subnets in two AZs; internet gateway, routes and security groups; S3 gateway endpoint |
| NAT | One AL2023 ARM64 `t4g.nano`, encrypted 8 GB gp3, one public IPv4; Standard CPU credits, IMDSv2; no SSH, key pair or instance profile |
| Database | Private PostgreSQL 17.11 `db.t4g.micro`, Single-AZ, encrypted 20 GB gp3; seven-day backups, deletion protection, final snapshot, no paid extended-support enrollment |
| Files | Private document/build buckets; AES256 encryption, HTTPS enforcement, public-access blocks; document versioning and old-version cleanup after 30 days |
| Sign-in | Admin-only Cognito Essentials pool; public dashboard/mobile clients using the repository's password/refresh flows; no users or passwords |
| Configuration | Small parameter-preparation Lambda, named execution role, 14-day log group and two Standard SecureStrings encrypted with managed `aws/ssm` |

Standing compute/storage/network is approximately **USD 29.30/month**, plus small
storage/log/request charges. The full initial app estimate is **USD 35.93/month**,
before credits/tax, assuming the usage in the cost plan. Forecasts are not caps.
No RDS Proxy, NAT Gateway, Multi-AZ database, SQS, Bedrock access or organization
changes are included. Amplify and the application Lambda/HTTP API come later.
Cloudflare and production DNS are untouched.

The owner confirmed PostgreSQL 17.11 and the class/gp3/20 GB combination using
read-only Singapore RDS queries on 4 November 2026. The existing default VPC is
`172.31.0.0/16`; this template does not reference it.

### Existing budget: do not duplicate

The owner created `sarvodaya-connect-test-monthly` manually on 4 November 2026:
monthly recurring USD 70, actual-cost absolute USD 50 and USD 70 email alerts,
unblended costs excluding Credit and Refund, no automated actions. This is a
recorded console exception. It stays outside the stack and its cleanup. Alerts
notify; they do not stop spending. The template deliberately has no budget resource.

## Build and verify the upload file

`foundation.yaml` contains an intentional code placeholder. **Do not upload the
raw source.** Render the actual handler into the template, with no AWS calls:

```sh
python3 infrastructure/aws/test/render-foundation.py > /tmp/sarvodaya-test-foundation.yaml
cfn-lint infrastructure/aws/template.yaml /tmp/sarvodaya-test-foundation.yaml
node --test infrastructure/aws/test/secure-parameters.test.cjs
python3 infrastructure/aws/test/test_foundation.py
```

The AWS readiness workflow renders/lints both templates, checks the actual inline
handler using SDK/HTTPS doubles, and saves a seven-day `sarvodaya-test-foundation`
artifact. Download from the **exact reviewed commit**; no CI job deploys anything
or receives AWS credentials. Packaged-handler smoke tests use temporary local
PostgreSQL/MinIO with fictional accounts and automatic cleanup.

Local checks cannot prove real IAM/KMS grants, CloudFormation rules/reference
resolution, AL2023 bootstrap, private network forwarding, RDS TLS/backups, CORS or
Cognito sign-in. These need separate AWS validation after provisioning.

## Manual deployment after review

1. Have the PR reviewed and its checks pass before deployment. Preserve the commit
   SHA with a private operational record. Do not merge your own work without review.
2. In the existing account's Singapore CloudFormation, upload the **rendered**
   file. Name the stack `sarvodaya-connect-test-foundation`.
3. Enter `ExpectedAccountId` from the current account. Keep the public AL2023 ARM64
   SSM image path. Leave `DashboardOrigin` blank until Amplify provides its test
   HTTPS origin. Account/region assertions must pass.
4. Add stack tags `Project=SarvodayaConnect`, `Environment=test`. Enable termination
   protection. Do not select an alternate service role unless separately reviewed.
5. Prepare a **change set**, inspect every addition and the named IAM role below,
   then acknowledge `CAPABILITY_NAMED_IAM` only after that review. Expect no changes
   to existing resources. Stop on collisions, replacements, account mismatch or a
   revised total above USD 70. Creating a change set does not create the proposed
   application resources. The owner executes only when ready for charges to begin.
6. Record Events/Outputs privately. NAT creation waits up to ten minutes for a
   `cfn-signal` bootstrap result. This confirms the script finished, not that
   traffic from a private subnet works. Verify that separately.
7. If creation fails, inspect Events and retained-resource costs before retrying.
   Do not delete retained parameters or other resources to clear a collision.

### Permissions and generated configuration

`ParameterRole` creates `sarvodaya-connect-test-parameters`, assumable only by
Lambda. It allows GetParameter/ListTagsForResource/PutParameter/AddTagsToResource
on exactly these two parameter names, plus writing its own log streams:

- `/sarvodaya-connect/test/database-master-password`
- `/sarvodaya-connect/test/nic-encryption-key`

It cannot manage databases, buckets, users or IAM. There are no human users or
access keys in this template. Parameters are generated inside Lambda and encrypted;
values never enter CloudFormation outputs, shell arguments or logs. The SDK reads
existing parameter metadata without decryption and requires this stack's ownership
tag. It inspects both names before writing, never overwrites, and preserves keys
on retries/updates. Standard `aws/ssm` key request/free-tier charges remain subject
to account-wide usage.

The RDS password reference is pinned to parameter version 1 for initial creation.
Do not overwrite/delete/recreate that parameter as a migration shortcut. Rotation
is a coordinated, separately reviewed database/configuration change. Retained
parameters from a removed stack intentionally cannot be adopted by a different
stack without an explicit recovery plan.

## What remains after the foundation

- Verify RDS is Available, encrypted/private, with seven-day backups and the agreed
  recovery plan. Before migrations, verify the target hostname/database and create
  or confirm a recoverable test snapshot/point-in-time plan. Never run against an
  existing/shared/production database.
- Use a temporary private-VPC migration session and existing repository migrations.
  Create a dedicated runtime PostgreSQL user with required DML/sequence rights,
  not the RDS master account. Securely create `/sarvodaya-connect/test/database-url`.
  The foundation does not run migrations or create this runtime URL.
- Finish certificate-verified RDS TLS packaging and test connectivity before
  deploying the application Lambda/API stack.
- Connect Amplify through the owner's GitHub authorization flow and use the
  repository's Next.js 15 build settings. Once its test hostname exists, update
  `DashboardOrigin` to that exact HTTPS origin for signed document PUT/GET/HEAD.
  CORS does not make the bucket public or grant unauthenticated file access.
- Obtain specific owner instruction before creating fictional test/staff sign-ins
  or setting passwords. Test real Cognito tokens, roles/society restrictions,
  private documents and refresh/revocation. Pool creation alone proves none of these.
- Keep SarvoAI disabled until reviewed code implements the monthly application
  spending limit across concurrent requests/retries and validates restricted-data
  protections. Do not reserve USD 20 as expected usage or treat budget alerts as a cap.
- Inspect existing CloudTrail coverage/event history before adding a dedicated
  test trail; no organization trail changes or audit-completeness claim is made.

## Retention and eventual cleanup

No cleanup is part of initial setup. On explicit owner instruction, use stack
membership/tags to identify only test resources. Disable deletion/termination
protection through a reviewed cleanup change, preserve the agreed final snapshot
and NIC key, and remove application resources in dependency order. Database
replacement/deletion requests a snapshot; document/build buckets, Cognito pool
and generated parameters are retained. Nonempty buckets need explicit, separate
cleanup. Retained snapshots, objects, logs, IPs and disks can keep charging.
Preserve the pre-existing default VPC, existing budget and organization resources.
