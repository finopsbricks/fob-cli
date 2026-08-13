# WIP — Evaluating alternatives to yargs

**Status:** open, not started. No recommendation yet.
**Opened:** 2026-08-13
**Decision this would revisit:** [D1 — yargs as CLI framework](../decisions/0001-yargs-as-cli-framework.md)

## Why this is open

[D1](../decisions/0001-yargs-as-cli-framework.md) records that yargs was adopted in Feb 2026 for
**shell completion + auto-generated help**, replacing hand-rolled `switch`/`parse()`. It also records
that **no alternative was ever compared** — the choice was hand-rolled vs. a framework, not framework
vs. framework.

That is a reason to look once. It is *not* a reason to move. Six repos are on yargs `^17.7.2` and it
works; the bar for switching is high and this doc should be expected to conclude "stay."

The prompt for looking now: yargs' help renderer has proven inflexible (deliberate full command
paths, no formatter API — see
[cli-help-readability](../../fob-worker/docs/wip/cli-help-readability.md)), and help generation was
one of the two reasons it was picked.

## The hard requirement

**Dynamic shell completion.** `fob steps run <TAB>` enumerates step slugs by reading the filesystem
at completion time — `getStepSlugs()` returns a promise, and yargs' `.completion()` callback accepts
one. Any candidate must support async/dynamic completion, not just static command-name completion.

A candidate that fails this is out, regardless of how good its help output is.

## Secondary criteria

| # | Criterion | Why it matters here |
|---|---|---|
| 1 | Dynamic completion | **Hard requirement** — see above |
| 2 | Help output control | The friction that prompted this doc |
| 3 | Nested subcommands | `fob <resource> <action>` is two levels, sometimes three |
| 4 | Dependency footprint | Six CLIs ship this; `@fob/cli` is proudly zero-dep |
| 5 | Startup time | These are interactive tools run constantly |
| 6 | ESM-native | The whole family is `"type": "module"` |
| 7 | Maturity / maintenance | Must outlive the decision |
| 8 | Migration cost | Six repos × copied skeleton |

## Candidates — raw facts

Sourced 2026-08-13 from official docs and package data. Following the
[cli-industry-research](./cli-industry-research/tool-matrix.md) convention: facts here,
interpretation below. **Gaps are marked `?` rather than guessed.**

| Tool | Downloads/wk | Deps | Cold start | Help customization | Dynamic completion |
|---|---|---|---|---|---|
| **yargs** (current) | ~30M | ~7 | ~35–42ms | ✗ no formatter API | ✅ `.completion()` w/ promise |
| commander | ~35M | 0 | ~18–22ms | ✅ `Help` class, `.configureHelp()`, `.createHelp()` | ✗ not documented |
| oclif | ~200K | ~30 | ~85–120ms | ✅ plugin-help (replaceable) | ? |
| citty | ? | 0 | ? (native `util.parseArgs`) | partial — `renderUsage()` / `showUsage()` | ✗ not documented |
| cac | ? | ? | ? | ? | ? |
| clipanion | ? | ? | ? | ? | ? |

Startup/dependency figures are from a secondary source
([PkgPulse](https://www.pkgpulse.com/guides/best-cli-frameworks-nodejs-2026)), not measured here —
**benchmark before relying on them.**

### Notes per candidate

**commander** — the sharpest trade in the table. It has precisely what yargs lacks: a documented
`Help` class you can subclass or configure (`.configureHelp()`, `.createHelp()`, `sortSubcommands`,
`showGlobalOptions`, `.styleTitle()`) to control command-list layout. It is also zero-dependency and
roughly 2× faster to start. **But shell completion is not in its documented feature set** — which is
the one thing yargs was chosen for. Unless completion can be supplied another way, this fails the
hard requirement. *Needs verification: is there a maintained completion plugin, and does it do
dynamic values?*

**oclif** — built by Salesforce for Heroku/Salesforce CLIs; designed for hundreds of commands and a
plugin ecosystem. Help is a replaceable plugin, so full control. Costs ~30 dependencies and ~85–120ms
startup — 3–5× yargs. Almost certainly over-engineered for a 7-command tree, and the startup cost is
real for tools run this often.

**citty** (unjs) — zero-dep, built on Node's native `util.parseArgs`, nested subcommands with lazy
imports. `renderUsage()`/`showUsage()` are exposed, so help is at least partly controllable.
**No documented shell completion.** Smaller ecosystem (~1.3k stars).

**cac**, **clipanion** — not yet researched. Clipanion is the engine behind Yarn Berry, so it is
proven at scale. Both need a pass.

## Open questions

1. **Does commander have viable dynamic completion?** This single question probably decides the
   evaluation. If yes, commander is a serious candidate (better help control, zero deps, faster). If
   no, it is disqualified and yargs likely stays.
2. **Is `util.parseArgs` (Node native) enough on its own?** `@fob/cli` already proves a zero-dep CLI
   is viable here. If completion were hand-rolled once and copied, a framework might be unnecessary
   for the simpler CLIs. Larger question than it appears.
3. **Can the help problem be solved without switching?** Cheapest option remains shortening
   descriptions so nothing wraps —
   [cli-help-readability](../../fob-worker/docs/wip/cli-help-readability.md). If that suffices, this
   whole evaluation is moot.
4. **What does migration actually cost?** Six repos, each with a copied skeleton. The copy rule means
   a swap can be **piloted in one CLI** first — which one is the cheapest guinea pig?

## Not doing

- **No migration on the strength of this doc.** It gathers facts. Any switch needs its own decision
  record superseding [D1](../decisions/0001-yargs-as-cli-framework.md).
- **No partial migration.** Six CLIs on two frameworks is worse than six on a flawed one. Either
  pilot-then-commit, or stay.

## Next steps

1. Resolve open question 1 (commander + dynamic completion) — highest information per unit effort.
2. Fill the `?` cells for cac and clipanion.
3. Benchmark startup locally rather than trusting the secondary source.
4. Only then: recommend, or close as "stay on yargs."

## Sources

- [PkgPulse — Best CLI frameworks for Node.js 2026](https://www.pkgpulse.com/guides/best-cli-frameworks-nodejs-2026)
- [commander.js README](https://github.com/tj/commander.js) — `Help` class, `.configureHelp()`
- [citty README](https://github.com/unjs/citty) — zero-dep, `util.parseArgs`, `renderUsage()`
- [yargs API docs](https://github.com/yargs/yargs/blob/main/docs/api.md) — "no dedicated help formatter"
