# CLI Install & Distribution — Rollout & Channel Experiments

## Status: IN PROGRESS (~55%) — Phase 1: packaging RESOLVED; `install.sh` + build + release CI authored & locally verified. **One decision left: how to expose binaries publicly while `fob-cli` stays private** (private-repo Releases aren't anonymously downloadable). Later rungs still gated.

Decide *how the `fob-<tool>` family reaches each audience*, one experiment at a time. This is the
**decisions** tracker that sits on top of the **knowledge** in
[`./cli-install-and-distribution/`](./cli-install-and-distribution/README.md) (the 9-note survey) —
the same split as [`cli-config-and-secrets`](./cli-standards-and-wrappers.md) ↔
[`cli-industry-research/`](./cli-industry-research/README.md).

Guiding intent (Alex, 2026-07-26): **keep options open; unlock unknowns one by one; narrow scope as
we go.** Do **not** make hard bets now. Build the *minimum* channel that reveals each new constraint,
and defer every channel that only duplicates a constraint already crossed.

---

## Problem Statement

We have a working `fob` dispatcher + siblings, but no way for anyone to *install* them — the repo
isn't even published. The audience is broad (accountants → founders → engineers, on mac/linux/
windows), and each slice installs differently. We don't yet know which slices install at all, which
need signed GUI installers, or whether the founder value prop is even a CLI. Committing to the full
channel matrix now would be guessing.

**Committed (not up for debate):** a **CLI** the terminal/Claude-Code-comfortable audience can
install. It gives maximum flexibility and it's the substrate every other channel wraps. We start here.

**Open:** how to reach everyone else. Resolved by experiment, not by decision.

## Approach — the boundary test + build-one-per-boundary

A channel is worth building **now** only if it **crosses a boundary** we haven't crossed — i.e. it
forces us to learn something or hit a constraint. Channels that cross the *same* boundaries as
something we've already built are **pure alternatives**: build one, defer the rest (they add support
cost and reveal nothing).

**The five boundaries** (cross one → worth an experiment):

1. **Runtime** — requires/removes a runtime prereq (Node)?
2. **Trust** — needs OS code-signing (double-click → Gatekeeper/SmartScreen)?
3. **Host** — delivered *through another app* (Claude/MCP) vs. standalone?
4. **Interaction** — terminal vs. GUI-click vs. in-chat?
5. **Runs-where** — user's laptop vs. server/CI?

Worked example: `curl` → `brew` → `winget` → `scoop` cross **zero** boundaries relative to each other
(all: standalone signed binary, terminal, no runtime, laptop) → **pure alternatives, build one.**
`npm` crosses *Runtime* (needs Node). MCP crosses *Host*. `.msi` crosses *Trust + Interaction*.

## Audience → channel map (build ONE per row; each unlocks a distinct unknown)

| Audience | Boundary crossed | **Build ONE** | Unknown it unlocks | Pure alts deferred |
|---|---|---|---|---|
| **Terminal / Claude Code users** *(committed)* | baseline | `curl \| sh` + self-contained binary | **Packaging**: do our ESM, pure-JS tools compile to a clean Node-free binary? *(gates all rows below)* | npm, brew tap, winget, choco, scoop |
| **Founders already on Claude** | Host | fob as **MCP server / plugin** (`claude mcp add`) | **Product + host**: does host-delivery skip install entirely, and is the value prop agentic? | a web app |
| **Non-terminal founders (no Claude)** | Interaction + Trust | *a behavioral test first, not a build* | do they need a GUI installer at all, or will they curl? | — |
| **Accountants / finance pros** *(later)* | Runtime + Trust + Windows | *nothing yet* — resolve "do they install at all vs. consume the report?" | signing cost + whether they're even an install audience | `.pkg` after `.msi` |

Note: `.msi` vs `.pkg` are **not** pure alternatives (different OS + signing regime) — sequenced, not
deduped, Windows first.

---

## Implementation Phases

### Phase 1: Binary + curl — the terminal/Claude-Code audience 🔄
**Goal:** a self-contained `fob` (+ siblings) that runs with **no Node installed**, delivered by a
`curl | sh` script. **Unlocks the packaging unknown that gates every later rung.** Signing is
explicitly **out of scope** here (the curl path sidesteps the double-click Gatekeeper dialog, and this
audience clicks through terminal warnings) — signing is Phase 4's unknown.

**Decisions inside Phase 1:**
- [x] **Compiler: Bun `--compile` — DECIDED (2026-07-26).** Confirmed empirically over Node SEA: the
      family is ESM (`"type": "module"`) and Bun compiles ESM natively; Node SEA's blob is CJS-oriented
      with weak ESM support. Bun 1.3.14 installed via `npm i -g bun`.
- [x] **Target matrix cross-compiles from one host — CONFIRMED.** From this Mac, `--target=bun-linux-x64`
      and `--target=bun-windows-x64` produced a genuine Linux ELF and a Windows PE32+ `.exe` (verified
      via `file`). One CI host builds `darwin-arm64/x64`, `linux-x64/arm64`, `win-x64`. Windows-x64
      download of the target runtime is the only per-target cost (~9s each, cached after).
- [ ] **Runtime install location:** per-user `~/.fob/bin` (no `sudo`, survives locked-down machines).

**Sub-tasks:**
- [x] **Dispatcher compiles + runs Node-free.** `bun build ./bin/fob.js --compile` → 61 MB binary;
      ran under `env -i` (empty env, no `node`/`sh` reachable) and printed the tool listing. Bundles the
      runtime; never shells out to Node.
