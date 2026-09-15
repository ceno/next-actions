/**
 * The only file that knows where checklists come from.
 *
 * Three paths behind one interface, because which one works is unknown until the
 * M0b experiments run (SPEC.md 6). The active path is a build-time flag, not a
 * runtime fallback chain: a silent fallback would hide exactly the failure that
 * E1 exists to detect.
 */

import type { CheckItem, Checklist } from './types';
import type { TrelloT } from './trello';

export type DataPathId = 'client' | 'rest' | 'aggregate';

/**
 * Distinct from `[]`. `[]` means "this card genuinely has no checklists" and
 * renders nothing; `Unavailable` means "we do not know". Conflating the two is
 * how a broken data source comes to look like an empty board.
 */
export interface Unavailable {
  readonly unavailable: true;
  readonly reason: string;
}

export const unavailable = (reason: string): Unavailable => ({ unavailable: true, reason });
export const isUnavailable = (r: Checklist[] | Unavailable): r is Unavailable =>
  !Array.isArray(r) && r.unavailable === true;

export interface ChecklistSource {
  readonly id: DataPathId;
  /** `t` is valid only for the life of this call and must never be retained. */
  forCard(t: TrelloT, cardId: string): Promise<Checklist[] | Unavailable>;
}

// --- adapters ----------------------------------------------------------------
// Everything below runs against `unknown`. No external shape is ever trusted.

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Accepts REST's `state: 'complete'` and any boolean spelling the client library may use. */
function itemComplete(raw: Record<string, unknown>): boolean {
  if (typeof raw['state'] === 'string') return raw['state'] === 'complete';
  if (typeof raw['complete'] === 'boolean') return raw['complete'];
  if (typeof raw['checked'] === 'boolean') return raw['checked'];
  return false;
}

export function adaptCheckItem(raw: unknown, index: number, parentId: string): CheckItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return {
    id: str(r['id'], `${parentId}:${index}`),
    name: str(r['name']),
    complete: itemComplete(r),
    pos: num(r['pos'], index),
  };
}

/**
 * Returns null when the object does not look like a checklist WITH its items.
 * A checklist object that carries no `checkItems` array at all is the documented
 * Path A failure mode (SPEC.md 6.2) - it must read as unavailable, never as an
 * empty checklist, which would render a misleading 0/0 badge.
 */
export function adaptChecklist(raw: unknown, index: number): Checklist | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const rawItems = r['checkItems'] ?? r['items'];
  if (!Array.isArray(rawItems)) return null;

  const id = str(r['id'], `checklist:${index}`);
  const items = rawItems
    .map((it, i) => adaptCheckItem(it, i, id))
    .filter((it): it is CheckItem => it !== null);

  return { id, name: str(r['name']), pos: num(r['pos'], index), items };
}

export function adaptChecklists(raw: unknown): Checklist[] | Unavailable {
  if (!Array.isArray(raw)) return unavailable('checklists field was not an array');
  const out: Checklist[] = [];
  for (const [i, c] of raw.entries()) {
    const adapted = adaptChecklist(c, i);
    // One malformed checklist makes the whole card untrustworthy: a partial card
    // is indistinguishable from a card whose checklists were genuinely deleted.
    if (!adapted) return unavailable('a checklist carried no checkItems array');
    out.push(adapted);
  }
  return out;
}

// --- Path A: client library --------------------------------------------------

/**
 * EXPECTED TO FAIL. Atlassian staff explained in 2020 that the web client caches
 * only what board-level rendering needs; developers reproduced the exact failure
 * in Oct 2023 and Feb 2025, both threads unresolved.
 *
 * The trap: the failure SELF-HEALS once any check item is toggled, and then works
 * for the rest of the session. E1 must therefore be run on a cold load - fresh
 * board, no card opened, nothing toggled - or it returns a false green.
 */
export const clientSource: ChecklistSource = {
  id: 'client',
  async forCard(t) {
    let card: Record<string, unknown>;
    try {
      // Both fields in ONE call. `badges` is not data here - it is the check on
      // the answer, and a second round-trip could observe a different cache state.
      card = await t.card('checklists', 'badges');
    } catch (e) {
      return unavailable(`t.card('checklists', 'badges') threw: ${String(e)}`);
    }

    const adapted = adaptChecklists(card['checklists']);
    if (isUnavailable(adapted)) return adapted;

    // The stub check, and the reason this path can no longer lie.
    //
    // The documented Path A failure does NOT spell itself as a missing
    // `checkItems` - it spells itself as an EMPTY one. A stubbed checklist is
    // therefore well-formed, adapts cleanly, and renders `0/0 <name>`: a badge
    // that looks like a fact and is not one. `badges.checkItems` is the card's
    // own total and comes from the board-level cache the native badge already
    // draws from, so it is populated exactly when the checklist cache is not.
    //
    // Strictly fewer items than the card claims means we were served a stub.
    // Equality passes, so a genuinely empty checklist still renders its honest
    // `0/0`; absent totals disable the check rather than block the path.
    const totals = badgeTotals(card);
    if (totals !== null) {
      const got = countItems(adapted);
      if (got < totals.total) {
        return unavailable(
          `client cache served ${got} of ${totals.total} check items`,
        );
      }
    }

    return adapted;
  },
};

/** Total check items across every checklist. */
export function countItems(checklists: readonly Checklist[]): number {
  return checklists.reduce((n, c) => n + c.items.length, 0);
}

