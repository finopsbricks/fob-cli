# Tool Matrix — Raw Facts (Install & Distribution)

Reference appendix for the dimension notes. 15 CLIs surveyed (2026-07) from official docs/install
pages. The dimension notes interpret this; here it's just the data.

## Runtime prerequisite & packaging

| Tool | Language | User needs a runtime? | How it's packaged |
|---|---|---|---|
| AWS CLI **v2** | Python | **No** (bundled) | native `.pkg`/`.msi` + linux curl bundle; **dropped pip on purpose** |
| gcloud | Python | bundles its own Python | `curl \| sh` installer + apt/yum repos |
| rustup / cargo | Rust | No | single native binary |
| deno | Rust | No | single native binary |
| bun | Zig | No | single native binary (also an npm shim that *downloads* it) |
| uv (astral) | Rust | No | single native binary |
| ollama | Go/C++ | No | native app (`.dmg`/`.exe`) + linux curl |
| gh (GitHub CLI) | Go | No | single native binary |
| stripe | Go | No | single native binary |
| doctl | Go | No | single native binary |
| kubectl | Go | No | single native binary |
| flyctl | Go | No | single native binary |
| terraform | Go | No | single native binary (zip) |
| vercel | Node | **Yes (Node)** | `npm i -g` only |
| **fob (ours)** | Node (ESM) | **Yes (Node ≥18)** | `npm i -g` only, pure-JS deps |

**The tell:** every tool built for a broad/non-dev audience compiles to a **self-contained native
binary**. The only two here that require a runtime are the two written in Node — Vercel (dev-only
audience, gets away with it) and us (finance audience, cannot).

## Distribution channels

| Tool | curl\|sh | Homebrew | winget | choco/scoop | apt/yum repo | Native installer | npm |
|---|---|---|---|---|---|---|---|
| AWS CLI v2 | ✓ (bundle) | — | — | — | — | ✓ `.pkg`/`.msi` | — |
| gcloud | ✓ | cask | — | — | ✓ | — | — |
| rustup | ✓ | ✓ | ✓ | ✓ | — | — | — |
| deno | ✓ | ✓ | ✓ | ✓ | — | — | (shim) |
| bun | ✓ | ✓ | — | ✓ | — | — | ✓ (shim) |
| uv | ✓ | ✓ | ✓ | ✓ | — | — | (pip) |
| ollama | ✓ | cask | — | — | — | ✓ `.dmg`/`.exe` | — |
| gh | — | ✓ core | ✓ | ✓ | ✓ | ✓ `.msi`/`.pkg`/`.deb` | — |
| stripe | — | ✓ | ✓ | ✓ | ✓ | `.deb`/`.rpm` | — |
| terraform | — | ✓ tap | — | — | ✓ (HashiCorp) | zip | — |
| vercel | — | — | — | — | — | — | ✓ |

Pattern: broad-audience tools offer **many** channels but always anchor on a **`curl | sh` script**
(+ a native installer for the non-dev tail). Package managers are additive convenience, never the
only path.

## Code signing & OS gatekeepers

| Tool | macOS notarized? | Windows signed? | Notes |
|---|---|---|---|
| AWS CLI v2 | ✓ (`.pkg` signed + notarized) | ✓ (`.msi` Authenticode) | the gold standard for a non-dev-heavy audience |
| gh | ✓ | ✓ | signed installers per release |
| ollama | ✓ | ✓ | consumer app → must be clean |
| docker desktop | ✓ | ✓ (EV) | consumer app |
| rustup/deno/bun (curl) | via Developer ID | SmartScreen reputation earned over time | curl-installed binaries dodge the double-click Gatekeeper dialog |

Signing facts: macOS = Apple Developer Program (**$99/yr**) → Developer ID cert → notarize via
`notarytool` → staple. Windows = Authenticode cert (**OV ~$200–400/yr, EV higher**); since 2023 the
private key must live on hardware/HSM; **EV certs earn SmartScreen reputation instantly**, OV builds
it over time/downloads.

## Updates / self-upgrade

| Tool | Update mechanism |
|---|---|
| rustup | `rustup update` (rustup manages toolchains) |
| deno | `deno upgrade` (built-in self-update) |
| bun | `bun upgrade` |
| uv | `uv self update` |
| gh | via the package manager it was installed with |
| aws v2 | re-run the installer / MSI auto-update |
| gcloud | `gcloud components update` (also manages sub-components) |
| stripe/doctl/terraform | package manager or re-download |

Two schools: **self-updating binary** (`deno upgrade`, `rustup update`, `bun upgrade` — best for
non-devs, no package manager needed) vs **defer to the package manager** (`gh`). gcloud is notable —
`components update` also installs/updates **sub-components**, the closest analog to `fob install`.

## Family / plugin / component models (the multi-binary analog)

| Tool | How it manages many parts |
|---|---|
| git | built-in subcommands **+** external `git-<x>` on PATH (our exact dispatch model) |
| gh | `gh extension install owner/repo` — external binaries, discovered & installed by the host |
| gcloud | `gcloud components install/list` — host owns a **catalog**, installs sub-components on demand |
| kubectl | `krew` plugin manager (`kubectl <plugin>`) — community catalog |
| aws | monolith — everything compiled into one binary |

The two archetypes for us: **monolith** (aws — one binary, everything in it) vs **host + catalog**
(gcloud/gh — small host that lists and installs parts). Our current dispatcher is the *git* model
(PATH discovery) with no catalog — closest to gh-extensions minus the install/list affordance.

## Caveats
- vercel/pkg (the classic "compile Node to a binary" tool) was **archived in 2024**; it now points
  users to Node SEA. Treat pkg as legacy.
- Node SEA (`--experimental-sea`) is still marked experimental as of Node 22/24; it does **not**
  cross-compile (build on each target OS, i.e. a CI matrix). Bun `--compile` **does** cross-compile.
- Homebrew *core* vs a *tap* is the crux of the OSS question — see
  [open-vs-closed-source.md](./open-vs-closed-source.md).

## Related Notes
- [README](./README.md) — how to read this folder
- all dimension notes reference this matrix
