# Next Actions — specification

**Status: frozen 2026-09-14.** Derived from `PLAN.md §1`, which is derived from public artefacts only
(`PLAN.md §0.1`). The specification does not get reopened by looking at the vendor's product again;
it gets reopened by an experiment result (§7) or by a decision recorded here.

Every assertion below carries a tag:

| Tag | Meaning |
|---|---|
| **[O]** Observed | Visible in a public artefact. Still a fact about *the vendor's* product, not about ours. |
| **[I]** Inferred | Derived by reasoning from an observation, a document, or a platform constraint. Could be wrong. |
| **[D]** Decided | Our choice. No evidence involved. Binding unless changed here. |
| **[U]** Unresolved | Named option with a provisional default, awaiting an experiment. See §7. |

A tag on a section header applies to the whole section unless a line overrides it.

---

## 1. Product

**[D]** Next Actions renders per-card checklist state as inert card-front badges: always visible, no
clicks, no interaction. The value is the *always-on* property, which Trello provides no native way to
achieve (`docs/reviews/platform.md` finding 14b).

**[D]** In scope, per card:

1. A per-checklist progress pill, colour-coded complete/incomplete, formatted `2/3` or `67%`.
2. The first *N* incomplete items — the next actions.
3. Optionally completed items, which native Trello refuses to show at all.
4. Per-user configuration of all of the above.

**[D]** Out of scope: interactivity of any kind (impossible — §2.1); a checklist *viewer* (native does
that better and interactively since 28 Apr 2026); Mirror cards; mobile apps; paid tiers; a Marketplace
listing.

**[D]** Acceptance is functional equivalence on the configurations we support, never visual identity
with anyone's product.

---

## 2. Platform constraints — the ones that shape the design

### 2.1 Badges are inert **[O, documented]**
`card-badges` returns an array of objects carrying text, icon, colour and tooltip. No click handler
exists in the capability contract. Nothing we build can respond to a click.

### 2.2 Legal badge colours **[O, documented]**
`blue green orange red yellow purple pink sky lime light-gray`, or the field omitted for an uncoloured
badge. **[D]** We store and compare colour *names*. No hex value appears anywhere in `src/`.

### 2.3 Badges do not re-run on a settings change **[O, forum-confirmed; uncontested]**
There is no supported way to force `card-badges` to re-run. `dynamic` badges cannot help: a dynamic
function returns *one* badge object, so it can change a badge's content but never how many badges
exist. **[D] Decision, permanent:** saving settings shows `t.alert` telling the user to refresh the
board. We do not engineer around this.

### 2.4 The client-library checklist shape is undocumented **[O]**
Atlassian documents `checklists` as an allowed `t.card()` field and documents **no sub-field structure
at all**. The only empirical shape on record (Feb 2025) had five fields and no `checkItems`.
**[D]** Therefore `computeBadges` is written against our own domain types (§4) and every data source
goes through an adapter (§6). No Trello shape is asserted as fact anywhere in the core.

### 2.5 Everything about badge rendering is undocumented **[O]**
Maximum badge count: unspecified. Text length limit: unspecified. Truncation, ellipsis, wrapping:
unspecified. **[D]** We therefore cap defensively in our own code (§5.6) regardless of what the
settings permit, and treat all rendering behaviour as measured-not-documented.

### 2.6 `on-enable` is not load-bearing **[O, documented]**
It does not fire for Power-Ups enabled from the public directory or via the API. **[D]** Defaults must
produce something useful with zero configuration.

### 2.7 Storage **[O, documented]**
Scopes `board | card | member | organization`; visibilities `shared | private`. `private` means only
the setting member can read it, at any scope. 4096 characters per scope/visibility pair. Writes are
**not atomic** and collide silently, last-write-wins, with no error. **[D]** All settings are written
as a single object in one `t.set` call. Never more than one key.

### 2.8 `pluginData` is read-only over REST **[O, documented]**
Settings can only be written from the client library. No server-side settings, ever.

