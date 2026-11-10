import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, completionScript, formatToolList, defaultCompletionShell } from '../src/dispatch.js';

const FOB = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'fob.js');

describe('fob completion <shell>', () => {
  it('defaults to bash on POSIX and powershell on win32', () => {
    expect(defaultCompletionShell('darwin')).toBe('bash');
    expect(defaultCompletionShell('win32')).toBe('powershell');
    expect(plan(['completion'], {}, 'linux')).toEqual({ action: 'completion', shell: 'bash' });
    expect(plan(['completion'], {}, 'win32')).toEqual({ action: 'completion', shell: 'powershell' });
  });
  it('accepts an explicit shell (pwsh is an alias) and rejects unknown ones', () => {
    expect(plan(['completion', 'zsh'], {}, 'linux').shell).toBe('zsh');
    expect(plan(['completion', 'PowerShell'], {}, 'linux').shell).toBe('powershell');
    expect(plan(['completion', 'pwsh'], {}, 'linux').shell).toBe('powershell');
    expect(plan(['completion', 'fish'], {}, 'linux')).toMatchObject({ action: 'error' });
  });
  it('emits the matching script', () => {
    expect(completionScript('bash')).toContain('complete -o bashdefault');
    expect(completionScript('zsh')).toContain('complete -o bashdefault');
    expect(completionScript('powershell')).toContain('Register-ArgumentCompleter -Native');
  });
  it('shows a platform-appropriate hint in `fob help`', () => {
    expect(formatToolList([], null, 'darwin')).toContain('source <(fob completion)');
    expect(formatToolList([], null, 'win32')).toContain('fob completion powershell | Out-String | Invoke-Expression');
  });
});

// Real PowerShell, real TabExpansion2, against a fake yargs-style tool on PATH.
// Runs in Windows PowerShell 5.1 and, when present (e.g. CI), PowerShell 7 —
// they differ in how empty native arguments are passed, which the script handles.
const describeWin = process.platform === 'win32' ? describe : describe.skip;

describeWin('PowerShell completer (win32)', () => {
  let dir;
  const shells = ['powershell.exe', 'pwsh.exe'].filter(
    (s) => spawnSync(s, ['-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore' }).status === 0,
  );

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'fob-comp-'));
    // Minimal stand-in for yargs' --get-yargs-completions <exe> <words…>.
    writeFileSync(
      join(dir, 'fake.cjs'),
      `const a = process.argv.slice(2);
       if (a[0] !== '--get-yargs-completions') process.exit(2);
       const words = a.slice(2); // drop flag + exe name; last word is the one being completed
       const out = words.length <= 1 ? ['alpha', 'beta'] : words[0] === 'alpha' ? ['one', 'two'] : [];
       process.stdout.write(out.join('\\n') + '\\n');\n`,
    );
    writeFileSync(join(dir, 'fob-qqfake.cmd'), `@ECHO off\r\n"${process.execPath}" "%~dp0\\fake.cjs" %*\r\n`);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const complete = (shell, lines) => {
    const ps = [
      `& '${process.execPath}' '${FOB}' completion powershell | Out-String | Invoke-Expression`,
      ...lines.map(
        (l) => `(TabExpansion2 -inputScript '${l}' -cursorColumn ${l.length}).CompletionMatches.CompletionText -join ',' | Write-Output`,
      ),
    ].join('\n');
    const env = { ...process.env, PATH: `${dir};${process.env.PATH || process.env.Path || ''}` };
    delete env.Path;
    const res = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', ps], { env, encoding: 'utf8' });
    return res.stdout.split(/\r?\n/).slice(0, lines.length);
  };

  it('has at least one PowerShell to test with', () => {
    expect(shells.length).toBeGreaterThan(0);
  });

  it.each(['powershell.exe', 'pwsh.exe'])('completes tools, built-ins and delegated words in %s', (shell) => {
    if (!shells.includes(shell)) return; // not installed here
    const [top, partial, sub, subPartial, nested, comp] = complete(shell, [
      'fob ',
      'fob qq',
      'fob qqfake ',
      'fob qqfake al',
      'fob qqfake alpha ',
      'fob completion p',
    ]);
    expect(top.split(',')).toEqual(expect.arrayContaining(['help', 'install', 'completion', 'qqfake']));
    expect(partial).toBe('qqfake');
    expect(sub).toBe('alpha,beta');
    expect(subPartial).toBe('alpha');
    expect(nested).toBe('one,two'); // needs the empty current word to reach the tool
    expect(comp).toBe('powershell');
  }, 60000);
});
