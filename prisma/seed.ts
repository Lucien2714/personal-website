/**
 * Seeds the database with the minimum a fresh install needs to be usable:
 * an administrator account, the site settings, and a starting About page.
 *
 * Safe to re-run. Existing rows are updated rather than duplicated, and the
 * admin password is only ever set when the account is first created, so a
 * later seed cannot silently reset a password you have changed.
 *
 * Usage: npm run db:seed
 */

// Populates process.env from .env before any module reads it.
import 'dotenv/config';

import {hashPassword, MIN_PASSWORD_LENGTH} from '../src/lib/auth/password.js';
import {savePage, saveProject} from '../src/lib/content/authoring.js';
import {updateSiteSettings} from '../src/lib/content/settings.js';
import {db} from '../src/lib/db.js';

/** Reads a required environment variable. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set before seeding. Copy .env.example to .env first.`,
    );
  }
  return value;
}

/** Creates the administrator account if it does not exist yet. */
async function seedAdmin(): Promise<string> {
  const email = requireEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const displayName = process.env.SEED_ADMIN_NAME ?? 'Site Owner';

  const existing = await db.user.findUnique({where: {email}});
  if (existing) {
    console.log(`  admin ${email} already exists, leaving password untouched`);
    return existing.id;
  }

  const password = requireEnv('SEED_ADMIN_PASSWORD');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  const created = await db.user.create({
    data: {
      email,
      displayName,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
      avatarUrl: '/images/avatar.png',
    },
  });

  console.log(`  created admin ${email}`);
  return created.id;
}

/** Writes the default site settings, preserving anything already customised. */
async function seedSettings(): Promise<void> {
  await updateSiteSettings({
    avatarUrl: '/images/avatar.png',
    authorName: process.env.SEED_ADMIN_NAME ?? 'Lucien Chen',
    authorEmail: process.env.SEED_ADMIN_EMAIL ?? '',
    heroHeadline: {
      en: 'Hey, I am Lucien',
      zh: '你好，我是 Lucien',
    },
    heroSubline: {
      en: 'CS student at UC San Diego. I build things with machine learning, play too much Apex, and write it all down here.',
      zh: 'UCSD 计算机在读。用机器学习做点东西，打太多 Apex，然后把这些都写下来。',
    },
    socialLinks: [
      {
        label: 'GitHub',
        url: 'https://github.com/lucien2714',
        icon: 'github',
      },
      {
        label: 'X',
        url: 'https://twitter.com/luci3n2714',
        icon: 'twitter',
      },
      {
        label: 'Bilibili',
        url: 'https://space.bilibili.com/73180703',
        icon: 'bilibili',
      },
      {
        label: 'Email',
        url: 'mailto:lucien2714@gmail.com',
        icon: 'mail',
      },
    ],
    sourceRepoUrl: '',
  });

  console.log('  site settings written');
}

/**
 * Creates the About page when none exists.
 *
 * The Jekyll importer overwrites this with the real content; this exists so
 * that a database seeded without the old blog still has a working About link.
 */
async function seedAboutPage(): Promise<void> {
  const existing = await db.page.findUnique({where: {slug: 'about'}});
  if (existing) {
    console.log('  about page already exists, skipping');
    return;
  }

  await savePage({
    slug: 'about',
    status: 'PUBLISHED',
    navOrder: 40,
    icon: 'info',
    translations: [
      {
        locale: 'EN',
        title: 'About',
        bodyMarkdown: [
          'Hi, I am **Lucien Chen**, a Computer Science student at UC San Diego.',
          '',
          'I am interested in artificial intelligence, machine learning,',
          'reinforcement learning, software engineering and game AI. Outside of',
          'technology I follow esports closely; my current main game is *Apex',
          'Legends*.',
          '',
          'This site is where I keep technical notes, personal projects and the',
          'occasional record of daily life.',
        ].join('\n'),
      },
      {
        locale: 'ZH',
        title: '关于',
        bodyMarkdown: [
          '你好，我是 **Lucien Chen**，加州大学圣地亚哥分校计算机专业在读。',
          '',
          '我关注人工智能、机器学习、强化学习、软件工程和游戏 AI。技术之外',
          '我是电竞爱好者，目前主玩 *Apex Legends*。',
          '',
          '这个站点用来放技术笔记、个人项目，以及一些日常记录。',
        ].join('\n'),
      },
    ],
  });

  console.log('  about page created');
}

/** Adds the Apex predictor project, which doubles as an embed example. */
async function seedProject(): Promise<void> {
  const existing = await db.project.findUnique({
    where: {slug: 'apex-predator-rp-predictor'},
  });
  if (existing) {
    console.log('  sample project already exists, skipping');
    return;
  }

  await saveProject({
    slug: 'apex-predator-rp-predictor',
    status: 'PUBLISHED',
    featured: true,
    sortOrder: 0,
    liveUrl: 'https://pred.lucien2714.com',
    techStack: ['Python', 'Machine Learning', 'Web'],
    translations: [
      {
        locale: 'EN',
        name: 'Apex Predator RP Threshold Predictor',
        summary:
          'Estimates where the Apex Legends Predator cutoff will land at the end of a season, from historical rank-point data.',
      },
      {
        locale: 'ZH',
        name: 'Apex 猎杀者 RP 分数线预测',
        summary:
          '基于历史排位分数据，预测 Apex Legends 赛季末猎杀者分数线的落点。',
      },
    ],
  });

  console.log('  sample project created');
}

/** Entry point. */
async function main(): Promise<void> {
  console.log('Seeding database:');
  await seedAdmin();
  await seedSettings();
  await seedAboutPage();
  await seedProject();
  console.log('Done.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
