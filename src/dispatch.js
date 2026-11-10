/**
 * Git-style dispatch for the fob-<tool> family.
 *
 * Like `git foo`: any executable named `fob-<tool>` on `$PATH` becomes
 * `fob <tool>`. On top of that pure dispatch, the launcher owns a small set of
 * reserved built-ins — `install`, `remove`, `list` — that manage the family via
 * the catalog (catalog.js/install.js). Everything else falls through to PATH.
 */

import { readdirSync, statSync, accessSync, constants } from 'node:fs';
import { join, extname } from 'node:path';

const PREFIX = 'fob-';

/*
 * Windows notes. There is no execute bit on Windows (`accessSync(X_OK)` only
 * checks existence), and what counts as runnable is decided by file extension
 * via %PATHEXT%. `npm install -g` writes *three* files per bin there:
 *   fob-stm      POSIX sh shim (for Git Bash/Cygwin) — not runnable by Windows
 *   fob-stm.cmd  batch shim — runnable, but only through cmd.exe (see spawn.js)
 *   fob-stm.ps1  PowerShell shim — not runnable by CreateProcess
 * So on win32 a `fob-<tool>` only counts if its extension is in PATHEXT *and* is
 * one we can actually launch (WIN_RUNNABLE); the extension is stripped from the
 * tool name. Everything is parameterised on `platform` so the win32 behaviour is
 * unit-testable on any OS.
 */

/** Extensions we know how to launch on Windows (.exe/.com directly, .cmd/.bat via cmd.exe). */
const WIN_RUNNABLE = new Set(['.exe', '.com', '.cmd', '.bat']);
const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/** Read PATH. Windows env var names are case-insensitive (`Path` is common), plain objects aren't. */
function pathVar(env, platform) {
  if (env.PATH !== undefined || platform !== 'win32') return env.PATH || '';
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH');
  return (key && env[key]) || '';
}

/**
 * Launchable extensions on win32, lower-cased, in PATHEXT precedence order.
 * @returns {string[]}
 */
export function windowsExts(env = process.env) {
  const raw = env.PATHEXT || env.PathExt || DEFAULT_PATHEXT;
  const exts = raw
    .split(';')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => WIN_RUNNABLE.has(e));
  return [...new Set(exts)];
}

/** Directories on PATH (in order). */
export function pathDirs(env = process.env, platform = process.platform) {
  const sep = platform === 'win32' ? ';' : ':';
  return pathVar(env, platform)
    .split(sep)
    .map((d) => (platform === 'win32' ? d.trim().replace(/^"(.*)"$/, '$1') : d))
    .filter(Boolean);
}

/** True if `p` is an existing regular file (and, off Windows, has an execute bit). */
function isExecutableFile(p, platform) {
  try {
    if (!statSync(p).isFile()) return false;
    if (platform !== 'win32') accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Map a PATH directory entry to its tool name, or null if it isn't a runnable
 * `fob-<tool>` on this platform (e.g. `fob-stm.cmd` → `stm` on win32; `fob-stm`
 * → null on win32).
 */
function toolNameOf(name, platform, exts) {
  // Windows filenames are case-insensitive (`FOB-X.CMD` is ours); POSIX ones aren't.
  const prefixed = platform === 'win32' ? name.toLowerCase().startsWith(PREFIX) : name.startsWith(PREFIX);
  if (!prefixed) return null;
  let tool = name.slice(PREFIX.length);
  if (platform === 'win32') {
    const ext = extname(tool).toLowerCase();
    if (!exts.includes(ext)) return null;
    tool = tool.slice(0, -ext.length);
  }
  return tool || null;
}

/**
 * Discover `fob-<tool>` executables on PATH → sorted, de-duplicated tool names.
 * (This is what gives `fob help` its list, the way `git help -a` lists externals.)
 */
export function discoverTools(env = process.env, platform = process.platform) {
  const exts = platform === 'win32' ? windowsExts(env) : [];
  /** @type {Map<string, string>} dedupe key → display name (case-insensitive on win32) */
  const tools = new Map();
  for (const dir of pathDirs(env, platform)) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue; // unreadable/nonexistent PATH entry — skip
    }
    for (const name of entries) {
      const tool = toolNameOf(name, platform, exts);
      if (!tool) continue;
      const key = platform === 'win32' ? tool.toLowerCase() : tool;
      if (tools.has(key)) continue;
      if (isExecutableFile(join(dir, name), platform)) tools.set(key, tool);
    }
  }
  return [...tools.values()].sort();
}

