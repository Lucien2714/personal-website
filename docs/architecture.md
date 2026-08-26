# Architecture

How the site is put together, and why.

## The shape of it

```
Browser
   │
   ├── Caddy ──────────── TLS, compression, cache headers, X-Forwarded-For
   │      │
   │      └── Next.js (standalone server, one container)
   │             │
   │             ├── src/proxy.ts        locale routing, cheap admin gate
   │             ├── src/app/[locale]/   pages, rendered per request
   │             ├── src/app/api/v1/     public REST API
   │             └── src/lib/            all the logic that is not a route
   │                    │
   │                    └── Prisma ── PostgreSQL (one container)
   │
   └── /uploads/* ─────── files on a Docker volume, served as static assets
```

Everything runs on one host. There is no queue, no cache tier and no object
store, because a personal site with one author does not have the traffic to
justify the operational surface any of them would add. Where that assumption
is load-bearing, the code says so — see the note at the top of
`src/lib/api/rate-limit.ts`.

## Rendering

Every page that reads the database sets `export const dynamic = 'force-dynamic'`.

The alternative — incremental static regeneration with `revalidateTag` calls
in the write paths — would cut database load substantially. It is not used
because correctness on publish matters more here than throughput: the author
should see a new post the moment it is saved, without a stale window to reason
about. If traffic ever makes this the wrong trade, the change is localised:
swap the `dynamic` exports for `revalidate`, and add tag invalidation to
`src/lib/content/authoring.ts`.

Markdown is rendered **once, at save time**, and the resulting HTML is stored
next to its source. A post page therefore costs one query and a string
interpolation. The cost is paid where it is cheap (a save, a few times a week)
rather than where it is not (a read, every visit).

## Data model

`prisma/schema.prisma` is the reference; the shape worth knowing is the split
between a language-neutral "trunk" row and one `*Translation` row per locale.

```
Post          ── ownership, status, publish time, pinning, taxonomy
  └─ PostTranslation (EN)  ── slug, title, Markdown, rendered HTML, TOC
  └─ PostTranslation (ZH)  ── the same fields, in the other language
```

Duplicating whole posts per language would have been simpler to write and
worse to live with: a change to the publish date, the cover or the categories
would need applying twice, and the two copies would drift. With this split,
every language-independent fact has exactly one home.

`Moment` deliberately has no translations. A moment is a quick thought, and
requiring a second language would stop it being quick.

## Language handling

Two representations of a language exist: the URL segment (`en`, `zh`) and the
Prisma enum (`EN`, `ZH`). Both conversions live in `src/i18n/routing.ts` and
nowhere else.

Reads use a fallback rule, implemented once in `src/lib/content/posts.ts`: ask
for a locale, get that translation if it exists and any other one otherwise,
with an `isFallback` flag so the page can tell the reader what happened. A
missing translation is therefore a smaller problem than a 404.

## Authentication

Two populations share one session mechanism: **staff**, who run the site, and
**readers**, who signed in to comment. [auth.md](auth.md) covers the boundary
in full; the shape of it is two layers doing different jobs:

- `src/proxy.ts` runs at the edge and checks only that a session **cookie
  exists**. It cannot verify the token, because the Edge runtime has no
  database. It is an optimisation — it saves rendering a page that is about to
  redirect — and is never the only check.
- `src/lib/auth/guard.ts` runs on the server, verifies the JWT, looks the
  session up, confirms it is neither revoked nor expired, **and checks the
  role**. This is the real gate, and every console page and server action calls
  it. A single list, `STAFF_ROLES`, decides who counts as staff.

Console server actions call `requireStaffForAction()` **individually**, not by
relying on the layout. A server action is a public HTTP endpoint in its own
right; anyone who learns its identifier can invoke it directly, and the
layout's check never runs. Comment actions call `requireReaderForAction()`,
which admits any signed-in, unblocked account.

Sessions are JWTs (stateless, cheap to verify) paired with a row in `sessions`
(revocable). Only a hash of the token id is stored, so a database dump yields
nothing replayable.

## Comments

Readers sign in through OAuth and comment; see [auth.md](auth.md) for the
identity side. The parts worth knowing here:

