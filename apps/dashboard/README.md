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
npm test
npm run build
npm run start
```

- `npm run dev` starts the development server.
- `npm run lint` checks the source code for quality problems.
- `npm test` runs the component tests once with Vitest and React Testing Library.
- `npm run test:watch` re-runs the tests when files change.
- `npm run build` creates and validates the production build.
- `npm run start` runs the completed production build.

## Current foundation

The dashboard currently includes:

- A Sarvodaya Connect placeholder page
- Environment-based API URL configuration
- Loading, error, empty and no-search-results states
- A custom not-found page
- Component tests with Vitest and React Testing Library
- TypeScript and ESLint configuration
- Tailwind CSS styling

Business features and final user-interface designs will be implemented through separate Jira work items.

## Data states

Every registry view handles incomplete and failed data instead of showing a blank page:

- **Loading** — skeleton rows inside the dashboard shell (`src/app/(dashboard)/loading.tsx`).
- **Error** — a message with a safe **Try again** action and a link back to the registry (`src/app/(dashboard)/error.tsx`). Technical error details are not shown; only a reference code.
- **Empty** — a clear message when there are no societies or submissions.
- **No search results** — lists the active search and filters, with buttons to remove one filter or clear them all.

The shared components are in `src/components/dashboard/data-states.tsx`.

The dashboard currently uses fictional fixtures, so these states can be demonstrated on the Societies page with a query parameter:

| URL | State shown |
| --- | --- |
| `/societies?demo=loading` | Loading skeleton for about 2.5 seconds, then the registry |
| `/societies?demo=empty` | Empty registry |
| `/societies?demo=error` | Error state with retry |

To see the no-search-results state, search the Societies page for a name that does not exist. The demonstration scenarios live in `src/lib/demo-scenarios.ts` and will be removed when the registry is loaded from the API.

## Before opening a pull request

Run:

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
```

All commands must pass before the pull request is submitted.