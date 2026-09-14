# Next Actions — build plan

**Next Actions** is a Trello Power-Up that renders per-card checklist state as card-front badges,
always visible, with no clicking. Independently specified from public materials; not a copy of
anyone's code.

Status: **plan, not approved.** Nothing in `src/` yet.

---

## 0. Provenance

### 0.1 What the specification was derived from

Behaviour was reverse-specified from public artefacts only:

- The Trello marketplace listing for the ADF TECH product (plugin id `5fb7eaf8055b9566a547e0f9`) —
  feature bullets and the four named example configurations.
- Six public marketing images hosted on the vendor's S3 bucket (five stills + one two-state GIF).
- Vendor documentation pages: overview, getting-started, troubleshooting, pricing.
- Official Atlassian/Trello Power-Up and REST documentation, and the Atlassian developer forum.

No vendor JavaScript, bundle, network trace, or runtime DOM was inspected, and none will be.

### 0.2 Legal footing

**The author has never installed or used the original Power-Up** (confirmed 2026-09-14). The vendor's
EULA prohibits reverse engineering and derivative works, but that is a *contract*, binding on people
who accepted it by installing the software — not on someone who only ever read a public listing page.
Nobody on this project installs it. This also means §2's inference about the original's architecture
("its troubleshooting page mentions Authorize account") is the last inference of that kind available;
from here the spec is frozen and we build against the spec, not against the original.

### 0.3 What we deliberately do not copy

Function and behaviour are free to reimplement. These are not, and are excluded by rule:

| Excluded | Why |
|---|---|
| The name "Show Checklist" | Trademark. Ours is **Next Actions** (chosen 2026-09-14). |
| The vendor's icon and brand colours | Trade dress. |
| The six marketing images | Copyrighted. **Never commit them to this repo**, never reproduce them in a README. They may be *referenced* to establish facts; they are not project assets. |
| Verbatim UI label strings | Reword every one. "Hide completed checklists", not "Show all complete checklists". |
| Pixel-faithful reproduction of the settings panel | Trade dress, and pointless — see §1.5. |

Acceptance criterion is **functional equivalence on the configurations we choose to support**, never
visual identity.

### 0.4 Naming

The product is **Next Actions**. Conventions that follow, fixed now so M1 does not churn:

- Repo / package: `next-actions`. The working directory `trello-checklists` is a path, not the name.
- Power-Up display name in the admin portal: `Next Actions`, or `Next Actions for Trello` if the bare
  name collides. Never `Trello Next Actions` — Atlassian's naming rules put the product name last and
  bar "Atlassian", "plugin", "add-on" and "app" outright. Not binding on a private install, but free
  to comply with.
- Connector URL: `next-actions.<domain>/` serving `index.html`; dev registration at `…-dev`.
- The name is descriptive, so it is weak as a trademark. Fine here — a private install is not
  defending a mark — but it should not be treated as an asset later without advice.

---

## 1. The product, after the April 2026 platform change

### 1.1 Trello now does part of this natively

On **28 April 2026** Trello shipped card-front checklist previews on all plans: click a checklist's
progress bar on the card front and its items expand inline; tick items off *from the board*; click to
collapse. Completed items are always hidden while expanded and this is not configurable. Not available
on Mirror cards.

This is free, built in, and **interactive** — and a Power-Up badge can never be interactive, because
`card-badges` returns text, icon and colour only. Badges are inert.

So two of the original's four flagship configurations are now strictly worse reimplementations of a
built-in feature, and both *clash* with it: expand a checklist natively and you get native's list
(completed hidden) stacked on top of our badges for the same items (completed shown). We are not
building those.

### 1.2 What survives, and is what we build

Native has **no way to expand by default, no expand-all, no board or member preference, and no
persistence** — confirmed against the announcement, its replies, the support docs, `myPrefs` in the
REST API, and the absence of any relevant capability. Users asked; Atlassian did not commit. That
absence is the entire remaining moat, and it is a real one.

**Scope: an always-on next-action strip.** Per card, always visible, zero clicks:

1. A per-checklist progress pill — colour-coded complete/incomplete, formatted as `2/2` or `100%`.
2. The first *N* incomplete items, so the next action on every card is legible while scanning a board.
3. Optionally, completed items — which native refuses to show at all.
4. All of it configured once, per user.

Dropped from the original's surface: "show all checklists and items" and "show all incomplete items"
as headline modes, and the complete/incomplete colour pair reduces to what the pills actually need.

### 1.3 Observed behaviour (facts)

From the card `Summer Holiday` (2 checklists: `Place to stay` 2/2, `Transport` 1/3) and the demo
board's `Team lunch`, `Birthday`, `Project meeting`:

