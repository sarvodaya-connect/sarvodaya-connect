# Shared API Contracts

This package contains the shared API definitions used by the Sarvodaya Connect mobile application, web dashboard, and backend API.

## Purpose

It will provide a single source of truth for:

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

## Development

The contracts package will be implemented in a separate Jira task and pull request.