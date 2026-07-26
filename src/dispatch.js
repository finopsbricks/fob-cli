/**
 * Git-style dispatch for the fob-<tool> family.
 *
 * Exactly how `git foo` works: no registry, no manifest — any executable named
 * `fob-<tool>` on `$PATH` becomes `fob <tool>`. The launcher owns NO built-in
 * subcommands (the old worker-context `fob` commands moved to `fob-worker`), so
 * it is pure sugar over the standalone binaries.
 */

import { readdirSync, statSync, accessSync, constants } from 'node:fs';
import { join, delimiter } from 'node:path';

const PREFIX = 'fob-';

/** Directories on PATH (in order). */
export function pathDirs(env = process.env) {
  return (env.PATH || '').split(delimiter).filter(Boolean);
}

/** True if `p` is an existing, executable regular file. */
function isExecutableFile(p) {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Discover `fob-<tool>` executables on PATH → sorted, de-duplicated tool names.
 * (This is what gives `fob help` its list, the way `git help -a` lists externals.)
 */
export function discoverTools(env = process.env) {
  const tools = new Set();
  for (const dir of pathDirs(env)) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue; // unreadable/nonexistent PATH entry — skip
    }
    for (const name of entries) {
      if (!name.startsWith(PREFIX)) continue;
      const tool = name.slice(PREFIX.length);
      if (!tool) continue;
      if (isExecutableFile(join(dir, name))) tools.add(tool);
    }
  }
  return [...tools].sort();
}

/** Resolve a tool name to its `fob-<tool>` executable path on PATH, or null. */
export function resolveTool(tool, env = process.env) {
  for (const dir of pathDirs(env)) {
    const p = join(dir, PREFIX + tool);
    if (isExecutableFile(p)) return p;
  }
  return null;
}

/** The `fob help` / bare-`fob` listing text. */
export function formatToolList(tools) {
  const lines = [
    'fob — git-style dispatcher for the fob-<tool> CLI family',
    '',
    'Usage: fob <tool> [args...]   (e.g. `fob orc stations list`, `fob worker procs list`)',
    '',
  ];
  if (tools.length) {
    lines.push('Available tools:');
    for (const t of tools) lines.push(`  ${t}`);
    lines.push('', "Run `fob <tool> --help` for a tool's commands.");
  } else {
    lines.push('No fob-<tool> executables found on PATH.');
  }
  return lines.join('\n');
}

const LIST_TOKENS = new Set(['help', '--help', '-h', '--list', undefined]);

/**
 * Decide what the launcher should do for a given argv (no side effects).
 * @param {string[]} argv  args after `fob`
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ action: 'list' } | { action: 'error', message: string } | { action: 'exec', exe: string, args: string[] }}
 */
export function plan(argv, env = process.env) {
  const [tool, ...rest] = argv;
  if (LIST_TOKENS.has(tool)) return { action: 'list' };

  const exe = resolveTool(tool, env);
  if (!exe) {
    return { action: 'error', message: `fob: '${tool}' is not a fob command. See 'fob help'.` };
  }
  return { action: 'exec', exe, args: rest };
}
