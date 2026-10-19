# Sarvodaya Connect API

The NestJS backend API for the Sarvodaya Connect platform.

The API will be shared by the Flutter mobile application and the Next.js administrative dashboard.

## Technology

- Node.js 24 LTS
- NestJS
- TypeScript
- Express
- PostgreSQL 17
- Prisma ORM
- Vitest
- Oxlint

## Requirements

- Node.js 24
- npm 11
- nvm is recommended

## Initial setup

From the repository root, select the project Node.js version:

```bash
nvm use
```

On Windows, `nvm use` does not read the project version file. Check `node --version` instead; it must start with `v24`.

Create your private local environment file:

```bash
cp .env.example .env
```

Never commit the `.env` file because it may contain local credentials.

Install the API dependencies:

```bash
cd apps/api
npm ci
```

## Run the API

Start the API in development mode:

```bash
npm run start:dev
```

The development server watches the source files and restarts automatically when code changes.

By default, the API runs at:

```text
http://localhost:3001
```

## Health endpoint

Check whether the API is running:

```bash
curl http://localhost:3001/api/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "sarvodaya-connect-api"
}
```

## Environment variables

The API loads environment variables from the `.env` file at the repository root.

| Variable | Purpose | Default |
|---|---|---|
| `NODE_ENV` | Application environment | `development` |
| `API_PORT` | Port used by the NestJS API | `3001` |
| `DATABASE_URL` | PostgreSQL connection URL used by Prisma | No runtime default |

Use `.env.example` as the safe configuration template. Do not place passwords, tokens, private keys or real client information in committed files.

## Local database and fictional data

Follow these steps in order. They assume Docker Desktop is running and `npm ci` (or `npm install`) has been completed in `apps/api`.

**Step 1: Start PostgreSQL** (from `infrastructure/docker`)

```bash
cd infrastructure/docker
cp .env.example .env
docker compose up -d
docker compose ps
```

Wait until the `postgres` service is `healthy`. See `infrastructure/docker/README.md` for details.

**Step 2: Set `DATABASE_URL`** in the root `.env` (created from `.env.example`). The user, password, port and database name must match `infrastructure/docker/.env`. For the committed development defaults:

```text
DATABASE_URL=postgresql://sarvodaya_dev:change_me_dev_only@localhost:5432/sarvodaya_connect
```

**Step 3: Apply the migrations and seed the data** (from `apps/api`)

```bash
cd ../../apps/api
npm run prisma:deploy
npm run prisma:seed
```

The seed should finish with:

```text
SC-29 seed complete: 3 fictional districts, 6 fictional societies, 4 fictional contacts, 25 fictional council seats and 5 fictional membership categories.
```

The seed is repeatable: running it again does not create duplicate records.

**Step 4: Confirm the records exist**

```bash
cd ../../infrastructure/docker
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*) FROM societies;"'
```

The count should be `6`. Then check that Prisma and the migrations are in sync:

```bash
cd ../../apps/api
npx prisma migrate status
```

It should report `Database schema is up to date!`.

**Step 5: Confirm the API can read the data** (from `apps/api`)

Start the API:

```bash
npm run start:dev
```

Then, in a second terminal opened in the repository root, request the seeded records:

```bash
curl http://localhost:3001/api/v1/districts
curl "http://localhost:3001/api/v1/societies?page=1&pageSize=10"
curl http://localhost:3001/api/v1/societies/29000000-0000-4000-8000-000000000101
```

On Windows PowerShell, use `curl.exe` instead of `curl`.

