# Public API

`/api/v1` exists so that your other projects can read from and write to this
site without sharing a database or a code base.

- **Reads** are public and CORS-enabled. No key needed.
- **Writes** need an API key with the matching scope.
- Machine-readable description: `GET /api/v1/openapi.json` (OpenAPI 3.1).
- Service index: `GET /api/v1` lists every endpoint and what it requires.

---

## Response envelope

Success:

```json
{
  "data": [ ... ],
  "meta": {"page": 1, "perPage": 20, "total": 34, "totalPages": 2}
}
```

`meta` is present on list endpoints only.

Failure:

```json
{
  "error": {
    "code": "bad_request",
    "message": "The request body failed validation.",
    "details": [{"path": "body", "message": "Too small: expected string to have >=1 characters"}]
  }
}
```

`code` is stable and safe to branch on. `message` is for a human reading a log
and may be reworded at any time.

| Code | HTTP |
| --- | --- |
| `bad_request` | 400 |
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `payload_too_large` | 413 |
| `unsupported_media_type` | 415 |
| `rate_limited` | 429 |
| `internal_error` | 500 |

---

## Authentication

Create a key in the console under **API keys**, or locally:

```bash
npx tsx scripts/dev-api-key.ts --name my-bot --scopes posts:write,media:write
```

The key is displayed once and is not recoverable. Send it as a bearer token:

```
Authorization: Bearer pws_xxxxxxxxxxxxxxxxxxxx
```

### Scopes

| Scope | Grants |
| --- | --- |
| `posts:read` | Reserved; reads are public today |
| `posts:write` | Create posts |
| `moments:read` | Reserved |
| `moments:write` | Post moments |
| `projects:read` | Reserved |
| `projects:write` | Reserved for future project writes |
| `media:write` | Upload files |

Grant the narrowest set that works. A key that only posts moments should not
be able to upload files.

---

## Rate limits

120 requests per minute by default (`API_RATE_LIMIT_PER_MINUTE`), counted per
API key when authenticated and per client address otherwise. Every response
carries:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1756195200
```

A refused request also carries `Retry-After`, in seconds.

The counter lives in the application process. With the single-container
deployment in `docker/` that is exact; behind two replicas each would keep its
own budget.

---

## Endpoints

### `GET /api/v1/posts`

| Parameter | Default | Notes |
| --- | --- | --- |
| `locale` | `en` | `en` or `zh` |
| `page` | `1` | |
| `perPage` | `20` | capped at 100 |
| `category` | — | category slug |
| `tag` | — | tag slug |
| `q` | — | case-insensitive match on title and description |

```bash
curl "https://lucien2714.com/api/v1/posts?locale=zh&tag=ml&perPage=5"
```

### `GET /api/v1/posts/{slug}`

Returns one post including its rendered, sanitised HTML — enough to mirror a
post elsewhere without re-implementing the Markdown pipeline.

### `POST /api/v1/posts` — needs `posts:write`

```bash
curl -X POST https://lucien2714.com/api/v1/posts \
  -H "Authorization: Bearer $PWS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PUBLISHED",
    "categories": ["Personal Project"],
    "tags": ["ML", "Apex Legends"],
    "translations": [
      {
        "locale": "EN",
        "title": "Predictor update: week 12",
        "bodyMarkdown": "## What changed\n\nThe model now..."
      },
      {
        "locale": "ZH",
        "title": "预测器更新：第 12 周",
        "bodyMarkdown": "## 这次改了什么\n\n模型现在..."
      }
    ]
  }'
```

Notes:

- `slug` is optional; it is derived from the title and made unique.
- Categories and tags are supplied by **name**, and created if they do not
  exist.
- Omitting `publishedAt` on a `PUBLISHED` post means "now". A future
  `publishedAt` with status `SCHEDULED` goes live on its own, with no cron job.
- The post is attributed to the key's owner.

### `GET /api/v1/moments`, `POST /api/v1/moments`

Writing needs `moments:write`. This is the endpoint to point a phone shortcut
or a bot at:

```bash
curl -X POST https://lucien2714.com/api/v1/moments \
  -H "Authorization: Bearer $PWS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": "Ranked grind, day three.", "mood": "🎮", "location": "San Diego"}'
```

### `GET /api/v1/posts/{slug}/comments`

The published thread on a post, threaded one level deep. Email addresses are
never included; the author fields are exactly what the site itself renders.

Read-only. Posting a comment needs a **reader session**, not an API key: a
comment is attributed to a person, and a key belongs to a program, so letting
a key write one would mean either inventing an author or attributing every
comment to the site owner.

```bash
curl "https://lucien2714.com/api/v1/posts/my-post/comments"
```

### `GET /api/v1/projects`, `GET /api/v1/projects/{slug}`

`featured=true` restricts the list. Useful in reverse: a project's own site can
pull its description and links from here rather than keeping a second copy.

### `GET /api/v1/pages/{slug}`

Standalone pages such as `about`, with rendered HTML.

### `GET /api/v1/categories`, `GET /api/v1/tags`

Terms that have at least one published post, with counts.

### `POST /api/v1/media` — needs `media:write`

```bash
curl -X POST https://lucien2714.com/api/v1/media \
  -H "Authorization: Bearer $PWS_KEY" \
  -F file=@screenshot.png \
  -F altText="The prediction chart"
```

Returns `201` with an absolute URL, or `200` when an identical file was already
stored (`"deduplicated": true`). PNG, JPEG, GIF, WebP, AVIF and SVG are
accepted, up to `UPLOAD_MAX_BYTES` (10 MiB by default).

---

## Embedding a project in the site

The other half of "open for second-party development": set a project's
**embed URL** in the console, and the project page renders it in a sandboxed
iframe.

The frame is sandboxed with `allow-scripts allow-forms allow-popups` and
deliberately **without** `allow-same-origin`, so an embedded page cannot reach
the parent document. Design the embedded view accordingly:

- It must work in an iframe — no `X-Frame-Options: DENY` on that route.
- It cannot read cookies from this origin, and should not need to.
- Give it its own compact layout; it is a panel, not a page.
- Set an explicit height, or accept the 520 px default.

---

## Notes for client authors

- Timestamps are ISO 8601 in UTC.
- URLs in responses are absolute, built from `NEXT_PUBLIC_SITE_URL`.
- Slugs may contain non-ASCII characters; percent-encode them in paths.
- A post that exists in only one language is still returned when you ask for
  the other. Check the `locale` field on each item if that matters to you.
