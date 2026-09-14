/**
 * The M0b results page. Opened from the spike Power-Up's board button.
 *
 * Everything here is read-and-display, plus the two buttons that perform the
 * experiments a badge handler cannot: the cross-board storage check (E5) and the
 * settings-write check (E6).
 */

import { powerUp, type TrelloT } from './trello';
import { SPIKE_KEY, SPIKE_MODE_KEY, type SpikeMode, type SpikeResults } from './spike';

const STAMP_KEY = 'spikeCrossBoardStamp';

interface Stamp {
  writtenOnBoard: string;
  at: number;
}

/** A line in a panel: prose, or a button. */
type Line = string | { button: string; action: string } | false;

export async function mountReport(root: HTMLElement): Promise<void> {
  const t = powerUp().iframe();
  const boardId = safeBoard(t);

  const render = async (): Promise<void> => {
    const results = (await t.get('board', 'private', SPIKE_KEY, null)) as SpikeResults | null;
    const stamp = (await t.get('member', 'private', STAMP_KEY, null)) as Stamp | null;
    const mode = ((await t.get('board', 'private', SPIKE_MODE_KEY, 'probe')) as SpikeMode) ?? 'probe';

    root.replaceChildren(
      text('p', `Board ${boardId || 'unknown'} - mode "${mode}" - read at ${new Date().toLocaleTimeString()}`, 'meta'),
      panelE1(results),
      panelE7(results),
      panelE2(results),
      panelE3(mode),
      panelE4(),
      panelE5(boardId, stamp),
      panelE6(results),
      rawDump(results),
    );
  };

  // One delegated handler for the whole document, so the sticky toolbar and the
  // in-panel buttons go through the same path.
  document.addEventListener('click', async (ev) => {
    const el = (ev.target as HTMLElement | null)?.closest('[data-action]') as HTMLElement | null;
    const action = el?.dataset['action'];
    if (!action) return;
    ev.preventDefault();

    if (action === 'stamp') {
      const stamp: Stamp = { writtenOnBoard: boardId, at: Date.now() };
      await t.set('member', 'private', { [STAMP_KEY]: stamp });
    } else if (action === 'touch-setting') {
      await t.set('member', 'private', { spikeTouched: Date.now() });
    } else if (action === 'reset') {
      await t.remove('board', 'private', SPIKE_KEY);
    } else if (action.startsWith('mode:')) {
      await t.set('board', 'private', { [SPIKE_MODE_KEY]: action.slice(5) });
    }
    await render();
  });

  await render();
}

// --- panels ------------------------------------------------------------------

function panelE1(r: SpikeResults | null): HTMLElement {
  const cold = Object.values(r?.cold ?? {});
  const withItems = cold.filter((c) => c.e1ChecklistsHadItems === true).length;
  const fields = new Set(cold.flatMap((c) => c.e1FieldsSeen));
  const warmWorking = (r?.warm ?? []).filter((w) => w.e1ChecklistsHadItems).length;

  return panel(
    "E1 - does t.card('checklists') return checkItems on COLD load?",
    cold.length === 0 ? null : withItems === cold.length,
    [
      `${withItems} of ${cold.length} cards returned checkItems on their FIRST observation.`,
      `Fields seen on checklist objects: ${fields.size ? [...fields].sort().join(', ') : '(none)'}`,
      warmWorking > 0 && withItems < cold.length
        ? `SELF-HEAL DETECTED: ${warmWorking} later observations worked where the cold one did not. This is the false-green trap - only the cold column counts.`
        : false,
      cold.length < 20
        ? 'Fewer than 20 cards observed. Scroll the board so more cards render, then Re-read.'
        : false,
      'Decides Path A vs Path B. Run on a board you have not touched this session, and do not open a card first.',
    ],
  );
}

function panelE7(r: SpikeResults | null): HTMLElement {
  const cold = Object.values(r?.cold ?? {});
  const ok = cold.filter((c) => c.e7BadgeCountsPresent === true).length;
  return panel(
    "E7 - does t.card('badges') carry the card-level counts?",
    cold.length === 0 ? null : ok === cold.length,
    [
      `${ok} of ${cold.length} cards exposed badges.checkItems / badges.checkItemsChecked on cold load.`,
      'Decides whether Path C is a usable degraded state (a progress pill with no auth at all) or a dead end.',
      'Expected to pass where E1 fails: the native checkbox badge IS board-level rendering, so its counts must already be in the board-level cache.',
    ],
  );
}

