import type { BadgeCaps, BadgePolicy, Limit, Settings } from './types';

/**
 * Unicode text glyphs, not icons. Deliberate: externally-hosted badge icons were
 * broken platform-wide by a CORS change in April 2023, and an icon-free design
 * cannot be broken that way (SPEC.md 2.9).
 */
export const GLYPH_COMPLETE = '☑'; // BALLOT BOX WITH CHECK
export const GLYPH_INCOMPLETE = '☐'; // BALLOT BOX
export const ELLIPSIS = '…';

/**
 * SPEC.md 5.6. Both values are guesses: Trello documents no maximum badge count
 * and no text length limit. E3 measures them. Changing them is a one-line change
 * here and nowhere else.
 */
export const DEFAULT_CAPS: BadgeCaps = {
  maxBadges: 20,
  maxTextLength: 64,
};

/**
 * SPEC.md 7. Every default is PLAN.md's stated assumption where it states one -
 * we do not stack a second guess on top of the first.
 */
export const DEFAULT_POLICY: BadgePolicy = {
  ordering: 'position', // A1
  checklistGatesItems: true, // A2
  itemLimitScope: 'per-checklist', // A3
  percentRounding: 'round', // A4
  emptyChecklistIsComplete: true, // A5
  suppressRedundantSingleHeader: false, // S1 - matches the observed behaviour
};

/**
 * SPEC.md 5.5. `showIncompleteItems` is off by default on purpose: since Trello
 * shipped native card-front checklist expansion (28 Apr 2026), item badges can
 * duplicate and contradict native output. The zero-config state is coloured
 * progress pills, which is the thing native does not do.
 */
export const DEFAULT_SETTINGS: Settings = {
  v: 1,
  showHeaders: true,
  progressFormat: 'fraction',
  finishedColor: 'green',
  unfinishedColor: 'orange',
  hideCompletedChecklists: false,
  checklistLimit: 'all',
  showIncompleteItems: false,
  incompleteItemLimit: 3,
  showCompletedItems: false,
};

/** A7. Invention - only `all` and `1` were ever observed. */
export const LIMIT_CHOICES: readonly Limit[] = ['all', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The member-scope / private-visibility budget, per Trello's documented limit. */
export const SETTINGS_MAX_CHARS = 4096;

/** Storage key. Board-scoped variants append `:<boardId>` if A6 resolves that way. */
export const SETTINGS_KEY = 'nextActions';

/**
 * User-facing copy. Every string lives here so that (a) nothing is hardcoded at a
 * string site and (b) routing it through Trello's localizer later touches one file.
 * Wording is deliberately ours - see SPEC.md 5.2.
 */
export const LABELS = {
  sectionCards: 'What appears on cards',
  showHeaders: 'Show checklist name and progress',
  progressFormat: 'Progress as',
  progressFraction: 'Fraction (2/3)',
  progressPercent: 'Percentage (67%)',
  finishedColor: 'Colour when finished',
  unfinishedColor: 'Colour when unfinished',
  hideCompletedChecklists: 'Hide finished checklists',
  checklistLimit: 'Most checklists to show',
  sectionItems: 'Which items to show',
  showIncompleteItems: 'Show unfinished items',
  incompleteItemLimit: 'Most unfinished items to show',
  showCompletedItems: 'Show finished items too',
  save: 'Save',
  clear: 'Clear my settings',
  savedNeedsRefresh: 'Saved. Refresh the board to see the change.',
  unauthorized: 'Connect your account',
  colorNone: 'No colour',
  limitAll: 'All',
} as const;
