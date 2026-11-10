import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverTools, resolveTool, plan, formatToolList, pathDirs, windowsExts } from '../src/dispatch.js';

// POSIX semantics rely on the execute bit, which Windows filesystems don't have.
const describePosix = process.platform === 'win32' ? describe.skip : describe;
const POSIX = 'linux';

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

describePosix('discoverTools (posix)', () => {
  it('finds executable fob-<tool> files, sorted; ignores non-exec and non-prefixed', () => {
    expect(discoverTools(env, POSIX)).toEqual(['multi-word', 'orc', 'worker']);
  });
});

describePosix('resolveTool (posix)', () => {
  it('resolves an existing tool to its path', () => {
    expect(resolveTool('orc', env, POSIX)).toBe(join(dir, 'fob-orc'));
  });
  it('returns null for a missing tool and for a non-executable file', () => {
    expect(resolveTool('nope', env, POSIX)).toBeNull();
    expect(resolveTool('noexec', env, POSIX)).toBeNull();
  });
});

describe('resolveTool (all platforms)', () => {
  it('rejects tool names that are not a single path segment', () => {
    for (const platform of [POSIX, 'win32']) {
      expect(resolveTool('../fob-orc', env, platform)).toBeNull();
      expect(resolveTool('x/../../orc', env, platform)).toBeNull();
      expect(resolveTool('x\\..\\orc', env, platform)).toBeNull();
    }
  });
});

describePosix('plan (posix)', () => {
  it('execs a known tool, forwarding the remaining argv', () => {
    expect(plan(['orc', 'stations', 'list', '--json'], env, POSIX)).toEqual({
      action: 'exec',
      exe: join(dir, 'fob-orc'),
      args: ['stations', 'list', '--json'],
    });
  });
});

describe('plan', () => {
  it('lists on bare invocation, help tokens, and the list/ls built-ins', () => {
    for (const argv of [[], ['help'], ['--help'], ['-h'], ['--list'], ['list'], ['ls']]) {
      expect(plan(argv, env)).toEqual({ action: 'list' });
    }
  });
  it('errors on an unknown tool', () => {
    const d = plan(['bogus'], env);
    expect(d.action).toBe('error');
    expect(d.message).toMatch(/'bogus' is not a fob command/);
  });
  it('routes install/add to the install action with the tool name', () => {
    expect(plan(['install', 'email'], env)).toEqual({ action: 'install', tool: 'email' });
    expect(plan(['add', 'email'], env)).toEqual({ action: 'install', tool: 'email' });
    expect(plan(['install'], env).action).toBe('error');
  });
  it('routes completion to the completion action', () => {
    expect(plan(['completion'], env)).toMatchObject({ action: 'completion' });
  });
  it('routes remove/uninstall/rm to the remove action with the tool name', () => {
    expect(plan(['remove', 'email'], env)).toEqual({ action: 'remove', tool: 'email' });
    expect(plan(['uninstall', 'email'], env)).toEqual({ action: 'remove', tool: 'email' });
    expect(plan(['rm', 'email'], env)).toEqual({ action: 'remove', tool: 'email' });
    expect(plan(['remove'], env).action).toBe('error');
  });
});