Database failures return a safe service-unavailable response; connection strings and database error details are never returned to clients.

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `P1001: Can't reach database server` | PostgreSQL is not running or not healthy, or the host/port in `DATABASE_URL` is wrong | Run `docker compose ps` in `infrastructure/docker`; check `DATABASE_URL` in the root `.env` |
| `P1000: Authentication failed` | `DATABASE_URL` credentials differ from `infrastructure/docker/.env`, or the volume was created with older credentials | Make them match; if the credentials were changed after the first start, run `docker compose down -v` then `docker compose up -d` (deletes local data) |
| `Environment variable not found: DATABASE_URL` | The root `.env` is missing | Run `cp .env.example .env` in the repository root and set `DATABASE_URL` |
| `required variable POSTGRES_DB is missing` | `infrastructure/docker/.env` is missing | Copy `.env.example` to `.env` in that folder |
| `no configuration file provided: not found` | `docker compose` was run outside `infrastructure/docker` | `cd infrastructure/docker` first |
| Seed fails with relation or table errors | Migrations were not applied | Run `npm run prisma:deploy` first |
| `npm install` fails with `ECONNRESET` | The network dropped during download | Retry: `npm install --fetch-retries=5` |
| Start over with an empty database | Local data is corrupt or unwanted | `docker compose down -v`, `docker compose up -d`, then migrate and seed again |

## Available commands

Run these commands from `apps/api`.

| Command | Purpose |
|---|---|
| `npm run start:dev` | Start the API with automatic reloading |
| `npm run build` | Compile the TypeScript application |
| `npm run lint` | Check source and test code |
| `npm run format` | Format source and test code |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run HTTP end-to-end tests |
| `npm run test:db` | Run database tests against a local PostgreSQL (migrations applied) |
| `npm run test:cov` | Generate a test coverage report |

## Documents and notifications (SC-49)

Document metadata and notifications are stored in PostgreSQL (`society_documents` and `notifications`). The files themselves go to document storage through short-lived pre-signed URLs, so file bytes never pass through the documents service.

### Endpoints

All of these need a signed-in user (see **Provisional sign-in** below).

| Method and path | Purpose |
|---|---|
| `GET /api/v1/documents` | Uploaded documents the user may see. Filters: `societyId`, `districtId`, `documentType`, `status`, `page`, `pageSize` |
| `POST /api/v1/documents` | Record a new document's metadata (`societyId`, `documentType`, `title`, `fileName`, `contentType`, `sizeBytes`) and receive an `upload` URL |
| `PUT <upload.url>` | Upload the file, sending the `upload.headers` |
| `POST /api/v1/documents/:id/complete` | Confirm the upload; the document becomes `SUBMITTED` and the district's reviewers are notified |
| `GET /api/v1/documents/:id` | Metadata of one document |
| `GET /api/v1/documents/:id/download` | A short-lived download URL |
| `GET /api/v1/notifications` | The user's notifications with `unreadCount` (`unreadOnly`, `page`, `pageSize`) |
| `POST /api/v1/notifications/:id/read` and `POST /api/v1/notifications/read-all` | Mark notifications read |

Files must be PDF, JPG or PNG and at most 10 MB, matching the mobile app. A new upload with the same society, type and title becomes the next version.

### Access rules (provisional)

| User | Documents |
|---|---|
| Society Officer | Their own society. Cannot open the signed members list, even after uploading it |
| District Manager | Societies in their district, including signed members lists |
| HQ Administrator | Every society |

Documents outside a user's scope are reported as not found; a signed members list inside the scope returns `403 FORBIDDEN` for Society Officers. The rules live in `src/documents/document-access.policy.ts`, and PostgreSQL also enforces that members lists are always restricted.

### Provisional sign-in

Until Amazon Cognito is connected, requests choose one of the fictional users in `src/auth/demo-principals.ts` with the `X-Demo-User` header, for example:

```bash
curl -H "X-Demo-User: demo-dm-north" http://localhost:3001/api/v1/documents
```

| `X-Demo-User` | Role | Scope (SC-29 seed data) |
|---|---|---|
| `demo-officer-sunrise` | Society Officer | Example Sunrise Society |
| `demo-officer-lotus` | Society Officer | Example Lotus Society |
| `demo-dm-north` | District Manager | Fictional North District |
| `demo-dm-central` | District Manager | Fictional Central District |
| `demo-hq-admin` | HQ Administrator | All districts |

