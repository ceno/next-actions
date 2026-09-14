/**
 * Property tests.
 *
 * These carry more weight than the golden fixtures. The fixtures are derived
 * from the same artefacts that produced SPEC.md, so they cannot catch A1 or A2
 * being backwards - they assert exactly the behaviour that was guessed. These
 * properties hold whatever A1-A5 resolve to, which is why they are generated
 * over arbitrary policies as well as arbitrary data.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeBadges, countComplete, isComplete } from '../src/badges';
import { GLYPH_COMPLETE, GLYPH_INCOMPLETE } from '../src/constants';
import type { BadgeCaps, BadgePolicy, CheckItem, Checklist, Limit, Settings } from '../src/types';
import { BADGE_COLORS } from '../src/types';

const arbLimit: fc.Arbitrary<Limit> = fc.oneof(
  fc.constant<Limit>('all'),
  fc.integer({ min: 0, max: 12 }),
);

const arbSettings: fc.Arbitrary<Settings> = fc.record({
  v: fc.constant<1>(1),
  showHeaders: fc.boolean(),
  progressFormat: fc.constantFrom('fraction', 'percent') as fc.Arbitrary<Settings['progressFormat']>,
  finishedColor: fc.constantFrom(...BADGE_COLORS, 'none' as const),
  unfinishedColor: fc.constantFrom(...BADGE_COLORS, 'none' as const),
  hideCompletedChecklists: fc.boolean(),
  checklistLimit: arbLimit,
  showIncompleteItems: fc.boolean(),
  incompleteItemLimit: arbLimit,
  showCompletedItems: fc.boolean(),
});

const arbPolicy: fc.Arbitrary<BadgePolicy> = fc.record({
  ordering: fc.constantFrom('position', 'complete-first') as fc.Arbitrary<BadgePolicy['ordering']>,
  checklistGatesItems: fc.boolean(),
  itemLimitScope: fc.constantFrom('per-checklist', 'per-card') as fc.Arbitrary<BadgePolicy['itemLimitScope']>,
  percentRounding: fc.constantFrom('round', 'floor') as fc.Arbitrary<BadgePolicy['percentRounding']>,
  emptyChecklistIsComplete: fc.boolean(),
  suppressRedundantSingleHeader: fc.boolean(),
});

const arbCaps: fc.Arbitrary<BadgeCaps> = fc.record({
  maxBadges: fc.integer({ min: 0, max: 40 }),
  maxTextLength: fc.integer({ min: 8, max: 80 }),
});

/** Names are made unique so that emitted badges can be traced back to their item. */
function arbChecklist(cid: number): fc.Arbitrary<Checklist> {
  return fc
    .array(
      fc.record({
        complete: fc.boolean(),
        pos: fc.integer({ min: 0, max: 6 }),
        long: fc.boolean(),
        pad: fc.integer({ min: 0, max: 90 }),
      }),
      { maxLength: 8 },
    )
    .map((raw, ) => {
      const items: CheckItem[] = raw.map((r, i) => ({
        id: `c${cid}i${i}`,
        // Padded so that the text cap has something to bite on, and seeded with
        // an astral-plane character so truncation is exercised on a surrogate pair.
        name: `c${cid}i${i}` + (r.long ? `🎉${'x'.repeat(r.pad)}` : ''),
        complete: r.complete,
        pos: r.pos,
      }));
      return { id: `c${cid}`, name: `L${cid}`, pos: cid, items };
    });
}

const arbCard: fc.Arbitrary<Checklist[]> = fc
  .integer({ min: 0, max: 5 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => arbChecklist(i))))
  .map((cs) => [...cs]);

/** Roomy caps, for properties about content rather than about the caps themselves. */
const ROOMY: BadgeCaps = { maxBadges: 10_000, maxTextLength: 10_000 };

// 100 runs left the per-card item-budget mutant alive; 600 kills it reliably.
// The suite is a few hundred milliseconds either way.
fc.configureGlobal({ numRuns: 600 });

