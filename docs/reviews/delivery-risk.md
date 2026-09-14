# Adversarial review — PLAN-draft1.md

**Angle:** engineering delivery, risk, and legal/ethical footing.
**Reviewed:** `PLAN-draft1.md` (draft 1), against Trello/Atlassian developer docs, Atlassian Developer Terms and Marketplace listing guidance, and ADF TECH's published EULA.
**Verdict up front:** the plan is well-researched on *what the original does* and thin on *how this actually gets built and shipped*. Section 0 claims a discipline it does not practise, the legal analysis omits the one document that actually binds, the milestones omit the entire dev loop, and — decisively — Trello shipped a native card-front checklist preview in April 2026 that eats a large part of the product's reason to exist. See Section E.

---

## A. Clean-room discipline and legal footing

### F1. "Clean room" is claimed but not practised

Section 0 describes *"I only looked at public materials."* That is source-provenance hygiene, not a clean room. A genuine clean-room process has two separated parties: a **specification team** that may examine the original, and an **implementation team** that may not, with a written, filtered spec passed across the wall and a dated log of every question asked through it. Here one party did both — and §2.1 proves it: *"This is evidently what the original does — its troubleshooting page has 'Authorize account'"* is spec-side reasoning sitting inside the architecture section.

**Correction:** either drop the term (retitle §0 "Provenance: specification from public materials") or actually build the wall — freeze `SPEC.md`, then implement without reopening a single vendor artefact, and record who saw what and when. Claiming a clean room you didn't run is worse than claiming nothing, because it becomes a representation you'd have to defend.

### F2. The vendor EULA is never mentioned, and it is the real exposure

`https://adftech.net/eula` states you *"are not permitted to reverse engineer, decompile, disassemble or create derivative works of or modify the Software Product."*

That is **contract, not copyright**. Clean-room practice and the idea/expression distinction are defences against copyright claims; neither discharges a contract you accepted by installing the software. The binding question is whether the person doing the work ever installed and used the Power-Up.

**Correction:** add to §0 an explicit, dated statement — *"The author has / has not ever installed or used the original Power-Up, on account X."* If they have, the derivative-works clause is live and worth review by someone qualified (or the work should be done by someone who never accepted it). If they have not, say so, and say nobody on the project will install it — and note that this constraint means §2.1's "Path B is evidently what the original does" is the **last** inference of that kind available.

### F3. The plan optimises for the wrong target: looking identical

§1.3 transcribes the settings UI **verbatim**, and M4's success criterion is *"matches screenshots pixel-for-intent."* This is backwards. Behaviour is safe to replicate; presentation is not.

- **Not protectable:** the function (badges showing checklist state), the set of options, the filtering logic, the underlying idea.
- **Protectable or risky:** the name *"Show Checklist"*; the vendor's icon; the six marketing images (copyrighted — do **not** commit them to the repo or reproduce them in a README); the verbatim UI label strings; and a pixel-faithful reproduction of the whole panel as trade dress.

**Correction:** add **"§0.1 What we deliberately do not copy"** — name, icon, brand colours, marketing copy, marketing images, verbatim label strings. Reword every label in `SPEC.md` (*"Hide completed checklists"*, not *"Show all complete checklists"*). Change M4's criterion to *"functionally equivalent output for the four documented configurations."* State that the screenshots may be **referenced** to establish facts but must not be **stored** in the repo.

### F4. Atlassian's own rules impose naming constraints the plan defers too long

Atlassian Developer Terms and Marketplace listing guidance: keep *"names, domains, images, colors, etc. distinct from Atlassian and other Marketplace Partners"*; trademark infringement is an automatic rejection covering both visual assets and naming; names may not contain "Atlassian", "plugin", "add-on", or "app"; *"X for Trello"* is acceptable form, *"Trello X"* is not. The Design Guidelines separately constrain reuse of Trello's own UI elements.

**Correction:** the name is not an M5 packaging detail. It leaks into the repo name, the domain, the iframe connector URL, the settings copy and the strings file. Pick it at M1.

### F5. Privacy policy is missing from the plan entirely

Reading board data via the client library on behalf of the logged-in member is fine — no scraping, no third-party data. But the moment Path B (REST) or any server-side component exists, you need an API key registered to a Trello account **and a published privacy policy**. The plan mentions neither.

