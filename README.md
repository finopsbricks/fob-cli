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

`fob --version` prints the dispatcher's version. `fob completion [bash|zsh|powershell]`
prints a tab-completion script (see below).

## Windows

Works in PowerShell (5.1 and 7+) and cmd. On Windows, "executable" means an extension
listed in `%PATHEXT%` that `fob` can launch: `.exe`/`.com` run directly, `.cmd`/`.bat`
(what `npm install -g` creates) run through `cmd.exe`, with arguments escaped so they
arrive unchanged. The extension is dropped from the tool name, so `fob-stm.cmd` is
`fob stm`. npm's extra `fob-stm` (sh) and `fob-stm.ps1` shims are ignored.

Tab completion: add this to your `$PROFILE`:

```powershell
fob completion powershell | Out-String | Invoke-Expression
```

On macOS/Linux: `source <(fob completion)` in `~/.bashrc` or `~/.zshrc`.

## The family

| Command | Binary | What |
|---|---|---|
| `fob orc` | `fob-orc` (`@finopsbricks/fob-orc`) | Orchestrator control plane (stations, work-records, tags) |
| `fob worker` | `fob-worker` (`@finopsbricks/fob-worker`) | Local worker plane (steps, lines, workpieces, procs) |
| `fob stm` | `fob-stm` (`@finopsbricks/fob-stm`) | Statements app |
| `fob email` | `fob-email` (`@finopsbricks/fob-email`) | Email |
