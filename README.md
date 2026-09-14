# Next Actions

A Trello Power-Up that renders per-card checklist state as always-visible card-front badges.
Independently specified from public materials; not a copy of anyone's code.

- `PLAN.md` — the approved plan: scope, architecture, milestones.
- `SPEC.md` — the frozen specification. Every assertion tagged Observed / Inferred / Decided / Unresolved.
- `docs/prior-art.md` — what else exists, and whether this needs building at all.
- `docs/overnight-report.md` — what the last unsupervised session built, and what it could not.
- `docs/reviews/` — three adversarial reviews of the plan, with citations.

## Status

`computeBadges` is complete and tested. The connector, settings popup and data adapter are written
but **have never been run against Trello** — that needs M0a (a registered dev Power-Up on an HTTPS
host) and M0b (six blocking experiments), neither of which can be done without Trello admin access.

## Commands

```
npm install
npm test          # 102 tests: unit, golden, property
npm run typecheck
npm run build     # -> dist/
npm run dev       # local preview; Trello cannot load localhost
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
```

## Hosting

Trello loads the connector in an iframe from an HTTPS URL. **localhost is not supported.** Use a
tunnel (cloudflared, ngrok) or a preview deploy.

Two things break a Power-Up silently, so check them on day one:

- any security-header preset that sends `X-Frame-Options: DENY` — your pages are framed by trello.com;
- an aggressively cached connector iframe — you will not be able to ship a fix.

## Running the M0b experiments

1. Build and host `dist/`.
2. Register a **second** Power-Up at `trello.com/apps/admin` pointing at `…/spike.html`, with the
   `card-badges` and `board-buttons` capabilities.
3. Enable it on a test board **you have not opened this session**, and do not open a card first —
   E1's failure self-heals the moment you toggle a check item, and a warm run returns a false green.
4. Click the "Spike results" board button and read the verdicts.

## Licence

Unlicensed / private. Not published, not distributed.
