import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_MAX_CHARS } from '../src/constants';
import {
  CURRENT_VERSION,
  deriveFormState,
  isDirty,
  loadSettings,
  migrate,
  saveSettings,
  serialize,
  storageKey,
  withinBudget,
} from '../src/settings';
import type { TrelloT } from '../src/trello';
import { settings } from './helpers';

const fakeT = (stored?: unknown) => {
  const set = vi.fn(async () => undefined);
  const t = {
    get: vi.fn(async () => stored),
    set,
    getContext: () => ({ board: 'b1', member: 'm1' }),
  } as unknown as TrelloT;
  return { t, set };
};

describe('migrate', () => {
  it('turns anything unreadable into the defaults rather than throwing', () => {
    for (const junk of [null, undefined, 42, 'nope', [], true]) {
      expect(migrate(junk)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('fills missing fields from the defaults and stamps the current version', () => {
    const out = migrate({ showHeaders: false });
    expect(out.showHeaders).toBe(false);
    expect(out.progressFormat).toBe(DEFAULT_SETTINGS.progressFormat);
    expect(out.v).toBe(CURRENT_VERSION);
  });

  it('replaces an invalid field with its default instead of rejecting the object', () => {
    const out = migrate({ progressFormat: 'roman-numerals', finishedColor: '#61BD4F', checklistLimit: -3, showHeaders: false });
    expect(out.progressFormat).toBe('fraction');
    expect(out.finishedColor).toBe('green');
    expect(out.checklistLimit).toBe('all');
    expect(out.showHeaders).toBe(false); // the valid field survives
  });

  it('drops unknown fields so they cannot eat the storage budget', () => {
    const out = migrate({ showHeaders: true, somethingFromV2: 'x'.repeat(5000) }) as Record<string, unknown>;
    expect(out['somethingFromV2']).toBeUndefined();
  });

  it('accepts a v0 blob (no version field) as a v1 blob', () => {
    const out = migrate({ showHeaders: true, progressFormat: 'percent' });
    expect(out.v).toBe(1);
    expect(out.progressFormat).toBe('percent');
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const once = migrate(raw);
        expect(migrate(once)).toEqual(once);
      }),
    );
  });

  it('always produces a blob inside the 4096-character budget, whatever the input', () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        expect(withinBudget(migrate(raw))).toBe(true);
      }),
    );
  });
});

describe('storage budget', () => {
  it('stays under 4096 characters at maximum configuration', () => {
    const maximal = settings({
      showHeaders: true, progressFormat: 'percent',
      finishedColor: 'light-gray', unfinishedColor: 'light-gray',
      hideCompletedChecklists: true, checklistLimit: 10,
      showIncompleteItems: true, incompleteItemLimit: 10, showCompletedItems: true,
    });
    expect(serialize(maximal).length).toBeLessThan(SETTINGS_MAX_CHARS);
  });

  it('refuses to save an over-budget blob rather than failing silently', async () => {
    const { t } = fakeT();
    const bloated = { ...DEFAULT_SETTINGS, junk: 'x'.repeat(5000) } as never;
    await expect(saveSettings(t, bloated)).rejects.toThrow(/4096/);
  });
});

describe('persistence', () => {
  it('writes every key as ONE object in ONE call - concurrent writes collide silently', async () => {
    const { t, set } = fakeT();
    await saveSettings(t, DEFAULT_SETTINGS);
    expect(set).toHaveBeenCalledTimes(1);
    const [scope, visibility, payload] = set.mock.calls[0]! as unknown as [string, string, Record<string, unknown>];
    expect([scope, visibility]).toEqual(['member', 'private']);
    expect(Object.keys(payload)).toHaveLength(1);
  });

  it('survives a stored string as well as a stored object', async () => {
    expect((await loadSettings(fakeT(JSON.stringify({ showHeaders: false })).t)).showHeaders).toBe(false);
    expect((await loadSettings(fakeT({ showHeaders: false }).t)).showHeaders).toBe(false);
  });

  it('falls back to the defaults on unparseable storage rather than surfacing an error', async () => {
    expect(await loadSettings(fakeT('{not json').t)).toEqual(DEFAULT_SETTINGS);
  });

  it('A6: the key strategy is scoped, not hardcoded', () => {
    expect(storageKey('member-global', 'b1')).toBe('nextActions');
    expect(storageKey('member-per-board', 'b1')).toBe('nextActions:b1');
  });
});

describe('deriveFormState', () => {
  it('disables the colour pickers and the format when headers are off', () => {
    const s = deriveFormState(settings({ showHeaders: false }));
    expect([s.finishedColor, s.unfinishedColor, s.progressFormat]).toEqual([false, false, false]);
  });

  it('disables the item limit when unfinished items are off', () => {
    expect(deriveFormState(settings({ showIncompleteItems: false })).incompleteItemLimit).toBe(false);
    expect(deriveFormState(settings({ showIncompleteItems: true })).incompleteItemLimit).toBe(true);
  });

  it('keeps the checklist filter live with headers off, because A2 says it still gates items', () => {
    const s = deriveFormState(settings({ showHeaders: false, showIncompleteItems: true }));
    expect(s.hideCompletedChecklists).toBe(true);
  });

  it('disables the checklist controls only when nothing renders at all', () => {
    const s = deriveFormState(settings({ showHeaders: false, showIncompleteItems: false, showCompletedItems: false }));
    expect([s.hideCompletedChecklists, s.checklistLimit]).toEqual([false, false]);
  });

  it('never disables a control that is its own parent', () => {
    fc.assert(
      fc.property(fc.record({ showHeaders: fc.boolean(), showIncompleteItems: fc.boolean(), showCompletedItems: fc.boolean() }), (o) => {
        const s = deriveFormState(settings(o));
        expect(s.showHeaders).toBe(true);
        expect(s.showIncompleteItems).toBe(true);
        expect(s.showCompletedItems).toBe(true);
      }),
    );
  });
});

describe('isDirty', () => {
  it('detects a change and ignores key order', () => {
    expect(isDirty(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toBe(false);
    expect(isDirty(DEFAULT_SETTINGS, settings({ showHeaders: false }))).toBe(true);
  });
});
