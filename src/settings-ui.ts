/**
 * The settings popup.
 *
 * Mechanics that are easy to get wrong (SPEC.md 2.10, delivery review F18):
 *  - Trello fixes the popup WIDTH; only height is ours. Call `t.sizeTo` after
 *    every reflow, including a checkbox toggle that disables a row.
 *  - Never call `t.popup()` inside a `.then()` chain; the `t` context breaks.
 *  - Saving cannot refresh the badges. There is no supported way to make
 *    card-badges re-run, so we tell the user to refresh the board and mean it.
 */

import { LABELS, LIMIT_CHOICES } from './constants';
import {
  deriveFormState,
  isDirty,
  loadSettings,
  saveSettings,
  type FormState,
} from './settings';
import { powerUp, type TrelloT } from './trello';
import { BADGE_COLORS } from './types';
import type { BadgeColorSetting, Limit, Settings } from './types';

type Row = { el: HTMLElement; key: keyof FormState };

export async function mountSettings(form: HTMLFormElement): Promise<void> {
  const t = powerUp().iframe();
  const saved = await loadSettings(t);
  let current: Settings = { ...saved };
  const rows: Row[] = [];

  const section = (text: string) => {
    const h = document.createElement('h2');
    h.textContent = text;
    form.append(h);
  };

  const row = (key: keyof FormState, control: HTMLElement, labelText: string) => {
    const div = document.createElement('div');
    div.className = 'row';
    const label = document.createElement('label');
    label.textContent = labelText;
    // Explicit label/for pairing: the popup is entirely our iframe, so keyboard
    // and screen-reader behaviour here is ours to get right.
    const id = `f-${key}-${rows.length}`;
    control.id = id;
    label.htmlFor = id;
    div.append(label, control);
    form.append(div);
    rows.push({ el: div, key });
  };

  const checkbox = (key: keyof Settings & keyof FormState, labelText: string) => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = current[key] as boolean;
    input.addEventListener('change', () => {
      (current as unknown as Record<string, unknown>)[key] = input.checked;
      void refresh();
    });
    row(key, input, labelText);
  };

  const select = <T extends string | number>(
    key: keyof Settings & keyof FormState,
    labelText: string,
    options: readonly { value: T; label: string }[],
  ) => {
    const el = document.createElement('select');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = String(o.value);
      opt.textContent = o.label;
      el.append(opt);
    }
    el.value = String(current[key]);
    el.addEventListener('change', () => {
      const raw = el.value;
      (current as unknown as Record<string, unknown>)[key] =
        raw === 'all' ? 'all' : /^\d+$/.test(raw) ? Number(raw) : raw;
      void refresh();
    });
    row(key, el, labelText);
  };

  const colorOptions: { value: BadgeColorSetting; label: string }[] = [
    { value: 'none', label: LABELS.colorNone },
    ...BADGE_COLORS.map((c) => ({ value: c as BadgeColorSetting, label: c })),
  ];
  const limitOptions = LIMIT_CHOICES.map((l: Limit) => ({
    value: l as string | number,
    label: l === 'all' ? LABELS.limitAll : String(l),
  }));

  section(LABELS.sectionCards);
  checkbox('showHeaders', LABELS.showHeaders);
  select('progressFormat', LABELS.progressFormat, [
    { value: 'fraction', label: LABELS.progressFraction },
    { value: 'percent', label: LABELS.progressPercent },
  ]);
  select('finishedColor', LABELS.finishedColor, colorOptions);
  select('unfinishedColor', LABELS.unfinishedColor, colorOptions);
  checkbox('hideCompletedChecklists', LABELS.hideCompletedChecklists);
  select('checklistLimit', LABELS.checklistLimit, limitOptions);

  section(LABELS.sectionItems);
  checkbox('showIncompleteItems', LABELS.showIncompleteItems);
  select('incompleteItemLimit', LABELS.incompleteItemLimit, limitOptions);
  checkbox('showCompletedItems', LABELS.showCompletedItems);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const save = button(LABELS.save, 'mod-primary');
  const clear = button(LABELS.clear, '');
  actions.append(save, clear);
  form.append(actions);

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = LABELS.savedNeedsRefresh;
  note.hidden = true;
  form.append(note);

  save.addEventListener('click', async (e) => {
    e.preventDefault();
    await saveSettings(t, current);
    // This is the whole story on refresh, and it is permanent: card-badges
    // cannot be re-run from here, and dynamic badges cannot change badge COUNT.
    await t.alert({ message: LABELS.savedNeedsRefresh, duration: 6 });
    note.hidden = false;
    await t.closePopup();
  });

  clear.addEventListener('click', async (e) => {
    e.preventDefault();
    const { DEFAULT_SETTINGS } = await import('./constants');
    current = { ...DEFAULT_SETTINGS };
    render();
    await refresh();
  });

  function render(): void {
    const state = deriveFormState(current);
    for (const r of rows) r.el.classList.toggle('disabled', !state[r.key]);
    for (const r of rows) {
      const control = r.el.querySelector('input, select') as HTMLInputElement | null;
      if (control) control.disabled = !state[r.key];
    }
    save.textContent = isDirty(saved, current) ? `${LABELS.save} •` : LABELS.save;
  }

  async function refresh(): Promise<void> {
    render();
    await sizeTo(t);
  }

  render();
  t.render(() => void sizeTo(t));
  await sizeTo(t);
}

function button(text: string, className: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (className) b.className = className;
  return b;
}

/** Popup height must be corrected after every reflow or you get dead space or a scrollbar. */
async function sizeTo(t: TrelloT): Promise<void> {
  try {
    await t.sizeTo('body');
  } catch {
    /* not in a popup (e.g. opened standalone for development) */
  }
}
