import {type AbstractIntlMessages, hasLocale} from 'next-intl';
import {getRequestConfig} from 'next-intl/server';

import {type AppLocale, routing} from '@/i18n/routing';

/**
 * Loads one locale's message catalogue.
 *
 * The dynamic import is untyped, so the cast is confined to this one function
 * rather than letting `any` spread through the request config.
 */
async function loadMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  const catalogue = (await import(`../messages/${locale}.json`)) as {
    default: AbstractIntlMessages;
  };
  return catalogue.default;
}

/**
 * Per-request i18n configuration.
 *
 * next-intl calls this for every server render to find out which language the
 * request is in and which message catalogue to load. The catalogues are
 * imported dynamically so that a page rendered in English never ships the
 * Chinese strings.
 */
export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    // All timestamps are stored in UTC; render them in the author's timezone
    // so that "posted today" means what the author meant by it.
    timeZone: 'America/Los_Angeles',
    now: new Date(),
  };
});
