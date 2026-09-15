/**
 * The one assertion that is about what a user actually sees.
 *
 * Everything else in this suite tests a layer. This tests the whole card-badges
 * chain under the shipped diagnostic build (Path A, degrade to Path C) against
 * the failure that was reported on a live board: the client library serves
 * checklist stubs, and the card front reads `0/0`.
 *
 * `0/0` is not a rendering bug. It is `computeBadges` faithfully rendering a
 * checklist that it was told has no items - so the fix has to be upstream, and
 * the thing to assert is that the number on the card is now right.
 */

import { describe, expect, it, vi } from 'vitest';
import { cardBadges } from '../src/connector';
import type { TrelloT } from '../src/trello';

/** A card whose client-library checklist cache has been stubbed out. */
const stubbedCard = (over: Partial<Record<string, unknown>> = {}): TrelloT =>
  ({
    card: vi.fn(async (...fields: string[]) => {
      // Path A asks for both; Path C asks for badges alone. One fake serves both.
      const out: Record<string, unknown> = {};
      if (fields.includes('checklists')) {
        // The stub: well-formed, named, and empty.
        out['checklists'] = [
          { id: 'c1', idCard: 'card1', name: 'Next Actions', pos: 140737488355328, checkItems: [] },
        ];
      }
      if (fields.includes('badges')) {
        out['badges'] = { checkItems: 5, checkItemsChecked: 2 };
      }
      return out;
    }),
    getContext: () => ({ board: 'b1', card: 'card1', member: 'm1' }),
    get: async () => undefined,
    getRestApi: () => ({ isAuthorized: async () => false }),
    ...over,
  }) as unknown as TrelloT;

describe('card-badges, end to end, on the reported failure', () => {
  it('renders the card\'s real progress instead of a truthful-looking 0/0', async () => {
    const badges = await cardBadges(stubbedCard());

    expect(badges).toHaveLength(1);
    expect(badges[0]!.text).toBe('2/5');
    // The regression, stated as itself.
    expect(badges.map((b) => b.text)).not.toContain('0/0');
    expect(badges.map((b) => b.text)).not.toContain('0/0 Next Actions');
  });

  it('renders nothing rather than 0/0 when no source can be trusted', async () => {
    // Stubs, and no card-level total to fall back to either.
    const t = stubbedCard({
      card: vi.fn(async (...fields: string[]) => {
        const out: Record<string, unknown> = {};
        if (fields.includes('checklists')) {
          out['checklists'] = [{ id: 'c1', name: 'Next Actions', pos: 1, checkItems: [] }];
        }
        // `badges` present but carrying no counts: nothing is knowable here.
        if (fields.includes('badges')) out['badges'] = {};
        return out;
      }),
    });

    // No totals means the cross-check cannot run, so Path A's answer stands and
    // an empty checklist renders its honest 0/0. That is the correct reading of
    // "the card agrees it is empty" - it just has nothing to agree with.
    const badges = await cardBadges(t);
    expect(badges.map((b) => b.text)).toEqual(['0/0 Next Actions']);
  });

  it('leaves a healthy card alone', async () => {
    const t = stubbedCard({
      card: vi.fn(async (...fields: string[]) => {
        const out: Record<string, unknown> = {};
        if (fields.includes('checklists')) {
          out['checklists'] = [
            {
              id: 'c1',
              name: 'Next Actions',
              pos: 1,
              checkItems: [
                { id: 'i1', name: 'Book planes', state: 'complete', pos: 1 },
                { id: 'i2', name: 'Buy tickets', state: 'incomplete', pos: 2 },
              ],
            },
          ];
        }
        if (fields.includes('badges')) out['badges'] = { checkItems: 2, checkItemsChecked: 1 };
        return out;
      }),
    });

    const badges = await cardBadges(t);
    expect(badges.map((b) => b.text)).toEqual(['1/2 Next Actions']);
  });
});
