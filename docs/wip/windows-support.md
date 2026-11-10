# `fob` dispatcher — Windows support

## Status: BUG — found while smoke-testing the fob CLI family on Windows 11 (2026-11-11). Not started.

The `fob-<tool>` CLIs themselves run fine on Windows when called directly (`fob-stm accounts list`,
`fob-actual auth status`, `fobs orgs list` etc. all returned live data with profiles copied from the Mac).
The **`fob` dispatcher** (`src/dispatch.js`) is the part that breaks: it assumes POSIX executables on `PATH`.

Test environment: Windows 11 Pro 26100, Node 26.13.0 / npm 11.20.0, packages installed with
`npm install -g`, so the shims live in `%APPDATA%\npm`.

---

## Background: what npm puts on PATH on Windows

For every `bin` entry, npm on Windows writes **three** files to `%APPDATA%\npm`:

| File | What it is | Runnable by `spawn` without a shell? |
|---|---|---|
| `fob-stm` | POSIX sh script (for Git Bash / Cygwin) | **No**. Windows can't execute it |
| `fob-stm.cmd` | cmd batch shim | Only with `shell: true` (Node ≥ 18.20.2 / 20.12.2 refuses `.cmd`/`.bat` otherwise, CVE-2024-27980) |
| `fob-stm.ps1` | PowerShell shim | No (needs `powershell -File`) |

On Windows `accessSync(p, X_OK)` is only an existence check, so `isExecutableFile()` returns `true`
for all three.

---

## Bug 1: `fob <tool> …` fails with ENOENT (dispatch broken)

```
PS> fob stm --version
fob: failed to run C:\Users\alex\AppData\Roaming\npm\fob-stm: spawnSync C:\Users\alex\AppData\Roaming\npm\fob-stm ENOENT
```

Same for `fob orc status`, and so on. **Every** `fob <tool>` invocation fails on Windows.

**Cause:** `resolveTool()` joins `dir + 'fob-' + tool` with no extension. That matches the extensionless
sh shim, which `bin/fob.js:50` (`spawnSync(decision.exe, decision.args, { stdio: 'inherit' })`) can't run.

**Fix options:**

1. **Honour `PATHEXT` on win32 (recommended).** In `resolveTool()`, when `process.platform === 'win32'`,
   try `fob-<tool>` + each extension in `(env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';')` and skip
   the bare name. Then in `bin/fob.js`, spawn `.cmd`/`.bat` with `shell: true`. Args then have to be
   quoted for cmd.exe. Easiest is `spawnSync('cmd.exe', ['/d', '/s', '/c', exe, ...args], …)`, but
   arguments containing `& | < > ^ %` still need escaping, or use `cross-spawn`, which handles this.
2. **Bypass the shim entirely.** Read the `.cmd` shim (or the package's `bin` field) to find the target
   JS file and run `spawnSync(process.execPath, [script, ...args])`. No shell, no quoting problems, but
   it only works for Node-based tools. A third-party `fob-<tool>` written in another language would need
   option 1 anyway.
3. Pull in `cross-spawn` / `which` and let them do PATHEXT resolution and cmd quoting. That adds a
   dependency, but this problem is exactly what they exist for.

Leaning towards **1 + cross-spawn** for exec, because it keeps the "any `fob-*` on PATH" contract.

## Bug 2: `fob help` lists every tool three times

```
Installed tools:
  actual
  actual.cmd
  actual.ps1
  email      send & fetch mailboxes
  email.cmd
  email.ps1
  ...
```

**Cause:** `discoverTools()` does `name.slice(PREFIX.length)` and never strips the extension, so
`fob-actual`, `fob-actual.cmd` and `fob-actual.ps1` become three tool names. The catalog summary
also only attaches to the bare one.

**Fix:** on win32, only count entries whose extension is in `PATHEXT`, strip the extension
(case-insensitive) before `tools.add()`, and ignore the extensionless and `.ps1` shims. This needs to
share the same PATHEXT logic as Bug 1's fix so listing and resolution always agree.

## Bug 3: completion is bash/zsh only

`fob help` prints `Tab completion: add source <(fob completion) to your ~/.bashrc or ~/.zshrc`, and
`completionScript()` emits a bash `complete -F` script. Neither works in PowerShell.

Lower priority than 1 and 2. Options: hide the hint on win32, or add `fob completion powershell` that
emits a `Register-ArgumentCompleter -Native -CommandName fob` block calling
`fob-<tool> --get-yargs-completions` the same way the bash script does.

---

## Also check (not verified yet)

- `src/install.js` (`fob install <tool>`): uses `PATH.split(delimiter).includes(dir)` to check the
  install dir is on PATH. Windows PATH is case-insensitive and may have trailing `\`, so this could
  report a false "not on PATH". Also check `install.sh` has a Windows equivalent, or that
  `fob install` works via npm alone.
- `tests/`: add win32 cases for `discoverTools` / `resolveTool` with a fake PATH dir that contains
  `fob-x`, `fob-x.cmd` and `fob-x.ps1`, so this doesn't regress. CI is currently macOS/Linux only
  (to confirm). Consider a `windows-latest` job.

## Not bugs (for the record)

- PowerShell 5.1 shows the tools' stderr lines (`(using … credentials from profile 'alex')`) as red
  `NativeCommandError` records when stderr is redirected. That's PowerShell behaviour, not ours. It
  doesn't happen in a normal interactive window or in PowerShell 7.
- `fob --version` → `'--version' is not a fob command`. It's consistent with the git-style design,
  but maybe add `--version`/`-v` to the reserved built-ins since every `fob-<tool>` supports it.