/**
 * Resolve a tool name to its `fob-<tool>` executable path on PATH, or null.
 * On win32 each directory is tried with each PATHEXT extension in order (as
 * cmd.exe does), and the bare extensionless name is never returned.
 */
export function resolveTool(tool, env = process.env, platform = process.platform) {
  // A tool name is a single path segment — never let `fob ../../x` escape the PATH dir.
  if (!tool || /[\\/]/.test(tool)) return null;
  const candidates = platform === 'win32' ? windowsExts(env).map((ext) => PREFIX + tool + ext) : [PREFIX + tool];
  for (const dir of pathDirs(env, platform)) {
    for (const name of candidates) {
      const p = join(dir, name);
      if (isExecutableFile(p, platform)) return p;
    }
  }
  return null;
}

/**
 * The `fob help` / bare-`fob` listing text.
 * @param {string[]} installed  discovered tool names (on PATH)
 * @param {object|null} [catalog]  optional catalog → adds an "available" section
 * @param {NodeJS.Platform} [platform]  picks the tab-completion hint (PowerShell on win32)
 */
export function formatToolList(installed, catalog = null, platform = process.platform) {
  const lines = [
    'fob — git-style dispatcher for the fob-<tool> CLI family',
    '',
    'Usage: fob <tool> [args...]   (e.g. `fob orc stations list`, `fob email inbox list`)',
    '',
  ];
  const installedSet = new Set(installed);
  const summaryOf = (t) => catalog?.tools?.[t]?.summary;

  if (installed.length) {
    lines.push('Installed tools:');
    for (const t of installed) {
      const s = summaryOf(t);
      lines.push(s ? `  ${t.padEnd(10)} ${s}` : `  ${t}`);
    }
  } else {
    lines.push('No fob-<tool> executables found on PATH.');
  }

  const available = catalog
    ? Object.keys(catalog.tools).filter((t) => !installedSet.has(t)).sort()
    : [];
  if (available.length) {
    lines.push('', 'Available (not installed):');
    for (const t of available) {
      const s = (catalog.tools[t].summary || '').padEnd(26);
      lines.push(`  ${t.padEnd(10)} ${s} → fob install ${t}`);
    }
  }

  lines.push('', "Run `fob <tool> --help`, or `fob install <tool>` to add one.");
  lines.push(
    platform === 'win32'
      ? 'Tab completion: add `fob completion powershell | Out-String | Invoke-Expression` to your $PROFILE.'
      : 'Tab completion: add `source <(fob completion)` to your ~/.bashrc or ~/.zshrc.',
  );
  return lines.join('\n');
}

/** Shells `fob completion <shell>` can emit a script for. */
export const COMPLETION_SHELLS = ['bash', 'zsh', 'powershell'];

/** Default shell for a bare `fob completion`: PowerShell on Windows, bash elsewhere. */
export function defaultCompletionShell(platform = process.platform) {
  return platform === 'win32' ? 'powershell' : 'bash';
}

const LIST_TOKENS = new Set(['help', '--help', '-h', '--list', 'list', 'ls', undefined]);
// Flags only: a bare `version` stays dispatchable to a hypothetical `fob-version`.
const VERSION_TOKENS = new Set(['--version', '-v', '-V']);
const INSTALL_TOKENS = new Set(['install', 'add']);
const REMOVE_TOKENS = new Set(['remove', 'uninstall', 'rm']);
const COMPLETION_TOKENS = new Set(['completion']);

