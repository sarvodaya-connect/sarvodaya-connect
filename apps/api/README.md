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

PostgreSQL and Prisma will be configured in a separate Jira task.

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