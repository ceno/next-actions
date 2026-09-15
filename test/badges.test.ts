import { describe, expect, it } from 'vitest';
import { computeBadges, formatProgress, truncate } from '../src/badges';
import { DEFAULT_CAPS, DEFAULT_SETTINGS, GLYPH_COMPLETE, GLYPH_INCOMPLETE } from '../src/constants';
import { headersOnly, list, policy, settings, texts, unsuppressed } from './helpers';

describe('empty and degenerate input', () => {
  it('returns an empty array for a card with no checklists', () => {
    expect(computeBadges([], DEFAULT_SETTINGS)).toEqual([]);
  });

  it('never emits a badge with empty or whitespace-only text', () => {
    const anonymous = { id: 'c', name: '', pos: 1, items: [{ id: 'i', name: '', complete: false, pos: 1 }] };
    const out = computeBadges([anonymous], settings({ showIncompleteItems: true }), unsuppressed());
    expect(out.length).toBe(2);
    for (const b of out) expect(b.text.trim()).not.toBe('');
  });

  it('renders an unnamed checklist as bare progress, with no trailing space', () => {
    const out = computeBadges([{ id: 'c', name: '', pos: 1, items: [] }], DEFAULT_SETTINGS, unsuppressed());
    expect(out[0]!.text).toBe('0/0');
  });

  it('renders an unnamed item as the glyph alone rather than hiding it', () => {
    const c = { id: 'c', name: 'L', pos: 1, items: [{ id: 'i', name: '', complete: false, pos: 1 }] };
    const out = computeBadges([c], settings({ showHeaders: false, showIncompleteItems: true }));
    expect(texts(out)).toEqual([GLYPH_INCOMPLETE]);
  });
});

describe('header badges', () => {
  it('formats as "<progress> <name>"', () => {
    const out = computeBadges([list('Place to stay', 'xx')], DEFAULT_SETTINGS, unsuppressed());
    expect(out[0]!.text).toBe('2/2 Place to stay');
  });

  it('formats as a percentage when asked', () => {
    const out = computeBadges([list('Transport', 'xoo')], settings({ progressFormat: 'percent' }), unsuppressed());
    expect(out[0]!.text).toBe('33% Transport');
  });

  it('colours complete green and incomplete orange by default', () => {
    const out = computeBadges([list('A', 'xx', 1), list('B', 'xo', 2)], headersOnly());
    expect(out.map((b) => b.color)).toEqual(['green', 'orange']);
  });

  it('omits the colour field entirely when the colour is "none"', () => {
    const out = computeBadges([list('A', 'xx')], settings({ finishedColor: 'none' }), unsuppressed());
    expect(out[0]!).not.toHaveProperty('color');
  });

  it('does not special-case a checklist named "Checklist"', () => {
    const out = computeBadges([list('Checklist', 'ooo')], DEFAULT_SETTINGS, unsuppressed());
    expect(out[0]!.text).toBe('0/3 Checklist');
  });

  it('renders 0/N in the unfinished colour', () => {
    const out = computeBadges([list('A', 'ooo')], DEFAULT_SETTINGS, unsuppressed());
    expect(out[0]!.color).toBe('orange');
  });

  it('carries the state in the tooltip, not only in the colour', () => {
    const out = computeBadges([list('Transport', 'xoo')], DEFAULT_SETTINGS, unsuppressed());
    expect(out[0]!.title).toBe('Transport — 1 of 3 items finished');
  });

  it('S1: suppresses the redundant single header BY DEFAULT', () => {
    // Resolved 2026-09-15 on a live board. The vendor does not suppress this;
    // we do, because on a one-checklist card the header restates Trello's own
    // native badge and adds only the checklist name.
    const out = computeBadges([list('Checklist', 'ooo')], headersOnly());
    expect(out).toEqual([]);
  });

  it('S1: keeps the header when the card has more than one checklist', () => {
    // Trello's native badge sums ALL checklists, so with two of them the
    // per-checklist names and counts are the only way to tell them apart.
    const out = computeBadges([list('Transport', 'oo', 1), list('Packing', 'xo', 2)], headersOnly());
    expect(texts(out)).toEqual(['0/2 Transport', '1/2 Packing']);
  });

  it('S1: emits the single header when the option is off', () => {
    const out = computeBadges([list('Checklist', 'ooo')], headersOnly(), unsuppressed());
    expect(out.length).toBe(1);
  });
});