/**
 * The bash/zsh completion script for `fob`.
 *
 * Completing `fob <tool> …` has to reach *into* the tool: `fob worker steps run
 * <TAB>` should list live step slugs, which only `fob-worker` can enumerate. So
 * the script special-cases the first word (tool names, discovered from PATH at
 * completion time) and delegates everything after it to that tool's own
 * yargs-style completer, passing the sub-argv along.
 *
 * Tools are discovered live rather than baked in, so installing a new
 * `fob-<tool>` starts completing without re-sourcing this script.
 */
export function completionScript(shell = 'bash') {
  if (shell === 'powershell' || shell === 'pwsh') return powershellCompletionScript();
  return `###-begin-fob-completions-###
#
# fob command completion script
#
# Installation: fob completion >> ~/.bashrc  (or ~/.bash_profile on OSX)
#
_fob_completions()
{
  local cur_word prev_words tool
  cur_word="\${COMP_WORDS[COMP_CWORD]}"

  # First word after 'fob' → tool names + built-ins.
  if [ "\$COMP_CWORD" -eq 1 ]; then
    local tools builtins
    builtins="help list install remove completion"
    tools=$(compgen -c fob- 2>/dev/null | sed 's/^fob-//' | sort -u | tr '\\n' ' ')
    COMPREPLY=( $(compgen -W "\${builtins} \${tools}" -- \${cur_word}) )
    return 0
  fi

  tool="\${COMP_WORDS[1]}"

  # 'fob install/remove <TAB>' → catalog tool names, same source as the listing.
  if [ "\$tool" = "install" ] || [ "\$tool" = "remove" ]; then
    local tools
    tools=$(compgen -c fob- 2>/dev/null | sed 's/^fob-//' | sort -u | tr '\\n' ' ')
    COMPREPLY=( $(compgen -W "\${tools}" -- \${cur_word}) )
    return 0
  fi

  # Otherwise delegate to the tool's own completer, minus the leading 'fob'.
  if ! command -v "fob-\${tool}" >/dev/null 2>&1; then
    COMPREPLY=()
    return 0
  fi
  prev_words=( "fob-\${tool}" "\${COMP_WORDS[@]:2}" )
  local type_list
  type_list=$("fob-\${tool}" --get-yargs-completions "\${prev_words[@]}" 2>/dev/null)
  COMPREPLY=( $(compgen -W "\${type_list}" -- \${cur_word}) )

  if [ \${#COMPREPLY[@]} -eq 0 ]; then
    COMPREPLY=()
  fi
  return 0
}
complete -o bashdefault -o default -F _fob_completions fob
###-end-fob-completions-###
`;
}

/**
 * The PowerShell (Windows PowerShell 5.1 and PowerShell 7+) completer for `fob`.
 * Same contract as the bash script: tool names at word 1 (discovered live via
 * Get-Command), catalog-style names after install/remove, and everything else
 * delegated to `fob-<tool> --get-yargs-completions`. PowerShell does the prefix
 * filtering that `compgen -W` does in bash.
 *
 * Gotcha handled here: yargs needs the empty "current word" to complete the
 * *next* position, but PowerShell drops empty-string arguments to native
 * commands under Legacy passing: Windows PowerShell 5.1, 7.0–7.2,
 * $PSNativeCommandArgumentPassing = 'Legacy', and also the 7.3+ default
 * 'Windows' mode when the target is a .cmd/.bat. In those cases we pass '""'
 * instead, which the child's argv parser decodes back to ''. Under 'Standard'
 * passing '""' would arrive as two literal quotes, so the choice depends on
 * the resolved command (npm's .ps1 shim forwards to node.exe, not a batch file).
 */