- **A separate, much narrower Markdown pipeline.**
  `src/lib/content/comment-markdown.ts` permits inline emphasis, links,
  code, quotes and lists, and strips headings, images, tables and raw HTML.
  A comment that can render an `<h2>` competes with the article above it,
  and an image in a comment is the standard tracking-pixel vector. Links get
  `rel="nofollow ugc"`, which removes the incentive to comment for ranking.

- **One target model, three columns.** A comment points at a post, a moment
  or a project through three nullable foreign keys rather than a
  `targetType`/`targetId` pair. That costs a little discipline - exactly one
  must be set, enforced in `src/lib/content/comments.ts` - and buys real
  referential integrity: deleting a post takes its comments with it, which a
  polymorphic pair cannot express.

- **Threads are two levels deep.** A reply to a reply attaches to the same
  parent. Arbitrary nesting is unreadable on a phone, and the indentation
  budget runs out long before the conversation does.

- **Nothing is hard-deleted.** A hidden comment stays in the table so the
  decision is reversible and so its author is not told which of their
  comments vanished. A reply whose parent is hidden is promoted to the top
  level rather than disappearing with it: the answer may stand on its own.

- **Moderation is a setting, not a constant.** `commentModeration` is
  `none` by default - sign-in is required either way, so a spammer needs a
  real GitHub or Gitee account per identity - and can be tightened to
  `first-post` or `all` from the console without a deploy or a migration.

## The public API

`src/lib/api/handler.ts` wraps every `/api/v1` route in the same chain:
authenticate → rate limit → validate body → run → attach headers. Endpoints
receive a request whose input has already been checked, and failures always
come back in the same envelope.

Reads are public and CORS-enabled; they never touch cookies, so a wildcard
origin is safe. Writes require an API key with the matching scope. Keys are
shown once at creation and stored only as a SHA-256 digest.

`/api/v1/media` is the one route that does not use the shared wrapper, because
it takes `multipart/form-data` rather than JSON. The duplication is called out
in that file.

## Embedding other projects

A `Project` row may carry an `embedUrl`. When it does, the project page renders
that URL in an iframe with:

- `sandbox` granting only scripts, forms and popups. `allow-same-origin` is
  **absent by design**: with it, an embedded page served from this origin could
  reach into the parent document and read the admin session cookie.
- `referrerPolicy="no-referrer"`, so the reader's current path stays out of the
  embedded application's logs.
- A plain link beside it, so a blocked frame still leaves a way through.

This is the seam the site is built around: another project appears here without
either code base depending on the other. The API is the same seam in the other
direction — a project can pull its own description and links from
`/api/v1/projects`.

## Uploads

Bytes go to `UPLOAD_DIR` (a Docker volume); a `Media` row indexes them. Files
are content-addressed by SHA-256, so uploading the same image twice returns the
first copy.

Uploaded files are served from this origin, which makes an uploaded SVG a
script-execution vector. `next.config.ts` therefore serves `/uploads/*` under a
`Content-Security-Policy` that permits no script at all.

## Where the rules live

Each of these exists in exactly one place, and that is the point:

| Rule | Module |
| --- | --- |
| What "published" means | `src/lib/content/posts.ts` |
| Language fallback | `src/lib/content/posts.ts` |
| Slug generation and uniqueness | `src/lib/utils/slug.ts` |
| Markdown → HTML, TOC, reading time | `src/lib/content/markdown.ts` |
| How content is written | `src/lib/content/authoring.ts` |
| Locale ↔ enum conversion | `src/i18n/routing.ts` |
| Environment validation | `src/lib/env.ts` |
| Who counts as staff | `src/lib/auth/guard.ts` |
| What a comment may contain | `src/lib/content/comment-markdown.ts` |
| Which comments are visible | `src/lib/content/comments.ts` |
| API request handling | `src/lib/api/handler.ts` |

`authoring.ts` in particular is shared by the console, the API and the Jekyll
importer. All three therefore produce identical rows, and a new rule is one
edit rather than three.

## Testing

`tests/` covers pure logic: password hashing, slug generation, the Markdown
pipeline, rate limiting. It does not start a database or a browser — that would
turn a two-second feedback loop into a two-minute one, and the code most likely
to break silently is exactly the pure code.

CI additionally applies the migrations against a real PostgreSQL service and
checks that `schema.prisma` and `prisma/migrations/` have not drifted apart.
