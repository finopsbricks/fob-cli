# Distribution Channels

Given a signed self-contained binary ([runtime-and-packaging.md](./runtime-and-packaging.md)), how do
the bits reach the machine? There are six channels. The question is not "which one" but "which set,
ranked by audience" — mature tools offer several but anchor on one.

## The six channels

| Channel | Command / action | Best audience | Prereq | Closed-source OK? |
|---|---|---|---|---|
| **Native installer** | double-click `.pkg` / `.msi` | **accountants/finance** | none | ✓ |
| **`curl \| sh` / `iwr \| iex`** | one-line paste | founders, engineers | terminal | ✓ |
| **Homebrew tap** | `brew install finopsbricks/tap/fob` | Mac engineers | brew | ✓ (tap, not core) |
| **winget / choco / scoop** | `winget install finopsbricks.fob` | Windows power users | pkg mgr | ✓ |
| **apt/yum repo** | `apt install fob` (our hosted repo) | Linux/servers | root | ✓ (self-hosted) |
| **npm** | `npm i -g @fob/cli` | Node engineers | Node | ✓ but leaks JS |

**Every one of these works for a closed-source binary** except that npm exposes source. The only
channels closed to us are the *default community repos* — homebrew-**core** (`brew install fob` with
no tap) and official Debian/Fedora/AUR — which need OSS *and* popularity; those are a "someday", never
a launch channel. See [open-vs-closed-source.md](./open-vs-closed-source.md).

## The one to anchor on: the install script

`curl -fsSL https://get.fob.io | sh` (and `irm https://get.fob.io/install.ps1 | iex` on Windows) is
the universal baseline. rustup, deno, bun, uv, ollama, flyctl, and gcloud all anchor here. What the
script does:

1. Detect OS + arch.
2. Download the matching **signed** binary from GitHub Releases / CDN.
3. **Verify** checksum (and signature) against a published manifest.
4. Install to a **per-user** dir — `~/.fob/bin` (no `sudo`, survives locked-down machines).
5. Add `~/.fob/bin` to PATH (edit shell rc / Windows user PATH) and print next steps.

It's closed-source-friendly, cross-platform, and it's the substrate the native installers and
`fob install` reuse (same download+verify logic).

## But the primary audience needs the double-click

A finance user will not open a terminal. For them the anchor is a **native installer**:
- **macOS `.pkg`** — signed + notarized, double-click, installs to `~/.fob/bin` or `/usr/local/bin`,
  fixes PATH. (ollama, AWS CLI v2, gh all ship one.)
- **Windows `.msi`** — signed, double-click, per-user install, adds PATH. Windows is the finance
  majority — this is arguably the single most important artifact to get right.
- Fronted by a plain **download page** with two big buttons (Mac / Windows) and auto-OS-detection.
  No command line anywhere in the happy path.

## Package managers: additive, not primary

`brew tap`, `winget`, `choco`, `scoop`, and a self-hosted `apt`/`yum` repo are **convenience layers
for users who already live in a package manager** — i.e. engineers and Windows power users. They:
- cost ongoing maintenance (a manifest/formula per release, per channel),
- don't reach the primary audience (accountants don't have brew/winget set up),
- but give the engineer tail their expected muscle memory and *free updates* via that manager.

Do **winget** early (it ships with modern Windows and reaches the finance-Windows middle tier without
requiring a terminal-savvy user to know it exists) and a **Homebrew tap** early (cheap, high value for
Mac engineers). Defer choco/scoop/apt until demand appears — `log()` that they're not yet covered
rather than implying full coverage.

## Recommended channel matrix (by audience)

| Audience | Primary | Secondary |
|---|---|---|
| Accountants / finance (Windows-heavy) | signed `.msi` / `.pkg` + download page | `winget` |
| Founders / mixed | `curl \| sh` one-liner | download page |
| Engineers | Homebrew tap, npm shim | `curl \| sh`, winget/choco |

All of them are thin wrappers over the **same signed binary + the same download-and-verify logic** —
so this is one pipeline with several front doors, not several projects.

## The tradeoff

- **More channels** = broader reach and better per-audience ergonomics, but linear maintenance
  (every release fans out to every manifest/formula/repo) and more places for a stale/wrong version
  to sit.
- **Fewer channels** (just curl + installers) = one release surface, but you miss the package-manager
  convenience engineers expect and lose their free update path.

Resolution: **one install script + one native installer per OS at baseline**; add a package-manager
channel only when a real audience asks, and automate its manifest bump in the release pipeline so the
marginal cost stays near zero.

## Layering view

- **Baseline (day one):** `get.fob.io` install script (sh + ps1) **and** a signed `.pkg` + `.msi`
  behind a download page. Covers all three audiences at their entry points.
- **Layer 2 (cheap, early):** Homebrew tap + winget manifest — automated in the release pipeline.
- **Layer 3 (on demand):** choco/scoop buckets, self-hosted apt/yum repo, npm download-shim.
- **Layer 4 (popularity-gated, maybe never):** homebrew-core, official distro repos — needs OSS.

## Related Notes
- [runtime-and-packaging.md](./runtime-and-packaging.md) — the binary all channels wrap
- [code-signing-and-trust.md](./code-signing-and-trust.md) — installers and scripts both need signing
- [updates-and-self-upgrade.md](./updates-and-self-upgrade.md) — which channel owns updates
- [open-vs-closed-source.md](./open-vs-closed-source.md) — core-repo vs tap is the only OSS-gated delta
- [Tool Matrix](./tool-matrix.md) — channel coverage across 15 CLIs
