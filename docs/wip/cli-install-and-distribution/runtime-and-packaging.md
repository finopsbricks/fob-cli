# Runtime Prerequisite & Packaging

The first fork, and the one that decides whether the primary audience can install at all: does the
user need a **runtime** (Node) already on their machine, or do we ship a **self-contained binary**
that carries its own?

## The three ways to ship a Node CLI

| Strategy | User needs Node? | What ships | Verdict for us |
|---|---|---|---|
| **A — `npm i -g`** | **Yes** | JS source + `package.json`, resolved by the user's npm | today's model; **engineer-tail only** |
| **B — self-contained binary** | **No** | one native executable per `(os, arch)` with Node bundled in | **the recommended primary path** |
| **C — vendored runtime** | No | a tiny bootstrapper that downloads a pinned Node + the JS on first run | overkill vs B; skip |

### A — require Node (`npm i -g @fob/cli`)
- **Pros:** trivial — we already have it; the family is scoped `@fob/*` with `bin` entries;
  publishing is `npm publish`. Engineers love it.
- **Cons that kill it for finance:** Node is a hard prerequisite. Global npm installs are famously
  messy — permissions/`EACCES`, PATH not updated, nvm shims that vanish per-shell, Windows PATH pain.
  And **npm ships readable JS**, so it also leaks source if we stay closed (see
  [open-vs-closed-source.md](./open-vs-closed-source.md)).
- **Keep it, but demote it.** `npm i -g` stays as *one* channel for the engineer audience, not the
  default.

### B — self-contained binary (recommended)
One native file, no runtime prerequisite, works on a machine that has never heard of Node. Tools:

| Compiler | Cross-compiles? | Maturity | Notes |
|---|---|---|---|
| **Bun `build --compile`** | **Yes** (`--target=bun-<os>-<arch>`) | stable | best DX; one CI host builds all targets |
| **Node SEA** (`--experimental-sea`) | **No** (build per OS) | experimental (Node 22/24) | official; needs `postject` to inject the blob |
| `pkg` (vercel) | yes | **archived 2024** | legacy; points users to SEA now |
| `nexe`, `caxa` | partial | niche | fallbacks |

**Our deps make this easy.** `yargs`, `imapflow`, `mailparser`, `nodemailer`, `@inquirer/prompts`,
`zod`, `js-yaml`, `dotenv` are **pure JS — no native addons** (checked across all four siblings). That
means no per-platform node-gyp rebuild headache; a clean single-binary compile is realistic. This is
the single biggest reason B is cheap for us.

- **Cost:** a build matrix — `mac-arm64`, `mac-x64`, `linux-x64`, `linux-arm64`, `win-x64`; binaries
  are ~40–90 MB (bundled runtime); each must be **signed** (see
  [code-signing-and-trust.md](./code-signing-and-trust.md)).
- **Recommendation:** **Bun `--compile`** for the cross-compile ergonomics, or Node SEA if we want to
  stay strictly on the Node toolchain. Decide in the WIP tracker.

### C — vendored runtime
The `fob` binary is tiny and downloads a pinned Node + JS bundles into `~/.fob/` on first run. More
moving parts, a network dependency at install time, and no real win over B given our pure-JS deps.
Skip unless B hits a wall.

## The precedent that settles it: AWS CLI v2

AWS CLI **v1** was `pip install awscli` — a Python-runtime prerequisite, exactly analogous to our
`npm i -g`. For **v2**, AWS **abandoned pip** and now ships **native signed installers with Python
bundled in** (`.pkg`, `.msi`, a linux curl bundle). The reason is our reason: a huge, not-uniformly-
technical user base could not be asked to manage a language runtime. If AWS — whose users skew far
more technical than accountants — moved off the runtime-dependency model, the finance audience
removes any doubt.

## The npm-shim trick (bridge, not a contradiction)

`bun` ships a native binary **and** is installable via `npm i -g bun`: the npm package is a tiny shim
whose `postinstall` **downloads the real native binary** for the user's platform. We can do the same —
`npm i -g @fob/cli` fetches the compiled, signed binary rather than running JS-that-needs-a-matching-
Node. Engineers keep npm ergonomics; we keep one real artifact and stay closed-source. Best of both.

## The tradeoff

- **Require Node (A):** zero build pipeline, publish-and-done — but excludes the entire primary
  audience and leaks source.
- **Self-contained binary (B):** a build+sign pipeline and a size hit — but the tool installs on any
  machine, hides source, and is the only thing the finance user can actually run.

The pipeline cost is paid **once for the family**, not per tool (release-velocity lens): a new
`fob-<tool>` slots into the same compile+sign+publish matrix.

## Layering view

- **Baseline (day one):** self-contained binaries (Bun `--compile` or Node SEA) for all
  `(os, arch)`, published to GitHub Releases / CDN. This is the *primary* artifact everything else
  (curl script, installers, taps) points at.
- **Layer (engineer tail):** `npm i -g @fob/cli` via the bun-style download shim, so npm users get
  the same signed binary.
- **Do not:** ship raw `npm i -g` JS as the default. It fails the audience and the closed-source goal
  at once.

The baseline does not foreclose the layers: every downstream channel is just a different wrapper
around the same signed binary, so adding channels never re-opens the packaging decision.

## Related Notes
- [distribution-channels.md](./distribution-channels.md) — the wrappers around the binary
- [code-signing-and-trust.md](./code-signing-and-trust.md) — why the binary must be signed
- [open-vs-closed-source.md](./open-vs-closed-source.md) — npm-ships-JS is why binaries and closed-source align
- [Tool Matrix](./tool-matrix.md) — who bundles a runtime vs requires one
