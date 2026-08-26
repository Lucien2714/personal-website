# personal-website

Lucien's personal site: a bilingual blog with an admin console, a moments
stream, a project showcase that can embed other applications, reader sign-in
with comments, and a public REST API.

Built with Next.js 16 (App Router), TypeScript, PostgreSQL via Prisma, and
Tailwind CSS v4. Self-hosted with Docker Compose behind Caddy.

---

## Quick start

Requires Node.js 20.11+ and Docker.

```bash
git clone <this repo> personal-website
cd personal-website
npm install

cp .env.example .env
# Edit .env: set AUTH_SECRET (openssl rand -base64 48) and SEED_ADMIN_PASSWORD.

docker compose -f docker-compose.dev.yml up -d   # PostgreSQL
npm run db:migrate                                # create the schema
npm run db:seed                                   # admin account + settings
npm run dev
```

The site is then at <http://localhost:3000> and the console at
<http://localhost:3000/en/admin>, using the seed credentials from `.env`.

To bring content over from the old Jekyll blog:

```bash
npm run content:import -- --source ../blog          # add --dry-run first
```

---

## What is here

| Area | Route | Notes |
| --- | --- | --- |
| Home | `/{locale}` | Hero, latest posts, moments, featured projects |
| Posts | `/{locale}/posts` | Filter by category, tag or search; paginated |
| Post | `/{locale}/posts/{slug}` | Table of contents, syntax highlighting, maths |
| Moments | `/{locale}/moments` | Short dated notes with images |
| Projects | `/{locale}/projects` | Cards, and a sandboxed embed per project |
| Archives | `/{locale}/archives` | Everything by year |
| Pages | `/{locale}/{slug}` | Editable standalone pages, e.g. `/about` |
| Moment | `/{locale}/moments/{id}` | One moment and its thread |
| Sign in | `/{locale}/signin` | Reader sign-in via GitHub or Gitee |
| Console | `/{locale}/admin` | Staff only; readers are refused |
| API | `/api/v1` | Public reads, key-authenticated writes |
| Feed | `/feed.xml` | Both languages in one RSS document |

Both locales (`en`, `zh`) are always present in the URL. A post that exists in
only one language is still served to readers of the other, with a note saying
so.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Serve a production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, writing changes |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:studio` | Prisma Studio, a database browser |
| `npm run db:seed` | Admin account, settings, starter content |
| `npm run content:import` | Import a Jekyll blog (`-- --dry-run` to preview) |

Development helpers in `scripts/`:

- `dev-session.ts` prints a valid session cookie, for testing the console with
  curl.
- `dev-api-key.ts` mints an API key without opening the console.
- `dev-reset-content.ts` clears local content; `--all` clears posts too.
- `dev-reader.ts` creates a throwaway reader account and prints its session
  cookie, for checking what a reader can and cannot reach without standing up
  a real OAuth provider.
- `dev-seed-comments.ts` inserts a sample thread; `--clear` removes them.
- `set-password.ts` resets an account password. This one *is* allowed to run
  in production, because being locked out of the console is worse than the
  risk it carries.

All of them except `set-password.ts` refuse to run when `NODE_ENV=production`.

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — how the pieces fit together
  and why the significant choices were made.
- [`docs/api.md`](docs/api.md) — the public API, with worked examples.
- [`docs/deployment.md`](docs/deployment.md) — deploying to a VPS, backups,
  upgrades. Images are built by CI and pulled by the server; it never compiles.
- [`docs/content.md`](docs/content.md) — writing, publishing, moderating
  comments, and the Jekyll migration.
- [`docs/auth.md`](docs/auth.md) — reader sign-in, the role boundary, and
  adding an OAuth provider.

---

## Code style

The code follows the [Google TypeScript Style
Guide](https://google.github.io/styleguide/tsguide.html). The parts a machine
can check are enforced by ESLint (`eslint.config.mjs`) and Prettier; the parts
it cannot — comments that explain *why* rather than *what*, one clearly named
thing per module — are on the author.

Comments in this code base are for decisions and constraints. Where a comment
explains a trade-off, it also says what the alternative was, so that revisiting
it later does not mean rediscovering the reasoning from scratch.

---

## Licence

MIT. See [LICENSE](LICENSE).
