/**
 * Capability wiring. Everything here is glue: the logic lives in badges.ts
 * (pure), the data access in data.ts, the storage in settings.ts.
 *
 * Capabilities: card-badges, show-settings, remove-data, on-enable, plus the two
 * authorization capabilities that Path B needs.
 */

import { computeBadges } from './badges';
import { CONFIG, REST_API_OPTIONS } from './config';
import { DEFAULT_POLICY, DEFAULT_SETTINGS, SETTINGS_KEY } from './constants';
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
import { powerUp, type TrelloRestApi, type TrelloT } from './trello';
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

/**
 * `t.getRestApi()` THROWS - synchronously - when the client library was not
 * initialized with an `appKey`. Every call site must therefore be guarded, not
 * just the promise it returns: `t.getRestApi().isAuthorized().catch(...)` still
 * takes the throw, because the throw happens before there is a promise to catch.
 *
 * Getting this wrong took down more than Path B. The `authorization-status`
 * capability threw on every invocation, and a capability that throws is a
 * Power-Up Trello stops asking.
 */
function restApi(t: TrelloT): TrelloRestApi | null {
  try {
    return t.getRestApi();
  } catch {
    return null;
  }
}

async function isAuthorized(t: TrelloT): Promise<boolean> {
  const api = restApi(t);
  if (!api) return false;
  return api.isAuthorized().catch(() => false);
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
    // Diagnostic only, and first: the whole point is to see the reason BEFORE
    // any fallback hides it behind a plausible-looking pill.
    if (CONFIG.debugBadges) {
      const api = restApi(t);
      const authorized = api
        ? await api
            .isAuthorized()
            .then((v) => String(v))
            .catch((e) => `threw:${String(e)}`)
        : 'no-restApi';
      return [
        { text: `auth=${authorized}`, color: 'purple' },
        { text: checklists.reason.slice(0, 60), color: 'red' },
      ];
    }

    // "We do not know" is not "there is nothing". Rendering [] here would make a
    // broken data source look like an empty board.
    if (CONFIG.degradeToAggregate) {
      const fallback = await aggregateSource.forCard(t, cardId);
      if (!isUnavailable(fallback)) {
        // Path C carries counts and nothing else: its items are synthetic
        // placeholders with no names. Honouring the item settings here would
        // draw a row of bare checkboxes that say nothing, so the aggregate
        // answers the header badge only - whatever the user asked for.
        //
        // S1 must also be forced OFF. It suppresses the header of a lone
        // checklist as redundant, and Path C synthesises exactly one - so the
        // shipped default would suppress the only badge the fallback can emit
        // and render a blank card, which is the precise failure degrading to an
        // aggregate exists to prevent. The redundancy argument does not apply
        // here anyway: this is the degraded state, and a duplicated count is the
        // point of it.
        return computeBadges(
          fallback,
          { ...settings, showIncompleteItems: false, showCompletedItems: false },
          { ...DEFAULT_POLICY, suppressRedundantSingleHeader: false },
          undefined,
          L,
        );
      }
    }
    if (CONFIG.showUnauthorizedBadge && CONFIG.dataPath === 'rest') {
      if (!(await isAuthorized(t))) return [{ text: L('unauthorized'), color: 'light-gray' }];
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
        await restApi(t)?.clearToken().catch(() => undefined);
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
        return { authorized: await isAuthorized(t) };
      },

      'show-authorization': (t: TrelloT) =>
        t.popup({ title: localizer(t)('unauthorized'), url: './authorize.html', height: 200 }),
    },
    {
      // Declared here so the client library fetches the bundle for the board's
      // locale before the first card-badges callback runs. Without it every
      // localizeKey is a miss and every string silently falls back to English.
      localization: LOCALIZATION,

      // REQUIRED for `t.getRestApi()` to exist at all. Without these the client
      // library has nothing to authorize AS, and `getRestApi()` throws on every
      // call - which is not a Path B problem but a whole-Power-Up problem, since
      // the `authorization-status` capability calls it on every board load.
      //
      // Not optional, not a nicety, and documented nowhere near the capability
      // that needs it.
      ...REST_API_OPTIONS,
    },
  );
}