// Windows behaviour is selected by the `platform` argument, so this suite runs
// on every OS. It mirrors what `npm install -g` leaves in %APPDATA%\npm.
describe('win32 PATH resolution', () => {
  let wdir;
  let wdir2;
  let wenv;
  const W = 'win32';

  beforeAll(() => {
    wdir = mkdtempSync(join(tmpdir(), 'fob-win-'));
    wdir2 = mkdtempSync(join(tmpdir(), 'fob-win2-'));
    const touch = (d, name) => writeFileSync(join(d, name), 'x');
    // npm's three shims per bin:
    touch(wdir, 'fob-stm');
    touch(wdir, 'fob-stm.cmd');
    touch(wdir, 'fob-stm.ps1');
    touch(wdir, 'fob-email');
    touch(wdir, 'fob-email.cmd');
    touch(wdir, 'fob-email.ps1');
    // a compiled binary (`fob install` / build.sh output):
    touch(wdir, 'fob-orc.exe');
    // ps1-only / sh-only / unrunnable-extension tools are not launchable:
    touch(wdir, 'fob-psonly.ps1');
    touch(wdir, 'fob-shonly');
    touch(wdir, 'fob-script.js');
    // case-insensitive filenames:
    touch(wdir, 'FOB-Upper.CMD');
    // later PATH dir: a duplicate tool (first dir wins) and a new one
    touch(wdir2, 'fob-stm.exe');
    touch(wdir2, 'fob-lgr.bat');
    // Windows commonly spells it `Path`, and PATHEXT includes non-launchable .JS etc.
    wenv = { Path: `${wdir};"${wdir2}";`, PATHEXT: '.COM;.EXE;.BAT;.CMD;.VBS;.JS;.WSH;.MSC' };
  });

  afterAll(() => {
    rmSync(wdir, { recursive: true, force: true });
    rmSync(wdir2, { recursive: true, force: true });
  });

  it('reads `Path` case-insensitively and strips quotes/empties', () => {
    expect(pathDirs(wenv, W)).toEqual([wdir, wdir2]);
    expect(pathDirs({ Path: 'x' }, POSIX)).toEqual([]); // POSIX env names are case-sensitive
  });

  it('keeps only launchable PATHEXT entries, in order', () => {
    expect(windowsExts(wenv)).toEqual(['.com', '.exe', '.bat', '.cmd']);
    expect(windowsExts({})).toEqual(['.com', '.exe', '.bat', '.cmd']); // default when unset
    expect(windowsExts({ PATHEXT: '.CMD;.EXE' })).toEqual(['.cmd', '.exe']);
  });

  it('lists each tool once, extension-stripped (no .cmd/.ps1 duplicates)', () => {
    expect(discoverTools(wenv, W)).toEqual(['Upper', 'email', 'lgr', 'orc', 'stm']);
  });

  it('resolves to the launchable shim, never the extensionless sh script', () => {
    expect(resolveTool('stm', wenv, W)).toBe(join(wdir, 'fob-stm.cmd'));
    expect(resolveTool('orc', wenv, W)).toBe(join(wdir, 'fob-orc.exe'));
    expect(resolveTool('lgr', wenv, W)).toBe(join(wdir2, 'fob-lgr.bat'));
    // `FOB-Upper.CMD` is found via a constructed `fob-upper.cmd`, which relies on a
    // case-insensitive filesystem: real Windows (and macOS) have one, Linux CI doesn't.
    if (process.platform !== 'linux') expect(resolveTool('upper', wenv, W)).not.toBeNull();
  });

  it('honours PATHEXT order within a directory', () => {
    const d = mkdtempSync(join(tmpdir(), 'fob-win3-'));
    try {
      writeFileSync(join(d, 'fob-x.cmd'), 'x');
      writeFileSync(join(d, 'fob-x.exe'), 'x');
      expect(resolveTool('x', { PATH: d, PATHEXT: '.EXE;.CMD' }, W)).toBe(join(d, 'fob-x.exe'));
      expect(resolveTool('x', { PATH: d, PATHEXT: '.CMD;.EXE' }, W)).toBe(join(d, 'fob-x.cmd'));
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('does not resolve sh-only, ps1-only, or non-launchable-extension tools', () => {
    for (const t of ['shonly', 'psonly', 'script']) expect(resolveTool(t, wenv, W)).toBeNull();
    expect(plan(['psonly'], wenv, W).action).toBe('error');
  });

  it('plan() execs the .cmd shim with argv forwarded', () => {
    expect(plan(['stm', 'accounts', 'list'], wenv, W)).toEqual({
      action: 'exec',
      exe: join(wdir, 'fob-stm.cmd'),
      args: ['accounts', 'list'],
    });
  });
});

describe('formatToolList', () => {
  it('lists installed tools, or says none found', () => {
    expect(formatToolList(['orc', 'worker'])).toContain('  orc');
    expect(formatToolList([])).toContain('No fob-<tool> executables found');
  });
  it('adds an "available" section for catalog tools that are not installed', () => {
    const catalog = { tools: { orc: { summary: 'orchestration' }, email: { summary: 'mailboxes' } } };
    const out = formatToolList(['orc'], catalog);
    expect(out).toContain('Installed tools:');
    expect(out).toContain('Available (not installed):');
    expect(out).toMatch(/email .* → fob install email/);
    // orc is installed → must not also appear as available
    expect(out).not.toMatch(/orc .* → fob install orc/);
  });
});
