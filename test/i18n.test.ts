import { describe, expect, it } from 'vitest';

import { computeBadges } from '../src/badges';
import { LABELS } from '../src/constants';
import {
  english,
  interpolate,
  localizer,
  LOCALIZATION,
  type LabelKey,
  type Localize,
} from '../src/i18n';
import type { TrelloT } from '../src/trello';
import { list, settings, unsuppressed } from './helpers';

/**
 * Every bundle on disk, by path. A glob rather than a read of one known file, so
 * that an orphaned bundle - a locale shipped but never declared, which would
 * never be fetched - is a test failure and not a mystery.
 */
const bundles = import.meta.glob<Record<string, string>>('../public/strings/*.json', {
  eager: true,
  import: 'default',
});

const localeOf = (path: string): string => path.replace(/^.*\/(.+)\.json$/, '$1');

const bundle = (locale: string): Record<string, string> => {
  const found = bundles[`../public/strings/${locale}.json`];
  if (!found) throw new Error(`no bundle shipped for declared locale '${locale}'`);
  return found;
};

describe('the en bundle', () => {
  /**
   * LABELS is the compile-time English and the only source of truth for the
   * string SET; en.json is what Trello's localizer actually fetches. If they
   * drift, every string silently falls back and nobody notices, because the
   * fallback is correct English. This test is the only thing that catches it.
   */
  it('matches LABELS exactly, key for key and value for value', () => {
    expect(bundle('en')).toEqual({ ...LABELS });
  });

  it('ships a file for every locale it claims to support', () => {
    for (const locale of LOCALIZATION.supportedLocales) {
      expect(Object.keys(bundle(locale)).length).toBeGreaterThan(0);
    }
  });

  it('ships no bundle it does not declare', () => {
    const shipped = Object.keys(bundles).map(localeOf).sort();
    expect(shipped).toEqual([...LOCALIZATION.supportedLocales].sort());
  });

  /**
   * A translation may lag, and `localizer` falls back per key, so a short bundle
   * is survivable. An EXTRA key is not survivable in the same way: it means a
   * string was translated that no longer exists, and nobody will ever see it.
   */
  it('has no key in any bundle that LABELS does not define', () => {
    const known = new Set(Object.keys(LABELS));
    for (const [path, strings] of Object.entries(bundles)) {
      const orphans = Object.keys(strings).filter((k) => !known.has(k));
      expect({ path, orphans }).toEqual({ path, orphans: [] });
    }
  });

  it('resourceUrl carries the {locale} placeholder the client library substitutes', () => {
    expect(LOCALIZATION.resourceUrl).toContain('{locale}');
    expect(LOCALIZATION.supportedLocales).toContain(LOCALIZATION.defaultLocale);
  });
});

describe('interpolate', () => {
  it('replaces every named placeholder', () => {
    expect(interpolate('{a} and {b}', { a: 'x', b: 'y' })).toBe('x and y');
  });

  it('stringifies numbers, so counts can be passed as counts', () => {
    expect(interpolate('{done}/{total}', { done: 1, total: 3 })).toBe('1/3');
  });

  it('leaves an unknown placeholder alone rather than emitting "undefined"', () => {
    expect(interpolate('{a} {b}', { a: 'x' })).toBe('x {b}');
  });

  it('is single-pass: a value containing braces is never re-expanded', () => {
    expect(interpolate('{a}', { a: '{a}' })).toBe('{a}');
  });

  it('returns the template untouched when there is no data', () => {
    expect(interpolate('plain')).toBe('plain');
  });
});

/** A `t` carrying only what the localizer touches. */
const fakeT = (localizeKey?: TrelloT['localizeKey']): Pick<TrelloT, 'localizeKey'> =>
  localizeKey ? { localizeKey } : {};

describe('localizer', () => {
  it('prefers what Trello returns', () => {
    const L = localizer(fakeT(() => 'Ações Seguintes'));
    expect(L('appName')).toBe('Ações Seguintes');
  });

  it('passes the replacement data through to Trello', () => {
    const seen: unknown[] = [];
    const L = localizer(
      fakeT((key, data) => {
        seen.push([key, data]);
        return 'ok';
      }),
    );
    L('tooltipChecklist', { name: 'Transport', done: 1, total: 3 });
    expect(seen).toEqual([['tooltipChecklist', { name: 'Transport', done: 1, total: 3 }]]);
  });

  // Every one of these is a real state: an older client library, a bundle that
  // 404ed, a key present in en.json but missing from a translation.
  it('falls back to English when localizeKey is absent', () => {
    expect(localizer(fakeT())('save')).toBe(LABELS.save);
  });

  it('falls back to English when localizeKey throws', () => {
    const L = localizer(
      fakeT(() => {
        throw new Error('localizer not initialised');
      }),
    );
    expect(L('save')).toBe(LABELS.save);
  });

  it('falls back to English on an empty result', () => {
    expect(localizer(fakeT(() => ''))('save')).toBe(LABELS.save);
  });

  it('falls back to English when the result is just the key echoed back', () => {
    expect(localizer(fakeT((key) => key))('save')).toBe(LABELS.save);
  });

  it('still interpolates when it falls back', () => {
    const L = localizer(fakeT());
    expect(L('tooltipChecklist', { name: 'Transport', done: 1, total: 3 })).toBe(
      'Transport — 1 of 3 items finished',
    );
  });
});

describe('english', () => {
  it('resolves every key in LABELS to a non-empty string', () => {
    for (const key of Object.keys(LABELS) as LabelKey[]) {
      expect(english(key).length).toBeGreaterThan(0);
    }
  });
});

describe('computeBadges honours an injected localizer', () => {
  const shout: Localize = (key, data) => english(key, data).toUpperCase();

  it('routes the checklist tooltip through it', () => {
    const out = computeBadges([list('Transport', 'xoo')], settings(), unsuppressed(), undefined, shout);
    expect(out[0]!.title).toBe('TRANSPORT — 1 OF 3 ITEMS FINISHED');
  });

  it('routes the item tooltip through it', () => {
    const out = computeBadges(
      [list('Transport', 'xo')],
      settings({ showHeaders: false, showIncompleteItems: true, showCompletedItems: true }),
      undefined,
      undefined,
      shout,
    );
    expect(out.map((b) => b.title)).toEqual([
      'TRANSPORT ITEM 0 — FINISHED',
      'TRANSPORT ITEM 1 — NOT FINISHED',
    ]);
  });

  it('defaults to English, so every existing call site is unchanged', () => {
    const out = computeBadges([list('Transport', 'xoo')], settings(), unsuppressed());
    expect(out[0]!.title).toBe('Transport — 1 of 3 items finished');
  });

  it('names an unnamed checklist rather than opening the tooltip with a dash', () => {
    const out = computeBadges([list('', 'o')], settings(), unsuppressed());
    expect(out[0]!.title).toBe('Checklist — 0 of 1 items finished');
  });

  it('names an unnamed item the same way', () => {
    const bare = { id: 'i', name: '', complete: false, pos: 1 };
    const out = computeBadges(
      [{ id: 'c', name: 'C', pos: 1, items: [bare] }],
      settings({ showHeaders: false, showIncompleteItems: true }),
    );
    expect(out[0]!.title).toBe('Item — not finished');
  });
});