Demo sign-in is refused when `NODE_ENV=production`. The document and notification code only depends on the `Principal` type, so replacing the guard does not change it.

### Document storage

Business logic only uses the `DocumentStorage` interface in `src/storage/document-storage.ts`. Choose the driver with `STORAGE_DRIVER`:

| Variable | Purpose | Default |
|---|---|---|
| `STORAGE_DRIVER` | `local` (development) or `s3` | `local`; `s3` when `NODE_ENV=production` |
| `LOCAL_STORAGE_DIR` | Folder for uploaded files (ignored by Git) | `.local-storage` |
| `STORAGE_SIGNING_SECRET` | Secret that signs local upload and download links | Random on each start, so links stop working after a restart |
| `API_PUBLIC_URL` | Base URL used in local storage links | `http://localhost:<API_PORT>` |
| `STORAGE_URL_TTL_SECONDS` | How long upload and download links last (60 to 604800) | `900` |
| `S3_BUCKET`, `S3_REGION` | Amazon S3 bucket and region | Required for `s3` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | AWS credentials for signing S3 URLs | Required for `s3` |

- **local** stores files on disk and serves signed, expiring links at `/api/v1/storage/local/...` that behave like S3 pre-signed URLs. It is refused in production.
- **s3** signs S3 URLs with AWS Signature Version 4 (`src/storage/s3-presigner.ts`, checked against the example in the Amazon S3 documentation), so no AWS SDK is needed yet. The bucket should block public access and allow `PUT` and `GET` from the app and dashboard origins in its CORS rules.

### Database tests

`npm run test:db` checks that document, notification, society profile, council and membership data persists correctly in PostgreSQL, including role-scoped API reads and update rejection. It needs `DATABASE_URL` pointing at a local PostgreSQL with the migrations applied (`npm run prisma:deploy`), and only removes the records it creates. CI runs it against a throwaway PostgreSQL 17 service, after checking that the migrations match `schema.prisma`.

## Society registry, council and membership (SC-53)

The existing society registry endpoints continue to serve the dashboard and mobile profile reads. `SocietyDetails` now includes persisted council members and the latest available membership snapshot. Council records use 25 numbered seats, with 3 Children, 3 Youth, 3 Mothers, 9 Ordinary and 7 Elders Council positions. Membership snapshots store female and male counts for each of the five categories.

| Method and path | Purpose |
|---|---|
| `GET /api/v1/societies/membership?year=2026` | Membership summary, category and gender totals for societies in the signed-in user's scope |
| `PATCH` or `PUT /api/v1/societies/:id/profile` | Create or update permitted society name, address, GPS, establishment date and primary contact fields |
| `PUT /api/v1/societies/:id/council` | Replace the society's validated 25-seat council snapshot |
| `PUT /api/v1/societies/:id/membership` | Replace one year's five-category membership snapshot |

These operations use the existing society routes and demo identity guard. HQ Administrators can update any society; Society Officers can update only their assigned society. District Managers can read aggregates for their districts but cannot edit profiles. The API validates GPS bounds and paired coordinates, council seat distribution and membership category counts before writing. PostgreSQL constraints enforce unique seat numbers, unique annual category rows, valid years and nonnegative counts. The `SC-29` local seed retains its existing fictional societies and contacts and adds a fictional 25-member council and 2026 membership snapshot for Example Sunrise Society.

## API conventions

- All API routes begin with `/api/v1`.
- Request validation is enabled globally.
- Unexpected request properties are rejected.
- Controllers receive HTTP requests.
- Services contain application logic.
- Feature modules will be added as the platform is implemented.

## Verification before a pull request

Run:

```bash
npm run format
npm run lint
npm test
npm run test:e2e
npm run test:db
npm run build
npm audit --omit=dev
```

All checks must pass before requesting review.
