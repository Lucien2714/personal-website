# Deployment

Deploying to a single VPS with Docker Compose. Four services: a one-shot
`migrate` job, the app, PostgreSQL, and Caddy for TLS.

**The server does not build.** `next build` peaks at roughly 1.9 GB of RAM,
which a small VPS does not have spare — it serves the finished site in a
fraction of that — and running out mid-build produces an out-of-memory kill
with no useful message. `.github/workflows/publish.yml` builds on every push to
`main` and pushes two images to GHCR; deploying is a `pull`.

Every command below runs from the repository root. `docker-compose.yml` sits
there rather than in `docker/` (which holds the Dockerfile and the Caddyfile)
because Compose reads `${VAR}` substitutions from a `.env` beside the compose
file — a different mechanism from `env_file:`, and one that would otherwise
need a second `.env` with duplicated contents.

> **Running project scripts.** The runtime image contains only the compiled
> server — no source tree, no `tsx`, no dev dependencies. Anything that runs a
> script from `scripts/` or `prisma/` therefore goes through the `migrate`
> service, which uses the `-tools` image that does have them:
>
> ```bash
> docker compose run --rm migrate npx tsx <script>
> ```

## The two images

One Dockerfile produces both, and CI pushes both:

| Tag | Contents | Used by |
| --- | --- | --- |
| `:latest` | The standalone server and nothing else (~340 MB) | `app` |
| `:latest-tools` | Dependencies and source, nothing compiled | `migrate`, and one-off scripts |

Both are also tagged with the commit SHA, so rolling back is a matter of
setting `IMAGE_TAG` in `.env` to a known-good SHA and running `docker compose
up -d` again.

The tools image is the larger of the two, but its heavy layer is `node_modules`,
which only changes when `package-lock.json` does. A commit that touches only
source moves a few megabytes.

## Prerequisites

