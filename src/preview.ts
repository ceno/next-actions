/**
 * The local preview. Not part of the Power-Up; never registered, never shipped.
 *
 * It exists because the product is a VISUAL decision — how many badges is too
 * many, whether item text reads at card width, whether headers-only is the right
 * default (SPEC.md 5.5, still open) — and none of that can be judged from a test
 * assertion. It renders the REAL `computeBadges` against fixed fixtures, with
 * every Settings field, every BadgePolicy option and both caps wired to a live
 * control, so the whole option space can be walked in a browser in a minute.
 *
 * WHAT IT IS NOT: it is not Trello. The card frame and the badge pills are our
 * approximation of Trello's rendering, the colours are approximations of Trello's
 * named palette, and Trello shipped its own card-front checklist expansion in
 * April 2026 which is not drawn here at all. Judge COUNT, LENGTH and WORDING
 * here. Do not judge exact colour, spacing or collision with native output here —
 * that is E3 and E4, on a real board.
 */

import { computeBadges } from './badges';
import { DEFAULT_CAPS, DEFAULT_POLICY, DEFAULT_SETTINGS } from './constants';
import { BADGE_COLORS } from './types';
import type { BadgeCaps, BadgePolicy, Checklist, Limit, Settings } from './types';

// --- fixtures ----------------------------------------------------------------

const items = (pattern: string, names: string[], idPrefix: string) =>
  [...pattern].map((c, i) => ({
    id: `${idPrefix}-${i}`,
    name: names[i] ?? `Item ${i + 1}`,
    complete: c === 'x',
    pos: i + 1,
  }));

interface Scenario {
  card: string;
  /** Why this card is in the set. Shown, so the preview explains itself. */
  note: string;
  checklists: Checklist[];
}

/**
 * Deliberately a spread of the awkward cases rather than a happy path: the
 * default view should be the one that shows you the problems.
 */
export const SCENARIOS: Scenario[] = [
  {
    card: 'Ship the onboarding flow',
    note: 'The ordinary case: one partially-finished checklist.',
    checklists: [
      {
        id: 'c1',
        name: 'Launch',
        pos: 1,
        items: items('xxoo', ['Copy review', 'Design QA', 'Analytics events', 'Rollout plan'], 'a'),
      },
    ],
  },
  {
    card: 'Quarterly close',
    note: 'Several checklists at once — this is where the badge count runs away.',
    checklists: [
      { id: 'c2', name: 'Finance', pos: 1, items: items('xxx', ['Reconcile', 'Accruals', 'Sign off'], 'b') },
      { id: 'c3', name: 'Legal', pos: 2, items: items('xo', ['Contracts', 'Filings'], 'c') },
      {
        id: 'c4',
        name: 'Comms',
        pos: 3,
        items: items('ooo', ['Draft the note', 'Exec review', 'Send'], 'd'),
      },
    ],
  },
  {
    card: 'Migrate the billing service',
    note: 'Long item names. This is what the 64-code-point cap is for — watch the ellipsis.',
    checklists: [
      {
        id: 'c5',
        name: 'Cutover',
        pos: 1,
        items: items(
          'oo',
          [
            'Drain the queue and confirm zero in-flight messages before switching the DNS record',
            'Short one',
          ],
          'e',
        ),
      },
    ],
  },
  {
    card: 'Edge cases',
    note: 'Empty checklist (A5), an unnamed item, and emoji — the surrogate-pair truncation case.',
    checklists: [
      { id: 'c6', name: 'Nothing in here', pos: 1, items: [] },
      {
        id: 'c7',
        name: '',
        pos: 2,
        items: items('ox', ['', '🎉🎉🎉 Ship it 🎉🎉🎉'], 'f'),
      },
    ],
  },
  {
    card: 'Tied positions',
    note: 'Two checklists share a pos. Order must be stable across reloads — reload and check.',
    checklists: [
      { id: 'zzz', name: 'Beta (pos 1)', pos: 1, items: items('o', ['One'], 'g') },
      { id: 'aaa', name: 'Alpha (pos 1)', pos: 1, items: items('x', ['Two'], 'h') },
    ],
  },
];

// --- state -------------------------------------------------------------------

let settings: Settings = { ...DEFAULT_SETTINGS };
let policy: BadgePolicy = { ...DEFAULT_POLICY };
let caps: BadgeCaps = { ...DEFAULT_CAPS };

const LIMITS: Limit[] = ['all', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// --- controls ----------------------------------------------------------------

function control(parent: HTMLElement, label: string, el: HTMLElement): void {
  const wrap = document.createElement('label');
  wrap.className = 'ctl';
  const span = document.createElement('span');
  span.textContent = label;
  wrap.append(span, el);
  parent.append(wrap);
}

function check(parent: HTMLElement, label: string, get: () => boolean, set: (v: boolean) => void) {
  const el = document.createElement('input');
  el.type = 'checkbox';
  el.checked = get();
  el.addEventListener('change', () => {
    set(el.checked);
    render();
  });
  control(parent, label, el);
}

function choose<T extends string | number>(
  parent: HTMLElement,
  label: string,
  options: readonly T[],
  get: () => T,
  set: (v: T) => void,
) {
  const el = document.createElement('select');
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = String(o);
    opt.textContent = String(o);
    el.append(opt);
  }
  el.value = String(get());
  el.addEventListener('change', () => {
    const raw = el.value;
    set((/^\d+$/.test(raw) ? Number(raw) : raw) as T);
    render();
  });
  control(parent, label, el);
}

