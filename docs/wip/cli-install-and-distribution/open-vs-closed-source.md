# Open vs Closed Source — the Install-Ease Question

Alex's explicit question: *how much easier is installation if the CLIs are open source vs closed?*
The honest, slightly surprising answer: **barely any easier.** Every install channel the audience
needs works closed-source. Decide OSS on other grounds — this note isolates the install-ease delta so
it can be *removed* from the OSS debate.

## Channel-by-channel: does closed-source block it?

| Channel | Closed-source works? | Why |
|---|---|---|
| Signed `.pkg` / `.msi` installer | ✅ | signing proves identity, not openness |
| `curl \| sh` / `iwr \| iex` | ✅ | just downloads your hosted binary |
| **Homebrew *tap*** (`brew install finopsbricks/tap/fob`) | ✅ | a tap can point at a closed binary; this is how most commercial CLIs ship on Mac |
| **winget** | ✅ | manifest references your signed installer URL + hash; closed apps welcome |
| **choco / scoop** | ✅ | same — point at the installer/binary |
| **self-hosted apt/yum repo** | ✅ | you host it; publish signed `.deb`/`.rpm` |
| npm | ✅ but **leaks JS** | npm ships readable source |
| **homebrew-*core*** (`brew install fob`, no tap) | ❌ needs OSS | + must be "notable"; popularity-gated |
| **official** Debian/Fedora/AUR | ❌ mostly needs OSS | long-tail, community-maintained |

**The delta is only the last two rows** — the *default* community repos. And those are gated on
popularity anyway (homebrew-core rejects niche tools; distro inclusion takes years and a maintainer).
So going OSS buys you *eventual eligibility for channels you wouldn't qualify for at launch regardless*.
That is not a launch lever. **Install ease is ~identical open or closed.**

## The Homebrew tap vs core distinction (the crux)

Most people assume "closed source ⇒ no Homebrew." False. Homebrew has two worlds:
- **homebrew-core** — the default `brew install <name>`. Needs open source, buildable from source,
  and notability. You won't be here early even if OSS.
- **a tap** — `brew tap finopsbricks/tap` → `brew install finopsbricks/tap/fob`. A tap can host a
  **binary formula or cask pointing at a closed-source release**. Datadog, 1Password, MongoDB, Sentry,
  and countless commercial CLIs ship this way. **Fully available to us, closed-source.**

Same story for winget/choco/scoop: all accept closed-source apps pointing at a hosted installer.

## What OSS *actually* changes (not install ease)

The real levers, to weigh separately:

1. **Trust / security review.** Finance customers' security teams may want to read the source before
   allowing a CLI that touches statements/mailboxes on corporate machines. This is a *trust/sales*
   argument, and a real one for our domain — but it's about clearing procurement, not about install
   friction.
2. **GTM / credibility.** A public repo, stars, and issues signal a real project; some buyers weight
   it. Marketing, not mechanics.
3. **Contributors & bug reports.** Community PRs/issues — value depends on whether we want external
   contribution.
4. **Auditability of what runs on the machine.** Overlaps with (1); mitigable closed-source via
   signing + reproducible builds + a published SBOM.

## The closed-source ↔ binary alignment (a happy coincidence)

If staying closed-source matters at all, note that **npm ships readable JS** — so the closed-source
goal *forces* us off `npm i -g` as the primary channel and onto **compiled binaries**
([runtime-and-packaging.md](./runtime-and-packaging.md)). But compiled binaries are exactly what the
**non-dev audience needs** anyway. So:

> The work you do to stay closed-source (ship binaries, not JS) is the *same* work you do to serve
> accountants (no Node prerequisite). The two goals point the same direction — there's no tension to
> resolve.

## The tradeoff

- **Open source:** unlocks *eventual* default-repo eligibility (low, late value), buys trust/GTM/
  contributor upside, exposes IP and invites a support surface.
- **Closed source:** keeps IP, still reaches every launch-relevant channel via installers/curl/tap/
  winget, but must invest in signing + reproducible-build/SBOM trust signals to reassure security
  teams, and can't lean on community default repos later.

Crucially, **install ease is not on either side of this tradeoff** — it's a wash. Take it off the
table and decide OSS on trust/GTM/IP.

## Layering view

- **Baseline:** ship closed-source signed binaries via curl script + native installers + a Homebrew
  **tap** + winget. Reaches every launch-relevant audience with source private.
- **Layer (trust, if enterprise finance demands it):** reproducible builds + published SBOM +
  third-party audit — closed-source trust without opening the repo.
- **Layer (if OSS is chosen later on GTM/trust grounds):** publish source, then pursue homebrew-core
  and distro inclusion as they become eligible. Nothing about the baseline blocks this — the binaries
  and channels are unchanged; only the repo's visibility flips.

Going open later costs nothing we'd have to undo; going closed now forecloses nothing at launch. So
this decision can be **deferred** without penalty — ship the binaries either way.

## Related Notes
- [runtime-and-packaging.md](./runtime-and-packaging.md) — npm-leaks-JS is why closed-source ⇒ binaries
- [distribution-channels.md](./distribution-channels.md) — tap vs core, winget for closed apps
- [code-signing-and-trust.md](./code-signing-and-trust.md) — signing is required regardless of OSS
- [Tool Matrix](./tool-matrix.md) — most surveyed tools are OSS *and* still ship binaries + taps; the two are independent