- A VPS with Docker and the Compose plugin (`docker compose version` must
  print v2.x — Ubuntu's `docker.io` package does not include it).
- A domain with an **A** record pointing at the host's IPv4 address.

  Add an `AAAA` record only once IPv6 actually reaches the container. Let's
  Encrypt prefers IPv6 whenever an AAAA record exists, and the ports published
  below bind IPv4 only unless the Docker daemon has IPv6 and `ip6tables`
  enabled — so a premature AAAA record means certificate issuance fails with a
  connection timeout that says nothing about the cause.
- Ports 80 and 443 reachable — Caddy needs both to obtain a certificate.
- The GHCR package set to public, or a pull token on the server (see below).

Notably **not** required: build tooling, or memory headroom for a build.

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
| `OAUTH_GITHUB_CLIENT_ID` / `_SECRET` | Optional; enables GitHub sign-in for readers |
| `OAUTH_GITEE_CLIENT_ID` / `_SECRET` | Optional; enables Gitee sign-in |

`DATABASE_URL` is rewritten by the compose file from the `POSTGRES_*` values,
so it does not need to be correct in `.env` for the Docker deployment.
`IMAGE_REPO` should already be right; change it only if the repository moved.

Then, from the repository root:

```bash
docker compose pull
docker compose up -d
```

Note the absence of `--build`. If you ever see the server start compiling, a
`build:` key has taken precedence because the image could not be pulled — stop
it and fix the pull rather than letting it run out of memory.

If the GHCR package is private, sign in on the server first with a personal
access token that has `read:packages`:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u lucien2714 --password-stdin
```

Making the package public instead is simpler and costs nothing here: the image
contains only code that is already in a public repository.

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

### Reader sign-in

Comments require a reader to sign in, which requires at least one OAuth
provider. Both are optional and independent - with neither configured the
site runs fine and the sign-in page says none is available.

Register the callback URL as `https://your-domain/api/auth/<slug>/callback`:

| Provider | Where | Slug |
| --- | --- | --- |
| GitHub | <https://github.com/settings/developers> | `github` |
| Gitee | <https://gitee.com/oauth/applications> | `gitee` |

WeChat and QQ are not available to a personal site; see
[auth.md](auth.md#configured-providers) for why, and for what adding another
provider involves.

Changing these variables needs a restart of the app container, because the
provider list is read at start-up:

```bash
docker compose up -d --force-recreate app
```

## Migrating the old blog

Run the importer inside the container with the Jekyll checkout mounted:

```bash
docker compose run --rm \
  -v /path/to/blog:/blog:ro \
  -v personal-website_uploads:/app/public/uploads \
  migrate npx tsx scripts/import-jekyll.ts --source /blog
```

It runs in the `migrate` service, not `app`, for the reason given at the top of
this file: the runtime image has no source tree and no `tsx`. The uploads volume
is mounted so that images copied out of the Jekyll tree land where the app will
serve them from.

Add `--dry-run` first to see what it would do. The importer is idempotent —
posts are matched on the slug the old site used — so re-running it updates
rather than duplicates.

## Updating

Push to `main`, wait for the **Publish images** workflow to go green, then:

```bash
cd /opt/personal-website
git pull                 # only for docker-compose.yml and .env.example changes
docker compose pull
docker compose up -d
```

`git pull` is still worth doing, but it no longer supplies the code that runs —
that arrives in the image. It keeps the compose file and any new settings in
`.env.example` up to date.

The `migrate` service runs first and the app waits for it. Watch both:

```bash
docker compose logs migrate
docker compose logs -f app
```

A failed migration leaves the old app container running and the new one
unstarted, which is the right way round: an unmigrated deploy never serves
traffic.

### Rolling back

Every build is also tagged with its commit SHA. To go back to one:

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG="<the-good-sha>"/' .env
docker compose pull && docker compose up -d
```

A rollback does **not** undo migrations. If the bad deploy migrated the
database, the older image may not understand the new schema — check what the
migration did before relying on this.

## Backups

The database is the only thing that cannot be rebuilt from the repository.
Uploaded files come second.

A nightly dump into the bind-mounted `docker/backups` directory:

```cron
0 3 * * * cd /opt/personal-website && docker compose exec -T postgres \
  pg_dump -U website personal_website | gzip > docker/backups/db-$(date +\%F).sql.gz
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
docker compose stop app
gunzip -c docker/backups/db-2026-08-26.sql.gz | \
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

## Putting a CDN in front

Caddy terminates TLS itself and obtains its own certificate. A proxying CDN in
front of it — Cloudflare with the orange cloud on, most commonly — changes that
arrangement in two ways that are worth understanding before switching it on,
because both fail in ways whose error messages point somewhere else.

### `ERR_TOO_MANY_REDIRECTS`

Cloudflare's **Flexible** SSL mode means "HTTPS to the browser, HTTP to the
origin". Caddy's automatic HTTPS answers any plain HTTP request with a 308 to
the HTTPS URL. So Cloudflare fetches over HTTP, gets a 308, hands it to the
browser, the browser asks again over HTTPS, Cloudflare fetches over HTTP
again — and around it goes.

Two things make this worse than it first looks:

- **A 308 is a permanent redirect, and browsers cache it.** Fixing the origin
  does not fix the browser, which replays the cached redirect without asking
  the server. Verify with `curl` (which ignores that cache) and test in a
  private window.
- This site sends HSTS with a one-year `max-age`. Once a browser has seen it,
  that browser will not speak plain HTTP to the domain again for a year. Clear
  it at `chrome://net-internals/#hsts` if a test needs HTTP.

Confirm whether requests are still arriving through the CDN by looking at who
solved the ACME challenge:

```bash
docker compose logs caddy | grep "served key authentication"
```

A `remote` in `104.16.0.0/13` or `172.64.0.0/13` is Cloudflare, not Let's
Encrypt: the proxy is on, whatever the dashboard appears to say.

### Certificate renewal, sixty days later

`tls-alpn-01` cannot work behind a proxy at all — the CDN terminates TLS, so
`acme-tls/1` can never be negotiated, and the log says exactly that.

`http-01` does work under Flexible, because the CDN forwards port 80 to the
origin's port 80 and Caddy serves `/.well-known/acme-challenge/` there without
redirecting. Under **Full** it forwards to port 443 instead, and whether the
challenge is still answered is not something to discover when the certificate
has two days left.

So: switching to Full to escape the redirect loop trades a visible failure for
a delayed one. If the site is to sit behind a proxy, do it properly with one of

- a **Cloudflare Origin Certificate** installed in Caddy — valid for years, no
  ACME involved; or
- the **DNS-01** challenge, which needs a Caddy image built with the
  Cloudflare DNS module (the stock `caddy:2-alpine` does not have it).

Otherwise leave the record unproxied. Caddy is perfectly capable of serving the
site directly, and the certificate then renews without anything in the way.
