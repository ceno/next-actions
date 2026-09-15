import { LABELS } from './constants';
import type { DataPathId } from './data';

/**
 * Build-time configuration. These are the knobs whose correct values are unknown
 * until the M0b experiments run; each is here rather than inline so that flipping
 * one after an experiment is a one-line change.
 */
export interface Config {
  /**
   * Which data path is live. `'rest'` is the assumed baseline: Path A is expected
   * to fail (SPEC.md 6.2) and Path C cannot produce the product (SPEC.md 6.4).
   * Deliberately not a fallback chain - see data.ts.
   */
  dataPath: DataPathId;
  /** Path C as the unauthorised/failed state. Off until E7 says it works. */
  degradeToAggregate: boolean;
  /** Your Trello API key. Path B only. Public by design; the token is the secret. */
  restApiKey: string;
  /** Emit a "Connect your account" badge when Path B has no token. */
  showUnauthorizedBadge: boolean;
  /**
   * Render the data path's failure REASON as the badge text.
   *
   * This exists because on this Trello client the card front is the only
   * Power-Up surface that paints at all: capability callbacks fire and popups
   * load, but no popup, modal or menu ever renders. No console, no settings
   * page, no spike report. The badge is the whole debugging channel, so it has
   * to be able to carry a message.
   *
   * Never ship this on: the reason strings are diagnostics, not user-facing
   * copy, and they bypass the localizer.
   */
  debugBadges: boolean;
}

export const CONFIG: Config = {
  // PATH B, 2026-09-15. The diagnostic build that preceded this answered its
  // question: Path A rendered `2/5` from the Path C fallback on every card,
  // which is E1 red and E7 green. The client library's checklist cache serves
  // stubs on this account, exactly as SPEC.md 6.2 predicted.
  //
  // Path C cannot be the product. It synthesises ONE nameless checklist of
  // nameless items from the card's count pair, so it can only ever draw a
  // progress pill - never a next action. Path B is the only path that carries
  // checklist names and item text, which is the entire point of this Power-Up.
  dataPath: 'rest',

  // Kept as the safety net BELOW Path B, not as a way of reaching it: a REST
  // blip now degrades to a true aggregate pill rather than to a blank card.
  degradeToAggregate: true,

  // Public by design - it ships in this bundle and is visible to anyone who
  // views source. The token is the secret, and it never lives here; the client
  // library holds it per-member. Generated for "Next Actions (dev)"
  // (6aa90a579e5dd131338e93aa) on 2026-09-15.
  restApiKey: 'e93523a47d399cc382f41c7f220137ab',

  showUnauthorizedBadge: true,

  // Off. See the field's doc comment before ever turning this on.
  debugBadges: false,
};

/**
 * The options that must be passed to BOTH `TrelloPowerUp.initialize` and every
 * `TrelloPowerUp.iframe` call, because `t.getRestApi()` does not exist without
 * them - it throws SYNCHRONOUSLY.
 *
 * Exported as one object rather than spelled out per call site, because this has
 * now been got wrong twice in two different places. `initialize` was missing it
 * (623b8f6), which took the whole Power-Up down; then `authorize.html` was still
 * missing it, so the Connect button reported
 *
 *   "To use the API helper, make sure you specify appKey and appName when you
 *    call TrelloPowerUp.iframe"
 *
 * and authorization could not be completed at all. A popup that renders and then
 * refuses on click looks like our bug, and it was.
 */
export const REST_API_OPTIONS = {
  appKey: CONFIG.restApiKey,
  appName: LABELS.appName,
} as const;