const isItemBadge = (text: string) => text.startsWith(GLYPH_COMPLETE) || text.startsWith(GLYPH_INCOMPLETE);

describe('properties', () => {
  it('an empty checklist set always yields an empty badge array', () => {
    fc.assert(
      fc.property(arbSettings, arbPolicy, arbCaps, (s, p, c) => {
        expect(computeBadges([], s, p, c)).toEqual([]);
      }),
    );
  });

  it('output length never exceeds the configured badge cap', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, arbCaps, (card, s, p, c) => {
        expect(computeBadges(card, s, p, c).length).toBeLessThanOrEqual(c.maxBadges);
      }),
    );
  });

  it('no badge text ever exceeds the text cap, measured in code points', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, arbCaps, (card, s, p, c) => {
        for (const b of computeBadges(card, s, p, c)) {
          expect([...b.text].length).toBeLessThanOrEqual(c.maxTextLength);
        }
      }),
    );
  });

  it('no badge is ever emitted with empty or whitespace-only text', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, arbCaps, (card, s, p, c) => {
        for (const b of computeBadges(card, s, p, c)) expect(b.text.trim()).not.toBe('');
      }),
    );
  });

  it('every emitted colour is a legal Trello colour name, or the field is absent', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, arbCaps, (card, s, p, c) => {
        for (const b of computeBadges(card, s, p, c)) {
          if (b.color !== undefined) expect(BADGE_COLORS).toContain(b.color);
        }
      }),
    );
  });

  it('a header badge is emitted for a checklist only if the checklist filter admits it', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, (card, s, p) => {
        const out = computeBadges(card, s, p, ROOMY);
        const headers = out.filter((b) => !isItemBadge(b.text));

        if (!s.showHeaders || (p.suppressRedundantSingleHeader && card.length === 1)) {
          expect(headers).toHaveLength(0);
          return;
        }
        const admitted = s.hideCompletedChecklists
          ? card.filter((cl) => !isComplete(cl, p))
          : card;
        const cap = s.checklistLimit === 'all' ? Infinity : s.checklistLimit;
        expect(headers.length).toBe(Math.min(admitted.length, cap));

        // and each header that did appear belongs to an admitted checklist
        const admittedNames = new Set(admitted.map((cl) => cl.name));
        for (const h of headers) {
          const name = h.text.slice(h.text.indexOf(' ') + 1);
          expect(admittedNames.has(name)).toBe(true);
        }
      }),
    );
  });

  it('emitted items are a subsequence of that checklist\'s ordered items - filtering never reorders', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, (card, s, p) => {
        const emitted = computeBadges(card, s, p, ROOMY)
          .filter((b) => isItemBadge(b.text))
          .map((b) => b.text.slice(2)); // strip "<glyph> "

        // The full ordering the function would have produced, unfiltered.
        const ordered: string[] = [];
        const orderedChecklists =
          p.ordering === 'position'
            ? [...card].sort((a, b) => a.pos - b.pos)
            : [...[...card].sort((a, b) => a.pos - b.pos).filter((cl) => isComplete(cl, p)),
               ...[...card].sort((a, b) => a.pos - b.pos).filter((cl) => !isComplete(cl, p))];
        for (const cl of orderedChecklists) {
          const its = [...cl.items].sort((a, b) => (a.pos !== b.pos ? a.pos - b.pos : a.id < b.id ? -1 : 1));
          const seq = p.ordering === 'position'
            ? its
            : [...its.filter((i) => i.complete), ...its.filter((i) => !i.complete)];
          for (const i of seq) ordered.push(i.name);
        }

        let cursor = 0;
        for (const name of emitted) {
          const at = ordered.indexOf(name, cursor);
          expect(at).toBeGreaterThanOrEqual(0);
          cursor = at + 1;
        }
      }),
    );
  });

  it('the progress string round-trips the counts', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, (card, s, p) => {
        const out = computeBadges(card, { ...s, progressFormat: 'fraction' }, p, ROOMY);
        const byName = new Map(card.map((cl) => [cl.name, cl]));
        for (const b of out.filter((x) => !isItemBadge(x.text))) {
          const [progress, name] = [b.text.slice(0, b.text.indexOf(' ')), b.text.slice(b.text.indexOf(' ') + 1)];
          const cl = byName.get(name)!;
          expect(progress).toBe(`${countComplete(cl)}/${cl.items.length}`);
        }
      }),
    );
  });

  it('the number of incomplete item badges respects the limit under either scope', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, (card, s, p) => {
        const limit = s.incompleteItemLimit === 'all' ? Infinity : s.incompleteItemLimit;
        const out = computeBadges(card, s, p, ROOMY);
        const incomplete = out.filter((b) => b.text.startsWith(GLYPH_INCOMPLETE));

        if (p.itemLimitScope === 'per-card') {
          expect(incomplete.length).toBeLessThanOrEqual(limit);
        } else {
          expect(incomplete.length).toBeLessThanOrEqual(limit * card.length || 0);
        }
      }),
    );
  });

  it('turning an item class off can only remove badges of that class', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, (card, s, p) => {
        const withCompleted = computeBadges(card, { ...s, showCompletedItems: true }, p, ROOMY);
        const without = computeBadges(card, { ...s, showCompletedItems: false }, p, ROOMY);
        const nonCompleted = (bs: { text: string }[]) =>
          bs.filter((b) => !b.text.startsWith(GLYPH_COMPLETE)).map((b) => b.text);
        expect(nonCompleted(without)).toEqual(nonCompleted(withCompleted));
      }),
    );
  });

  it('an item class that is switched off emits no badges at all', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, arbCaps, (card, s, p, c) => {
        const out = computeBadges(card, s, p, c);
        if (!s.showCompletedItems) {
          expect(out.some((b) => b.text.startsWith(GLYPH_COMPLETE))).toBe(false);
        }
        if (!s.showIncompleteItems) {
          expect(out.some((b) => b.text.startsWith(GLYPH_INCOMPLETE))).toBe(false);
        }
      }),
    );
  });

  it('A2: when a checklist gates its items, a hidden checklist contributes nothing', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, (card, s, p) => {
        fc.pre(p.checklistGatesItems && s.hideCompletedChecklists);
        const hidden = card.filter((cl) => isComplete(cl, p));
        fc.pre(hidden.length > 0);
        const hiddenNames = new Set(hidden.flatMap((cl) => cl.items.map((i) => i.name)));

        const emitted = computeBadges(card, s, p, ROOMY)
          .filter((b) => isItemBadge(b.text))
          .map((b) => b.text.slice(2));
        for (const name of emitted) expect(hiddenNames.has(name)).toBe(false);
      }),
    );
  });

  it('every emitted badge text is a prefix of its untruncated form, or equal to it', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, arbCaps, (card, s, p, c) => {
        const capped = computeBadges(card, s, p, c);
        const uncapped = computeBadges(card, s, p, { ...ROOMY, maxBadges: c.maxBadges });
        expect(capped.length).toBe(uncapped.length);
        capped.forEach((b, i) => {
          const full = uncapped[i]!.text;
          const points = [...b.text];
          expect(points.length).toBeLessThanOrEqual(c.maxTextLength);
          if (b.text !== full) {
            expect(points[points.length - 1]).toBe('…');
            expect(full.startsWith(points.slice(0, -1).join(''))).toBe(true);
          }
        });
      }),
    );
  });

  it('is deterministic and independent of the order the source happened to return', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, arbCaps, (card, s, p, c) => {
        const a = computeBadges(card, s, p, c);
        const b = computeBadges([...card].reverse(), s, p, c);
        expect(b).toEqual(a);
      }),
    );
  });

  it('never mutates its input', () => {
    fc.assert(
      fc.property(arbCard, arbSettings, arbPolicy, arbCaps, (card, s, p, c) => {
        const before = JSON.stringify(card);
        computeBadges(card, s, p, c);
        expect(JSON.stringify(card)).toBe(before);
      }),
    );
  });
});
