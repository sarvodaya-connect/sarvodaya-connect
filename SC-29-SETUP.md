# SC-29 — Fictional Society Seed Data

## Overview

This seed dataset provides fictional development records for the Sarvodaya Connect Society Registry.

The dataset contains:

- **3 fictional districts**
- **6 fictional societies**
- **4 fictional society contacts**
- **4 society statuses:** ACTIVE, INACTIVE, UNDER_REVIEW, and SUSPENDED

All society names, identifiers, addresses, and contacts are fictional. Email addresses use the reserved `example.com` domain. No real contact numbers or operational society records are included.

GPS coordinates are illustrative and must not be treated as verified society locations.

## Requirements

- Node.js 24
- npm
- Docker Desktop with Docker Compose
- PostgreSQL 17 (provided through Docker)
- Prisma 7
- `tsx` development dependency, installed through `npm ci`

The API seed command is configured in `apps/api/package.json`:

```json
"prisma:seed": "tsx prisma/seed.ts"
```

The seed implementation is located at `apps/api/prisma/seed.ts`.

## Local Environment Configuration

Two separate environment files are used:

1. **Repository root `.env`** — Used by the API, Prisma, and seed script.
2. **`infrastructure/docker/.env`** — Used by Docker Compose to configure PostgreSQL.

Create these files from their corresponding `.env.example` templates only if they do not already exist.

Configure matching PostgreSQL credentials in both files. The database connection should point to the local PostgreSQL instance on `localhost:5432`.

Never commit `.env` files, passwords, tokens, or production credentials.

**Important:** Do not overwrite existing environment files with example templates, because doing so may replace working database credentials with placeholders.

## Setup in PowerShell

Run the following commands from the repository root.

### 1. Start PostgreSQL

```powershell
cd infrastructure/docker
docker compose config --quiet
docker compose up -d
docker compose ps
```

Wait until the PostgreSQL container reports `healthy`.

### 2. Install API Dependencies

```powershell
cd ../../apps/api
npm ci
```

### 3. Generate Prisma Client and Apply Migrations

```powershell
npm run prisma:generate
npm run prisma:deploy
```

### 4. Seed Fictional Society Records

```powershell
npm run prisma:seed
```

Expected output:

```text
SC-29 seed complete: 3 fictional districts, 6 fictional societies, 4 fictional contacts.
```

Run the command a second time to verify repeatability:

```powershell
npm run prisma:seed
```

The seed uses fixed UUIDs and Prisma upserts, preventing duplicate fixture records on repeated execution.

The script does not delete unrelated database records. Existing `updatedAt` timestamps may change when records are reseeded.

For safety, the seed refuses to run with `NODE_ENV=production` or against database hosts other than `localhost`, `127.0.0.1`, and `::1`.

## API Verification

Start the NestJS API:

```powershell
npm run start:dev
```

The API provides these endpoints:

- `GET /api/v1/health`
- `GET /api/v1/districts`
- `GET /api/v1/societies`
- `GET /api/v1/societies/:id`

Retrieve the seeded records through PowerShell:

```powershell
Invoke-RestMethod "http://localhost:3001/api/v1/districts" |
ConvertTo-Json -Depth 10

Invoke-RestMethod "http://localhost:3001/api/v1/societies" |
ConvertTo-Json -Depth 10
```

Expected dataset:

| District | Society Count |
|---|---:|
| Fictional North District | 2 |
| Fictional Central District | 2 |
| Fictional South District | 2 |

Expected society status distribution:

| Status | Count |
|---|---:|
| ACTIVE | 2 |
| INACTIVE | 1 |
| UNDER_REVIEW | 2 |
| SUSPENDED | 1 |

**Note:** The current API returns provisional `profileCompleteness` values of `0` and `verificationStatus` values of `UNVERIFIED`. These should not be interpreted as calculated profile completeness or completed verification.

## Automated Validation

Run from `apps/api`:

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
```

### Local Validation Results — 13 October 2026

The following checks were completed successfully:

| Validation | Result |
|---|---|
| PostgreSQL 17 container | Healthy |
| Prisma migration | Applied successfully |
| Repeated seed execution | Passed |
| District records | 3 verified |
| Society records | 6 verified |
| Contact records | 4 verified |
| Society statuses | All four represented |
| Districts API | Returned all three districts |
| Societies API | Returned all six societies |
| Unit tests | 4 passed |
| End-to-end health test | 1 passed |
| Lint | 0 warnings, 0 errors |
| API build | Passed |

## Git Hygiene

Return to the repository root:

```powershell
cd ../..
git status --short
git diff --check
```

Stage only the four SC-29 files:

```powershell
git add SC-29-SETUP.md apps/api/prisma/seed.ts apps/api/package.json apps/api/package-lock.json
```

Review the staged changes:

```powershell
git diff --cached --check
git diff --cached --stat
git status --short
```

Do not stage unrelated untracked files, `.env` files, secrets, or contents of existing Git stashes.

A corrective commit or pull request should be made only if required by the team's SC-29 instructions.