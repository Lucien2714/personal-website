/**
 * Imports content from the old Jekyll (Chirpy) blog into the database.
 *
 * Usage:
 *   npm run content:import -- [--source ../blog] [--dry-run]
 *
 * The script is idempotent. Posts are matched on the slug derived from the
 * Jekyll filename, which is also the slug the old site used, so re-running it
 * updates the existing rows instead of creating duplicates and every old URL
 * keeps working.
 *
 * What it does:
 *   1. Reads `_posts/*.md` and `_drafts/*.md`.
 *   2. Maps Chirpy front matter onto the Post model.
 *   3. Rewrites `/assets/img/...` references to `/images/...` and copies the
 *      referenced files into `public/`.
 *   4. Imports `_tabs/about.md` as the About page.
 */

// Populates process.env from .env before any module reads it.
import 'dotenv/config';

import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {copyFile, mkdir, readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import matter from 'gray-matter';

import type {Locale, PublishStatus} from '../src/generated/prisma/enums.js';
import {db} from '../src/lib/db.js';
import {savePage, savePost} from '../src/lib/content/authoring.js';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

/** Command-line options. */
interface Options {
  /** Root of the Jekyll site to read from. */
  source: string;
  /** When true, report what would happen without writing anything. */
  dryRun: boolean;
}

/** Parses `--source` and `--dry-run` out of `process.argv`. */
function parseOptions(argv: string[]): Options {
  const sourceIndex = argv.indexOf('--source');
  const source =
    sourceIndex >= 0 && argv[sourceIndex + 1]
      ? path.resolve(argv[sourceIndex + 1] as string)
      : path.resolve(projectRoot, '..', 'blog');

  return {source, dryRun: argv.includes('--dry-run')};
}

/** Front matter fields Chirpy uses that this importer understands. */
interface ChirpyFrontMatter {
  title?: string;
  description?: string;
  date?: string | Date;
  categories?: string | string[];
  tags?: string | string[];
  pin?: boolean;
  image?: {path?: string} | string;
  lang?: string;
}

/** Coerces a Chirpy scalar-or-list field into a list. */
function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return (Array.isArray(value) ? value : [value])
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
}

/**
 * Derives the slug and date from a Jekyll filename.
 *
 * Jekyll names posts `YYYY-MM-DD-title-words.md`, and Chirpy publishes them at
 * `/posts/title-words/`. Reusing that slug is what keeps inbound links alive.
 */
function parseFilename(filename: string): {slug: string; date: Date | null} {
  const base = filename.replace(/\.(md|markdown)$/i, '');
  const match = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/.exec(base);

  if (!match) {
    return {slug: base, date: null};
  }

  const [, year, month, day, rest] = match;
  return {
    slug: rest ?? base,
    date: new Date(`${year}-${month}-${day}T00:00:00Z`),
  };
}

/** Guesses the language of a document from its share of CJK characters. */
function detectLocale(text: string): Locale {
  const cjk = text.match(/[㐀-䶿一-鿿]/g)?.length ?? 0;
  // A few Chinese words inside an English post should not flip the language;
  // a genuinely Chinese post is overwhelmingly CJK.
  return cjk > text.length * 0.15 ? 'ZH' : 'EN';
}

/** An asset copy queued while rewriting a document body. */
interface AssetCopy {
  from: string;
  to: string;
}

/**
 * Rewrites Jekyll asset URLs to their new home and records what to copy.
 *
 * Chirpy serves images from `/assets/img/...`; this site serves them from
 * `/images/...`. Rewriting at import time means the stored Markdown needs no
 * special handling later.
 */