**Correction:** add "privacy policy page" to M5, and flag it as mandatory-on-Path-B in §2.1's cost list.

---

## B. Milestones, sequencing, and outright omissions

### F6. There is no dev-loop story at all — the single biggest gap in §3

M0 says "dev Power-Up registered" as if that were free. Reality: you need a Workspace you are admin of; you register at `trello.com/apps/admin`; the iframe connector URL **must be HTTPS** — localhost is explicitly unsupported; you enable capabilities in the admin Capabilities tab; then the Power-Up appears under the board's Power-Ups → **Custom** tab. Every code change must reach a public HTTPS URL before Trello can see it.

**Correction:** split M0 into **M0a — dev environment** (a tunnel such as cloudflared/ngrok, or a preview deploy; register **two** Power-Ups from day one, `…-dev` and `…-prod`, so you are not repointing one URL back and forth) and **M0b — the data spike**. Also move *"connector iframe is served with a short cache TTL and no frame-blocking headers"* into M0's acceptance list: a Netlify/Vercel security-header preset sending `X-Frame-Options: DENY` breaks a Power-Up **silently**, and that should surface on day one, not day thirty.

### F7. Missing capability: `remove-data`

The plan noticed the vendor's **"Remove personal settings"** button (§1.3) but never connected it to Trello's `remove-data` capability, which fires when a user confirms removal and gives roughly **500ms** to act (call `t.getAll()` first if you need the data). §2's capability list — `card-badges`, `show-settings`, `on-enable` — is incomplete.

**Correction:** add `remove-data` to §2 and a task to M3. On Path B this is where the REST token gets revoked, and it stops being optional.

### F8. Settings schema, scope, visibility and size budget get four words

M3 says "defaults/migration"; §2 never defines the blob. Concretely: `t.set` is capped at **4096 characters per scope/visibility pair for card and member scope, 8192 for board and organization**. Permissions matter too: a member who can read but not write a board **can** set `private` data at any scope but **cannot** set `shared` data — which determines whether a read-only board member can configure this at all.

**Correction:** add a "Settings model" subsection fixing scope (member, per A6), visibility, key name, JSON schema with a `v` version field, a `migrate(blob)` contract, a rule for unknown fields, and a **test asserting the serialized blob stays under 4096 characters at maximum configuration**. Decide this now, not at M3.

### F9. i18n is absent, and retrofitting it means touching every string site

Trello ships a localizer: `TrelloPowerUp.util.initLocalizer`, `t.localizeKey`, `t.localizeNode`, and an `i18n: {defaultLocale, supportedLocales, resourceUrl}` config. Hard-coding English in `badges.ts` and `settings.html` means every string site gets rewritten later.

**Correction:** even shipping English-only, route all user-visible strings through `localizeKey` with a `strings/en.json` from M1. Half a day now; three days later.

### F10. Accessibility is absent — and O2/O3 are exactly why it matters

O2 encodes complete/incomplete **in colour alone**; O3 encodes done/not-done in a **`☑`/`☐` glyph alone**. Screen readers announce those glyphs inconsistently, and badge colour contrast in dark theme is not yours to control. The settings popup is entirely your iframe: label/for pairing, keyboard-operable selects, focus order, and the parent-checkbox-disables-children pattern.

**Correction:** add one concrete rule to M4 — *no state may be conveyed by colour or glyph alone; each badge's text must read correctly with the glyph removed* — plus a keyboard-only pass on the popup.

### F11. The edge-case set is one item long

A4 covers the 0-item checklist. Nothing covers: **card with no checklists at all** (must return `[]`; a badge with empty text renders an empty pill), a card with 40 items (badge explosion — does it clip? does the list scroll? is a hard cap needed independent of the limit dropdown?), very long item titles, emoji/RTL text, an empty checklist name, and `t.card()` rejecting or hanging inside the badge handler (what renders then — nothing, or a stale value?).

**Correction:** add an explicit edge-case matrix to `SPEC.md` and make it M4's acceptance list. Decide a hard badge cap (~30) and define overflow behaviour.

### F12. Free vs Premium: not a blocker, but the plan should say so

