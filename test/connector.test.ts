/**
 * The card-badges chain, end to end, under the SHIPPED configuration.
 *
 * Everything else in this suite tests a layer in isolation. This drives
 * `cardBadges` itself - the real `CONFIG` (Path B, degrade to Path C), the real
 * settings load, the real adapter, the real `computeBadges` - and asserts the
 * text that would land on a card front.
 *
 * It exists because the two failures this project has actually hit were both
 * invisible to the layer tests: a `0/0` badge that every unit test agreed was
 * correct, and a data path that returned nothing at all. Both are properties of
 * the whole chain.
 *
 * Each test uses its own board and member id: `createRestSource` memoises per
 * board for 10s and the settings cache memoises per member, so shared ids would
 * leak one test's answer into the next.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardBadges } from '../src/connector';
import { GLYPH_INCOMPLETE } from '../src/constants';
import type { TrelloT } from '../src/trello';
import raw from './fixtures/real-card-checklists.json';

/** The real captured payload, shaped as the board-level REST response. */
const boardPayload = (cardId: string) =>
  (raw as Record<string, unknown>[]).map((c) => ({ ...c, idCard: cardId }));

interface Opts {
  authorized?: boolean;
  badges?: Record<string, unknown> | undefined;
  board?: string;
  member?: string;
  card?: string;
}

const fakeT = (o: Opts = {}): TrelloT =>
  ({
    card: vi.fn(async (...fields: string[]) => {
      const out: Record<string, unknown> = {};
      if (fields.includes('badges') && o.badges !== undefined) out['badges'] = o.badges;
      return out;
    }),
    getContext: () => ({
      board: o.board ?? 'b-default',
      card: o.card ?? 'card1',
      member: o.member ?? 'm-default',
    }),
    get: async () => undefined,
    getRestApi: () => ({
      isAuthorized: async () => o.authorized ?? false,
      getToken: async () => 'tok',
      clearToken: async () => undefined,
    }),
  }) as unknown as TrelloT;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('card-badges, end to end, on the shipped config', () => {
  it('puts the next actions on the card front when Path B is authorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => boardPayload('card-ok') })),
    );

    const badges = await cardBadges(
      fakeT({ authorized: true, board: 'b-ok', member: 'm-ok', card: 'card-ok' }),
    );

    // This is the product: the header, then the unfinished items by name.
    expect(badges.map((b) => b.text)).toEqual([
      '2/5 Next Actions',
      `${GLYPH_INCOMPLETE} Book planes`,
      `${GLYPH_INCOMPLETE} Buy tickets`,
      `${GLYPH_INCOMPLETE} Book hotels and such`,
    ]);
    expect(badges[0]!.color).toBe('orange');
  });

  it('signs the REST call with the configured key, or the board returns 401', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      json: async () => boardPayload('card-key'),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await cardBadges(fakeT({ authorized: true, board: 'b-key', member: 'm-key', card: 'card-key' }));

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain('/boards/b-key/checklists');
    expect(url).toContain('checkItems=all');
    // An empty key here is the silent failure that renders an empty board.
    expect(url).toMatch(/[?&]key=[0-9a-f]{32}(&|$)/);
  });

  it('falls back to counts only - never to bare checkboxes - when REST is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));

    const badges = await cardBadges(
      fakeT({
        authorized: false,
        badges: { checkItems: 5, checkItemsChecked: 2 },
        board: 'b-agg',
        member: 'm-agg',
        card: 'card-agg',
      }),
    );

    // Path C has the counts and nothing else. Item badges are ON by default, and
    // the fallback must still refuse to draw its nameless placeholder items.
    expect(badges.map((b) => b.text)).toEqual(['2/5']);
    expect(badges.map((b) => b.text)).not.toContain('0/0');
    expect(badges.map((b) => b.text)).not.toContain(GLYPH_INCOMPLETE);
  });

  it('asks the user to connect when nothing at all is knowable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));

    const badges = await cardBadges(
      fakeT({ authorized: false, badges: {}, board: 'b-no', member: 'm-no', card: 'card-no' }),
    );

    // Not an empty card front: an unauthorized Power-Up that renders nothing is
    // indistinguishable from a board with no checklists on it.
    expect(badges.map((b) => b.text)).toEqual(['Connect your account']);
  });
});
