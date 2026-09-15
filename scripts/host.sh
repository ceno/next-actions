#!/usr/bin/env bash
#
# Build dist/ and serve it on a STABLE public https URL, for Trello to frame.
#
# The whole point is that the URL never changes. A Cloudflare quick tunnel gets a
# fresh random hostname every restart, and each change costs three registration
# edits in Trello - the connector URL, the icon URL, and the allowed origin under
# Authorization -> Trello Auth. Miss the last one and authorization fails with
# "Invalid return_url", which names the developer rather than the tunnel. A fixed
# ngrok domain means those three are set once and never touched again.
#
# Usage:  npm run host
# Needs:  NGROK_DOMAIN in .env.local (see .env.local.example)

set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
[ -f .env.local ] && set -a && . ./.env.local && set +a

if [ -z "${NGROK_DOMAIN:-}" ]; then
  cat >&2 <<'EOF'
NGROK_DOMAIN is not set.

  1. Sign in at https://dashboard.ngrok.com (free).
  2. Copy your authtoken from Your Authtoken, then run:
         ngrok config add-authtoken <token>
  3. Claim your free static domain under Domains. It looks like
         something-something.ngrok-free.app
  4. Put it in .env.local:
         NGROK_DOMAIN=something-something.ngrok-free.app

Then run `npm run host` again.
EOF
  exit 1
fi

if ! ngrok config check >/dev/null 2>&1; then
  echo "ngrok has no authtoken yet. Run: ngrok config add-authtoken <token>" >&2
  exit 1
fi

echo "Building dist/ ..."
npm run build

# Vite refuses a Host header it does not know, so the tunnel hostname has to be
# declared or every request comes back "Blocked request".
export POWERUP_HOST="$NGROK_DOMAIN"

cleanup() { [ -n "${PREVIEW_PID:-}" ] && kill "$PREVIEW_PID" 2>/dev/null || true; }
trap cleanup EXIT

npm run preview -- --host 127.0.0.1 >/dev/null 2>&1 &
PREVIEW_PID=$!

# Wait for the server rather than sleeping a guess at it.
for _ in $(seq 1 50); do
  if curl -sf -o /dev/null "http://127.0.0.1:4173/index.html"; then break; fi
  sleep 0.2
done

if ! curl -sf -o /dev/null "http://127.0.0.1:4173/index.html"; then
  echo "Preview server did not come up on 127.0.0.1:4173" >&2
  exit 1
fi

cat <<EOF

  Connector URL   https://$NGROK_DOMAIN/index.html
  Icon URL        https://$NGROK_DOMAIN/icon.png
  Allowed origin  https://$NGROK_DOMAIN

  All three are registered already and do not change. Rebuild with
  \`npm run build\` in another shell; the next board load picks it up.

EOF

exec ngrok http 4173 --domain "$NGROK_DOMAIN" --log stdout
