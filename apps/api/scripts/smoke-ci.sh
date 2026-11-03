#!/usr/bin/env bash
# Exercise the real deployment package with disposable local dependencies.
# Requires Node 24, Docker Compose v2, curl, unzip, installed API dependencies and
# `npm run package:lambda`. Reuses smoke-local.ts without changing local usage.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .lambda/sarvodaya-api.zip ]]; then
  echo "Run npm run package:lambda before the packaged smoke checks." >&2
  exit 1
fi

random_hex() { node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))'; }
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-aws-smoke-$(random_hex)}"
export SMOKE_DB_PASSWORD="$(random_hex)"
export MINIO_ROOT_USER=aws-smoke
export MINIO_ROOT_PASSWORD="$(random_hex)"
export SMOKE_HQ_USERNAME=smoke.hq
export SMOKE_HQ_PASSWORD="$(random_hex)7"
export NIC_ENCRYPTION_KEY="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
if [[ "${GITHUB_ACTIONS:-}" == true ]]; then
  for secret in "$SMOKE_DB_PASSWORD" "$MINIO_ROOT_PASSWORD" "$SMOKE_HQ_PASSWORD" "$NIC_ENCRYPTION_KEY"; do
    echo "::add-mask::$secret"
  done
fi

compose=(docker compose -f ../../infrastructure/docker/docker-compose.aws-smoke.yml)
emulator_pid=
log_file="$(mktemp)"
package_dir="$(mktemp -d)"
cleanup() {
  result=$?
  trap - EXIT INT TERM
  if [[ -n "$emulator_pid" ]]; then
    kill "$emulator_pid" 2>/dev/null || true
    wait "$emulator_pid" 2>/dev/null || true
  fi
  if (( result != 0 )); then
    echo "Packaged smoke checks failed. Emulator log:" >&2
    tail -n 60 "$log_file" >&2
  fi
  rm -f "$log_file"
  rm -rf "$package_dir"
  if ! "${compose[@]}" down --volumes --remove-orphans; then
    echo "Could not remove all smoke resources for $COMPOSE_PROJECT_NAME" >&2
    result=1
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Extract outside the checkout so missing production dependencies cannot be
# silently resolved from apps/api/node_modules. Exercise the zip we would ship.
unzip -q .lambda/sarvodaya-api.zip -d "$package_dir"
unset NODE_PATH
"${compose[@]}" up -d postgres minio
# All waits are bounded; a service failure must fail CI rather than hang it.
for attempt in {1..60}; do
  if "${compose[@]}" exec -T postgres pg_isready -U aws_smoke -d aws_smoke >/dev/null 2>&1; then break; fi
  if (( attempt == 60 )); then echo "PostgreSQL did not become ready" >&2; exit 1; fi
  sleep 1
done
pg_address="$("${compose[@]}" port postgres 5432)"
minio_address="$("${compose[@]}" port minio 9000)"
export DATABASE_URL="postgresql://aws_smoke:$SMOKE_DB_PASSWORD@$pg_address/aws_smoke"
export S3_ENDPOINT_URL="http://$minio_address"
for attempt in {1..60}; do
  if curl --fail --silent --max-time 2 "$S3_ENDPOINT_URL/minio/health/live" >/dev/null; then break; fi
  if (( attempt == 60 )); then echo "MinIO did not become ready" >&2; exit 1; fi
  sleep 1
done
"${compose[@]}" run --rm --no-deps minio-init

export NODE_ENV=test AUTH_PROVIDER=local SARVOAI_ENABLED=false
export STORAGE_DRIVER=s3 S3_BUCKET=aws-smoke-documents S3_REGION=us-east-1
export AWS_ACCESS_KEY_ID="$MINIO_ROOT_USER" AWS_SECRET_ACCESS_KEY="$MINIO_ROOT_PASSWORD"
export AWS_EC2_METADATA_DISABLED=true
unset AWS_SESSION_TOKEN S3_ENDPOINT_HOST
export BOOTSTRAP_HQ_USERNAME="$SMOKE_HQ_USERNAME" BOOTSTRAP_HQ_PASSWORD="$SMOKE_HQ_PASSWORD"
export BOOTSTRAP_HQ_NAME='Fictional CI HQ'
npm run prisma:deploy
npm run prisma:seed
npm run identity:bootstrap

# Port 0 asks the OS for a free emulator port. Read its actual address from the
# startup log, so concurrent local smoke runs cannot collide with one another.
export LAMBDA_LOCAL_PORT=0 LAMBDA_HANDLER_PATH="$package_dir/lambda.js"
node --import tsx scripts/lambda-local.ts >"$log_file" 2>&1 &
emulator_pid=$!
for attempt in {1..60}; do
  if ! kill -0 "$emulator_pid" 2>/dev/null; then echo "Lambda emulator exited" >&2; exit 1; fi
  address="$(sed -n 's/.*Lambda emulator on \(http:\/\/localhost:[0-9]*\/api\/v1\).*/\1/p' "$log_file" | head -n 1)"
  if [[ -n "$address" ]] && curl --fail --silent --max-time 2 "$address/health" >/dev/null; then break; fi
  if (( attempt == 60 )); then echo "Lambda emulator did not become ready" >&2; exit 1; fi
  sleep 1
done
export SMOKE_API_URL="$address"
npm run smoke:local