function rewriteAssetPaths(
  body: string,
  sourceRoot: string,
): {body: string; assets: AssetCopy[]} {
  const assets: AssetCopy[] = [];

  const rewritten = body.replace(
    /(\]\(|["'])\/assets\/img\/([^)"'\s]+)/g,
    (_match, prefix: string, relativePath: string) => {
      const from = path.join(sourceRoot, 'assets', 'img', relativePath);
      if (existsSync(from)) {
        assets.push({
          from,
          to: path.join(projectRoot, 'public', 'images', relativePath),
        });
      }
      return `${prefix}/images/${relativePath}`;
    },
  );

  return {body: rewritten, assets};
}

/** Reads every Markdown file in a directory, ignoring placeholders. */
async function readMarkdownDir(dir: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = await readdir(dir);
  return entries.filter((entry) => /\.(md|markdown)$/i.test(entry));
}

/** Copies an asset, creating parent directories as needed. */
async function copyAsset(asset: AssetCopy): Promise<void> {
  await mkdir(path.dirname(asset.to), {recursive: true});
  await copyFile(asset.from, asset.to);
}

/**
 * Finds the account that imported content should be attributed to.
 *
 * @throws {Error} When the database has no users, which means `db:seed` has
 *     not been run yet.
 */
async function resolveAuthorId(): Promise<string> {
  const author = await db.user.findFirst({
    where: {role: 'ADMIN'},
    orderBy: {createdAt: 'asc'},
    select: {id: true},
  });

  if (!author) {
    throw new Error(
      'No admin user found. Run `npm run db:seed` before importing.',
    );
  }

  return author.id;
}

/** Imports the posts in one directory. */
async function importPosts(
  dir: string,
  status: PublishStatus,
  options: Options,
  authorId: string,
): Promise<number> {
  const files = await readMarkdownDir(dir);
  let imported = 0;

  for (const file of files) {
    const raw = await readFile(path.join(dir, file), 'utf8');
    const parsed = matter(raw);
    const front = parsed.data as ChirpyFrontMatter;

    const {slug, date: filenameDate} = parseFilename(file);
    const title = front.title?.trim() || slug;

    const {body, assets} = rewriteAssetPaths(parsed.content, options.source);
    const locale =
      front.lang === 'zh'
        ? 'ZH'
        : front.lang === 'en'
          ? 'EN'
          : detectLocale(body);

    // Front matter dates win over the filename because Chirpy writes a full
    // timestamp with a timezone offset there.
    const publishedAt = front.date ? new Date(front.date) : filenameDate;

    const coverPath =
      typeof front.image === 'string' ? front.image : front.image?.path;

    console.log(
      `  ${options.dryRun ? '[dry-run] ' : ''}${slug}  (${locale}, ${status})`,
    );

    if (options.dryRun) {
      imported += 1;
      continue;
    }

    for (const asset of assets) {
      await copyAsset(asset);
    }

    // Look for an existing import so that re-running updates in place.
    const existing = await db.postTranslation.findUnique({
      where: {locale_slug: {locale, slug}},
      select: {postId: true},
    });

    await savePost({
      id: existing?.postId,
      authorId,
      status,
      publishedAt: status === 'PUBLISHED' ? publishedAt : null,
      pinned: front.pin === true,
      coverUrl: coverPath
        ? coverPath.replace(/^\/assets\/img\//, '/images/')
        : null,
      categories: toList(front.categories),
      tags: toList(front.tags),
      translations: [
        {
          locale,
          title,
          slug,
          description: front.description?.trim() ?? null,
          bodyMarkdown: body.trim(),
        },
      ],
    });

    imported += 1;
  }

  return imported;
}

/** Imports `_tabs/about.md` as the About page. */
async function importAboutPage(options: Options): Promise<boolean> {
  const aboutPath = path.join(options.source, '_tabs', 'about.md');
  if (!existsSync(aboutPath)) {
    return false;
  }

  const parsed = matter(await readFile(aboutPath, 'utf8'));
  const front = parsed.data as ChirpyFrontMatter;
  const {body, assets} = rewriteAssetPaths(parsed.content, options.source);

  console.log(`  ${options.dryRun ? '[dry-run] ' : ''}about`);
  if (options.dryRun) {
    return true;
  }

  for (const asset of assets) {
    await copyAsset(asset);
  }

  await savePage({
    slug: 'about',
    status: 'PUBLISHED',
    navOrder: 40,
    icon: 'info',
    translations: [
      {
        locale: 'EN',
        title: front.title?.trim() || 'About',
        // The Chirpy page repeats its title as an H1; the layout renders the
        // title itself, so drop the duplicate.
        bodyMarkdown: body.replace(/^#\s+.+\n+/, '').trim(),
      },
    ],
  });

  return true;
}

/** Reports the checksum of a file, used to confirm asset copies. */
async function checksum(file: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
    .slice(0, 12);
}

/** Entry point. */
async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  if (!existsSync(options.source)) {
    throw new Error(`Source directory not found: ${options.source}`);
  }

  console.log(`Importing from ${options.source}`);
  if (options.dryRun) {
    console.log('Dry run: no changes will be written.\n');
  }

  const authorId = options.dryRun ? 'dry-run' : await resolveAuthorId();

  console.log('\nPosts:');
  const posts = await importPosts(
    path.join(options.source, '_posts'),
    'PUBLISHED',
    options,
    authorId,
  );

  console.log('\nDrafts:');
  const drafts = await importPosts(
    path.join(options.source, '_drafts'),
    'DRAFT',
    options,
    authorId,
  );

  console.log('\nPages:');
  const aboutImported = await importAboutPage(options);

  // Copy the avatar too, if the target does not already have one.
  const avatarSource = path.join(options.source, 'assets', 'img', 'avatar.png');
  const avatarTarget = path.join(projectRoot, 'public', 'images', 'avatar.png');
  if (existsSync(avatarSource) && !options.dryRun) {
    await copyAsset({from: avatarSource, to: avatarTarget});
    console.log(`\nAvatar copied (sha256:${await checksum(avatarTarget)})`);
  }

  console.log(
    `\nDone. ${posts} post(s), ${drafts} draft(s), ` +
      `${aboutImported ? '1' : '0'} page(s).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('\nImport failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
