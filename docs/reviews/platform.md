# Adversarial review — Trello Power-Up platform angle

Target: `PLAN-draft1.md` (clean-room clone of "Show Checklist" by ADF TECH LTD)
Reviewer angle: verify every platform claim against current Atlassian/Trello developer docs and the Atlassian developer community forum. Nothing in the plan was taken on trust.
Date of review: 2026-09-14.

Format: **CLAIM IN PLAN → VERDICT → EVIDENCE (URL) → REQUIRED PLAN CHANGE.**

---

## 1. `t.card('checklists')` inside `card-badges` returns checkItems, no auth required

**CLAIM (§2.1, Path A, "preferred").** *"`t.card('checklists')` inside the `card-badges` handler. No auth, no API key, no backend, no rate limits. Docs list `checklists` as a valid `t.card()` field but warn checkItems are 'not guaranteed' via `t.cards()`; the recommended route is `t.card()` in a card context, which is exactly where `card-badges` runs."*

**VERDICT: WRONG.** The final clause misreads the docs, and every piece of primary evidence contradicts it. This is not a spike detail — it invalidates the plan's preferred architecture.

**EVIDENCE.**

- The doc sentence is exactly: *"checkItems are not guaranteed to be available in the checklists field when using `t.cards()`. The best way to get check item information is to either use the individual `t.card()` function in a card context, or use the API."* — https://developer.atlassian.com/cloud/trello/power-ups/client-library/accessing-trello-data/ . "In a card context" means a card-back / card-scoped iframe where the card detail has actually been loaded. It is not a statement about `card-badges`, which runs while the *board* is being drawn.
- **Why it structurally cannot work, from Atlassian staff.** bentley (Atlassian), 21 Feb 2020: Trello's web client locally caches only the data needed for *board-level* rendering; checklist detail loads only when a card back is opened. Serving it at board level would mean either incomplete cached data or extra API requests with unknown performance cost. — https://community.developer.atlassian.com/t/get-checklist-items-via-powerup-client-api/35632
- **Corroborated.** bentley, 1 Sep 2022: the client library reads "the web client's cache via websocket-updated data." — https://community.developer.atlassian.com/t/what-is-the-scope-of-trello-frame-in-powerup-callbackup/61164 . So `t.card()` returns whatever the board view happened to cache, and nothing else.
- **Exactly this product, exactly this failure.** Ernest Gazarian, 9 Oct 2023, building a checklist-progress badge via `card-badges`: on board load every card renders the "N/A" fallback; `checklist.checkItems.length` throws `TypeError: Cannot read properties of undefined (reading 'length')` **until the user checks or unchecks an item**, after which it starts working. DEC replied 21 Oct 2023 having tried `t.card("id", "checklists")` — the plan's exact Path A call — hit the same error, and wrote: *"I can get to the checkListItems on the BACK of the card, but not from the badge… TRELLO TEAM: This appears to be an issue with the `t.card()` ref we get in the card badge. This is a Bug!!!"* **No Atlassian reply; thread unresolved.** — https://community.developer.atlassian.com/t/power-up-development-does-initialize-run-before-cards-are-fully-loaded/73609
- **Still broken 16 months later.** vitor roberto, 27 Feb 2025, calling `t.card('all')`: the returned checklist objects contain **only `id`, `idBoard`, `idCard`, `name`, `pos`** — no `checkItems` field at all. No reply, no staff answer. — https://community.developer.atlassian.com/t/checklist-information-in-power-up-development/89718
- The vendor's own troubleshooting page carrying an **"Authorize account"** control (§1.3 of the plan) is strong corroboration that the original product runs on Path B precisely because Path A does not work.

**REQUIRED CHANGE.** Demote Path A from "preferred" to "verify, expect failure." Make Path B (`t.getRestApi().authorize()` + REST) the assumed architecture and cost it into milestones 0–5: API key, authorize page, token storage, cache layer, rate limiting, degraded first-run UX. Milestone 0 must test the **cold-load** case explicitly — fresh board load, no card opened, no checkitem toggled. A spike that toggles an item first will produce a false green, which is exactly the trap the 2023 reporter fell into.

