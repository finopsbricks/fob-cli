# Onboarding & Discovery

Install gets a binary onto the machine; onboarding turns it into a working, configured tool the user
trusts. This note covers the **first-run UX** and the cross-tool surfaces Alex sketched — `fob`
showing installed vs available, `fob install`, `fob doctor`, and a cross-tool `fob config list`.

## What bare `fob` should show (installed vs available)

Today `fob` lists only PATH-discovered tools — it can't show what *exists but isn't installed*. With
the catalog ([family-install-model.md](./family-install-model.md)), the listing becomes actionable:

```
fob — the FinOpsBricks toolbelt

Installed:
  ✓ email    v1.2.0   send & fetch mailboxes
  ✓ orc      v0.4.1   orchestration stations
  ✓ worker   v0.9.0   worker processes

Available:
  ○ stm      statements ingest      → fob install stm
  ○ recon    reconciliation         → fob install recon

Run `fob <tool> --help`, or `fob install <tool>` to add one. `fob doctor` checks your setup.
```

Installed rows come from **PATH discovery** (+ the tool's version); available rows are catalog entries
not found on PATH. Small change, big orientation win — the user sees the whole family and how to grow
into it.

## `fob doctor` — the trust-and-debug command

Every mature multi-part tool has one (`brew doctor`, `flutter doctor`, `gh` status). For us it's the
single best onboarding and support asset:

```
fob doctor
  ✓ fob v1.3.0 on PATH (~/.fob/bin)
  ✓ ~/.fob/bin is on your PATH
  ✓ email   v1.2.0   config ✓   auth ✓ (org: acme-prod)
  ⚠ orc     v0.4.1   config ✓   auth ✗  → run `fob orc login`
  ○ worker  v0.9.0   config —   (not configured)
  ⚠ email is 3 versions behind → `fob upgrade --all`
```

Checks per installed tool: on-PATH, version (+ skew vs catalog), config presence, auth validity, PATH
health. It turns "it doesn't work" support tickets into a self-serve diagnosis.

## `fob config list` — cross-tool config surfacing (Alex's instinct)

Alex's `fob config profiles list` idea is right and dovetails with the config research's profile model
(the `org` + `current_org` + `config use` + `--org` shape, already
[settled](../cli-industry-research/profiles-and-switching.md)). The dispatcher aggregates each tool's
status into one view:

```
fob config list
  TOOL     ORG          API              SOURCE
  email    acme-prod    mail.fob.io      config
  orc      acme-prod    api.fob.io       env (FOB_ORG)
  worker   (none set)   —                —
```

**What it requires:** a standard machine-readable status contract every sibling implements —
`fob-<tool> config status --json` — that the dispatcher fans out to and tabulates. The config research
already noted each tool resolves a `source` string (flag vs env vs stored); this just **standardizes
its `--json` output into a family contract** so `fob` can aggregate without knowing each tool's
internals. Worth adding to the CLI standard alongside the existing `config status` recommendation.

This also answers "what's installed and configured vs not" from the config angle, complementing the
`fob` listing (installed vs available) and `fob doctor` (healthy vs broken).

## First-run onboarding flow (the non-technical happy path)

1. **Get `fob` on the machine** — one action (signed `.msi`/`.pkg` double-click, or `curl | sh`);
   see [distribution-channels.md](./distribution-channels.md).
2. **Bare `fob` with nothing configured** → friendly welcome, not a usage dump: *"Welcome. Connect
   your account with `fob login`."* Batteries-included means the common siblings are already present.
3. **`fob login`** → browser/token flow, stores per the secret-storage standard. One identity can seed
   all siblings (shared `~/.fob/` root), so the accountant logs in once, not four times.
4. **`fob doctor`** → confirms everything green.
5. Ongoing: **`fob upgrade`** keeps them current ([updates-and-self-upgrade.md](./updates-and-self-upgrade.md)).

The design goal: a finance user goes from download to a working, authenticated tool **without opening
a terminal in the happy path, and without learning what Node, PATH, or a package manager is.**

## The tradeoff

- **Rich discovery (listing + install + doctor + config list):** dramatically better onboarding and
  self-serve support for non-devs — but it needs the catalog and a standardized `config status --json`
  contract across every sibling (a family-wide convention to maintain).
- **Minimal (today's PATH-only listing):** nothing new to build — but the user can't discover, install,
  diagnose, or see cross-tool config, so every one of those becomes a support conversation.

The contract cost is paid once and enforced by the CLI standard; each new `fob-<tool>` implements
`config status --json` and slots into all four surfaces for free (release-velocity lens).

## Layering view

- **Baseline:** upgrade bare `fob` to show **installed** tools with versions + a one-line summary
  (pure PATH, no catalog needed yet). Add the empty-state welcome + `fob login`.
- **Layer 2:** catalog-powered **available/`fob install`** rows; `fob doctor`.
- **Layer 3:** `fob config list` cross-tool aggregation via the standardized `fob-<tool> config status
  --json` contract; skew/auth warnings folded into `doctor`.

Baseline doesn't foreclose the layers: each surface is additive over PATH discovery + a per-tool JSON
status the config standard already points toward.

## Related Notes
- [family-install-model.md](./family-install-model.md) — the catalog that powers listing + `fob install`
- [updates-and-self-upgrade.md](./updates-and-self-upgrade.md) — `fob doctor` surfaces version skew
- [cli-industry-research: profiles-and-switching.md](../cli-industry-research/profiles-and-switching.md) — the `org`/`config status` model `fob config list` aggregates
- [src/dispatch.js](../../../src/dispatch.js) — today's `formatToolList`, the starting point for the richer listing
