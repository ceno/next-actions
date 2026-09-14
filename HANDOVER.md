# Handover prompt — paste this to the fresh agent

---

You are picking up an overnight build session on a Trello Power-Up called **Next Actions**, in
`/Users/jorgeazevedo/code/ceno/trello-checklists`. Work unsupervised until you run out of scope, then
stop and write a report. The user will review in the morning.

## Read these first, in this order

1. `PLAN.md` — the approved plan. This is your source of truth for scope, architecture and constraints.
2. `docs/reviews/platform.md` — 14 cited findings on what the Trello Power-Up platform will and will not
   do. Read findings 1, 3, 6, 8, 11, 14 closely; they constrain the design.
3. `docs/reviews/screenshot-forensics.md` — how the behavioural spec was derived and which parts of it
   are unproven. Read the "Top 3 corrections" section at minimum.
4. `docs/reviews/delivery-risk.md` — skim sections B, D and G.

Do not read the whole of every review if context is tight; `PLAN.md` already folds in their conclusions.
The reviews are there so you can check *why* a constraint exists before you work around it.

## Hard rules — these are not preferences

1. **The specification is frozen.** Do not fetch, view, or reason about the vendor's Power-Up, its
   marketing images, its docs site, or its S3 bucket. `PLAN.md §1` is the complete spec. The legal
   footing in `PLAN.md §0.2` depends on nobody on this project touching the original — if you think the
   spec is missing something, write the gap down as an open question rather than going to look.
2. **Never commit images or copy from the vendor.** No marketing assets in this repo. No verbatim UI
   label strings — see `PLAN.md §0.3` for the reworded convention ("Hide completed checklists", not
   "Show all complete checklists").
3. **Do not resolve A1–A7** (`PLAN.md §1.4`). They are unproven assumptions awaiting live experiments
   you cannot run tonight. Where the code needs an answer, make it an explicit named option with a
   documented default, not a silent hardcode. A1 (ordering) and A2 (does hiding a checklist hide its
   items) are the two that would be invisible in tests and wrong on every real board.
4. **Badges are inert.** `card-badges` returns text, icon and colour only. No click handlers exist.
   Nothing you build can be interactive.
5. **Colour names, not hexes.** Trello's legal badge colours are `blue green orange red yellow purple
   pink sky lime light-gray`, or omitted.
6. **No pushing.** `git init` and commit locally as you go so the work is reviewable; do not add a
   remote, do not push, do not open a PR.

## What you cannot do tonight

M0a (registering the dev Power-Up) and M0b (the six live experiments) need a human with Trello admin
access and an HTTPS host. Don't try. Don't stub around them by guessing their outcomes.

## Your scope, in priority order

### 1. Prior-art check — 30 minutes, first (`PLAN.md §7`)

Search for existing open-source card-front checklist Power-Ups. Trello shipped a native card-front
checklist preview in April 2026 that covers part of this job. Write `docs/prior-art.md`: what exists,
licences, what it covers, and a blunt recommendation on whether this project should still be built. If
you find something that makes the project redundant, **say so loudly in your report and stop** — do not
build around it to protect the plan.

### 2. `SPEC.md` — freeze the specification

Promote `PLAN.md §1` into a standalone `SPEC.md`. Every assertion tagged **Observed** or **Inferred**.
Record A1–A7 with the experiment that resolves each and the provisional default you chose. State the
reworded UI labels. Define the internal domain types — do **not** use the Trello client library's
checklist shape, which is undocumented and empirically unstable (platform review, finding 2).

### 3. `computeBadges` — the whole product, as a pure function

`src/badges.ts`: domain checklists + settings in, badge array out. No Trello imports, no I/O, no async.
This is the only part of the product that can be fully built and fully tested without Trello.

Test it properly (`PLAN.md §4`): unit tests plus **property tests**. Property tests matter more here —
golden fixtures derived from the same screenshots that produced the spec cannot catch A1/A2 being
backwards. Properties worth asserting: output length never exceeds the configured caps; a badge is
emitted for a checklist iff the filter admits it; item order is a subsequence of input order; the
progress string round-trips the counts; an empty checklist set yields an empty array.

### 4. Scaffold — Vite + TypeScript, zero runtime deps

Per `PLAN.md §2`. Build `public/index.html` (connector), `public/settings.html`, `src/connector.ts`,
`src/settings.ts`, `src/data.ts`, `src/constants.ts`.

`src/data.ts` is the important one. Both data paths behind **one interface**, because which one works is
unknown until E1 runs:

- Path A: `t.card('checklists')` in the badge handler. Probably dead — read platform review finding 1
  before you write it, including why the failure self-heals and produces false positives.
- Path B: REST via `t.getRestApi()`, one `GET /1/boards/{id}/checklists?checkItems=all&fields=name,pos,idCard`
  per board, memoised ~10s with single-flight promise dedupe.

Write both. Make the active one a config flag. Do not wire up real credentials.

Settings storage per `PLAN.md §2.2` and §3/M3: versioned schema with a `v` field and a migration path,
written as one object (shared-storage writes are not atomic and fail silently last-write-wins), inside
the 4096-char member-scope budget. Settings changes require a board refresh — that is decided and
permanent, so ship `t.alert` on save rather than engineering around it.

### 5. The M0b spike harness — high value, do this if you have time

Turn `PLAN.md §3 M0b` from "figure it out" into "register a URL and click". A separate connector entry
point that runs E1–E6 and prints results to a page: cold-load `t.card('checklists')` probe, ordering
probe, 40-synthetic-badge stress, `t.set` cross-board persistence check, settings-refresh check. The
human should be able to point a dev Power-Up at it and read the answers off the screen.

## Stop conditions

Stop and report if: the prior-art check suggests the project is redundant; you find a constraint in
`PLAN.md` that is actually wrong; or you'd have to resolve A1–A7 by guessing to make progress.

## Report

Write `docs/overnight-report.md`: what you built, what you learned, every decision you made that the
plan did not already make, every assumption you had to invent, and what the human must do first in the
morning. Be blunt about what is unfinished. Do not claim anything is verified that you could not run.
