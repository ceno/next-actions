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

export function computeBadges(
  checklists: readonly Checklist[],
  settings: Settings,
  policy: BadgePolicy = DEFAULT_POLICY,
  caps: BadgeCaps = DEFAULT_CAPS,
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
      badges.push(headerBadge(checklist, settings, policy, caps));
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
      badges.push(itemBadge(item, caps));
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
      // by colour alone (SPEC.md 3.7).
      title: `${checklist.name || 'Checklist'} — ${done} of ${total} items finished`,
    },
    color,
  );
}

function itemBadge(item: CheckItem, caps: BadgeCaps): Badge {
  const glyph = item.complete ? GLYPH_COMPLETE : GLYPH_INCOMPLETE;
  return {
    // Item names render raw - no trimming, no normalisation, no capitalisation -
    // except for the defensive length cap. Only the truncation is ours.
    text: truncate(join(glyph, item.name), caps.maxTextLength),
    // The glyph is not accessible on its own; the tooltip carries the state.
    title: `${item.name || 'Item'} — ${item.complete ? 'finished' : 'not finished'}`,
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
