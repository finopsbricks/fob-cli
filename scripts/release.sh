#!/usr/bin/env bash
# Manually build + publish binaries to Cloudflare R2 (get.finopsbricks.com) using
# your local `wrangler login` session — no GitHub / CI needed. Same work as
# .github/workflows/release.yml, runnable by hand.
#
#   scripts/release.sh              # build + upload as "latest" (bucket root)
#   scripts/release.sh v1.0.1       # also upload a pinned copy under /v1.0.1/
#   SKIP_BUILD=1 scripts/release.sh # reuse existing dist/ (don't rebuild)
#
# Reuses the same FOB_BIN / FOB_ENTRY overrides as build.sh, so a sibling repo
# publishes its own <BIN>-* assets into the shared bucket. Uploads whatever is in
# dist/, plus install.sh and catalog.json when present (dispatcher repo only).
set -euo pipefail

cd "$(dirname "$0")/.."
BUCKET="fob-cli"
BASE_URL="https://get.finopsbricks.com"
VERSION="${1:-}"

command -v wrangler >/dev/null 2>&1 || { echo "release: wrangler not found (npm i -g wrangler)"; exit 1; }
wrangler whoami >/dev/null 2>&1 || { echo "release: not logged in — run 'wrangler login'"; exit 1; }

[ "${SKIP_BUILD:-0}" = "1" ] || bash scripts/build.sh

ct() { case "$1" in
  *SHA256SUMS)  echo text/plain ;;
  install.sh)   echo text/x-shellscript ;;
  catalog.json) echo application/json ;;
  *)            echo application/octet-stream ;;
esac; }

put() { # put <localpath> <key>  — --remote is REQUIRED (wrangler defaults to a local store)
  echo "  ↑ $2"
  if ! wrangler r2 object put "$BUCKET/$2" --file "$1" \
        --content-type "$(ct "$(basename "$1")")" --remote >/tmp/fob-release-put.log 2>&1; then
    echo "  ✗ upload failed for $2:"
    grep -viE "debugger|inspector|waiting|listening" /tmp/fob-release-put.log | tail -8
    exit 1
  fi
}

echo "→ publishing to R2 (latest${VERSION:+ + $VERSION})…"
for f in dist/*; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  put "$f" "$name"                                 # latest, at bucket root
  [ -n "$VERSION" ] && put "$f" "$VERSION/$name"   # pinned, under version prefix
done
# Root-level, family-wide files (present in the dispatcher repo only).
[ -f install.sh ]   && put install.sh install.sh
[ -f catalog.json ] && put catalog.json catalog.json

echo "→ verifying over https…"
fail=0
check() { code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE_URL/$1"); printf "  %s  %s\n" "$code" "$1"; [ "$code" = "200" ] || fail=1; }
for f in dist/*; do [ -f "$f" ] && check "$(basename "$f")"; done
[ -f install.sh ]   && check install.sh
[ -f catalog.json ] && check catalog.json

if [ "$fail" = "0" ]; then
  echo "✓ released → $BASE_URL"
else
  echo "✗ some objects not reachable over https — check output above"; exit 1
fi
