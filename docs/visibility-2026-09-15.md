# Why the connector "never mounted": the tab was hidden, 2026-09-15

**The Power-Up works.** It was verified end to end against the live board today: Trello framed the
connector, the connector initialized, the `card-badges` callback ran, and it returned a badge.

Everything that three previous sessions recorded as "Trello never mounts the connector iframe" has a
single, mundane cause, and it is not Trello's bug and not ours.

## The finding

`board-list-view.*.js`, the chunk that renders card fronts, wraps **every** Power-Up request in a
page-visibility gate:

```js
request(e, a, t) {
  if ("moderated" === this.moderatedState) throw ...
  let n = async () => this.getIo().request(e, a, t)...;
  return new Promise((resolve, reject) => {
    eM().onVisible(() => { n().then(resolve).catch(reject) });   // <-- here
  })
}
```

`eM()` is `visibilityjs`. `onVisible(cb)` fires `cb` immediately **if** `document.hidden` is false,
and otherwise waits for a `visibilitychange` that says the page became visible.

The iframe is created lazily inside `getIo()`, which `onVisible` never reaches while the tab is
hidden. So with a hidden tab you get, in order:

- no `<div id="iframe-io-host">` in the DOM,
- no `<iframe>` anywhere, at any nesting depth,
- **no HTTP request to the connector at all**, so a host access log stays silent,
- no console error, because nothing failed — a promise is simply pending forever,
- every capability inert: `show-settings` does nothing, `authorization-status` never answers.

That is the exact symptom set recorded in `m0a-live-run-2026-09-15.md` and
`zero-zero-2026-09-15.md`.

In this session `document.visibilityState` was `"hidden"` for the entire automated run — the
browser window was occluded. Every conclusion drawn from "the connector was never fetched" was
drawn from a tab Trello had deliberately parked.

## Proof

Bypassing only the visibility wrapper — calling the inner io directly, with everything else
untouched — made it work immediately:

```js
const rec  = loadPlugin(boardId, '6aa90a579e5dd131338e93aa');
const io   = pluginIoCache.get(rec);
io.supports('card-badges');            // true
io.getIo().request('card-badges', ctx, 15000);
```

The host log went from silent to a full load in one second:

```
GET /index.html                 200
GET /assets/connector-*.js      200
GET /assets/badges-*.js         200
GET /assets/i18n-*.js           200
GET /strings/en.json            200
```

and the call resolved with a real badge:

```json
[ { "text": "Connect your account", "color": "light-gray" } ]
```

That is `showUnauthorizedBadge` doing precisely what it is designed to do. The connector mounts, the
localizer resolves (`unauthorized` came back localized, not as a key), `computeBadges` runs, and the
badge array reaches Trello.

## What this retracts

`m0a-live-run-2026-09-15.md` §"The decisive test" concluded, in bold, that "Trello's client on this
account does not mount a custom Power-Up connector iframe **for any connector URL at all**" and that
the cause "is entirely on Trello's side". **That is wrong.** The control test it rested on — pointing
the connector at a working `github.io` sample and seeing it also fail — failed for the same reason
the original did: the tab was hidden, so no connector of any origin would ever have been fetched. A
control that shares the confound with the experiment proves nothing.

`zero-zero-2026-09-15.md` was right that "an iframe count is not a mount check; the server log is",
and then trusted the server log while the only thing suppressing it was tab visibility.

The `appKey` defect fixed in `623b8f6` was real and independently worth fixing — `t.getRestApi()`
does throw synchronously without it. But it was not what kept the connector from loading.

## A second, related effect

While the tab is hidden every card front renders as `data-testid="minimal-card"` — card name only,
no badge layer at all. All 104 cards on "Personal Assistant" were in that state throughout. So even
a Power-Up that had answered would have had nowhere to draw. This one cannot be worked around from
JavaScript: spoofing `document.hidden` does not restore the rendering work Chrome skips for an
occluded tab.

**Consequence for anyone testing this again: a hidden or occluded tab cannot verify a Power-Up.**
Not with a longer timeout, not with a different host, not with a different connector URL. Put the
window on screen first.

## State of the registration, after this session

| Thing | Value |
|---|---|
| Power-Up id | `6aa90a579e5dd131338e93aa` |
| Connector URL | `https://<quick-tunnel>.trycloudflare.com/index.html` — the stale `?v=2` was removed |
| Capabilities | `card-badges`, `on-enable`, `remove-data`, `show-settings`, `authorization-status`, `show-authorization` |
| Enabled on "Personal Assistant" | Yes — it had been **disabled**, and was re-added this session |
| `icon.png` | 200, and the Power-Up now shows its name and icon in Trello's menus |
| Bundle served | current `dist/`, including the `appKey` fix |

It had silently fallen off the board: `GET /1/boards/EZ9mP5YV/plugins` listed only Card Aging, Butler
and Bulk Actions. That is worth checking first whenever nothing renders.

## What is left

One thing: **the authorization click.** `CONFIG.dataPath` is `'rest'` (Path B), which needs a
per-member token via `t.getRestApi().authorize()`. Until that happens the card front reads
"Connect your account" instead of checklist content — verified above as the live response.

It was not done here because it is an OAuth grant on the user's own account, and that is theirs to
approve, not something to click on their behalf. `show-authorization` is wired, so Trello offers the
prompt in the Power-Up's own menu.
