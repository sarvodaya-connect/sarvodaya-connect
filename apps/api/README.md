# Sarvodaya Connect API

The NestJS backend API for the Sarvodaya Connect platform.

The API will be shared by the Flutter mobile application and the Next.js administrative dashboard.

## Technology

- Node.js 24 LTS
- NestJS
- TypeScript
- Express
- Vitest
- Oxlint
- PostgreSQL with Prisma ORM

The API uses PostgreSQL through Prisma ORM 7. See the [Database](#database) section.

## Requirements

- Node.js 24
- npm 11
- nvm is recommended

## Initial setup

From the repository root, select the project Node.js version:

```bash
nvm use
```

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
| `DATABASE_URL` | PostgreSQL connection string used by Prisma | See `.env.example` |

Use `.env.example` as the safe configuration template. Do not place passwords, tokens, private keys or real client information in committed files.

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
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:deploy` | Apply existing migrations to the database |
| `npm run prisma:migrate` | Create and apply a new migration during development |
| `npm run prisma:seed` | Load the fictional seed data |

## Database

The API stores its data in PostgreSQL and accesses it through Prisma ORM 7.

### Provisional society registry data model

| Table | Purpose |
|---|---|
| `districts` | Districts of Sri Lanka (provisional list, to be confirmed with Sarvodaya) |
| `societies` | Society profile: code, names, district, divisions, village, address, GPS coordinates, established date and status |
| `society_contacts` | Phone and email contacts for a society |

Society status values are `ACTIVE`, `INACTIVE`, `UNDER_REVIEW` and `SUSPENDED`. Every table has `created_at` and `updated_at` timestamps. The model is provisional and will change when Sarvodaya confirms its requirements.

The database enforces these rules:

- Society codes are unique.
- A district cannot be deleted while societies belong to it.
- Latitude and longitude are either both empty or both valid.
- A contact needs a phone number or an email address.

### Set up the local database

1. Start PostgreSQL by following `infrastructure/docker/README.md`.
2. Make sure the `.env` file at the repository root contains `DATABASE_URL`. Copy it from `.env.example` if needed.
3. From `apps/api`, run:

```bash
npm ci
npm run prisma:deploy
npm run prisma:seed
```

`npm ci` also generates the Prisma client. `npm run prisma:deploy` applies the migrations to an empty database. `npm run prisma:seed` loads the 25 provisional districts and 12 clearly fictional societies (`DEMO-0001` to `DEMO-0012`). The seed can be run repeatedly, and it refuses to run against any database that is not on `localhost`.

### Changing the schema

Edit `prisma/schema.prisma`, then create a migration:

```bash
npm run prisma:migrate -- --name describe_the_change
```

Commit the new folder under `prisma/migrations`.

### Notes

- The generated client in `src/generated/prisma` is not committed. It is recreated by `npm ci` or `npm run prisma:generate`.
- Prisma is pinned to version 7. At the time of writing, Prisma 8 is a release candidate and the npm `latest` tag points to it, so always install with `prisma@7`, and never run `npx prisma@latest`.
- The `overrides` in `package.json` replace two outdated packages inside Prisma's own dependencies so that `npm audit --omit=dev` passes. Remove them when Prisma releases fixed versions.

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