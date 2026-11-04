# AWS configuration

**TEST environment:** [aws-test-environment.md](aws-test-environment.md) defines the approved low-cost test shape: direct private RDS, a NAT instance and standard Parameter Store SecureStrings. Use `Stage=test`; the settings below describing RDS Proxy/Secrets Manager apply to the earlier staging/production shape. The test configuration remains undeployed until review and account preflight are complete.

How the platform is configured for the agreed AWS shape: the Next.js 15 dashboard on AWS Amplify, the NestJS API on AWS Lambda behind API Gateway, PostgreSQL on Amazon RDS (through RDS Proxy) with Prisma, Cognito for production identity, and a private S3 bucket for documents. Reviewed infrastructure templates describe resources for owner-driven deployment; no workflow deploys them or stores AWS credentials. The test foundation is documented in `infrastructure/aws/test/README.md`.

Every setting is an environment variable with a safe development default (`.env.example`). **Secret** values come from AWS Secrets Manager in production; **config** values are plain Lambda or Amplify environment variables.

## API settings

| Variable | Kind | Default (development) | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Secret | local PostgreSQL | PostgreSQL URL; direct private RDS for test, earlier RDS Proxy shape for other deployed stages |
| `CONFIG_PARAMETER_PREFIX` | Config | unset | Lambda test: `/sarvodaya-connect/test`; cold-start loading of the two encrypted settings described in `aws-test-environment.md`. Leave unset locally |
| `DATABASE_CONNECTION_LIMIT` | Config | `2` | Pool size per Lambda instance; test uses 1 with reserved concurrency 2, direct to private RDS |
| `NODE_EXTRA_CA_CERTS` | Config | unset | Test Lambda: `/var/task/certificates/rds-ap-southeast-1.pem`; public AWS RDS CA bundle included by `package:lambda`, loaded by Node at startup |
| `NIC_ENCRYPTION_KEY` | Secret | — | NIC vault key (64 hex characters) |
| `STORAGE_DRIVER` | Config | `local` (`s3` in production) | Document storage driver |
| `S3_BUCKET` | Config | — | Private documents bucket |
| `S3_REGION` | Config | — | Bucket region |
| `STORAGE_URL_TTL_SECONDS` | Config | `900` | Lifetime of pre-signed upload and download URLs (60–604800) |
| `DOCUMENT_MAX_UPLOAD_BYTES` | Config | `10000000` | Largest upload; PDF, JPG or PNG; at most 50 MB (PR 4). Also limits incident photos (PR 8) |
| `LOCAL_STORAGE_DIR` | Config | `.local-storage` | Development driver only; refused in production |
| `STORAGE_SIGNING_SECRET` | Secret | random per start | Development driver link signing |
| `CORS_ALLOWED_ORIGINS` | Config | empty | Development driver only: dashboard origin allowed to PUT to local upload links (PR 4) |
| `SARVOAI_ENABLED` | Config (feature flag) | `false` | SarvoAI on Bedrock; see `sarvoai-aws-setup.md`. While it is not `true`, `POST /assistant/questions` answers 503 and nothing is sent to AWS (PR 9 screens show "SarvoAI isn’t available right now") |
| `SARVOAI_MODEL_ID` | Config | `global.anthropic.claude-haiku-5-5` | Bedrock model or inference profile SarvoAI calls; the IAM policy must allow this one model |
| `SARVOAI_PRICE_REVIEW_UNTIL` | Config | empty | UTC expiry of owner pricing/global-routing review, at most 31 days ahead; empty/expired values block every provider call |
| `SARVOAI_FICTIONAL_ONLY` | Config | `true` in TEST | Tools see only `TEST-*` societies in district `TEST-ONLY`; Exco personal lookups are disabled |
| `SARVOAI_AWS_REGION` | Config | `ap-southeast-1` | Bedrock Region; requests are signed with the API's IAM role (no API key) |
| `NODE_ENV` | Config | `development` | `production` on AWS; turns off development-only drivers and demonstration users |
| `API_PORT` | Config | `3001` | Local only; Lambda does not listen on a port |
| `API_PUBLIC_URL` | Config | `http://localhost:3001` | Development storage links only |
| `DISTRICT_ACCESS_MAX_DAYS` | Config | `14` | Longest temporary DDM access a DM can give (1–90 days). Checked by the API on every grant (PR 7) |
| `AUTH_PROVIDER` | Config | `local` (`cognito` when `NODE_ENV=production`) | `local`: passwords and sessions in PostgreSQL, development and tests only. `cognito`: Amazon Cognito tokens; `local` is refused in production (PR 10) |
| `COGNITO_USER_POOL_ID` | Config | — | User pool, e.g. `ap-southeast-1_AbCdEf123`; required when `AUTH_PROVIDER=cognito`. The token issuer and the region of the admin calls come from it (PR 10) |
| `COGNITO_CLIENT_ID` | Config | — | Public app client ids (no secret) whose access tokens the API accepts, comma-separated (dashboard, phone app) (PR 10) |
| `COGNITO_REGION` | Config | from the pool id | Optional check: must match the region in `COGNITO_USER_POOL_ID` |
| `COGNITO_TOKEN_USE` | Config | `access` | Which Cognito token the clients send: `access` or `id` (PR 10) |
| `LOG_FORMAT` | Config | `json` on Lambda and in production, `text` locally | One JSON object a line for CloudWatch (PR 10) |
| `S3_ENDPOINT_HOST` | Config | — | Optional S3 host override (virtual-hosted), e.g. a VPC interface endpoint name |
| `S3_ENDPOINT_URL` | Config | — | Local S3-compatible store (MinIO) for development and the smoke test only; path-style; refused in production (PR 10) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | Secret | — | S3 signing keys. **On Lambda the runtime sets them from the function's IAM role**; never set them by hand on AWS. Only a local MinIO needs them |

