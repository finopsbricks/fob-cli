/**
 * `fob install <tool>` / `fob remove <tool>` — pull a sibling binary into the
 * per-user bin dir (`~/.fob/bin`, no sudo) from the catalog's download origin,
 * verifying its checksum. Same download+verify contract as install.sh, in JS so
 * the compiled dispatcher can do it with no shell dependency.
 */

import { mkdirSync, writeFileSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { getCatalog, baseUrl, platform, binName, assetName } from './catalog.js';
import { pathDirs } from './dispatch.js';

/** Managed install dir (overridable, matches install.sh). */
export function binDir() {
  return process.env.FOB_BIN_DIR || join(homedir(), '.fob', 'bin');
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fob: download failed (HTTP ${res.status}) — ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Parse a `sha256  filename` manifest into { filename: hash }. */
function parseSums(text) {
  const map = {};
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (m) map[m[2]] = m[1].toLowerCase();
  }
  return map;
}

/**
 * Is `dir` on PATH? Trailing separators are ignored. On win32, comparison is
 * case-insensitive and `/` equals `\`, and `Path` is found however it's cased.
 */
export function onPath(dir, env = process.env, plat = process.platform) {
  const norm = (p) => {
    const s = p.replace(/[\\/]+$/, '');
    return plat === 'win32' ? s.replace(/\//g, '\\').toLowerCase() : s;
  };
  const want = norm(dir);
  return pathDirs(env, plat).some((d) => norm(d) === want);
}

/** Shell-appropriate instructions for putting `dir` on PATH. */
export function pathHint(dir, plat = process.platform) {
  if (plat === 'win32') {
    const quoted = dir.replace(/'/g, "''"); // PowerShell single-quoted string
    return [
      `fob: ${dir} is not on your PATH. Add it for your user (PowerShell), then open a new terminal:`,
      `  [Environment]::SetEnvironmentVariable('Path', '${quoted};' + [Environment]::GetEnvironmentVariable('Path', 'User'), 'User')`,
    ];
  }
  return [`fob: ${dir} is not on your PATH. Add it, then restart your shell:`, `  export PATH="${dir}:$PATH"`];
}

/**
 * Download, verify, and install a tool's binary into binDir().
 * @param {string} tool  short name, e.g. 'email'
 * @param {{ log?: (s: string) => void }} [opts]
 * @returns {Promise<string>} the installed path
 */
export async function installTool(tool, { log = (s) => console.error(s) } = {}) {
  const catalog = await getCatalog();
  if (!catalog.tools[tool]) {
    throw new Error(`fob: unknown tool '${tool}'. Run 'fob list' to see what's available.`);
  }
  const plat = platform();
  if (!plat.osName || !plat.arch) {
    throw new Error(`fob: unsupported platform ${process.platform}/${process.arch}.`);
  }

  const base = baseUrl(catalog);
  const bin = binName(tool);
  const asset = assetName(tool, plat);

  log(`fob: installing ${asset} → ${binDir()}`);
  const buf = await download(`${base}/${asset}`);

  // Verify against <bin>-SHA256SUMS when published. A mismatch aborts; a missing
  // manifest (or a hiccup fetching it) proceeds unverified rather than blocking.
  try {
    const res = await fetch(`${base}/${bin}-SHA256SUMS`);
    if (res.ok) {
      const expected = parseSums(await res.text())[asset];
      if (expected) {
        const actual = createHash('sha256').update(buf).digest('hex');
        if (expected !== actual) throw new Error(`fob: checksum mismatch for ${asset} — aborting.`);
        log('fob: checksum ok');
      }
    }
  } catch (e) {
    if (/checksum mismatch/.test(e.message)) throw e;
  }

  const dir = binDir();
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, plat.isWindows ? `${bin}.exe` : bin);
  writeFileSync(dest, buf);
  chmodSync(dest, 0o755);
  log(`fob: installed ${bin} → ${dest}`);

  if (!onPath(dir)) {
    log('');
    for (const line of pathHint(dir)) log(line);
  }
  return dest;
}

/** Remove a tool's binary from the managed bin dir (does not touch other PATH copies). */
export function removeTool(tool, { log = (s) => console.error(s) } = {}) {
  const bin = binName(tool);
  const dir = binDir();
  const plat = platform();
  const dest = join(dir, plat.isWindows ? `${bin}.exe` : bin);
  if (!existsSync(dest)) {
    throw new Error(`fob: ${bin} is not installed in ${dir}.`);
  }
  rmSync(dest);
  log(`fob: removed ${bin} from ${dir}`);
}
