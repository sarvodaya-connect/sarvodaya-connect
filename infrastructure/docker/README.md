# Docker Infrastructure

Docker configuration for running Sarvodaya Connect services consistently across development, testing, and deployment environments.

## Planned Services

- NestJS backend API
- PostgreSQL database


## Purpose

Docker will help the team:

- Use consistent development environments
- Start required services locally
- Reduce machine-specific configuration problems
- Test service integration before deployment
- Prepare the system for production deployment

## Security

- Never place real passwords, tokens, certificates, or client data in Docker files.
- Use environment variables for configuration.
- Commit only safe example values through `.env.example`.
- Keep production secrets outside the Git repository.

## Development

Docker Compose and service configuration will be implemented through separate Jira tasks and pull requests after the applications are initialized.