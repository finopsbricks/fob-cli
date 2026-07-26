# Where the Config File Lives

A CLI's config has to land at a predictable path so the tool finds it next run. Two conventions,
plus a universal escape hatch.

## The two conventions

| Convention | Path | Example |
|---|---|---|
| **Dotdir in home** | `~/.<tool>/` | `~/.aws/`, `~/.fly/`, our `~/.fob-stm/` |
| **XDG Base Directory** | `$XDG_CONFIG_HOME/<tool>/`, default `~/.config/<tool>/` | `~/.config/gh/`, `~/.config/stripe/` |

**XDG Base Directory** is a freedesktop.org spec that says config, data, and cache should each go in
a standard root instead of scattering dotdirs across `~`. The roots:
- `XDG_CONFIG_HOME` → config (default `~/.config`)
- `XDG_DATA_HOME` → data (default `~/.local/share`)
- `XDG_CACHE_HOME` → cache (default `~/.cache`)

The payoff: a tidy home directory, and users/backups can target one root. The cost: an extra
resolution step, and you must decide config vs data vs cache for each file.

## Who does what

| XDG-clean | Non-XDG (fixed dotdir) | Quirky |
|---|---|---|
| `gh`, Stripe, `doctl`, Heroku, Git (`~/.config/git`) | `aws`, `flyctl`, `npm`, Terraform | Vercel (uses `XDG_DATA_HOME`, not config); Wrangler (partial, open bugs) |

Compliance is genuinely split — this is a preference, not a settled best practice.

## The universal escape hatch

Every serious tool exposes **one env var that overrides the config directory**, regardless of the
convention above: `AWS_CONFIG_FILE`, `CLOUDSDK_CONFIG`, `KUBECONFIG`, `DOCKER_CONFIG`, and our
existing `FOB_STM_CONFIG_DIR`. This is non-negotiable — it's what lets CI, tests, and containers
point at a scratch config.

## The tradeoff

- **Dotdir**: dead simple, one `join(homedir(), '.fob-stm')`. Clutters `~`. What we do today.
- **XDG**: tidy, "modern", matches gh/stripe. Costs a resolution helper and a migration for existing
  users (read old path, move to new, or read both).

Neither is more secure. This is purely tidiness vs churn.

## Cross-OS note

A home-dir dotdir is the simplest **multi-OS** baseline. XDG is a Linux-desktop spec with no native
Windows/macOS meaning, so honoring it "properly" means a per-platform branch
(`~/Library/Application Support`, `%APPDATA%`) — more paths to get right. `os.homedir()` + a dotdir
is *one* deterministic path on all three OSes. This is why AWS (`~/.aws`), npm (`~/.npmrc`), and
flyctl (`~/.fly`) stay off XDG: they ship SDKs/binaries in many languages that must resolve the
*same* path identically across OSes, and AWS's `~/.aws` is a cross-SDK contract (boto3, JS, Go,
Java, Terraform all read it) that XDG would fragment.

## Family namespacing (one root for N tools)

A tool family can nest every CLI under a single root instead of scattering `~/.fob-stm`,
`~/.fob-email`, … across home: `~/.fob/<tool>/config.yml`. One folder to back up, `chmod`,
gitignore, or delete; a future `fob` dispatcher owns the root. The subdir names the tool — either
its **short name** (`~/.fob/stm`, matching the npm scope `@fob/<tool>`, no repetition) or the **full
binary name** (`~/.fob/fob-stm`, matching the `fob-<tool>` binary for grep / muscle-memory). Pick one
and apply it family-wide.

## Layering view

- **Baseline:** home-dir dotdir nested under the family root — `~/.fob/<tool>/config.yml` (`0600`),
  resolved via `os.homedir()` (cross-OS), with `FOB_<TOOL>_CONFIG_DIR` as the override. Not XDG.
- **Layer (optional, low value, later):** OS-native config dirs / XDG per platform, behind one
  copied `resolveConfigDir()` helper so every wrapper behaves identically.

The family-root nesting is worth doing at the baseline — it's cheap now and gets harder to change
once 20 wrappers have each shipped their own dotdir. XDG itself stays low priority (cosmetics, not
security or velocity).

## Related Notes
- [Tool Matrix](./tool-matrix.md)
- [Global vs Project Config](./global-vs-project-config.md) — a *second* config file inside the repo
- [engineering-standards: cli/auth-patterns.md](/Users/alex/ec2code/alex/engineering-standards/cli/auth-patterns.md)
