#!/usr/bin/env node
/**
 * `fob` — the git-style dispatcher. Resolves `fob <tool> …` to a `fob-<tool>`
 * executable on PATH and execs it transparently (inherited stdio, argv forwarded
 * untouched, child exit code propagated), so `fob <tool> …` is indistinguishable
 * from calling `fob-<tool> …` directly in scripts and pipelines. It also owns a
 * few reserved built-ins — `list`, `install`, `remove` — for managing the family.
 */

import { spawnSync } from 'node:child_process';
import { discoverTools, formatToolList, plan } from '../src/dispatch.js';
import { getCatalog } from '../src/catalog.js';
import { installTool, removeTool } from '../src/install.js';

async function main() {
  const decision = plan(process.argv.slice(2));

  if (decision.action === 'list') {
    let catalog = null;
    try {
      catalog = await getCatalog();
    } catch {
      /* offline — fall back to installed-only listing */
    }
    console.log(formatToolList(discoverTools(), catalog));
    return 0;
  }

  if (decision.action === 'install') {
    await installTool(decision.tool);
    return 0;
  }

  if (decision.action === 'remove') {
    removeTool(decision.tool);
    return 0;
  }

  if (decision.action === 'error') {
    console.error(decision.message);
    return 1;
  }

  // action === 'exec' — transparent proxy.
  const result = spawnSync(decision.exe, decision.args, { stdio: 'inherit' });
  if (result.error) {
    console.error(`fob: failed to run ${decision.exe}: ${result.error.message}`);
    return 1;
  }
  if (result.signal) {
    // Mirror the child's fatal signal as 128+signal (shell convention).
    const SIGNALS = { SIGINT: 2, SIGKILL: 9, SIGTERM: 15 };
    return 128 + (SIGNALS[result.signal] ?? 0);
  }
  return result.status ?? 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err?.message || String(err));
    process.exit(1);
  });
