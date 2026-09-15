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
}

export const CONFIG: Config = {
  // LIVE E1/E7 RUN, 2026-09-15. Not a considered default - a diagnostic.
  // Path A first because it needs no API key and no authorization, so it is the
  // only path that can render anything on a first run. Path C behind it so the
  // two unknowns are separable by eye:
  //   per-checklist badges with names -> E1 green, Path A works
  //   one aggregate progress pill     -> E1 red, E7 green
  //   nothing                          -> both failed; go to Path B
  dataPath: 'client',
  degradeToAggregate: true,
  restApiKey: '',
  showUnauthorizedBadge: true,
};
