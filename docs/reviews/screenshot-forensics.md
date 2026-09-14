# Adversarial review of PLAN-draft1.md §1 — pixel forensics

Reviewer angle: pixel-level forensics on the marketing screenshots and GIF frames.
Target: `/private/tmp/claude-501/-Users-jorgeazevedo-code-ceno-trello-checklists/c8a3b21a-a126-4f6e-b22b-c3d0a5c26b9a/scratchpad/PLAN-draft1.md`
Artefacts: `…/scratchpad/shots/` (5 × 1600×1200 marketing PNGs) and `…/scratchpad/shots/frames/` (GIF frames, 1400×903 upscales).

Method: every image read directly; measurements via `python3` + PIL — dark-pixel row/column segmentation for layout,
dominant-colour histograms for fills, darkest-3% averaging for text colour, nearest-neighbour 10× zoom for glyphs.

---

## 1. §1.3 indents three rows that are not indented

**Plan says:** `Complete color:` / `Incomplete color:` are shown indented under `[x] Show checklist title`, and
`[number of items v]` indented under `[x] Show checklist progress`.

**Image shows:** dark-pixel row segmentation over the settings panel of `big-ShowAllChecklistsAndItems-white.png`
(panel borders x=922…1554, content box x=950…1466):

```
y  410- 435  x_left=1126   "Front of the card"                 (CENTRED)
y  463- 500  x_left= 950   Show all complete checklists
y  518- 562  x_left= 950   Show [all v] incomplete checklist(s)
y  580- 613  x_left= 950   Show checklist title
y  634- 678  x_left= 952   Complete color:   [green v]
y  694- 736  x_left= 953   Incomplete color: [orange v]
y  756- 792  x_left= 950   Show checklist progress
y  810- 852  x_left= 950   [number of items v]
y  876- 908  x_left= 952   "Checklist item options"            (LEFT-ALIGNED)
y  914- 950  x_left= 950   Show all complete items
y  969-1012  x_left= 950   Show [all v] incomplete item(s)
y 1061-1130  x_left= 950   Save Settings
```

Every content row starts at x = 950 ± 3. **Nothing is indented.** The ±3 is glyph side-bearing, not indentation.

**Why it matters:** indentation implies a parent/child dependency (disable the child when the parent is off).
No such nesting exists. In particular the two colour selects are *not* children of "Show checklist title" —
they colour the badge, and nothing in any image ties them to the title toggle.

**Correction:** flatten those three rows to the same level as every other row in §1.3, and remove any implied
enable/disable dependency between them and the checkbox above.

---

## 2. The two section headers are styled differently, and the plan flattens that too

**Plan says:** treats `Front of the card` and `Checklist item options` as equivalent section headers.

**Image shows:** `Front of the card` spans x 1126–1349 inside a 950–1466 content box — **centred**.
`Checklist item options` spans x 952–1250 — **left-aligned**. The gap below `Checklist item options`
is 6px (y908 → y914) versus 44–56px between every other pair of rows: it is a tight subheading bound
to the checkbox beneath it.

**Why it matters:** milestone 3 is "the panel from the screenshots". These are the details that decide
whether it matches.

**Correction:** record in §1.3 that `Front of the card` is a centred heading and `Checklist item options`
is a left-aligned tight subheading (≈3 CSS px gap to the row below).

---

## 3. "More content below Save Settings" is fabricated — the panel is fully visible

**Plan says:** *"The popup has a scrollbar and more content below `Save Settings` that is not visible in any
screenshot"*, then places **Remove personal settings**, **Authorize account** and a **licence section** below the fold.

