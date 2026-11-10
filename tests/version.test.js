import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/version.js';
import { plan } from '../src/dispatch.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('fob --version', () => {
  it('src/version.js matches package.json (bump both together)', () => {
    expect(VERSION).toBe(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version);
  });
  it('routes --version/-v/-V, but leaves bare `version` dispatchable', () => {
    for (const f of ['--version', '-v', '-V']) expect(plan([f], {})).toEqual({ action: 'version' });
    expect(plan(['version'], {}).action).toBe('error'); // no fob-version on an empty PATH
  });
  it('prints the version', () => {
    const res = spawnSync(process.execPath, [join(root, 'bin', 'fob.js'), '--version'], { encoding: 'utf8' });
    expect(res.stdout.trim()).toBe(VERSION);
    expect(res.status).toBe(0);
  });
});