The one-Power-Up-per-free-board limit was removed in 2021; Free boards take unlimited Power-Ups. The real difference is **advanced checklists** — per-item due dates and assignees exist on paid plans and appear on checkItems, so identical code sees differently-populated data.

**Correction:** state in `SPEC.md` that the badge ignores item due dates and members (or decide to render them), and require testing on one Free and one Premium board.

### F13. M1 before real data guarantees rework

M1 is billed as *"no Trello needed"*, but its golden tests encode A1–A6, and M2 is the first time real data appears. The fixtures get written, then rewritten.

**Correction:** M0b must dump a real `t.card('checklists')` payload to a committed JSON fixture. M1's golden tests then run against the real shape. This single change removes most of the M1→M2 rework risk and costs nothing.

### F14. M5 "Packaging" hides a lot

Production hosting with correct frame-ancestors behaviour (your pages are framed by trello.com — you must **not** send `X-Frame-Options: DENY`); cache headers (an aggressively cached connector iframe means you cannot ship a fix); and the admin form itself (icon, name, description, author, support email, privacy policy URL).

**Correction:** expand M5 into an explicit checklist, and move the header/cache verification to M0 (see F6).

---

## C. Testability

### F15. Golden tests hit the safest layer and enshrine guesses as facts

`computeBadges` is a pure function over a small tree — the layer least likely to break. Worse, the tests assert **inferences** (A1–A6) as though they were observations: if A1's filtering model is wrong, the suite stays green while the product is wrong.

**Correction:** name each golden test after the *configuration*, not the screenshot, and tag every assertion `Observed` or `Inferred` so a bad assumption is cheap to locate. Add property tests: ordering is stable; output depends only on `(checklists, settings)`; no item survives whose parent checklist was filtered out; badge count never exceeds the cap.

### F16. The honest answer on end-to-end testing: there isn't one

There is no official Power-Up test harness, no headless Trello, and no way to instantiate `t` outside a Trello iframe. The client library is a CDN script with no npm package and no types — any mock is hand-rolled. The three real options:

1. **Playwright against a live Trello account** — genuinely end-to-end, but slow, brittle against Trello's DOM, needs a fixed test board and stored credentials in CI.
2. **A local harness page stubbing `t`** and rendering your badge array into a fake card front — catches wiring and rendering bugs, catches zero integration bugs.
3. **Manual.** For the settings popup, realistically this.

**Correction:** state this plainly in the plan — unit/golden/property tests in CI; **one** Playwright smoke test (board loads, known card shows known badge text) run nightly or manually; a written manual checklist for the popup. Do not imply the popup will be automatically tested.

### F17. Missing test surfaces

Nothing covers dark theme, Trello's table/calendar/inbox views, mobile web, or the iOS/Android apps. Card badges render in the mobile apps with a much tighter layout — "wrap eight badges" looks worst exactly where the plan never looks. There is a prior question too: **does `card-badges` even run in the non-board views?**

**Correction:** add a surface matrix to M4 and state explicitly if mobile is out of scope.

---

## D. The settings UI

### F18. The largest milestone gets one line

What M3 actually involves: the popup iframe's **width is fixed by Trello**; you set height at `t.popup({height})` and correct it with `t.sizeTo()` after render — and you must re-call `sizeTo` on **every reflow**, including toggling a checkbox that reveals the colour dropdowns. Get it wrong and you get permanent scroll or dead space. Note that the original's popup *scrolls* (§1.3 observes a scrollbar and content below the fold) — that is a symptom of exactly this problem, not a design target to copy.

**Correction:** add a "settings popup mechanics" note to §2 covering fixed width, initial height, `sizeTo` on every state change, and the fact that max height is viewport-bounded so long forms scroll regardless. Decide now whether licence/account sections become a **second, stacked popup** — Trello popups stack with a back chevron, and §1.3 already observed that chevron, which suggests the original nests.

### F19. Use Trello's own stylesheet rather than recreating the look

`https://p.trellocdn.com/power-up.min.css` serves (13.6 KB, HTTP 200) and provides Trello's form/button/section classes. Hand-recreating Trello's design is both more work and closer to trade-dress trouble. It is unversioned CDN CSS, so pin nothing and re-test after Trello ships changes.

### F20. Form state is real logic, treated as markup

