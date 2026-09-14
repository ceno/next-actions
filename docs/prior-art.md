# Prior art — is Next Actions worth building?

Timeboxed search, 2026-09-14, per `PLAN.md §7` and handover §1.
Scope of the search: existing open-source card-front checklist Power-Ups, plus a sweep of the
commercial listings that occupy the same slot.

**The vendor's own Power-Up was not visited, searched for, or fetched.** It appears as a URL in some
search-result listings below the fold of what I read; I did not open it. Nothing in this document is
derived from it.

---

## Verdict first

**Build it. The project is not redundant — but its surviving scope is narrower than `PLAN.md §1.2`
already made it, and the competitive slot is crowded enough that "private install" should stay the
plan.**

Nothing open-source found does the job. Nothing open-source found does even a third of the job. The
commercial field is busy but, as far as public listing copy shows, uniformly stops at *aggregate
progress badges* — nobody visibly renders **checklist item text** on the card front, which is the
product's remaining point (`PLAN.md §1.2`, differentiators 4 and 5 in `platform.md` finding 14).

The one genuinely valuable find is **technical, not competitive**: a working Power-Up in the wild
reads checklist completion counts inside `card-badges` from a field the plan never considers. See
"The actual find" below. It does not rescue the product — it cannot supply item text — but it changes
the unauthorised/degraded state of Path B from "nothing" to "the progress pill still works", and it
deserves an experiment slot.

---

## 1. Open-source prior art

Searched: GitHub repository search API (`trello powerup checklist`, `trello power-up card-badges`),
plus web search across github.com / gitlab.com / codeberg.org. Five repositories total match
`trello powerup checklist` on GitHub — the entire visible open-source field is that small.

