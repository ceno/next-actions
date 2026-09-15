import { describe, expect, it, vi } from 'vitest';
import {
  adaptChecklist,
  adaptChecklists,
  aggregateSource,
  boardChecklistsUrl,
  clientSource,
  createRestSource,
  groupByCard,
  isUnavailable,
} from '../src/data';
import type { TrelloT } from '../src/trello';

const fakeT = (over: Partial<Record<string, unknown>> = {}): TrelloT =>
  ({
    card: vi.fn(async () => ({})),
    getContext: () => ({ board: 'b1', card: 'card1', member: 'm1' }),
    getRestApi: () => ({ isAuthorized: async () => true, getToken: async () => 'tok' }),
    ...over,
  }) as unknown as TrelloT;

describe('adapters', () => {
  it('reads REST\'s state string and any boolean spelling alike', () => {
    const c = adaptChecklist({ id: 'c', name: 'L', pos: 1, checkItems: [
      { id: '1', name: 'a', state: 'complete', pos: 1 },
      { id: '2', name: 'b', state: 'incomplete', pos: 2 },
      { id: '3', name: 'c', complete: true, pos: 3 },
      { id: '4', name: 'd', checked: true, pos: 4 },
    ] }, 0)!;
    expect(c.items.map((i) => i.complete)).toEqual([true, false, true, true]);
  });

  it('treats a checklist with NO checkItems array as unavailable, not as empty', () => {
    // This is the documented Path A failure shape: id/idBoard/idCard/name/pos only.
    const raw = [{ id: 'c', idBoard: 'b', idCard: 'k', name: 'L', pos: 1 }];
    const out = adaptChecklists(raw);
    expect(isUnavailable(out)).toBe(true);
  });

  it('distinguishes a genuinely empty checklist from a truncated one', () => {
    const out = adaptChecklists([{ id: 'c', name: 'L', pos: 1, checkItems: [] }]);
    expect(isUnavailable(out)).toBe(false);
    expect((out as { length: number }).length).toBe(1);
  });

  it('returns unavailable when the field is missing entirely', () => {
    expect(isUnavailable(adaptChecklists(undefined))).toBe(true);
    expect(isUnavailable(adaptChecklists({}))).toBe(true);
  });

  it('synthesises ids and positions rather than dropping an unlabelled item', () => {
    const c = adaptChecklist({ name: 'L', checkItems: [{ name: 'x' }] }, 3)!;
    expect(c.id).toBe('checklist:3');
    expect(c.pos).toBe(3);
    expect(c.items[0]!.id).toBe('checklist:3:0');
  });
});

describe('Path A - client source', () => {
  it('reports unavailable when the client library throws', async () => {
    const t = fakeT({ card: async () => { throw new Error('boom'); } });
    expect(isUnavailable(await clientSource.forCard(t, 'card1'))).toBe(true);
  });

  it('reports unavailable on the real-world empty-checklist-object shape', async () => {
    const t = fakeT({ card: async () => ({ checklists: [{ id: 'c', idCard: 'card1', name: 'L', pos: 1 }] }) });
    expect(isUnavailable(await clientSource.forCard(t, 'card1'))).toBe(true);
  });

  // The 0/0 bug. A stubbed checklist is well-formed and adapts cleanly, so
  // nothing upstream can tell it from a checklist that is genuinely empty -
  // except the card's own total, which the native badge is already drawing.
  it('reports unavailable when the cache serves stubs but the card claims items', async () => {
    const t = fakeT({
      card: async () => ({
        checklists: [{ id: 'c', idCard: 'card1', name: 'Next Actions', pos: 1, checkItems: [] }],
        badges: { checkItems: 5, checkItemsChecked: 2 },
      }),
    });
    const out = await clientSource.forCard(t, 'card1');
    expect(isUnavailable(out)).toBe(true);
    expect((out as { reason: string }).reason).toContain('0 of 5');
  });

  it('catches a PARTIALLY stubbed card too - some items is still not all of them', async () => {
    const t = fakeT({
      card: async () => ({
        checklists: [
          { id: 'c1', name: 'A', pos: 1, checkItems: [{ id: 'i1', name: 'x', state: 'complete', pos: 1 }] },
          { id: 'c2', name: 'B', pos: 2, checkItems: [] },
        ],
        badges: { checkItems: 4, checkItemsChecked: 1 },
      }),
    });
    expect(isUnavailable(await clientSource.forCard(t, 'card1'))).toBe(true);
  });

  // The check must not overreach: an empty checklist is a legitimate thing to
  // have, and its honest 0/0 is not the bug.
  it('passes through a genuinely empty checklist, which the card agrees is empty', async () => {
    const t = fakeT({
      card: async () => ({
        checklists: [{ id: 'c', name: 'Nothing in here', pos: 1, checkItems: [] }],
        badges: { checkItems: 0, checkItemsChecked: 0 },
      }),
    });
    const out = await clientSource.forCard(t, 'card1');
    expect(isUnavailable(out)).toBe(false);
    expect(out as unknown[]).toHaveLength(1);
    expect((out as { items: unknown[] }[])[0]!.items).toHaveLength(0);
  });

  it('passes through a healthy card untouched', async () => {
    const t = fakeT({
      card: async () => ({
        checklists: [
          {
            id: 'c',
            name: 'Next Actions',
            pos: 1,
            checkItems: [
              { id: 'i1', name: 'a', state: 'complete', pos: 1 },
              { id: 'i2', name: 'b', state: 'incomplete', pos: 2 },
            ],
          },
        ],
        badges: { checkItems: 2, checkItemsChecked: 1 },
      }),
    });
    const out = await clientSource.forCard(t, 'card1');
    expect(isUnavailable(out)).toBe(false);
    expect((out as { items: unknown[] }[])[0]!.items).toHaveLength(2);
  });

  // Absent totals must disable the check, not block the path: the cross-check is
  // a falsifier, and a falsifier that cannot run proves nothing either way.
  it('still returns data when the card offers no totals to check against', async () => {
    const t = fakeT({
      card: async () => ({
        checklists: [{ id: 'c', name: 'L', pos: 1, checkItems: [] }],
      }),
    });
    expect(isUnavailable(await clientSource.forCard(t, 'card1'))).toBe(false);
  });

  it('asks for checklists and badges in one call, so both see one cache state', async () => {
    const card = vi.fn(async () => ({ checklists: [], badges: { checkItems: 0, checkItemsChecked: 0 } }));
    await clientSource.forCard(fakeT({ card }), 'card1');
    expect(card).toHaveBeenCalledTimes(1);
    expect(card).toHaveBeenCalledWith('checklists', 'badges');
  });
});

