/**
 * Domain types for Next Actions.
 *
 * These are OURS. They are deliberately not Trello's shapes: the client library's
 * checklist object is entirely undocumented and has been observed to change
 * (SPEC.md 2.4). Every data source adapts into these types at its boundary, and
 * `computeBadges` never sees anything else.
 */

/** The complete set of colours Trello accepts on a card badge. Names, never hexes. */
export const BADGE_COLORS = [
  'blue',
  'green',
  'orange',
  'red',
  'yellow',
  'purple',
  'pink',
  'sky',
  'lime',
  'light-gray',
] as const;

export type BadgeColor = (typeof BADGE_COLORS)[number];

/** `'none'` means "emit the badge with no colour field", which renders as a plain grey pill. */
export type BadgeColorSetting = BadgeColor | 'none';

export interface CheckItem {
  id: string;
  name: string;
  complete: boolean;
  /** Sort key. Compared, never interpreted. Ties break by id so ordering is total. */
  pos: number;
}

export interface Checklist {
  id: string;
  name: string;
  pos: number;
  items: CheckItem[];
}

/** What `card-badges` returns. `color` omitted => uncoloured badge. */
export interface Badge {
  text: string;
  color?: BadgeColor;
  /** Hover tooltip. Also the accessible long form: no state is conveyed by colour or glyph alone. */
  title?: string;
}

/** A count limit. `'all'` is unbounded; a number is a cap. */
export type Limit = number | 'all';

/** User-facing settings. Persisted as one object; see SPEC.md 5.3. */
export interface Settings {
  v: 1;

  // Header badges
  showHeaders: boolean;
  progressFormat: 'fraction' | 'percent';
  finishedColor: BadgeColorSetting;
  unfinishedColor: BadgeColorSetting;
  hideCompletedChecklists: boolean;
  checklistLimit: Limit;

  // Item badges
  showIncompleteItems: boolean;
  incompleteItemLimit: Limit;
  showCompletedItems: boolean;
}

/**
 * The unresolved behaviours A1-A5 plus S1, as named options rather than silent
 * hardcodes (SPEC.md 7). None of these is a user setting. Each has a provisional
 * default and a live experiment that closes it; until those run, every default
 * here is a guess that is wrong on some real board.
 */
export interface BadgePolicy {
  /** A1. Checklist and item order. Unresolved: every artefact fits both readings. */
  ordering: 'position' | 'complete-first';
  /** A2. Does hiding a checklist also hide its items? */
  checklistGatesItems: boolean;
  /** A3. Is the incomplete-item limit a per-checklist or a per-card budget? */
  itemLimitScope: 'per-checklist' | 'per-card';
  /** A4. Percentage rounding. Undecidable from artefacts. */
  percentRounding: 'round' | 'floor';
  /** A5. Does a checklist with no items count as complete? Undecidable from artefacts. */
  emptyChecklistIsComplete: boolean;
  /** S1. On a single-checklist card the header duplicates Trello's own badge. Suppress it? */
  suppressRedundantSingleHeader: boolean;
}

/** Hard internal caps. Not settings; they win over every user choice, including `'all'`. */
export interface BadgeCaps {
  maxBadges: number;
  /** Counted in code points, so a surrogate pair is never split. */
  maxTextLength: number;
}
