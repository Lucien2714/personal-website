# Deployment

Deploying to a single VPS with Docker Compose. Four services: a one-shot
`migrate` job, the app, PostgreSQL, and Caddy for TLS.

> **Running project scripts.** The runtime image contains only the compiled
> server - no source tree, no `tsx`, no dev dependencies. Anything that runs a
> script from `scripts/` or `prisma/` therefore goes through the `migrate`
> service, which is built from the stage that does have them:
>
> ```bash
> docker compose run --rm migrate npx tsx <script>
> ```

## Prerequisites

- A VPS with Docker and the Compose plugin.
- A domain whose A (and AAAA) records point at the host.
- Ports 80 and 443 reachable — Caddy needs both to obtain a certificate.

## First deploy

```bash
git clone <this repo> /opt/personal-website
cd /opt/personal-website

cp .env.example .env
```

Edit `.env`. The values that must change:

| Variable | Value |
| --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 48` |
| `POSTGRES_PASSWORD` | a long random string |
| `SITE_DOMAIN` | your domain, e.g. `lucien2714.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://` + that domain, no trailing slash |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | your first admin account |
| `API_CORS_ORIGINS` | `*` for public reads, or a comma-separated allow-list |

`DATABASE_URL` is rewritten by the compose file from the `POSTGRES_*` values,
so it does not need to be correct in `.env` for the Docker deployment.

Then:

```bash
cd docker
docker compose up -d --build
```

Compose runs a one-shot `migrate` service that applies pending migrations and
exits; the app waits for it to succeed before starting, so the schema and the
code that expects it are never a version apart. Create the admin account once:

```bash
docker compose run --rm migrate npx tsx prisma/seed.ts
```

Check it came up:

```bash
docker compose ps
curl -s https://your-domain/api/v1 | head
```

## Migrating the old blog

Run the importer inside the container with the Jekyll checkout mounted:

```bash
docker compose run --rm \
  -v /path/to/blog:/blog:ro \
  app npx tsx scripts/import-jekyll.ts --source /blog
```

Add `--dry-run` first to see what it would do. The importer is idempotent —
posts are matched on the slug the old site used — so re-running it updates
rather than duplicates.

## Updating

```bash
cd /opt/personal-website
git pull
cd docker
docker compose up -d --build
```

The `migrate` service runs first and the app waits for it. Watch both:

```bash
docker compose logs migrate
docker compose logs -f app
```

A failed migration leaves the old app container running and the new one
unstarted, which is the right way round: an unmigrated deploy never serves
traffic.

## Backups

The database is the only thing that cannot be rebuilt from the repository.
Uploaded files come second.

A nightly dump into the bind-mounted `docker/backups` directory:

```cron
0 3 * * * cd /opt/personal-website/docker && docker compose exec -T postgres \
  pg_dump -U website personal_website | gzip > backups/db-$(date +\%F).sql.gz
0 4 * * * find /opt/personal-website/docker/backups -name 'db-*.sql.gz' -mtime +30 -delete
```

Uploads live on a named volume:

```bash
docker run --rm \
  -v personal-website_uploads:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

Copy both off the host. A backup that only exists on the machine it protects is
not a backup.

### Restoring

```bash
cd docker
docker compose stop app
gunzip -c backups/db-2026-08-26.sql.gz | \
  docker compose exec -T postgres psql -U website -d personal_website
docker compose start app
```

## Operations

**Logs**

```bash
docker compose logs -f app
docker compose logs -f caddy
```

Caddy's access log is inside its volume at `/data/access.log`, rotated at
10 MiB with five kept.

**A shell in the app container**

```bash
docker compose exec app sh
```

**Database console**

```bash
docker compose exec postgres psql -U website -d personal_website
```

**Reset a forgotten admin password**

```bash
docker compose run --rm -e NEW_PASSWORD='a-long-new-password' migrate \
  npx tsx scripts/set-password.ts --email you@example.com
```

Passing it through the environment rather than as `--password` keeps the value
out of `ps` output and shell history. The script also revokes every active
session for that account, so a reset actually locks out whoever had one.

## Changing the domain

1. Point the new domain's DNS at the host.
2. Update `SITE_DOMAIN` and `NEXT_PUBLIC_SITE_URL` in `.env`.
3. `docker compose up -d --force-recreate caddy app`.

Caddy obtains a certificate for the new name automatically. To keep the old
domain working, add it to the `Caddyfile` site block as a second name with a
`redir` to the new one.

## Scaling beyond one container

Two things assume a single process, and both are commented in the source:

- **Rate limiting** (`src/lib/api/rate-limit.ts`) counts in process memory.
  With two replicas each keeps its own budget; move the counter to Redis or to
  Caddy.
- **Uploads** are on a local volume. Two replicas on different hosts would need
  shared storage or an object store; `src/lib/media/storage.ts` is the only
  module that touches the filesystem.

Neither is a problem at the traffic a personal site sees, which is why neither
was solved in advance.

## Health checks

Both the app container and the compose service poll `GET /api/v1`, which
returns the service document without touching the database. A failing check
means the process is wedged; database problems surface as 500s in the logs
instead.