Seven-plus interdependent controls; sub-controls that are meaningless when their parent is off (what do the two colour pickers mean when "Show checklist title" is off and A2 says no header badge renders at all? Two dead controls); an explicit **Save Settings** button implies dirty-state tracking and a discard path when the user hits the back chevron with unsaved edits.

**Correction:** model it as a pure `deriveFormState(settings) -> {enabled|disabled per control}` and unit-test the disabled-state matrix alongside `computeBadges`. Validation is thin; the enablement matrix is not.

### F21. §2.2 quietly decides the biggest UX question on the user's behalf

The plan recommends shipping option 1 — `t.alert('Settings saved — refresh the board')`. That is a visibly worse product, and there is an unanswered prerequisite: **does `t.set` from the popup iframe propagate to the `card-badges` context at all without a reload?** Note also that `refresh` on dynamic badges has a **10-second minimum floor**, and the docs say to use dynamic badges only when data changes *outside* Trello — option 2 works against the grain of the API.

**Correction:** this is a product decision for the user (see Section H) and a M0 spike question. Cheap to answer, and it is the difference between M3 being one day or four.

---

## E. Product justification after Trello's April 2026 native checklist preview

This is the finding that outranks everything above.

**What Trello shipped (late April 2026, all plans):** click the checklist progress bar on the card front and the items expand inline. Completed items are hidden while expanded. Due dates render as a clock icon with hover. Click again to collapse. **And — a detail the brief omits — you can tick items off directly from the card front.** That last point is decisive: `card-badges` returns text/icon/colour only. A Power-Up badge is inert. It cannot be clicked, and no amount of engineering changes that.

### Now redundant — do not build

1. **"Show All Checklists and Items."** This is precisely what native does, natively, free, on every plan, laid out properly, and **interactively**. A badge-row reimplementation (pills wrapping in a cramped row, per O4) is a strictly worse version of a built-in feature. Building it is the single clearest waste in the plan.
2. **"Show All Incomplete Items."** Native hides completed items on expand, so the native default *is* this configuration. Redundant.
3. **The headline value proposition** — *"See checklist status without opening the card"* (§1.1) — is no longer differentiated. That sentence sold the original in 2021. It does not sell anything in September 2026.
4. **M4's "match the screenshots" exercise.** Those screenshots document a pre-April-2026 product whose core premise the platform has since partly absorbed. Chasing them is chasing a target that moved.
5. **Paid tiers (§4, Q1).** The commercial case materially worsened in April 2026. Anyone building this to sell should know the platform just ate a chunk of the category.

### Still worth building — and it is narrower than the plan assumes

1. **Always-on, zero-click visibility.** Native requires a click per card, on every card, with no documented persistence and no expand-all. If the real job is scanning a 60-card board at a glance, native does not do that job. This is the one genuinely defensible remaining value — and it is the *only* axis on which a badge beats native.
2. **"Show First Incomplete Item."** The single next action per card, always visible, no interaction. Native has no equivalent — its expand shows all incomplete items, and only on demand. **This is the strongest surviving configuration and arguably the whole remaining product.**
3. **"Show Checklists Progress" (header badges only).** Multi-checklist progress, colour-coded, at a glance across a board. Additive to native, though weakly.
4. **Showing completed items.** Native *hides* them on expand. If someone wants to see what is done without opening the card, native cannot. Niche but real.
5. **Per-user persistent configuration.** Native has no settings at all.

### Concrete correction to the plan

Rescope from "clone the Power-Up" to **a card-front next-action strip**: per card, always visible, first N incomplete items and/or per-checklist progress, configured once per user, no clicking. Consequences:

- Drop "Show all complete items" and probably the complete-colour picker from the settings surface. **M3 and M4 roughly halve.**
- F11's badge-cap problem largely evaporates — you are capping at 1–3 items by design, not by defence.
- The `SPEC.md` framing changes from *"reproduce four marketing configurations"* to *"two configurations that native Trello does not cover."* That is a better spec and a much smaller one.
- It also improves the Section A position: you are no longer reproducing a competitor's feature set, you are building the residual it no longer uniquely owns.

**Two things to verify before committing to this rescope** (both cheap, both blocking):

