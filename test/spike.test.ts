import { describe, expect, it, vi } from 'vitest';
import { __resetSpike, __results, probeCard, spikeBadges, stressBadges } from '../src/spike';
import type { TrelloT } from '../src/trello';

const card = (checklists: unknown, badges: unknown = { checkItems: 3, checkItemsChecked: 1 }) =>
  ({
    card: vi.fn(async (field: string) => (field === 'badges' ? { badges } : { checklists })),
    getContext: () => ({ board: 'b1', card: 'card1', member: 'm1' }),
    set: vi.fn(async () => undefined),
    get: vi.fn(async () => 'probe'),
  }) as unknown as TrelloT;

const WORKING = [{ id: 'l1', name: 'L', pos: 1, checkItems: [{ id: 'i1', name: 'x', state: 'incomplete', pos: 1 }] }];
/** The real-world Path A failure shape: five fields, no checkItems. */
const BROKEN = [{ id: 'l1', idBoard: 'b', idCard: 'card1', name: 'L', pos: 1 }];

describe('probeCard', () => {
  it('records E1 as a pass when every checklist carries checkItems', async () => {
    const obs = await probeCard(card(WORKING), 'card1');
    expect(obs.e1ChecklistsHadItems).toBe(true);
    expect(obs.e1ChecklistCount).toBe(1);
    expect(obs.order).toEqual(['L [1]', '  o x (pos 1)']);
  });

  it('records E1 as a failure on the documented five-field shape, and says which fields it saw', async () => {
    const obs = await probeCard(card(BROKEN), 'card1');
    expect(obs.e1ChecklistsHadItems).toBe(false);
    expect(obs.e1FieldsSeen).toEqual(['id', 'idBoard', 'idCard', 'name', 'pos']);
    expect(obs.order).toBeNull();
  });

  it('records E7 separately from E1', async () => {
    const obs = await probeCard(card(BROKEN), 'card1');
    expect(obs.e7BadgeCountsPresent).toBe(true);
    expect([obs.e7Total, obs.e7Done]).toEqual([3, 1]);
  });

  it('treats a card with zero checklists as not-a-pass rather than a spurious green', async () => {
    const obs = await probeCard(card([]), 'card1');
    expect(obs.e1ChecklistsHadItems).toBe(false);
  });
});

describe('cold-load discipline', () => {
  it('never overwrites a card\'s first observation, so a self-heal cannot fake a pass', async () => {
    __resetSpike();
    const broken = card(BROKEN);
    await spikeBadges(broken);            // cold: fails
    const healed = card(WORKING);
    await spikeBadges(healed);            // warm: works, as it does after a toggle
    await spikeBadges(healed);

    const r = __results();
    expect(r.cold['card1']!.e1ChecklistsHadItems).toBe(false);
    expect(r.warm).toHaveLength(2);
    expect(r.warm.every((w) => w.e1ChecklistsHadItems)).toBe(true);
    expect(r.badgeRuns).toBe(3);
  });

  it('marks the first badge as cold and later ones as warm', async () => {
    __resetSpike();
    const t = card(WORKING);
    expect((await spikeBadges(t))[0]!.text).toContain('cold');
    expect((await spikeBadges(t))[0]!.text).toContain('warm');
  });

  it('counts every invocation, which is what E6 reads', async () => {
    __resetSpike();
    const t = card(WORKING);
    await spikeBadges(t);
    await spikeBadges(t);
    expect(__results().badgeRuns).toBe(2);
    expect(__results().lastBadgeRunAt).toBeGreaterThan(0);
  });
});

describe('stress mode (E3)', () => {
  it('emits 40 badges across the four text lengths', () => {
    const badges = stressBadges(40);
    expect(badges).toHaveLength(40);
    const lengths = new Set(badges.map((b) => b.text.length));
    expect([...lengths].sort((a, b) => a - b)).toEqual([20, 50, 100, 200]);
  });

  it('mixes coloured and uncoloured badges, since they may render differently', () => {
    const badges = stressBadges(9);
    expect(badges.some((b) => b.color)).toBe(true);
    expect(badges.some((b) => !b.color)).toBe(true);
  });
});
