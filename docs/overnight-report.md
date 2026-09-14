# Overnight session report

Session: 2026-09-14, unsupervised, working from `HANDOVER.md`.
Repo initialised with `git init`; six local commits; **no remote, nothing pushed**.

**Nothing in this repo has ever run against Trello.** Every claim below about the platform is
inherited from the reviews or reasoned from documentation. Everything I say is *verified* was verified
by running it on this machine, and that only ever means TypeScript compiling and tests passing.

---

## 1. Headline

The project is **not redundant** — build it. But two things changed shape overnight.

**a. There is no open-source prior art.** The entire visible field is five GitHub repos, and the one
that is genuinely a card-front checklist badge Power-Up is ~60 lines emitting one aggregate badge per
card. Nothing to fork, nothing that makes this unnecessary. The *commercial* field is crowded (at
least four listings plus Trello's own native badge) but every one of them stops at aggregate progress;
none advertises rendering checklist item text on the card front, which is what is left of this
product. Full write-up and licences in `docs/prior-art.md`.

**b. The prior-art search turned up a data path the plan does not have.** A Power-Up in the wild reads
checklist completion *counts* inside `card-badges` from `t.card('badges')` —
`badges.checkItems` / `badges.checkItemsChecked`, the totals that drive Trello's own `☑ n/m` badge —
with a code comment asserting these are always available for every card. The structural argument
agrees: the native badge *is* board-level rendering, so its counts must be in the board-level cache,
which is the same reasoning that kills Path A.

This does **not** rescue the product — no names, no per-checklist split, no item text, so it delivers
none of §1.2's points 2 and 3. It changes the *degraded* state: Path B's first run, an unauthorised
user and a revoked token currently render nothing, and with this they can render an honest card-level
progress pill with no auth at all. I wrote it as **Path C**, off by default, and added **E7** to the
spike harness. It is a lead resting on one unstarred repo's comment plus an argument — do not build on
it before E7 runs.

No stop condition fired. I found nothing in `PLAN.md` that is wrong, and I did not have to guess at
A1–A7 to make progress.

---

## 2. What was built

| Deliverable | State |
|---|---|
| `docs/prior-art.md` | Done. Verdict: build it. |
| `SPEC.md` | Done. 480 lines, every assertion tagged **[O]bserved / [I]nferred / [D]ecided / [U]nresolved**, A1–A7 recorded with experiment and provisional default, reworded labels fixed, domain types defined independently of Trello's shapes. |
| `src/badges.ts` | Done. Pure, synchronous, no Trello imports. |
| Tests | **102 passing.** 42 unit + golden, 15 property, 17 data-layer, 19 settings, 9 spike. |
| Scaffold | Done: `public/index.html`, `settings.html`, `authorize.html`, `src/connector.ts`, `data.ts`, `settings.ts`, `settings-ui.ts`, `constants.ts`, `config.ts`, `trello.ts`. Vite build produces `dist/`. Typechecks clean under `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. |
| M0b spike harness | Done, and further than the brief asked: E1, E2, E3, E5, E6 **and E7**, with a results page that prints a verdict per experiment. |

### Verification I actually ran

- `npm test` — 102 tests pass.
- `npm run typecheck` — clean.
- `npm run build` — clean; bundle inspected for stray Node imports and for the capability strings.
- **Mutation check of the property suite.** I seeded eight deliberate faults into `badges.ts` (cap
  removed, truncation disabled, ordering inverted, position sort reversed, each limit ignored, each
  item class ignored, A2 gating ignored, the per-card budget forced to per-checklist) and ran *only*
  the property tests. Three survived the first version of the suite; I strengthened it, and all eight
  are now killed by the property tests alone. That is the closest thing to evidence I can produce that
  the tests would catch a real regression, and it is why the properties are worth more than the golden
  fixtures.

### Verification I could not run

Everything else. No Power-Up was registered, no board was loaded, no badge was rendered, no popup was
opened, no REST call was made. The settings popup has never been sized by `t.sizeTo`. `authorize.html`
has never authorised anything.

---

## 3. Decisions I made that the plan did not

Listed because each is a place where I chose, and each is cheap to reverse.

1. **`BadgePolicy` is separate from `Settings`.** A1–A5 are unresolved *behaviours*, not user
   preferences, so they are a distinct object with its own defaults rather than nine more fields in
   the settings blob. `computeBadges(checklists, settings, policy, caps)`.
2. **Every A-default is PLAN's own stated assumption.** Where PLAN states a guess (A1 position order,
   A2 checklist gates items, A3 per-checklist, A4 round, A5 empty-is-complete), I used exactly that
   and did not stack a second guess on top.
3. **New option S1, `suppressRedundantSingleHeader`.** O9 observes that on a single-checklist card the
   header badge duplicates Trello's own. The vendor does not suppress it; nor do we, by default. But
   it is one line to flip once someone looks at a real board, so it is an option rather than nothing.
4. **Default is headers-only.** `showIncompleteItems: false`. Platform review finding 14c is blunt
   that the default configuration is where the collision with native card-front expansion is worst, so
   the zero-config state is coloured progress pills — the one thing native cannot do — and item badges
   are a deliberate act. `incompleteItemLimit` defaults to 3, so the first flip does not explode a card.
5. **Caps are 20 badges / 64 code points.** Both are guesses; nothing is documented. I went below the
   delivery review's suggested ~30 because the card front is now contested by native expansion. E3
   replaces both numbers; they are constants in one file.
6. **Truncation is ours and it is by code point.** The vendor appears not to truncate at all (O10).
   We do, defensively, appending `…`, counting code points so a surrogate pair is never split.
7. **Total ordering by `(pos, id)`.** Trello does not promise unique `pos`. Without a tie-break the
   badge order would vary between renders — an invisible, unreproducible bug. Tested.
8. **`Unavailable` is a distinct return from `[]`.** `[]` means the card genuinely has no checklists;
   `Unavailable` means we do not know. Conflating them is how a broken data source comes to look like
   an empty board. The adapter returns `Unavailable` if **any** checklist on the card lacks a
   `checkItems` array, rather than silently rendering a partial card.
9. **A wording firewall.** User-visible copy says "finished / unfinished"; code and docs say
   "complete / incomplete". Deliberate, so our labels cannot drift back onto the vendor's wording by
   accident. All copy lives in `LABELS` in `constants.ts`.
10. **A settings memo in the connector.** Trello fires `card-badges` for every visible card at once;
    an un-memoised settings read is one storage round-trip per card. 10-second TTL, resolved data only,
    never a retained `t`.
11. **A failed REST request is not cached.** One blip would otherwise blank the board for a full TTL
    and suppress every retry inside it.
12. **`migrate` drops unknown fields.** Lossy across a downgrade, deliberately: carrying unknown keys
    forward would silently eat the 4096-character budget. Invalid *known* fields fall back per-field
    rather than rejecting the whole blob, and an unparseable blob yields defaults silently — a user
    whose settings are corrupt gets a working board, not an error badge.
13. **Build config.** Vite root is `public/` so the connector sits at the site root rather than
    `/public/`, and `base: './'` so subpath hosting (a GitHub Pages project site, a preview deploy)
    does not break asset URLs.
14. **One deviation from the brief's property list.** The brief asks for *"item order is a subsequence
    of input order"*. That property is false as stated: ordering sorts by `pos`, so the output is not a
    subsequence of the input **array** order. I implemented the invariant it was reaching for —
    emitted items are a subsequence of the checklist's *ordered* items, i.e. filtering and truncation
    never reorder — plus a separate property that the result is independent of the order the source
    returned. Both hold under either A1 setting.

---

## 4. Assumptions I had to invent

Each of these is a guess I could not avoid. None is in `SPEC.md` as a fact.

1. **`badges.checkItems` / `badges.checkItemsChecked` are the sub-field names**, and they are populated
   at board level. From the documented REST card shape plus one third-party Power-Up. `badges` is a
   documented `t.card()` field; its sub-fields are not documented anywhere. **E7.**
2. **The client library's item-completion field name.** The adapter accepts `state: 'complete'`
   (REST's documented spelling), `complete: boolean`, and `checked: boolean`, because the client
   library's shape is undocumented and I would rather accept three spellings than assert one.
3. **`t.modal()` exists and is callable from a `board-buttons` callback.** Used by the spike's results
   page. If it does not, change it to `t.popup` — one line in `src/spike.ts`.
4. **`t.render()` exists on an iframe `t`.** Used by the settings popup and `authorize.html` to resize
   on reflow.
5. **`mod-primary` is a real class in `power-up.min.css`.** Used on two buttons. Cosmetic if wrong.
6. **A7's limit range** is `all, 1..10`. Invention, as PLAN already says — only `all` and `1` were ever
   observed.
7. **Badge `title` renders as a hover tooltip on a card-front badge.** The a11y rule in SPEC §3.7 leans
   on it. Documented for badges, never seen by me.

---

## 5. What is unfinished, and what I deliberately did not do

- **M0a and M0b are not done and cannot be.** They need Trello admin access and an HTTPS host.
- **No real payload fixture.** Delivery review F13 wants M0b to dump a real `t.card()` payload so the
  tests stop being built on invented shapes. The spike harness captures and prints exactly that (the
  "Raw results" block), but nobody has run it.
- **i18n is only half done.** Every user-visible string is centralised in `LABELS`, which is the
  expensive half of the refactor, but nothing is routed through `t.localizeKey` / `initLocalizer`.
  Doing so now is small; doing it after M3 is not.
- **No Playwright smoke test.** PLAN §4 makes it conditional on putting real credentials in CI. I did
  not, and I am saying so rather than pretending tier 2 exists.
- **No manual test checklist document.** SPEC §8 names it as tier 3; it should be written alongside
  M4, against a real board, not invented here.
- **`authorize.html` is a stub with a button.** It compiles. That is all I can claim.
- **No API key anywhere.** `CONFIG.restApiKey` is an empty string, by instruction.
- **Accessibility and dark theme are specified, not tested.** SPEC §3.7 states the rule (no state in
  colour or glyph alone) and the code honours it via the tooltip and the progress string. Whether the
  unicode glyphs render acceptably on Windows, or whether badge contrast survives dark theme, is
  unknowable from here.
- **I did not touch the vendor's Power-Up, docs, marketing images or S3 bucket.** Its marketplace URL
  appeared in some search result lists; I did not open it. No vendor asset is in this repo.

---

## 6. What to do first in the morning

1. **Read `docs/prior-art.md` §1 and the verdict** (five minutes). If you disagree that the project
   survives, stop before M0a — that is the cheapest possible exit.
2. **Decide on the headers-only default** (`DEFAULT_SETTINGS.showIncompleteItems`, `src/constants.ts`).
   It is the one product decision I made unilaterally, and it follows the platform review rather than
   the original's behaviour.
3. **M0a.** Host `dist/` on HTTPS. Register three Power-Ups: `next-actions-dev`, `next-actions-prod`,
   and one for the spike pointing at `…/spike.html` with `card-badges` + `board-buttons`. Confirm no
   `X-Frame-Options: DENY` and a short cache TTL on the connector.
4. **Email `trello-powerups-team@atlassian.com`** for Power-Up UI early access before you measure
   anything in E3. The rendering rewrite announced 18 Nov 2025 invalidates measurements taken against
   the old renderer.
5. **Run E1 and E7 cold, and only once.** Fresh board you have not touched this session. Do not open a
   card. Do not toggle a check item. The harness records the first observation per card and never
   overwrites it, and it will tell you in red if it detects the self-heal — but the discipline still
   has to be yours, because a warm board cannot be made cold again.
6. Then E2 (ordering mode), E3 (stress mode), E4 (look at it), E5 and E6 (buttons on the report page).
7. **Feed the answers back into three files and nowhere else:** `DEFAULT_POLICY` and `DEFAULT_CAPS` in
   `src/constants.ts`, `CONFIG.dataPath` in `src/config.ts`. Then re-run the tests: the golden fixtures
   tagged `[encodes A1, A2, A3]` are *expected* to fail when an option flips, and that is the signal
   working, not a regression.
