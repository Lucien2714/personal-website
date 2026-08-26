#!/bin/sh
#
# Container entrypoint.
#
# Applies any pending database migrations, then hands over to the server.
# Running migrations here rather than in a separate deploy step means the
# schema and the code that expects it can never be a version apart, which is
# the failure mode that produces 500s five minutes after a deploy.
#
# `migrate deploy` only applies migrations that already exist; it never
# generates one and never prompts, which is what makes it safe to run
# unattended on every start.

set -eu

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Starting server"
exec "$@"
