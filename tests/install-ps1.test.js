import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// install.ps1 against a fake release on file://, run the way users run it
// (`irm … | iex`, i.e. the script text through Invoke-Expression), in
// Windows PowerShell 5.1 and, when present, PowerShell 7.
const describeWin = process.platform === 'win32' ? describe : describe.skip;
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'install.ps1');
const ASSET = 'fob-windows-x64.exe';

describeWin('install.ps1 (win32)', () => {
  let root;
  let rel;
  const shells = ['powershell.exe', 'pwsh.exe'].filter(
    (s) => spawnSync(s, ['-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore' }).status === 0,
  );

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'fob-ps1-'));
    rel = join(root, 'release');
    // Any small real exe stands in for fob.exe.
    const exe = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe');
    const sha = createHash('sha256').update(readFileSync(exe)).digest('hex');
    for (const [dir, hash] of [
      [rel, sha], // latest: good checksum
      [join(rel, 'v9.9.9'), '0'.repeat(64)], // pinned: bad checksum
      [join(rel, 'v8.8.8'), null], // pinned: no SHA256SUMS published
    ]) {
      mkdirSync(dir, { recursive: true });
      copyFileSync(exe, join(dir, ASSET));
      if (hash) writeFileSync(join(dir, 'fob-SHA256SUMS'), `${hash}  ${ASSET}\n`);
    }
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const run = (shell, { version, binDir }) => {
    const ps = [
      `$env:FOB_BASE_URL = '${pathToFileURL(rel).href}'`,
      `$env:FOB_BIN_DIR = '${binDir}'`,
      version ? `$env:FOB_VERSION = '${version}'` : '',
      `try { Get-Content -Raw '${SCRIPT}' | Invoke-Expression } catch { Write-Output "ERR: $($_.Exception.Message)" }`,
      `Write-Output 'SESSION-ALIVE'`, // `exit` inside the script would skip this
    ].join('\n');
    const res = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
      encoding: 'utf8',
    });
    return `${res.stdout}\n${res.stderr}`;
  };

  it('has at least one PowerShell to test with', () => expect(shells.length).toBeGreaterThan(0));

  it.each(['powershell.exe', 'pwsh.exe'])('installs, verifies and fails safely in %s', (shell) => {
    if (!shells.includes(shell)) return;
    const tag = shell.replace('.exe', '');

    const ok = join(root, `${tag}-ok`);
    const okOut = run(shell, { binDir: ok });
    expect(okOut).toContain('checksum ok');
    expect(okOut).toContain('is not on your PATH');
    expect(okOut).toContain('SESSION-ALIVE');
    expect(existsSync(join(ok, 'fob.exe'))).toBe(true);

    const bad = join(root, `${tag}-bad`);
    const badOut = run(shell, { version: 'v9.9.9', binDir: bad });
    expect(badOut).toContain('ERR: fob: checksum mismatch');
    expect(badOut).toContain('SESSION-ALIVE');
    expect(existsSync(join(bad, 'fob.exe'))).toBe(false);

    const unverified = join(root, `${tag}-nosums`);
    const unvOut = run(shell, { version: 'v8.8.8', binDir: unverified });
    expect(unvOut).not.toContain('checksum ok');
    expect(existsSync(join(unverified, 'fob.exe'))).toBe(true);

    const missing = run(shell, { version: 'v0.0.0', binDir: join(root, `${tag}-missing`) });
    expect(missing).toContain('ERR: fob: download failed');
    expect(missing).toContain('SESSION-ALIVE');
  }, 120000);
});
