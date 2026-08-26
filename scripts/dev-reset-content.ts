/**
 * Clears content from a development database, leaving accounts and settings.
 *
 *   npx tsx scripts/dev-reset-content.ts [--all]
 *
 * By default it removes moments, sessions and API keys - the things a local
 * experiment tends to leave behind. `--all` additionally removes posts, pages,
 * projects, media rows and taxonomy, which is the quickest way back to a
 * freshly seeded state before re-running the Jekyll import.
 *
 * It refuses to run in production. There is no confirmation prompt because
 * there is no scenario in which this should be pointed at real data.
 */

// Populates process.env from .env before any module reads it.
import 'dotenv/config';

import {db} from '../src/lib/db.js';

/** Entry point. */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to delete content in production.');
  }

  const all = process.argv.includes('--all');

  const [moments, sessions, keys] = await Promise.all([
    db.moment.deleteMany({}),
    db.session.deleteMany({}),
    db.apiKey.deleteMany({}),
  ]);

  console.log(
    `Removed ${moments.count} moment(s), ${sessions.count} session(s), ` +
      `${keys.count} API key(s).`,
  );

  if (!all) {
    return;
  }

  // Translations and join rows cascade from their parents, so only the
  // parents need deleting - and posts must go before the taxonomy they
  // reference.
  const posts = await db.post.deleteMany({});
  const pages = await db.page.deleteMany({});
  const projects = await db.project.deleteMany({});
  const media = await db.media.deleteMany({});
  const categories = await db.category.deleteMany({});
  const tags = await db.tag.deleteMany({});

  console.log(
    `Removed ${posts.count} post(s), ${pages.count} page(s), ` +
      `${projects.count} project(s), ${media.count} media row(s), ` +
      `${categories.count} category(ies), ${tags.count} tag(s).`,
  );
  console.log(
    'Files under UPLOAD_DIR were left on disk; delete them by hand if needed.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
