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

## Local PostgreSQL Development Database

This configuration provides a PostgreSQL database for local development of Sarvodaya Connect, using Docker Compose so that every team member works in the same environment.

It is intended for development only. Real credentials and client data must never be used with this configuration.

### Prerequisites

- Docker Desktop installed and running
- Docker and Docker Compose available from the terminal:

```bash
docker --version
docker compose version
```

### Initial Setup

All commands in this section are run from the `infrastructure/docker` directory.

```bash
cd infrastructure/docker
cp .env.example .env
```

The `.env` file contains local configuration and is excluded from version control. It must never be committed. The default values may be changed if required.

| Variable | Default Value | Description |
|---|---|---|
| `POSTGRES_USER` | `sarvodaya_dev` | Database user |
| `POSTGRES_PASSWORD` | `change_me_dev_only` | Database password (placeholder) |
| `POSTGRES_DB` | `sarvodaya_connect` | Database name |
| `POSTGRES_PORT` | `5432` | Port exposed on the local machine |

### Starting the Database

```bash
docker compose config
docker compose up -d
docker compose ps
```

`docker compose config` validates the configuration. After `docker compose up -d`, the `docker compose ps` command should report the `postgres` service as `healthy`. The first start may take approximately 20 seconds.

### Inspecting the Database

```bash
docker compose ps
docker compose logs postgres
docker compose logs -f postgres
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

The `-f` option follows the logs until interrupted with `Ctrl+C`. Within `psql`, `\l` lists databases, `\dt` lists tables, and `\q` exits.

### Connection Details

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `sarvodaya_connect` |
| User | `sarvodaya_dev` |
| Password | The value defined in `.env` |

Connection string format, consistent with `DATABASE_URL` in the root `.env.example`:

```text
postgresql://sarvodaya_dev:<password>@localhost:5432/sarvodaya_connect
```

If the values in `.env` were changed, use those values instead. To confirm that the port is reachable from the local machine:

```bash
nc -zv 127.0.0.1 5432
```

### Stopping and Restarting

```bash
docker compose down
docker compose up -d
docker compose restart postgres
```

`docker compose down` stops and removes the container. The data is preserved in the named volume `postgres_data`, and it is available again after the next `docker compose up -d`.

### Resetting the Database

The following commands permanently delete all local database data:

```bash
docker compose down -v
docker compose up -d
```

### Troubleshooting

- **Cannot connect to the Docker daemon:** Start Docker Desktop and wait until it reports that it is running.
- **Port 5432 is already in use:** Identify the process with `lsof -i :5432`. Stop it, or set `POSTGRES_PORT` to another value (for example `5433`) in `.env` and run `docker compose up -d` again.
- **Error stating that a variable must be set in `.env`:** The `.env` file has not been created. Run `cp .env.example .env`.
- **Changes to the user, password or database name have no effect:** PostgreSQL applies these values only when the volume is first created. Run `docker compose down -v` followed by `docker compose up -d`. This deletes all local data.
- **Service remains in the `starting` or `unhealthy` state:** Review the output of `docker compose logs postgres`.
- **Password authentication failed:** Confirm that the password in use matches the value in `.env`, and see the previous item if it was changed after the first start.
