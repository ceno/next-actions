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

  /**
   * Target width for a padded item badge, measured in non-breaking spaces.
   *
   * A width, not a character count, because the two are not interchangeable: a
   * non-breaking space advances ~3.35px while an average glyph advances ~6.14px,
   * so padding every badge to the same NUMBER of characters makes a long one
   * almost twice as wide as a short one. The first attempt did exactly that, and
   * short items landed correctly while "Book hotels and such" overshot into the
   * clamp and grew a trailing ellipsis.
   *
   * Measured on a live 256px card whose only native badge was Trello's `1/2` -
   * the worst case, since the fewer native badges there are the wider ours must
   * be to be pushed off their line:
   *
   *   width    own line?   Trello's ellipsis?
   *   153px    no          no
   *   180px    YES         no
   *   221px    YES         no
   *   228px    YES         YES   <- clamped, draws a visible "..."
   *
   * So the usable window is ~180-221px, and 60 nbsp (~200px) sits in the middle.
   * Text already wider than this is left alone: `padToWidth` only ever pads, and
   * a long item name is wide enough to break the line on its own.
   *
   * A heuristic tied to card width, font and zoom. If badges stop breaking to
   * their own line, or grow a trailing "...", re-measure and change it here.
   */
  itemPadWidth: 60,
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
  // S1, RESOLVED 2026-09-15 on a live board. Was `false` to match the observed
  // vendor behaviour, with SPEC.md noting it was "cheap to flip once someone
  // looks at a real board". Someone did: on a single-checklist card our header
  // badge restates Trello's own `☑ n/m` and adds only the checklist name, which
  // is most often the useless default "Checklist". 130 of the 132 checklist-
  // bearing cards on that board have exactly one checklist, so the header was
  // pure duplication on 98% of them.
  //
  // Kept scoped to the single-checklist case rather than dropping headers
  // outright: with two or more checklists Trello's native badge shows only the
  // COMBINED total, so the per-checklist name and progress are the only way to
  // tell which checklist an item belongs to. That is information, not noise.
  suppressRedundantSingleHeader: true,

  // Requested from a real board: a short next action like "book flights" sits on
  // the same line as Trello's native `1/2`, which reads as a continuation of it
  // rather than as its own thing. Trello exposes no layout control at all, so a
  // fixed-width pad is the only way to force the break - see `padToWidth`.
  itemsOnOwnLine: true,
};

/**
 * SPEC.md 5.5, REVISED 2026-09-15. `showIncompleteItems` now defaults ON.
 *
 * It was off because Trello's own card-front checklist expansion (28 Apr 2026)
 * can duplicate and contradict item badges, which made coloured progress pills
 * the safe zero-config state. That reasoning was sound and the conclusion was
 * still wrong: the pills are the thing Trello ALREADY does, so the default
 * withheld the only output this Power-Up exists to produce. A user who enables
 * "Next Actions" and sees `2/5` has been shown nothing they did not have.
 *
 * The duplication risk is real and is handled where it belongs - the user can
 * turn items off, and `incompleteItemLimit` keeps one card from flooding the
 * front. E4 measures the collision with native output on a real board.
 */
export const DEFAULT_SETTINGS: Settings = {
  v: 1,
  showHeaders: true,
  progressFormat: 'fraction',
  finishedColor: 'green',
  unfinishedColor: 'orange',
  hideCompletedChecklists: false,
  checklistLimit: 'all',
  showIncompleteItems: true,
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
  appName: 'Next Actions',
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

  // Badge tooltips. These are user-visible and were previously hardcoded inside
  // `badges.ts`; they live here so the wording firewall (SPEC.md 5.2) and the
  // localizer both apply to them. `{...}` placeholders match the replacement
  // syntax Trello's own localizer uses, so one template serves both paths.
  tooltipChecklist: '{name} — {done} of {total} items finished',
  tooltipItemFinished: '{name} — finished',
  tooltipItemUnfinished: '{name} — not finished',
  /** Used only when a checklist or item has an empty name; a tooltip never starts with a dash. */
  fallbackChecklistName: 'Checklist',
  fallbackItemName: 'Item',

  // authorize.html. Path B only.
  authorizeIntro: "Next Actions needs read access to this board's checklists.",
  authorizeConnect: 'Connect',
  authorizeConnected: 'Connected. Refresh the board to see the change.',
  authorizeFailed: 'Could not connect: {error}',
} as const;