### 2.9 Unversioned dependency **[O]**
`p.trellocdn.com/power-up.min.js` is unversioned and always current (1.25.1, 8 Jul 2025). Atlassian
announced on 18 Nov 2025 that Power-Up UI rendering is being rewritten. **[D]** No external badge
icons — unicode glyphs only, which also dodges the April 2023 icon-CORS failure class.

### 2.10 `t` scope **[O, documented]**
Never retain a `t` reference beyond the callback that produced it. Never call `t.popup()` inside a
`.then()` chain; use `async`/`await`.

---

## 3. Behaviour

### 3.1 Badge anatomy

**[I]** Two badge kinds. Both are plain `card-badges` entries.

| Kind | Text | Colour |
|---|---|---|
| **Header** — one per visible checklist | `<progress> <checklist name>` e.g. `2/2 Place to stay`, `33% Transport` | Complete → the "finished" colour; otherwise the "unfinished" colour. Configurable by name. |
| **Item** — one per visible check item | `☑ <item name>` or `☐ <item name>` | **None.** Uncoloured. |

Supporting observations:

- **[O]** Header text is `<progress> <title>` — `2/2 Place to stay`, `33% Transport`.
- **[O]** Headers are colour-coded green when complete, orange when not, and both are configurable.
- **[O]** Item badges are uncoloured plain text. Completed items get **no** strikethrough and **no**
  dimming — styling identical to incomplete items. The glyph is the only difference.
- **[O]** The glyphs are unicode text characters U+2610 `☐` and U+2611 `☑`, rendered in the label's own
  family, weight and colour — not bitmap icons.
- **[O]** Item text renders raw. `Agree date /time` keeps its odd pre-slash space. No trimming, no
  whitespace normalisation, no capitalisation.
  **[D]** We match this: item and checklist names pass through untouched, except for the defensive
  length cap in §5.6.
