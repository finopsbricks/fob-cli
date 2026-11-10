import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSpec, escapeCmdArgument, escapeCmdCommand } from '../src/spawn.js';

const FOB = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'fob.js');

describe('spawnSpec', () => {
  it('spawns directly off Windows', () => {
    expect(spawnSpec('/usr/bin/fob-orc', ['a b', 'c&d'], { platform: 'linux' })).toEqual({
      command: '/usr/bin/fob-orc',
      args: ['a b', 'c&d'],
      options: { stdio: 'inherit' },
    });
  });

  it('spawns .exe directly on Windows', () => {
    const s = spawnSpec('C:\\bin\\fob-orc.exe', ['x'], { platform: 'win32', env: {} });
    expect(s.command).toBe('C:\\bin\\fob-orc.exe');
    expect(s.args).toEqual(['x']);
    expect(s.options.windowsVerbatimArguments).toBeUndefined();
  });

  it('routes .cmd/.bat through cmd.exe with a verbatim, escaped command line', () => {
    for (const exe of ['C:\\npm\\fob-stm.cmd', 'C:\\npm\\fob-stm.CMD', 'C:\\npm\\fob-stm.bat']) {
      const s = spawnSpec(exe, ['list'], { platform: 'win32', env: { ComSpec: 'C:\\Windows\\system32\\cmd.exe' } });
      expect(s.command).toBe('C:\\Windows\\system32\\cmd.exe');
      expect(s.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
      expect(s.args[3]).toBe(`"${escapeCmdCommand(exe)} ^^^"list^^^""`);
      expect(s.options).toEqual({ stdio: 'inherit', windowsVerbatimArguments: true });
    }
  });

  it('falls back to cmd.exe when ComSpec is unset', () => {
    expect(spawnSpec('C:\\npm\\fob-stm.cmd', [], { platform: 'win32', env: {} }).command).toBe('cmd.exe');
  });
});

describe('cmd escaping', () => {
  it('escapes spaces and metacharacters in the program path', () => {
    expect(escapeCmdCommand('C:\\Program Files\\npm\\fob-x.cmd')).toBe('C:\\Program^ Files\\npm\\fob-x.cmd');
  });
  it('double-escapes metacharacters inside the quoted argument', () => {
    expect(escapeCmdArgument('a&b')).toBe('^^^"a^^^&b^^^"');
    expect(escapeCmdArgument('')).toBe('^^^"^^^"');
  });
  it('applies MSVCRT quote/backslash rules before ^-escaping', () => {
    // a"b  → "a\"b"  ; trailing backslash doubled before the closing quote
    expect(escapeCmdArgument('a"b')).toBe('^^^"a\\^^^"b^^^"');
    expect(escapeCmdArgument('dir\\')).toBe('^^^"dir\\\\^^^"');
  });
});

// End-to-end: run the real bin/fob.js against a fake `fob-echo` on a temp PATH and
// check every argument arrives byte-for-byte. On Windows the tool is an npm-style
// .cmd shim (the case that used to fail with ENOENT); elsewhere a node script.
describe('fob <tool> end-to-end', () => {
  let dir;
  const isWin = process.platform === 'win32';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'fob e2e ')); // space in the path on purpose
    const script = join(dir, 'echo-args.cjs');
    writeFileSync(script, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));process.exitCode=Number(process.env.FOB_E2E_EXIT||0);\n');
    if (isWin) {
      // Same shape as npm's cmd-shim: forwards %* to node.
      writeFileSync(join(dir, 'fob-echo.cmd'), `@ECHO off\r\n"${process.execPath}" "%~dp0\\echo-args.cjs" %*\r\n`);
      writeFileSync(join(dir, 'fob-echo'), '#!/bin/sh\nexit 99\n'); // the sh shim must be ignored
      writeFileSync(join(dir, 'fob-echo.ps1'), 'exit 98\n');
    } else {
      const p = join(dir, 'fob-echo');
      writeFileSync(p, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
      chmodSync(p, 0o755);
    }
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const run = (args, extraEnv = {}) => {
    const sep = isWin ? ';' : ':';
    const env = { ...process.env, PATH: `${dir}${sep}${process.env.PATH || ''}`, ...extraEnv };
    if (isWin) delete env.Path; // avoid two PATH keys in the child env block
    return spawnSync(process.execPath, [FOB, 'echo', ...args], { env, encoding: 'utf8' });
  };

  it('forwards awkward arguments untouched', () => {
    const args = [
      'plain', 'with space', 'a&b', 'pipe|x', 'semi;colon', 'quote"inside', 'caret^',
      '100%', '%PATH%', 'bang!', '<lt>', '(paren)', 'trail\\', '\\"', '', '*?', 'ünïcödé',
    ];
    const res = run(args);
    expect(res.stderr).toBe('');
    expect(JSON.parse(res.stdout)).toEqual(args);
    expect(res.status).toBe(0);
  });

  it('propagates the child exit code', () => {
    expect(run([], { FOB_E2E_EXIT: '7' }).status).toBe(7);
  });

  it('lists the tool once in `fob help`', () => {
    const sep = isWin ? ';' : ':';
    const env = { ...process.env, PATH: `${dir}${sep}${process.env.PATH || ''}`, FOB_CATALOG_URL: 'http://127.0.0.1:9/none' };
    if (isWin) delete env.Path;
    const out = spawnSync(process.execPath, [FOB, 'help'], { env, encoding: 'utf8' }).stdout;
    const lines = out.split('\n').filter((l) => /^\s+echo(\.|\s|$)/.test(l));
    expect(lines).toHaveLength(1);
  });
});