| # | Fact | Evidence |
|---|---|---|
| O1 | Header badge text is `<progress> <title>` — `2/2 Place to stay`, `33% Transport` | all stills |
| O2 | Header badge is colour-coded: green complete, orange incomplete; both configurable by **name** | all stills |
| O3 | Item badges are uncoloured plain text prefixed `☑` / `☐`. Completed items get **no** strikethrough and **no** dimming — identical styling to incomplete | all stills |
| O4 | Badges are inline and flow/wrap. A header badge does **not** force a line break — the first header always sits on line 1 beside the native badges, and every observed wrap is explained by width arithmetic | f001, measured |
| O5 | The native `☑ 3/5` badge is untouched, sums all checklists, and turns **green** at 100% | f001, f033 |
| O6 | Power-up badges are appended after **all** native badges, including the due-date badge | `Team lunch`: `🕐 19 Dec` → `☑ 0/3` → `0/3 Checklist` |
| O7 | `% complete`: `2/2 → 100%`, `1/3 → 33%`. `0/N` renders in the incomplete colour | ShowChecklistsProgress, f001 |
| O8 | A checklist named `Checklist` (Trello's default) is **not** special-cased — the title prints verbatim | `Team lunch`, `Birthday` |
| O9 | On a single-checklist card the header badge duplicates the native badge verbatim (`☑ 0/3` then `0/3 Checklist`). The original does not suppress this | `Team lunch` |
| O10 | Item text renders raw — `Agree date /time` keeps its odd pre-slash space. No trimming or normalisation | f001 |
| O11 | Limits exist only for *incomplete* things. Complete checklists/items are an all-or-nothing toggle with no count dropdown | settings panel, both sections |
| O12 | The item limit truncates incomplete items to the first N by order | ShowFirstIncompleteItem |
| O13 | Checkbox glyphs are unicode text characters (U+2610 / U+2611), not bitmap icons — same family, weight and colour as the label | measured at zoom |
| O14 | Badge pills measure `#61BD4F` / `#FF9F1A`, byte-identical to the native Trello badge in the same image, and all badges are exactly 37px tall | measured |

O14 is the most useful measurement in the set: it proves these are genuine `card-badges` with colour
*names*, not custom CSS. It also dates the screenshots — those are the pre-2021 palette.

### 1.4 Assumptions — not facts, and each has an experiment

The three reviews demoted several of my original "facts". These are guesses until M0 resolves them:

| # | Assumption | Why it is only an assumption | Experiment |
|---|---|---|---|
| A1 | Order is checklist position, then item position | Every single image is *equally* consistent with complete-first grouping — there is not one instance of an incomplete thing preceding a complete one. The settings panel's own ordering hints at grouping | Board with an incomplete checklist before a complete one; a checklist whose first item is unchecked and second checked |
| A2 | Hiding a checklist hides its items | `ShowAllIncompleteItems` flips **two** toggles at once; the item filter alone explains everything hidden there | Hide complete checklists while "show complete items" is **on** — do that checklist's done items still render? |
| A3 | The item limit is per checklist, not per card | The demonstrating screenshot has exactly one visible checklist, so the two are indistinguishable | Multi-checklist card, limit 1 |
| A4 | `%` uses `Math.round` | `1/3 → 33%` fits both round and floor | Undecidable from artefacts — pick round, document it |
| A5 | A 0-item checklist counts as complete | No artefact covers `0/0`. `0/N` is covered (orange) | Undecidable — pick, document |
| A6 | Per-user settings persist across boards | Inferred from marketing copy. Docs are silent. The vendor's "Remove personal settings" control hints the opposite | Set a member/private key on board A, read it on board B |
| A7 | The limit dropdown offers `all, 1..10` | Only `all` and `1` were ever observed | Invention — we choose the range |

A1 and A2 matter most: they *are* the filtering model, they are invisible to golden tests built from
the same screenshots, and getting either backwards is wrong on every real board.

### 1.5 The settings panel

Contrary to my first reading, the panel is **fully visible** — the scrollbar thumb fills 97–98% of its
track in all five stills. There is no hidden lower half. The back chevron means a *parent* popup exists
(popups stack, and ours opens from the Power-Ups menu); the vendor's "Authorize account" and licence
controls live there, not below the fold. We model a parent popup as an open question, not as fabricated UI.

The controls are raw unstyled `<input type=checkbox>` and `<select>` — browser chrome, not Trello
styling. `Front of the card` is a centred heading; `Checklist item options` is a left-aligned subheading.
All rows are flush left at the same indent; nothing is nested.

---

## 2. Architecture

Static site, no backend of our own. Files on a CDN, loaded by Trello in an iframe.

```
public/
  index.html      connector iframe — TrelloPowerUp.initialize({...})
  settings.html   settings popup
  authorize.html  Path B only
src/
  badges.ts       computeBadges(checklists, settings) — pure; the whole product
  data.ts         data adapter; the only file that knows where checklists come from
  settings.ts     load / save / migrate
  connector.ts    capability wiring
test/
SPEC.md           frozen at M1
```

TypeScript + Vite. Zero runtime dependencies beyond `p.trellocdn.com/power-up.min.js`.
Capabilities: `card-badges`, `show-settings`, `remove-data`, `on-enable`.

`on-enable` is **not** load-bearing — Atlassian documents that it does not fire when a Power-Up is
enabled from the public directory or the API. Defaults must render something useful with zero setup.

### 2.1 The data source — the project's biggest risk

**Path A — client library only.** `t.card('checklists')` inside the `card-badges` handler. No auth, no
key, no rate limits.

**This is probably dead, and the evidence is strong.** Atlassian staff explained in 2020 *why*: Trello's
web client caches only what board-level rendering needs, and checklist detail loads only when a card
back opens. Developers reproduced the exact failure in Oct 2023 (`checkItems` undefined on every card
until you toggle an item, after which it starts working) and again in Feb 2025 (`t.card('all')` returns
checklist objects containing only `id`, `idBoard`, `idCard`, `name`, `pos` — no `checkItems` at all).
Both threads are unresolved with no staff reply. The vendor's own "Authorize account" control is
corroboration that they hit the same wall.

There is also a trap: the failure *self-heals* once you toggle a checkitem. **The spike must test cold
load** — fresh board, no card opened, nothing toggled — or it returns a false green and we discover this
in M2 instead of M0.

**Path B — REST, assumed baseline.** `t.getRestApi().authorize({scope:'read'})`, token via `t.storeSecret`,
then **one** `GET /1/boards/{id}/checklists?checkItems=all&fields=name,pos,idCard` per board. That single
request returns every checklist and item on the board keyed by card — so 500 cards cost one HTTP request,
not 500. Memoise per board with a ~10s TTL and a single in-flight promise so concurrent badge calls
share it. Rate limits (100 req/10s/token, 300/10s/key) are then irrelevant.

Costs Path B adds: an API key, `authorize.html`, `authorization-status` + `show-authorization`
capabilities, secret storage, an unauthorised badge state, and a worse first run.

Either way, `data.ts` is the only file that knows. `computeBadges` is written against our own domain
type, with a thin adapter at the boundary — the client-library shape is undocumented and must never be
asserted as fact.

### 2.2 Badge refresh — a permanent constraint, decided

`card-badges` re-runs when card data changes. It does **not** re-run when settings change, and there is
**no supported way to make it** — confirmed on the forum, uncontested by Atlassian. Dynamic badges cannot
rescue this: `dynamic` returns *a single badge object*, so it can change a badge's content but never how
many badges exist. That count is fixed by the outer array from the last time the handler ran.

**Decision (yours, 2026-09-14): save, then refresh the board.** We ship `t.alert` on save and document
it. This keeps M3 at ~3 days instead of ~7 and avoids building a dynamic-slot design that would not
fully work anyway.

Related: even `card-badges` re-invocation on data change is not reliable in the documented sense — a
2023 bug had it silently not firing on card creation (Atlassian fixed it within hours, which tells you
there is no contract here, only behaviour).

### 2.3 Known platform hazards

- `p.trellocdn.com/power-up.min.js` is **unversioned** — always current, no pinning. Latest is 1.25.1
  (8 Jul 2025).
- Atlassian announced on **18 Nov 2025** that they are rewriting the code that renders Power-Up UI
  components. Badge rendering is in that blast radius, and so is every undocumented behaviour we depend
  on: wrapping, uncoloured-badge appearance, text overflow. **Request early access from
  `trello-powerups-team@atlassian.com` at M0** and re-run the measurements against it.
- Badge count, text length, truncation and wrapping are **entirely undocumented**. The docs say only
  "an array of 0 or more badge objects". We measure and cap defensively.
- In April 2023 a platform change broke all externally-hosted badge icons with CORS errors. Our
  icon-free unicode-glyph design dodges that class of failure — record it as a deliberate choice.
- A Netlify/Vercel security-header preset sending `X-Frame-Options: DENY` breaks a Power-Up **silently**.
  Put it in M0's acceptance list.
- `pluginData` is read-only over REST. Settings can only be written from the client library.
- `t.set` shared-storage writes are not atomic and fail last-write-wins with no error — always write all
  keys as one object.
- Never hold a `t` reference beyond the callback that produced it; scope validity is only guaranteed
  during execution.

---

## 3. Milestones

Ideal days, one developer who has not built a Power-Up before.

### M0a — Dev environment · 0.5–1d

Workspace you admin; register **two** Power-Ups at `trello.com/apps/admin` (`…-dev`, `…-prod`) so you
are never repointing one URL; HTTPS tunnel (cloudflared) or preview deploy — **localhost is not
supported**; capabilities enabled in the admin tab; Power-Up appears under board → Power-Ups → Custom.
Acceptance includes: connector serves with short cache TTL and no frame-blocking headers.

### M0b — Six blocking experiments · 1–2d

Every one of these swings the plan. Run them before writing product code.

| Exp | Question | Decides |
|---|---|---|
| E1 | Does `t.card('checklists')` return checkItems on **cold load**, 500 cards × 3–4 checklists × 10–15 items, nothing toggled? | Path A vs B — ±4 days |
| E2 | A1/A2/A3 — ordering, checklist-gates-items, per-checklist vs per-card limit | The filtering model itself |
| E3 | 40 synthetic badges on one card; text at 20/50/100/200 chars; board view and list view; both themes | The badge cap, and whether "all" ships |
| E4 | Enable the Power-Up, expand a checklist natively on the same card — do they collide? | Whether even the narrow product is viable |
| E5 | `t.set('member','private', …)` on board A, read on board B | A6, the settings data model |
| E6 | Save a setting, confirm badges do not re-run | Confirms §2.2 (expected: they don't) |

Also: dump a real payload to a committed fixture, so M1's tests are not built on invented shapes.
Trello's own guidance is <500 cards per board when cards have many checklists — our worst case is
exactly that, so measure time-to-first-paint and scroll with the Power-Up on vs off.

### M1 — Freeze SPEC.md, write `computeBadges` · 1d

`SPEC.md` tags every assertion **Observed** or **Inferred**, records A1–A7 with their resolutions from
M0b, and states the reworded labels. Then `computeBadges` as a pure function with
unit + property tests. Property tests matter more than golden tests here: golden tests built from the
same screenshots that produced the spec cannot catch A1/A2 being backwards.

### M2 — Connector, `card-badges`, data adapter · 2d (A) / 5–6d (B)

### M3 — Settings popup, storage, `remove-data` · 3d

Bigger than it looks: Trello fixes popup **width** and only height is adjustable, so `sizeTo` on every
reflow; use `p.trellocdn.com/power-up.min.css` rather than recreating the look; never call `t.popup()`
inside a `.then()` chain (breaks the `t` context — use async/await); form state derivation as a tested
pure function; dirty-state/discard; settings schema with `v`, a migration path, and the 4096-char
member-scope budget; `remove-data` fires with ~500ms to act, so `t.getAll()` first if you need the data.

### M4 — Polish · 2–3d

Edge cases (no checklists, 0-item checklist, 200-char item, emoji, RTL), dark theme, the a11y rule that
colour must never be the only signal (O2 is exactly why — the glyph and the count carry it), unicode
glyph rendering on Windows and macOS, and **coexistence testing with the native expansion**.
Stopping condition is functional equivalence on our two configurations — not "matches the screenshots".

### M5 — Packaging · 1d

Hosting, prod registration, README, settings copy. Private install: no Marketplace listing, no billing,
no trademark review, no privacy policy required.

**Total ≈ 10–13 ideal days on Path A, 14–18 on Path B.** Most likely to blow up: M2 if E1 goes the way
the evidence suggests.

---

## 4. Testing — the honest version

There is no Power-Up test harness and no headless Trello. Three tiers, and the top one is thin:

1. **Unit + property tests on `computeBadges`** — fast, real, covers the whole product logic. This is
   where the value is.
2. **One Playwright smoke test** against a real Trello account, if you are willing to put credentials in
   CI. Otherwise skip it and say so.
3. **A manual checklist** for the popup and the surface matrix (board view, list view, both themes,
   native-expanded and not).

Golden fixtures from the screenshots are still worth having, but they are a regression net, not
validation — they enshrine A1–A7 as assertions. Tag them.

---

## 5. Out of scope

Paid licensing and tiers, a Marketplace listing, a marketing site, Mirror-card support, and any attempt
to make badges interactive.

**The Trello mobile apps are not a target** (your call, 2026-09-14). Target surfaces are Trello on the
web and the desktop app, board view and list view, both themes. Mobile web is untested and best-effort:
badges will render there because Trello renders them, but nothing is verified and the badge cap is
chosen for desktop card widths.

## 6. Still open

1. **The parent popup** (§1.5) — what, if anything, we put in the popup ours stacks on.
2. **A4/A5** — `%` rounding and the 0/0 checklist. Undecidable from evidence; we choose and document.

## 7. Worth 30 minutes before M0

Search for existing open-source card-front checklist Power-Ups. Native Trello now covers part of the
job; something permissively licensed may cover more of the rest. The cheapest outcome of this plan is
discovering it does not need to be executed.