- **[O]** A checklist named `Checklist` (Trello's default name) is not special-cased; the name prints
  verbatim.
- **[O]** On a single-checklist card the header badge duplicates Trello's own `☑ 0/3` badge almost
  verbatim. The vendor does not suppress this.
  **[U-S1]** We make suppression an option, `suppressRedundantSingleHeader`, default `false` (match the
  observation). Cheap to flip once someone looks at a real board.

### 3.2 What we do not control

- **[O]** Trello's native `☑ n/m` badge sums all checklists on the card and turns green at 100%. It is
  untouched by us and will sit beside our badges.
- **[O]** Power-Up badges are appended after **all** native badges, including the due-date badge.
- **[O]** Badges flow and wrap inline; a header badge does not force a line break.
  **[I]** This is flex-wrap behaviour. It is undocumented and inside the blast radius of the Nov 2025
  rendering rewrite (§2.9). Nothing in our logic may depend on where a wrap falls.

### 3.3 Progress format **[O for the formats, U-A4 for rounding]**

- Fraction: `completed/total` → `2/2`, `1/3`.
- Percent: `round(completed/total × 100)%` → `2/2 → 100%`, `1/3 → 33%`.
- `0/N` renders in the unfinished colour.

### 3.4 Emission order **[U-A1]**

For each visible checklist, in checklist order: its header badge (if enabled), then its visible items
in item order. Checklist order and item order are governed by option `ordering` (§7, A1).

### 3.5 Filtering **[U-A2, U-A3]**

Applied in this order:

1. **Checklist filter.** A checklist whose items are all complete is a *complete checklist*; if
   `hideCompletedChecklists` is on, it is not visible. `checklistLimit` then truncates the visible
   checklists to the first N in order.
2. **Item filter.** A complete item is visible only if `showCompletedItems` is on. An incomplete item
   is visible only if `showIncompleteItems` is on.
3. **Item limit.** `incompleteItemLimit` truncates *incomplete* items to the first N in order. Scope
   (per checklist or per card) is option `itemLimitScope` (§7, A3).
4. **Checklist gating.** Whether a hidden checklist also hides its items is option
   `checklistGatesItems` (§7, A2).

**[O]** Limits exist only for incomplete things. Completed checklists and completed items are an
all-or-nothing toggle with no count. **[D]** We keep that asymmetry; it is coherent, not accidental.

**[O]** The item limit truncates to the first N by order — demonstrated for items, never demonstrated
for the checklist limit, which is **[I]** assumed to behave the same way.

### 3.6 Edge cases **[D]**

| Case | Behaviour |
|---|---|
| Card with no checklists | Return `[]`. Never a badge with empty text — that renders as an empty pill. |
| Checklist with 0 items | Counts as complete per **[U-A5]**; progress renders `0/0` or `100%`. |
| Checklist with an empty name | Header text becomes just the progress, trailing space trimmed. Never emit a badge whose text is empty or whitespace-only. |
| Item with an empty name | Emit the glyph alone — `☐`. It is a real item and hiding it would lie about the count. |
| Very long name (>`maxTextLength`) | Truncate to `maxTextLength − 1` and append `…` (U+2026). **[D]** Our invention; the vendor does not appear to truncate. Defensive against §2.5. |
| Emoji / RTL / combining marks | Pass through. Length cap counts by code point, not UTF-16 unit, so a surrogate pair is never split. |
| Total badges exceed `maxBadges` | Hard-truncate the array. **[D]** The cap wins over every setting, including "all". |
| Per-item due dates / members (paid plans) | **[D]** Ignored. Not rendered, not considered in ordering. |
| Data unavailable | `computeBadges` is not involved — it is a pure function of what it is given. The adapter decides; see §6.4. |

### 3.7 Accessibility **[D]**

**No state may be conveyed by colour or glyph alone.** Every badge's text must read correctly with the
colour removed *and* with the glyph removed. This is why the header carries the progress string and not
just a colour, and it is a constraint on any future badge type. Screen readers announce `☑`/`☐`
inconsistently; the tooltip (`title`) carries a spelled-out equivalent.

### 3.8 Coexistence with native card-front checklists **[I]**

Since 28 Apr 2026 Trello expands checklist items inline on the card front, hides completed items while
expanded, and allows ticking from the board. There is no API to detect whether a checklist is currently
expanded, so we render blind.

**[D]** Consequences, binding on the defaults in §5.5:

- Default configuration emits **headers only**. Item badges are opt-in. This keeps the zero-config
  state from duplicating native output.
- Showing completed items is the one place we *directly* contradict native (it hides them, we show
  them). That is a deliberate differentiator, and it stays opt-in.

---

## 4. Domain types

**[D]** These are ours. They are not Trello's shapes and must not be replaced by them (§2.4).

```ts
type BadgeColor =
  | 'blue' | 'green' | 'orange' | 'red' | 'yellow'
  | 'purple' | 'pink' | 'sky' | 'lime' | 'light-gray';

interface CheckItem {
  id: string;
  name: string;
  complete: boolean;
  pos: number;      // sort key; meaning is Trello's, ordering is ours
}

interface Checklist {
  id: string;
  name: string;
  pos: number;
  items: CheckItem[];
}

interface Badge {
  text: string;
  color?: BadgeColor;   // omitted => uncoloured badge
  title?: string;       // hover tooltip; also the a11y long form
}
```

`pos` is a number in Trello and is only ever compared, never interpreted. Ties break by `id` so
ordering is total and deterministic — **[D]**, because Trello does not promise unique `pos` values and
a non-deterministic badge order would be an invisible, unreproducible bug.

**[D]** `complete: boolean` rather than Trello's `state: 'complete' | 'incomplete'` string. The
translation happens in the adapter, once.

---

## 5. Settings

### 5.1 User-facing settings

```ts
interface Settings {
  v: 1;

  // Header badges
  showHeaders: boolean;
  progressFormat: 'fraction' | 'percent';
  finishedColor: BadgeColor | 'none';
  unfinishedColor: BadgeColor | 'none';
  hideCompletedChecklists: boolean;
  checklistLimit: Limit;          // applies to visible checklists

  // Item badges
  showIncompleteItems: boolean;
  incompleteItemLimit: Limit;
  showCompletedItems: boolean;
}

type Limit = number | 'all';      // integer 0..10, or 'all'
```

**[U-A7]** The limit range `all, 1..10` is invention — only `all` and `1` were ever observed. `0` is
accepted by the type and by `computeBadges` (it means "none") but is not offered in the UI, because a
`0` is what the boolean toggles are for.

### 5.2 Reworded UI labels **[D]**

Rule from `PLAN.md §0.3`: no verbatim label strings. These are the labels; they are the specification,
not a suggestion.

| Control | Label |
|---|---|
| Section 1 heading | **What appears on cards** |
| `showHeaders` | Show checklist name and progress |
| `progressFormat` | Progress as — *Fraction (2/3)* / *Percentage (67%)* |
| `finishedColor` | Colour when finished |
| `unfinishedColor` | Colour when unfinished |
| `hideCompletedChecklists` | Hide finished checklists |
| `checklistLimit` | Most checklists to show |
| Section 2 heading | **Which items to show** |
| `showIncompleteItems` | Show unfinished items |
| `incompleteItemLimit` | Most unfinished items to show |
| `showCompletedItems` | Show finished items too |
| Save button | Save |
| Reset control | Clear my settings |
| Toast on save | Saved. Refresh the board to see the change. |
| Unauthorised state badge | Connect your account |

**[D]** "finished/unfinished" is used in user-facing copy; "complete/incomplete" in code and in this
document. They mean the same thing. The split is deliberate — it keeps our copy from converging on the
vendor's wording by accident.

### 5.3 Storage model

**[D]** One key, one object, one write:

- Scope: `member`. Visibility: `private`.
- Key: `nextActions` (**[U-A6]** — see §7; if member scope proves board-local, the key strategy changes
  to `nextActions:<boardId>`, which is why it is `settingsScope` in the code and not a literal).
- The stringified object must stay under **4096** characters at maximum configuration. There is a test
  asserting this.
- `v` is present on every write. `migrate(unknown) → Settings` handles missing/older `v`, unknown
  fields (dropped), and invalid values (replaced with the default for that field, never rejecting the
  whole object).
- **[D]** A corrupt or unreadable blob yields `DEFAULT_SETTINGS`, silently. A user whose settings fail
  to parse gets a working board, not an error badge.

### 5.4 `remove-data` **[O, documented]**

Fires when the user removes personal data, with roughly 500 ms to act. Call `t.getAll()` first if the
data is needed, then clear our key. On Path B this is also where a stored REST token is dropped.

### 5.5 Defaults **[D]**

```ts
DEFAULT_SETTINGS = {
  v: 1,
  showHeaders: true,
  progressFormat: 'fraction',
  finishedColor: 'green',
  unfinishedColor: 'orange',
  hideCompletedChecklists: false,
  checklistLimit: 'all',
  showIncompleteItems: false,   // opt-in: see §3.8
  incompleteItemLimit: 3,
  showCompletedItems: false,
}
```

Rationale for `showIncompleteItems: false`: §3.8. The zero-config state is coloured progress pills,
which is exactly the thing native Trello does not do and which cannot duplicate native output. Turning
on item badges is a deliberate act.

`incompleteItemLimit: 3` is inert while `showIncompleteItems` is false; it is the value the user gets
when they switch items on, and 3 is chosen so the first flip does not explode a card. **[D]**

### 5.6 Caps **[D]**

| Cap | Value | Why |
|---|---|---|
| `maxBadges` | 20 | Nothing about badge count is documented (§2.5). 20 is a guess pending E3; it is a named constant, changed in one place. |
| `maxTextLength` | 64 code points | Ditto for text length. Truncation appends `…`. |

The caps are applied **after** all filtering and ordering, as a final slice. They are not a setting and
cannot be raised from the UI.

---

## 6. Data

### 6.1 One interface, three paths **[D]**

```ts
interface ChecklistSource {
  readonly id: 'client' | 'rest' | 'aggregate';
  forCard(t: TrelloT, cardId: string): Promise<Checklist[] | Unavailable>;
}
```

Which path is live is a build-time flag (`DATA_PATH`), not a runtime negotiation. No fallback chain
until an experiment says one is needed — a silent fallback would hide exactly the failure E1 exists to
detect.

### 6.2 Path A — client library **[I: expected to fail]**

`t.card('checklists')` inside the `card-badges` handler. No auth, no key, no rate limit.

Expected dead. Atlassian staff explained in 2020 that the web client caches only what *board-level*
rendering needs, and checklist detail loads only when a card back opens. Developers reproduced the
exact failure in Oct 2023 and again in Feb 2025, both threads unresolved.

**The trap:** the failure self-heals once any check item is toggled, after which it starts working
forever on that session. A spike that toggles an item first returns a false green. **E1 must test cold
load** — fresh board, no card opened, nothing toggled.

### 6.3 Path B — REST **[D: the assumed baseline]**

`t.getRestApi().authorize({ scope: 'read' })`, token via `t.storeSecret`, then **one** request per
board:

```
GET /1/boards/{boardId}/checklists?checkItems=all&fields=name,pos,idCard
```

That returns every checklist and item on the board, keyed by card — so 500 cards cost one request, not
500. Memoised per board, ~10 s TTL, with a **single in-flight promise** so the concurrent badge calls
that Trello fires while drawing a board share one request. Rate limits (100/10 s/token, 300/10 s/key)
are then irrelevant.

Costs: an API key, `authorize.html`, the `authorization-status` and `show-authorization` capabilities,
secret storage, an unauthorised badge state, and a worse first run.

### 6.4 Path C — aggregate only **[I: new, from prior-art; unverified]**

`t.card('badges')` → `badges.checkItems` and `badges.checkItemsChecked`: the card-level totals that
drive Trello's own `☑ n/m` badge. A Power-Up in the wild uses exactly this inside `card-badges` and
asserts it is always available for every card. The structural argument agrees: the native badge *is*
board-level rendering, so its two counts must be in the board-level cache — the same reasoning that
kills Path A predicts this works. See `docs/prior-art.md §3`.

It yields **one synthetic checklist** with no name and no items, so only a card-level progress pill is
possible. It cannot produce item badges, per-checklist pills, or checklist names, and it therefore
implements none of §1's points 2 and 3.

**[D]** Its role is the *degraded state*: Path B's first run, an unauthorised user, a revoked token, a
REST failure. Off by default. Nothing may depend on it before **E7**.

### 6.5 Unavailability **[D]**

`Unavailable` is a distinct return, never an empty array. `[]` means "this card genuinely has no
checklists" and must render nothing; `Unavailable` means "we do not know" and renders either nothing or
the single `Connect your account` badge, per path. Conflating the two is how a broken data source comes
to look like an empty board.

---

## 7. Unresolved — A1–A7, and the experiments that close them

**None of these may be resolved by reasoning.** Each is an explicit named option in `BadgePolicy` with
a provisional default. The default is *PLAN's stated assumption* wherever PLAN states one — we do not
invent a second guess on top of the first.

| # | Question | Option | Provisional default | Experiment |
|---|---|---|---|---|
| **A1** | Is order checklist-position-then-item-position, or complete-things-first? Every artefact fits both — there is not one instance of an incomplete thing preceding a complete one. | `ordering: 'position' \| 'complete-first'` | `'position'` | **E2a.** Board with an incomplete checklist positioned before a complete one; a checklist whose first item is unchecked and second is checked. Read the rendered order. |
| **A2** | Does hiding a checklist also hide its items? The one screenshot that suggests it flips *two* toggles at once, and the item filter alone explains everything hidden. | `checklistGatesItems: boolean` | `true` | **E2b.** Hide finished checklists while "show finished items" is **on**. Do that checklist's completed items still render? |
| **A3** | Is the item limit per checklist or per card? The demonstrating screenshot has exactly one visible checklist, so the two are indistinguishable. | `itemLimitScope: 'per-checklist' \| 'per-card'` | `'per-checklist'` | **E2c.** Multi-checklist card, item limit 1. Count the item badges: one, or one per checklist? |
| **A4** | Does `%` round or floor? `1/3 → 33%` fits both. | `percentRounding: 'round' \| 'floor'` | `'round'` | **Undecidable from artefacts.** Only a live comparison against a `2/3` case (67% vs 66%) settles it, and it does not matter enough to block. |
| **A5** | Is a 0-item checklist complete? No artefact covers `0/0`. | `emptyChecklistIsComplete: boolean` | `true` | **Undecidable.** Chosen: an empty checklist is not an outstanding obligation, so it should not glow orange forever. |
| **A6** | Do member-scoped settings persist across boards? Inferred from marketing copy; the docs are silent; the vendor's own "remove personal settings" control hints the opposite. | `settingsScope: 'member-global' \| 'member-per-board'` | `'member-global'` | **E5.** `t.set('member','private',…)` on board A, read it on board B. |
| **A7** | What does the limit dropdown offer? Only `all` and `1` were ever observed. | `LIMIT_CHOICES` | `['all', 1..10]` | **Invention.** Nothing to resolve; recorded so it is not mistaken for an observation. |

A1 and A2 are the two that matter. They *are* the filtering model, they are invisible to any test built
from the same artefacts that produced this spec, and either one backwards is wrong on every real board.

### Experiments beyond A1–A7

| # | Question | Decides |
|---|---|---|
| **E1** | Does `t.card('checklists')` return `checkItems` on **cold load** — 500 cards × 3–4 checklists × 10–15 items, no card opened, nothing toggled? | Path A vs Path B. ±4 days. |
| **E3** | 40 synthetic badges on one card; text at 20/50/100/200 chars; board view and list view; both themes. | `maxBadges`, `maxTextLength`, and whether `'all'` ships at all. |
| **E4** | Enable the Power-Up, then expand a checklist natively on the same card. | Whether the product is viable beside native. §3.8's defaults assume it is survivable. |
| **E6** | Save a setting; confirm badges do **not** re-run. | Confirms §2.3. Expected: they don't. |
| **E7** | Does `t.card('badges')` return populated `checkItems` / `checkItemsChecked` on cold load, on every card? | Whether Path C is a real degraded state or a dead end. |

**[D]** Also at M0b: dump a real payload to a committed fixture, so tests stop being built on invented
shapes. And request Power-Up UI early access from `trello-powerups-team@atlassian.com` before trusting
any E3 measurement — the rendering rewrite (§2.9) invalidates measurements taken against the old
renderer.

---

## 8. Testing

**[D]** There is no Power-Up test harness and no headless Trello. Three tiers, honestly ranked:

1. **Unit + property tests on `computeBadges`.** Fast, real, and covers the entire product logic. This
   is where the value is.
2. **A manual checklist** for the popup and the surface matrix — board view, list view, both themes,
   native-expanded and not, one Free board and one Premium board.
3. **One Playwright smoke test** against a real account, only if someone is willing to put credentials
   in CI. Otherwise skipped, and said so.

**[D]** Golden fixtures built from the source artefacts are a regression net, not validation. They
enshrine A1–A7 as assertions. Every one of them is tagged so that when an experiment flips an option,
it is obvious which fixtures are expected to change.

Property tests carry the weight golden tests cannot (`PLAN.md §4`): output length never exceeds the
caps; a badge is emitted for a checklist iff the filter admits it; item order is a subsequence of input
order; the progress string round-trips the counts; an empty checklist set yields an empty array.

---

## 9. Still open

1. **The parent popup.** Our settings popup stacks on the Power-Ups menu popup — that is where the back
   chevron comes from. Whether anything of ours belongs in a parent popup is undecided.
2. **Nothing else.** A4 and A5 are decided-by-fiat above and recorded as such; they are not open, they
   are arbitrary.
