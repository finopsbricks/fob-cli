# Where CLIs Store the Secret

The single biggest design choice. A CLI holds a long-lived secret (API key, token,
password) and must put it *somewhere* between commands. Three homes exist, in rising order
of security and complexity.

## The three homes

| Home | What it is | Security | Cost to build |
|---|---|---|---|
| **Plaintext file** | secret written to a file on disk (`~/.aws/credentials`), protected only by file permissions (`0600` = owner-read-only) | anyone who can read your disk / a synced backup / a stray `cat` sees it | ~zero — write a file |
| **OS keychain** | secret handed to the operating system's secret store; the OS encrypts it and gates access | encrypted at rest; other apps can't read it without OS permission | native dependency + per-OS backends + headless fallback |
| **Credential helper** | CLI shells out to a separate program that fetches/stores the secret (git's model) | as secure as the helper (often a keychain); pluggable | a protocol + at least one helper |

**OS keychain** is not one thing — it's a different service per platform, which is the source of
the complexity:
- macOS → **Keychain**
- Linux → **Secret Service** (gnome-keyring / KWallet, via `libsecret`)
- Windows → **Credential Manager** (`wincred`)

On a headless Linux box (our worker servers) there is often *no* Secret Service running, so a
keychain-only design has to fall back to something — usually a plaintext file or an env var.

## Who does what

The split is **not "modern vs legacy"** — it's *where the tool runs* (see the next section).

| Camp | Tools | Runs mostly on |
|---|---|---|
| **Keychain by default** | `gh`, Stripe (live keys), Heroku (v11.8+), Docker & Git (via helpers), **Claude Code** (macOS) | a human's laptop, interactively |
| **Plaintext file, perms-only** | `aws`, `doctl`, `flyctl`, Vercel, `npm`, Terraform | servers, CI, containers, automation |
| **Opt-in / hybrid** | Wrangler (`--use-keyring`), **Claude Code** (plaintext `0600` fallback when no keychain) | both |

Only **kubectl** documents `0600` and warns on loose permissions. Most plaintext tools don't even
do that — so our current `0600` config file is already ahead of aws/gcloud on hygiene.

## Why plaintext is deliberate, not negligence

The plaintext camp isn't careless. A keychain actively *fails* in the environments these tools
target, and a plaintext file is often the safer, more usable choice there. Six reasons:

1. **No keychain exists on servers/CI.** macOS Keychain / Linux Secret Service need a logged-in GUI
   session with an unlock daemon running. Headless boxes, containers, and CI runners don't have one
   — a keychain-first design breaks in the exact place infra tools live.
2. **Keychains prompt; automation can't tolerate prompts.** Unlock dialogs and access-approval
   popups hang a cron job or a deploy. Infra tooling is non-interactive by definition.
3. **The real secure path is the env var, not the file.** Every plaintext tool has a top-priority
   credential env var (`AWS_ACCESS_KEY_ID`, `VERCEL_TOKEN`, `NPM_TOKEN`, …) injected from a secrets
   manager (Vault, AWS Secrets Manager, CI secret store). The file is a dev-convenience cache, not
   the production path — secure storage moved *up* to the environment.
4. **Different threat model on a server.** A keychain mainly stops *other apps/users on the same
   machine* reading your dotfiles — a laptop threat. On a locked-down server, an attacker who can
   read the disk already owns the box, and the CLI key is the least valuable secret on it. `0600` +
   OS user isolation is judged good enough.
5. **Plaintext is mountable and composable.** Infra wants to `cat`, template, bind-mount, and inject
   these files (Docker secrets, k8s secret volumes, CI). A keychain entry is opaque and host-bound —
   you can't mount a macOS Keychain into a Linux container.
6. **Single static binary, no native deps.** Most (doctl, terraform, flyctl) ship as one Go binary
   that must run identically everywhere. Keychain support = per-OS native code + a fallback, which
   fights that model.

**The reframe:**

| | Keychain camp | Plaintext camp |
|---|---|---|
| Runs on | human's laptop, interactively | servers, CI, containers, automation |
| Threat defended | other apps/malware on your machine | (the server itself is the trust boundary) |
| Secure prod path | the keychain itself | env var from a secrets manager |

## The Wrangler middle path (worth understanding)

Wrangler keeps the plaintext file as default but, with `--use-keyring`, **encrypts the file** and
stores only the *encryption key* in the OS keychain. This is a clean way to add real encryption
without moving the whole secret into a platform-specific store — the file stays the single artifact,
just unreadable without the key.

## How Claude Code does it (the hybrid to copy)

Claude Code is itself a dual laptop/headless CLI, and it does exactly the layered thing (verified on
this Mac, 2026-07-25):

- **macOS → Keychain.** OAuth credentials live in a Keychain generic-password item
  (`service="Claude Code-credentials"`), *not* a file. No `~/.claude/.credentials.json` present.
- **Headless / Linux / WSL → plaintext fallback.** `~/.claude/.credentials.json`, mode `0600`, when
  no keychain is available.
- **Automation → env var.** `ANTHROPIC_API_KEY` bypasses both.
- **Config stays plaintext and separate.** `~/.claude.json` + `~/.claude/settings.json` (non-secret
  state) are ordinary files — the *secret* is in the keychain, the *metadata* is not. That's the
  [secret/metadata split](./global-vs-project-config.md) that makes the hybrid clean.

This is precisely our Layer 2/3 target: keychain on the laptop, plaintext `0600` where no keychain
exists, env var for automation — one storage module choosing per environment.

## The tradeoff

- **Plaintext**: zero deps, works identically on laptop and headless server, trivial to inspect and
  debug. Weakness: a leaked disk image or backup leaks the key.
- **Keychain**: real encryption at rest, blocks casual/other-app reads. Cost: a native module in
  *every* wrapper, three OS backends to support, and a mandatory fallback for headless — i.e. day-one
  complexity for both maintainer and user.

## Layering view

- **Baseline (day one):** plaintext `0600` file. Matches aws/doctl, zero deps, works everywhere.
  Our secrets are static api-key/secret pairs, so there's no token-refresh machinery to hide.
- **Layer 2 (later, opt-in):** Wrangler-style `--use-keyring` — encrypt the file, key in the OS
  keychain. Additive; the plaintext path stays for headless/CI.
- **Layer 3 (later):** full keychain-by-default with a plaintext escape hatch, once the keyring
  helper is proven across the family.

The baseline does not foreclose the layers: keep secret *storage* behind one module
(`config.js`) so a wrapper can swap plaintext → keyring without touching command code.

## Related Notes
- [Tool Matrix](./tool-matrix.md) — raw per-tool facts
- [Token Types & Lifecycle](./token-types-and-lifecycle.md) — a short-lived token limits blast radius even in plaintext
- [Credential Precedence](./credential-precedence.md) — the env-var path that bypasses storage entirely
- [engineering-standards: cli/auth-patterns.md](/Users/alex/ec2code/alex/engineering-standards/cli/auth-patterns.md) — our current credentials seam
