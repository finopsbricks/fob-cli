# Code Signing & OS Gatekeepers

The dimension that decides whether a non-technical user *completes* the install or bails at a scary
dialog. Signing is about **identity, not source** — it is required whether or not we go open source,
and it is the one item on this list that has no cheap baseline: you either pay for certs or your
finance users hit warnings and stop.

## What the OS throws at an unsigned binary

| OS | Gatekeeper | What the user sees (unsigned) | What clears it |
|---|---|---|---|
| **macOS** | Gatekeeper / Notarization | *"'fob' cannot be opened because it is from an unidentified developer"* — double-click **blocked** | Developer ID signature **+ notarization** (Apple scans & stamps the binary) |
| **Windows** | SmartScreen / Defender | *"Windows protected your PC — Unknown publisher"* blue box; AV may quarantine | Authenticode signature; **EV cert** clears it instantly, OV earns reputation over downloads |
| **Linux** | none | (nothing) | — (checksum/signature verification is the norm, not OS-enforced) |

For an accountant, the macOS "unidentified developer" block and the Windows "Unknown publisher"
warning are **full stops** — they read as "this is malware" and the install ends there. This is the
highest-leverage, least-glamorous investment in the whole plan.

## What it costs

| Platform | What you buy | Rough cost | Mechanics |
|---|---|---|---|
| macOS | Apple Developer Program → **Developer ID Application/Installer** cert | **$99/yr** | sign with `codesign`, notarize via `notarytool`, `staple` the ticket to `.pkg`/binary |
| Windows | **Authenticode** code-signing cert (OV or EV) | **OV ~$200–400/yr; EV higher** | sign `.msi`/`.exe` with `signtool`; since 2023 the private key must live on **hardware/HSM** (or a cloud signing service) |
| Linux | GPG key for repo/checksum signing | free | sign the checksums manifest / apt-repo metadata |

Total is roughly **$300–500/yr for the family** (one cert set covers every `fob-<tool>` binary —
another reason signing is a family-level, not per-tool, cost). EV on Windows is worth it if the
finance-Windows majority is the priority, because it removes the SmartScreen warning **on day one**
instead of after thousands of downloads build reputation.

## The curl-installer shortcut (partial, not a substitute)

A binary installed by `curl | sh` into `~/.fob/bin` and run from the terminal **does not trigger the
macOS double-click Gatekeeper dialog** the same way — Gatekeeper's quarantine flag is set on
*downloaded* files opened via Finder, and CLI-invoked binaries get a softer path (though notarization
is still strongly recommended and `spctl` can still complain). This is why rustup/deno/bun get away
with lighter friction on the curl path.

**But it doesn't save the primary audience** — they use the *double-click installer*, which is
squarely in Gatekeeper/SmartScreen's path. So the shortcut helps the engineer/founder curl channel,
not the accountant installer channel. Sign and notarize regardless.

## Who does what

- **Signed + notarized everywhere:** AWS CLI v2, gh, ollama, Docker Desktop — every tool with a
  non-trivial non-dev audience. This is table stakes for consumer-facing distribution.
- **Signed, reputation-based:** rustup/deno/bun lean on the curl path + earned SmartScreen reputation
  rather than EV certs — acceptable because their audience is developers who click through warnings.

We are in the **first camp** by audience, not the second.

## The tradeoff

- **Sign + notarize:** ~$300–500/yr, a hardware token / cloud-signing setup, and notarization added to
  the release pipeline — but the primary audience can actually install, and every channel (installer,
  curl, package managers) inherits the trust.
- **Skip it:** $0 and simpler — but the finance user hits a malware-looking warning and never becomes
  a user. For this audience, unsigned ≈ unshipped.

There is genuinely no secure-*enough* free baseline here the way there was for secret storage; the
baseline **is** paying for certs. The only staging is *which* cert first.

## Layering view

- **Baseline (required for launch to the finance audience):** Apple Developer ID + notarization for
  macOS; Windows Authenticode. Wire signing + notarization into the release pipeline so every binary
  and installer ships stamped.
- **Layer (Windows priority upgrade):** **EV** cert to kill SmartScreen warnings on day one rather
  than earning reputation slowly — justified because finance skews Windows.
- **Layer (Linux/verification):** GPG-signed checksums manifest so the install script and any hosted
  apt/yum repo can verify authenticity.

Unlike other dimensions, the "baseline" is not free — but it's still staged: notarize+OV first, add EV
and GPG as the audience and channels grow.

## Related Notes
- [distribution-channels.md](./distribution-channels.md) — installers vs curl differ in how much signing they need
- [runtime-and-packaging.md](./runtime-and-packaging.md) — the binary that gets signed
- [open-vs-closed-source.md](./open-vs-closed-source.md) — signing ≠ source; required either way
- [Tool Matrix](./tool-matrix.md) — signing status across tools
