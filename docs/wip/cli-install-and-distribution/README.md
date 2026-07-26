# CLI Install & Distribution — Industry Research

How mature CLIs get themselves onto a user's machine — surveyed to decide how the `fob` dispatcher
and the wider `fob-<tool>` family should ship, install, update, and onboard. Sibling folder to
[cli-industry-research](../cli-industry-research/README.md) (which covered config/secrets/profiles);
this one covers the **install and distribution** dimension that research left untouched.

This folder is **knowledge for decision-making**, not decisions. Read it, then we decide in the WIP
tracker.

## The guiding principle

Carries over the family lens from the config research — we are building toward **20+ CLIs**, so
optimize for **release velocity**, **low day-one complexity**, and **layered** rollout (a
secure/simple baseline that doesn't foreclose the advanced layer). Installation adds one more lens
that dominates all of them:

**Audience-first.** The primary user is an **accountant / finance professional**, then a founder,
then an engineer. That inverts every default CLI install assumption:

1. **No runtime.** They do not have Node and must never learn what it is. Any "install Node first"
   step is a dealbreaker. → self-contained binaries, not `npm i -g`.
2. **No terminal fluency.** "Paste this curl command" is already advanced. A double-clickable
   installer beats a one-liner beats a package manager, *for this audience*.
3. **Windows-heavy.** Finance/accounting skews Windows, not Mac. Do not under-invest in Windows.
4. **OS gatekeepers stop them cold.** macOS Gatekeeper and Windows SmartScreen throw scary warnings
   on unsigned binaries; a non-technical user *stops there*. → code-signing is non-negotiable.
5. **Locked-down machines.** Corporate finance boxes often have no admin rights / MDM. → per-user
   install, no `sudo`, no system dirs.

Every note is read through this lens: *what is the lowest-prerequisite, most-trusted way to get a
working tool onto this person's machine — and does the simple baseline foreclose the engineer-tail
channels?*

## The notes (one decision dimension each)

| Note | The question it answers | Our status today |
|---|---|---|
| [runtime-and-packaging.md](./runtime-and-packaging.md) | ship a runtime prereq (`npm i -g`) or a self-contained binary? | **npm-only, Node-required — the big gap** |
| [distribution-channels.md](./distribution-channels.md) | curl-script vs package managers vs native installers — which, for whom? | none yet (repo not published) |
| [code-signing-and-trust.md](./code-signing-and-trust.md) | how to clear Gatekeeper / SmartScreen so non-devs don't bail | not started — **blocking for the audience** |
| [open-vs-closed-source.md](./open-vs-closed-source.md) | does going OSS actually make install easier? | closed today; decision open |
| [family-install-model.md](./family-install-model.md) | one batteries-included `fob` vs N separately-installed siblings | pure PATH discovery, no catalog |
| [updates-and-self-upgrade.md](./updates-and-self-upgrade.md) | how users get new versions without re-downloading | none yet |
| [onboarding-and-discovery.md](./onboarding-and-discovery.md) | first-run UX: what's installed, `fob install`, `doctor`, cross-tool config | bare `fob` lists PATH tools only |
| [tool-matrix.md](./tool-matrix.md) | raw per-tool facts (how 15 CLIs actually ship) | reference appendix |

## What the research settled vs left open

- **Settled (strong precedent, adopt):** self-contained binaries are the only viable *primary*
  channel for a non-dev audience (AWS CLI v2 abandoned pip for exactly this reason); code-signing +
  notarization is mandatory, not optional; a `curl | sh` / `iwr | iex` installer is the universal
  closed-source-friendly baseline; keep `npm i -g` only as the engineer-tail channel.
- **Open (needs a decision — see the WIP tracker):** which compiler (Bun `--compile` vs Node SEA);
  batteries-included monolith vs separate siblings + `fob install`; whether to go open source (and
  on which grounds — install ease is *not* one of them); which package-manager channels are worth the
  maintenance beyond a curl script + one native installer per OS.

## The headline finding

**Open source barely changes install ease.** Every channel the audience actually needs — a signed
`.pkg`/`.msi`, a `curl | sh` script, a Homebrew *tap*, `winget` — works fine for closed-source
binaries. OSS only unlocks the *default* community repos (homebrew-**core**, official apt/AUR), which
are popularity-gated and years away, never a launch lever. Decide OSS on **trust / GTM / contributor**
grounds; see [open-vs-closed-source.md](./open-vs-closed-source.md). The binaries you'd build for the
audience *also* happen to be what lets you stay closed-source (npm ships readable JS) — the two goals
point the same way.

## Lifecycle of this folder

These are **draft knowledge** staged in `docs/wip/` while we digest them. Per
[knowledge-vs-reports](/Users/alex/ec2code/alex/engineering-standards/principles/documentation/knowledge-vs-reports.md),
timeless conclusions eventually **graduate** into the durable standard
(`engineering-standards/cli/`), and the raw survey is archived. Live decisions/status live in the WIP
tracker, not here.

## Related
- [cli-industry-research](../cli-industry-research/README.md) — sibling folder: config, secrets, profiles
- [parent WIP: cli-standards-and-wrappers.md](../cli-standards-and-wrappers.md) — the family effort
- [src/dispatch.js](../../../src/dispatch.js) — today's PATH-discovery dispatcher this research will extend
