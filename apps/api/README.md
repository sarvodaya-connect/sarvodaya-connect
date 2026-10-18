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
SC-29 seed complete: 3 fictional districts, 6 fictional societies, 4 fictional contacts.
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
| `npm run test:cov` | Generate a test coverage report |

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
npm run build
npm audit --omit=dev
```

All checks must pass before requesting review.
