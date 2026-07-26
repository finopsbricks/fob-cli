# CLI Config & Secrets — Industry Research

How mature CLIs handle profiles, config storage, and secret management — surveyed to decide what
`fob-stm` (and the wider `fob-<tool>` family) should do. This folder is **knowledge for
decision-making**, not decisions. Read it, then we decide in the WIP tracker.

## The guiding principle (Alex, 2026-07-25)

We are building toward **20+ CLIs**. Optimize for:

1. **Release velocity** — a new wrapper ships fast; auth is not a per-tool research project.
2. **Low day-one complexity** — neither the maintainer nor the user drowns on the first release.
3. **Layered security** — start with a simple, secure-*enough* baseline and add advanced security
   (keychain, scoped/short-lived tokens) as **opt-in layers over time**, without reworking the base.

Every note below is read through this lens: *what is the simplest baseline that is secure-enough
now and does not foreclose the advanced layer?* Each ends with a **Layering view** answering exactly
that.

## The notes (one decision dimension each)

| Note | The question it answers | Our status today |
|---|---|---|
| [secret-storage.md](./secret-storage.md) | plaintext file vs OS keychain vs helper | plaintext `0600` — **the big open decision** |
| [config-location.md](./config-location.md) | `~/.fob-stm/` vs XDG `~/.config/` | dotdir; XDG optional/cosmetic |
| [profiles-and-switching.md](./profiles-and-switching.md) | naming & switching multiple accounts | done & correct (`org` model) |
| [credential-precedence.md](./credential-precedence.md) | flag vs env vs config; the CI env var | done & correct |
| [global-vs-project-config.md](./global-vs-project-config.md) | one file vs split secret/metadata | one mixed file; split enables keychain |
| [token-types-and-lifecycle.md](./token-types-and-lifecycle.md) | long-lived key vs scoped/short-lived | long-lived (API-gated) |
| [tool-matrix.md](./tool-matrix.md) | raw per-tool facts (14 CLIs) | reference appendix |

## What the research settled vs left open

- **Settled (adopt as-is, we already match):** precedence `flag > env > config`; a named-entity +
  active-pointer + `use` + per-command-flag profile model; one dir-override env var; `0600` on any
  plaintext file.
- **Open (needs a decision — see the WIP tracker):** secret storage (plaintext vs keychain, and
  whether to split secret from metadata now to enable it later); XDG adoption; whether a rotation/
  scoped-token roadmap is worth pursuing with the statements API team.

## Lifecycle of this folder

These are **draft knowledge** staged in `docs/wip/` while we digest them. Per
[knowledge-vs-reports](/Users/alex/ec2code/alex/engineering-standards/principles/documentation/knowledge-vs-reports.md),
timeless conclusions eventually **graduate** into the durable standard
(`engineering-standards/cli/`), and the raw survey can be archived. The live decisions/status live
in the WIP tracker, not here.

## Related
- [WIP tracker: cli-config-and-secrets.md](../cli-config-and-secrets.md) — decisions, phases, status
- [engineering-standards: cli/auth-patterns.md](/Users/alex/ec2code/alex/engineering-standards/cli/auth-patterns.md) — the current standard this research will refine
- [parent WIP: cli-standards-and-wrappers.md](../cli-standards-and-wrappers.md) — the parent family effort (Phase 3 = fob-stm)