---

## 2. Field names of the checklist / checkItem objects (`checkItems`, `state`, `name`, `pos`, `id`)

**CLAIM.** The spec in §1.2 depends on per-item `state`, `name` and `pos`, and on checklist `pos`/`name`.

**VERDICT: UNVERIFIABLE from the Power-Up docs — the shape is entirely undocumented.**

**EVIDENCE.** `accessing-trello-data` lists `checklists` as an allowed `t.card()` field and documents **no sub-field structure whatsoever** (https://developer.atlassian.com/cloud/trello/power-ups/client-library/accessing-trello-data/). The only empirical shape on record is the 5-field object from topic 89718 above. The `checkItems[].state` = `"complete"` / `"incomplete"` shape is documented **only for REST** — https://developer.atlassian.com/cloud/trello/rest/api-group-cards/

**REQUIRED CHANGE.** SPEC.md must not assert client-library field names as fact. Define an explicit internal domain type, write `computeBadges()` against it, and put a thin adapter at the data boundary. If Path B wins, the REST shape is the only documented contract available.

---

## 3. Number of badges, badge text length, truncation, and wrapping

**CLAIM (O4, O9, and the whole emission model).** *"Badges flow/wrap: an item can share a row with a header badge"*; limit dropdown offers `all | 1 | …`; default config emits one badge per checklist plus one per check item.

**VERDICT: UNDOCUMENTED. The plan promotes screenshot-reading to platform contract.**

**EVIDENCE.** https://developer.atlassian.com/cloud/trello/power-ups/capabilities/card-badges/ specifies only *"an array of 0 or more badge objects."* No maximum badge count. No text length limit. No statement about truncation, ellipsizing, or line wrapping. Nothing in the forum either. O4 is inferred from a vendor marketing GIF, and marketing GIFs are curated to show best-case rendering.

This matters more than it appears. The plan's default configuration ("Show all complete checklists" + "Show all complete items" + "Show all incomplete items") emits one badge per checklist **plus one per check item**: a card with 4 checklists × 15 items = 64 badges, each containing a full item title, rendered in the board's hot path.

**REQUIRED CHANGE.** Add an explicit measurement task to milestone 2: render 10 / 25 / 50 / 100 badges, and badge text at 20 / 50 / 100 / 200 characters, in board view and list view, in light and dark theme. Record results in SPEC.md as *measured*, never as *documented*. Ship a hard internal cap on badge count regardless of what the settings permit.

---

## 4. Legal `color` values for card badges

**CLAIM (§1.3).** *"Trello's badge palette is `blue green orange red yellow purple pink sky lime light-gray`."*

**VERDICT: CONFIRMED, exactly — including `light-gray`.**

**EVIDENCE.** The docs list `blue`, `green`, `orange`, `red`, `yellow`, `purple`, `pink`, `sky`, `lime`, `light-gray`, and describe `color` as *"Optional color for the badge."* — https://developer.atlassian.com/cloud/trello/power-ups/capabilities/card-badges/

**REQUIRED CHANGE.** None to the list. But note the caveat: what an **omitted** color renders as is not documented anywhere. O3 ("item badges are uncoloured plain text") is an observation of today's rendering, not a contract — and it sits inside the blast radius of finding 11.

---

## 5. Is `icon` or `monochrome` required? Can a badge be text-only?

**CLAIM (O3, implicitly).** Item badges are text-only with `☑` / `☐` glyphs and no icon.

**VERDICT: CONFIRMED — text-only badges with no icon are legal.**

**EVIDENCE.** Same page: `text` is *"Optional text to display on the badge"*; `icon` is *"Optional url to the icon to show with the badge"*; `monochrome` is a boolean controlling only *whether Trello applies color filters to the icon*. Neither `icon` nor `monochrome` is required.

**Supporting risk, worth recording as a deliberate decision.** In April 2023 a Trello platform change broke **all** externally-hosted badge icons across many Power-Ups with CORS errors; the community workaround was base64 data URIs, and Atlassian deployed a fix four days later. — https://community.developer.atlassian.com/t/icons-missing-cors-policy-change/68703 . The icon-free glyph design dodges this class of failure entirely.

**REQUIRED CHANGE.** Write the icon-free design into SPEC.md as an intentional choice with this rationale. Add a cross-platform check that `☑` / `☐` render acceptably on Windows, macOS, iOS and Android, in both themes — glyph fallback is the failure mode here.

---

## 6. When is `card-badges` re-invoked, and can a settings change force a refresh?

**CLAIM (§2.2).** *"Trello re-runs `card-badges` when card data changes, so ticking an item updates the badges. It does not re-run them when settings change."* Option 2 proposes a *"fixed pool of N `{dynamic, refresh:60}` badge slots… a slot returns `null` when unused. Live updates."*

**VERDICT: the second sentence is CONFIRMED and worse than admitted; the first is UNDOCUMENTED and empirically unreliable; Option 2 as described is architecturally incapable of doing what the plan says it does.**

**EVIDENCE.**

- **There is no documented invocation contract at all.** The card-badges page documents only `dynamic` (*"A function that returns a single badge object, or a Promise that resolves to one"*) and `refresh` (*"# of seconds for Trello to wait before re-running the dynamic function. Minimum of 10"*), plus the guidance *"Only use a dynamic badge if the data the badge is showing is expected to change outside of Trello."*
- **No supported force-refresh, confirmed.** On "Remotely update card badges": *"there is no way to trigger it from the backend. There isn't a call or capability or anything that does this."* The only workaround offered was mutating the card over REST (e.g. appending a space to the description) to force a front-end re-render. No staff correction; thread ended unresolved. — https://community.developer.atlassian.com/t/remotely-update-card-badges/58846
- `t.render()` exists in the client library but is for **iframe** capabilities re-rendering their own DOM. There is no `t.render` equivalent for badges. — https://developer.atlassian.com/cloud/trello/power-ups/client-library/
- **Invocation is not reliable even for card changes.** "'card-badges' not called on new card" (21 Oct 2023): the handler silently stopped firing on card creation. Raymond Wang (Atlassian) confirmed *"there's definitely a bug here, so we'll start looking into it immediately"* and shipped a fix within hours. — https://community.developer.atlassian.com/t/card-badges-not-called-on-new-card/74010 . Combined with topic 73609 (stale/empty badges on board load until a checkitem is toggled), the plan's assumption of prompt re-invocation on data change is not safe.
- **Option 2 cannot work as described.** `dynamic` is documented as returning *a single badge object*. A dynamic badge can change the **content** of an existing badge; it cannot change **how many badges exist** — that count is fixed by the outer array from the last time the outer handler ran. So a settings change that adds a checklist, raises the item limit, or un-hides completed items still cannot appear without a board refresh. Separately, *"a slot returns `null` when unused"* is undocumented behaviour; nothing states `null` is a legal dynamic return, and it may well render an empty badge.

**REQUIRED CHANGE.** Delete the claim that Option 2 provides "live updates" for settings changes. State plainly in SPEC.md that **there is no supported way to refresh badges after a settings change**. Ship Option 1 (`t.alert` + "refresh the board"). If Option 2 is ever attempted, the first experiment must be whether a `null` dynamic return renders nothing.

---

## 7. `show-settings` contract, `t.popup`, back chevron, size constraints

**CLAIM (§1.3).** *"Trello-native popup, title `Settings`, with a back chevron and close X (i.e. `show-settings` capability → `t.popup`)"*, with a scrollbar and content below the fold.

**VERDICT: CONFIRMED, with two undocumented edges.**

**EVIDENCE.**

- `show-settings` returns a popup. Documented example is literally `t.popup({ title: 'Custom Fields Settings', url: './settings.html', height: 184 })`, recommended because *"it is the least disruptive, and fits in well with the rest of Trello's UX."* — https://developer.atlassian.com/cloud/trello/power-ups/capabilities/show-settings/
- The back chevron is explained by popup stacking: *"Popups can be stacked, meaning you can have users navigate through more than one if necessary and a back control comes built in."* Your settings popup is stacked on the Power-Ups menu popup, hence the chevron. — https://developer.atlassian.com/cloud/trello/power-ups/ui-functions/popup/
- **Width is fixed by Trello; only height is adjustable.** `height` is the *initial* height and can be changed later. **No maximum height is documented.**
- Docs troubleshooting note worth obeying: do not call `t.popup()` inside a `.then()` chain — use `async`/`await`, or the `t` context breaks.

**REQUIRED CHANGE.** Validate the transcribed two-column panel (label + dropdown rows, plus a licence section below the fold) against Trello's **fixed** popup width before designing it. Plan for dynamic resizing rather than a hardcoded height.

---

## 8. `t.set` / `t.get` scope + visibility matrix; per-member-per-board settings (A6)

**CLAIM (A6).** *"'Per user settings' = each Trello member gets their own settings; a member's settings apply to them on that board."* Open question 3 asks the user to choose between per-board and global.

**VERDICT: `member` scope with `private` visibility is CONFIRMED legal. The per-board half of A6 is UNVERIFIED — the docs are silent, and the plan states it as fact.**

**EVIDENCE** — all from https://developer.atlassian.com/cloud/trello/power-ups/client-library/getting-and-setting-data/ :

- Scopes: `board`, `card`, `member`, `organization`, or a specific card id. Visibilities: `shared`, `private`. *"A visibility of `private` means that only the member who set the data will be able to see it, regardless of what scope it is stored at."*
- **Size:** *"The size limit on the resulting stringified object is 4096 characters per scope/visibility pair."* Exceeding it yields `"PluginData length of 4096 characters exceeded."` A single settings object is small; a blob keyed by board id under one member/private key is not.
- **Race conditions, confirmed:** *"Shared storage operations are not atomic. If two `set` operations happen at the same time on two different keys they can override one another."* Mitigation: pass all key/value pairs as **one object**. Note this is silent last-write-wins, not a 409 — there is no conflict error to catch.
- Scope must be "in context": *"When using a named scope, Trello will store the data on the particular object of that name if it is considered in context."* `t.set('card', …)` fails without an active card; use `t.getContext()` to check.
- `organization` caveat: a member cannot set private data at organization scope if the org is private and the member is not in it — directly relevant to the workspace licence tier in §1.3.
- Never store tokens in `shared` visibility. If Path B is adopted, use the Managing Secrets page / `t.storeSecret`, which the plan does not mention at all.

I could find **no documented statement either way** on whether member-scoped data persists across boards. A6 is inferred from the marketing phrase "per user settings"; the vendor's own **"Remove personal settings"** control hints at a single global personal store, i.e. the opposite.

**REQUIRED CHANGE.** Move A6 out of "inferences" and into milestone 0 as an experiment: set a member/private key on board A, read it on board B, record the result. Open question 3 cannot be answered by the user — it is an empirical platform question whose answer determines the settings data model.

---

## 9. Performance: `card-badges` per card, async `t.card()`, and the size of the spike board

**CLAIM (Milestone 0).** *"`t.card('checklists')` verified in `card-badges` on a 60-card board."*

**VERDICT: no documented performance guidance exists, and the spike is undersized by roughly an order of magnitude.**

**EVIDENCE.**

- `card-badges` is invoked per card by design — capabilities are checked at render time: *"When the Trello client goes to render a board view, it knows that `board-buttons` will need to be drawn if there are any, so it checks all of the Power-Ups enabled on the board…"* — https://developer.atlassian.com/cloud/trello/power-ups/capabilities/
- The mitigating fact: `t.card()` reads the web client's **local websocket-updated cache**, not the network (bentley, topic 61164) — so per-card cost is postMessage round-trips, not HTTP. **But this is the same fact that guarantees checkItems are absent (finding 1). You cannot have both.**
- The plan's design does one `t.card()` per card **plus** a settings read per card, each crossing the iframe postMessage boundary.
- Trello's own scale guidance: under 1,000 open cards per board, **under 500 if cards have lots of checklists**, hard limit 5,000. — https://support.atlassian.com/trello/docs/troubleshooting-a-slow-board/ . The worst case is precisely "many cards with many checklists."
- Staff constraint on caching across calls: *"the only expectation that has been set is that the state/scope is valid during the execution of the callback."* Holding a `t` reference past callback completion is unsupported. — topic 61164.

**REQUIRED CHANGE.** Milestone 0 spike board: 500 cards × 3–4 checklists × 10–15 items, not 60 cards. Measure time-to-first-paint and scroll smoothness with the Power-Up on versus off. Memoise per card id, and never retain `t` beyond the callback.

---

## 10. REST rate limits (Path B costing)

**CLAIM (§2.1).** *"rate limits (100 req/10s/token)."*

**VERDICT: CONFIRMED and correctly stated, but the cost model around it is optimistic.**

**EVIDENCE.** *"300 requests per 10 seconds for each API key"*; *"100 requests per 10 second interval for each token"*; `/1/members/` routes limited to 100 per 900 seconds; and a penalty rule — if one API key generates more than 200 `429`s, all remaining requests from that key in the current 10-second window are `429`d. — https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/

**REQUIRED CHANGE.** One `GET /1/boards/{id}/checklists` per board gets initial data, but *keeping badges current* means polling or webhooks — and finding 6 says you still cannot push the result into a badge without a board refresh. Cost Path B with a realistic freshness strategy, not just the cold fetch.

---

## 11. `p.trellocdn.com/power-up.min.js` versioning, and an in-flight Trello rendering rewrite

**CLAIM (§2).** *"zero runtime deps beyond `p.trellocdn.com/power-up.min.js`."*

**VERDICT: accurate, but it understates the exposure.**

**EVIDENCE.**

- The URL is **unversioned** — it always serves current. Latest release is **1.25.1, 8 July 2025**. — https://p.trellocdn.com/changelogs/power-up-js.html . There is no way to pin a version.
- Developer changelog, **18 November 2025**, verbatim: *"We're working on updating the code that renders some of our Power-Up UI components to be in line with the rest of our codebase. There shouldn't be functional changes to how anything works, but reach out to us if you want early access to the changes so that you can test your Power-Ups."* Contact: `trello-powerups-team@atlassian.com`. — https://developer.atlassian.com/cloud/trello/changelog/

Badge rendering is a Power-Up UI component. Every undocumented rendering behaviour this plan depends on — wrapping, un-coloured badge appearance, text overflow — is inside the blast radius of an in-flight rewrite.

**REQUIRED CHANGE.** Add "request Power-Up UI early access from `trello-powerups-team@atlassian.com`" to milestone 0, and re-run the finding-3 measurements against the early-access build before committing to a visual spec.

---

## 12. `on-enable` to open settings once

**CLAIM (§2).** *"Capabilities: `card-badges`, `show-settings`, `on-enable` (opens settings once)."*

**VERDICT: CONFIRMED as a capability, but it will silently not fire for most real installs.**

**EVIDENCE.** *"Your Power-Up is not guaranteed to have this capability called when it is enabled"* — notably when enabled via the API or the **public Power-Up directory** rather than the board directory. — https://developer.atlassian.com/cloud/trello/power-ups/capabilities/on-enable/

**REQUIRED CHANGE.** Do not make first-run onboarding load-bearing. Defaults must render something useful with zero configuration.

---

## 13. CSP / iframe sandbox

**VERDICT: no Trello-specific surprises found beyond the 2023 icon-CORS incident (finding 5).**

Connector and settings pages must not send `X-Frame-Options`, or a CSP `frame-ancestors` that blocks framing by `trello.com`. Netlify / Vercel / Cloudflare Pages defaults satisfy this, but some host security presets add these headers automatically.

**REQUIRED CHANGE.** Add an explicit response-header check to milestone 5 (packaging).

---

## 14. The native card-front checklist feature — verification and assessment

**CLAIM IN PLAN: none. The plan does not mention this once.** This is the plan's largest blind spot, and it is a product-level one rather than a technical one.

**VERDICT: CONFIRMED in full, including every detail in the brief.**

**EVIDENCE.** Announcement by Caity (Atlassian), **28 April 2026**, "See checklist items on the front of your Trello cards" — https://community.atlassian.com/forums/Trello-articles/Checklists-Now-appearing-on-the-front-of-your-cards/ba-p/3227768

> *"Until now, checklists have always lived on the back of a card. Starting this week, you can expand your list of items right from your board—without having to open and load the card details."*

Confirmed specifics:

- **Expand inline from the card front** by clicking the checklist icon / progress badge; click again to collapse.
- **Check items off directly from the card front.**
- **Completed items are automatically hidden** when a checklist is expanded on the front. Caity on whether they can be shown: *"When you check an item from the card front, it will still display briefly before it disappears. During that time, you can uncheck it."* — i.e. hiding is not configurable; the only concession is a brief undo window.
- **Due dates** render as a small clock icon with hover-for-full-date.
- **All plans.** *"Rolling out now"* as of late April 2026.
- **Not on Mirror cards.** Caity, in replies: *"We're definitely eager to support this on Mirror cards in the future, stay tuned!"*
- Reinforced by Trello's own newsletter, 7 May 2026: *"You just click the checklist progress bar and the items pop up right there. Check something off. Click again to close it."* — https://trello.substack.com/p/you-can-now-preview-checklists-without

### (a) Does it change what `card-badges` can or should do?

Yes, substantially. Mapping the plan's §1.1 value propositions onto the new baseline:

| Plan's selling point | Status after April 2026 |
|---|---|
| "See checklist status without opening the card" | **Native**, free, all plans |
| "Quickly select next item to work on" | **Native and interactive** — items are tickable from the front; a badge can never be, since badges are not clickable |
| "Display only relevant information" / hide complete items | **Partly native** — completed items are auto-hidden when expanded |
| Native `☑ 3/5` roll-up badge (O6) | Unchanged, but is now an interactive affordance, not a static badge |

What still genuinely differentiates a badge-based Power-Up:

1. **Always-on display with no click.** Native requires a click per card, per session, and the state does not appear to persist or propagate.
2. **Per-checklist colour coding** (green complete / orange incomplete). Native has no equivalent.
3. **`% complete` format.** Native shows only the native `n/m` progress.
4. **"First N incomplete items" filtering.** Native is all-or-nothing per checklist.
5. **Showing completed items on the front.** Native *refuses* to, and multiple users in the announcement replies asked for exactly this. This is now a differentiator rather than a parity feature.
6. **Per-user configuration** of any of the above.
7. **Mirror cards**, where native does not work at all — though a Power-Up would face the same missing-data problem there.

The strategic read: badges should stop trying to be a *checklist viewer* (native now does that better, and interactively) and reposition as an *always-visible, colour-coded, filtered summary*. That is a narrower product than the plan currently scopes, and it should be re-scoped before implementation, not after.

### (b) Is there any native or API way to expand by default, or expand-all?

**No, on both counts — and not for want of asking.**

- The announcement documents only a manual per-checklist toggle. There is no "expand by default", no "expand all", no board-level or member-level preference.
- **Users explicitly asked** in the article replies whether visibility can be defaulted on or disabled per board. No Atlassian commitment was given in response.
- The support documentation for checklists does not describe the card-front expansion at all — it still says only *"You can view the total number of checklist items on the front of a card."* — https://support.atlassian.com/trello/docs/adding-checklists-to-cards/
- Nothing in the REST API surfaces a checklist-expansion preference. `/boards/{id}/myPrefs/` covers things like email position and sidebar display, with no checklist-front setting — https://developer.atlassian.com/cloud/trello/rest/api-group-boards/ . No `card-badges`-adjacent capability exists to drive native UI either.
- Also relevant to any server-side settings ambition: per Trello's REST documentation, `pluginData` is **read-only over REST** (`GET /cards/{id}/pluginData`, `GET /boards/{id}/pluginData`); `PUT`/`POST`/`DELETE` are not supported. Settings can only be written from the client library.

**Consequence for the plan:** the always-on, zero-click property is the Power-Up's single strongest remaining differentiator, precisely *because* Trello provides no way to achieve it natively. That should become the headline of the repositioned product.

### (c) Does it create conflict or visual clash with a `card-badges` Power-Up rendering the same information?

Yes — three distinct problems, none of which the plan anticipates.

1. **Duplicate information on the same card.** When a user expands a checklist natively, the card front shows the native item list *and* the Power-Up's item badges for the same checklist. Same items, two visual languages, stacked. On the plan's default settings (all checklists, all items) this roughly doubles card height and looks like a bug.
2. **Direct contradiction on completed items.** Native **hides** completed items when expanded; the plan's default **shows** them with `☑`. Expanding a checklist natively therefore produces a card front that simultaneously hides and shows the same completed item. This is the most jarring clash, and it hits the default configuration.
3. **Layout competition for a now-contested card front.** Users in the announcement replies already complained the native feature *"consumes excessive card real estate."* The Power-Up adds 1 + N badges on top of that, in a container with no documented wrapping, truncation, or count limits (finding 3). There is no API to detect whether a checklist is currently expanded natively, so the Power-Up cannot adapt — it renders blind.

**REQUIRED CHANGE.** Add a §0.5 "competitive baseline" to the plan stating what native now does, dated 28 April 2026. Re-scope the product around the seven surviving differentiators above. Change the **default** settings so they do not duplicate native output — a sane new default is header badges only (colour + progress), with item badges opt-in. Add clash testing (Power-Up on, checklist natively expanded) to milestone 4. And note that this reframes open question 1: charging for something Trello now ships free is a materially different business than the original's $1.99/mo.

---

# The three findings most likely to sink the project

**1 — The data source does not exist on the client (finding 1).**
`checkItems` are not available from `t.card()` inside `card-badges`. Atlassian staff explained in 2020 *why* the board-level cache cannot contain them; independent developers reproduced the precise failure in October 2023 and February 2025, with no fix and no staff response in either thread. The plan's "preferred, no auth, no backend, no rate limits" path is almost certainly dead, which makes REST + OAuth + token storage + caching the **baseline** cost of this product rather than a fallback. If milestone 0 does not test the cold-load case, it will return a false positive and the project will discover this in milestone 2.
https://community.developer.atlassian.com/t/get-checklist-items-via-powerup-client-api/35632 · https://community.developer.atlassian.com/t/power-up-development-does-initialize-run-before-cards-are-fully-loaded/73609 · https://community.developer.atlassian.com/t/checklist-information-in-power-up-development/89718

**2 — Trello shipped this natively on 28 April 2026, free, on all plans, and made it interactive (finding 14).**
The clone's three headline value propositions are now platform features, and the native version lets users tick items off from the board — something a badge fundamentally cannot do. It also actively clashes with the plan's default configuration, which shows completed items that native deliberately hides. The plan does not mention this once; the product needs re-scoping around its seven surviving differentiators before any code is written.
https://community.atlassian.com/forums/Trello-articles/Checklists-Now-appearing-on-the-front-of-your-cards/ba-p/3227768

**3 — Settings changes cannot reach the board, and the settings-scope model is unverified (findings 6 and 8).**
There is no supported badge-refresh mechanism — confirmed on the forum and uncontested by staff. `dynamic` badges cannot change badge *count*, so the plan's Option 2 does not rescue this. And the core "per user settings" claim (A6) rests on marketing copy with no documented support for cross-board member data. The plan treats "Settings saved — refresh the board" as a polish item; it is a permanent platform constraint on the product's central interaction.
https://community.developer.atlassian.com/t/remotely-update-card-badges/58846 · https://developer.atlassian.com/cloud/trello/power-ups/client-library/getting-and-setting-data/
