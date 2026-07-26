# fob — the fob-<tool> dispatcher

A git-style launcher for the `fob-<tool>` CLI family. Exactly how `git foo` finds
`git-foo`: any executable named `fob-<tool>` on your `$PATH` becomes `fob <tool>`.
No registry, no manifest, no version coupling — and **no built-in subcommands**
(the launcher is pure sugar over the standalone binaries).

```bash
fob                      # list discovered tools
fob orc stations list    # → exec `fob-orc stations list`
fob worker procs list    # → exec `fob-worker procs list`
fob stm accounts list    # → exec `fob-stm accounts list`
```

The child is exec'd transparently: inherited stdio, argv forwarded untouched, and
the child's exit code propagated — so `fob <tool> …` is indistinguishable from
calling `fob-<tool> …` directly in scripts and pipelines. An unknown tool errors
with `fob: '<tool>' is not a fob command` (exit 1).

Each `fob-<tool>` stays independently installed, versioned, and runnable on its own.

## The family

| Command | Binary | What |
|---|---|---|
| `fob orc` | `fob-orc` (`@fob/orc`) | Orchestrator control plane (stations, work-records, tags) |
| `fob worker` | `fob-worker` (`@fob/worker`) | Local worker plane (steps, lines, workpieces, procs) |
| `fob stm` | `fob-stm` (`@fob/stm`) | Statements app |
| `fob email` | `fob-email` (`@fob/email`) | Email |