/**
 * The card-level check-item totals, when the client library carries them.
 * `null` means "not offered", never "zero" - the two must not be conflated.
 */
export function badgeTotals(card: Record<string, unknown>): { total: number; done: number } | null {
  const badges = card['badges'];
  if (typeof badges !== 'object' || badges === null) return null;
  const b = badges as Record<string, unknown>;
  if (typeof b['checkItems'] !== 'number') return null;
  return {
    total: b['checkItems'],
    done: typeof b['checkItemsChecked'] === 'number' ? b['checkItemsChecked'] : 0,
  };
}

// --- Path C: aggregate counts only -------------------------------------------

/**
 * `t.card('badges')` gives the card-level totals that drive Trello's own checkbox
 * badge. Structurally this should be available where Path A is not: the native
 * badge IS board-level rendering, so its counts must be in the board-level cache.
 *
 * UNVERIFIED - the evidence is one third-party Power-Up's code comment plus that
 * argument (docs/prior-art.md 3). E7 settles it.
 *
 * It yields one synthetic, nameless checklist, so only a card-level progress pill
 * is possible: no item badges, no per-checklist split, no names. Its role is the
 * degraded state, not the product.
 */
export const aggregateSource: ChecklistSource = {
  id: 'aggregate',
  async forCard(t, cardId) {
    try {
      const card = await t.card('badges');
      const totals = badgeTotals(card as Record<string, unknown>);
      if (totals === null) return unavailable('badges.checkItems absent');

      const { total, done } = totals;
      const items: CheckItem[] = Array.from({ length: total }, (_, i) => ({
        id: `${cardId}:agg:${i}`,
        name: '',
        complete: i < done,
        pos: i,
      }));
      return [{ id: `${cardId}:agg`, name: '', pos: 0, items }];
    } catch (e) {
      return unavailable(`t.card('badges') threw: ${String(e)}`);
    }
  },
};

// --- Path B: REST ------------------------------------------------------------

export interface RestOptions {
  /** Milliseconds a board's checklist snapshot stays fresh. */
  ttlMs: number;
  /** Injected so the cache is testable without a clock or a network. */
  now: () => number;
  fetchBoard: (boardId: string, token: string) => Promise<unknown>;
}

export const REST_TTL_MS = 10_000;

export function boardChecklistsUrl(boardId: string, token: string, key: string): string {
  const q = new URLSearchParams({
    checkItems: 'all',
    fields: 'name,pos,idCard',
    key,
    token,
  });
  return `https://api.trello.com/1/boards/${encodeURIComponent(boardId)}/checklists?${q}`;
}

interface CacheEntry {
  /** The in-flight or settled promise. Held so concurrent badge calls share one request. */
  promise: Promise<Map<string, Checklist[]>>;
  expiresAt: number;
}

/**
 * One request per board, not per card: `GET /1/boards/{id}/checklists?checkItems=all`
 * returns every checklist on the board keyed by card, so 500 cards cost one HTTP
 * request. Memoised with a short TTL and single-flight promise dedupe, because
 * Trello fires the badge handler for every visible card at once.
 */
export function createRestSource(options: RestOptions): ChecklistSource & {
  invalidate(boardId?: string): void;
  pending(): number;
} {
  const cache = new Map<string, CacheEntry>();

  async function load(t: TrelloT, boardId: string): Promise<Map<string, Checklist[]>> {
    const api = t.getRestApi();
    if (!(await api.isAuthorized())) throw new Error('unauthorized');
    const token = await api.getToken();
    const raw = await options.fetchBoard(boardId, token);
    return groupByCard(raw);
  }

  function snapshot(t: TrelloT, boardId: string): Promise<Map<string, Checklist[]>> {
    const hit = cache.get(boardId);
    if (hit && hit.expiresAt > options.now()) return hit.promise;

    const promise = load(t, boardId);
    cache.set(boardId, { promise, expiresAt: options.now() + options.ttlMs });
    // A failed request must not be cached, or one blip blanks the board for a
    // full TTL and every retry in that window is suppressed.
    promise.catch(() => {
      if (cache.get(boardId)?.promise === promise) cache.delete(boardId);
    });
    return promise;
  }

  return {
    id: 'rest',
    async forCard(t, cardId) {
      const boardId = t.getContext().board;
      if (!boardId) return unavailable('no board in context');
      try {
        const byCard = await snapshot(t, boardId);
        return byCard.get(cardId) ?? [];
      } catch (e) {
        return unavailable(String(e instanceof Error ? e.message : e));
      }
    },
    invalidate(boardId) {
      if (boardId === undefined) cache.clear();
      else cache.delete(boardId);
    },
    pending: () => cache.size,
  };
}

/** Board-level REST response -> checklists keyed by the card they belong to. */
export function groupByCard(raw: unknown): Map<string, Checklist[]> {
  const byCard = new Map<string, Checklist[]>();
  if (!Array.isArray(raw)) return byCard;
  for (const [i, entry] of raw.entries()) {
    if (typeof entry !== 'object' || entry === null) continue;
    const cardId = str((entry as Record<string, unknown>)['idCard']);
    if (!cardId) continue;
    const checklist = adaptChecklist(entry, i);
    if (!checklist) continue;
    const list = byCard.get(cardId);
    if (list) list.push(checklist);
    else byCard.set(cardId, [checklist]);
  }
  return byCard;
}
