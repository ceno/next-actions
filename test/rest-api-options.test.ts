/**
 * `t.getRestApi()` does not exist unless the client library was given `appKey`
 * and `appName`. That applies to `TrelloPowerUp.initialize` AND to every
 * `TrelloPowerUp.iframe` call, and the two have to agree.
 *
 * This is pinned by a test because it has been got wrong twice, in two places,
 * and neither failed loudly:
 *
 *  - `initialize` missing it took the entire Power-Up down (623b8f6): the
 *    `authorization-status` capability threw on every board load.
 *  - `authorize.html` missing it let the popup render perfectly and then refuse
 *    on click with "make sure you specify appKey and appName when you call
 *    TrelloPowerUp.iframe", which reads as a dead button.
 *
 * A grep-shaped test is unusual, but the defect is grep-shaped: the failure is a
 * call site that forgot an argument, not a behaviour a unit test can reach.
 */

import { describe, expect, it } from 'vitest';
import { CONFIG, REST_API_OPTIONS } from '../src/config';
import { LABELS } from '../src/constants';

// Read through Vite rather than node:fs, so the suite needs no @types/node.
const sources = import.meta.glob('../src/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const read = (f: string): string => {
  const key = Object.keys(sources).find((k) => k.endsWith(`/${f}`));
  if (key === undefined) throw new Error(`no source for ${f}`);
  return sources[key] as string;
};

describe('REST_API_OPTIONS', () => {
  it('carries the configured key and the app name', () => {
    expect(REST_API_OPTIONS.appKey).toBe(CONFIG.restApiKey);
    expect(REST_API_OPTIONS.appName).toBe(LABELS.appName);
  });

  it('is non-empty, or getRestApi() throws at runtime', () => {
    expect(REST_API_OPTIONS.appKey.length).toBeGreaterThan(0);
    expect(REST_API_OPTIONS.appName.length).toBeGreaterThan(0);
  });
});

describe('every Trello client-library entry point passes it', () => {
  // spike-report is excluded deliberately: it is a separate diagnostic
  // Power-Up that never calls getRestApi.
  const surfaces = ['connector.ts', 'authorize.ts', 'settings-ui.ts'];

  it.each(surfaces)('%s spreads REST_API_OPTIONS', (file) => {
    expect(read(file)).toContain('REST_API_OPTIONS');
  });

  it.each(surfaces)('%s has no bare iframe()/initialize() options object', (file) => {
    const src = read(file);
    // `iframe({ localization: ... })` with nothing else is the exact shape of
    // the bug: it looks configured, and omits the only thing getRestApi needs.
    expect(src).not.toMatch(/\.iframe\(\{\s*localization:\s*LOCALIZATION\s*\}\)/);
    expect(src).not.toMatch(/\.iframe\(\)/);
  });
});
