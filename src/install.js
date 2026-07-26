/**
 * `fob install <tool>` / `fob remove <tool>` — pull a sibling binary into the
 * per-user bin dir (`~/.fob/bin`, no sudo) from the catalog's download origin,
 * verifying its checksum. Same download+verify contract as install.sh, in JS so
 * the compiled dispatcher can do it with no shell dependency.
 */

import { mkdirSync, writeFileSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { getCatalog, baseUrl, platform, binName, assetName } from './catalog.js';

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

function onPath(dir) {
  return (process.env.PATH || '').split(delimiter).includes(dir);
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
    log(`fob: ${dir} is not on your PATH. Add it, then restart your shell:`);
    log(`  export PATH="${dir}:$PATH"`);
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
