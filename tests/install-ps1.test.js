import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// install.ps1 against a fake release served over local HTTP (pwsh's
// Invoke-WebRequest has no file:// support), run the way users run it
// (`irm … | iex`, i.e. the script text through Invoke-Expression), in
// Windows PowerShell 5.1 and, when present, PowerShell 7.
const describeWin = process.platform === 'win32' ? describe : describe.skip;
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'install.ps1');
const ASSET = 'fob-windows-x64.exe';

describeWin('install.ps1 (win32)', () => {
  let root;
  let rel;
  let server;
  let baseUrl;
  const shells = ['powershell.exe', 'pwsh.exe'].filter(
    (s) => spawnSync(s, ['-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore' }).status === 0,
  );

  beforeAll(async () => {
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
    // Static file server over `rel`; 404 for anything missing or outside it.
    server = createServer((req, res) => {
      const p = normalize(join(rel, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
      if (!p.startsWith(rel + sep) || !existsSync(p)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(readFileSync(p));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  });

  // Async spawn: the HTTP server lives in this process, so it must not be blocked.
  const run = (shell, { version, binDir }) => {
    const ps = [
      `$env:FOB_BASE_URL = '${baseUrl}'`,
      `$env:FOB_BIN_DIR = '${binDir}'`,
      version ? `$env:FOB_VERSION = '${version}'` : '',
      `try { Get-Content -Raw '${SCRIPT}' | Invoke-Expression } catch { Write-Output "ERR: $($_.Exception.Message)" }`,
      `Write-Output 'SESSION-ALIVE'`, // `exit` inside the script would skip this
    ].join('\n');
    return new Promise((resolve, reject) => {
      const child = spawn(shell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
      child.on('error', reject);
      child.on('close', () => resolve(out));
    });
  };

  it('has at least one PowerShell to test with', () => expect(shells.length).toBeGreaterThan(0));

  it.each(['powershell.exe', 'pwsh.exe'])('installs, verifies and fails safely in %s', async (shell) => {
    if (!shells.includes(shell)) return;
    const tag = shell.replace('.exe', '');

    const ok = join(root, `${tag}-ok`);
    const okOut = await run(shell, { binDir: ok });
    expect(okOut).toContain('checksum ok');
    expect(okOut).toContain('is not on your PATH');
    expect(okOut).toContain('SESSION-ALIVE');
    expect(existsSync(join(ok, 'fob.exe'))).toBe(true);

    const bad = join(root, `${tag}-bad`);
    const badOut = await run(shell, { version: 'v9.9.9', binDir: bad });
    expect(badOut).toContain('ERR: fob: checksum mismatch');
    expect(badOut).toContain('SESSION-ALIVE');
    expect(existsSync(join(bad, 'fob.exe'))).toBe(false);

    const unverified = join(root, `${tag}-nosums`);
    const unvOut = await run(shell, { version: 'v8.8.8', binDir: unverified });
    expect(unvOut).not.toContain('checksum ok');
    expect(existsSync(join(unverified, 'fob.exe'))).toBe(true);

    const missing = await run(shell, { version: 'v0.0.0', binDir: join(root, `${tag}-missing`) });
    expect(missing).toContain('ERR: fob: download failed');
    expect(missing).toContain('SESSION-ALIVE');
  }, 120000);
});