describe('item badges', () => {
  it('prefixes the unicode glyphs and leaves item text raw', () => {
    const c = {
      id: 'c', name: 'L', pos: 1,
      items: [{ id: 'i', name: 'Agree date /time', complete: false, pos: 1 }],
    };
    const out = computeBadges([c], settings({ showHeaders: false, showIncompleteItems: true }));
    expect(texts(out)).toEqual([`${GLYPH_INCOMPLETE} Agree date /time`]);
  });

  it('gives completed items no colour and no styling difference beyond the glyph', () => {
    const out = computeBadges(
      [list('L', 'xo')],
      settings({ showHeaders: false, showIncompleteItems: true, showCompletedItems: true }),
    );
    expect(out.map((b) => b.color)).toEqual([undefined, undefined]);
    expect(texts(out)).toEqual([`${GLYPH_COMPLETE} L item 0`, `${GLYPH_INCOMPLETE} L item 1`]);
  });

  it('hides completed items unless asked for them', () => {
    const out = computeBadges([list('L', 'xxo')], settings({ showHeaders: false, showIncompleteItems: true }));
    expect(out.length).toBe(1);
  });

  // Reversed 2026-09-15. The old default emitted headers only; that withheld
  // the one thing this Power-Up exists to show, so the zero-config state now
  // includes the unfinished items. See DEFAULT_SETTINGS.
  it('emits item badges by default - the item text is the product', () => {
    // Single checklist, so S1 drops the header: the items ARE the whole output.
    const out = computeBadges([list('L', 'xoo')], DEFAULT_SETTINGS);
    expect(texts(out)).toEqual([
      `${GLYPH_INCOMPLETE} L item 1`,
      `${GLYPH_INCOMPLETE} L item 2`,
    ]);
  });

  it('emits the header alongside the items on a multi-checklist card', () => {
    const out = computeBadges([list('A', 'xo', 1), list('B', 'oo', 2)], DEFAULT_SETTINGS);
    expect(texts(out)).toEqual([
      '1/2 A',
      `${GLYPH_INCOMPLETE} A item 1`,
      '0/2 B',
      `${GLYPH_INCOMPLETE} B item 0`,
      `${GLYPH_INCOMPLETE} B item 1`,
    ]);
  });

  it('emits no item badges once the user turns them off', () => {
    const out = computeBadges([list('L', 'xoo')], headersOnly(), unsuppressed());
    expect(out.length).toBe(1);
  });
});

describe('limits', () => {
  it('truncates incomplete items to the first N in order', () => {
    const out = computeBadges(
      [list('L', 'ooooo')],
      settings({ showHeaders: false, showIncompleteItems: true, incompleteItemLimit: 2 }),
    );
    expect(texts(out)).toEqual([`${GLYPH_INCOMPLETE} L item 0`, `${GLYPH_INCOMPLETE} L item 1`]);
  });

  it('does not limit completed items - they are all-or-nothing', () => {
    const out = computeBadges(
      [list('L', 'xxxxo')],
      settings({ showHeaders: false, showIncompleteItems: true, showCompletedItems: true, incompleteItemLimit: 1 }),
    );
    expect(out.length).toBe(5);
  });

  it('truncates checklists to the first N in order', () => {
    const out = computeBadges(
      [list('A', 'o', 1), list('B', 'o', 2), list('C', 'o', 3)],
      headersOnly({ checklistLimit: 2 }),
    );
    expect(texts(out)).toEqual(['0/1 A', '0/1 B']);
  });

  it('treats a limit of 0 as none', () => {
    const out = computeBadges(
      [list('L', 'ooo')],
      settings({ showHeaders: false, showIncompleteItems: true, incompleteItemLimit: 0 }),
    );
    expect(out).toEqual([]);
  });
});