- **Confirm the native behaviour yourself on a real board.** The announcement and the brief disagree on interactivity, and interactivity is exactly what a Power-Up cannot match. 15 minutes.
- **Check how native expansion and Power-Up badges coexist on one card front.** Does an expanded checklist push your badges down? Does the card become unusably tall? Does the board layout survive? Enable any badge Power-Up, expand a native checklist, look. 30 minutes. If they collide badly, even the narrow surviving product is in trouble.

---

## F. Effort estimate (absent from the plan entirely)

One competent TypeScript developer who has **not** built a Power-Up before. Ideal days.

### As the plan is currently written

| Milestone | Est. | Note |
|---|---|---|
| M0a dev env + M0b spikes | **2–3d** | Docs make it look like two hours. The first postMessage handshake eats a day. |
| M1 SPEC + computeBadges + golden tests | **2d** | Genuinely small — a pure function over a small tree. |
| M2 connector + card-badges wiring | **2d** Path A / **6–7d** Path B | Path B adds API key, authorize.html, token storage, `authorization-status` + `show-authorization`, rate-limit-aware caching, unauthorized badge state. |
| M3 settings popup + persistence + migration + remove-data | **5–7d** | See below. |
| M4 polish, edge cases, dark theme, a11y, surfaces | **4–6d** | Unbounded if you keep comparing to screenshots. |
| M5 packaging, hosting, privacy policy, README, admin fields | **2d** | |

**Total ≈ 17–22 ideal days (Path A), 22–27 (Path B)** — 5–7 calendar weeks at part-time pace.

### Under the Section E rescope

M1 ≈ 1d, M3 ≈ 3d, M4 ≈ 2–3d. **Total ≈ 10–13 ideal days on Path A.**

### Most likely to blow up

**M3**, and the cause is not the form — it is §2.2/F21. If settings changes do not propagate to `card-badges` without a board reload, you either ship the alert (and the product feels broken) or you build the dynamic-badge-pool design, which touches every badge, needs per-card memoisation, and fights a 10-second refresh floor.

**Second: M4**, because "matches screenshots" has no stopping condition. Give it one. The Section E rescope supplies that stopping condition for free.

---

## G. The five unknowns that most threaten the plan

| # | Unknown | Cheapest experiment | Cost | Decides |
|---|---|---|---|---|
| **U1** | Does `t.card('checklists')` return full checkItems inside a `card-badges` handler, for every card on a loaded board, without auth? | One Power-Up returning `[{text: String(checklists.length)}]` on a 60-card board with checklists on 50 | ½ day | Path A vs Path B: ±5 days |
| **U2** | Does `t.set` from the popup cause `card-badges` to re-run — and if not, does anything short of a full page reload? | Same board: save a setting, watch | 2h | Whether M3 is 1 day or 4 |
| **U3** | Does the native April-2026 checklist expansion collide with Power-Up badges on the same card front? | Enable any badge Power-Up, expand a native checklist, look | 30m | Whether the surviving product (Section E) is viable at all |
| **U4** | How many badges before Trello clips, the list breaks, or mobile falls apart? | Return 40 synthetic badges on one card; check desktop web, mobile web, iOS | 2h | Whether "all" is shippable, and the cap value |
| **U5** | Has the person doing the work ever accepted ADF TECH's EULA? | Ask | 2m | Whether a contractual overhang exists that clean-room practice does not address |

**U6, honourable mention:** several open-source "checklist on card front" Power-Ups already exist, and native Trello now covers part of the job. Thirty minutes of searching may make the plan unnecessary or supply a permissively-licensed base. The plan never considers *not building it* — a gap in a document whose premise is "reimplement a $1.99/mo product."

---

## H. The three open questions are the wrong three

- **Q1 licensing** — keep, but reframe. It is not "skip or build". Billing implies a Marketplace listing, which implies Atlassian approval, naming/trademark review, a privacy policy, and a payment integration. It roughly doubles the project. Ask instead: *"is this for you and your team, or a product you intend to sell?"* — one answer cascades into roughly eight downstream decisions. And per Section E, the "sell it" branch is now much weaker than it was in 2021.
- **Q2 hosting** — **do not ask.** Recommend Cloudflare Pages or Netlify and move on. Reversible in an hour; asking spends the user's attention on the cheapest decision in the plan.
- **Q3 settings scope** — **do not ask as posed.** The listing says "per user settings" and Trello's storage model answers it: member scope. Ask the sharper fork instead: *"should a board admin set a board-wide default that members inherit?"* — that changes the storage model, the permission story, and the popup.

