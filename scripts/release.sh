#!/usr/bin/env bash
# Manually build + publish the fob binaries to Cloudflare R2 (get.finopsbricks.com)
# using your local `wrangler login` session — no GitHub / CI needed. This is the
# same work as .github/workflows/release.yml, runnable by hand.
#
#   scripts/release.sh              # build + upload as "latest" (bucket root)
#   scripts/release.sh v1.0.1       # also upload a pinned copy under /v1.0.1/
#   SKIP_BUILD=1 scripts/release.sh # reuse existing dist/ (don't rebuild)
#
set -euo pipefail

cd "$(dirname "$0")/.."
BUCKET="fob-cli"
BASE_URL="https://get.finopsbricks.com"
VERSION="${1:-}"

command -v wrangler >/dev/null 2>&1 || { echo "release: wrangler not found (npm i -g wrangler)"; exit 1; }
wrangler whoami >/dev/null 2>&1 || { echo "release: not logged in — run 'wrangler login'"; exit 1; }

# 1. build all targets + SHA256SUMS (skip with SKIP_BUILD=1)
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  bash scripts/build.sh
fi

# content-type by filename
ct() { case "$1" in
  SHA256SUMS) echo text/plain ;;
  install.sh) echo text/x-shellscript ;;
  *)          echo application/octet-stream ;;
esac; }

put() { # put <localpath> <key>   — uploads to REMOTE R2 (wrangler defaults to local!)
  echo "  ↑ $2"
  if ! wrangler r2 object put "$BUCKET/$2" --file "$1" \
        --content-type "$(ct "$(basename "$1")")" --remote >/tmp/fob-release-put.log 2>&1; then
    echo "  ✗ upload failed for $2:"
    grep -viE "debugger|inspector|waiting|listening" /tmp/fob-release-put.log | tail -8
    exit 1
  fi
}

echo "→ publishing to R2 (latest${VERSION:+ + $VERSION})…"
for f in dist/fob-* dist/SHA256SUMS; do
  name="$(basename "$f")"
  put "$f" "$name"                                 # latest, at bucket root
  [ -n "$VERSION" ] && put "$f" "$VERSION/$name"   # pinned, under version prefix
done
put install.sh install.sh

# 2. verify over https
echo "→ verifying over https…"
fail=0
check() { code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE_URL/$1"); printf "  %s  %s\n" "$code" "$1"; [ "$code" = "200" ] || fail=1; }
for k in install.sh SHA256SUMS fob-darwin-arm64 fob-darwin-x64 fob-linux-x64 fob-linux-arm64 fob-windows-x64.exe; do check "$k"; done
[ -n "$VERSION" ] && check "$VERSION/SHA256SUMS"

if [ "$fail" = "0" ]; then
  echo "✓ released → $BASE_URL   (install: curl -fsSL $BASE_URL/install.sh | sh)"
else
  echo "✗ some objects not reachable over https — check output above"; exit 1
fi