PR 10 adds the Cognito, log format and local S3 endpoint settings above; nothing else changes.

The temporary DDM access maximum is added with PR 7. PR 8 (disaster response) adds no environment variables. PR 9 adds no new variables; it documents the SarvoAI model and Region settings from PR #74.

## Dashboard settings (Amplify)

| Variable | Kind | Default (development) | Purpose |
|---|---|---|---|
| `API_BASE_URL` | Config | `http://localhost:3001/api/v1` | API address, read on the server only (server components and server actions) |
| `PLATFORM_DEMO_MODE` | Config | `false` | Fictional demonstration data; ignored when `NODE_ENV` is `production`. In this mode SarvoAI shows labelled sample answers instead of calling the API |
| `NEXT_PUBLIC_API_BASE_URL` | Config | `http://localhost:3001` | Public API address; not used for data access |
| `AUTH_PROVIDER` | Config | `local` (`cognito` in production) | `cognito`: sign in with the user pool; `local`: the API's development passwords, refused in production |
| `COGNITO_USER_POOL_ID` | Config | — | The same user pool as the API; required with `cognito` |
| `COGNITO_CLIENT_ID` | Config | — | The dashboard's public app client (no client secret) |
| `COGNITO_REGION` | Config | from the pool id | Optional check against the pool id |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Public config | empty | Mapbox **public** token (`pk.`) for the street maps. Built into the browser code, so it is not a secret; restrict it to the dashboard's URLs in the Mapbox account. Set it as an Amplify build environment variable (`amplify.yml` writes it to `.env.production`). Empty: the drawn maps are shown |

SarvoAI on the dashboard (`/sarvoai`, the D02 Ask bar) and the phone (M80–M89) call the same `POST /api/v1/assistant/questions` endpoint. They hold no AWS settings or credentials.

## Documents in S3 (PR 4)

- **Upload:** the API checks the user's permission, records the metadata (society, type, financial year, uploader, time, size, SHA-256) and returns a short-lived pre-signed `PUT` URL. The client sends the file straight to S3 and then calls `POST /documents/:id/complete`; the API checks the stored size before marking it uploaded. Files never pass through API Gateway or Lambda.
- **Integrity:** the pre-signed URL signs `Content-Type` and `x-amz-checksum-sha256`, so S3 refuses a different file or type.
- **Download:** permission-checked, short-lived pre-signed `GET` URLs. The signed members list opens only for District Managers and HQ.
- **Keys:** `societies/{societyId}/{type}/{fy}/{uuid}.{ext}`, for example `societies/…/audit-report/2025-26/….pdf`; `general` is used for documents without a financial year. Keys contain no names or other personal data.

