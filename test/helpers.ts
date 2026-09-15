import { DEFAULT_POLICY, DEFAULT_SETTINGS } from '../src/constants';
import type { BadgePolicy, CheckItem, Checklist, Settings } from '../src/types';

export function settings(over: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...over };
}

/**
 * The shipped defaults with item badges turned off.
 *
 * `showIncompleteItems` defaults ON since 2026-09-15 - the item text is the
 * product. Tests whose subject is the HEADER badge pin items off through this,
 * so each assertion keeps one subject instead of restating the item output.
 * A test that says "by default" about ITEMS must use `settings()`, not this.
 */
export function headersOnly(over: Partial<Settings> = {}): Settings {
  return settings({ showIncompleteItems: false, ...over });
}

export function policy(over: Partial<BadgePolicy> = {}): BadgePolicy {
  return { ...DEFAULT_POLICY, ...over };
}

/**
 * The shipped policy with S1 turned OFF, so a single-checklist fixture still
 * emits its header.
 *
 * `suppressRedundantSingleHeader` defaults ON since 2026-09-15, which means the
 * one-checklist fixtures most header tests use would emit nothing at all. Tests
 * whose subject is header FORMATTING - the progress string, the colour, the
 * tooltip - pin it off through this, exactly as `headersOnly` pins items off.
 * A test that says "by default" about SUPPRESSION must use `policy()`.
 */
export function unsuppressed(over: Partial<BadgePolicy> = {}): BadgePolicy {
  return policy({ suppressRedundantSingleHeader: false, ...over });
}

/** `'x'` = complete, `'o'` = incomplete. `list('Transport', 'xoo')` reads at a glance. */
export function list(name: string, pattern: string, pos = 1, idPrefix = name): Checklist {
  const items: CheckItem[] = [...pattern].map((c, i) => ({
    id: `${idPrefix}-${i}`,
    name: `${idPrefix} item ${i}`,
    complete: c === 'x',
    pos: i + 1,
  }));
  return { id: idPrefix, name, pos, items };
}

export const texts = (badges: { text: string }[]): string[] => badges.map((b) => b.text);
