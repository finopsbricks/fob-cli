/**
 * Git-style dispatch for the fob-<tool> family.
 *
 * Like `git foo`: any executable named `fob-<tool>` on `$PATH` becomes
 * `fob <tool>`. On top of that pure dispatch, the launcher owns a small set of
 * reserved built-ins — `install`, `remove`, `list` — that manage the family via
 * the catalog (catalog.js/install.js). Everything else falls through to PATH.
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

/**
 * The `fob help` / bare-`fob` listing text.
 * @param {string[]} installed  discovered tool names (on PATH)
 * @param {object|null} [catalog]  optional catalog → adds an "available" section
 */
export function formatToolList(installed, catalog = null) {
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
  return lines.join('\n');
}

const LIST_TOKENS = new Set(['help', '--help', '-h', '--list', 'list', 'ls', undefined]);
const INSTALL_TOKENS = new Set(['install', 'add']);
const REMOVE_TOKENS = new Set(['remove', 'uninstall', 'rm']);

/**
 * Decide what the launcher should do for a given argv (no side effects).
 * @param {string[]} argv  args after `fob`
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{action:'list'} | {action:'install'|'remove', tool:string} | {action:'error', message:string} | {action:'exec', exe:string, args:string[]}}
 */
export function plan(argv, env = process.env) {
  const [tool, ...rest] = argv;
  if (LIST_TOKENS.has(tool)) return { action: 'list' };

  if (INSTALL_TOKENS.has(tool)) {
    if (!rest[0]) return { action: 'error', message: "fob: 'install' needs a tool name, e.g. `fob install email`." };
    return { action: 'install', tool: rest[0] };
  }
  if (REMOVE_TOKENS.has(tool)) {
    if (!rest[0]) return { action: 'error', message: "fob: 'remove' needs a tool name, e.g. `fob remove email`." };
    return { action: 'remove', tool: rest[0] };
  }

  const exe = resolveTool(tool, env);
  if (!exe) {
    return { action: 'error', message: `fob: '${tool}' is not a fob command. See 'fob help'.` };
  }
  return { action: 'exec', exe, args: rest };
}
