/**
 * Capability wiring. Everything here is glue: the logic lives in badges.ts
 * (pure), the data access in data.ts, the storage in settings.ts.
 *
 * Capabilities: card-badges, show-settings, remove-data, on-enable, plus the two
 * authorization capabilities that Path B needs.
 */

import { computeBadges } from './badges';
import { CONFIG } from './config';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from './constants';
import {
  aggregateSource,
  boardChecklistsUrl,
  clientSource,
  createRestSource,
  isUnavailable,
  REST_TTL_MS,
  type ChecklistSource,
} from './data';
import { LOCALIZATION, localizer } from './i18n';
import { clearSettings, loadSettings } from './settings';
import { powerUp, type TrelloT } from './trello';
import type { Badge, Settings } from './types';

const restSource = createRestSource({
  ttlMs: REST_TTL_MS,
  now: () => Date.now(),
  async fetchBoard(boardId, token) {
    const res = await fetch(boardChecklistsUrl(boardId, token, CONFIG.restApiKey));
    if (!res.ok) throw new Error(`REST ${res.status}`);
    return res.json();
  },
});

const SOURCES: Record<string, ChecklistSource> = {
  client: clientSource,
  rest: restSource,
  aggregate: aggregateSource,
};

function source(): ChecklistSource {
  return SOURCES[CONFIG.dataPath] ?? restSource;
}

/**
 * Trello calls card-badges for every visible card at once, so an un-memoised
 * settings read is one storage round-trip per card. Only resolved data is kept -
 * never a `t`, whose scope is valid solely during the callback that produced it.
 */
const SETTINGS_TTL_MS = 10_000;
let settingsCache: { key: string; at: number; value: Settings } | null = null;

async function currentSettings(t: TrelloT): Promise<Settings> {
  let key = 'member';
  try {
    key = t.getContext().member ?? 'member';
  } catch {
    /* context unavailable: fall through to the shared key */
  }
  const now = Date.now();
  if (settingsCache && settingsCache.key === key && now - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.value;
  }
  const value = await loadSettings(t);
  settingsCache = { key, at: now, value };
  return value;
}

export async function cardBadges(t: TrelloT): Promise<Badge[]> {
  let cardId = '';
  try {
    cardId = t.getContext().card ?? '';
  } catch {
    return [];
  }

  // Bound per callback, never cached: `t` is valid only for the duration of the
  // callback that produced it. Constructing it is a closure, not a round-trip.
  const L = localizer(t);

  const [settings, checklists] = await Promise.all([
    currentSettings(t).catch(() => ({ ...DEFAULT_SETTINGS })),
    source().forCard(t, cardId),
  ]);

  if (isUnavailable(checklists)) {
    // "We do not know" is not "there is nothing". Rendering [] here would make a
    // broken data source look like an empty board.
    if (CONFIG.degradeToAggregate) {
      const fallback = await aggregateSource.forCard(t, cardId);
      if (!isUnavailable(fallback)) {
        return computeBadges(fallback, settings, undefined, undefined, L);
      }
    }
    if (CONFIG.showUnauthorizedBadge && CONFIG.dataPath === 'rest') {
      const authorized = await t.getRestApi().isAuthorized().catch(() => false);
      if (!authorized) return [{ text: L('unauthorized'), color: 'light-gray' }];
    }
    return [];
  }

  return computeBadges(checklists, settings, undefined, undefined, L);
}

export function initialize(): void {
  powerUp().initialize(
    {
      'card-badges': cardBadges,

      'show-settings': (t: TrelloT) =>
        t.popup({ title: localizer(t)('appName'), url: './settings.html', height: 300 }),

      /**
       * Fires with roughly 500ms to act. Drop our settings, and on Path B the
       * stored REST token with them.
       */
      'remove-data': async (t: TrelloT) => {
        settingsCache = null;
        restSource.invalidate();
        await clearSettings(t, [SETTINGS_KEY]);
        await t.getRestApi().clearToken().catch(() => undefined);
      },

      /**
       * Not load-bearing: Atlassian documents that this does not fire when a
       * Power-Up is enabled from the public directory or the API. Defaults must
       * render something useful with no configuration at all.
       */
      'on-enable': (t: TrelloT) =>
        t.popup({ title: localizer(t)('appName'), url: './settings.html', height: 300 }),

      'authorization-status': async (t: TrelloT) => {
        if (CONFIG.dataPath !== 'rest') return { authorized: true };
        return { authorized: await t.getRestApi().isAuthorized().catch(() => false) };
      },

      'show-authorization': (t: TrelloT) =>
        t.popup({ title: localizer(t)('unauthorized'), url: './authorize.html', height: 200 }),
    },
    // Declared here so the client library fetches the bundle for the board's
    // locale before the first card-badges callback runs. Without it every
    // localizeKey is a miss and every string silently falls back to English.
    { localization: LOCALIZATION },
  );
}
