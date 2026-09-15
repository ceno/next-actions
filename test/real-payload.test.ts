/**
 * The real-payload test. Delivery review F13.
 *
 * Until now every fixture in this suite was INVENTED - a shape reasoned out from
 * documentation. This one was captured on 2026-09-15 from Trello's REST API
 * (`GET /1/cards/<id>/checklists?checkItems=all`) for a live card on a live
 * board, through an authenticated browser session.
 *
 * Only the two human names in the item text were replaced, to keep other
 * people's names out of the repo. Every structural value - the field spellings,
 * the id formats, the `state` strings and the `pos` magnitudes - is exactly as
 * Trello returned it. Those are what the test is about.
 *
 * What it caught, which no invented fixture did: Trello's `pos` values are around
 * 1.4e14, not the small integers every hand-written fixture in this suite uses.
 */

import { describe, expect, it } from 'vitest';

import { computeBadges } from '../src/badges';
import { adaptChecklists, isUnavailable } from '../src/data';
import { DEFAULT_SETTINGS } from '../src/constants';
import raw from './fixtures/real-card-checklists.json';
import { headersOnly } from './helpers';

describe('a real Trello payload', () => {
  it('adapts without being judged Unavailable', () => {
    const out = adaptChecklists(raw);
    expect(isUnavailable(out)).toBe(false);
  });

  it('reads the documented `state: "complete"` spelling correctly', () => {
    const out = adaptChecklists(raw);
    if (isUnavailable(out)) throw new Error(out.reason);
    expect(out[0]!.items.map((i) => i.complete)).toEqual([true, true, false, false, false]);
  });

  /**
   * The finding. `pos` came back as 140737488355328 and up - roughly 2^47, and
   * spaced 16384 apart. Every other fixture in this suite uses 1, 2, 3. Sorting
   * and the (pos, id) tie-break have to hold at this magnitude, and they do:
   * these are exact integers well inside Number.MAX_SAFE_INTEGER.
   */
  it('handles Trello’s real `pos` magnitudes, which are ~1.4e14 and not small integers', () => {
    const out = adaptChecklists(raw);
    if (isUnavailable(out)) throw new Error(out.reason);
    const positions = out[0]!.items.map((i) => i.pos);
    expect(positions.every((p) => Number.isSafeInteger(p))).toBe(true);
    expect(positions[0]).toBeGreaterThan(1e14);
    // Still strictly ascending after adaptation, so the sort is a no-op here.
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  /**
   * The question this was written to answer: does the checklist's NAME affect
   * whether a badge is produced? It does not. The name is interpolated, never
   * matched on - there is no branch anywhere in computeBadges that reads it.
   */
  /**
   * What this real card actually puts on a card front, with nothing configured.
   * The header, then the unfinished items up to `incompleteItemLimit` - the 4th
   * and 5th are deliberately held back so one card cannot flood the front.
   */
  it('renders the header and the next actions under the shipped defaults', () => {
    const out = adaptChecklists(raw);
    if (isUnavailable(out)) throw new Error(out.reason);
    const badges = computeBadges(out, DEFAULT_SETTINGS);
    expect(badges.map((b) => b.text)).toEqual([
      '2/5 Next Actions',
      '☐ Book planes',
      '☐ Buy tickets',
      '☐ Book hotels and such',
    ]);
    expect(badges[0]!.color).toBe('orange');
    expect(badges[0]!.title).toBe('Next Actions — 2 of 5 items finished');
  });

  it('renders the same header whatever the checklist is called', () => {
    const out = adaptChecklists(raw);
    if (isUnavailable(out)) throw new Error(out.reason);
    for (const name of ['Next Actions', 'ToDo', '', '✅ tasks', 'a'.repeat(200)]) {
      const renamed = out.map((c) => ({ ...c, name }));
      const badges = computeBadges(renamed, headersOnly());
      expect(badges).toHaveLength(1);
      expect(badges[0]!.text.startsWith('2/5')).toBe(true);
    }
  });

  it('renders the unfinished items when that setting is on', () => {
    const out = adaptChecklists(raw);
    if (isUnavailable(out)) throw new Error(out.reason);
    const badges = computeBadges(out, { ...DEFAULT_SETTINGS, showIncompleteItems: true });
    expect(badges.map((b) => b.text)).toEqual([
      '2/5 Next Actions',
      '☐ Book planes',
      '☐ Buy tickets',
      '☐ Book hotels and such',
    ]);
  });
});
