# Sarvodaya Connect Administration Dashboard

The web administration dashboard for the Sarvodaya Connect platform.

## Technology

- Next.js
- React
- TypeScript
- Tailwind CSS
- App Router

## Requirements

- Node.js 24
- npm

The repository contains an `.nvmrc` file. If you use NVM, run this command from the repository root:

```bash
nvm use
```

## Installation

From the `apps/dashboard` directory, install the dependencies:

```bash
npm ci
```

## Environment configuration

Create a file named `.env.local` inside `apps/dashboard`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

The `.env.local` file is ignored by Git and must not contain passwords, access tokens, or other secrets.

Variables beginning with `NEXT_PUBLIC_` are visible in the browser and must only contain public configuration.

## Development

Start the local development server:

```bash
npm run dev
```

Open the dashboard at:

```text
http://localhost:3000
```

## Available scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

- `npm run dev` starts the development server.
- `npm run lint` checks the source code for quality problems.
- `npm run build` creates and validates the production build.
- `npm run start` runs the completed production build.

## Current foundation

The dashboard currently includes:

- A Sarvodaya Connect placeholder page
- Environment-based API URL configuration
- A loading state
- An application error state
- A custom not-found page
- TypeScript and ESLint configuration
- Tailwind CSS styling

Business features and final user-interface designs will be implemented through separate Jira work items.

## Before opening a pull request

Run:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

All commands must pass before the pull request is submitted.