### IAM permissions for the API's Lambda role

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject"],
  "Resource": [
    "arn:aws:s3:::<documents-bucket>/societies/*",
    "arn:aws:s3:::<documents-bucket>/incidents/*"
  ]
}
```

PR 8 adds the `incidents/*` prefix for disaster-response photos (see below).

`s3:GetObject` also covers the `HEAD` request used to confirm an upload. The bucket blocks all public access and uses default encryption.

### Bucket CORS (browser uploads from the dashboard)

```json
[
  {
    "AllowedOrigins": ["https://<dashboard-domain>"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "x-amz-checksum-sha256"],
    "MaxAgeSeconds": 3000
  }
]
```

The phone app uploads with a native HTTP client and needs no CORS rule.

## Disaster response photos (PR 8)

- Rapid assessments (M41, IR03) and delivery updates (M46) can carry PDF or photo evidence, up to `DOCUMENT_MAX_UPLOAD_BYTES` each and at most ten per record, through the same pre-signed `PUT` flow as documents: the API checks the user's scope, records the evidence row and returns a short-lived URL; the client uploads straight to S3 and calls `POST /emergencies/evidence/:id/complete`, where the API checks the stored size.
- **Keys:** `incidents/{incidentId}/{assessments|deliveries}/{evidenceId}.{ext}`. Only ids generated by the API, no names or other personal data.
- **Download:** `POST /emergencies/evidence/:id/download` returns a short-lived `GET` URL to people whose scope covers the society the photo is about.
- **CORS:** the existing bucket rule (dashboard origin, `PUT` and `GET`, `Content-Type` and `x-amz-checksum-sha256`) already covers dashboard photo uploads; the phone needs none.
- Everything else in disaster response is stateless: deadlines ("1 day 9 hours left") and response action states (Needed, Assigned, In progress, Delivered) are worked out from the database on each request. There are no timers or scheduled jobs; HQ sends assessment reminders by hand from D31.

## Maps (Mapbox)

The HQ National Dashboard's society map (D02), the society record's location card and the create and edit society forms use Mapbox street maps; the phone shows the society record's location on one and lets the user tap to set the pin.

- **Token:** one Mapbox public token (`pk.`), URL-restricted in the Mapbox account. Dashboard: `NEXT_PUBLIC_MAPBOX_TOKEN` (Amplify build environment variable). Phone: a build setting, `flutter build ... --dart-define=MAPBOX_TOKEN=pk...` (`flutter_map` with Mapbox raster tiles, so no secret download token is needed). Public configuration, not a secret, but never committed. Never use a secret (`sk.`) token: both apps ignore anything that does not start with `pk.`.
- **What goes to Mapbox:** only map tiles are requested, straight from the browser or the phone; the API does not proxy them. Pins are drawn on the device from the API's response, so society names and positions are not sent to Mapbox.
- **No token, offline or refused:** the dashboard and phone show their existing drawn maps; a map that fails to load on the dashboard says "The map could not load" with "Try again", and the rest of the page is unaffected.
- **API:** `GET /national/map` (PR 5, HQ only) feeds D02 and now also returns each pin's district. `GET /societies/map` returns pins within the caller's own scope (HQ national, a DM their district, SPC, DDM and Society Officer their assigned societies plus a DDM's current temporary district), with only id, name, S number, grade, status, position and district, and a count of active societies without a position. Each is one bounded select (at most 10,000 pins, about 1 MB) using the existing `societies (district_id)` and `(status)` indexes. No migration, no caching, no new AWS resources.
- **Cost:** the dashboard is billed as **Map Loads for Web** (free up to 50,000 a month). The phone uses Mapbox raster tiles through `flutter_map`, not the native Mapbox SDK, so it is billed as **Static Tiles API** requests, not mobile users: each phone map view loads roughly 10 to 20 tiles. Check the current free allowance at mapbox.com/pricing. Without a payment method the account is "usage limited" (5,000 web map loads and 20,000 tile requests a month), and maps stop loading above that; add a payment method before launch. Usage above the free tiers is billed by Mapbox, so set a usage alert in the Mapbox account.
- Mapbox's logo and attribution stay visible on every map, as Mapbox requires.

## Database migrations

Apply with `npm run prisma:deploy` in `apps/api` against RDS (through a migration task, not from a developer machine).

| Migration | PR | What it adds |
|---|---|---|
| `20261103090000_v5_activities_sdgs_documents` | 4 | Activity status (waiting for SPC, sent back, approved), dimension, participants and beneficiaries, partners, resources, volunteer hours, who sent and reviewed it; `work_plan_activity_sdgs` (UN SDG 1–17 with a check constraint); document SHA-256. Existing activities become approved. |
| `20261103091000_v5_registrar_document_counts` | 4 | Index on `society_documents (financial_year_start, document_type, society_id)` for the D11/D12 national counts |
| `20261104090000_v5_access_history_index` | 7 | Index on `platform_audit_events (action, target_id)` for a temporary access grant's history and "societies opened" count |
| `20261104090000_v5_national_dashboard` | 5 | `districts.province` (filled for the 25 districts); `notifications.topic` for the Alerts filters (existing rows get a topic from their link); `information_requests` and `information_request_societies` for HQ requests (D13); index `societies (status, updated_at)` for "not updated in 90+ days" and `notifications (recipient_user_id, topic, created_at)` |
| `20261105090000_v5_disaster_response` | 8 | Incidents: reference number, area districts (GIN index), reporting society, opener name and role, start time, assessment deadline, message, last reminder, and who closed it and when (`closed_by_id`, `closed_by_name`, `closed_by_role`). Assessments: impact, houses fully/partly damaged, injured, road access, needs, checked with the President. Response actions: need, quantity and unit. New `emergency_action_helpers` (helping societies and deliveries) and `emergency_evidence` (S3 keys). Situation reports: number, as-of time and a counts snapshot. Existing incidents get their own district as the area. |

Indexes added in PR 4 for dashboard queries: `work_plan_activities (status, submitted_at)` and `(status, reviewed_at)` for the SPC queue, `work_plan_activity_sdgs (sdg)` for SDG rankings (PR 5), and the Registrar document index above. National Registrar counts run as two grouped SQL queries, not a loop over societies.

## National dashboard queries (PR 5)

PR 5 adds no settings and no AWS resources. Its endpoints are read-mostly and sized for Lambda:

- **Grouped SQL:** the D02 figures, district cards, membership, programmes, reports and HQ tasks are each a handful of grouped queries over all societies, never a loop over societies. A report is at most one row per district, category or sector.
- **Bounded lists:** the society directory, the "not added" list, the request tracker and Alerts are paginated (at most 100 rows a page); search returns at most 10 results a type (25 for one type).
- **Map:** `GET /national/map` returns every society that has a position, as a few small fields each (the Mapbox maps PR adds the district and stops at 10,000 pins, saying so with `truncated`). At about 5,500 societies this is roughly 600 KB of JSON, well inside the 6 MB Lambda response limit. If the registry grows far beyond that, return the points by district or as tiles instead.
- **Reports:** the dashboard previews a report as JSON, prints it as PDF in the browser and builds the CSV ("Excel") download itself, so nothing is written to disk or S3. Scheduled reports would need EventBridge and email; they are not built (To Confirm in the PR).
- **Requests:** sending a request to every active society writes one row and at most one notification per society in a single transaction; for about 1,100 societies that is well within one Lambda invocation.

## Release readiness (PR 10)

Nothing below has been deployed, and no AWS resources were created. Each item was checked locally as described.

### Identity: Amazon Cognito

Full setup, the user pool settings and the local development flow are in [`cognito-setup.md`](cognito-setup.md).

- `AUTH_PROVIDER=cognito` (the default in production) verifies the `Authorization: Bearer` token with [`aws-jwt-verify`](https://github.com/awslabs/aws-jwt-verify) against the user pool's public keys (signature, issuer, expiry, `token_use` and app client). The API's local passwords and sessions are switched off in this mode; HQ account creation and password setting go to Cognito instead.
- **Roles and scopes still come from the database.** The token's `sub` is looked up in `platform_accounts.provider_subject`; the account must be `ACTIVE`, and its role, district, societies and any temporary DDM grant are loaded on every request (`IdentityService.principalFor`), exactly as for local sessions. A token whose user has no linked active account is refused.
- **Accounts:** HQ creates accounts and sets passwords from D16 as before. In Cognito mode the API creates the Cognito user with a permanent password and links its `sub`, using its IAM role. The dashboard and phone app sign in to the user pool directly (public client, `USER_PASSWORD_AUTH`). Only the first HQ account is linked by hand (`npm run identity:link-cognito-hq`). See `cognito-setup.md`.
- **Ended sign-ins:** a password reset, role change or disable stores `sessions_revoked_at` (migration `20261106090000_cognito_session_revocation`). Tokens from an earlier sign-in are refused, and Cognito's refresh tokens are revoked.
- Tests: `src/auth/cognito-authentication.provider.spec.ts` (mocked verifier) and `test/db/release-readiness.db-spec.ts` (Cognito mode end to end against PostgreSQL, with a mocked verifier: DDM temporary district loaded, forged/unlinked/disabled users refused, local login refused).

### API on Lambda behind API Gateway

- **Entry point:** `apps/api/src/lambda.ts` (`lambda.handler`) for an API Gateway **HTTP API** (payload format 2.0), using `@codegenie/serverless-express`. Promise-style only (Node.js 24 Lambda runtimes no longer support callback handlers). The Nest app is created once per Lambda instance and reused; it holds no request or user state. The local server (`main.ts`) and the handler share `app.setup.ts` (prefix, validation, `{ error: { message } }` filter, CORS for the local storage driver).
- **Package:** `npm run package:lambda` in `apps/api` builds `.lambda/sarvodaya-api.zip` (git-ignored): the compiled app with the generated Prisma client and production dependencies only. The Prisma CLI, Studio, TypeScript, type packages, source maps of dependencies and the non-PostgreSQL query compilers are removed. Result on 3 Nov 2026: **36 MB zipped, 183 MB unzipped** (Lambda limit 250 MB). There are no native binaries (the script fails if one appears), so the zip runs on arm64 or x86_64.
- **Template:** `infrastructure/aws/template.yaml` (AWS SAM): `nodejs24.x`, arm64, 1024 MB, 29 s timeout (HTTP APIs wait at most 30 s), VPC subnets and security group as parameters, JSON log format, 90-day log retention, API access logs with request id, route, status and latency only. `cfn-lint` 1.59 passes with no findings. It is not deployed.
- **Local emulator:** `npm run build && npm run lambda:local` serves the built handler on `http://localhost:3011/api/v1`, turning each HTTP request into an API Gateway payload 2.0 event and enforcing Lambda's 6 MB payload limit. `LAMBDA_HANDLER_PATH=.lambda/package/lambda.js` runs the deployment package itself. `sam local start-api -t infrastructure/aws/template.yaml` is the alternative where AWS SAM CLI is installed (it was not available on the machine used for PR 10).

### Local smoke test (sign-in, home, private document upload)

Run against the emulator with a fresh PostgreSQL (all 13 migrations applied to an empty database, then `npm run prisma:seed` and `npm run identity:bootstrap`) and MinIO (`cgr.dev/chainguard/minio`, private bucket):

```
STORAGE_DRIVER=s3 S3_BUCKET=sarvodaya-documents-smoke S3_REGION=us-east-1 S3_ENDPOINT_URL=http://localhost:9000 \
AWS_ACCESS_KEY_ID=<minio user> AWS_SECRET_ACCESS_KEY=<minio password> \
LAMBDA_HANDLER_PATH=.lambda/package/lambda.js npm run lambda:local
SMOKE_HQ_USERNAME=<local hq> SMOKE_HQ_PASSWORD=<password> npm run smoke:local
```

`scripts/smoke-local.ts` checks, in order: HQ signs in; HQ creates a fictional SPC for a seeded society; the SPC signs in; `GET /home` returns the SPC home; `GET /home` without a token is 401; the API returns a 15-minute pre-signed upload URL whose key holds only ids; the file uploads straight to storage; the same URL with a different content type is refused (403); `POST /documents/:id/complete` confirms the size; the pre-signed download returns the same bytes; an unsigned GET is refused. **All 11 checks passed** against the packaged handler, and the 128 JSON log lines contained no password, token, document content or signature.

### Database: RDS through RDS Proxy

- Point `DATABASE_URL` at the **RDS Proxy** endpoint (TLS, `sslmode=require`), not the instance. Each Lambda instance opens at most `DATABASE_CONNECTION_LIMIT` connections (default 2, allowed 1–20; idle connections close after 10 s). Size the proxy's `MaxConnectionsPercent` for (expected concurrent Lambda instances × 2) plus the migration task, and set the function's reserved concurrency so that product stays inside it.
- Migrations: `npm run prisma:deploy` from a one-off task in the VPC (CodeBuild or an ECS task), never from a developer machine. All 13 migrations applied cleanly to an empty PostgreSQL 17 database on 3 Nov 2026, and `prisma migrate diff --exit-code` reported no drift. PR 10 adds no migration.
- Queries stay bounded: lists are paginated (at most 100 a page), national figures are grouped SQL, and no endpoint loops over societies (PR 4, 5, 8).

### Logs

- JSON lines (`LOG_FORMAT=json`, automatic on Lambda) with level, timestamp, context and message; Lambda's own JSON log format is set in the template. Unexpected 5xx errors log the method, route, error name and request id only. Log lines never contain NICs, passwords, tokens, signed URLs or document contents (checked in the smoke run).
- Retention: 90 days for the function and access logs (template).

### IAM for the API function

The template grants only:
- `s3:PutObject` and `s3:GetObject` on `societies/*` and `incidents/*` in the documents bucket;
- six Cognito admin actions on the one user pool, for HQ account management: `AdminGetUser`, `AdminCreateUser`, `AdminSetUserPassword`, `AdminEnableUser`, `AdminDisableUser` and `AdminUserGlobalSignOut` (no delete, listing or pool changes);
- when `SarvoAiEnabled=true`, `bedrock:InvokeModel` on the one Haiku 5.5 global inference profile (the same three statements as `sarvoai-bedrock-policy.json`). Lambda's VPC access is added by SAM (`AWSLambdaVPCAccessExecutionRole`). No Secrets Manager permission is needed at run time: `DATABASE_URL` and `NIC_ENCRYPTION_KEY` are resolved from Secrets Manager when the stack is deployed. If Sarvodaya prefers reading secrets at run time (so a rotation does not need a redeploy), add the AWS Parameters and Secrets Lambda Extension and `secretsmanager:GetSecretValue` on those two secrets (To Confirm).

### Dashboard on Amplify

`amplify.yml` (repository root) builds `apps/dashboard` with Node 24 and writes `API_BASE_URL`, `PLATFORM_DEMO_MODE`, `AUTH_PROVIDER` and the `COGNITO_*` values into `.env.production` before `next build`, because Amplify does not pass console variables to the Next.js server (or middleware) otherwise. The only value exposed to the browser is the optional Mapbox public token (`NEXT_PUBLIC_MAPBOX_TOKEN`, see Maps), and there is no client secret. `npm run build` succeeds with only `API_BASE_URL` and `PLATFORM_DEMO_MODE` set. Sign-in then fails closed until the Cognito values are added.

### SarvoAI on Bedrock

- Checked against AWS's Claude Haiku 5.5 model card on 3 Nov 2026: from **ap-southeast-1 (Singapore)** the model is available **only** through the **global** cross-Region inference profile `global.anthropic.claude-haiku-5-5` on `bedrock-runtime` (no in-Region and no geo/APAC option). That matches the defaults above; requests may be processed in any AWS commercial Region.
- Not checked (needs the account owner): that the account has completed Anthropic's first-time use form and the AWS Marketplace subscription, and that no Service Control Policy blocks global routing. See `sarvoai-aws-setup.md`. Until Sarvodaya approves global processing, keep `SARVOAI_ENABLED=false` (the default here and in the template).
- Limits: questions 3–500 characters, at most 10 earlier turns of 2,000 characters, 6 tool rounds, 8,000 output tokens; the summary shown is cut at 1,200 characters and each suggestion at 200. Errors return a fixed message; the provider's error and the prompt are never returned.

### Deployment steps (for the account owner; not done in PR 10)

1. Create (outside this repository):
   - the VPC, with private subnets and a NAT gateway or VPC endpoints (S3, Bedrock runtime, and the Cognito user pool API and JWKS over HTTPS);
   - RDS PostgreSQL 17 with RDS Proxy;
   - the private documents bucket (block public access, default encryption, the CORS rule above);
   - the Cognito user pool and public app clients, with the settings in `cognito-setup.md`;
   - two Secrets Manager secrets (`DATABASE_URL`, `NIC_ENCRYPTION_KEY`).
2. Run migrations from a one-off task in the VPC: `npm ci && npm run prisma:deploy` in `apps/api`.
3. `npm run package:lambda`, then `sam deploy -t infrastructure/aws/template.yaml --guided` with the parameters (stage, bucket, pool, client ids, secret ARNs, subnets, security group).
4. In Amplify, connect the repository (it uses `amplify.yml`), set `API_BASE_URL` to the template's `ApiBaseUrl` output, and set `COGNITO_USER_POOL_ID` and the dashboard's `COGNITO_CLIENT_ID`.
5. Create the first HQ user in Cognito and link it with `npm run identity:link-cognito-hq` (`cognito-setup.md`, "First HQ account").
6. Run the smoke checks against the deployed API with a fictional test account, then remove that account.

## GitHub Actions AWS readiness checks

The separate **AWS readiness** workflow runs on pull requests and pushes to `main`
when API code, shared contracts, AWS infrastructure, the smoke Compose file,
`amplify.yml`, `.nvmrc`, or the workflow itself changes. It can also be run manually.
It uses read-only repository permissions and needs no AWS credentials or paid services.

- **Validate AWS SAM template:** runs pinned `cfn-lint` against
  `infrastructure/aws/template.yaml`.
- **Packaged Lambda smoke checks:** uses Node from `.nvmrc`, installs API dependencies
  and runs `npm run package:lambda`. It extracts the zip outside the checkout so
  development dependencies cannot hide missing production dependencies, then calls
  the packaged handler through the
  existing local API Gateway emulator with a fresh PostgreSQL 17 database and a
  private MinIO bucket. The existing 11 smoke checks exercise fictional HQ/SPC
  sign-in, scoped home access, unauthenticated rejection, signed upload, content-type
  tampering rejection, upload completion, matching download bytes and unsigned
  download rejection. This intentionally uses local authentication; it does not
  contact Cognito or Bedrock.

Run the same package and smoke steps locally from `apps/api` with Node 24, Docker
Compose v2, `curl` and `unzip` installed:

```sh
npm ci
npm run package:lambda
bash scripts/smoke-ci.sh
```

The runner uses a unique Compose project, random loopback ports and generated
credentials, seeds only fictional fixtures, and bootstraps a temporary local HQ.
An exit/signal trap stops the emulator and removes containers, networks and volumes
on success or failure. An `always()` workflow step repeats container cleanup if the
runner is interrupted. A forcibly terminated local shell can be cleaned up with
`docker compose -p <project-name> -f infrastructure/docker/docker-compose.aws-smoke.yml down --volumes --remove-orphans`
(set dummy values for `SMOKE_DB_PASSWORD`, `MINIO_ROOT_USER` and
`MINIO_ROOT_PASSWORD` to satisfy Compose interpolation).
The earlier `npm run smoke:local` command and its settings remain supported.

Passing these checks establishes template linting, package construction and local
behaviour. It does not validate Amplify hosting, AWS IAM, VPC routing, RDS Proxy,
real S3 behaviour or real Cognito sign-in/refresh/revocation. Those still require
an AWS staging deployment and the real-user-pool checks in `cognito-setup.md`.
Required pull-request checks must be configured separately in repository rules.