export function powershellCompletionScript() {
  return `###-begin-fob-completions-###
#
# fob command completion script for PowerShell
#
# Installation: add this line to your $PROFILE
#   fob completion powershell | Out-String | Invoke-Expression
#
Register-ArgumentCompleter -Native -CommandName 'fob', 'fob.exe', 'fob.cmd', 'fob.ps1' -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  # Words before the cursor, minus 'fob' itself; a trailing space starts a new, empty word.
  $words = @($commandAst.CommandElements |
    Where-Object { $_.Extent.StartOffset -lt $cursorPosition } |
    ForEach-Object { $_.Extent.Text } |
    Select-Object -Skip 1)
  if ($wordToComplete -eq '') { $words += '' }

  $toolNames = {
    Get-Command -Name 'fob-*' -CommandType Application, ExternalScript -ErrorAction SilentlyContinue |
      ForEach-Object { [IO.Path]::GetFileNameWithoutExtension($_.Name).Substring(4) } |
      Where-Object { $_ } |
      Sort-Object -Unique
  }

  if ($words.Count -le 1) {
    $candidates = @('help', 'list', 'install', 'remove', 'completion') + @(& $toolNames)
  } elseif ($words[0] -in 'install', 'add', 'remove', 'uninstall', 'rm') {
    $candidates = @(& $toolNames)
  } elseif ($words[0] -eq 'completion') {
    $candidates = @('bash', 'zsh', 'powershell')
  } else {
    $exe = "fob-$($words[0])"
    $cmd = Get-Command $exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $cmd) { return }
    $rest = @($words | Select-Object -Skip 1)
    # Empty args reach the native program only under 'Standard' passing (7.3+), and
    # 'Windows' mode (the 7.3+ default) still uses Legacy rules for batch files.
    # An npm .ps1 shim forwards to node.exe (not a batch), so only the PS version/mode matters there.
    $mode = $PSNativeCommandArgumentPassing
    $isBatch = $cmd.CommandType -eq 'Application' -and [IO.Path]::GetExtension($cmd.Source) -in '.cmd', '.bat'
    $legacy = $PSVersionTable.PSVersion.Major -lt 7 -or -not $mode -or $mode -eq 'Legacy' -or ($mode -eq 'Windows' -and $isBatch)
    if ($legacy) {
      $rest = @($rest | ForEach-Object { if ($_ -eq '') { '""' } else { $_ } })
    }
    $candidates = @(& $cmd.Source --get-yargs-completions $exe @rest 2>$null)
  }

  $candidates |
    Where-Object { $_ -and $_ -like "$wordToComplete*" } |
    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}
###-end-fob-completions-###
`;
}

/**
 * Decide what the launcher should do for a given argv (no side effects).
 * @param {string[]} argv  args after `fob`
 * @param {NodeJS.ProcessEnv} [env]
 * @param {NodeJS.Platform} [platform]
 * @returns {{action:'list'} | {action:'version'} | {action:'completion', shell:string} | {action:'install'|'remove', tool:string} | {action:'error', message:string} | {action:'exec', exe:string, args:string[]}}
 */
export function plan(argv, env = process.env, platform = process.platform) {
  const [tool, ...rest] = argv;
  if (LIST_TOKENS.has(tool)) return { action: 'list' };
  if (VERSION_TOKENS.has(tool)) return { action: 'version' };
  if (COMPLETION_TOKENS.has(tool)) {
    const shell = (rest[0] || defaultCompletionShell(platform)).toLowerCase().replace(/^pwsh$/, 'powershell');
    if (!COMPLETION_SHELLS.includes(shell)) {
      return { action: 'error', message: `fob: no completion for '${rest[0]}'. Shells: ${COMPLETION_SHELLS.join(', ')}.` };
    }
    return { action: 'completion', shell };
  }

  if (INSTALL_TOKENS.has(tool)) {
    if (!rest[0]) return { action: 'error', message: "fob: 'install' needs a tool name, e.g. `fob install email`." };
    return { action: 'install', tool: rest[0] };
  }
  if (REMOVE_TOKENS.has(tool)) {
    if (!rest[0]) return { action: 'error', message: "fob: 'remove' needs a tool name, e.g. `fob remove email`." };
    return { action: 'remove', tool: rest[0] };
  }

  const exe = resolveTool(tool, env, platform);
  if (!exe) {
    return { action: 'error', message: `fob: '${tool}' is not a fob command. See 'fob help'.` };
  }
  return { action: 'exec', exe, args: rest };
}
