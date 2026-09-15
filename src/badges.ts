/**
 * computeBadges - the whole product, as a pure function.
 *
 * Domain checklists + settings in, badge array out. No Trello imports, no I/O,
 * no async, no clock, no randomness. This is the only part of Next Actions that
 * can be fully built and fully tested without Trello, so it carries all of the
 * logic that can possibly live here.
 *
 * Everything genuinely unresolved (SPEC.md 7, A1-A5) is a field on BadgePolicy,
 * never a silent hardcode.
 */

import {
  DEFAULT_CAPS,
  DEFAULT_POLICY,
  ELLIPSIS,
  GLYPH_COMPLETE,
  GLYPH_INCOMPLETE,
} from './constants';
import { english, type Localize } from './i18n';
import type {
  Badge,
  BadgeCaps,
  BadgeColorSetting,
  BadgePolicy,
  CheckItem,
  Checklist,
  Limit,
  Settings,
} from './types';

/**
 * `localize` is a plain synchronous function, so passing it keeps this module
 * pure: same inputs, same output, still no I/O and still no `t`. i18n.ts imports
 * Trello's types only with `import type`, which erases, so nothing Trello-shaped
 * reaches this file at runtime.
 */
export function computeBadges(
  checklists: readonly Checklist[],
  settings: Settings,
  policy: BadgePolicy = DEFAULT_POLICY,
  caps: BadgeCaps = DEFAULT_CAPS,
  localize: Localize = english,
): Badge[] {
  const ordered = orderChecklists(checklists, policy);

  // Checklist-level filter, then the checklist cap. "Visible" gates the header
  // badge always, and gates the items only if A2 says checklist visibility is
  // inherited by items.
  const admitted = settings.hideCompletedChecklists
    ? ordered.filter((c) => !isComplete(c, policy))
    : ordered;
  const visibleIds = new Set(
    admitted.slice(0, asCount(settings.checklistLimit)).map((c) => c.id),
  );

  const suppressHeaders =
    policy.suppressRedundantSingleHeader && checklists.length === 1;

  // A3: with a per-card budget the remaining allowance is carried across
  // checklists in emission order; with a per-checklist budget each checklist
  // starts from the full limit.
  const perCard = policy.itemLimitScope === 'per-card';
  let budget = asCount(settings.incompleteItemLimit);

  const badges: Badge[] = [];

  for (const checklist of ordered) {
    const visible = visibleIds.has(checklist.id);

    if (visible && settings.showHeaders && !suppressHeaders) {
      badges.push(headerBadge(checklist, settings, policy, caps, localize));
    }

    // A2. When a checklist does not gate its items, items from a hidden
    // checklist still render - in their checklist's place in the order, with no
    // header above them.
    if (!visible && policy.checklistGatesItems) continue;

    const items = orderItems(checklist.items, policy);
    const allowance = perCard ? budget : asCount(settings.incompleteItemLimit);
    let spent = 0;

    for (const item of items) {
      if (item.complete) {
        if (!settings.showCompletedItems) continue;
      } else {
        if (!settings.showIncompleteItems) continue;
        if (spent >= allowance) continue;
        spent += 1;
      }
      badges.push(itemBadge(item, policy, caps, localize));
    }

    if (perCard) budget -= spent;
  }

  // The caps win over every setting, including 'all'. Applied last, as a slice,
  // so that what survives is always a prefix of what the settings asked for.
  return badges.slice(0, Math.max(0, caps.maxBadges));
}

// --- completeness ------------------------------------------------------------

/** A5: an empty checklist's completeness is a policy choice, not a fact. */
export function isComplete(checklist: Checklist, policy: BadgePolicy): boolean {
  if (checklist.items.length === 0) return policy.emptyChecklistIsComplete;
  return checklist.items.every((i) => i.complete);
}

export function countComplete(checklist: Checklist): number {
  return checklist.items.reduce((n, i) => n + (i.complete ? 1 : 0), 0);
}

// --- ordering (A1) -----------------------------------------------------------

/**
 * Ties break by id, so ordering is total and deterministic. Trello does not
 * promise unique `pos` values, and a non-deterministic badge order would be an
 * invisible, unreproducible bug.
 */
