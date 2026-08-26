import {cache} from 'react';
import {z} from 'zod';

import {db} from '@/lib/db';

/**
 * Editable site settings.
 *
 * Anything an owner might reasonably want to change without a deploy lives
 * here: the avatar, the social links, the sentence on the home page. The
 * values are stored in a single `site_settings` row keyed by `site`, parsed
 * through a schema with defaults, so a missing or half-filled row degrades to
 * sensible values instead of an error.
 */

/** One entry in the social links list. */
const socialLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  /** Icon identifier understood by src/components/ui/SocialIcon.tsx. */
  icon: z
    .enum(['github', 'twitter', 'bilibili', 'mail', 'rss', 'link'])
    .default('link'),
});

/** Free-text fields that differ per language. */
const localisedTextSchema = z.object({
  en: z.string().default(''),
  zh: z.string().default(''),
});

const siteSettingsSchema = z.object({
  avatarUrl: z.string().default('/images/avatar.png'),
  authorName: z.string().default('Lucien Chen'),
  authorEmail: z.string().default('lucien2714@gmail.com'),
  /** Short greeting shown in the home page hero. */
  heroHeadline: localisedTextSchema.default({en: '', zh: ''}),
  heroSubline: localisedTextSchema.default({en: '', zh: ''}),
  socialLinks: z.array(socialLinkSchema).default([]),
  /** Repository URL shown in the footer. Empty hides the link. */
  sourceRepoUrl: z.string().default(''),
  // --- Comments ------------------------------------------------------
  /** Master switch. Turning it off hides every comment section at once. */
  commentsEnabled: z.boolean().default(true),
  /**
   * When a submitted comment becomes visible.
   *
   * Kept as a setting rather than a constant so the policy can be
   * tightened from the console the day it is needed, without a deploy and
   * without a migration. Sign-in is required either way, which is what
   * makes `none` a defensible default: a spammer needs a real GitHub or
   * Gitee account per identity, not just a script.
   */
  commentModeration: z.enum(['none', 'first-post', 'all']).default('none'),
  /** Where a comment box appears. */
  commentsOnPosts: z.boolean().default(true),
  commentsOnMoments: z.boolean().default(true),
  commentsOnProjects: z.boolean().default(true),
  /**
   * Days after publication before comments close. Zero keeps them open
   * forever, which is the default; old posts attract spam, so this exists
   * for the day that becomes a nuisance.
   */
  commentsCloseAfterDays: z.number().int().min(0).max(3650).default(0),

  /** Analytics snippet identifier; empty disables analytics entirely. */
  umamiWebsiteId: z.string().default(''),
  umamiHost: z.string().default(''),
});

/** Fully resolved site settings. */
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/** Primary key of the settings row. */
const SETTINGS_KEY = 'site';

/**
 * Loads the site settings.
 *
 * Wrapped in React's request-scoped `cache`, so the header, the footer and the
 * page body share one query per render rather than three.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const row = await db.siteSetting.findUnique({where: {key: SETTINGS_KEY}});
  const parsed = siteSettingsSchema.safeParse(row?.value ?? {});

  // A malformed row must not take the whole site down; fall back to defaults
  // and let the console show the owner what is wrong.
  return parsed.success ? parsed.data : siteSettingsSchema.parse({});
});

/**
 * Writes the site settings.
 *
 * @param input Partial settings; unspecified keys keep their current value.
 * @returns The settings as stored after the merge.
 */
export async function updateSiteSettings(
  input: Partial<SiteSettings>,
): Promise<SiteSettings> {
  const current = await getSiteSettings();
  const merged = siteSettingsSchema.parse({...current, ...input});

  await db.siteSetting.upsert({
    where: {key: SETTINGS_KEY},
    create: {key: SETTINGS_KEY, value: merged},
    update: {value: merged},
  });

  return merged;
}

export {siteSettingsSchema};
