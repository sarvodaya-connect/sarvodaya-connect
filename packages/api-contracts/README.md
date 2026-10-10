# Shared API Contracts

This package is the single source of truth for the API definitions used by the Sarvodaya Connect mobile application, web dashboard, and backend API.

## Purpose

It provides a single source of truth for:

- Request and response structures
- Data transfer objects
- Validation rules
- API error formats
- Common constants and enumerations
- OpenAPI-generated models where appropriate

## Rules

- Do not place business logic in this package.
- Keep contracts independent of user-interface code.
- Changes must remain compatible with the mobile app, dashboard, and API.
- Breaking changes require team review.
- Do not store passwords, tokens, or client data here.

## Included contracts

- User roles and account states
- Society, district, location, contact, committee, document and history models
- Society and verification states
- Submission, correction, review and activity-report workflows
- Pagination metadata
- Validation and API error envelopes

The contracts are provisional until Sarvodaya confirms the related business rules. Activity reports must not contribute to HQ reporting until their status is `APPROVED`.

## Development

Use Node.js 24, matching the repository `.nvmrc` file.

```bash
cd packages/api-contracts
npm ci
npm test
npm run check
```

Build output is written to `dist/` and is not committed.

## TypeScript usage

Install or reference `@sarvodaya-connect/api-contracts`, then import only the contracts needed by the client:

```ts
import type {
  ApiErrorResponse,
  PaginatedResponse,
  SocietyDetails,
  SocietySummary,
} from "@sarvodaya-connect/api-contracts";
```

Flutter cannot import TypeScript directly. Dart models must preserve the same JSON field names and enum string values documented by this package.

## Compatibility

- Adding optional fields or new status values requires tests and review.
- Removing or renaming fields is a breaking change and requires agreement from API, dashboard and mobile owners.
- Do not add database entities, UI state, secrets or business logic to this package.
