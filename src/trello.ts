/**
 * A narrow, hand-written view of the Trello client library.
 *
 * There are no official types. Everything here is the smallest surface we
 * actually call, and every shape is an ASSUMPTION - the client library's
 * checklist object in particular is entirely undocumented and has been observed
 * to differ from the REST shape (SPEC.md 2.4). Nothing outside data.ts may
 * depend on these types.
 */

export interface TrelloT {
  card(...fields: string[]): Promise<Record<string, unknown>>;
  get(scope: string, visibility: string, key: string, fallback?: unknown): Promise<unknown>;
  set(scope: string, visibility: string, entries: Record<string, unknown>): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  remove(scope: string, visibility: string, key: string): Promise<void>;
  getContext(): { board: string; card?: string; member: string; permissions?: unknown };
  alert(opts: { message: string; duration?: number; display?: string }): Promise<void>;
  popup(opts: Record<string, unknown>): Promise<void>;
  modal(opts: Record<string, unknown>): Promise<void>;
  closePopup(): Promise<void>;
  sizeTo(target: string | number | HTMLElement): Promise<void>;
  /** iframe capabilities only; re-runs the callback when Trello wants a redraw. */
  render(fn: () => void): void;
  /**
   * Localization. Documented as SYNCHRONOUS - `localizeKey` returns the string,
   * not a Promise, which is what lets `computeBadges` stay pure and sync.
   *
   * Optional in OUR typing, deliberately: the client library is unversioned and
   * unpinnable (SPEC.md 2.9), so every call site must survive these being absent.
   * See i18n.ts, where every call is guarded.
   */
  localizeKey?(key: string, data?: Record<string, unknown>): string;
  localizeKeys?(keys: (string | [string, Record<string, unknown>])[]): string[];
  /** Replaces the text of descendants carrying `data-i18n-id`. */
  localizeNode?(node: Node): void;
  storeSecret(key: string, value: string): Promise<void>;
  loadSecret(key: string): Promise<string | undefined>;
  clearSecret(key: string): Promise<void>;
  getRestApi(): TrelloRestApi;
  signUrl?(url: string): string;
}

export interface TrelloRestApi {
  isAuthorized(): Promise<boolean>;
  authorize(opts: { scope?: string; expiration?: string }): Promise<void>;
  getToken(): Promise<string>;
  clearToken(): Promise<void>;
}

export interface TrelloPowerUpUtil extends Record<string, unknown> {
  /** Loads the resource bundle for `locale`. Must resolve before the first localizeKey. */
  initLocalizer?(locale: string, options: { localization: unknown }): Promise<unknown>;
}

export interface TrelloPowerUpGlobal {
  initialize(capabilities: Record<string, unknown>, options?: Record<string, unknown>): TrelloT;
  iframe(options?: Record<string, unknown>): TrelloT;
  util: TrelloPowerUpUtil;
}

declare global {
  // Provided by https://p.trellocdn.com/power-up.min.js, loaded by a <script> tag.
  // Unversioned and always-current: there is no way to pin it (SPEC.md 2.9).
  // `var`, not `const`, so that `globalThis.TrelloPowerUp` typechecks - the script
  // tag may not have run yet, hence the `undefined`.
  // eslint-disable-next-line no-var
  var TrelloPowerUp: TrelloPowerUpGlobal | undefined;
  /** Set by the client library; the locale Trello is rendering the board in. */
  var locale: string | undefined;
}

export function powerUp(): TrelloPowerUpGlobal {
  const g = (globalThis as { TrelloPowerUp?: TrelloPowerUpGlobal }).TrelloPowerUp;
  if (!g) throw new Error('power-up.min.js did not load');
  return g;
}