function panelE2(r: SpikeResults | null): HTMLElement {
  const sample = Object.values(r?.cold ?? {}).find((c) => c.order && c.order.length > 0);
  return panel('E2 - A1 ordering, A2 checklist-gates-items, A3 limit scope', null, [
    'Build the board like this, then read the order off the cards.',
    'A1a - a card whose INCOMPLETE checklist is positioned BEFORE a complete one. Position order keeps it first; complete-first grouping moves it second.',
    'A1b - a checklist whose FIRST item is unchecked and SECOND is checked. Same question, one level down.',
    'A2 - hide finished checklists while "show finished items" is ON. Do the hidden checklist items still render?',
    'A3 - a multi-checklist card with the item limit set to 1. One item on the card, or one per checklist?',
    'Switch to "ordering" mode to print the raw source order onto the card fronts.',
    sample && sample.order
      ? `Sample source order captured: ${sample.order.join(' | ')}`
      : 'No order captured yet - E1 must pass first.',
  ]);
}

function panelE3(mode: SpikeMode): HTMLElement {
  return panel('E3 - badge count and text length limits', null, [
    'Switch to "stress" mode, refresh the board, and look: 40 badges per card at 20/50/100/200 characters.',
    'Record how many render, where text truncates, whether it ellipsizes or clips, and whether the card list breaks or scrolls.',
    'Check board view AND list view, light AND dark theme. Feed the answer into DEFAULT_CAPS in src/constants.ts.',
    `Current mode: ${mode}.`,
  ]);
}

function panelE4(): HTMLElement {
  return panel('E4 - collision with native card-front checklists', null, [
    'Manual and visual. Enable the spike, then click a checklist progress bar on a card to expand it natively.',
    'Look for duplicated item lists, doubled card height, and the direct contradiction where native hides finished items and we show them.',
    'There is no API to detect native expansion, so the product renders blind. This decides whether item badges are shippable at all.',
  ]);
}

function panelE5(boardId: string, stamp: Stamp | null): HTMLElement {
  const elsewhere = stamp !== null && stamp.writtenOnBoard !== boardId;
  return panel(
    'E5 - do member/private settings persist across boards? (A6)',
    stamp === null ? null : elsewhere ? true : null,
    [
      stamp
        ? `A stamp is readable here. It was written on board ${stamp.writtenOnBoard} at ${new Date(stamp.at).toLocaleString()}.`
        : 'No stamp written yet.',
      elsewhere
        ? 'Written on a DIFFERENT board and readable here: member scope is global. A6 holds and the key strategy stays "member-global".'
        : stamp
          ? 'Written on THIS board. Now open this report on a different board. If the stamp is missing there, member scope is board-local and settings must be keyed by board id.'
          : false,
      { button: 'Write a stamp on this board', action: 'stamp' },
    ],
  );
}

function panelE6(r: SpikeResults | null): HTMLElement {
  return panel('E6 - does a settings write re-run card-badges?', null, [
    `card-badges has run ${r?.badgeRuns ?? 0} times; last at ${r?.lastBadgeRunAt ? new Date(r.lastBadgeRunAt).toLocaleTimeString() : 'never'}.`,
    'Press the button, wait a few seconds, then Re-read. If the run count has not moved, a settings change cannot reach the board - which is what SPEC.md 2.3 assumes, and why saving shows "refresh the board".',
    { button: 'Write a setting now', action: 'touch-setting' },
  ]);
}

function rawDump(r: SpikeResults | null): HTMLElement {
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Raw results (paste this into the M0b notes)';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(r, null, 2);
  details.append(summary, pre);
  return details;
}

// --- tiny DOM helpers --------------------------------------------------------

function text(tag: string, content: string, cls = ''): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = content;
  if (cls) el.className = cls;
  return el;
}

function panel(title: string, pass: boolean | null, lines: Line[]): HTMLElement {
  const verdict = pass === null ? 'manual' : pass ? 'pass' : 'FAIL';
  const section = document.createElement('section');
  section.className = `panel ${verdict === 'FAIL' ? 'fail' : verdict}`;
  section.append(text('h2', `${title}  [${verdict}]`));

  for (const line of lines) {
    if (!line) continue;
    if (typeof line === 'string') {
      section.append(text('p', line));
    } else {
      const b = document.createElement('button');
      b.textContent = line.button;
      b.dataset['action'] = line.action;
      section.append(b);
    }
  }
  return section;
}

function safeBoard(t: TrelloT): string {
  try {
    return t.getContext().board ?? '';
  } catch {
    return '';
  }
}
