# Sarvodaya Connect TEST foundation

Preparation for manual, owner-driven deployment into the **existing** AWS account
in **Singapore (`ap-southeast-1`)**. This is not evidence of an AWS deployment or
successful integration. Follow the review process in `CONTRIBUTING.md` and the
[cost and application plan](../../../docs/aws-test-environment.md).

## Current failed-foundation recovery

The owner completed bootstrap and verified both encrypted parameters. The first
foundation execution then failed because `dnf` exhausted memory on the NAT; the
stack is `ROLLBACK_FAILED` with a database/network and retained buckets/pool.
See [RECOVERY.md](RECOVERY.md) before any retry. Do not apply a fresh CREATE over
retained resource names or delete anything without explicit owner approval.
The template now provisions 2 GiB disk-backed swap before package work and waits
for NAT bootstrap before creating RDS; AWS verification remains outstanding.

## Deployment order: bootstrap, then foundation

The first owner-driven change-set attempt on 4 November 2026 failed with
`ssm-secure:/sarvodaya-connect/test/database-master-password:1 cannot be found`.
The parameter did not yet exist when CloudFormation prepared the change set.
Putting the generator behind `DependsOn` in the same stack does not satisfy this
preparation-time lookup. Local lint/smoke tests had not exercised this AWS behavior.
No foundation change set was executed. The console may already have uploaded
its template to S3 and created an automatic service role; inspect these separately
rather than claiming the account is unchanged.

Use two separately reviewed change sets, in this order:

1. **`sarvodaya-connect-test-bootstrap`**, from `bootstrap.rendered.yaml`: only the
   helper Lambda, its scoped role/log group, and generated encrypted parameters.
   Wait for `CREATE_COMPLETE`, then verify parameter names, SecureString types
   and master-password version 1 **without retrieving values**.
2. **`sarvodaya-connect-test-foundation`**, from `foundation.rendered.yaml`: the
   network, database, buckets and Cognito resources below. Prepare its change set
   only after bootstrap succeeds. It imports the non-secret namespace exported
   by bootstrap; no secret is exposed in the export. This dependency also blocks
   bootstrap deletion while the foundation consumes the export.

Do not bypass the error by typing a password, creating a plaintext parameter,
removing encryption, disabling validations or granting broader permissions. Keep
any unexecuted `REVIEW_IN_PROGRESS` placeholder intact until its state is checked;
there is no automatic deletion/recreation step in this fix.

## Foundation resources and cost

| Resources | Configuration |
| --- | --- |
| Network | New `10.77.0.0/16` VPC; one public and two private subnets in two AZs; internet gateway, routes and security groups; S3 gateway endpoint |
| NAT | One AL2023 ARM64 `t4g.nano`, encrypted 8 GB gp3 with 2 GiB disk-backed swap before package installation, one public IPv4; Standard CPU credits, IMDSv2; no SSH, key pair or instance profile |
| Database | Private PostgreSQL 17.11 `db.t4g.micro`, Single-AZ, encrypted 20 GB gp3; seven-day backups, deletion protection, final snapshot, no paid extended-support enrollment |
| Files | Private document/build buckets; AES256 encryption, HTTPS enforcement, public-access blocks; document versioning and old-version cleanup after 30 days |
| Sign-in | Admin-only Cognito Essentials pool; public dashboard/mobile clients using the repository's password/refresh flows; no users or passwords |
| Configuration | Small parameter-preparation Lambda, named execution role, 14-day log group and two Standard SecureStrings encrypted with managed `aws/ssm` |

Standing foundation compute/storage/network is approximately **USD 29.30/month**, plus small
storage/log/request charges. The full initial app estimate is **USD 35.93/month**,
before credits/tax, assuming the usage in the cost plan. Forecasts are not caps.
No RDS Proxy, NAT Gateway, Multi-AZ database, SQS, Bedrock access or organization
changes are included. Amplify and the application Lambda/HTTP API come later.
Cloudflare and production DNS are untouched. Splitting the existing helper into
bootstrap creates no additional service or standing instance. Its small log,
Lambda and managed-key request usage remains within the existing usage allowance;
there is no extra paid database, NAT or fixed USD allocation.

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

`bootstrap.yaml` contains an intentional code placeholder. **Do not upload its
raw source.** Render both deployment files offline; the foundation is a direct
copy and the bootstrap embeds the actual helper handler:

```sh
python3 infrastructure/aws/test/render-foundation.py --bootstrap > /tmp/bootstrap.rendered.yaml
python3 infrastructure/aws/test/render-foundation.py > /tmp/foundation.rendered.yaml
# Recovery only, after owner approval: render an IMPORT file, not a CREATE file.
python3 infrastructure/aws/test/render-foundation.py --retained-import > /tmp/retained.import.yaml
cfn-lint infrastructure/aws/template.yaml /tmp/bootstrap.rendered.yaml /tmp/foundation.rendered.yaml /tmp/retained.import.yaml
node --test infrastructure/aws/test/secure-parameters.test.cjs
python3 infrastructure/aws/test/test_foundation.py
```

