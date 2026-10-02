# Contributing to Sarvodaya Connect

All project work must be connected to a Jira work item and reviewed through a GitHub pull request.

## Before Starting Work

1. Select or create a Jira work item.
2. Assign the work item to yourself.
3. Move it to **In Progress**.
4. Update your local `main` branch.
5. Create a new branch from `main`.

## Branch Naming

Use this format:

```text
type/SC-number-short-description
```

Examples:

```text
feature/SC-10-user-authentication
fix/SC-21-login-validation
chore/SC-1-bootstrap-monorepo
docs/SC-15-update-architecture
```

Allowed types:

- `feature` — New functionality
- `fix` — Bug correction
- `chore` — Setup, tooling or maintenance
- `docs` — Documentation
- `test` — Test-related changes
- `refactor` — Internal code improvement

## Commit Messages

Include the Jira key and write a clear message:

```text
SC-10 feat: add user authentication
SC-21 fix: validate empty login fields
```

Make small, focused commits. Do not commit unrelated changes together.

## Pull Requests

Every pull request must:

- Include the Jira key in its title
- Explain what changed and why
- Include testing evidence
- Avoid unrelated changes
- Request at least one teammate review
- Pass all automated checks

Move the Jira work item to **Code Review** when the pull request is ready.

After approval and successful testing, squash-merge the pull request and move the Jira item to **Done**.

## Code Quality

- Follow the formatting and linting rules for each application.
- Add or update tests for changed behaviour.
- Document important technical decisions.
- Never push directly to `main`.
- Never merge your own work without review.

## Security

Never commit:

- Passwords
- Access tokens
- Private keys or certificates
- Real environment files
- Production credentials
- Confidential client or personal information

Use `.env.example` only for safe placeholder values.