describe('A1 - ordering (UNRESOLVED: these assertions encode the provisional default)', () => {
  const two = [list('Incomplete', 'o', 1), list('Complete', 'x', 2)];

  it('position order: checklist pos wins over completeness', () => {
    expect(texts(computeBadges(two, headersOnly(), policy({ ordering: 'position' }))))
      .toEqual(['0/1 Incomplete', '1/1 Complete']);
  });

  it('complete-first order: completeness wins over pos', () => {
    expect(texts(computeBadges(two, headersOnly(), policy({ ordering: 'complete-first' }))))
      .toEqual(['1/1 Complete', '0/1 Incomplete']);
  });

  it('position order keeps an unchecked first item before a checked second', () => {
    const out = computeBadges(
      [list('L', 'ox')],
      settings({ showHeaders: false, showIncompleteItems: true, showCompletedItems: true }),
      policy({ ordering: 'position' }),
    );
    expect(texts(out)).toEqual([`${GLYPH_INCOMPLETE} L item 0`, `${GLYPH_COMPLETE} L item 1`]);
  });

  it('complete-first order reverses that pair', () => {
    const out = computeBadges(
      [list('L', 'ox')],
      settings({ showHeaders: false, showIncompleteItems: true, showCompletedItems: true }),
      policy({ ordering: 'complete-first' }),
    );
    expect(texts(out)).toEqual([`${GLYPH_COMPLETE} L item 1`, `${GLYPH_INCOMPLETE} L item 0`]);
  });

  it('breaks pos ties deterministically by id, whatever order the source gave', () => {
    const a = { id: 'aaa', name: 'A', pos: 1, items: [] };
    const b = { id: 'bbb', name: 'B', pos: 1, items: [] };
    expect(texts(computeBadges([b, a], DEFAULT_SETTINGS))).toEqual(texts(computeBadges([a, b], DEFAULT_SETTINGS)));
  });
});

describe('A2 - does hiding a checklist hide its items (UNRESOLVED)', () => {
  const card = [list('Done', 'xx', 1), list('Open', 'xo', 2)];
  const s = settings({
    showHeaders: false, hideCompletedChecklists: true,
    showIncompleteItems: true, showCompletedItems: true,
  });

  it('gating on: a hidden checklist contributes no items', () => {
    const out = computeBadges(card, s, policy({ checklistGatesItems: true }));
    expect(texts(out)).toEqual([`${GLYPH_COMPLETE} Open item 0`, `${GLYPH_INCOMPLETE} Open item 1`]);
  });

  it('gating off: the item filter alone decides, so hidden checklists still show items', () => {
    const out = computeBadges(card, s, policy({ checklistGatesItems: false }));
    expect(out.length).toBe(4);
  });
});

describe('A3 - item limit scope (UNRESOLVED)', () => {
  const card = [list('A', 'oo', 1), list('B', 'oo', 2)];
  const s = settings({ showHeaders: false, showIncompleteItems: true, incompleteItemLimit: 1 });

  it('per-checklist: one item from each checklist', () => {
    const out = computeBadges(card, s, policy({ itemLimitScope: 'per-checklist' }));
    expect(texts(out)).toEqual([`${GLYPH_INCOMPLETE} A item 0`, `${GLYPH_INCOMPLETE} B item 0`]);
  });

  it('per-card: one item on the whole card', () => {
    const out = computeBadges(card, s, policy({ itemLimitScope: 'per-card' }));
    expect(texts(out)).toEqual([`${GLYPH_INCOMPLETE} A item 0`]);
  });
});