**Image shows:** scrollbar thumb (#C1C1C1, x 1529–1539) measured against the scroll area in all five settings shots:

| screenshot | thumb y-range | thumb h | scroll area h | visible |
|---|---|---|---|---|
| big-ShowAllChecklistsAndItems | 408–1166 | 759 | ~778 | 97.6% |
| big-FlexibleSettings          | 410–1168 | 759 | ~778 | 97.6% |
| big-ShowAllIncompleteItems    | 404–1160 | 757 | ~778 | 97.3% |
| big-ShowFirstIncompleteItem   | 408–1163 | 756 | ~778 | 97.2% |
| big-ShowChecklistsProgress    | 402–1165 | 764 | ~778 | 98.2% |

A 97–98% thumb means roughly **10–12 CSS px hidden** — bottom padding. A nearest-neighbour zoom of the bar
(crop x1510–1560, y370–1180) shows one solid grey bar running from just under the header divider to the
panel's bottom edge, with no lighter track visible above or below it.

**Why it matters:** the plan is inventing UI. Those three vendor-doc controls live somewhere else.
Corroborating evidence: the popup carries a **back chevron**, which in Trello's popup stack only appears when
the popup was pushed from a parent popup. So a parent menu exists (board button / power-up menu) and the plan
has not modelled it at all.

**Correction:** delete the "below the fold" paragraph in §1.3. Replace with: "the Settings popup is fully
visible and ends at Save Settings; the back chevron implies a parent popup, which is where the vendor's
Remove-personal-settings / Authorize-account / licence controls must live. That parent popup appears in no artefact."

---

## 4. O5 ("order is checklist position, then item position") is not established by any image

**Plan says:** O5 is listed in the **facts** table with source "all shots".

**Image shows:** in every artefact the complete checklist comes first and complete items precede incomplete ones:

- `big-ShowAllChecklistsAndItems`: `2/2 Place to stay` (complete) → `1/3 Transport` (incomplete);
  within Transport: `☑ Book taxi to airport` → `☐ Book car at destination airport` → `☐ Book City Tour`.
- f001 `Project meeting`: all three items complete. `Team lunch` / `Birthday`: all items incomplete.
- `big-ShowChecklistsProgress` (both cards): `Place to stay` then `Transport`.

There is **not one instance** of an incomplete checklist before a complete one, or an incomplete item before a
complete one. "Position order" and "complete-first grouping" fit the pixels identically. The settings panel
itself is ordered *complete checklists → incomplete checklists* and *complete items → incomplete items*,
which actively hints at grouping.

**Why it matters:** this is the ordering rule `computeBadges` implements. Getting it backwards is invisible in
the golden tests (which are built from these same screenshots) and wrong on every real board.

**Correction:** demote O5 from §1.2's facts table into §1.4 as an assumption. Add the disambiguating experiment
to the milestone-0 spike: one checklist whose first item is unchecked and second is checked, plus a board where
an incomplete checklist precedes a complete one.

---

## 5. O8 ("hiding complete checklists hides their items too") is not established either — and A1 rests on it

**Plan says:** O8 is a fact sourced to `ShowAllIncompleteItems`; A1 states "checklist visibility gates its items
(supports O8)".

**Image shows:** in that screenshot **two** settings were flipped off simultaneously — `Show all complete checklists`
**and** `Show all complete items`. Rendered output is `1/3 Transport` + `☐ Book car at destination airport` +
`☐ Book City Tour`. Every hidden element is independently explained by the item-level filter alone:

- `Select location`, `Book Hotel` — complete items → hidden by "Show all complete items" being off.
- `Book taxi to airport` — a **complete item inside an incomplete checklist** → hidden by that same toggle.

Nothing in the image requires checklist-level gating of items.

**Why it matters:** A1 is described as "the filtering model" and is the core of the product. Half of it is
unsupported by evidence.

**Correction:** move O8 into §1.4 as an assumption. Distinguishing experiment: complete checklist hidden while
`Show all complete items` is **on** — do that checklist's completed items still render?

---

## 6. O9 conflates two independent limits, only one of which is exercised

**Plan says:** *"O9 Limit dropdown `all | 1 | …` truncates to the first N (by position)"* — one line covering both dropdowns.

**Image shows (`big-ShowFirstIncompleteItem`):** both dropdowns read `1`. The card has exactly **one** incomplete
checklist (Transport), so the *checklist* limit of 1 is a no-op in that screenshot and is never actually exercised.
Only the *item* limit is demonstrated (2 incomplete items → 1 rendered, and it is the first by order).

Additionally the item limit's **scope is undetermined**: with only one visible checklist you cannot tell whether
"show 1 incomplete item" means 1 per checklist or 1 per card.

**Why it matters:** per-checklist vs per-card is a visible behavioural fork on any multi-checklist card, and it
is the headline use case ("Quickly select next item to work on").

**Correction:** split O9 into (a) demonstrated — the item limit truncates incomplete items, first-by-order;
(b) undemonstrated — the checklist limit; (c) open question — per-checklist or per-card item cap.
Also delete A5 ("offers `all, 1..10`") or mark it invention: the only observed values are `all` and `1`.

---

## 7. Pill colours: measured hexes vs Trello's badge palette

**Plan says:** O2, plus "Trello's badge palette is `blue green orange red yellow purple pink sky lime light-gray`".
The open concern raised by the reviewer brief: are these real Trello badge colours or custom CSS?

**Image shows:** dominant-pixel sampling of every pill:

| pill | source | measured hex |
|---|---|---|
| `2/2 Place to stay` | big-ShowAllChecklistsAndItems | **#61BD4F** |
| `1/3 Transport` | big-ShowAllChecklistsAndItems | **#FF9F1A** |
| `3/3 Checklist` (power-up) | frames/big-f001 | **#61BD4F** |
| `2/2 Place to stay` (power-up) | frames/big-f001 | **#61BD4F** |
| `☑ 3/3` — **native Trello badge** | frames/big-f001 | **#61BD4F** |
| `0/3 Checklist`, `0/2 Checklist`, `1/3 Transport` | frames/big-f001 | **#FF9F1A** |
| `Save Settings` button | big-ShowAllChecklistsAndItems | **#5AAC44** |
| settings checkbox accent | big-ShowAllChecklistsAndItems | **#0075FF** |

Two things follow. First, the **native** green badge and the **power-up** green badge are byte-identical
(#61BD4F). Second, badge geometry is identical too — in f001 every badge, native and power-up, is exactly
**37 px tall**: native `☑ 3/3` y261–297, `3/3 Checklist` y261–297, `2/2 Place to stay` y261–297,
`0/2 Checklist` y512–548, `1/3 Transport` y354–390.

**Verdict: these are genuine Trello `card-badges` with `color: 'green' | 'orange'`, not custom CSS.**
Path A's assumption about the rendering mechanism is sound.

**But:** #61BD4F / #FF9F1A / #5AAC44 are the **pre-2021 Trello palette** (legacy green, legacy orange, legacy
primary-button green). Combined with the old board header chrome visible in the frames
("Boards / prod Free / Team Visible / Invite"), the screenshots are years old. Today's Trello renders the same
colour *names* at different hexes.

**Correction:** add the measured hexes to §1.2 as evidence that the badges are native. Then fix milestone 4:
*"matches screenshots pixel-for-intent"* is an unachievable target. Match the Trello badge **colour names**;
state explicitly that the screenshots show legacy Trello chrome that will not reproduce today.

---

## 8. The native checklist badge turns green at 100% — the plan never says so

**Plan says:** O6 "Native Trello `☑ 3/5` badge is untouched"; O11 with the power-up off "only native badges remain".

**Image shows:** f001 `Project meeting` has the **native** `☑ 3/3` on a **green #61BD4F** pill, immediately left of
the power-up's green `3/3 Checklist`. In **f033, with the power-up OFF**, `Project meeting` still shows the green
native `☑ 3/3`, while `Team lunch ☑ 0/3`, `Birthday ☑ 0/2` and `Summer Holiday ☑ 3/5` are all plain grey.

**Why it matters:** both statements are true but incomplete. Anyone reading §1.2 sees two adjacent green pills on
`Project meeting` and attributes both to the power-up; a golden test or visual diff would then encode a badge
the power-up never emits.

**Correction:** extend O6 — "the native checklist badge is grey normally and green when all checklist items on the
card are complete; this is Trello behaviour, not the power-up's."

---

## 9. §1.2 uses the same `☑` glyph for the native badge and for item badges — they are different renderings

**Plan says:** §1.2's ASCII renders the native badge as `☑ 3/5` and item badges as `☑ Select location`.

**Image shows:** at 12× nearest-neighbour zoom of f001, the native badge icon is a **heavy stroked SVG checkbox
whose tick overflows the box at the top-right**. The power-up's item glyph is a **thin text glyph of the same
weight, size and colour as the label beside it, with the tick fully contained inside the box.** Different families.

**Why it matters:** §1.2's ASCII is the input for the golden tests. Using one glyph for two different things
invites encoding the native badge's icon into a power-up badge string.

**Correction:** in §1.2 render the native badge distinctly (e.g. `[✓] 3/5`) and reserve `☑` / `☐` for power-up
item badges only.

---

## 10. Checkbox glyph verdict: unicode text characters, not bitmap icons

**Plan says:** O3 uses `☑` for done and `☐` for not done.

**Image shows:** at 10× zoom of `big-ShowAllChecklistsAndItems` —
unchecked = a plain hollow square, uniform thin strokes, slight antialiasing at the corners;
checked = the same square at the same stroke weight with a tick inside. Both are the same colour as the label
text beside them (see finding 11), both scale with the label, both share the label's antialiasing profile.

**Verdict: these are unicode text glyphs rendered in the page font — U+2610 BALLOT BOX and
U+2611 BALLOT BOX WITH CHECK — not bitmap or SVG icons. The plan's `☑` / `☐` choice is correct,
and the two glyphs are from the same family.**

**Caveat the plan should record:** U+2611 renders very inconsistently across platforms — some font stacks
emoji-ify it, Segoe UI Symbol draws it much heavier than the surrounding text. That is a real cross-platform
risk for a badge string and it appears nowhere in the plan.

**Correction:** keep `☑` / `☐`, add a note under O3 about per-platform glyph variance and the need to verify
on Windows and on mobile Trello.

---

## 11. Completed items get no strikethrough and no dimming

**Plan says:** O3, "item badges are uncoloured (plain text)" — silent on whether done items are styled differently.

**Image shows:** darkest-3% text sampling on f001:

| element | colour |
|---|---|
| `☑ Select location` (complete) | #657187 |
| `☐ Book car at destination airport` (incomplete) | #6F7A90 |
| native `3/5` badge text | #7D899C |
| card title `Summer Holiday` | #233555 |

Complete and incomplete item badges sit in the same Trello badge grey (#5E6C84 family). No strikethrough,
no opacity change, no weight change.

**Why it matters:** without this stated, milestone 4 "polish" will helpfully add a done-style the original
does not have.

**Correction:** add to O3 — "completed and incomplete item badges are styled identically; no strikethrough, no dimming."

---

## 12. f001 / f033 card-by-card enumeration — rules the plan never extracted

**f001 (power-up ON), left to right:**

- **To Do / Team lunch** — badges in order: due-date `🕐 19 Dec`, native `☑ 0/3`, then orange `0/3 Checklist`.
  Items: `☐ Agree date /time`, `☐ Send menu selection to the team`, `☐ Book table`.
- **To Do / Birthday** — native `☑ 0/2`, orange `0/2 Checklist`. Items `☐ Buy decorations`, `☐ Prepare music playlist`.
- **Working On / Summer Holiday** — as in the marketing shot.
- **Done / Project meeting** — native **green** `☑ 3/3`, green `3/3 Checklist`, `☑ Send invites` (same row),
  then `☑ Prepare and publish agenda`, `☑ Publish meeting notes`.

**f033 (power-up OFF):** `Team lunch 🕐 19 Dec ☑ 0/3`, `Birthday ☑ 0/2`, `Summer Holiday ☑ 3/5`,
`Project meeting` green `☑ 3/3`. Captions: "Checklists visible" / "Checklists not visible".

Rules the plan missed:

**(a) A checklist literally named "Checklist" is not special-cased.** Both `Team lunch` and `Birthday` use
Trello's default checklist name and it is printed verbatim: `0/3 Checklist`, `0/2 Checklist`.
*Why it matters:* a "helpful" implementation would suppress the default name. *Correction:* state that the
title is emitted verbatim regardless of value.

**(b) Power-up badges are appended after ALL native badges, not just after the checklist badge.** `Team lunch`
proves it: due-date badge → native checklist badge → power-up badges. *Why it matters:* §1.2's only worked
example is a card with a single native badge, so the general rule was never actually observed. *Correction:*
state it, cite `Team lunch`.

**(c) A single-checklist card produces a badge that duplicates the native badge verbatim** — `☑ 0/3` immediately
followed by `0/3 Checklist`. The original does not suppress this. *Why it matters:* it is the most obvious
"bug report" a user will file, and it is deliberate original behaviour. *Correction:* record it as observed,
so it is not silently "fixed".

**(d) 0/N renders in the incomplete colour** (`0/3`, `0/2` both orange). *Why it matters:* it is the only
evidence bearing on A4, and it does **not** cover the 0/0 case. *Correction:* note that A4 (0-item checklist)
remains wholly untested by the artefacts.

**(e) Item text is rendered raw** — `Agree date /time` keeps its odd pre-slash space. No trimming, no normalisation.

---

## 13. The wrap model is confirmed as flex-wrap, but the plan never ruled out the alternative

**Plan says:** O4 "Badges flow/wrap: an item can share a row with a header badge".

**Competing model not considered:** "each checklist header badge starts a new line".

**Image shows — model killed:** in `big-ShowAllChecklistsAndItems`, `big-ShowChecklistsProgress` (both cards),
`big-ShowAllIncompleteItems`, `big-ShowFirstIncompleteItem` and f001 `Summer Holiday` / `Project meeting`,
the **first** header badge always sits on line 1 beside the native badges. No line break is forced.

**Every observed wrap is width-explained.** f001 `Summer Holiday`: card white x491–912, content box 501–902,
inter-badge gap 11 px:

| line ends at x | next badge width | x needed | fits in 902? |
|---|---|---|---|
| 808 (`Book Hotel`) | 137 (`1/3 Transport`) | 956 | no → wrap |
| 849 (`Book taxi to airport`) | 298 (`Book car at destination airport`) | 1158 | no → wrap |
| 804 (`Book car…`) | 154 (`Book City Tour`) | 969 | no → wrap |

Same arithmetic holds for `Team lunch`, `Birthday`, `Project meeting` and `big-ShowAllChecklistsAndItems`.

**One near-miss, flagged for honesty:** `big-ShowChecklistsProgress`, top card. Green `2/2 Place to stay` ends
x=485; orange `1/3 Transport` is 183 wide; content box 153–~684 (card white 140–702, scale ≈2.31× calibrated off
the 52 px badge height). 485 + 18 + 183 = **686 vs 684** — overflows by ~3 px, i.e. ~1.3 CSS px. It wrapped, and
by my best measurement it just should have. That is inside measurement error, so it neither confirms nor refutes
on its own; the "first header badge shares line 1" evidence above is what settles it.

**Correction:** make O4 assert the model explicitly — "badges are inline and flow/wrap; a checklist header does
**not** force a line break" — and add confirmation on a real board to the milestone-0 spike, because the
alternative changes the entire badge-emission design (one badge per line vs many).

---

## 14. The settings UI is unstyled native browser chrome — the plan implies a designed panel

**Plan says:** §2 lists `settings.html` with no styling notes; milestone 3 says "the panel from the screenshots";
milestone 4 lists "colour **pickers**".

**Image shows:** checkbox accent **#0075FF** — the browser default, square, not Trello's styled checkbox.
The `all` / `number of items` / `green` / `orange` controls are native `<select>` elements with default
1 px #D3D3D3 borders and the browser's own chevron. Save Settings is **#5AAC44**, Trello's legacy primary green.
Panel outer width x922–1554 = **316 px**, i.e. Trello's standard ~304 px popup content box.

**Why it matters:** the screenshots show **no colour pickers** — they show two native `<select>`s of colour
*names*. Building swatch pickers is a different product, and a custom-designed panel will not match.

**Correction:** §1.3 should note "raw `<input type=checkbox>` and `<select>`, no Trello styling, standard Trello
popup width (~304 px content)". Milestone 4 should read "colour **selects**", not "colour pickers".

---

## 15. The GIF has only two content states — §0 overstates it as a source

**Plan says:** §0 lists `ShowChecklist-demo8.gif` as a peer artefact; §1.2 cites "demo8 f001" for O4 as though the
animation demonstrates behaviour.

**Image shows:** frame byte-sizes show f001–f019 identical (state A), f020–f024 crossfade, f025–f031 identical
mid-fade, f032–f069 identical (state B), f070–f082 crossfade back, f083–f099 = state A again. I rendered f001,
f020, f024, f033, f070, f074, f078. **No settings panel, no click, no hover, no interaction appears anywhere in
the GIF** — it is a two-state A/B crossfade with the captions "Checklists visible" / "Checklists not visible".

**Why it matters:** the plan treats the GIF as if it might contain more behaviour to mine. It does not.

**Correction:** §0 should state that the GIF contributes exactly one thing beyond the static shots: the
four-card board state (f001) and its power-up-off counterpart (f033).

---

## 16. Evidence the plan claims or implies but does not have

- **A4** (0-item checklist counts as complete, renders `0/0` / `0%`) — no screenshot contains a 0-item checklist.
  Untestable from these artefacts.
- **A3** (`Math.round`) — the only data point is 1/3 → 33%, where round and floor agree; the other is 2/2 → 100%.
  No discriminating value (e.g. 2/3 → 67 vs 66) exists in any image.
- **A6** (per-user settings) — comes purely from one marketing bullet in `FlexibleSettings-white.png`.
  No image demonstrates it.
- **Milestone 4's "long titles, dark theme"** — zero evidence in any artefact. The longest observed title is
  `Book car at destination airport` (298 px), which wraps as a whole badge and never truncates. All shots are light theme.
- **Progress format string** — confirmed as `${n}/${m} ${title}` and `${pct}% ${title}`, no space before `%`
  (`100% Place to stay`, `33% Transport`). That much the plan has right.

**Correction:** mark these explicitly as "no artefact evidence" in §1.4 rather than leaving them looking
screenshot-derived.

---

## 17. Asymmetry between the complete and incomplete checkboxes

**Plan says:** §1.3 transcribes it correctly, but A5 guesses at the dropdown's value set.

**Image shows:** `Show all complete checklists` has **no** count dropdown; `Show [all v] incomplete checklist(s)`
does. Same asymmetry in the item section. So limits exist only for *incomplete* things.

**Why it matters:** it is a deliberate product decision — you can cap the noise from outstanding work but never
from finished work.

**Correction:** call the asymmetry out explicitly in §1.2's facts, and reduce A5 to "observed values: `all`, `1`;
the rest of the option list is unknown."

---

# Top 3 corrections

1. **§1.3's "more content below Save Settings" is false and invents UI.** The scrollbar thumb fills 97–98% of its
   track in all five screenshots; the panel ends at Save Settings. The back chevron indicates a *parent* popup that
   the plan has not modelled — that, not a hidden lower half of this popup, is where the vendor's
   Authorize-account / licence controls live. Delete the paragraph and model the parent popup as an open question.

2. **Two of the eleven "facts" are unproven, and A1 is built on one of them.** O8 (checklist visibility gates its
   items) is fully explained by the item filter alone, because `ShowAllIncompleteItems` flips two toggles at once.
   O5 (position ordering) is indistinguishable from complete-first grouping in every single image, and the settings
   panel's own ordering hints at grouping. Move both to §1.4 and write explicit disambiguating experiments into the
   milestone-0 spike.

3. **The screenshots are a legacy Trello UI, so "matches screenshots pixel-for-intent" is the wrong acceptance
   criterion.** Measured #61BD4F / #FF9F1A / #5AAC44 are the pre-2021 palette. What the pixels *do* prove — and this
   is the valuable part — is that the native and power-up badges are the identical colour and the identical 37 px
   height, so these are real `card-badges` with colour *names* and Path A's rendering assumption is sound.
   Match names, not hexes.
