# Next Actions

A Trello Power-Up that renders per-card checklist state as always-visible card-front badges.
Independently specified from public materials; not a copy of anyone's code.

- `PLAN.md` — the approved plan: scope, architecture, milestones.
- `SPEC.md` — the frozen specification. Every assertion tagged Observed / Inferred / Decided / Unresolved.
- `docs/prior-art.md` — what else exists, and whether this needs building at all.
- `docs/overnight-report.md` — what the first unsupervised session built, and what it could not.
- `docs/session-2026-09-15.md` — i18n routed end to end. **Its §1b is wrong; see the M0a report.**
- `docs/m0a-live-run-2026-09-15.md` — the first live Trello run. **Its central finding is retracted;
  see `docs/visibility-2026-09-15.md`.**
- `docs/visibility-2026-09-15.md` — the connector does mount. It was never fetched because the test
  tab was hidden, and Trello defers every Power-Up request until the page is visible. Read this
  before debugging "nothing renders".
- `docs/reviews/` — three adversarial reviews of the plan, with citations.

## Status

**Working end to end on a live board as of 2026-09-15.** Path B (REST) is authorized and card
fronts on "Personal Assistant" show the checklist name, progress and the next unfinished items:

```
Go see Hanako-san in NL
2/5 Next Actions   [ ] Book planes   [ ] Buy tickets   [ ] Book hotels and such
```

Verified live: `card-badges`, `show-settings`, `show-authorization` and `authorization-status`, plus
the localizer, the settings popup (including form-enablement and save) and the Path C fallback.
See `docs/visibility-2026-09-15.md` for the full run, including the four things that had to be fixed
to get there.

Hosting is a **fixed ngrok domain** (`npm run host`), so the URL never changes. That matters more
than it sounds: every hostname change costs three registration edits in Trello — the iframe connector
URL, the icon URL, and, separately under Authorization → Trello Auth, the **allowed origin**. Miss the
last and authorization fails with `Invalid return_url`, a message that points at the developer rather
than at the tunnel. See "Hosting it" below.

Note that a hidden or occluded browser tab cannot verify any of this: Trello defers every Power-Up
request until the page is visible, and renders card fronts in a name-only "minimal card" mode
meanwhile.

## Commands

```
npm install
npm test          # 163 tests: unit, golden, property, i18n, real-payload
npm run typecheck
npm run build     # -> dist/
npm run dev       # then open /preview.html — see "Seeing it" below
npm run host      # build + serve dist/ on the fixed public URL Trello frames
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

Use a **stable** URL, and the registration becomes a one-time job — see "Hosting it" below.

Three things break a Power-Up silently, so check them on day one:

- any security-header preset that sends `X-Frame-Options: DENY` — your pages are framed by trello.com;
- a capability wired in code but not ticked in the admin panel;
- an aggressively cached connector iframe.

## Hosting it

There are two registrations, and they differ only in where the connector is served from. Neither
needs the other, and both can be enabled at once on different boards.

| | Prod — **Next Actions** | Dev — **Next Actions (dev)** |
|---|---|---|
| Connector | `https://ceno.github.io/next-actions/index.html` | `https://<ngrok-domain>/index.html` |
| Served by | GitHub Pages, from `main` | `npm run host`, from your laptop |
| Enabled on | Personal Assistant | Testing sandbox |
| Ships a change | push to `main`; the Action rebuilds | `npm run build`, reload the board |

Prod is the one to leave alone. Dev is the one to point at whatever you are currently breaking.

### Prod: GitHub Pages

`.github/workflows/deploy.yml` builds `dist/` and publishes it on every push to `main`. There is
nothing to run by hand. Two properties of Pages matter here:

- it sends `Cache-Control: max-age=600` on HTML and will not let you override it, so a change can
  take up to ten minutes to reach a board. Asset filenames are hashed, so a stale `index.html` only
  ever means briefly-old code — never a broken mix of old and new;
- it sends no `X-Frame-Options`, so trello.com can frame it. This is the header that silently kills
  a Power-Up, and it is worth re-checking if you ever move hosts.

### Dev: the ngrok tunnel

`npm run host` builds `dist/` and serves it on a fixed `*.ngrok-free.dev` domain. One-time setup:

1. Sign in at <https://dashboard.ngrok.com> (free).
2. Copy your authtoken from **Your Authtoken** and run:

   ```
   ngrok config add-authtoken <token>
   ```

