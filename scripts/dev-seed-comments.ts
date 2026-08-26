/**
 * Inserts a sample thread on the newest post, for checking how comments look.
 *
 *   npx tsx scripts/dev-seed-comments.ts
 *   npx tsx scripts/dev-seed-comments.ts --clear
 *
 * Writes through the same renderer the real action uses, so what appears is
 * what a reader would actually get.
 */

// Populates process.env from .env before any module reads it.
import 'dotenv/config';

import {renderComment} from '../src/lib/content/comment-markdown.js';
import {db} from '../src/lib/db.js';

/** Entry point. */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed comments in production.');
  }

  if (process.argv.includes('--clear')) {
    const {count} = await db.comment.deleteMany({});
    console.log(`Removed ${count} comment(s).`);
    return;
  }

  const post = await db.post.findFirst({
    where: {status: 'PUBLISHED', deletedAt: null},
    orderBy: {publishedAt: 'desc'},
    select: {id: true},
  });
  const reader = await db.user.findFirst({
    where: {role: 'READER'},
    select: {id: true},
  });
  const staff = await db.user.findFirst({
    where: {role: 'ADMIN'},
    select: {id: true},
  });

  if (!post || !reader || !staff) {
    throw new Error('Need a published post, a reader and an admin first.');
  }

  const top = await renderComment(
    'Nice write-up. Does the model handle **split resets** explicitly, or is that folded into the trend?\n\n- I ask because late-season data looks discontinuous\n- See [the ALS page](https://apexlegendsstatus.com/points-for-predator)',
  );
  const parent = await db.comment.create({
    data: {
      postId: post.id,
      authorId: reader.id,
      bodyMarkdown: 'seed',
      bodyHtml: top.html,
      status: 'PUBLISHED',
    },
    select: {id: true},
  });

  const answer = await renderComment(
    'Good question — splits are detected as large drops and labelled, so each segment is modelled on its own. `split_31` in the post is one of those.',
  );
  await db.comment.create({
    data: {
      postId: post.id,
      authorId: staff.id,
      parentId: parent.id,
      bodyMarkdown: 'seed',
      bodyHtml: answer.html,
      status: 'PUBLISHED',
    },
  });

  const pending = await renderComment('This one is awaiting review.');
  await db.comment.create({
    data: {
      postId: post.id,
      authorId: reader.id,
      bodyMarkdown: 'seed',
      bodyHtml: pending.html,
      status: 'PENDING',
    },
  });

  console.log('Seeded 1 comment, 1 reply and 1 pending comment.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
