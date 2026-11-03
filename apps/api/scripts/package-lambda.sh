#!/usr/bin/env bash
# V5 PR 10: builds the API Lambda deployment package, .lambda/sarvodaya-api.zip.
# The zip holds the compiled app (dist/, with the generated Prisma client) and
# production dependencies only. Handler: lambda.handler. Runtime: Node.js 24.
# Every dependency is plain JavaScript (checked below), so the zip runs on either
# Lambda architecture wherever it is built. Nothing here uploads or deploys.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=.lambda
rm -rf "$OUT/package" "$OUT/sarvodaya-api.zip"
mkdir -p "$OUT/package"

npx prisma generate >/dev/null
npx nest build
cp -R dist/. "$OUT/package/"
cp package.json package-lock.json "$OUT/package/"
# Production dependencies only. Peer dependencies (the Prisma CLI, Studio, TypeScript) are
# build tools, and no install scripts run (the Prisma client is already generated).
(cd "$OUT/package" && npm ci --omit=dev --omit=peer --ignore-scripts --no-audit --no-fund >/dev/null)
# @prisma/client lists the Prisma CLI and TypeScript as peers, so npm installs them
# (with Prisma Studio and its embedded dev database). They are build tools: the
# generated client needs only @prisma/client/runtime. Remove them, and the query
# compilers for databases other than PostgreSQL, to stay under Lambda's 250 MB.
(
  cd "$OUT/package/node_modules"
  rm -rf prisma typescript effect @prisma/dev @prisma/studio-core @prisma/config @electric-sql
  rm -rf @types
  find . -name '*.map' -delete
  find @prisma/client/runtime -type f \( -name '*mysql*' -o -name '*sqlite*' -o -name '*sqlserver*' -o -name '*cockroachdb*' \) -delete
)
# Source maps help stack traces in CloudWatch; type declarations are not needed at run time.
find "$OUT/package" -name '*.d.ts' -not -path '*/node_modules/*' -delete

# A native binary built on a developer machine would not run on Lambda's Linux.
if [ -n "$(find "$OUT/package" \( -name '*.node' -o -name '*.dylib' -o -name '*.so' \) -print -quit)" ]; then
  echo "Native binaries found in the package; build it on Linux or in the AWS SAM build image." >&2
  exit 1
fi

(cd "$OUT/package" && zip -qr ../sarvodaya-api.zip .)
echo "Lambda package: $OUT/sarvodaya-api.zip ($(du -h "$OUT/sarvodaya-api.zip" | cut -f1) zipped, $(du -sh "$OUT/package" | cut -f1) unzipped; the limit is 250 MB unzipped)"