The AWS readiness workflow renders bootstrap/foundation and lints the API plus all three deployment/recovery files, checks the actual inline
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
2. In the existing account's Singapore CloudFormation, upload
   `bootstrap.rendered.yaml`. Name the stack **exactly**
   `sarvodaya-connect-test-bootstrap` so its export has the expected name.
3. Enter `ExpectedAccountId` from the current account. Account/region assertions
   must pass. Add tags `Project=SarvodayaConnect`, `Environment=test`, and enable
   termination protection. Inspect the service role shown under Permissions.
   If the account already uses role manager, the console can automatically create
   a CloudFormation execution role. This is separate from the helper role and
   its trust/permissions must be reviewed before execution. Do not change account
   role-manager settings, reuse an unreviewed role or attach broad policies to
   clear a failure. [AWS role-manager guidance](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_role-manager.html).
4. Prepare a **change set** and inspect each addition and the one named helper
   IAM role. Acknowledge `CAPABILITY_NAMED_IAM` only after this review. Expect no
   existing-resource changes. Stop on collisions, replacements, account mismatch
   or a revised total above USD 70. The owner executes the bootstrap change set
   after review, then waits for `CREATE_COMPLETE` and checks parameter metadata.
5. Only then upload `foundation.rendered.yaml` for the foundation stack. Keep the
   public AL2023 ARM64 SSM image path and leave `DashboardOrigin` blank initially.
   Apply the same tags/protection and service-role review. This template creates
   no IAM helper role of its own. Prepare and inspect its separate change set
   before executing; the owner must be ready for standing charges to begin.
6. Record both stacks' Events/Outputs privately. NAT creation waits up to ten
   minutes for a `cfn-signal` bootstrap result. This confirms the script finished,
   not that traffic from a private subnet works. Verify that separately.
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
existing parameter metadata without decryption and requires the bootstrap stack's ownership
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
- Package the API with `npm run package:lambda`. The package includes the public
  Singapore RDS CA bundle; `Stage=test` sets `NODE_EXTRA_CA_CERTS` to its absolute
  Lambda path before Node starts. The runtime `/database-url` must use
  `?sslmode=verify-full`, without a temporary CloudShell `sslrootcert` path.
  This verifies both the server certificate chain and database hostname. Never
  disable verification with `NODE_TLS_REJECT_UNAUTHORIZED=0` or
  `rejectUnauthorized: false`. See `apps/api/certificates/README.md` for provenance
  and refresh instructions. Confirm the deployed API connects before claiming
  application readiness; a successful CloudShell connection alone is insufficient.
- Connect Amplify through the owner's GitHub authorization flow and use the
  repository's Next.js 15 build settings. Once its test hostname exists, update
  `DashboardOrigin` to that exact HTTPS origin for signed document PUT/GET/HEAD.
  CORS does not make the bucket public or grant unauthenticated file access.
- Obtain specific owner instruction before creating fictional test/staff sign-ins
  or setting passwords. Test real Cognito tokens, roles/society restrictions,
  private documents and refresh/revocation. Pool creation alone proves none of these.
- Keep SarvoAI disabled until the two spending migrations from PR #97 are applied,
  runtime ledger privileges and concurrent admission are verified, and current
  Bedrock pricing/global routing are approved. There is one shared token-priced
  spending ledger, not the former flat-USD-2 allowance. TEST tools are restricted
  to synthetic `TEST-*` societies in district `TEST-ONLY`; personal Exco lookups
  are disabled. See `docs/sarvoai-aws-setup.md`, and `docs/sarvoai-test-pilot-plan.md`
  for the pilot checks (`sarvoai-pilot-checks.sql`, read-only). No budget alert replaces the
  application's admission gate, and the limit is not expected actual spending.
- Inspect existing CloudTrail coverage/event history before adding a dedicated
  test trail; no organization trail changes or audit-completeness claim is made.

## Retention and eventual cleanup

No cleanup is part of initial setup. On explicit owner instruction, use both stacks'
membership/tags to identify only test resources. Disable deletion/termination
protection through a reviewed cleanup change, preserve the agreed final snapshot
and NIC key, and remove application resources in dependency order. Database
replacement/deletion requests a snapshot; document/build buckets, Cognito pool
and generated parameters are retained. Nonempty buckets need explicit, separate
cleanup. Retained snapshots, objects, logs, IPs and disks can keep charging.
Remove the foundation before considering bootstrap removal: the non-secret
cross-stack export deliberately prevents the reverse order. Keep retained keys
and database recovery material as agreed. Preserve the pre-existing default VPC,
existing budget and organization resources.
