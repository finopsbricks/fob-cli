# Updates & Self-Upgrade

Installing once is the easy half; getting a **non-technical user onto a new version** is the half
that quietly decides whether they're running six-month-old software with a fixed bug still biting
them. A finance user will never re-run a curl command or re-download an installer on their own.

## The two schools

| School | Mechanism | Best for | Precedent |
|---|---|---|---|
| **Self-updating binary** | `fob upgrade` (or auto-check + prompt) fetches & swaps itself | **non-devs** — no package manager needed | `deno upgrade`, `rustup update`, `bun upgrade`, `uv self update` |
| **Defer to the package manager** | `brew upgrade` / `winget upgrade` updates it | engineers who installed that way | `gh` (updates via its installer's manager) |

These aren't exclusive — the rule mature tools follow: **whoever installed it should own updating
it.** A binary installed by the curl script / native installer self-updates via `fob upgrade`; a
binary installed by brew/winget is updated by brew/winget (self-update should *detect* that and defer,
not fight the package manager).

## What `fob upgrade` should do (the non-dev path)

Because the primary audience has no package manager, the **self-updating binary is the baseline**:

1. `fob upgrade` (and a gentle, throttled "a new version is available" hint on normal runs — not
   nagging, once per day max, to stderr).
2. Check the release manifest / catalog for the latest signed version.
3. Download + **verify signature/checksum** + atomically swap the binary in `~/.fob/bin`.
4. Report old → new version. Refuse (with a clear message) if installed via a package manager —
   *"installed via Homebrew; run `brew upgrade fob`."*

This is `deno upgrade` — the least-friction path for someone who can't be asked to know how they
installed anything.

## The family wrinkle: version skew across N tools

A monolith updates atomically. **Separate siblings** ([family-install-model.md](./family-install-model.md))
can drift — `fob-email` v2 alongside `fob-orc` v0.4 — which matters if they share a config schema or
an auth contract. Options:

- **`fob upgrade --all`** — upgrade the dispatcher *and* every installed sibling in one command,
  reusing the catalog. The one-command answer for non-devs.
- **`fob doctor`** flags skew — "fob-email is 3 versions behind; run `fob upgrade --all`."
- **A family version floor** in the catalog — `fob` warns if an installed sibling is below the minimum
  it's compatible with (mirrors the `engines` field, but enforced across binaries).

gcloud is the precedent: `gcloud components update` updates the SDK **and** its sub-components
together — exactly the `fob upgrade --all` shape.

## The tradeoff

- **Self-updating binary:** non-devs stay current with one command (or automatically) — but you own an
  update server/manifest, atomic-swap correctness, and signature verification on the update path (a
  malicious update is a supply-chain risk, so the verify step is not optional).
- **Package-manager-only:** zero update code to maintain and users get updates through a channel they
  trust — but it excludes the entire no-package-manager primary audience, who would simply never
  update.

You need **both**, routed by install source.

## Layering view

- **Baseline:** `fob upgrade` self-update for curl/installer users — download, **verify signature**,
  atomic swap. This is what keeps the finance audience current at all.
- **Layer 2:** `fob upgrade --all` + `fob doctor` skew detection across installed siblings; a
  compatibility floor in the catalog.
- **Layer 3:** opt-in background auto-update (silent, verified) for users who want zero-touch;
  package-manager channels (brew/winget) carry updates for engineers who chose them, with self-update
  detecting and deferring to them.

Baseline doesn't foreclose the layers: self-update is a thin command over the same
download+verify+catalog machinery the install script and `fob install` already use.

## Related Notes
- [family-install-model.md](./family-install-model.md) — why separate siblings create skew
- [distribution-channels.md](./distribution-channels.md) — package managers own updates for their installs
- [code-signing-and-trust.md](./code-signing-and-trust.md) — the update path must verify signatures (supply-chain)
- [Tool Matrix](./tool-matrix.md) — self-update mechanisms across tools
