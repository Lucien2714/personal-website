# Production image for the personal website.
#
# Three stages, each doing one thing:
#
#   deps    installs node_modules once, so a source-only change does not
#           re-run npm ci
#   builder generates the Prisma client and compiles the Next.js app. The
#           compose file also runs migrations from this stage, which is why it
#           is a named target rather than an anonymous intermediate.
#   runner  carries only what the server needs at run time
#
# The final image contains no compiler, no dev dependencies and no source tree
# - just the standalone server bundle Next.js emits.
#
# Migrations are deliberately *not* run from this image. An earlier version
# copied a hand-picked subset of node_modules so the entrypoint could call the
# Prisma CLI; that subset silently omitted the CLI's own transitive
# dependencies and failed at start-up. Running them from the builder stage, via
# the `migrate` service in docker-compose.yml, uses a complete dependency tree
# and keeps this image small.

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base

# Prisma's query engine is built against glibc; Alpine ships musl, and this is
# the compatibility shim it needs.
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json ./
# `npm ci` installs exactly the lock file, which is what makes a build
# reproducible; `npm install` would be free to resolve something newer.
RUN npm ci

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# The build imports src/lib/env.ts, which refuses to start without these.
# They are placeholders, declared as ARG rather than ENV so that they exist
# only while this stage runs: nothing reads the database at build time, and the
# real values arrive at run time.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
# A fixed literal that only exists to satisfy the length check in env.ts.
ARG BUILD_AUTH_PLACEHOLDER="placeholder-value-used-only-to-satisfy-env-validation"

RUN DATABASE_URL="$DATABASE_URL" AUTH_SECRET="$BUILD_AUTH_PLACEHOLDER" \
  npx prisma generate && \
  DATABASE_URL="$DATABASE_URL" AUTH_SECRET="$BUILD_AUTH_PLACEHOLDER" \
  npm run build

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# An unprivileged user: a container process that does not need root should not
# have it.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Uploaded media lives on a volume mounted here, so it survives a redeploy.
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads
VOLUME ["/app/public/uploads"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
