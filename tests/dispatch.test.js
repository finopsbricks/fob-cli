import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverTools, resolveTool, plan, formatToolList } from '../src/dispatch.js';

let dir;
let env;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'fob-bin-'));
  const exe = (name) => {
    const p = join(dir, name);
    writeFileSync(p, '#!/bin/sh\necho hi\n');
    chmodSync(p, 0o755);
  };
  exe('fob-orc');
  exe('fob-worker');
  exe('fob-multi-word'); // tool name may contain hyphens
  // Not discoverable:
  writeFileSync(join(dir, 'fob-noexec'), 'x'); // present but not executable
  chmodSync(join(dir, 'fob-noexec'), 0o644);
  writeFileSync(join(dir, 'notfob'), 'x'); // wrong prefix
  chmodSync(join(dir, 'notfob'), 0o755);
  env = { PATH: dir };
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('discoverTools', () => {
  it('finds executable fob-<tool> files, sorted; ignores non-exec and non-prefixed', () => {
    expect(discoverTools(env)).toEqual(['multi-word', 'orc', 'worker']);
  });
});

describe('resolveTool', () => {
  it('resolves an existing tool to its path', () => {
    expect(resolveTool('orc', env)).toBe(join(dir, 'fob-orc'));
  });
  it('returns null for a missing tool and for a non-executable file', () => {
    expect(resolveTool('nope', env)).toBeNull();
    expect(resolveTool('noexec', env)).toBeNull();
  });
});

describe('plan', () => {
  it('lists on bare invocation and help tokens (no built-ins)', () => {
    for (const argv of [[], ['help'], ['--help'], ['-h'], ['--list']]) {
      expect(plan(argv, env)).toEqual({ action: 'list' });
    }
  });
  it('execs a known tool, forwarding the remaining argv', () => {
    expect(plan(['orc', 'stations', 'list', '--json'], env)).toEqual({
      action: 'exec',
      exe: join(dir, 'fob-orc'),
      args: ['stations', 'list', '--json'],
    });
  });
  it('errors on an unknown tool', () => {
    const d = plan(['bogus'], env);
    expect(d.action).toBe('error');
    expect(d.message).toMatch(/'bogus' is not a fob command/);
  });
});

describe('formatToolList', () => {
  it('lists tools, or says none found', () => {
    expect(formatToolList(['orc', 'worker'])).toContain('  orc');
    expect(formatToolList([])).toContain('No fob-<tool> executables found');
  });
});
