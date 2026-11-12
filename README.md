# Sarvodaya Connect

<p align="center">
  <img src="docs/assets/brand/sarvodaya-connect-logo.jpg" alt="Sarvodaya Connect" height="104" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/assets/brand/stampx-logo.png" alt="STAMPx" height="104" />
</p>

<p align="center">A digital platform for managing village societies and their records, developed for Sarvodaya by the STAMPx university project team.</p>

## Contents

1. [Overview and status](#1-overview-and-status)
2. [Architecture](#2-architecture)
3. [Roles and modules](#3-roles-and-modules)
4. [Repository and technology](#4-repository-and-technology)
5. [Database and ERD](#5-database-and-erd)
6. [Authentication, API and files](#6-authentication-api-and-files)
7. [Local development](#7-local-development)
8. [Checks and CI](#8-checks-and-ci)
9. [Deployment and mobile releases](#9-deployment-and-mobile-releases)
10. [Security and contributing](#10-security-and-contributing)

## 1. Overview and status

Sarvodaya Connect gives authorised Sarvodaya staff a shared place to maintain village society records, report activities and emergencies, submit documents and follow up across society, district and national levels.

**Status updated: 11 November 2026.** The project is in TEST with fictional data. The owner has deployed the application to AWS Singapore and published the first Android internal-testing release. This is not a production-readiness claim. The deployment status below records owner-confirmed operation; this documentation update does not inspect the live AWS account.

| Area | Current position |
| --- | --- |
| Public website | [sarvodayaconnect.com](https://sarvodayaconnect.com), hosted on Cloudflare Pages |
| Staff dashboard | [dashboard.sarvodayaconnect.com](https://dashboard.sarvodayaconnect.com), hosted on AWS Amplify; HQ, DM, DDM and SPC access |
| Mobile | Flutter for Android and iOS; all five business roles. Android 0.1.0 (build 1) is available to selected Google Play internal testers; iPhone simulator builds have run. TestFlight distribution is not confirmed. |
| API and records | NestJS on Lambda behind API Gateway; private Amazon RDS PostgreSQL; local PostgreSQL also supported |
| Identity and files | Cognito sign-in with server-side role/scope checks; private S3 documents through temporary signed links |
| Languages | Shared English/Sinhala/Tamil localization, delivered in phases under [#108](https://github.com/sarvodaya-connect/sarvodaya-connect/issues/108). Sinhala/Tamil remain review drafts; converted screens and build flags are documented in [Localization](docs/localization.md). |
| SarvoAI | Existing HQ-only API integration with approved read-only tools and a spending ledger. Bedrock invocation was denied at the last owner test despite reported model availability; AWS investigation remains unresolved in the recorded status. |
| Proposed AI work | LangGraph, AgentCore Runtime and document RAG are a design, not deployed features. |
| Offline use | Do not assume general offline support. Restoration is tracked in [#125](https://github.com/sarvodaya-connect/sarvodaya-connect/issues/125), [#126](https://github.com/sarvodaya-connect/sarvodaya-connect/issues/126) and [#127](https://github.com/sarvodaya-connect/sarvodaya-connect/issues/127). Verify each workflow against merged code. |

`main` contains merged source. An open PR, a passing build or a diagram does not establish that its changes are deployed. Database migrations, Lambda updates, Amplify builds and mobile releases have separate lifecycles.

## 2. Architecture

### Current TEST environment — AWS Singapore

[![Current TEST architecture: clients, Cognito, Amplify, API Gateway, private Lambda and RDS, S3 and outbound NAT](docs/assets/architecture/current-test.png)](docs/assets/architecture/current-test.png)

*Select the diagram to view it at full size. Current TEST deployment as reported by the project owner; Bedrock's blocked-access note refers to the last test, not a live availability check.*

- Flutter and the dashboard use Cognito for sign-in. API Gateway routes HTTPS requests to NestJS on Lambda; the API validates tokens and loads current permissions from PostgreSQL.
- Lambda uses private-subnet connectivity to RDS. The **EC2 NAT instance** supplies outbound access for public endpoints; it is not a NAT Gateway. Lambda-to-RDS traffic stays inside the VPC.
- S3 is private. The API authorises file access and provides temporary upload/download links; file bytes need not pass through Lambda.
- Cloudflare hosts the public website and its dashboard link. It is not shown as a required proxy in the application API path.
- Mapbox provides maps where a public token is configured; fallback/drawn maps are used where supported without one.
- IAM, Parameter Store, CloudWatch, CloudFormation and AWS Budgets support access, configuration and operations. Budget alerts notify; they do not impose a spending cap.

The recorded TEST SarvoAI application limit is USD 3/month; the manually configured AWS budget is USD 70 with USD 50/70 alerts. These differ from local configuration defaults and historical estimates. Running RDS, the NAT instance, public IPv4, storage and other usage can incur charges while nobody is using the app. Check Billing for actual costs.

### SarvoAI — proposed core architecture

[![Proposed SarvoAI architecture with LangGraph in AgentCore Runtime, Bedrock Claude, live API tools and document RAG](docs/assets/architecture/sarvoai-proposed.png)](docs/assets/architecture/sarvoai-proposed.png)

*Design roadmap only: dashed components are proposed. This figure does not claim AgentCore, LangGraph, OCR, an embedding pipeline or OpenSearch are deployed.*

| Component | Intended responsibility |
| --- | --- |
| Existing NestJS API | Check current HQ permissions, enforce spending limits, validate the response and return it to the user |
| LangGraph inside AgentCore Runtime | Coordinate tool selection, evidence retrieval and answer generation |
| Approved read-only API tools | Fetch current society records and calculate structured figures using trusted code |
| Private S3 and document preparation | Keep approved originals; extract text/OCR when required; split into passages with document/version/page metadata |
| Document RAG | Retrieve permission-filtered passages and source references before answering document questions |
| Bedrock | Provide the selected Claude model and a compatible embedding model; actual use depends on account access and approved pricing |
| OpenSearch Serverless | Proposed passage/embedding index, subject to cost and deployment review |

The retrieval tool receives a query embedding from Bedrock and uses it to query the index. Each model or embedding call requires its own spending reservation and usage reconciliation. Evidence must be permission-filtered before it reaches the model; source references do not guarantee the answer is correct. The API remains the authority for access and data validation. See [figure notes](docs/assets/architecture/README.md) and [the existing SarvoAI integration guide](docs/sarvoai-aws-setup.md).

For local development, Docker PostgreSQL and local file storage replace RDS/S3; the same API and client code can use a local authentication adapter. Local setup does not require provisioning this AWS architecture.

## 3. Roles and modules

| Role | Data scope and responsibilities | Channels |
| --- | --- | --- |
| Society Officer (SO) | View/edit one assigned society, its records and permitted submissions | Mobile |
| Society Programme Coordinator (SPC) | View/edit assigned societies; review activity submissions | Mobile and dashboard |
| Deputy District Manager (DDM) | View/edit assigned societies; temporary district-wide access is read-only and must be currently valid | Mobile and dashboard |
| District Manager (DM) | View the district, review permitted records and manage temporary DDM district access | Mobile and dashboard |
| HQ | National views, account/assignment management, grades and HQ-only functions | Mobile and dashboard |

Modules include society registry and Exco records, aggregate membership, annual summaries and Registrar documents, work plans and activities with SDGs, grade requests, disaster incidents and assessments, response coordination, information requests, notifications and audit history. Feature and document permissions are enforced separately: access to a society or summary does not grant access to every attached document. Signed members lists remain restricted to DM/HQ.

The dashboard is **not HQ-only**. Some national pages and SarvoAI are HQ-only; regional roles receive scoped pages. Additional Membership/Audits views and other enhancements remain separate PR work until merged; do not infer their availability from the role table. See [V5 coverage](docs/v5-coverage.md), [implementation notes](docs/v5-implementation-plan.md) and the API policies for the exact supported journeys. Older V3/V4 guides are historical context and can describe superseded screens.

## 4. Repository and technology

```text
apps/
  api/             NestJS API, Prisma schema/migrations and Lambda packaging
  dashboard/       Next.js staff dashboard
  landing/         Next.js public website
  mobile/          Flutter Android/iOS app
packages/
  api-contracts/   Shared TypeScript contracts
infrastructure/
  aws/             API SAM template and Bedrock policy
    test/          TEST foundation, bootstrap and recovery/runbook material
  docker/          Local PostgreSQL and smoke-test services
.github/workflows/ PR/main checks and AWS readiness artifacts
docs/              Design, configuration and operational documentation
```

| Technology | Use |
| --- | --- |
| Flutter / Dart | Android and iOS; CI currently pins Flutter 3.47.6 |
| Next.js / React / TypeScript | Dashboard (Next.js 15) and public landing site (Next.js 16); exact versions in their package manifests |
| NestJS / Node.js 24 | REST API and Lambda entry point |
| PostgreSQL / Prisma | Records, permissions, metadata, migrations and AI spending records; TEST uses PostgreSQL 17 |
| AWS | Cognito, API Gateway, Lambda, RDS, S3 and the operational/network services shown above |
| Cloudflare / Mapbox | Public website/DNS and map presentation |
| GitHub Actions | Automated checks and build/readiness artifacts; no Google Play release workflow is committed as of this update |

Application guides: [API](apps/api/README.md), [dashboard](apps/dashboard/README.md), [mobile](apps/mobile/README.md), [landing site](apps/landing/README.md). Use current source/configuration when an older guide differs from a later merged implementation.

## 5. Database and ERD

The source of truth is [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma), with reviewed migrations under [`prisma/migrations`](apps/api/prisma/migrations). It currently defines **27 models**. The overview below shows declared relations and identifying columns; the [detailed schema reference](docs/database-design.md) includes all scalar fields, composite constraints and indexes, grouped by domain.

This is the **repository schema**, not proof that every migration is applied to the running RDS database. UUID arrays and identifier snapshots are not drawn as foreign keys unless Prisma declares a relation.

```mermaid
erDiagram
    DISTRICTS {
        uuid id PK
    }
    SOCIETIES {
        uuid id PK
        uuid district_id FK
    }
    SOCIETY_CONTACTS {
        uuid id PK
        uuid society_id FK
    }
    SOCIETY_COUNCIL_MEMBERS {
        uuid id PK
        uuid society_id FK
    }
    SOCIETY_MEMBERSHIP_COUNTS {
        uuid id PK
        uuid society_id FK
    }
    SOCIETY_DOCUMENTS {
        uuid id PK
        uuid society_id FK
    }
    ANNUAL_FINANCIAL_SUMMARIES {
        uuid id PK
        uuid society_id FK
    }
    GRADE_CHANGE_REQUESTS {
        uuid id PK
        uuid society_id FK
    }
    WORK_PLAN_ACTIVITIES {
        uuid id PK
        uuid society_id FK
    }
    WORK_PLAN_ACTIVITY_SDGS {
        uuid activity_id FK
    }
    NOTIFICATIONS {
        uuid id PK
        uuid society_id FK "nullable"
        uuid document_id FK "nullable"
    }
    EMERGENCY_INCIDENTS {
        uuid id PK
        uuid district_id FK
        uuid reporting_society_id FK "nullable"
    }
    EMERGENCY_ASSESSMENTS {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK
    }
    EMERGENCY_RESPONSE_ACTIONS {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK "nullable"
    }
    EMERGENCY_ACTION_HELPERS {
        uuid id PK
        uuid action_id FK
        uuid helper_society_id FK
    }
    EMERGENCY_EVIDENCE {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK
        uuid assessment_id FK "nullable"
        uuid helper_id FK "nullable"
    }
    EMERGENCY_SITUATION_REPORTS {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK "nullable"
    }
    PLATFORM_ACCOUNTS {
        uuid id PK
        uuid district_id FK "nullable"
    }
    ACCOUNT_INVITATIONS {
        uuid id PK
        uuid account_id FK
    }
    ACCOUNT_SESSIONS {
        uuid id PK
        uuid account_id FK
    }
    DISTRICT_ACCESS_GRANTS {
        uuid id PK
    }
    PLATFORM_AUDIT_EVENTS {
        uuid id PK
    }
    INFORMATION_REQUESTS {
        uuid id PK
        uuid district_id FK "nullable"
    }
    INFORMATION_REQUEST_SOCIETIES {
        uuid request_id FK
        uuid society_id FK
    }
    ASSISTANT_MONTHLY_SPEND {
        varchar month PK
    }
    ASSISTANT_SPEND_RESERVATIONS {
        uuid id PK
        varchar month FK
    }
    ASSISTANT_SPEND_HOLDS {
        uuid reservation_id PK,FK
    }
    DISTRICTS ||--o{ SOCIETIES : district
    SOCIETIES ||--o{ SOCIETY_CONTACTS : society
    SOCIETIES ||--o{ SOCIETY_COUNCIL_MEMBERS : society
    SOCIETIES ||--o{ SOCIETY_MEMBERSHIP_COUNTS : society
    SOCIETIES ||--o{ SOCIETY_DOCUMENTS : society
    SOCIETIES ||--o{ ANNUAL_FINANCIAL_SUMMARIES : society
    SOCIETIES ||--o{ GRADE_CHANGE_REQUESTS : society
    SOCIETIES ||--o{ WORK_PLAN_ACTIVITIES : society
    WORK_PLAN_ACTIVITIES ||--o{ WORK_PLAN_ACTIVITY_SDGS : activity
    SOCIETIES o|--o{ NOTIFICATIONS : society
    SOCIETY_DOCUMENTS o|--o{ NOTIFICATIONS : document
    DISTRICTS ||--o{ EMERGENCY_INCIDENTS : district
    SOCIETIES o|--o{ EMERGENCY_INCIDENTS : reportingSociety
    EMERGENCY_INCIDENTS ||--o{ EMERGENCY_ASSESSMENTS : incident
    SOCIETIES ||--o{ EMERGENCY_ASSESSMENTS : society
    EMERGENCY_INCIDENTS ||--o{ EMERGENCY_RESPONSE_ACTIONS : incident
    SOCIETIES o|--o{ EMERGENCY_RESPONSE_ACTIONS : society
    EMERGENCY_RESPONSE_ACTIONS ||--o{ EMERGENCY_ACTION_HELPERS : action
    SOCIETIES ||--o{ EMERGENCY_ACTION_HELPERS : helperSociety
    EMERGENCY_INCIDENTS ||--o{ EMERGENCY_EVIDENCE : incident
    SOCIETIES ||--o{ EMERGENCY_EVIDENCE : society
    EMERGENCY_ASSESSMENTS o|--o{ EMERGENCY_EVIDENCE : assessment
    EMERGENCY_ACTION_HELPERS o|--o{ EMERGENCY_EVIDENCE : helper
    EMERGENCY_INCIDENTS ||--o{ EMERGENCY_SITUATION_REPORTS : incident
    SOCIETIES o|--o{ EMERGENCY_SITUATION_REPORTS : society
    DISTRICTS o|--o{ PLATFORM_ACCOUNTS : district
    PLATFORM_ACCOUNTS ||--o{ ACCOUNT_INVITATIONS : account
    PLATFORM_ACCOUNTS ||--o{ ACCOUNT_SESSIONS : account
    DISTRICTS o|--o{ INFORMATION_REQUESTS : district
    INFORMATION_REQUESTS ||--o{ INFORMATION_REQUEST_SOCIETIES : request
    SOCIETIES ||--o{ INFORMATION_REQUEST_SOCIETIES : society
    ASSISTANT_MONTHLY_SPEND ||--o{ ASSISTANT_SPEND_RESERVATIONS : monthlySpend
    ASSISTANT_SPEND_RESERVATIONS ||--o| ASSISTANT_SPEND_HOLDS : reservation
```

### Data-model notes

- Society records have contacts, Exco members (including encrypted NIC fields), membership counts, annual financial summaries, grade requests and work-plan activities. Activity-to-SDG records use a composite key.
- Membership tables store counts by year/category/gender, not a register of every individual member. Exco members are individual records.
- `platform_accounts` stores roles, assignments and the Cognito subject link. Local-development password/session tables coexist with Cognito support; deployed Cognito credentials are managed by Cognito.
- `district_access_grants` and `platform_audit_events` exist. Some district, actor and target IDs are application-level references rather than declared database relations.
- Emergency records include incidents, assessments, response actions, helping societies, evidence metadata and numbered situation reports.
- Notifications and information requests have their own records; originals/files remain outside PostgreSQL. S3/local storage keys live in metadata.
- SarvoAI has monthly spending, reservation and hold models. This is an application spending ledger, not a replacement for AWS billing.
- Consent/retention policy decisions are not represented by a dedicated consent model and still need organisational agreement before production.

## 6. Authentication, API and files

The versioned API serves both clients at `/api/v1`. Deployed TEST uses `AUTH_PROVIDER=cognito`: clients send Cognito tokens, and the API verifies them and reads current account status, roles, assignments and temporary grants from the database. UI visibility is not the authorisation boundary. Local development can use `AUTH_PROVIDER=local`; see [Cognito and local identity setup](docs/cognito-setup.md).

```mermaid
sequenceDiagram
    actor User
    participant Client as Flutter or dashboard
    participant Cognito
    participant API as API Gateway / NestJS Lambda
    participant DB as PostgreSQL
    User->>Client: Sign in
    Client->>Cognito: Authenticate
    Cognito-->>Client: Tokens
    Client->>API: Request with token
    API->>API: Verify token
    API->>DB: Load current account and scope
    alt Refused
        API-->>Client: 401 / 403 / scoped 404
    else Authorised
        API->>DB: Read or write scoped records
        DB-->>API: Result
        API-->>Client: Response
    end
```

| Area | Representative routes (under `/api/v1`) |
| --- | --- |
| Health | `GET /health` |
| Society records | `GET /societies`, `GET /societies/:id`, record-specific routes under `/societies/:id` |
| Staff identity | `/identity/*`; HQ account management, assignments and scoped access |
| National/scoped programmes | `GET /national/programmes` (HQ), `GET /programmes` (DM/DDM/SPC) |
| Documents | `GET/POST /documents`, `GET /documents/:id/download`, `POST /documents/:id/complete` |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` |
| Emergency response | `GET/POST /emergencies/incidents`, `POST /emergencies/incidents/:id/assessments`, `POST /emergencies/incidents/:id/close` |
| HQ response coordination | Incident actions, reminders and situation reports under `/emergencies/*` |
| SarvoAI | `POST /assistant/questions` (HQ only) |

Controllers and shared contracts define exact inputs, role guards and response formats; this table is not a complete API specification. V5 disaster routes supersede the older `/assessments/sync` and `/situation-reports/sync` flow previously described here. Stable mutation IDs support retry-safe operations where implemented; that does not establish durable offline support on the phone.

The API stores recipient-scoped **in-app notifications** and read state. FCM/APNs push delivery and SQS background processing are not shown as deployed services. For documents/evidence, clients request an authorised signed link, upload to private storage, then confirm completion with the API before the file is treated as uploaded.

## 7. Local development

### Requirements

- Node.js **24**, npm and optionally NVM (`.nvmrc` pins Node).
- Flutter **3.47.6** to match current CI, plus Android SDK or Xcode for the chosen target.
- Docker with Compose for a local PostgreSQL/API setup. Docker is not needed merely to use the deployed TEST app/dashboard.

```bash
git clone https://github.com/sarvodaya-connect/sarvodaya-connect.git
cd sarvodaya-connect
nvm use
cp .env.example .env
```

### API and local PostgreSQL

In the root `.env`, set `DATABASE_URL` to match your local Docker credentials. The Docker example uses:

```dotenv
NODE_ENV=development
AUTH_PROVIDER=local
DATABASE_URL=postgresql://sarvodaya_dev:change_me_dev_only@localhost:5432/sarvodaya_connect
```

Replace placeholder signing secrets and configure a private `NIC_ENCRYPTION_KEY` if exercising NIC storage/reveal. Do not commit the resulting files. Local seed data is fictional.

```bash
cd infrastructure/docker
cp .env.example .env
docker compose up -d

cd ../../apps/api
npm ci
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

`npm ci` generates the Prisma client through `postinstall`. Check `http://localhost:3001/api/v1/health`. For a fresh database requiring a real local HQ account, use `npm run identity:bootstrap` with the private `BOOTSTRAP_HQ_*` environment settings described in [the identity guide](docs/cognito-setup.md); never reuse TEST/production credentials in local seed scripts.

### Staff dashboard

From a second terminal at the repository root:

```bash
cd apps/dashboard
npm ci
```

Create the ignored `apps/dashboard/.env.local`:

```dotenv
API_BASE_URL=http://localhost:3001/api/v1
AUTH_PROVIDER=local
PLATFORM_DEMO_MODE=false
```

Run `npm run dev` and open `http://localhost:3000`. **`API_BASE_URL` is the server-side dashboard setting**; the root example's `NEXT_PUBLIC_API_BASE_URL` does not replace it. For the explicit fictional dashboard preview, use `PLATFORM_DEMO_MODE=true` in development; production does not enable that adapter.

### Mobile

From another terminal at the repository root:

```bash
cd apps/mobile
flutter pub get
flutter devices
```

Run the default debug demonstration with `flutter run -d DEVICE_ID`. For the local API/local accounts, use:

```bash
flutter run -d DEVICE_ID \
  --dart-define=SC_DEMO_MODE=false \
  --dart-define=AUTH_PROVIDER=local \
  --dart-define=API_BASE_URL=http://localhost:3001/api/v1
```

`localhost` works for an iOS simulator on the Mac hosting the API. Android emulators generally use `10.0.2.2`; physical devices need a reachable host address or a configured development tunnel. For HTTPS TEST/Cognito builds use the values and instructions in [mobile releases](docs/mobile-release.md) and [Cognito setup](docs/cognito-setup.md). Never put AWS keys or a Cognito client secret into the app.

Sinhala/Tamil drafts are offered in debug builds. Review-only deployed dashboard builds use `SHOW_UNREVIEWED_TRANSLATIONS=true`; review-only mobile releases use `--dart-define=SC_SHOW_UNREVIEWED_TRANSLATIONS=true`. Production/release builds otherwise offer reviewed languages only. See [localization status and review](docs/localization.md).

The [landing site guide](apps/landing/README.md) covers its separate development server and dashboard-link configuration.

## 8. Checks and CI

Run checks from the relevant app/package directory:

| Directory | Commands |
| --- | --- |
| `apps/api` | `npm ci`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run test:db`, `npm run build` |
| `apps/dashboard` | `npm ci`, `npm run lint`, `npm test`, `npm run build` |
| `apps/mobile` | `flutter pub get`, `flutter analyze`, `flutter test` |
| `packages/api-contracts` | `npm ci`, `npm run check`, `npm test`, `npm run build` |

API database tests require a **disposable local/test PostgreSQL database** with migrations applied. Do not aim them at shared RDS or production. The `.github/workflows` files are authoritative for triggers, pinned tool versions and exact checks. They cover Node applications/contracts, Flutter, and AWS template/packaged-Lambda readiness. Path filters and PR target branches determine which checks run; a successful Cloudflare preview alone does not validate the API/mobile changes.

Automated checks do not establish real device behaviour, live IAM/network correctness, recovery readiness or store approval. Record actual manual checks separately. No application tests were run as part of this documentation-only refresh.

## 9. Deployment and mobile releases

| Component | Delivery |
| --- | --- |
| Public site | Cloudflare Pages build, with a link to the staff dashboard |
| Staff dashboard | Amplify build from GitHub; runtime configuration must be exported during the build as documented in `amplify.yml` |
| API | Reviewed Lambda/SAM package and AWS deployment; source merge alone is not proof of deployment |
| Database | Reviewed Prisma migrations applied separately to the intended database, with backup/recovery planning |
| Android | Signed app bundle (`.aab`), Google Play App Signing and internal testing; first owner-confirmed release was 0.1.0/build 1 on 10 November 2026 |
| iOS | Simulator testing works; physical-device signing/TestFlight needs the appropriate Apple team, certificates and release setup |
| GitHub → Play | Planned manual release workflow using scoped Google Play permissions and OIDC; no committed publishing workflow as of this update |

The Android package is `org.sarvodayaconnect.sarvodaya_connect_mobile`; the iOS bundle ID is `org.sarvodayaconnect.sarvodayaConnectMobile`. Keep upload keys, keystore passwords, Apple credentials and local `key.properties` out of Git. Back up release signing material under Sarvodaya's ownership. Increase build numbers for subsequent store uploads.

Operational references: [AWS configuration](docs/aws-configuration.md), [TEST environment plan](docs/aws-test-environment.md), [infrastructure runbook](infrastructure/aws/test/README.md), [recovery history](infrastructure/aws/test/RECOVERY.md), [Cognito setup](docs/cognito-setup.md), [mobile release guide](docs/mobile-release.md). These include dated provisioning/recovery notes; a historical failed attempt is not a current live stack status report. Check the actual account before executing infrastructure or recovery commands.

## 10. Security and contributing

- Use fictional data in development and TEST. Production use requires Sarvodaya's review of privacy, retention/deletion, backup/recovery and operational access.
- Cognito credentials authenticate users; current roles and scope stay in the application database. Account disablement, changed permissions and expired/revoked district grants must be enforced server-side.
- Local-development passwords are hashed. Deployed Cognito passwords are managed by Cognito; HQ can set replacements but cannot retrieve existing passwords.
- NICs are encrypted and masked in ordinary responses; reveal requires scoped permission and an audit event. Preserve the encryption key separately when planning restores.
- Scope document access independently of record visibility. Keep buckets private and use short-lived authorised links.
- Never commit credentials, personal data, `.env` files, signing keys or generated secrets. Do not include them in screenshots, logs or GitHub issues.
- RDS storage and backups still incur charges when the DB is stopped. Stopping a database is temporary and does not shut down the rest of AWS.

Developed by **Group CS-10 / STAMPx** for Sarvodaya. Work is tracked through GitHub issues/PRs and Jira where applicable. Branch from current `main`, reference the issue, run the relevant checks, describe migrations/configuration and request review before merging. Keep large tasks in focused PRs; use `Refs #issue` for partial work rather than closing an unfinished issue.

See [CONTRIBUTING.md](CONTRIBUTING.md), [V5 coverage](docs/v5-coverage.md), and [localization guidance](docs/localization.md). The [V4 foundation guide](docs/platform-v4-foundation.md) remains available as historical design context.
