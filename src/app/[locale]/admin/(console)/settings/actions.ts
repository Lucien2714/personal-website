'use server';

import {revalidatePath} from 'next/cache';

import {requireUserForAction} from '@/lib/auth/guard';
import {
  type SiteSettings,
  siteSettingsSchema,
  updateSiteSettings,
} from '@/lib/content/settings';

/** Server action behind the settings screen. */

/** What the settings form receives back. */
export type SaveSettingsResult =
  {ok: true; settings: SiteSettings} | {ok: false; message: string};

/**
 * Writes the site settings.
 *
 * Validation reuses the same schema the read path parses with, so a value that
 * saves is by construction a value that loads.
 *
 * @param input The settings form's payload.
 */
export async function saveSettingsAction(
  input: unknown,
): Promise<SaveSettingsResult> {
  await requireUserForAction();

  const parsed = siteSettingsSchema.partial().safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ') || 'Invalid input.',
    };
  }

  try {
    const settings = await updateSiteSettings(parsed.data);
    revalidatePath('/', 'layout');
    return {ok: true, settings};
  } catch (error) {
    console.error('[admin] saveSettingsAction failed', error);
    return {ok: false, message: 'The settings could not be saved.'};
  }
}
