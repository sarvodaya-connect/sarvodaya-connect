# Sarvodaya Connect

Sarvodaya Connect is a digital platform for managing village societies and their records. The project is being developed for Sarvodaya as a university group project by STAMPx.

The repository contains three applications:

- **Mobile app** — Flutter app for society officers and regional staff.
- **Dashboard** — Next.js web app for national, district and platform administration.
- **API** — NestJS service backed by PostgreSQL for society registry, membership, documents and notifications.

## Project status

The project is under active development. The API has a local PostgreSQL setup, Prisma schema and fictional seed data. The mobile app and dashboard include role-based workflows and demonstration data; not every screen is connected to the API yet. Demo sign-in and role switching are for development only. Production identity, cloud deployment and production data are not configured in this repository.

Documents use local storage during development by default. The API also contains an Amazon S3 storage adapter for a future configured environment. Do not use real Sarvodaya data or credentials in the local demo.

## Repository map

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

## Technology

- Flutter and Dart for iOS and Android
- Next.js, React and TypeScript for the dashboard
- NestJS and TypeScript for the API
- PostgreSQL and Prisma ORM
- Docker Compose for local PostgreSQL
- GitHub Actions for automated checks

## Requirements

- Node.js **24** and npm (the repository pins Node with `.nvmrc`; NVM users can run `nvm use` from the repository root)
- Flutter stable SDK
- Docker Desktop with Docker Compose for local PostgreSQL and API-backed development
- Android Studio and Android SDK for Android emulator testing
- Xcode for iOS simulator/device builds (macOS only)

## Quick start

### 1. Get the project

```bash
git clone https://github.com/sarvodaya-connect/sarvodaya-connect.git
cd sarvodaya-connect
nvm use
```

### 2. Start the local database and API

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

### 3. Run the dashboard

Open a separate terminal at the repository root (`sarvodaya-connect`), then run:

```bash
cd apps/dashboard
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard currently uses fictional demonstration data for its screens; setting `NEXT_PUBLIC_API_BASE_URL` does not mean every view is connected to live API data.

### 4. Run the mobile app

Open another terminal at the repository root, then run:

```bash
cd apps/mobile
flutter pub get
flutter devices
flutter run -d DEVICE_ID
```

Replace `DEVICE_ID` with an identifier listed by `flutter devices`. The mobile demonstration currently uses fictional data and local app state.

## Development checks

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

## Demo access and data

The mobile app provides a fictional demo account and a role preview for Society Officer, District Manager and HQ Administrator flows. API endpoints that require a user accept the development-only `X-Demo-User` header. For example:

```bash
curl -H "X-Demo-User: demo-dm-north" http://localhost:3001/api/v1/documents
```

These demo identities are not production authentication. Cognito integration and production authorization must be completed before any real users or data are used. See the [API guide](apps/api/README.md) for available demo identities and API setup details.

## Contributing

Work is tracked in Jira. Create a feature branch for the assigned work item, run the checks for the affected app, and open a pull request for review before merging. See [CONTRIBUTING.md](CONTRIBUTING.md) for the team workflow.

## Security

- Never commit `.env` files, passwords, access tokens, AWS credentials, private keys or real client data.
- Use only fictional data in local development and demonstrations.
- Do not deploy the demo authentication or demo identities to production.
- Production infrastructure and security controls require review and configuration by Sarvodaya IT before launch.
