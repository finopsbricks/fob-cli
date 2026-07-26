#!/usr/bin/env sh
# fob installer — downloads the self-contained `fob` binary for your platform
# and installs it to ~/.fob/bin. No sudo, no Node, and it does NOT edit your
# shell config — if ~/.fob/bin isn't on PATH it just prints the line to add.
# Binaries are served from Cloudflare R2 (get.finopsbricks.com). Usage:
#   curl -fsSL https://get.finopsbricks.com/install.sh | sh
#   FOB_VERSION=v1.2.0 sh install.sh      # pin a version (default: latest)
set -eu

BASE_URL="${FOB_BASE_URL:-https://get.finopsbricks.com}"
BINDIR="${FOB_BIN_DIR:-$HOME/.fob/bin}"
VERSION="${FOB_VERSION:-latest}"

# --- detect platform ---
os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *) echo "fob: unsupported OS '$os' (Windows: use install.ps1)." >&2; exit 1 ;;
esac
case "$arch" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64)  arch="x64" ;;
  *) echo "fob: unsupported architecture '$arch'." >&2; exit 1 ;;
esac
asset="fob-${os}-${arch}"

# --- resolve download URLs (latest at root; pinned version under a prefix) ---
if [ "$VERSION" = "latest" ]; then
  base="$BASE_URL"
else
  base="$BASE_URL/$VERSION"
fi

# --- fetch helper ---
fetch() { # fetch <url> <dest>
  if command -v curl >/dev/null 2>&1; then curl -fSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget -qO "$2" "$1"
  else echo "fob: need curl or wget installed." >&2; exit 1
  fi
}

echo "fob: installing $asset ($VERSION) → $BINDIR"
tmp="$(mktemp)"
fetch "$base/$asset" "$tmp"

# --- verify checksum against the release SHA256SUMS (if present) ---
sums="$(mktemp)"
if fetch "$base/SHA256SUMS" "$sums" 2>/dev/null; then
  expected="$(awk -v f="$asset" '$2==f || $2=="*"f {print $1}' "$sums" | head -n1)"
  if [ -n "$expected" ]; then
    if command -v sha256sum >/dev/null 2>&1; then actual="$(sha256sum "$tmp" | awk '{print $1}')"
    else actual="$(shasum -a 256 "$tmp" | awk '{print $1}')"; fi
    if [ "$expected" != "$actual" ]; then
      echo "fob: checksum mismatch for $asset — aborting." >&2; rm -f "$tmp" "$sums"; exit 1
    fi
    echo "fob: checksum ok"
  fi
fi
rm -f "$sums"

# --- install ---
mkdir -p "$BINDIR"
chmod +x "$tmp"
mv "$tmp" "$BINDIR/fob"
echo "fob: installed $("$BINDIR/fob" --version 2>/dev/null || echo "→ $BINDIR/fob")"

# --- PATH hint (we don't touch your rc files) ---
case ":$PATH:" in
  *":$BINDIR:"*) echo "fob: ready — run 'fob help'" ;;
  *)
    echo ""
    echo "fob: $BINDIR is not on your PATH. Add it, then restart your shell:"
    echo "  export PATH=\"$BINDIR:\$PATH\""
    ;;
esac