function byPosition(a: { pos: number; id: string }, b: { pos: number; id: string }): number {
  if (a.pos !== b.pos) return a.pos - b.pos;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function orderChecklists(
  checklists: readonly Checklist[],
  policy: BadgePolicy,
): Checklist[] {
  const sorted = [...checklists].sort(byPosition);
  if (policy.ordering === 'position') return sorted;
  // complete-first: stable grouping, position order preserved within each group.
  return [
    ...sorted.filter((c) => isComplete(c, policy)),
    ...sorted.filter((c) => !isComplete(c, policy)),
  ];
}

function orderItems(items: readonly CheckItem[], policy: BadgePolicy): CheckItem[] {
  const sorted = [...items].sort(byPosition);
  if (policy.ordering === 'position') return sorted;
  return [...sorted.filter((i) => i.complete), ...sorted.filter((i) => !i.complete)];
}

// --- badge construction ------------------------------------------------------

function headerBadge(
  checklist: Checklist,
  settings: Settings,
  policy: BadgePolicy,
  caps: BadgeCaps,
  localize: Localize,
): Badge {
  const done = countComplete(checklist);
  const total = checklist.items.length;
  const complete = isComplete(checklist, policy);
  const progress = formatProgress(done, total, settings, policy);

  // An empty checklist name leaves the progress alone rather than a trailing
  // space: a badge must never render as an empty or ragged pill.
  const text = truncate(join(progress, checklist.name), caps.maxTextLength);
  const color = settings[complete ? 'finishedColor' : 'unfinishedColor'];

  return withColor(
    {
      text,
      // The tooltip spells out what the colour encodes. No state may be carried
      // by colour alone (SPEC.md 3.7). Not truncated: it is the accessible long
      // form, and a cap is what it exists to escape.
      title: localize('tooltipChecklist', {
        name: checklist.name || localize('fallbackChecklistName'),
        done,
        total,
      }),
    },
    color,
  );
}

function itemBadge(
  item: CheckItem,
  policy: BadgePolicy,
  caps: BadgeCaps,
  localize: Localize,
): Badge {
  const glyph = item.complete ? GLYPH_COMPLETE : GLYPH_INCOMPLETE;
  // Pad AFTER truncating, never before: the cap governs the visible text, and the
  // padding is then added on top of it. Done the other way round the padding
  // would eat the text budget and cost real words to buy a line break.
  const text = truncate(join(glyph, item.name), caps.maxTextLength);
  return {
    // Item names render raw - no trimming, no normalisation, no capitalisation -
    // except for the defensive length cap. Only the truncation is ours.
    text: policy.itemsOnOwnLine ? padToWidth(text, caps) : text,
    // The glyph is not accessible on its own; the tooltip carries the state.
    // Two whole templates rather than one with an interpolated word: a translator
    // cannot reorder around a fragment they never see.
    title: localize(item.complete ? 'tooltipItemFinished' : 'tooltipItemUnfinished', {
      name: item.name || localize('fallbackItemName'),
    }),
  };
}

function withColor(badge: Badge, color: BadgeColorSetting): Badge {
  return color === 'none' ? badge : { ...badge, color };
}

// --- formatting --------------------------------------------------------------

export function formatProgress(
  done: number,
  total: number,
  settings: Settings,
  policy: BadgePolicy,
): string {
  if (settings.progressFormat === 'fraction') return `${done}/${total}`;
  if (total === 0) return policy.emptyChecklistIsComplete ? '100%' : '0%';
  const raw = (done / total) * 100;
  const pct = policy.percentRounding === 'floor' ? Math.floor(raw) : Math.round(raw);
  return `${pct}%`;
}

/** Joins a prefix to a possibly-empty name without leaving a trailing space. */
function join(prefix: string, name: string): string {
  return name.length === 0 ? prefix : `${prefix} ${name}`;
}

/** U+00A0. A normal space would collapse; this one occupies width. */
const NBSP = '\u00a0';

/**
 * How many non-breaking spaces one average glyph is worth. Measured: a glyph
 * advances ~6.14px against ~3.35px for U+00A0, on a live card front.
 */
const CHAR_UNITS = 1.83;

/**
 * Pads an item badge out to a fixed width with non-breaking spaces, so it cannot
 * fit beside Trello's own badges and is pushed onto its own line.
 *
 * This is a workaround for a platform constraint, and it is worth knowing why it
 * is the only one available. `card-badges` returns text, colour, icon and title;
 * Trello owns the layout and offers no line-break, ordering or width control
 * (SPEC.md 3.2). Our badges are placed in a container that Trello renders as one
 * flex item in the SAME wrapping row as its native badges, so a short item like
 * "book flights" simply sits next to the native `2/5`. The badge span is
 * `white-space: nowrap`, so a newline in the text renders as nothing at all.
 *
 * Three measured properties make the padding safe rather than merely clever:
 *
 *  - **It is invisible.** Item badges carry no colour, and every element in the
 *    rendered chain has a fully transparent background, so trailing blank space
 *    shows nothing. Never pad a COLOURED badge - there the padding would draw as
 *    a wide bar of solid colour.
 *  - **It cannot overflow.** The rendered badge width clamps to the container
 *    (measured: 228px against a 256px card, unchanged from 60 through 80 pad
 *    characters, with no card growth and no scroll).
 *  - **Clipping is harmless**, because the padding is at the END. If anything is
 *    cut it is blank space, never the item text.
 *
 * The target is `caps.itemPadWidth`, in nbsp units rather than characters, since
 * a glyph is roughly `CHAR_UNITS` times as wide as a non-breaking space. Padding
 * by raw character count instead made long items overshoot into Trello's clamp
 * and draw a trailing ellipsis. See DEFAULT_CAPS for the measured window.
 *
 * The result is clamped to `maxTextLength` so that cap stays the ONE upper bound
 * on badge text, padding included.
 */
function padToWidth(text: string, caps: BadgeCaps): string {
  const points = [...text].length;
  const used = points * CHAR_UNITS;
  const pad = Math.ceil(caps.itemPadWidth - used);
  if (pad <= 0) return text;
  const room = Math.max(0, caps.maxTextLength - points);
  return text + NBSP.repeat(Math.min(pad, room));
}

/**
 * Truncates by code point, so a surrogate pair (emoji, astral script) is never
 * split into a replacement character. Trello documents no text limit at all;
 * this is defensive and is ours, not observed behaviour.
 */
export function truncate(text: string, max: number): string {
  if (max <= 0) return '';
  const points = [...text];
  if (points.length <= max) return text;
  return points.slice(0, max - 1).join('') + ELLIPSIS;
}

/** `'all'` is unbounded; anything else is clamped to a non-negative integer. */
function asCount(limit: Limit): number {
  if (limit === 'all') return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.floor(limit));
}
