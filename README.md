# Sarvodaya Connect

Sarvodaya Connect is a digital village society management and information platform developed as a university group project for Sarvodaya.

The system will provide a Flutter mobile application, a Next.js administration dashboard, and a secure backend API.

## Applications

- `apps/mobile` — Flutter mobile application
- `apps/dashboard` — Next.js web administration dashboard
- `apps/api` — NestJS backend API

## Shared Packages

- `packages/api-contracts` — Shared API definitions and data contracts

## Infrastructure

- `infrastructure/docker` — Local service and container configuration

## Documentation

- `docs` — Technical, architectural, testing, and deployment documentation

## Technology Stack

- Flutter and Dart
- Next.js, React and TypeScript
- Node.js and NestJS
- PostgreSQL and Prisma
- Docker and Docker Compose
- GitHub Actions
- Jira and GitHub

## Development Workflow

1. Select or create a Jira work item.
2. Create a branch containing its Jira key.
3. Implement and test the change.
4. Open a pull request linked to the Jira work item.
5. Obtain a review before merging.
6. Squash-merge the approved pull request into `main`.

Example branch:

```text
feat/SC-10-user-authentication
```