3. Take the free domain under **Domains**. Every account gets one automatically, named for you —
   something like `rural-image-manager.ngrok-free.dev`. Note the suffix is `.dev`, not `.app`.
4. `cp .env.local.example .env.local` and put the domain in it. `.env.local` is gitignored.

Then register these three in Trello, once, and never again:

| Where | Value |
|---|---|
| Iframe connector URL (`trello.com/apps/admin` → Basic information) | `https://<domain>/index.html` |
| Icon (same page) | `https://<domain>/icon.png` |
| Allowed origin (**Authorization → Trello Auth**) | `https://<domain>` |

The third is the one that is easy to miss and fails with `Invalid return_url`, because it lives on a
different page from the other two and is not mentioned where you register the connector.

### Each registration ships its own API key

The key is not just an access credential: **Trello's authorize dialog names the app that owns the
key**, and ignores the `appName` the client library passes next to it. Build the Pages connector with
the dev key and the production board asks you to authorize "Next Actions (dev)" — the right
permission requested by visibly the wrong app.

So the key is build-time configuration, not a constant. `src/config.ts` defaults to the dev key,
because `npm run host` takes no build arguments; `.github/workflows/deploy.yml` sets
`VITE_TRELLO_APP_KEY` to the prod one. An unconfigured build is a developer build.

| | App id | Key set by | Allowed origin |
|---|---|---|---|
| dev | `6aa90a579e5dd131338e93aa` | the default in `config.ts` | `https://<ngrok-domain>` |
| prod | `6aaa4fa726a2036747a62057` | the workflow's `VITE_TRELLO_APP_KEY` | `https://ceno.github.io` |

Each origin lives under **its own** app's Authorization → Trello Auth — a new host goes with the key
that will serve it, not with whichever app you happen to have open.

Authorization is per-registration too: the REST token is stored against the Power-Up's plugin id,
so enabling prod on a board it has never been authorized on lands in the degraded state below until
you authorize it once via the board's Power-Ups menu → **Next Actions** → **Authorize account**.

### The degraded state looks like success

If Path B has no token, `cardBadges` falls through to the Path C aggregate *before* it reaches the
unauthorized badge (`src/connector.ts:130` precedes `:154`), and the aggregate forces the item
settings off. An unauthorized board therefore renders a progress pill per card, no item text, and no
"Connect your account" prompt — which reads as "the Power-Up works but has nothing to say" rather
than "it is not authorized". Progress pills but never any next-action text is the tell.

### The ngrok free interstitial — read this before concluding the Power-Up is broken

On the free plan ngrok serves an **"You are about to visit..." warning page** to browser requests
instead of your site. Trello's connector iframe is a browser request, so it gets that page rather
than the connector, and the card fronts render nothing — with no error anywhere.

`curl` does *not* see it (it is triggered by the browser `User-Agent`), so the host looks perfectly
healthy from the terminal. That combination — fine over curl, dead in Trello — is the signature.

The fix is to visit `https://<domain>/index.html` **once** in the browser and click *Visit Site*.
That sets an `abuse_interstitial` cookie, which is then sent with Trello's iframe request too, and
everything works. Verified.

Its limits, honestly:

- **per browser, per profile.** Anyone else opening the board sees no badges until they do the same.
- **the cookie can expire**, and the symptom on expiry is the Power-Up silently going blank again.
- it relies on a **third-party cookie** reaching the iframe, which Chrome is progressively
  restricting. If it stops working, this is the first thing to suspect.
- `--request-header-add ngrok-skip-browser-warning: 1` does **not** work around it; the edge decides
  before traffic policy applies. Tested.

For anything beyond one developer's own board, use a host with no interstitial: Cloudflare Pages or
Netlify both give a permanent `*.pages.dev` / `*.netlify.app` URL, deploy `dist/` straight from the
CLI with no public repo, and cost nothing.

After that the loop is: `npm run host` in one shell, `npm run build` in another, reload the board.
The connector is served `no-store`, so the reload always fetches the new bundle — a cached connector
iframe is one of the three things that break a Power-Up silently, and it costs you the ability to
ship a fix at all.

Why not a named Cloudflare tunnel: named tunnels need a domain in your own Cloudflare account, and
`trycloudflare` quick tunnels are random-hostname only, by design. ngrok's free tier includes one
permanent domain, which is the cheapest way to a URL that survives a restart. Any static host
(GitHub Pages, Netlify, Vercel) works equally well and needs no process running at all; the tunnel
only wins because a rebuild is instant.

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
