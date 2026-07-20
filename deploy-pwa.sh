#!/usr/bin/env bash
#
# Powerfly — one-shot deploy of the full app as a hosted PWA on your own server.
# Run this ON the box that serves your domain (e.g. inference.josephbissell.com).
#
# Usage:
#   INFERENCE_KEY=nbk-xxxxx bash deploy-pwa.sh
#
# Optional overrides:
#   BASE_PATH=/app     URL path to serve under (default /app). Use "" for a
#                      dedicated subdomain served at its root.
#   APPDIR=~/Loop_Hackathon   where to clone/build.
#
# It clones the repo, builds the static PWA (key kept server-side, never
# committed), and PRINTS the exact web-server snippet to serve it. It does NOT
# edit your web-server config — you paste the printed block and reload.

set -euo pipefail

INFERENCE_KEY="${INFERENCE_KEY:?set INFERENCE_KEY=nbk-... (your /hax key)}"
REPO="${REPO:-https://github.com/kirandevihosur74/Loop_Hackathon.git}"
APPDIR="${APPDIR:-$HOME/Loop_Hackathon}"
BASE_PATH="${BASE_PATH:-/app}"

echo "==> 1/4  fetch code"
if [ -d "$APPDIR/.git" ]; then
  git -C "$APPDIR" fetch --depth 1 origin main
  git -C "$APPDIR" reset --hard origin/main
else
  git clone --depth 1 "$REPO" "$APPDIR"
fi
cd "$APPDIR/Frontend/dev"

echo "==> 2/4  write key (server-side only; .env.local is gitignored)"
printf 'NEXT_PUBLIC_INFERENCE_KEY=%s\n' "$INFERENCE_KEY" > .env.local

echo "==> 3/4  install + build   (BASE_PATH=$BASE_PATH)"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
OK=0
if command -v pnpm >/dev/null 2>&1 || corepack enable pnpm >/dev/null 2>&1; then
  if pnpm install --config.minimumReleaseAge=0 && BASE_PATH="$BASE_PATH" pnpm run build; then OK=1; fi
fi
if [ "$OK" != "1" ] && command -v npm >/dev/null 2>&1; then
  if npm install && BASE_PATH="$BASE_PATH" npm run build; then OK=1; fi
fi
[ "$OK" = "1" ] || { echo "BUILD FAILED — ensure Node.js >= 18 is installed"; exit 1; }
OUT="$(pwd)/out"

echo "==> 4/4  serve config"
echo "Static PWA built at: $OUT"
echo "-------------------------------------------------------------------"
if command -v nginx >/dev/null 2>&1; then
  cat <<CFG
nginx detected. Add this INSIDE the existing 'server { ... }' block for your
domain, then run:  nginx -t && systemctl reload nginx

    location ${BASE_PATH}/ {
        alias ${OUT}/;
        try_files \$uri \$uri/ ${BASE_PATH}/index.html;
    }
CFG
elif command -v caddy >/dev/null 2>&1; then
  cat <<CFG
Caddy detected. Add to your Caddyfile for the domain, then run:  caddy reload

    handle_path ${BASE_PATH}/* {
        root * ${OUT}
        file_server
    }
CFG
else
  cat <<CFG
No nginx/caddy found. Serve ${OUT} from your bridge app statically at ${BASE_PATH},
or run a standalone static server and reverse-proxy ${BASE_PATH} to it:

    npm i -g serve
    serve -s "${OUT}" -l 8080      # then proxy ${BASE_PATH} -> http://127.0.0.1:8080
CFG
fi
echo "-------------------------------------------------------------------"
echo "Then open:   https://<your-domain>${BASE_PATH}/"
echo "On iPhone:   open that URL in Safari -> Share -> Add to Home Screen."
