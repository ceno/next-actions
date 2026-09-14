/**
 * Settings load / save / migrate, and the form-enablement matrix.
 *
 * Storage rules that are not negotiable (SPEC.md 2.7, 5.3):
 *  - one key, one object, one `t.set` call. Shared-storage writes are not atomic
 *    and collide silently, last-write-wins, with no error to catch;
 *  - member scope, private visibility;
 *  - the stringified object must stay under 4096 characters.
 */

import { DEFAULT_SETTINGS, SETTINGS_KEY, SETTINGS_MAX_CHARS } from './constants';
import type { BadgeColorSetting, Limit, Settings } from './types';
import { BADGE_COLORS } from './types';
import type { TrelloT } from './trello';

export const CURRENT_VERSION = 1;

/** A6 is unresolved: member scope may or may not persist across boards (SPEC.md 7). */
export type SettingsScope = 'member-global' | 'member-per-board';

export function storageKey(scope: SettingsScope, boardId?: string): string {
  return scope === 'member-global' || !boardId ? SETTINGS_KEY : `${SETTINGS_KEY}:${boardId}`;
}

// --- validation --------------------------------------------------------------

const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

function limit(v: unknown, d: Limit): Limit {
  if (v === 'all') return 'all';
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v);
  return d;
}

function color(v: unknown, d: BadgeColorSetting): BadgeColorSetting {
  if (v === 'none') return 'none';
  return (BADGE_COLORS as readonly string[]).includes(v as string) ? (v as BadgeColorSetting) : d;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], d: T): T {
  return allowed.includes(v as T) ? (v as T) : d;
}

/**
 * Accepts anything. An invalid field falls back to its default rather than
 * rejecting the whole object, and an unreadable blob yields DEFAULT_SETTINGS
 * silently: a user whose settings fail to parse gets a working board, not an
 * error badge.
 *
 * Unknown fields are dropped. That is lossy across a downgrade, and deliberate -
 * carrying unknown keys forward would silently eat the 4096-character budget.
 */
export function migrate(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return { ...d };
  const r = raw as Record<string, unknown>;

  return {
    v: CURRENT_VERSION,
    showHeaders: bool(r['showHeaders'], d.showHeaders),
    progressFormat: oneOf(r['progressFormat'], ['fraction', 'percent'] as const, d.progressFormat),
    finishedColor: color(r['finishedColor'], d.finishedColor),
    unfinishedColor: color(r['unfinishedColor'], d.unfinishedColor),
    hideCompletedChecklists: bool(r['hideCompletedChecklists'], d.hideCompletedChecklists),
    checklistLimit: limit(r['checklistLimit'], d.checklistLimit),
    showIncompleteItems: bool(r['showIncompleteItems'], d.showIncompleteItems),
    incompleteItemLimit: limit(r['incompleteItemLimit'], d.incompleteItemLimit),
    showCompletedItems: bool(r['showCompletedItems'], d.showCompletedItems),
  };
}

export function serialize(settings: Settings): string {
  return JSON.stringify(settings);
}

export function withinBudget(settings: Settings): boolean {
  return serialize(settings).length <= SETTINGS_MAX_CHARS;
}

// --- persistence -------------------------------------------------------------

export async function loadSettings(
  t: TrelloT,
  scope: SettingsScope = 'member-global',
  boardId?: string,
): Promise<Settings> {
  try {
    const raw = await t.get('member', 'private', storageKey(scope, boardId));
    return migrate(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * One object, one call. Never split across keys - two `t.set` calls can override
 * one another with no error.
 */
export async function saveSettings(
  t: TrelloT,
  settings: Settings,
  scope: SettingsScope = 'member-global',
  boardId?: string,
): Promise<void> {
  if (!withinBudget(settings)) throw new Error('settings exceed the 4096-character budget');
  await t.set('member', 'private', { [storageKey(scope, boardId)]: settings });
}

/**
 * `remove-data` gives roughly 500ms to act. Call `t.getAll()` first if the data
 * is needed; on Path B this is also where the REST token is dropped.
 */
export async function clearSettings(t: TrelloT, keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => t.remove('member', 'private', k).catch(() => undefined)));
}

// --- form state --------------------------------------------------------------

/**
 * The enablement matrix is real logic, not markup (delivery review F20). A
 * control whose parent is off is meaningless, and two of them - the colour
 * pickers - become dead controls the moment headers are hidden.
 */
export interface FormState {
  showHeaders: boolean;
  progressFormat: boolean;
  finishedColor: boolean;
  unfinishedColor: boolean;
  hideCompletedChecklists: boolean;
  checklistLimit: boolean;
  showIncompleteItems: boolean;
  incompleteItemLimit: boolean;
  showCompletedItems: boolean;
}

export function deriveFormState(s: Settings): FormState {
  const anyBadges = s.showHeaders || s.showIncompleteItems || s.showCompletedItems;
  return {
    showHeaders: true,
    progressFormat: s.showHeaders,
    finishedColor: s.showHeaders,
    unfinishedColor: s.showHeaders,
    // The checklist filter still matters with headers off: under A2's default it
    // gates items too, so it is not dead just because no header renders.
    hideCompletedChecklists: anyBadges,
    checklistLimit: anyBadges,
    showIncompleteItems: true,
    incompleteItemLimit: s.showIncompleteItems,
    showCompletedItems: true,
  };
}

export function isDirty(a: Settings, b: Settings): boolean {
  return serialize(a) !== serialize(b);
}
