/**
 * Localization.
 *
 * `LABELS` in constants.ts stays the compile-time English and the only source of
 * truth for the string SET. This module routes each lookup through Trello's
 * localizer when one is available and falls back to `LABELS` when it is not,
 * so a missing, half-loaded or never-initialised localizer degrades to English
 * rather than to an exception or an empty badge.
 *
 * API shapes here are taken from Atlassian's client-library localization docs:
 *  - `t.localizeKey(key, data)` is SYNCHRONOUS and returns a string. That is what
 *    makes it usable from `computeBadges`, which must stay pure and sync.
 *  - `TrelloPowerUp.util.initLocalizer(locale, { localization })` returns a
 *    Promise and must resolve before the first `localizeKey` call in an iframe.
 *  - resource files are flat JSON with `{placeholder}` replacement.
 *
 * [Inferred] Trello's behaviour on a MISSING key is not documented. We treat a
 * result that is empty or exactly equal to the key as a miss and fall back. Our
 * keys are camelCase identifiers, never real copy, so a genuine translation can
 * never collide with one.
 */

import { LABELS } from './constants';
import type { TrelloT } from './trello';

export type LabelKey = keyof typeof LABELS;
export type LocalizeData = Record<string, string | number>;

/** Synchronous by contract. Callers may rely on this: `computeBadges` does. */
export type Localize = (key: LabelKey, data?: LocalizeData) => string;

/**
 * Passed to `TrelloPowerUp.initialize` and `TrelloPowerUp.iframe`. `en` is the
 * only locale we actually ship; adding one is a file in `public/strings/` plus
 * one entry here, and no code change anywhere else. That is the whole point.
 */
export const LOCALIZATION = {
  defaultLocale: 'en',
  supportedLocales: ['en'],
  resourceUrl: './strings/{locale}.json',
} as const;

/** Single-pass `{key}` replacement. Single-pass so a value containing braces cannot recurse. */
export function interpolate(template: string, data?: LocalizeData): string {
  if (!data) return template;
  return template.replace(/\{(\w+)\}/g, (match: string, key: string) =>
    Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : match,
  );
}

/** The compile-time English. Also the fallback for every other path in this file. */
export const english: Localize = (key, data) => interpolate(LABELS[key], data);

/**
 * A localizer bound to one `t`. Every call is guarded: `t` may predate the
 * localizer, `localizeKey` may be absent on an older client library, and the
 * resource fetch may have failed. None of those may break a badge.
 */
export function localizer(t: Pick<TrelloT, 'localizeKey'>): Localize {
  return (key, data) => {
    try {
      const out = t.localizeKey?.(key, data);
      if (typeof out === 'string' && out.length > 0 && out !== key) return out;
    } catch {
      /* fall through to English */
    }
    return english(key, data);
  };
}

/**
 * Iframe entry point. Resolves the resource bundle, then hands back a localizer.
 * Never rejects: a failed bundle load yields the English localizer, because a
 * settings popup in English beats a settings popup that did not render.
 */
export async function initIframeLocalizer(t: TrelloT): Promise<Localize> {
  try {
    const init = globalThis.TrelloPowerUp?.util?.initLocalizer;
    if (typeof init === 'function') {
      const locale = (globalThis as { locale?: string }).locale ?? LOCALIZATION.defaultLocale;
      await init(locale, { localization: LOCALIZATION });
    }
  } catch {
    return english;
  }
  return localizer(t);
}
