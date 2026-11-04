# Sarvodaya Connect TEST environment

Pre-deployment plan, reviewed against the revised hosting proposal and the supplied
architecture on 4 November 2026. This document and the `Stage=test` configuration
are preparation for review. They do not establish that application infrastructure exists or that
integration has passed. The owner created the budget below; application stacks
have not been deployed. The first foundation change-set attempt failed because
CloudFormation needed the master-password parameter before the same stack could
create it. Deploy the separate encrypted-parameter bootstrap to completion before
preparing the foundation change set; see the guide below. See the [foundation deployment guide](../infrastructure/aws/test/README.md).

## Cost and architecture decisions

Use Singapore (`ap-southeast-1`), private Single-AZ PostgreSQL, a NAT **instance**,
S3 gateway endpoint, and standard Parameter Store SecureStrings. Connect the API
directly to RDS. The current application accepts an ordinary PostgreSQL URL; it
has no dependency on RDS Proxy.

The proposal's USD 37.50 is a usage estimate. USD 70 is the approved monthly
ceiling, while USD 20 is a future SarvoAI application spending limit. Neither is a
subscription or a prepaid allocation. Charge estimates must include only actual
expected AI usage. AWS Budgets notifications do not prevent spending.

### Monthly estimate before promotional credits

Assume 730 running hours, 300 monthly active users, 900,000 HTTP API requests,
ordinary API calls averaging 200 ms at 1 GB, and small fictional files. Prices are
USD, on-demand, excluding applicable tax. Account credits are deliberately not
subtracted: eligibility, depletion and expiry must be tracked separately.

| Item | Rate or usage assumption | Estimate USD/month |
| --- | --- | ---: |
| RDS PostgreSQL db.t4g.micro, Single-AZ | 730 × 0.025/hour | 18.25 |
| RDS gp3 storage, 20 GB | 20 × 0.138/GB-month | 2.76 |
| NAT EC2 t4g.nano, Linux shared tenancy | 730 × 0.0053/hour | 3.87 |
| NAT public IPv4, one | 730 × 0.005/hour | 3.65 |
| NAT gp3 root disk, 8 GB | 8 × 0.096/GB-month | 0.77 |
| **Fixed subtotal** | | **29.30** |
| Amplify dashboard | Allowance for 100 standard build minutes, 1 GB served and 100,000 small SSR requests | 2.00 |
| Cognito Lite/Essentials | 300 direct-auth MAUs, within the published 10,000-MAU allowance; no SMS, Plus plan or M2M tokens | 0.00 |
| API Gateway HTTP API | 0.9 million × 1.25/million | 1.13 |
| Lambda | 900,000 requests and 180,000 GB-seconds, within the published 1 million/400,000 free allowance | 0.00 |
| S3 documents and audit log storage | Small files and modest GET/PUT usage; planning allowance | 0.50 |
| CloudWatch logs/monitoring | 14-day retention and modest log volume; planning allowance | 1.00 |
| Transfer, temporary migration job and backup contingency | Planning allowance; no standing migration instance | 2.00 |
| Parameter Store, IAM, VPC, S3 gateway endpoint | Standard parameters/throughput, managed aws/ssm key, ordinary IAM/VPC and gateway endpoint | 0.00 |
| SQS | No current producer/consumer requires a queue | 0.00 |
| SarvoAI initially | Disabled until its application spending control is reviewed | 0.00 |
| **Initial estimate** | | **35.93** |
| SarvoAI after enablement | Illustrative light-use allowance, not a verified model token forecast | 2.00–4.00 |
| **Illustrative later estimate** | | **37.93–39.93** |

The allowances are forecasts, not fixed prices or hard caps. Lambda and Cognito
free capacity can be shared with other workloads; confirm availability. Larger
files, slow functions, frequent builds, excessive logs, burst CPU credits, retained
snapshots, external data transfer and taxes can raise the bill. Recalculate from
measured usage after the first test week. The AI illustration must be replaced
with model token measurements before enabling Bedrock. Do not promise a USD 0
invoice or a fixed number of credit-funded months.

