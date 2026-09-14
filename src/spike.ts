/**
 * M0b spike connector — a SEPARATE Power-Up entry point, not the product.
 *
 * Register a second dev Power-Up pointing at `/spike.html`, enable it on a test
 * board, and the experiments run themselves. Results accumulate in board/private
 * storage; `/spike-report.html` (board button "Spike results") renders them.
 *
 * THE COLD-LOAD TRAP. E1's failure self-heals: `t.card('checklists')` starts
 * returning checkItems once any check item is toggled, and then keeps working for
 * the rest of the session. So the FIRST observation for each card is the only one
 * that means anything, and this file never overwrites one. Toggle an item and the
 * later observations are recorded separately, as evidence of the self-heal rather
 * than as a result.
 *
 * Run it on a board you have not touched this session, and do not open a card
 * first.
 */

import { powerUp, type TrelloT } from './trello';
import type { Badge } from './types';

export const SPIKE_KEY = 'spikeResults';
export const SPIKE_MODE_KEY = 'spikeMode';

export type SpikeMode = 'probe' | 'stress' | 'ordering';

export interface CardObservation {
  cardId: string;
  /** Milliseconds since the connector iframe loaded. Small = genuinely cold. */
  atMs: number;
  /** E1: did `t.card('checklists')` yield checkItems arrays? */
  e1ChecklistsHadItems: boolean | null;
  e1ChecklistCount: number | null;
  e1FieldsSeen: string[];
  e1Error: string | null;
  /** E7: did `t.card('badges')` yield the card-level counts? */
  e7BadgeCountsPresent: boolean | null;
  e7Total: number | null;
  e7Done: number | null;
  /** E2: the order the source returned, verbatim. Only populated when E1 works. */
  order: string[] | null;
}

export interface SpikeResults {
  startedAt: number;
  connectorLoadedAt: number;
  /** First observation per card. NEVER overwritten - this is the cold-load record. */
  cold: Record<string, CardObservation>;
  /** Every later observation, in order. Evidence of the self-heal, not a result. */
  warm: CardObservation[];
  /** E6: how many times card-badges has run, and when it last ran. */
  badgeRuns: number;
  lastBadgeRunAt: number;
  mode: SpikeMode;
}

const LOADED_AT = Date.now();

const empty = (): SpikeResults => ({
  startedAt: LOADED_AT,
  connectorLoadedAt: LOADED_AT,
  cold: {},
  warm: [],
  badgeRuns: 0,
  lastBadgeRunAt: 0,
  mode: 'probe',
});

let results: SpikeResults = empty();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Trello calls card-badges for every visible card at once. Writing per card would
 * be hundreds of non-atomic writes that silently overwrite one another, so the
 * results are accumulated in memory and flushed once, as a single object.
 */
function scheduleFlush(t: TrelloT): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void t.set('board', 'private', { [SPIKE_KEY]: results }).catch(() => undefined);
  }, 750);
}

