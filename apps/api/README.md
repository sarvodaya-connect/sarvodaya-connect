# Sarvodaya Connect API

The central backend API for the Sarvodaya Connect mobile application and web dashboard.

## Technology

- Node.js
- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- REST API
- OpenAPI/Swagger
- WSO2 Identity Server
- WSO2 API Manager

## Responsibilities

The API will:

- Manage the platform’s business logic
- Store and retrieve data securely
- Serve the mobile application and web dashboard
- Validate user input
- Enforce role-based permissions
- Integrate with WSO2 authentication and API management
- Produce audit logs and reports

## Architecture

The backend will begin as a modular monolith. Features will be separated into modules while operating as one deployable application.

## Development

The NestJS application will be initialized in a separate Jira task and pull request.

Do not commit passwords, access tokens, client information, or local environment files to this directory.