| Project | What it is | Licence | Covers our job? |
|---|---|---|---|
| [hellboy89/trello-checklist-powerup](https://github.com/hellboy89/trello-checklist-powerup) | A real `card-badges` Power-Up. One card-level badge: `✅ TUDO FEITO!` / `⚠️ N PENDENTES` / `🚨 NADA MARCADO!`, coloured green/yellow/red by percent-complete thresholds. ~60 lines in a single `index.html`. Created and last pushed 23 Apr 2026. 1 star. | README says MIT; **there is no LICENCE file in the repo**, so the grant is asserted but not executed. Treat as unlicensed until the author adds one. | **No.** One aggregate badge per card. No per-checklist pill, no item text, no settings, no filtering, no ordering model. It is roughly 5% of the spec — and the 5% that native Trello's `☑ 3/5` badge already covers. |
| [DCMax87/checklisthub](https://github.com/DCMax87/checklisthub) | Cross-board checklist aggregator — consolidates items from every accessible board into a filterable list and calendar. Capabilities are `board-buttons` + `show-settings`. | None declared (all rights reserved). | **No.** Not a card-front product at all. Different shape of tool. Useful only as corroboration that a serious checklist Power-Up goes to REST for its data. |
| [Cycododge/Progress-For-Trello](https://github.com/Cycododge/Progress-For-Trello) | Chrome extension that injects code into the Trello page to compute card/checklist completion percentages. | None declared. **Archived read-only 3 Dec 2023.** | **No.** Not a Power-Up. DOM injection is a different (and more fragile, and ToS-adjacent) mechanism than `card-badges`. |
| [ceegees/trello_list_progressbar](https://github.com/ceegees/trello_list_progressbar), [TK009's gist](https://gist.github.com/TK009/552d42ea675d60bba026da58496e2580) | Userscript/CSS progress bars drawn over Trello's DOM. | Unclear / gist. | **No.** Same category as above. |
| [CampbellMG/Trello-Powerups](https://github.com/CampbellMG/Trello-Powerups) | "Sums & Merge Checklists" — checklist *manipulation*, not card-front display. | MIT | **No**, but it is the only MIT-licensed, actually-maintained Trello Power-Up code in this field. Worth a look as a reference for project layout only. |
| [optro-cloud/trello-powerup-full-sample](https://github.com/optro-cloud/trello-powerup-full-sample), [trello-archive/power-up-template](https://github.com/trello/power-up-template) | Scaffolds/templates implementing every capability, TypeScript + React (optro) or static JS (Atlassian's, now archived). | Check before use — optro's is the live one; Atlassian's is archived. | **Not prior art, but useful.** If the Vite scaffold in `PLAN.md §2` fights us, optro's sample is the reference implementation for capability wiring. We do not need its React dependency. |

**Conclusion: there is no open-source base to fork, extend, or be made redundant by.** The field is
five repos deep and none of them renders a checklist item's text on a card front.

## 2. Commercial prior art

From marketplace search-result copy only. Trello's marketplace pages are a client-rendered SPA and do
not fetch, so **every claim here is marketing copy, unverified, and none was installed.** Listed
because "is this slot crowded?" is a real input to the build/don't-build call.

| Listing | Claimed behaviour |
|---|---|
| Completeness Badge (Kryl Solutions) | Checklist-progress badge with partial per-checklist progress, custom badge colours, auto-applied labels at thresholds, board/list statistics and trend charts. |
| Smart Card Indicators | Rule-configurable custom badges on card fronts, driven by configurable conditions rather than checklists specifically. |
| Checklist Progress Bar | A progress bar for checklist completion. |
| Show fields on card front (Tiny Power-Ups Club) | Renders selected field values on the card front — the generic form of this idea. |
| Card Progress (Track Time and Progress — Free) | Time and progress tracking with card-front display. |

Reading: the **aggregate progress badge** slot is saturated — at least four products plus Trello's own
native `☑ n/m`. No listing copy claims to render **individual checklist item text** on the card front.
That absence is consistent with `platform.md` finding 14's differentiator list, and it is where the
remaining value sits. It is *not* proof nobody does it; nobody advertises it.

Commercial consequence, unchanged from `PLAN.md §5`: this is a private install. Building a *paid*
product into this slot would mean competing on a feature Trello ships free with four incumbents
already there. Not our problem tonight — but do not let the scope drift toward a marketplace listing.

## 3. The actual find — a third data path the plan does not have

`hellboy89/trello-checklist-powerup` does not call `t.card('checklists')`. It calls:

```
t.card('badges')  →  card.badges.checkItems, card.badges.checkItemsChecked
```

with an in-code comment (translated) asserting *"uses card.badges, which is always available for ALL
cards."* Card-level aggregate counts, not per-checklist and not per-item.

**Why this is credible, and why it matters.** Atlassian staff's 2020 explanation of why
`t.card('checklists')` fails (platform review finding 1) is that the web client caches only what
*board-level rendering* needs. The native `☑ 3/5` badge **is** board-level rendering — so its two
counts must be in that cache by construction. The same argument that kills Path A predicts this path
works. `badges` is a documented field of `t.card()`
(https://developer.atlassian.com/cloud/trello/power-ups/client-library/accessing-trello-data/);
its sub-fields are undocumented there, but `badges.checkItems` / `badges.checkItemsChecked` are the
documented REST card shape.

**What it cannot do:** no checklist names, no per-checklist split, no item text, no item states. So it
delivers none of `PLAN.md §1.2` points 2 and 3, and only a *card-level* version of point 1. It is not
an alternative to Path B.

**What it is good for:** the degraded state. Path B's first run, an unauthorised user, a revoked
token, or a REST failure currently renders nothing. With this, those states can still render one
honest aggregate pill with zero auth. Recorded in `SPEC.md` as **Path C**, off by default, and added
as experiment **E7**.

**This is a lead, not a fact.** It rests on one unstarred repo's code comment plus a structural
argument. Nobody has run it cold. Do not implement against it beyond the adapter seam until E7 runs.

## 4. What this does not change

- Path A is still expected dead. Nothing here contradicts platform review finding 1.
- Native Trello's April 2026 card-front expansion is still the biggest scope constraint. Nothing found
  gives an "expand by default" hook; the always-on, zero-click property remains the moat.
- A1–A7 remain unresolved. No prior-art code answers them — hellboy89's has no ordering or filtering
  model to inspect, and the aggregate-only approach sidesteps every question A1–A3 ask.

## 5. Sources

- https://github.com/hellboy89/trello-checklist-powerup
- https://github.com/DCMax87/checklisthub
- https://github.com/Cycododge/Progress-For-Trello
- https://github.com/CampbellMG/Trello-Powerups
- https://github.com/optro-cloud/trello-powerup-full-sample
- https://github.com/trello/power-up-template
- https://github.com/ceegees/trello_list_progressbar
- https://gist.github.com/TK009/552d42ea675d60bba026da58496e2580
- https://developer.atlassian.com/cloud/trello/power-ups/client-library/accessing-trello-data/
- https://developer.atlassian.com/cloud/trello/power-ups/capabilities/card-badges/
