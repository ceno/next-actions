# Next Actions

A Trello Power-Up that renders per-card checklist state as always-visible card-front badges.
Independently specified from public materials; not a copy of anyone's code.

- `PLAN.md` — the approved plan: scope, architecture, milestones.
- `SPEC.md` — the frozen specification. Every assertion tagged Observed / Inferred / Decided / Unresolved.
- `docs/prior-art.md` — what else exists, and whether this needs building at all.
- `docs/overnight-report.md` — what the first unsupervised session built, and what it could not.
- `docs/session-2026-09-15.md` — i18n routed end to end. **Its §1b is wrong; see the M0a report.**
- `docs/m0a-live-run-2026-09-15.md` — the first live Trello run: registered, enabled, connector never loads.
- `docs/reviews/` — three adversarial reviews of the plan, with citations.

## Status

`computeBadges` is complete and tested. The connector, settings popup and data adapter are written
but **have never been run against Trello** — that needs M0a (a registered dev Power-Up on an HTTPS
host) and M0b (six blocking experiments), neither of which can be done without Trello admin access.

## Commands

```
npm install
npm test          # 125 tests: unit, golden, property, i18n
npm run typecheck
npm run build     # -> dist/
npm run dev       # then open /preview.html — see "Seeing it" below
```

## Layout

```
public/index.html         connector iframe (the Connector URL you register)
public/settings.html      settings popup
public/authorize.html     Path B only
public/spike.html         M0b experiment harness — a SEPARATE dev Power-Up
public/spike-report.html  its results page
src/badges.ts             computeBadges — pure, the whole product
src/data.ts               the only file that knows where checklists come from
src/settings.ts           load / save / migrate / form-enablement
src/connector.ts          capability wiring
src/constants.ts          caps, defaults, and every user-visible string
src/i18n.ts               localizer, with LABELS as the permanent English fallback
public/strings/en.json    the bundle Trello fetches; kept in step with LABELS by a test
```

## Seeing it

There are three levels, and only the third needs Trello at all. Start at the top.

**1. The preview — no Trello, no account, no network.**

```
npm run dev
open http://localhost:5173/preview.html    # or whatever port Vite prints
```

Renders the real `computeBadges` against a fixture spread, with every setting, every unresolved
policy option and both caps on a live control. This is where you decide `showIncompleteItems`: the
shipped default is 9 badges across the 5 fixture cards, and flipping it is 19. It is **not** Trello —
the pills are our approximation and native card-front expansion is not drawn — so judge badge count,
text length and wording here, and nothing else.

**2. The popup and connector, standalone.** `settings.html` and `authorize.html` will load at
`localhost` but Trello's client library only completes its handshake inside a Trello iframe, so
`t.sizeTo` and storage are inert. Useful for layout, not for behaviour.

**3. The real thing — a registered Power-Up.** See below.

## The Power-Up development lifecycle

A Power-Up is **not** installed, packaged, or uploaded. It is a static HTTPS page that Trello frames.
The whole lifecycle is: host a page, tell Trello its URL, enable it on a board.

1. **Host `dist/` over HTTPS.** Trello loads the connector in an iframe *from the user's browser*, so
   the host must be reachable from the browser, not from Trello's servers. In practice everyone uses
   a tunnel in development — `cloudflared tunnel --url http://localhost:5173`, `ngrok http 5173`, or
   `lt --port 5173` — and a static host (GitHub Pages, Netlify, Vercel) for anything shared.
2. **Register it** at <https://trello.com/apps/admin> → New. You must be an **admin of the workspace**
   you attach it to. The one field that matters is the **iframe connector URL**, which points at
   `index.html` — the page whose only job is to call `TrelloPowerUp.initialize`.
3. **Declare capabilities in the admin UI** as well as in code. `initialize()` in `src/connector.ts`
   wires the callbacks, but a capability Trello has not been told about in the admin panel is never
   called. This is the single most common reason a correct Power-Up does nothing.
4. **Enable it on a board** from the board's Power-Ups menu. It appears under Custom.
5. **Iterate.** Edit, save, and reload the board — there is no publish step and no version bump. The
   connector iframe is re-fetched on board load, which is why an aggressive cache TTL on it is fatal:
   you lose the ability to ship a fix.

Because the tunnel URL changes every restart, expect to paste a new connector URL into the admin page
each session, or use a named tunnel.

Three things break a Power-Up silently, so check them on day one:

- any security-header preset that sends `X-Frame-Options: DENY` — your pages are framed by trello.com;
- a capability wired in code but not ticked in the admin panel;
- an aggressively cached connector iframe.

## Running the M0b experiments

0. **Use a board that has checklists on it.** Most cards on "Personal Assistant" do — Trello's own
   `☑ n/m` badge is on nearly every one. (An earlier note here claimed the account had no checklists
   at all; that was wrong, and `docs/m0a-live-run-2026-09-15.md` explains why.) Ideally build a board
   with a deliberate spread: an empty checklist, one all-complete, one partial, two sharing a `pos`,
   and one very long item name. Then leave it alone — see step 3.
1. Build and host `dist/`.
2. Register a **second** Power-Up at `trello.com/apps/admin` pointing at `…/spike.html`, with the
   `card-badges` and `board-buttons` capabilities.
3. Enable it on a test board **you have not opened this session**, and do not open a card first —
   E1's failure self-heals the moment you toggle a check item, and a warm run returns a false green.
4. Click the "Spike results" board button and read the verdicts.

## Licence

Unlicensed / private. Not published, not distributed.
