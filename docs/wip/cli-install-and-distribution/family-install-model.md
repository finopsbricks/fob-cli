# Family Install Model — Monolith vs. Separate Siblings

We don't ship one CLI; we ship a dispatcher (`fob`) plus N siblings (`fob-email`, `fob-orc`,
`fob-stm`, `fob-worker`, …). Alex wants both "install `fob` and get everything" **and** "install
`fob-email` separately if you want." Those pull opposite ways. This note maps the archetypes and the
`git`-style hybrid that satisfies both.

## The two archetypes

| Model | Shape | Install UX | Precedent |
|---|---|---|---|
| **Monolith** | one binary contains every subtool; `fob email …` dispatches **internally** | one install = everything; one update | AWS CLI (everything in `aws`) |
| **Host + catalog** | small `fob` host that **lists** and **installs** siblings on demand | install `fob`, then `fob install <tool>` | gcloud `components`, `gh extension`, `krew` |

Today we're neither cleanly: `fob` is a **pure PATH-discovery dispatcher** (the `git` model — any
`fob-<tool>` executable on PATH becomes `fob <tool>`), with **no catalog**, so it can list what's
*installed* but has no idea what's *available*.

## Why each pulls a different way for our audience

- **Accountant:** wants the monolith. "Install fob, you have what you need." Being told "now also
  install fob-email" is friction and a failure point. Batteries-included wins.
- **Engineer:** wants separability. Drop a custom `fob-foo` on PATH; install only what they use;
  version tools independently. PATH discovery wins.
- **Release velocity:** a monolith means every subtool change re-releases the whole binary; separate
  siblings ship independently. Leans toward separable for a 20-CLI future.

## The resolution: `git`-style hybrid (built-ins + externals + a catalog)

`git` already solved this: it has **built-in** subcommands compiled into the binary **and** runs
**external** `git-<x>` found on PATH, transparently. `gh` adds the missing half — `gh extension
install` to *fetch* externals, and it *lists* them. Combine both:

1. **Batteries-included default bundle.** The `fob` install ships the common set (email/orc/stm/
   worker) — whether compiled in (monolith-style) or as sibling binaries dropped next to `fob` by the
   installer. The accountant gets everything from one install.
2. **Keep PATH discovery** (today's `src/dispatch.js`) so engineers can drop any `fob-<tool>` on PATH
   and it just works — no re-release of `fob` needed. This is our existing strength; don't lose it.
3. **Add a catalog** so `fob` knows what *exists* beyond what's *installed*, enabling
   `fob install <tool>` for the middle tier.

This gives all three audiences their model without forcing one on the others.

## The catalog (the one genuinely new piece)

Today discovery is PATH-only → `fob` can't show "available but not installed." Add a small **catalog
manifest**: a static JSON listing known family members + per-platform download URLs + versions.

- **Where:** bundled inside the `fob` binary (works offline), optionally refreshed from
  `https://fob.io/catalog.json` (so new siblings appear without upgrading `fob`).
- **Used only for** the "available / install" affordance and `fob doctor`. **Dispatch stays
  PATH-based** — the catalog never gates running an installed tool, so a hand-dropped custom
  `fob-foo` still works even though it's not in the catalog.
- Shape (sketch):
  ```json
  { "tools": [
    { "name": "email", "summary": "send & fetch mailboxes",
      "bin": { "darwin-arm64": "https://.../fob-email-darwin-arm64", "win32-x64": "…" } },
    { "name": "recon", "summary": "reconciliation", "bin": { … } }
  ] }
  ```

`fob install <tool>` then reuses the install-script's **download + verify + drop-in-`~/.fob/bin`**
logic ([distribution-channels.md](./distribution-channels.md)) — no package manager, no Node, works
on a locked-down machine. This is the `gh extension install` / `gcloud components install` feel.

## The tradeoff

- **Monolith:** simplest UX (one thing to install/update, no "which siblings do I have?" confusion),
  but couples release cycles and bloats the binary as the family grows to 20.
- **Separate siblings:** independent releases and true modularity (our current model's strength), but
  raises "you also need to install X" friction and version-skew questions across the family.
- **Hybrid (recommended):** batteries-included *feel* + separable *mechanics* + a catalog for
  discovery/install. Costs the catalog manifest and a `fob install` command — small, and paid once for
  the family.

## Layering view

- **Baseline:** keep PATH discovery (as-is); ship a batteries-included install so `fob` arrives with
  the common siblings already present. Accountant is served on day one with zero extra concepts.
- **Layer 2:** add the bundled catalog + `fob install <tool>` / `fob remove <tool>` — the host+catalog
  affordance, reusing the install script's download/verify. Serves the middle tier.
- **Layer 3:** remote-refreshable catalog (`fob.io/catalog.json`) so new siblings and `fob-<tool>`
  versions surface without upgrading `fob` itself.

Baseline doesn't foreclose the layers: the catalog is **additive metadata** over a dispatcher that
already runs whatever is on PATH, so adding install/list never changes how an installed tool runs.

## Related Notes
- [onboarding-and-discovery.md](./onboarding-and-discovery.md) — how the catalog surfaces in `fob`'s UX
- [distribution-channels.md](./distribution-channels.md) — `fob install` reuses the download/verify logic
- [updates-and-self-upgrade.md](./updates-and-self-upgrade.md) — updating N siblings vs one monolith
- [cli-industry-research: config-location.md](../cli-industry-research/config-location.md) — the `~/.fob/<tool>/` family-root nesting this mirrors
- [Tool Matrix](./tool-matrix.md) — git / gh / gcloud / krew family models
