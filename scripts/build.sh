#!/usr/bin/env bash
# Build self-contained `fob` binaries for every target platform with Bun.
# One host cross-compiles the whole matrix (verified 2026-07-26: linux ELF +
# windows PE produced from macOS). No Node needed on the user's machine — the
# runtime is embedded. See docs/wip/cli-install-rollout.md (Phase 1).
set -euo pipefail

cd "$(dirname "$0")/.."
ENTRY="./bin/fob.js"
OUT="dist"

rm -rf "$OUT"
mkdir -p "$OUT"

# Bun target triple : released asset name (uname-friendly os-arch).
targets=(
  "bun-darwin-arm64:fob-darwin-arm64"
  "bun-darwin-x64:fob-darwin-x64"
  "bun-linux-x64:fob-linux-x64"
  "bun-linux-arm64:fob-linux-arm64"
  "bun-windows-x64:fob-windows-x64.exe"
)

for t in "${targets[@]}"; do
  triple="${t%%:*}"
  name="${t##*:}"
  echo "→ building $name  ($triple)"
  bun build "$ENTRY" --compile --target="$triple" --outfile "$OUT/$name"
done

echo "→ writing SHA256SUMS"
cd "$OUT"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum fob-* > SHA256SUMS
else
  shasum -a 256 fob-* > SHA256SUMS
fi

echo ""
echo "✓ built $(ls fob-* | wc -l | tr -d ' ') binaries → $OUT/"
ls -lh fob-* SHA256SUMS | awk '{print "  " $5 "\t" $9}'
