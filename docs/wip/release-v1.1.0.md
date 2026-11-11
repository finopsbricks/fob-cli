# Release fob-cli v1.1.0 (Windows support)

## Status: BLOCKED — release commit is ready (`chore: release v1.1.0`, local on the Mac, not tagged, not pushed). Needs npm login + an R2 upload route. Deferred on 2026-11-11.

v1.1.0 ships the work in [windows-support.md](./windows-support.md) plus `install.ps1`. It matters
because the **live 1.0.0 is broken on Windows**. Installing it with `install.ps1` into a scratch dir
and running `fob help` gives `No fob-<tool> executables found on PATH.`, and every `fob <tool>`
fails with ENOENT. Today `npm i -g @finopsbricks/fob-cli` also gets 1.0.0.

---

## Current state (2026-11-11)

| Thing | State |
|---|---|
| `main` | All Windows work pushed (through `fix(install.ps1): hash with .NET; test over HTTP`); Test workflow green on ubuntu/macos/windows × Node 20/22 |
| Version bump | `chore: release v1.1.0` (package.json, package-lock.json, src/version.js), **local only** |
| Tag `v1.1.0` | not created |
| npm | only `1.0.0` published; owner `alexjv89` |
| R2 (get.finopsbricks.com) | 1.0.0 binaries from 2026-07-26 at the bucket root; no `install.ps1`; no versioned `v1.0.0/` prefix |

## Blockers

1. **npm auth expired.** `npm whoami` on the Mac returns `E401`, so the token in `~/.npmrc` is
   dead. Fix: `npm login` (as `alexjv89`), interactive.
2. **No R2 upload route.**
   - GitHub repo `finopsbricks/fob-cli` has **no Actions secrets**, and `release.yml` has never
     run. Pushing a `v*` tag now would build fine, then fail at the upload step.
   - 1.0.0 was uploaded by hand with `scripts/release.sh`, but neither `wrangler` nor `bun` is
     installed on the Mac any more.

## Steps

### A. GitHub Actions (preferred, repeatable)

1. Add repo secrets on `finopsbricks/fob-cli`:
   - `CLOUDFLARE_API_TOKEN`: token with *Workers R2 Storage: Edit*
   - `CLOUDFLARE_ACCOUNT_ID`: see the comment at the top of `.github/workflows/release.yml`
2. `git push origin main` (the release commit), then `git tag -a v1.1.0 -m v1.1.0 && git push origin v1.1.0`.
3. Watch: `gh run watch -R finopsbricks/fob-cli $(gh run list -R finopsbricks/fob-cli -w Release -L 1 --json databaseId -q '.[0].databaseId')`.

### B. Manual from the Mac

1. `brew install oven-sh/bun/bun` (or `curl -fsSL https://bun.sh/install | bash`) and `npm i -g wrangler`.
2. `wrangler login` (browser OAuth).
3. Push the release commit + tag as in A.2. Note that pushing the tag also starts `release.yml`,
   which fails at upload until A.1 is done. Either ignore that run, or do A.1 anyway.
4. `scripts/release.sh v1.1.0`. It builds all 5 targets, uploads latest + `v1.1.0/`, plus
   `install.sh`, `install.ps1` and `catalog.json`, and checks each over https.

### Then, either way: npm

```sh
npm login
cd ~/ec2code/finopsbricks/cli/fob-cli && npm publish     # publishConfig.access = public
```

## Verify after release

- [ ] `curl -sI https://get.finopsbricks.com/install.ps1` returns 200.
- [ ] `https://get.finopsbricks.com/fob-SHA256SUMS` returns 200. The 1.0.0 upload has `SHA256SUMS`
      instead, which `install.sh` / `install.ps1` don't look for, so **checksums are silently skipped
      today**. Current build.sh writes `fob-SHA256SUMS`.
- [ ] `https://get.finopsbricks.com/v1.1.0/fob-windows-x64.exe` returns 200 (pinned prefix).
- [ ] Windows: `irm https://get.finopsbricks.com/install.ps1 | iex` prints `checksum ok` and
      `fob: installed 1.1.0`; then `fob help` lists tools once and `fob stm --version` works.
- [ ] Windows: `npm i -g @finopsbricks/fob-cli@1.1.0` gives the same checks.
- [ ] macOS/Linux: `curl -fsSL https://get.finopsbricks.com/install.sh | sh` prints `checksum ok`.
- [ ] Optionally consider removing the stale root `SHA256SUMS` from R2 after the new upload.

## Related, not in this release

- `fob-email-windows-x64.exe` isn't on R2 (only the SHA file is), so `fob install email` fails on
  Windows until fob-email does a release that includes the windows target.
- fob-lgr's `prepublishOnly` uses POSIX shell (`test -z "$(git status --porcelain)"`), so it
  can't publish from Windows.