Adding RDS Proxy to the 2-vCPU database costs another `730 × 2 × 0.018 = USD 26.28`
per month. It is not part of this test plan. A NAT Gateway and Multi-AZ RDS are also
excluded. Re-cost and review any proposed substitution before deployment.

Price sources checked on 4 November 2026:

- [Singapore RDS public catalogue](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ap-southeast-1/index.json), publication 29 October 2026; PostgreSQL instance SKU `BQ5T85JXP99J9D2J`, gp3 storage `FXXDJWB23UZKQHCN`, proxy `BFA6WUJUSCF27BAV`.
- [AWS Singapore EC2 Linux pricing feed](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/Asia%20Pacific%20(Singapore)/Linux/index.json), publication 3 November 2026; t4g.nano rate `YNP87TGG5MUZDAE6.JRTCKXETXF.6YS6EN2CT7`.
- [Singapore EC2 public CSV](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/ap-southeast-1/index.csv), gp3 SKU `X8SY8CJFS8WV7VQN`, effective 1 November 2026.
- [Public IPv4 pricing](https://aws.amazon.com/vpc/pricing/), [Amplify](https://aws.amazon.com/amplify/pricing/), [Cognito](https://aws.amazon.com/cognito/pricing/), [Lambda](https://aws.amazon.com/lambda/pricing/), [API Gateway](https://aws.amazon.com/api-gateway/pricing/), [S3](https://aws.amazon.com/s3/pricing/), [Parameter Store](https://aws.amazon.com/systems-manager/pricing/).

## Resource plan and isolation

| Product | Test setup |
| --- | --- |
| VPC/network | Separate test VPC, public NAT subnet, private Lambda/database subnets, explicit route tables and least-privilege security groups; preserve the existing default VPC |
| EC2 NAT | One t4g.nano with encrypted 8 GB gp3, IMDSv2 required, no SSH ingress, source/destination checking disabled, one public IPv4; maintain its OS; monitor availability |
| RDS | Private PostgreSQL 17.11 db.t4g.micro, Single-AZ, 20 GB encrypted gp3, automated backups and reviewed final-snapshot policy; no public address, Proxy or Multi-AZ |
| S3 | Private test documents bucket, block all public access, encryption, HTTPS, dashboard-specific CORS and the existing signed PUT/GET flow |
| Cognito | Test pool, case-insensitive usernames, admin-only sign-up, no required email/phone, password policy matching `cognito-setup.md`, public dashboard/mobile clients with no client secret |
| Lambda/API Gateway | Existing Node 24 arm64 NestJS handler and HTTP API; test settings below |
| Amplify | Existing Next.js 15 monorepo build settings, default test hostname; connect GitHub through the account owner's authorised flow |
| Parameter Store | Separate bootstrap creates master-password/NIC-key Standard SecureStrings; the later migration creates the runtime database URL. All under `/sarvodaya-connect/test/` using managed `aws/ssm` |
| Logs/audit | 14-day API/function logs; inspect existing CloudTrail coverage and event history before adding a dedicated non-organization trail |
| AWS Budgets | Owner created `sarvodaya-connect-test-monthly` on 4 November 2026: recurring USD 70, actual-cost USD 50/USD 70 alerts, unblended costs excluding Credit/Refund, no actions. Preserve this manually managed budget; the foundation does not create one |

Use test names/tags (`Project=SarvodayaConnect`, `Environment=test`) and inspect
existing resource names before creation. The API template creates its API/function
and logs; it still expects the network, database, pool and bucket to be provisioned
separately. Their infrastructure-as-code and the complete change set must be
reviewed before anything is executed. No console-only provisioning is authorised
by this document.

Cloudflare Pages and production DNS remain unchanged. The current app uses Mapbox,
although the older architecture drawing labels MapTiler. Keep Mapbox; public tokens
must have the correct restrictions and scopes, and private provider keys must not
enter client bundles. Firebase Cloud Messaging remains external. Do not create
SQS without an implemented background-task producer and consumer.

## Test API configuration

`infrastructure/aws/template.yaml` accepts `Stage=test`. Existing staging and
production settings continue using their Secrets Manager inputs. Test uses:

- function `sarvodaya-api-test` and separate test log groups;
- one PostgreSQL connection per active Lambda instance and reserved concurrency 2;
- HTTP API throttle 5 requests/second and burst 10 (best-effort throttling, not a monthly spending cap);
- 14-day log retention and no active X-Ray tracing;
- `CONFIG_PARAMETER_PREFIX=/sarvodaya-connect/test`;
- `AUTH_PROVIDER=cognito`, S3 storage and `NODE_ENV=production`, to disable local/demo adapters even in this test environment;
- a template rule refusing `SarvoAiEnabled=true` for test until a reviewed monthly application spending control replaces this restriction.

Reserved concurrency reduces simultaneous database pressure. It does not guarantee
a maximum number of idle backend connections, zero timeouts or a fixed bill.
Observe `DatabaseConnections`, CPU credits, latency, errors and Lambda throttles,
and exercise connections after an idle/warm period. Validate the region's Lambda
concurrency quota before applying the reservation. Increase capacity only after
reviewing its database and cost effect.

Create these encrypted parameters securely in the **test** account/region scope:

| Parameter name | Value |
| --- | --- |
| `/sarvodaya-connect/test/database-url` | Dedicated least-privilege test database user's PostgreSQL URL with TLS; redact the entire value in reports |
| `/sarvodaya-connect/test/nic-encryption-key` | Random 32-byte key represented as 64 hex characters; preserve it separately from database backups |

CloudFormation cannot resolve an SSM SecureString directly into arbitrary Lambda
environment properties. The handler therefore reads exactly these two parameters
with `GetParameters(WithDecryption=true)` before Nest starts, using its execution
role. Missing, plaintext, wrong-namespace, malformed or non-TLS production settings
fail closed. Decrypted values and service errors are not logged. Each warm instance
keeps the values in process memory; configuration rotation requires recycling the
function instances. A customer-managed KMS key needs a separately reviewed scoped
KMS permission and adds cost; the template does not grant wildcard decrypt rights.

Do not place secrets in Amplify variables, `NEXT_PUBLIC_*`, Git, shell history or
command-line literals. The dashboard needs only the public pool/client identifiers
and the server-side API URL. Staff/test identity creation and password setting need
the owner's specific instruction; there is no automated staff bootstrap in this
AWS deployment plan.

## Remaining deployment and validation gates

1. Verify the existing account and Singapore before every change set. The owner
   chose their current root console session after being advised to use an everyday
   identity. Never create keys or extract credentials. Preserve the existing
   organization-wide Identity Center settings.
2. Review the template/code changes and bootstrap/foundation IaC, inspect the full
   CloudFormation change set, verify account/region, and confirm current credit
   applicability and tax treatment. Create no resources if the estimate exceeds USD 70.
3. Define automated backup retention and recovery, preserve the NIC key, and verify
   the migration target is the new private test database. Use a temporary VPC
   migration task and dedicated database roles; never migrate a shared/production database.
4. Configure the pool/clients and dashboard; obtain specific permission for
   fictional test identities or have the owner create them. Test real sign-in,
   token refresh/revocation, role/society scope, database connectivity and private
   document upload/download.
5. Keep Bedrock disabled until reviewed application code enforces the monthly USD 20
   maximum across concurrent instances and retries, with atomic pre-call spending
   reservations and conservative failure accounting. Budget emails are insufficient.
   Review restricted-data handling and global processing before enabling the model.

No AWS end-to-end test is implied by the local tests. After provisioning, record
resource IDs, validation evidence and actual costs in a private operational record.

## Cleanup plan

Do not delete anything during initial setup. At the owner's later instruction,
identify only resources created for this test stack by tags and stack membership.
Export any required fictional test evidence, preserve the final database snapshot
and NIC key as agreed, then remove the test API, dashboard, pool, database, NAT
instance, public IP, network and temporary jobs in dependency order. Empty/delete
only the verified test buckets if explicitly authorised. Delete retained snapshots,
logs and encrypted parameters only when their retention/recovery requirements have
been satisfied. Retained disks, IPs, snapshots, logs and files may continue charging.
Never delete the account's pre-existing default VPC, trails, budgets or unrelated
resources as test cleanup.
