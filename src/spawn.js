/**
 * Turn an `exec` decision into a `spawnSync` call that works on every OS.
 *
 * POSIX and Windows `.exe`/`.com`: spawn the file directly. No shell, argv
 * passed through untouched.
 *
 * Windows `.cmd`/`.bat` (what `npm install -g` produces): CreateProcess can't
 * run batch files, and since CVE-2024-27980 Node refuses to spawn them without
 * `shell: true`. A plain `shell: true` would let cmd.exe interpret `& | < > ^ %`
 * etc. in user arguments, though, so we build the cmd.exe command line ourselves
 * and escape it, the way cross-spawn does (MIT, github.com/moxystudio/node-cross-spawn):
 *
 *   cmd.exe /d /s /c "<escaped exe> <escaped arg> …"   (windowsVerbatimArguments)
 *
 * Each arg gets MSVCRT quoting (so the batch file's target sees the original
 * string), then cmd metacharacters are ^-escaped **twice**: once for the
 * `cmd /c` line, and once more because the shim re-expands them via `%*` on
 * its own command line.
 */

import { extname } from 'node:path';

const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

/** Escape the program path for a cmd.exe command line (no quotes; spaces become `^ `). */
export function escapeCmdCommand(cmd) {
  return cmd.replace(CMD_META, '^$1');
}

/**
 * Escape one argument for `cmd.exe /d /s /c "…"` running a batch file that
 * forwards `%*`.
 * @param {string} arg
 */
export function escapeCmdArgument(arg) {
  let s = `${arg}`;
  // MSVCRT rules: backslashes before a quote are doubled, and the quote is escaped…
  s = s.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  // …and trailing backslashes are doubled, since we're about to add a closing quote.
  s = s.replace(/(?=(\\+?)?)\1$/, '$1$1');
  s = `"${s}"`;
  // Two rounds of ^-escaping: `cmd /c` parsing, then the shim's `%*` re-parse.
  s = s.replace(CMD_META, '^$1');
  s = s.replace(CMD_META, '^$1');
  return s;
}

/**
 * @param {string} exe   resolved executable path (from resolveTool)
 * @param {string[]} args
 * @param {{ platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {{ command: string, args: string[], options: import('node:child_process').SpawnSyncOptions }}
 */
export function spawnSpec(exe, args, { platform = process.platform, env = process.env } = {}) {
  const base = { stdio: /** @type {const} */ ('inherit') };
  const ext = extname(exe).toLowerCase();
  if (platform !== 'win32' || (ext !== '.cmd' && ext !== '.bat')) {
    return { command: exe, args, options: base };
  }
  const line = [escapeCmdCommand(exe), ...args.map(escapeCmdArgument)].join(' ');
  return {
    command: env.ComSpec || env.COMSPEC || 'cmd.exe',
    args: ['/d', '/s', '/c', `"${line}"`],
    options: { ...base, windowsVerbatimArguments: true },
  };
}
