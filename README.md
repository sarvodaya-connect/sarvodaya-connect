# Sarvodaya Connect

<p align="center">
  <img src="docs/assets/brand/sarvodaya-connect-logo.jpg" alt="Sarvodaya Connect" height="104" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/assets/brand/stampx-logo.png" alt="STAMPx" height="104" />
</p>

<p align="center">A digital platform for managing village societies and their records, developed for Sarvodaya by the STAMPx university project team.</p>

## Table of Contents

1. [Overview](#1-overview)
2. [System architecture](#2-system-architecture)
3. [Core modules, personas and user roles](#3-core-modules-personas-and-user-roles)
4. [Repository map](#4-repository-map)
5. [Technology stack](#5-technology-stack)
6. [Database design](#6-database-design)
7. [API and notification flows](#7-api-and-notification-flows)
8. [Requirements and local setup](#8-requirements-and-local-setup)
9. [Testing strategy](#9-testing-strategy)
10. [Demo access and data](#10-demo-access-and-data)
11. [Deployment status](#11-deployment-status)
12. [Security and privacy](#12-security-and-privacy)
13. [Role-based permissions](#13-role-based-permissions)
14. [Team and contributing](#14-team-and-contributing)

---

The repository contains three applications:

- **Mobile app** — Flutter app for society officers and regional staff.
- **Dashboard** — Next.js web app for national, district and platform administration.
- **API** — NestJS service backed by PostgreSQL for society registry, membership, documents and notifications.

## 1. Overview

### The need

Sarvodaya Connect is intended to give village societies and authorised Sarvodaya staff a shared digital place to maintain society records, submit documents and follow review work across society, district and national levels. The expected value is less uncertainty about records and submissions, clearer follow-up, and more consistent information for planning. These outcomes need to be validated with Sarvodaya users; no unsupported impact statistics are claimed here.

### Current status

The project is under active development. The API has a local PostgreSQL setup, Prisma schema and fictional seed data. Most mobile and dashboard views still use demonstration data; emergency-response workflows are connected to the API and PostgreSQL on mobile (M22–M25) and dashboard (D14a/D14/D14c/D14d). Demo sign-in and role switching are for development only. Production identity, cloud deployment and production data are not configured in this repository.

Documents use local storage during development by default. The API also contains an Amazon S3 storage adapter for a future configured environment. Do not use real Sarvodaya data or credentials in the local demo.

## 2. System architecture

### Current development setup

The local development stack has a Flutter mobile client, a Next.js dashboard, a NestJS REST API and PostgreSQL. The clients are still being connected feature by feature; most views continue to use fictional demonstration data.

```mermaid
flowchart LR
    subgraph Clients[User channels]
        Mobile[Flutter mobile app]
        Dashboard[Next.js 15 administration dashboard]
    end

    subgraph Local[Local development services]
        API[NestJS REST API]
        DB[(PostgreSQL via Prisma)]
        Files[Local document storage]
    end

    Mobile -. "API-backed workflows as connected" .-> API
    Dashboard -. "API-backed workflows as connected" .-> API
    API --> DB
    API --> Files
```

### Proposed cloud architecture — AWS Singapore

This is the team's proposed target architecture for review with Sarvodaya IT and the project supervisor. It is not deployed. The diagram describes the planned components, environment separation and data flows; production setup remains subject to approval and security review.

```mermaid
flowchart TB
    subgraph Users[1. Users and client applications]
        Society[Society members] --> Mobile[Flutter mobile app<br/>iOS and Android]
        Staff[Sarvodaya staff] --> Browser[Web browser<br/>Next.js administration dashboard]
    end

    subgraph Entry[2. Edge delivery and identity]
        Cognito[Amazon Cognito<br/>OIDC and user groups]
        Cloudflare[Cloudflare<br/>DNS, TLS and WAF]
        Amplify[AWS Amplify Hosting<br/>Next.js 15 dashboard]
    end
    Mobile -->|Sign-in| Cognito
    Browser -->|Sign-in| Cognito
    Mobile -->|HTTPS API requests| Cloudflare
    Browser -->|Dashboard HTTPS| Cloudflare
    Cloudflare -->|Dashboard origin| Amplify

    subgraph AWS[3. AWS account — Singapore region, ap-southeast-1]
        subgraph Prod[Production — live user data]
            ALB[Application Load Balancer<br/>public subnets, Multi-AZ]
            ECR[Amazon ECR<br/>API container images]
            API[Amazon ECS on Fargate<br/>NestJS API in private app subnets]
            DB[(Amazon Aurora PostgreSQL<br/>private isolated subnets, Multi-AZ<br/>30-day point-in-time recovery)]
            S3[(Amazon S3<br/>private production documents)]
            OAC[CloudFront Origin Access Control]
            CDN[Amazon CloudFront<br/>protected document downloads]
        end

        subgraph Staging[Staging — test-only fictional data]
            StageIngress[Staging ingress]
            StageAPI[Small staging API<br/>separate service and secrets]
            StageS3[(Separate staging<br/>document storage)]
            StageDB[(Separate staging database<br/>fictional data)]
            StageIngress --> StageAPI
            StageAPI --> StageS3
            StageAPI --> StageDB
        end

        subgraph Ops[4. Security, monitoring and operations]
            CloudTrail[AWS CloudTrail<br/>account activity audit]
            CloudWatch[Amazon CloudWatch<br/>logs, metrics and alarms]
            SES[Amazon SES<br/>email notifications]
            KMS[AWS KMS<br/>encryption keys]
            Secrets[AWS Secrets Manager<br/>runtime secrets]
            CloudTrail --> CloudWatch
            API --> CloudWatch
            API --> SES
            KMS -. encrypts .-> DB
            KMS -. encrypts .-> S3
            KMS -. encrypts .-> Secrets
            Secrets --> API
        end
    end

    Cloudflare -->|API origin over HTTPS| ALB
    ALB --> API
    ECR -->|Deploy approved image| API
    API -->|Prisma over TLS| DB
    API -->|Short-lived upload URL| Mobile
    Mobile -->|Direct upload with short-lived URL| S3
    S3 -->|Origin access control| OAC
    OAC --> CDN
    Mobile -->|Protected download| CDN
    Browser -->|Protected download| CDN
    Cognito -. JWT issuer and claims .-> API
    Cognito -. restricted staging access .-> StageAPI

    subgraph Delivery[5. Source control and delivery]
        GitHub[GitHub repository]
        Actions[GitHub Actions<br/>CI, tests and OIDC]
        Approval[Approved production deployment]
        Promote[Promote approved changes]
        GitHub --> Actions
        Actions -->|Deploy frontend| Amplify
        Actions -->|Build and push API image| ECR
        Actions -->|Approved deployment| Approval
        Approval -->|Deploy approved image| API
        Actions -->|Promote approved changes| Promote
        Promote -->|Update staging| StageAPI
    end

    Sentry[Sentry<br/>external error monitoring]
    MapTiler[MapTiler<br/>external map tiles]
    API -. error monitoring .-> Sentry
    Mobile -. external map tiles .-> MapTiler
    Browser -. external map tiles .-> MapTiler
```

Production and staging are separate environments: staging uses fictional test data, its own API configuration, secrets, database and document storage; production holds live data. Access to staging is restricted. The API runs privately behind the load balancer, the production database is isolated, and document uploads use short-lived URLs with protected downloads through CloudFront. GitHub Actions uses OIDC for deployment rather than long-lived AWS access keys. MapTiler and Sentry are external services; map tiles are only needed for interactive map features.

## 3. Core modules, personas and user roles

| Persona / role | Main goal | Current pain point to validate | Intended app value |
| --- | --- | --- | --- |
| Society Officer | Maintain their society's profile, council and membership information; submit documents and activity updates; follow status and reminders. | Repeated follow-ups and uncertainty about what is due, received or returned. | One place to update records and see the next action or correction. |
| District Manager | Review and support societies within an assigned district; follow submissions and compliance needs. | Hard to see which societies need a review or practical support. | District-scoped overview and clearer review queues. |
| HQ / National Administrator | View the national registry and approved cross-district information; oversee national workflows. | Difficult to build a consistent national picture from distributed records. | Aggregated, role-appropriate information for coordination and planning. |
| System Administrator | Manage technical access and platform configuration, separate from routine society-record work. | Risk of overly broad technical access to operational records. | Maintain the platform with separation between technical and society-data access. |

These are working personas based on catalogue roles, not findings from completed user research. Validate goals and pain points with society officers and Sarvodaya staff. The role scopes and business rules are provisional. The dashboard's role selector is a demonstration feature, and production identity and permissions must be confirmed with Sarvodaya and enforced by the API. Feature-level progress is documented in the [mobile guide](apps/mobile/README.md), [dashboard guide](apps/dashboard/README.md) and [API guide](apps/api/README.md).

---

## 4. Repository map

```text
apps/
  api/          NestJS API and Prisma database schema
  dashboard/    Next.js administration dashboard
  mobile/       Flutter iOS and Android app
packages/
  api-contracts/ Shared TypeScript API contracts
infrastructure/
  docker/       Local PostgreSQL using Docker Compose
docs/           Project design and technical documentation
```

Each application has a detailed guide: [API](apps/api/README.md), [dashboard](apps/dashboard/README.md), [mobile](apps/mobile/README.md), and [local PostgreSQL](infrastructure/docker/README.md).

## 5. Technology stack

| Technology | Purpose |
| --- | --- |
| Flutter and Dart | iOS and Android mobile app |
| Next.js 15, React and TypeScript | Administration dashboard (pinned to the Next.js major version supported by AWS Amplify Hosting) |
| NestJS and TypeScript | REST API and application services |
| PostgreSQL and Prisma ORM | Relational database and schema/migrations |
| Docker Compose | Local PostgreSQL development environment |
| GitHub Actions | Pull-request checks for mobile, API, dashboard and shared contracts |

## 6. Database design

The API uses PostgreSQL with Prisma. This ERD documents the models currently defined in [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma); it is a view of the implemented schema, not a separate or proposed database. Society statuses, document types and some access rules remain provisional and must be confirmed with Sarvodaya.

```mermaid
erDiagram
    DISTRICT {
        uuid id PK
        varchar code UK
        varchar name_en UK
        timestamptz created_at
        timestamptz updated_at
    }

    SOCIETY {
        uuid id PK
        varchar society_code UK
        varchar name_en
        varchar name_local
        uuid district_id FK
        varchar ds_division
        varchar gn_division
        varchar village
        varchar address_line
        float latitude
        float longitude
        date established_on
        enum status
        timestamptz created_at
        timestamptz updated_at
    }

    SOCIETY_CONTACT {
        uuid id PK
        uuid society_id FK
        varchar label
        varchar full_name
        varchar position
        varchar phone
        varchar email
        boolean is_primary
        timestamptz created_at
        timestamptz updated_at
    }

    SOCIETY_COUNCIL_MEMBER {
        uuid id PK
        uuid society_id FK
        int seat_number
        varchar full_name
        varchar position
        enum seat_type
        varchar phone
        varchar email
        int age
        date appointed_on
        date ended_on
        boolean is_active
        boolean is_primary_contact
        timestamptz created_at
        timestamptz updated_at
    }

    SOCIETY_MEMBERSHIP_COUNT {
        uuid id PK
        uuid society_id FK
        int year
        enum category
        int female
        int male
        timestamptz created_at
        timestamptz updated_at
    }

    EMERGENCY_INCIDENT {
        uuid id PK
        uuid district_id FK
        enum type
        enum severity
        enum status
        varchar title
        varchar location
        timestamptz activated_at
        varchar created_by_id
    }

    EMERGENCY_ASSESSMENT {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK
        uuid client_mutation_id
        int revision
        enum status
        int people_affected
        int households_affected
        int displaced_people
        varchar urgent_needs
        varchar created_by_id
    }

    EMERGENCY_RESPONSE_ACTION {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK
        uuid client_mutation_id
        varchar title
        enum status
        timestamptz due_at
        varchar created_by_id
    }

    EMERGENCY_SITUATION_REPORT {
        uuid id PK
        uuid incident_id FK
        uuid society_id FK
        uuid client_mutation_id
        int revision
        enum status
        varchar summary
        varchar needs
        varchar created_by_id
    }

    SOCIETY_DOCUMENT {
        uuid id PK
        uuid society_id FK
        enum document_type
        varchar title
        varchar file_name
        varchar content_type
        int size_bytes
        varchar storage_key UK
        enum status
        enum access_level
        int version
        varchar uploaded_by_id
        varchar uploaded_by_name
        timestamptz uploaded_at
        timestamptz created_at
        timestamptz updated_at
    }

    NOTIFICATION {
        uuid id PK
        varchar recipient_user_id
        enum category
        varchar title
        varchar body
        varchar link_path
        uuid society_id FK
        uuid document_id FK
        timestamptz read_at
        timestamptz created_at
    }

    DISTRICT ||--o{ SOCIETY : contains
    DISTRICT ||--o{ EMERGENCY_INCIDENT : covers
    EMERGENCY_INCIDENT ||--o{ EMERGENCY_ASSESSMENT : collects
    SOCIETY ||--o{ EMERGENCY_ASSESSMENT : submits
    EMERGENCY_INCIDENT ||--o{ EMERGENCY_RESPONSE_ACTION : coordinates
    SOCIETY o|--o{ EMERGENCY_RESPONSE_ACTION : scopes
    EMERGENCY_INCIDENT ||--o{ EMERGENCY_SITUATION_REPORT : receives
    SOCIETY o|--o{ EMERGENCY_SITUATION_REPORT : submits
    SOCIETY ||--o{ SOCIETY_CONTACT : has
    SOCIETY ||--o{ SOCIETY_COUNCIL_MEMBER : has
    SOCIETY ||--o{ SOCIETY_MEMBERSHIP_COUNT : records
    SOCIETY ||--o{ SOCIETY_DOCUMENT : stores_metadata_for
    SOCIETY o|--o{ NOTIFICATION : relates_to
    SOCIETY_DOCUMENT o|--o{ NOTIFICATION : relates_to
```

### Data-model notes

- A district contains societies. Society contacts, council members, annual membership counts and document metadata belong to a society.
- Membership is stored as annual counts by category and gender; individual membership records are not currently modeled.
- Uploaded document files are stored outside PostgreSQL (local storage in development); the database stores metadata and a storage key.
- User identities are provided by the authentication layer. `recipient_user_id`, `uploaded_by_id` and `uploaded_by_name` are identifiers/snapshots, not foreign keys to a local users table.
- The schema currently does not define consent records or a general-purpose audit log. Those requirements need to be agreed before real personal data is used in production.

### Key constraints and indexes

| Table | Constraint / index | Purpose |
| --- | --- | --- |
| `districts` | Unique `code`, unique `name_en` | Prevent duplicate district identifiers and names |
| `societies` | Unique `society_code`; indexes on `district_id`, `status` and `name_en` | Identify societies and support district/status/name queries |
| `society_council_members` | Unique (`society_id`, `seat_number`); index on (`society_id`, `is_active`) | Prevent duplicate seats and query current council members |
| `society_membership_counts` | Unique (`society_id`, `year`, `category`); index on (`year`, `society_id`) | One annual count per society/category and reporting by year |
| `society_documents` | Unique `storage_key`; unique (`society_id`, `document_type`, `title`, `version`); indexes on (`society_id`, `document_type`) and `status` | Locate stored files and retrieve/filter document records |
| `notifications` | Indexes on (`recipient_user_id`, `created_at`) and (`recipient_user_id`, `read_at`) | Load a recipient's notification feed and unread items |
| Emergency assessment, action and situation report tables | Unique creator/client-mutation IDs and incident/status/time indexes | Support retry-safe mobile sync and scoped emergency workflows |

These constraints and indexes are defined by Prisma and its migrations. Update this diagram when the schema changes; do not treat it as a substitute for migrations or the Prisma schema.

## 7. API and notification flows

### API request lifecycle

The same versioned NestJS API is intended to serve both clients. Authenticated routes use development-only demo identities today; the production identity provider is not connected.

```mermaid
sequenceDiagram
    actor User
    participant Client as Flutter app or Next.js dashboard
    participant API as NestJS API /api/v1
    participant Guard as Access checks
    participant Service as Feature service
    participant Prisma
    participant DB as PostgreSQL

    User->>Client: View or update an authorised record
    Client->>API: API request (HTTPS in deployed environments)
    API->>Guard: Authenticate and check role and data scope
    alt Unauthenticated or outside permitted scope
        Guard-->>Client: 401 or 403 response
    else Authorised
        Guard-->>API: Authenticated principal
        API->>Service: Validate and process request
        Service->>Prisma: Read or write scoped data
        Prisma->>DB: SQL query
        DB-->>Prisma: Result
        Prisma-->>Service: Database result
        Service-->>API: Response data
        API-->>Client: JSON response
    end
```

Representative API areas include health checks, districts, society profiles, council and membership data, documents, and notifications. See the [API guide](apps/api/README.md) for current endpoints, request examples, and provisional access rules.

Emergency response uses `GET /api/v1/emergencies/incidents`, `GET /api/v1/emergencies/incidents/:id`, `POST /api/v1/emergencies/incidents`, `POST /api/v1/emergencies/assessments/sync`, `POST /api/v1/emergencies/actions`, `POST /api/v1/emergencies/situation-reports/sync`, and incident/action status `PATCH` routes. Offline assessment retries retain a stable `clientMutationId`; revision conflicts return `409` and leave the queued assessment on the device. The mobile queue persists fictional demo assessments across app restarts. Do not enter real incident or personal information in this local demo; encrypting queued device data and connecting Cognito are production prerequisites.

| Area | Representative routes | Purpose |
| --- | --- | --- |
| Health | `GET /api/v1/health` | Check API availability |
| Registry | `GET /api/v1/districts`, `GET /api/v1/societies`, `GET /api/v1/societies/:id` | Read district and society records |
| Society records | `PATCH/PUT /api/v1/societies/:id/profile`, `PUT .../:id/council`, `PUT .../:id/membership` | Update permitted society details and snapshots |
| Documents | `GET/POST /api/v1/documents`, `GET .../:id/download` | List, submit and access authorised document records |
| Notifications | `GET /api/v1/notifications`, `POST .../:id/read`, `POST .../read-all` | Load and update the signed-in user's notifications |

### Notification flow

```mermaid
flowchart LR
    Workflow[Workflow update or reminder] --> API[NestJS notification API]
    API --> Record[(PostgreSQL notification record)]
    Record --> Read[Authorised client loads its feed]
    Read --> User[Mobile app or dashboard]
    User -->|Mark read| API
    API -->|Set read_at| Record
```

The API persists recipient-scoped notifications and read state. Dashboard screens also have demonstration notifications; push delivery and complete production notification preferences are not configured yet.

---

## 8. Requirements and local setup

- Node.js **24** and npm (the repository pins Node with `.nvmrc`; NVM users can run `nvm use` from the repository root)
- Flutter stable SDK
- Docker Desktop with Docker Compose for local PostgreSQL and API-backed development
- Android Studio and Android SDK for Android emulator testing
- Xcode for iOS simulator/device builds (macOS only)

### Quick start

#### 1. Get the project

```bash
git clone https://github.com/sarvodaya-connect/sarvodaya-connect.git
cd sarvodaya-connect
nvm use
```

#### 2. Start the local database and API

Create the root environment file and set its `DATABASE_URL` to match the local PostgreSQL credentials below:

```bash
cp .env.example .env
```

The development defaults are:

```text
DATABASE_URL=postgresql://sarvodaya_dev:change_me_dev_only@localhost:5432/sarvodaya_connect
```

Start PostgreSQL, then install the API dependencies, apply migrations, seed fictional records and start the API:

```bash
cd infrastructure/docker
cp .env.example .env
docker compose up -d
docker compose ps

cd ../../apps/api
npm ci
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

The API listens on `http://localhost:3001`. Check its health endpoint from another terminal:

```bash
curl http://localhost:3001/api/v1/health
```

#### 3. Run the dashboard

Open a separate terminal at the repository root (`sarvodaya-connect`), then run:

```bash
cd apps/dashboard
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard currently uses fictional demonstration data for its screens; setting `NEXT_PUBLIC_API_BASE_URL` does not mean every view is connected to live API data.

#### 4. Run the mobile app

Open another terminal at the repository root, then run:

```bash
cd apps/mobile
flutter pub get
flutter devices
flutter run -d DEVICE_ID
```

Replace `DEVICE_ID` with an identifier listed by `flutter devices`. The mobile demonstration currently uses fictional data and local app state.

## 9. Testing strategy

The pull-request workflows run checks for the shared API contracts, NestJS API, Next.js dashboard and Flutter mobile app. API CI uses a temporary PostgreSQL service to apply migrations and run database tests; it does not use a shared or production database.

| Area | Checks |
| --- | --- |
| Shared API contracts | Type check, unit tests, build and production dependency audit |
| NestJS API | Lint, unit tests, HTTP end-to-end tests, Prisma validation, migration consistency, database tests, build and dependency audit |
| Next.js dashboard | Lint, component tests, production build and dependency audit |
| Flutter mobile app | Static analysis and Flutter tests |

Run checks from the relevant application directory:

API (`apps/api`):

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

Dashboard (`apps/dashboard`):

```bash
npm run lint
npm test
npm run build
```

Mobile (`apps/mobile`):

```bash
flutter analyze
flutter test
```

Shared API contracts (`packages/api-contracts`):

```bash
npm run check
npm test
npm run build
```

Run each set from its application/package directory. GitHub Actions runs the relevant checks for pull requests.

## 10. Demo access and data

The mobile app provides a fictional demo account and a role preview for Society Officer, District Manager and HQ Administrator flows. API endpoints that require a user accept the development-only `X-Demo-User` header. For example:

```bash
curl -H "X-Demo-User: demo-dm-north" http://localhost:3001/api/v1/documents
```

These demo identities are not production authentication. Cognito integration and production authorization must be completed before any real users or data are used. See the [API guide](apps/api/README.md) for available demo identities and API setup details.

## 11. Deployment status

The API, dashboard and mobile app are currently used for local development and demonstration. No production AWS environment is configured by this repository. The cloud diagram above is a proposed direction only; account setup, staging/production separation, security review, backups, monitoring and a cost estimate must be approved before deployment. See [infrastructure/docker](infrastructure/docker/README.md) for the local PostgreSQL environment.

## 12. Security and privacy

- Never commit `.env` files, passwords, access tokens, AWS credentials, private keys or real client data.
- Use only fictional data in local development and demonstrations.
- Do not deploy the demo authentication or demo identities to production.
- Production infrastructure and security controls require review and configuration by Sarvodaya IT before launch.

Additional production decisions still needed include a confirmed privacy notice and consent approach, data retention and deletion rules, audit logging for sensitive/admin actions, and review of any external data sharing. The current project does not model consent records or a general-purpose audit log. Do not use real member or society personal information in local demos.

## 13. Role-based permissions

The table below records the current intended access boundaries for the three operational roles, plus the separate system-administration persona. These rules are provisional and need confirmation from Sarvodaya before production use. “Read” and “write” are also data-scoped: a role must not gain access to records outside its assigned society or district just because it has the general capability.

| Role | Data scope and read access | Create / update | Review / approve | Platform administration |
| --- | --- | --- | --- | --- |
| Society Officer | Their assigned society, its membership summaries, standard documents and notifications. Cannot open the restricted signed members list. | Update their assigned society profile, council and membership counts; upload and submit documents for that society. | No reviewer permission. | No. |
| District Manager | Societies and membership summaries in assigned districts; may read district documents including signed members lists. | May upload documents within their district. Cannot update society profile, council or membership through the current API. | The shared permission contract includes `SUBMISSION_REVIEW`, but review/approval API actions are not yet implemented. | No. |
| HQ Administrator | All districts and societies, including restricted signed members lists. | Update any society profile, council and membership counts; upload documents within scope. | Intended to review across districts; review/approval API actions are not yet implemented. | The shared permission contract currently maps `PLATFORM_ADMIN` to `HQ_ADMIN`; confirm whether technical administration should instead be a separate role. |
| System Administrator | No society-record access is defined. | No operational data changes are defined. | No. | A technical-administration persona is described, but `SYSTEM_ADMIN` is not currently an API role and its exact permissions are not implemented. |

### Enforcement status

- The API has shared role capabilities for `SOCIETY_OFFICER`, `DISTRICT_MANAGER` and `HQ_ADMIN`, with record scope supplied by assigned society and district IDs. Document access rules are enforced in the API, including the signed-members-list restriction.
- Society Officers and HQ Administrators are allowed by the current API routes to update society profiles, council and membership; District Managers are not. Document upload is allowed for societies within a user's accessible scope.
- The `SUBMISSION_REVIEW` capability exists in the shared contract, but there is not yet an API endpoint that performs a review or approval. Do not treat a displayed demo action as a real approval.
- Authentication still uses fictional development/test identities. Some registry read routes are not yet guarded by authentication, and dashboard role switching is a demonstration feature. This matrix is therefore a documented target and partial implementation—not a claim that all production access controls are complete.

See the [API guide](apps/api/README.md#access-rules-provisional) for current document-scoping behavior and the [dashboard guide](apps/dashboard/README.md#provisional-role-based-visibility) for demonstration visibility. Confirm the final role names, scopes, restricted data and approval authority with Sarvodaya before connecting production identity or real data.

---

## 14. Team and contributing

Sarvodaya Connect is developed by **Group CS-10** as a STAMPx university project for Sarvodaya. Work is tracked in Jira. Create a feature branch for the assigned work item, run the checks for the affected app, and open a pull request for review before merging. See [CONTRIBUTING.md](CONTRIBUTING.md) for the team workflow.