describe('Path C - aggregate source', () => {
  it('turns the card-level counts into one synthetic checklist', async () => {
    const t = fakeT({ card: async () => ({ badges: { checkItems: 5, checkItemsChecked: 2 } }) });
    const out = await aggregateSource.forCard(t, 'card1');
    expect(isUnavailable(out)).toBe(false);
    const [c] = out as { items: { complete: boolean }[]; name: string }[];
    expect(c!.items).toHaveLength(5);
    expect(c!.items.filter((i) => i.complete)).toHaveLength(2);
    expect(c!.name).toBe(''); // no name is available - this is why it is degraded-only
  });

  it('reports unavailable when the counts are absent', async () => {
    expect(isUnavailable(await aggregateSource.forCard(fakeT({ card: async () => ({ badges: {} }) }), 'c'))).toBe(true);
  });
});

describe('Path B - REST source', () => {
  const board = [
    { id: 'l1', idCard: 'card1', name: 'A', pos: 1, checkItems: [{ id: 'i1', name: 'x', state: 'complete', pos: 1 }] },
    { id: 'l2', idCard: 'card2', name: 'B', pos: 1, checkItems: [] },
    { id: 'l3', idCard: 'card1', name: 'C', pos: 2, checkItems: [] },
  ];

  it('builds the one-request-per-board URL with checkItems=all', () => {
    const url = boardChecklistsUrl('b1', 'tok', 'key1');
    expect(url).toContain('/1/boards/b1/checklists?');
    expect(url).toContain('checkItems=all');
    expect(url).toContain('fields=name%2Cpos%2CidCard');
  });

  it('groups a board response by card', () => {
    const byCard = groupByCard(board);
    expect(byCard.get('card1')).toHaveLength(2);
    expect(byCard.get('card2')).toHaveLength(1);
  });

  it('shares ONE request across concurrent badge calls (single-flight)', async () => {
    const fetchBoard = vi.fn(async () => board);
    const src = createRestSource({ ttlMs: 10_000, now: () => 0, fetchBoard });
    const t = fakeT();
    // Trello fires card-badges for every visible card at once.
    await Promise.all(Array.from({ length: 50 }, (_, i) => src.forCard(t, `card${i}`)));
    expect(fetchBoard).toHaveBeenCalledTimes(1);
  });

  it('serves from cache within the TTL and refetches after it', async () => {
    const fetchBoard = vi.fn(async () => board);
    let clock = 0;
    const src = createRestSource({ ttlMs: 10_000, now: () => clock, fetchBoard });
    const t = fakeT();
    await src.forCard(t, 'card1');
    clock = 9_999;
    await src.forCard(t, 'card1');
    expect(fetchBoard).toHaveBeenCalledTimes(1);
    clock = 10_001;
    await src.forCard(t, 'card1');
    expect(fetchBoard).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failure - one blip must not blank the board for a full TTL', async () => {
    let calls = 0;
    const fetchBoard = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('REST 503');
      return board;
    });
    const src = createRestSource({ ttlMs: 10_000, now: () => 0, fetchBoard });
    const t = fakeT();
    expect(isUnavailable(await src.forCard(t, 'card1'))).toBe(true);
    const second = await src.forCard(t, 'card1');
    expect(isUnavailable(second)).toBe(false);
    expect(fetchBoard).toHaveBeenCalledTimes(2);
  });

  it('returns an empty array for a card that genuinely has no checklists', async () => {
    const src = createRestSource({ ttlMs: 10_000, now: () => 0, fetchBoard: async () => board });
    const out = await src.forCard(fakeT(), 'card-with-none');
    expect(out).toEqual([]);
    expect(isUnavailable(out)).toBe(false);
  });

  it('reports unavailable, not empty, when the token is missing', async () => {
    const src = createRestSource({ ttlMs: 10_000, now: () => 0, fetchBoard: async () => board });
    const t = fakeT({ getRestApi: () => ({ isAuthorized: async () => false }) });
    const out = await src.forCard(t, 'card1');
    expect(isUnavailable(out)).toBe(true);
    expect((out as { reason: string }).reason).toBe('unauthorized');
  });

  it('invalidates on demand', async () => {
    const fetchBoard = vi.fn(async () => board);
    const src = createRestSource({ ttlMs: 10_000, now: () => 0, fetchBoard });
    await src.forCard(fakeT(), 'card1');
    src.invalidate();
    await src.forCard(fakeT(), 'card1');
    expect(fetchBoard).toHaveBeenCalledTimes(2);
  });
});
