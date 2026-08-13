# D1 — yargs is the CLI framework for the `fob-*` family, copied per repo rather than shared

- **Status:** Accepted — 2026-08-13 (recorded retroactively; the choice was made 2026-02-20)
- **Scope:** argument parsing, help generation and shell completion in every `fob-*` CLI
- **Supersedes/refines:** nothing; first decision in this repo's series
- **Related:** [cli-standards-and-wrappers](../wip/cli-standards-and-wrappers.md) (the copy-not-package rule),
  [yargs-alternatives](../wip/yargs-alternatives.md) (open evaluation)

## Decision

Every `fob-*` CLI that parses a command tree uses **yargs `^17.7.2`**.

The `fob <resource> <action>` grammar, the per-level `--help`, and the `completion` command are
all built on it. New CLIs in the family adopt it by **copying the yargs skeleton** from an existing
repo — not by depending on a shared `cli-kit` package. That copy rule is itself a decision, made in
[cli-standards-and-wrappers](../wip/cli-standards-and-wrappers.md): *"Standard as documentation,
NOT a `cli-kit`/generator."*

`@fob/cli` (this repo) is the exception that proves the rule: it is a git-style dispatcher that
shells out to sibling `fob-*` binaries on PATH, parses no command tree of its own, and therefore has
**zero dependencies**.

Current adopters — all on `^17.7.2`:

| Package | Repo |
|---|---|
| `@fob/cli-fobs` | `cli/cli-fobs` |
| `@fob/email` | `cli/fob-email` |
| `@fob/orc` | `cli/fob-orc` |
| `@finopsbricks/fob-stm` | `cli/fob-stm` |
| `@fob/worker` | `cli/fob-worker` |
| `@fob/zb` | `cli/fob-zb` |
| *(also)* `ops/devops/scripts/github-activity` | outside `cli/` |

## Why

**This is a retroactive record of a decision that was made without a written comparison.** The
honest history matters more than a tidy rationale, so it is stated plainly below rather than
reconstructed into one.

The original justification is a single line in
[`fob-worker/docs/wip/fob-cli.md`](../../fob-worker/docs/wip/fob-cli.md), under `## Decisions Made`:

> 1. **CLI framework:** yargs (built-in completion, auto-generated help)

and the adoption commit (`c8a1b43`, `cli/fob-worker`, 2026-02-20, *"Refactor to yargs with shell
completion"*) gives the same two reasons:

> - Use yargs for command parsing and help generation
> - Built-in shell completion for bash/zsh
> - Tab completion for resources, actions, and step slugs

So the reasoning on record is:

- **Shell completion was the driver.** It is named in the commit title and twice in the body. The
  requirement is not generic completion but *dynamic* completion — `fob steps run <TAB>` enumerates
  step slugs by reading the filesystem at completion time. yargs' `.completion()` takes a callback
  that can return a promise, which supports this directly.
- **Auto-generated help.** The alternative in play at the time was the hand-rolled `switch`/`parse()`
  it replaced (before `c8a1b43` the CLI's only dependency was `dotenv`). Anything with a real help
  generator was an improvement over that baseline.
- **The comparison was hand-rolled vs. a framework, not framework vs. framework.** No alternative
  parser is named anywhere in the monorepo — not commander, oclif, cac, citty, clipanion, meow or
  minimist. This was a default, reasonably chosen, not a finalist.

**What has been learned since, which was not known then:**

- yargs **deliberately prefixes every nested command row with its full parent path**
  (`fob-worker workpieces list`, not `list`). This is not an oversight to configure away: it was
  added on purpose in [yargs PR #990](https://github.com/yargs/yargs/commit/cd1ca15) — *"help
  strings for nested commands were missing parent commands"* — on the reasoning that the full path
  shows the user what to type. Cobra (kubectl, gh, docker) does the opposite, rendering bare
  `cmd.Name()`.
- yargs exposes **no help-formatter API**. Per its own docs: *"Yargs doesn't expose a dedicated
  'help formatter' or custom usage renderer interface."* The customisation surface is
  `showHelp` / `usage` / `updateStrings` / `wrap`, none of which restructure rows.
- `.showHelp(fn)` **composes with the parent's callback rather than replacing it**, so a naive
  per-level override renders the list twice.

The irony is worth recording: **auto-generated help was one of the two reasons yargs was picked, and
it is the part that has since needed the most work around.** See
[cli-help-readability](../../fob-worker/docs/wip/cli-help-readability.md) for the detail.

## Consequences

- Six repos carry an independent copy of the yargs skeleton. A cross-cutting change to help or
  completion behaviour is six edits, by design — the copy rule trades that cost for the freedom to
  let any one CLI diverge without coordinating a shared-package release.
- Cobra-style bare-name command lists are not reachable by configuration. Getting them means
  hand-rolling a renderer against yargs' private API (`getInternalMethods()`), or bypassing
  `.help()` entirely and losing auto-sync as commands are added.
- The version is pinned identically (`^17.7.2`) across all six, so they share the same behaviour —
  and would share the same breakage on a major-version bump.
- yargs 17 is the current major and is maintained. There is no urgency here; the friction is
  cosmetic, confined to help rendering, and does not affect parsing or completion.

## Not foreclosed

Nothing about this decision is load-bearing for the *grammar*.
[`fob-worker/docs/cli-design-style.md`](../../fob-worker/docs/cli-design-style.md) — the source of
truth for `fob <resource> <action>`, verb choice, and output conventions — never mentions yargs or
any framework. The grammar is framework-agnostic, so a future parser swap is an implementation
change, not a redesign of the CLI's surface.

The copy-not-package rule cuts both ways here: it means a swap can be **piloted in one CLI** and
adopted only if it proves out, rather than requiring a synchronised migration of all six.

An evaluation of alternatives is open at [yargs-alternatives](../wip/yargs-alternatives.md). It is
deliberately *not* prejudged by this record: the bar for switching is high, and "we never compared"
is a reason to look once, not a reason to move.

## Still open

- Whether any alternative clears the bar — see the WIP above. **Dynamic completion is the hard
  requirement** any candidate must meet, since that is what yargs was chosen for.
- Whether the help-rendering friction is worth solving at all, versus simply shortening command
  descriptions so nothing wraps. Tracked in
  [cli-help-readability](../../fob-worker/docs/wip/cli-help-readability.md).
- Where the canonical repo-neutral CLI standard lives.
  [cli-standards-and-wrappers](../wip/cli-standards-and-wrappers.md) says a 9-note standard was
  written to `engineering-standards/cli/`, but that directory is absent from the local checkout of
  that repo (which is behind the referenced commit). Unresolved, and orthogonal to this decision.
