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
one.

**Revised 2026-08-13 — this is a soft requirement, not a hard one.** The first version of this doc
called it hard and disqualified commander over it. That was wrong, for two reasons.

*A framework is not what makes completion work.* Completion is a shell script you install separately
after installing the CLI (`source <(fob-worker completion)`). The script calls the binary with a
magic flag and pipes stdout into `compgen`. Nothing in it is yargs-specific. What a framework
supplies is only:

1. the bash/zsh script boilerplate — **48 lines** in yargs
   (`yargs/build/lib/completion-templates.js`, 29 of them bash), regenerated on each
   `<tool> completion` call and **not checked into any of our repos**;
2. routing of the `--get-yargs-completions` flag to a callback — replaceable by an `if` at the top
   of the entry file.

The part that actually matters — deciding which candidates to return — is hand-written either way.
`fob-worker`'s callback contains no yargs API beyond its signature. Precedent: **pm2 uses commander
for parsing and its own vendored 229-line completer**, with a hand-written candidate function that
queries `pm2.list()` live.

*And the feature is barely used.* Audited across the family: **1 of 7 CLIs implements completion**
(`fob-worker`; the other six have zero `.completion()` calls), and it was **not wired into any
shell** until 2026-08-13. A requirement that six of seven CLIs skip is a latent one.

So the honest cost of switching is: **write the ~30-line bash script once, copy it into each CLI, own
it.** Real, but far short of disqualifying.

*Counterweight, though:* the two stale third-party packages (below) suggest people find that script
annoying enough to abandon. And this project's own experience is not a strong endorsement of the
"framework handles it" story either — completion shipped broken for a year, in the **hand-written**
parts, on both counts fixed 2026-08-13:

- `fob-worker` `65fcbf0` — step-discovery logging on stdout polluted the candidate list (51 candidates
  instead of 44)
- `fob-worker` `e54b5f3` — the callback treated the in-progress partial word as a completed arg, so
  **every** prefix returned nothing (`fob-worker li<TAB>` → empty). Only a bare `<TAB>` worked.

yargs generated the script correctly throughout. The bugs were entirely ours — which is the part that
does not change under any framework.

## Secondary criteria

| # | Criterion | Why it matters here |
|---|---|---|
| 1 | Dynamic completion | Soft — costs a ~30-line script to hand-roll; see above |
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
roughly 2× faster to start.

**Verified 2026-08-13 against commander `15.0.0` (installed, API introspected): it has no
completion API at all.** The only matching methods are `showSuggestionAfterError` /
`_showSuggestionAfterError`, which are did-you-mean-on-typo, not shell completion. For contrast the
same introspection found 20+ help methods (`configureHelp`, `createHelp`, `helpInformation`,
`addHelpText`, …). Commander is rich exactly where yargs is poor and absent exactly where yargs
delivers.

[commander#2008](https://github.com/tj/commander.js/issues/2008) ("provide shell completions",
opened 2023) is **closed with no implementation**.

Third-party fills, both unusable here:

| Package | Latest | Last published | Problem |
|---|---|---|---|
| `commander-completion` | 1.0.1 | 2022-06-13 | unmaintained ~4 years |
| `commander-completion-carapace` | 1.0.0 | 2024-12-26 | needs [Carapace](https://carapace.sh), an external Go binary, installed per machine |

**Verdict (revised 2026-08-13): commander is viable, not disqualified.** The earlier verdict —
"fails the hard requirement" — assumed a framework must supply completion. It doesn't: the
completion script is ~30 lines of bash installed separately, and the candidate logic is hand-written
under either framework (pm2 proves the combination in production).

The real trade:

| | yargs | commander |
|---|---|---|
| Completion script | generated (48 lines vendor code) | you write and own it (~30 lines) |
| Help output control | none — no formatter API | `Help` class, `configureHelp()`, `createHelp()` |
| Dependencies | ~7 | 0 |
| Cold start | ~35–42ms | ~18–22ms |

So the choice is roughly **"generated completion boilerplate" vs "help you can actually format,
zero deps, ~2× faster start."** That is a genuine trade, not a knockout either way — and worth
prototyping rather than arguing about on paper.

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

1. ~~**Does commander have viable dynamic completion?**~~ **Answered 2026-08-13, then re-answered.**
   Commander has no completion *API* (verified against the installed `15.0.0`), and both third-party
   packages are unusable. But that was the wrong question — completion is an
   install-time shell script, not a framework feature, so the answer is "you write ~30 lines and own
   it," not "commander is out." **Commander stays in the running.**
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

1. **Prototype one small CLI on commander** — `fob-orc` or `fob-zb` (~10 commits each, far cheaper
   than `fob-worker`'s 126). Include the hand-rolled completion script so the real cost is measured,
   not estimated. This is now the highest-information step: the paper comparison is a genuine trade,
   so only a build settles it.
2. Fill the `?` cells for cac and clipanion. Clipanion is the most promising unexamined option —
   it powers Yarn Berry, which ships working completion.
3. Benchmark startup locally rather than trusting the secondary source.
4. Only then: recommend, or close as "stay on yargs."

## Sources

- [PkgPulse — Best CLI frameworks for Node.js 2026](https://www.pkgpulse.com/guides/best-cli-frameworks-nodejs-2026)
- [commander.js README](https://github.com/tj/commander.js) — `Help` class, `.configureHelp()`
- [citty README](https://github.com/unjs/citty) — zero-dep, `util.parseArgs`, `renderUsage()`
- [yargs API docs](https://github.com/yargs/yargs/blob/main/docs/api.md) — "no dedicated help formatter"