export async function probeCard(t: TrelloT, cardId: string): Promise<CardObservation> {
  const obs: CardObservation = {
    cardId,
    atMs: Date.now() - LOADED_AT,
    e1ChecklistsHadItems: null,
    e1ChecklistCount: null,
    e1FieldsSeen: [],
    e1Error: null,
    e7BadgeCountsPresent: null,
    e7Total: null,
    e7Done: null,
    order: null,
  };

  // --- E1 -------------------------------------------------------------------
  try {
    const card = await t.card('checklists');
    const raw = (card as Record<string, unknown>)['checklists'];
    if (Array.isArray(raw)) {
      obs.e1ChecklistCount = raw.length;
      const fields = new Set<string>();
      let everyHasItems = raw.length > 0;
      const order: string[] = [];
      for (const c of raw) {
        if (typeof c !== 'object' || c === null) { everyHasItems = false; continue; }
        const r = c as Record<string, unknown>;
        for (const k of Object.keys(r)) fields.add(k);
        const items = r['checkItems'];
        if (!Array.isArray(items)) { everyHasItems = false; continue; }
        order.push(`${String(r['name'])} [${items.length}]`);
        for (const it of items) {
          const i = it as Record<string, unknown>;
          order.push(`  ${i['state'] === 'complete' ? 'x' : 'o'} ${String(i['name'])} (pos ${String(i['pos'])})`);
        }
      }
      obs.e1ChecklistsHadItems = everyHasItems;
      obs.e1FieldsSeen = [...fields].sort();
      if (everyHasItems) obs.order = order;
    } else {
      obs.e1ChecklistsHadItems = false;
      obs.e1Error = 'checklists field was not an array';
    }
  } catch (e) {
    obs.e1ChecklistsHadItems = false;
    obs.e1Error = String(e);
  }

  // --- E7 -------------------------------------------------------------------
  try {
    const card = await t.card('badges');
    const badges = (card as Record<string, unknown>)['badges'] as Record<string, unknown> | undefined;
    const total = badges?.['checkItems'];
    const done = badges?.['checkItemsChecked'];
    obs.e7BadgeCountsPresent = typeof total === 'number';
    obs.e7Total = typeof total === 'number' ? total : null;
    obs.e7Done = typeof done === 'number' ? done : null;
  } catch {
    obs.e7BadgeCountsPresent = false;
  }

  return obs;
}

/** E3: enough badges, and long enough text, to find where Trello gives up. */
export function stressBadges(count = 40): Badge[] {
  const lengths = [20, 50, 100, 200];
  return Array.from({ length: count }, (_, i) => {
    const len = lengths[i % lengths.length]!;
    const text = `${String(i + 1).padStart(2, '0')} ` + 'x'.repeat(Math.max(0, len - 3));
    return i % 3 === 0 ? { text, color: 'orange' as const } : { text };
  });
}

export async function spikeBadges(t: TrelloT): Promise<Badge[]> {
  results.badgeRuns += 1;
  results.lastBadgeRunAt = Date.now();

  let cardId = '';
  try {
    cardId = t.getContext().card ?? '';
  } catch {
    return [{ text: 'no card context' }];
  }

  if (results.mode === 'stress') {
    scheduleFlush(t);
    return stressBadges(40);
  }

  const obs = await probeCard(t, cardId);
  const first = results.cold[cardId] === undefined;
  if (first) results.cold[cardId] = obs;
  else results.warm.push(obs);
  scheduleFlush(t);

  if (results.mode === 'ordering' && obs.order) {
    return obs.order.slice(0, 20).map((text) => ({ text }));
  }

  return [
    {
      text: `E1 ${mark(obs.e1ChecklistsHadItems)} · E7 ${mark(obs.e7BadgeCountsPresent)}${first ? ' · cold' : ' · warm'}`,
      color: obs.e1ChecklistsHadItems ? 'green' : 'red',
      title: obs.e1Error ?? obs.e1FieldsSeen.join(', '),
    },
  ];
}

const mark = (v: boolean | null) => (v === null ? '?' : v ? '✓' : '✗');

export function initializeSpike(): void {
  const t = powerUp().initialize({
    'card-badges': spikeBadges,
    'board-buttons': () => [
      {
        text: 'Spike results',
        callback: (bt: TrelloT) =>
          bt.modal({ title: 'Next Actions — M0b spike', url: './spike-report.html', fullscreen: false }),
      },
    ],
  });

  // Load any mode the report page set, so a refresh picks it up.
  void t
    .get('board', 'private', SPIKE_MODE_KEY, 'probe')
    .then((m) => {
      if (m === 'probe' || m === 'stress' || m === 'ordering') results.mode = m;
    })
    .catch(() => undefined);
}

/** Test seam: reset accumulated state between runs. */
export function __resetSpike(): void {
  results = empty();
}

export function __results(): SpikeResults {
  return results;
}