describe('A4/A5 - rounding and the empty checklist (UNRESOLVED, chosen by fiat)', () => {
  const s = settings({ progressFormat: 'percent' });

  it('rounds by default: 2/3 is 67%', () => {
    expect(formatProgress(2, 3, s, policy())).toBe('67%');
  });

  it('floors when asked: 2/3 is 66%', () => {
    expect(formatProgress(2, 3, s, policy({ percentRounding: 'floor' }))).toBe('66%');
  });

  it('agrees on 1/3 either way - which is why the artefacts cannot settle it', () => {
    expect(formatProgress(1, 3, s, policy())).toBe('33%');
    expect(formatProgress(1, 3, s, policy({ percentRounding: 'floor' }))).toBe('33%');
  });

  it('treats a 0-item checklist as complete by default', () => {
    const out = computeBadges([{ id: 'c', name: 'Empty', pos: 1, items: [] }], DEFAULT_SETTINGS, unsuppressed());
    expect(out[0]!.color).toBe('green');
    expect(formatProgress(0, 0, s, policy())).toBe('100%');
  });

  it('treats it as incomplete when the option is flipped', () => {
    const out = computeBadges([{ id: 'c', name: 'Empty', pos: 1, items: [] }], DEFAULT_SETTINGS, unsuppressed({ emptyChecklistIsComplete: false }));
    expect(out[0]!.color).toBe('orange');
    expect(formatProgress(0, 0, s, policy({ emptyChecklistIsComplete: false }))).toBe('0%');
  });
});

describe('caps', () => {
  it('truncates by code point and never splits a surrogate pair', () => {
    const emoji = '🎉'.repeat(40);
    const out = truncate(emoji, 10);
    expect([...out].length).toBe(10);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('�');
    expect(out.slice(0, -1)).toBe('🎉'.repeat(9));
  });

  it('caps badge text length', () => {
    const c = { id: 'c', name: 'x'.repeat(500), pos: 1, items: [] };
    const out = computeBadges([c], DEFAULT_SETTINGS, unsuppressed());
    expect([...out[0]!.text].length).toBe(DEFAULT_CAPS.maxTextLength);
  });

  it('caps badge count even when the settings say "all"', () => {
    const big = list('L', 'o'.repeat(200));
    const out = computeBadges(
      [big],
      settings({ showIncompleteItems: true, incompleteItemLimit: 'all' }),
    );
    expect(out.length).toBe(DEFAULT_CAPS.maxBadges);
  });
});

/**
 * GOLDEN — derived from the same artefacts that produced SPEC.md, so these
 * cannot validate A1-A3; they can only detect regressions. Every assertion here
 * is expected to change if an experiment flips an option.
 */
describe('golden: the "Summer Holiday" card [encodes A1, A2, A3]', () => {
  const card = [list('Place to stay', 'xx', 1), list('Transport', 'xoo', 2)];

  it('progress-only configuration', () => {
    expect(texts(computeBadges(card, headersOnly()))).toEqual(['2/2 Place to stay', '1/3 Transport']);
  });

  it('shipped defaults - headers plus the unfinished items beneath each', () => {
    expect(texts(computeBadges(card, DEFAULT_SETTINGS))).toEqual([
      '2/2 Place to stay',
      '1/3 Transport',
      `${GLYPH_INCOMPLETE} Transport item 1`,
      `${GLYPH_INCOMPLETE} Transport item 2`,
    ]);
  });

  it('everything shown', () => {
    const out = computeBadges(card, settings({ showIncompleteItems: true, showCompletedItems: true, incompleteItemLimit: 'all' }));
    expect(texts(out)).toEqual([
      '2/2 Place to stay',
      `${GLYPH_COMPLETE} Place to stay item 0`,
      `${GLYPH_COMPLETE} Place to stay item 1`,
      '1/3 Transport',
      `${GLYPH_COMPLETE} Transport item 0`,
      `${GLYPH_INCOMPLETE} Transport item 1`,
      `${GLYPH_INCOMPLETE} Transport item 2`,
    ]);
  });

  it('unfinished work only', () => {
    const out = computeBadges(card, settings({
      hideCompletedChecklists: true, showIncompleteItems: true, incompleteItemLimit: 'all',
    }));
    expect(texts(out)).toEqual([
      '1/3 Transport',
      `${GLYPH_INCOMPLETE} Transport item 1`,
      `${GLYPH_INCOMPLETE} Transport item 2`,
    ]);
  });

  it('next action only', () => {
    const out = computeBadges(card, settings({
      hideCompletedChecklists: true, showIncompleteItems: true, incompleteItemLimit: 1,
    }));
    expect(texts(out)).toEqual(['1/3 Transport', `${GLYPH_INCOMPLETE} Transport item 1`]);
  });
});
