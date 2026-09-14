import { DEFAULT_POLICY, DEFAULT_SETTINGS } from '../src/constants';
import type { BadgePolicy, CheckItem, Checklist, Settings } from '../src/types';

export function settings(over: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...over };
}

export function policy(over: Partial<BadgePolicy> = {}): BadgePolicy {
  return { ...DEFAULT_POLICY, ...over };
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
