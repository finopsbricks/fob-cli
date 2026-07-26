#!/usr/bin/env bash
# Build self-contained binaries for every target platform with Bun. One host
# cross-compiles the whole matrix (no Node needed on the user's machine — the
# runtime is embedded). See docs/wip/cli-install-rollout.md (Phase 1).
#
# Parameterized so any fob-<tool> repo reuses it unchanged — override per repo:
#   FOB_BIN    binary base name   (default: fob;  siblings: fob-email, fob-orc, …)
#   FOB_ENTRY  entry file         (default: ./bin/fob.js;  siblings: ./bin/cli.js)
# Produces dist/<BIN>-<os>-<arch>(.exe) + dist/<BIN>-SHA256SUMS.
set -euo pipefail

cd "$(dirname "$0")/.."
BIN="${FOB_BIN:-fob}"
ENTRY="${FOB_ENTRY:-./bin/fob.js}"
OUT="dist"

rm -rf "$OUT"
mkdir -p "$OUT"

# Bun target triple : output suffix (os-arch[.exe]).
targets=(
  "bun-darwin-arm64:darwin-arm64"
  "bun-darwin-x64:darwin-x64"
  "bun-linux-x64:linux-x64"
  "bun-linux-arm64:linux-arm64"
  "bun-windows-x64:windows-x64.exe"
)

built=()
for t in "${targets[@]}"; do
  triple="${t%%:*}"
  suffix="${t##*:}"
  name="${BIN}-${suffix}"
  echo "→ building $name  ($triple)"
  bun build "$ENTRY" --compile --target="$triple" --outfile "$OUT/$name"
  built+=("$name")
done

echo "→ writing ${BIN}-SHA256SUMS"
cd "$OUT"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${built[@]}" > "${BIN}-SHA256SUMS"
else
  shasum -a 256 "${built[@]}" > "${BIN}-SHA256SUMS"
fi

echo ""
echo "✓ built ${#built[@]} binaries → $OUT/"
ls -lh "${built[@]}" "${BIN}-SHA256SUMS" | awk '{print "  " $5 "\t" $9}'
