# Writing and publishing

## The console

Sign in at `/{locale}/admin`. The sections:

| Section | What it holds |
| --- | --- |
| Dashboard | Counts, and the five most recently edited posts |
| Posts | Long-form writing, in both languages |
| Moments | Short dated notes with images |
| Projects | Portfolio entries, including embeds |
| Pages | Standalone pages such as About |
| Media | Uploaded files, with a copy-URL button |
| Comments | Moderation queue, and blocking a commenter |
| API keys | Credentials for your other projects |
| Settings | Avatar, hero copy, social links |

## Writing a post

The editor holds both language versions behind a pair of tabs and saves them
together. A tab whose title is empty is simply not stored, so writing in one
language is the default and translating later costs nothing extra.

Fields worth knowing:

- **Slug** — leave it blank and it is derived from the title. Chinese titles
  keep their characters rather than being transliterated into pinyin, so
  `/zh/posts/我的第一篇` stays readable. Changing a slug later breaks existing
  links.
- **Description** — used on cards, in search results and in the RSS feed. Left
  blank, the first couple of sentences are used.
- **Publish at** — a future time with status *Scheduled* publishes itself when
  that time passes. There is no cron job involved: "published" is defined as
  *status is published or scheduled, and the timestamp has passed*.
- **Preview** — renders through the same pipeline used when saving, including
  the sanitiser, so what you see is what will be stored.

### Markdown

GitHub-flavoured Markdown, plus:

- Fenced code with syntax highlighting (Shiki, light and dark themes emitted
  together and swapped with the site theme).
- Maths: `$inline$` and `$$display$$`, rendered with KaTeX.
- Tables, footnotes, task lists, strikethrough.
- Headings get anchor links automatically, and `##`/`###` build the table of
  contents.

Raw HTML in the body is **dropped**, not escaped. That is deliberate: the
editor is Markdown, and embedding an application is what the project embed
feature exists for.

### Images

Drag one into the media library, copy its URL, and reference it normally:

```markdown
![The prediction chart](/uploads/2026/08/chart-a1b2c3d4.png)
```

Uploads are content-addressed, so the same file uploaded twice is stored once.

## Moments

The composer is one textarea, a mood, an optional place and up to nine images.
It is deliberately minimal — the value of a moment is that posting one takes
seconds. Anything that wants structure is a post.

Moments are not translated.

## Projects and embeds

A project is a portfolio card. Give it an **embed URL** and its page also
renders that URL in a sandboxed iframe, which is how another of your
applications appears inside this site.

The iframe grants `allow-scripts allow-forms allow-popups` and withholds
`allow-same-origin`, so the embedded page cannot reach this document. Build the
embedded view as a self-contained panel; see [`api.md`](api.md#embedding-a-project-in-the-site).

## Comments

Readers sign in with GitHub or Gitee and comment on posts, moments and
projects. Setting the providers up is covered in [auth.md](auth.md).

### The default policy

Every comment is published immediately. That is defensible here because
signing in is required: a spammer needs a real GitHub or Gitee account per
identity, not just a script. Posting is also rate limited to five comments a
minute per account.

If that stops being enough, **Settings** has `commentModeration`:

| Value | Behaviour |
| --- | --- |
| `none` | Published immediately (default) |
| `first-post` | A person's first comment waits for you; after one is approved, the rest go straight through |
| `all` | Everything waits |

Changing it takes effect on the next comment. Nothing already published is
affected, and no migration is involved.

### Moderating

The **Comments** section lists every comment by status - pending, published,
spam, deleted - with counts, so an empty queue is visible without clicking
into it. Each row can be approved, marked spam, or deleted.

Nothing is hard-deleted. A hidden comment stays in the table so the decision
is reversible, and so its author is not told which of their comments
disappeared. A reply whose parent is hidden is promoted to the top level
rather than vanishing with it - the answer may stand on its own.

**Block** hides everything a person has written and stops them writing more.
They can still sign in; only posting is withdrawn. Refusing the sign-in
outright would make the block obvious and invite a second account.

### What a comment may contain

A deliberately narrow subset of Markdown: bold, italics, links, inline code,
code blocks, quotes, lists and strikethrough. Headings, images, tables and
raw HTML are stripped - a comment should not be able to restructure the page
it sits on, and an image in a comment is the usual tracking-pixel vector.

Outgoing links get `rel="nofollow ugc noopener noreferrer"`, so commenting
here is worth nothing for search ranking.

## Migrating from the Jekyll blog

```bash
npm run content:import -- --source ../blog --dry-run   # preview
npm run content:import -- --source ../blog             # do it
```

What it does:

1. Reads `_posts/*.md` and `_drafts/*.md`.
2. Maps Chirpy front matter (`title`, `description`, `categories`, `tags`,
   `pin`, `date`, `image`) onto the post model.
3. **Reuses the Jekyll slug**, so `/posts/my-post/` keeps working — the locale
   middleware redirects it to `/en/posts/my-post`.
4. Guesses each post's language from its share of CJK characters, unless the
   front matter has a `lang` field.
5. Rewrites `/assets/img/...` references to `/images/...` and copies the files.
6. Imports `_tabs/about.md` as the About page.

It is idempotent: posts are matched on slug, so re-running updates them in
place. If you have edited a post in the console since importing it, re-running
the import will overwrite those edits.

### After importing

- Check categories and tags in the console; Jekyll's were free text and may
  contain near-duplicates.
- Add Chinese translations where you want them; untranslated posts are still
  served to Chinese readers with a note.
- Set a cover image on anything that should have one — Chirpy's front matter
  rarely carried them.

## Settings

Under **Settings**: avatar, author name, hero headline and subline (per
language), footer social links, and the source-repository link.

The About page is content, not settings — edit it under **Pages**. Its
navigation position is the `Nav order` field; leave it blank to hide the page
from the header while keeping it reachable by URL.