function number(
  parent: HTMLElement,
  label: string,
  get: () => number,
  set: (v: number) => void,
) {
  const el = document.createElement('input');
  el.type = 'number';
  el.min = '0';
  el.value = String(get());
  el.addEventListener('input', () => {
    set(Number(el.value));
    render();
  });
  control(parent, label, el);
}

function buildControls(root: HTMLElement): void {
  const group = (title: string, hint: string) => {
    const box = document.createElement('section');
    box.className = 'group';
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = hint;
    box.append(h, p);
    root.append(box);
    return box;
  };

  const s = group('Settings', 'What a user can change in the popup.');
  check(s, 'showHeaders', () => settings.showHeaders, (v) => (settings.showHeaders = v));
  choose(s, 'progressFormat', ['fraction', 'percent'] as const,
    () => settings.progressFormat, (v) => (settings.progressFormat = v));
  choose(s, 'finishedColor', ['none', ...BADGE_COLORS] as const,
    () => settings.finishedColor, (v) => (settings.finishedColor = v));
  choose(s, 'unfinishedColor', ['none', ...BADGE_COLORS] as const,
    () => settings.unfinishedColor, (v) => (settings.unfinishedColor = v));
  check(s, 'hideCompletedChecklists', () => settings.hideCompletedChecklists,
    (v) => (settings.hideCompletedChecklists = v));
  choose(s, 'checklistLimit', LIMITS, () => settings.checklistLimit,
    (v) => (settings.checklistLimit = v));
  check(s, 'showIncompleteItems ★', () => settings.showIncompleteItems,
    (v) => (settings.showIncompleteItems = v));
  choose(s, 'incompleteItemLimit', LIMITS, () => settings.incompleteItemLimit,
    (v) => (settings.incompleteItemLimit = v));
  check(s, 'showCompletedItems', () => settings.showCompletedItems,
    (v) => (settings.showCompletedItems = v));

  const p = group('Policy (A1–A5, S1)', 'Unresolved behaviours. Every default here is a guess that M0b replaces.');
  choose(p, 'A1 ordering', ['position', 'complete-first'] as const,
    () => policy.ordering, (v) => (policy.ordering = v));
  check(p, 'A2 checklistGatesItems', () => policy.checklistGatesItems,
    (v) => (policy.checklistGatesItems = v));
  choose(p, 'A3 itemLimitScope', ['per-checklist', 'per-card'] as const,
    () => policy.itemLimitScope, (v) => (policy.itemLimitScope = v));
  choose(p, 'A4 percentRounding', ['round', 'floor'] as const,
    () => policy.percentRounding, (v) => (policy.percentRounding = v));
  check(p, 'A5 emptyChecklistIsComplete', () => policy.emptyChecklistIsComplete,
    (v) => (policy.emptyChecklistIsComplete = v));
  check(p, 'S1 suppressRedundantSingleHeader', () => policy.suppressRedundantSingleHeader,
    (v) => (policy.suppressRedundantSingleHeader = v));

  const c = group('Caps', 'Hard internal limits. They win over every setting, including "all". E3 replaces both.');
  number(c, 'maxBadges', () => caps.maxBadges, (v) => (caps.maxBadges = v));
  number(c, 'maxTextLength', () => caps.maxTextLength, (v) => (caps.maxTextLength = v));

  const a = group('Actions', '');
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset to shipped defaults';
  reset.addEventListener('click', () => {
    settings = { ...DEFAULT_SETTINGS };
    policy = { ...DEFAULT_POLICY };
    caps = { ...DEFAULT_CAPS };
    root.replaceChildren();
    buildControls(root);
    render();
  });
  a.append(reset);
}

// --- rendering ---------------------------------------------------------------

function render(): void {
  const board = document.getElementById('board');
  if (!board) return;
  board.replaceChildren();

  let total = 0;

  for (const scenario of SCENARIOS) {
    const badges = computeBadges(scenario.checklists, settings, policy, caps);
    total += badges.length;

    const card = document.createElement('article');
    card.className = 'card';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = scenario.card;

    const row = document.createElement('div');
    row.className = 'badges';
    for (const b of badges) {
      const pill = document.createElement('span');
      pill.className = b.color ? `badge c-${b.color}` : 'badge';
      pill.textContent = b.text;
      if (b.title) pill.title = b.title;
      row.append(pill);
    }

    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = `${scenario.note}  (${badges.length} badge${badges.length === 1 ? '' : 's'})`;

    card.append(title, row, note);
    board.append(card);
  }

  const count = document.getElementById('count');
  if (count) {
    count.textContent = `${total} badges across ${SCENARIOS.length} cards`;
  }
}

export function mountPreview(): void {
  const controls = document.getElementById('controls');
  if (controls) buildControls(controls);
  render();
}