- [x] **Real sibling compiles.** `fob-stm` (`yargs`, `@inquirer/*`, `js-yaml`) → **140 modules bundled
      clean**, 61 MB, ~0.3s. The "pure-JS deps bundle cleanly" claim holds. `fob-email` (imapflow/
      mailparser) still to spot-check but no reason to expect different.
- [x] **Cross-binary discovery survives compilation.** With PATH = a dir holding *only* compiled `fob`
      + `fob-stm` (no node), `fob help` listed `stm` and `fob stm --help` execed the compiled `fob-stm`
      and rendered its full yargs help tree. The git-style PATH-discovery model works between compiled
      binaries — validates the [family-install-model](./cli-install-and-distribution/family-install-model.md) baseline.
- [x] **Measured:** ~61 MB per binary (bundled runtime — the expected size floor; siblings share it, so
      N tools ≈ N×61 MB unless we later dedup via a shared runtime). Build output gitignored (`dist/`).
- [x] **`install.sh`** — detects os/arch, downloads the asset + `SHA256SUMS`, **verifies the checksum**,
      installs to `~/.fob/bin`, and only *prints* the PATH line (does **not** edit rc files — per Alex,
      no machine-config changes). `FOB_VERSION` / `FOB_BIN_DIR` overrides. Syntax + checksum-verify logic
      tested locally against the real build. (`install.ps1` deferred — Phase-1 pure alternative.)
- [x] **Build script + release CI.** `scripts/build.sh` (`bun run build`) compiles all 5 targets +
      `SHA256SUMS`; `.github/workflows/release.yml` (tag `v*` → `contents: write` → `bun run build` →
      `softprops/action-gh-release` **draft**). Matches `apps/fob-watch/release.yml`'s tag pattern but
      single-runner (Bun cross-compiles). Full build verified locally: 5 binaries, 61–94 MB.
- [ ] **⚠️ Public download vs private repo — DECISION NEEDED (finding 2026-07-26).** `fob-cli` is a
      **private** GitHub repo (correct for closed-source), but **private-repo Release assets and
      `raw.githubusercontent` are NOT anonymously downloadable** — a bare `curl | sh` would 404 without
      a token. So closed-source + GitHub-Releases + public curl can't all come from the *source* repo.
      Clean resolutions (binaries are compiled, so exposing them does **not** open source —
      [open-vs-closed-source](./cli-install-and-distribution/open-vs-closed-source.md)):
      1. **Public `dist` repo** (e.g. `finopsbricks/fob` or `fob-dist`) holding only `install.sh` +
         release binaries; the source stays private. CI pushes artifacts there. *(recommended — cheapest,
         stays on GitHub)*
      2. **CDN / object store** (R2/S3 public bucket) behind `get.fob.io`; CI uploads. *(nicer URL, more setup)*
      3. Flip `fob-cli` public now. *(reopens the OSS decision we're deliberately deferring — no)*
      `install.sh`'s `REPO` var is the only thing that changes once this is picked.
- [ ] **Cut the first release** (push a `v*` tag → CI drafts the release → publish) — **gated on the
      decision above** so the curl one-liner actually resolves. Local tag `v1.0.0` exists but is not the
      binary release; use a fresh tag after wiring the dist target.

**Explicitly deferred (Phase-1 pure alternatives — same audience, zero new constraint):**
`npm i -g` (crosses Runtime, only a stopgap), Homebrew tap, winget, choco, scoop, `install.ps1`.
Parked, not rejected — build when demand appears; they don't gate anything.

### Phase 2: MCP / plugin — founders already on Claude ❌ (gated: start after Phase 1 proves the binary)
- [ ] Expose the fob client layer (`fobStm(creds)` etc.) as an **MCP server / Claude plugin**.
- [ ] Learn: does host-delivery skip the install problem for this audience? Is the value prop agentic
      ("ask my data / interim audit / flag issues → report for the accountant")?
- [ ] Reuses the unified client libs; **no signing, no binary distribution.**

### Phase 3: Behavioral test — do non-terminal founders curl? ❌ (near-zero build)
- [ ] Put the Phase-1 curl one-liner in front of 3 real non-terminal founders; observe.
- [ ] Output: a yes/no on whether we ever need to climb the expensive signed-installer rung.

### Phase 4: Signed GUI installer ❌ (gated: only if Phase 3 shows curl fails AND the audience is in reach)
- [ ] Unlock the **code-signing** unknown: Apple notarization + Windows Authenticode (cost, hardware
      token, pipeline). `.msi` first (finance is Windows-heavy), `.pkg` second.

### Phase 5: Accountant stack ❌ (gated: resolve "do they install at all?" first)
- [ ] Decide whether accountants are an install audience or a *report-consuming* one before building
      anything. The founder→accountant report motion (Phase 2/3) may answer this for free.

---

## Related Files
- [`./cli-install-and-distribution/`](./cli-install-and-distribution/README.md) — the knowledge this
  tracker decides against (runtime/packaging, channels, signing, OSS, family model, updates, onboarding)
- [`./cli-standards-and-wrappers.md`](./cli-standards-and-wrappers.md) — parent family effort; its
  "wire the 4 binaries on PATH" housekeeping item is the near-term slice of Phase 1
- `../../bin/fob.js`, `../../src/dispatch.js` — the dispatcher being compiled first (zero-dep target)

## Related Notes
- [WIP Files Pattern](/Users/alex/ec2code/alex/engineering-standards/git-workflow/wip-files.md)
