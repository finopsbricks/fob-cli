#!/usr/bin/env node
/**
 * `fob` — the git-style dispatcher. Resolves `fob <tool> …` to a `fob-<tool>`
 * executable on PATH and execs it transparently (inherited stdio, argv forwarded
 * untouched, child exit code propagated), so `fob <tool> …` is indistinguishable
 * from calling `fob-<tool> …` directly in scripts and pipelines.
 */

import { spawnSync } from 'node:child_process';
import { discoverTools, formatToolList, plan } from '../src/dispatch.js';

const argv = process.argv.slice(2);
const decision = plan(argv);

if (decision.action === 'list') {
  console.log(formatToolList(discoverTools()));
  process.exit(0);
}

if (decision.action === 'error') {
  console.error(decision.message);
  process.exit(1);
}

// action === 'exec' — transparent proxy.
const result = spawnSync(decision.exe, decision.args, { stdio: 'inherit' });
if (result.error) {
  console.error(`fob: failed to run ${decision.exe}: ${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  // Mirror the child's fatal signal as 128+signal (shell convention).
  const SIGNALS = { SIGINT: 2, SIGKILL: 9, SIGTERM: 15 };
  process.exit(128 + (SIGNALS[result.signal] ?? 0));
}
process.exit(result.status ?? 0);