### Questions to add

1. **Have you ever installed or used the original Power-Up?** (U5 — legal, and the only genuinely blocking question.)
2. **Given Trello's native card-front checklist preview, is the always-on/no-click behaviour actually the thing you want — or were you after the native feature and did not know it existed?** (Section E. This may end the project in one sentence, which is worth finding out on day zero.)
3. **Is live update on settings-change a requirement, or is "save, then refresh the board" acceptable?** (The largest single effort swing, currently decided for the user in a parenthetical.)
4. **Must this work on the Trello mobile apps?** (Changes M4 and possibly the badge-count design.)
5. **What name ships on this?** (Needed at M1 — repo, domain, iframe URL, strings.)
6. **Willing to run one Playwright test against a real Trello account, credentials stored in CI?** (Decides whether any E2E exists at all.)

---

## I. Prioritised changes to the plan

1. **Add Section E's reassessment and rescope the product before anything else.** Trello absorbed the headline feature in April 2026. Every estimate, milestone and spec section below this point is downstream of that decision. Verify the native behaviour (15m) and the badge-collision question U3 (30m) first.
2. **Add the EULA question to §0 and make it blocking** (F2, U5). Everything else is schedule; this is exposure.
3. **Rewrite M4's goal from "pixel-for-intent" to "functionally equivalent", add §0.1 "what we deliberately do not copy", and reword the verbatim labels in §1.3** (F3, F4).
4. **Split M0 into dev-environment and spike, and fold U2, U3 and U4 into it** (F6, F21). Four cheap experiments on day one that collectively swing roughly ten days.
5. **Make M0b dump a real payload to a committed fixture so M1's tests are not built on invented shapes** (F13).
6. **Expand M3 into a real milestone:** popup mechanics (`sizeTo` on every reflow, fixed width, stacked popups), `p.trellocdn.com/power-up.min.css`, form-state derivation as a tested pure function, dirty-state/discard, `remove-data`, and the settings schema with `v`, migration, scope/visibility and the 4096-character budget (F7, F8, F18, F19, F20).
7. **Replace "golden tests reproducing each marketing screenshot" with the honest three-tier testing section**, plus Observed/Inferred tags on assertions (F15, F16).
8. **Add estimates and name M3 as the blow-up risk** (Section F). A plan with no numbers cannot be traded off.
9. **Add i18n routing from M1, the a11y rule to M4, the edge-case matrix to `SPEC.md`, and the Free/Premium note** (F9, F10, F11, F12).
10. **Replace §5's three questions with the six in Section H, and stop asking about hosting.**
11. **Add a "do we need to build this at all?" check** — 30 minutes against existing open-source Power-Ups and the native feature (U6).

---

## Sources

- [Atlassian Developer Terms](https://developer.atlassian.com/market/atlassian-developer-terms)
- [Marketplace app listing principles](https://developer.atlassian.com/platform/marketplace/marketplace-app-listing-principles/)
- [ADF TECH End User License Agreement](https://adftech.net/eula)
- [Getting and Setting Data (t.set limits, scope/visibility)](https://developer.atlassian.com/cloud/trello/power-ups/client-library/getting-and-setting-data/)
- [Update t.set() Data Size Limits](https://community.developer.atlassian.com/t/update-t-set-data-size-limits/32879)
- [Popup UI function](https://developer.atlassian.com/cloud/trello/power-ups/ui-functions/popup/)
- [t.sizeTo](https://developer.atlassian.com/cloud/trello/power-ups/ui-functions/t-sizeto/)
- [Building a Power-Up: Part One (registration, HTTPS)](https://developer.atlassian.com/cloud/trello/guides/power-ups/building-a-power-up-part-one/)
- [Localization](https://developer.atlassian.com/cloud/trello/power-ups/client-library/localization/)
- [You can now preview checklists without opening a card (Trello, April 2026)](https://trello.substack.com/p/you-can-now-preview-checklists-without)
- [See checklist items on the front of your Trello cards (Atlassian Community)](https://community.atlassian.com/forums/Trello-articles/Checklists-Now-appearing-on-the-front-of-your-cards/ba-p/3227768)
