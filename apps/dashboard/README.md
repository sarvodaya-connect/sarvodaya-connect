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
API_BASE_URL=http://localhost:3001/api/v1
```

The `.env.local` file is ignored by Git and must not contain passwords, access tokens, or other secrets.

Variables beginning with `NEXT_PUBLIC_` are visible in the browser and must only contain public configuration.

The emergency-response screens call the local API from server-side code using `API_BASE_URL`; keep this URL server-only. Set it to your local API origin and version prefix when running dashboard workflows.

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

- A responsive Sarvodaya Connect dashboard shell with the approved logo
- National and district overview screens with fictional summary metrics
- A platform access overview for administrator-facing account and role summaries
- A demonstration “Viewing as” selector that updates the visible overview, navigation and records
- Emergency-response screens connected to the local NestJS API for incident activation, scoped assessments, response actions and situation reports
- Environment-based API URL configuration
- Loading, error, empty and no-search-results states
- An access-denied state for areas unavailable to the selected demonstration role
- A custom not-found page
- Component tests with Vitest and React Testing Library
- TypeScript and ESLint configuration
- Tailwind CSS styling

## Dashboard role previews

Use **Viewing as** in the header to choose a fictional staff member. The overview and navigation follow that viewer's role:

| Viewer | `/dashboard` | `/admin` |
| --- | --- | --- |
| HQ Administrator | National overview (D01) | Access-denied state |
| District Manager | Kurunegala District overview (D16) | Access-denied state |
| Programme Coordinator | Kurunegala District overview (D16) | Access-denied state |
| System Administrator | Redirects to `/admin` | Platform access administration (D21) |

The role selector is for demonstration only. It does not authenticate a user, and production role and record access must come from the identity provider and be enforced by the API.

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

The same `?demo=loading`, `?demo=empty` and `?demo=error` parameters work on `/compliance`, `/documents` and `/notifications`.

## Compliance, documents and notifications (SC-48)

| Page | Catalogue | What it shows |
| --- | --- | --- |
| `/compliance` | D11 Audits & compliance | The four annual Registrar documents (audit report, AGM minutes, office-bearer list and signed members list) for every society in scope. Each document is **Completed** (approved), **Pending** (under review or returned) or **Missing** (not submitted; overdue after 30 Sep 2026). Status cards, the Registrar strip, search and the district, document type and status filters narrow the list. **Send reminder** is recorded on the page only. |
| `/documents` | D12 Documents library | Every society document the viewer may see, with search across names, societies and the text read from scanned files, category list, district, society and status filters, and a preview panel. Downloads are switched off for the demonstration files. |
| `/notifications` | D19 Notification centre | Approvals, returns, audit reminders, document requests, emergency, stale-data and system notifications for the viewer's role, with category filters, unread markers and **Mark all read**. The bell in the header and the navigation show the unread count. |

### Provisional role-based visibility

Use **Viewing as** in the header to switch between fictional staff members. The choice is stored in a cookie, and the rules in `src/lib/access.ts` are applied on the server, so restricted records are never sent to the browser.

| Viewer | Compliance | Documents | Notifications |
| --- | --- | --- | --- |
| HQ Administrator | All districts | All documents, including signed members lists | National, emergency and system |
| District Manager (Kurunegala) | Own district | Own district, including signed members lists | Own district |
| Programme Coordinator (Phase 2) | No permission | Activity and registration documents of assigned societies only; no audit, Registrar, finance or members-list files | Assigned societies |
| System Administrator | No permission | No permission | System only |

These rules follow the provisional permissions for the MVP and will be enforced by the API when real sign-in is connected. Read state for notifications is kept in the browser until the notification service exists.

## Before opening a pull request

Run:

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
```

All commands must pass before the pull request is submitted.
