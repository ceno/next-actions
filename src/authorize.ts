/**
 * The Path B authorization popup.
 *
 * Path B only. If E1 shows the client library serves checklist items inside
 * card-badges after all, this file and the two authorization capabilities are
 * deleted (SPEC.md 6.2).
 *
 * The HTML carries English copy so the popup is readable before this module
 * runs; everything here overwrites it with the localized string.
 */

import { initIframeLocalizer, LOCALIZATION, type Localize } from './i18n';
import { powerUp, type TrelloT } from './trello';

export interface AuthorizeNodes {
  status: HTMLElement;
  connect: HTMLButtonElement;
}

/**
 * Split from `mountAuthorize` so it can be tested without a Trello iframe: it
 * takes the two collaborators it needs and nothing else.
 */
export function wireAuthorize(nodes: AuthorizeNodes, t: TrelloT, L: Localize): void {
  nodes.status.textContent = L('authorizeIntro');
  nodes.connect.textContent = L('authorizeConnect');

  nodes.connect.addEventListener('click', async () => {
    // Disabled for the duration: `authorize` opens a window, and a second click
    // opens a second one that can never resolve.
    nodes.connect.disabled = true;
    try {
      await t.getRestApi().authorize({ scope: 'read', expiration: 'never' });
      nodes.status.textContent = L('authorizeConnected');
      nodes.connect.hidden = true;
    } catch (e) {
      // The popup is the only surface the user has; a swallowed error here looks
      // exactly like a button that does nothing.
      nodes.status.textContent = L('authorizeFailed', { error: message(e) });
      nodes.connect.disabled = false;
    }
    await sizeTo(t);
  });

  t.render(() => void sizeTo(t));
  void sizeTo(t);
}

export async function mountAuthorize(nodes: AuthorizeNodes): Promise<void> {
  const t = powerUp().iframe({ localization: LOCALIZATION });
  const L = await initIframeLocalizer(t);
  wireAuthorize(nodes, t, L);
}

/** `catch` binds `unknown`; never interpolate that directly into user-facing copy. */
function message(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function sizeTo(t: TrelloT): Promise<void> {
  try {
    await t.sizeTo('body');
  } catch {
    /* not in a popup (e.g. opened standalone for development) */
  }
}
