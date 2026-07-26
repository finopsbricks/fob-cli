# Tool Matrix — Raw Facts

Reference appendix for the dimension notes. 14 CLIs surveyed (2026-07-25) from official docs.
The dimension notes interpret this; here it's just the data.

## Config location & format

| Tool | Config path | XDG? | Format | Dir-override env |
|---|---|---|---|---|
| gh | `$XDG_CONFIG_HOME/gh` → `~/.config/gh` (`config.yml` + `hosts.yml`) | yes | YAML | `GH_CONFIG_DIR` |
| aws | `~/.aws/config` + `~/.aws/credentials` | no | INI | `AWS_CONFIG_FILE`, `AWS_SHARED_CREDENTIALS_FILE` |
| gcloud | `~/.config/gcloud` (coincidental, not XDG) | no | INI + SQLite + JSON | `CLOUDSDK_CONFIG` |
| kubectl | `~/.kube/config` | no | YAML | `KUBECONFIG` (merges many) |
| docker | `~/.docker/config.json` | no | JSON | `DOCKER_CONFIG` |
| Wrangler | `~/.config/.wrangler/config/default.toml` | partial | TOML / `.enc` | `WRANGLER_*` (cache/log only) |
| Stripe | `~/.config/stripe/config.toml` | yes | TOML | (Go `os.UserConfigDir`) |
| Vercel | `~/.local/share/com.vercel.cli` (uses **DATA**, not config) | data-only | JSON | `--global-config` |
| Heroku | full XDG dirs | yes | netrc (creds) | XDG vars |
| flyctl | `~/.fly/config.yml` | no | YAML | — |
| Terraform | `~/.terraformrc` + `~/.terraform.d/credentials.tfrc.json` | no | HCL + JSON | `TF_CLI_CONFIG_FILE` |
| npm | `./.npmrc` → `~/.npmrc` → global | no | INI-like | `NPM_CONFIG_USERCONFIG` |
| git | `~/.gitconfig` or `~/.config/git/config` | partial | INI | `GIT_CONFIG_GLOBAL` |
| doctl | `~/.config/doctl/config.yaml` (macOS: App Support) | yes | YAML | `--config` |
| **fob-stm** | `~/.fob-stm/config.yml` | no | YAML | `FOB_STM_CONFIG_DIR` |

## Profile model & switching

| Tool | Entity name | Active pointer | Switch command | Per-cmd flag |
|---|---|---|---|---|
| gh | per-host account | `hosts.yml` | `auth switch` | `--hostname` |
| aws | profile | (implicit `default`) | edit / env | `--profile` |
| gcloud | configuration | `active_config` | `config configurations activate` | `--configuration` |
| kubectl | context | `current-context` | `config use-context` | `--context` |
| docker | context | `currentContext` | `context use` | `--context` |
| Wrangler | env / auth profile | dir binding | `auth activate` | `--env`, `--profile` |
| Stripe | project | `default` | `login switch` | `--project-name` |
| Vercel | team scope | `currentTeam` | — | `--scope` |
| Heroku | app / account | git remote | `accounts:set` (plugin) | `--app` |
| flyctl | org | login | — | `--org` |
| Terraform | workspace + HCP org | `TF_WORKSPACE` | `workspace select` | — |
| npm | registry scope | (URL-matched) | — | — |
| git | URL-matched | (URL-matched) | — | `credential.<url>` |
| doctl | context | in `config.yaml` | `auth switch --context` | `--context` |
| **fob-stm** | org | `current_org` | `config use` | `--org` |

## Secret storage

| Tool | Default store | Keychain? | CI env var |
|---|---|---|---|
| gh | OS keyring | default | `GH_TOKEN` |
| aws | plaintext INI (`~/.aws/credentials`) | no (SSO cache separate) | `AWS_ACCESS_KEY_ID`/`_SECRET_ACCESS_KEY` |
| gcloud | SQLite + JSON in config dir | no | `GOOGLE_APPLICATION_CREDENTIALS` |
| kubectl | plaintext YAML / exec plugin | via exec plugin | (exec plugin) |
| docker | base64 in `config.json` | via cred helper (osxkeychain default on macOS) | — |
| Wrangler | plaintext TOML | opt-in (`--use-keyring`, encrypts file) | `CLOUDFLARE_API_TOKEN` |
| Stripe | OS keyring (live keys) | default | `STRIPE_API_KEY` |
| Vercel | plaintext `auth.json` | no | `VERCEL_TOKEN` |
| Heroku | OS keychain (v11.8+) | default (netrc fallback) | `HEROKU_API_KEY` |
| flyctl | plaintext `config.yml` | no | `FLY_API_TOKEN` |
| Terraform | plaintext JSON | via cred helper | `TF_TOKEN_<host>` |
| npm | plaintext `.npmrc` (`${VAR}` interp) | no | `NPM_TOKEN` (convention) |
| git | helper: store/cache/osxkeychain/libsecret/wincred/manager | via helper | `GIT_*` |
| doctl | plaintext `config.yaml` | no | `DIGITALOCEAN_ACCESS_TOKEN` |
| **fob-stm** | plaintext YAML `0600` | no | `FOB_STM_API_URL`/`_KEY`/`_SECRET` |

## Token type

| Tool | Token issued |
|---|---|
| gh, Heroku, Wrangler | OAuth (short-lived access + refresh) |
| aws | long-lived IAM keys **or** short-lived SSO/STS |
| Stripe | restricted (scoped) keys, 90-day expiry |
| flyctl | macaroons (scopable: org / app / deploy / read-only) |
| npm | granular tokens (90-day cap) + OIDC trusted publishing |
| Terraform | HCP API token (long-lived) |
| Vercel, doctl | long-lived token |
| **fob-stm** | long-lived api-key + api-secret (Pattern A) |

## Caveats
- flyctl / Terraform token-file permissions not confirmed from official docs (unverified `0600`).
- gh had bugs (cli/cli #7757, #8954) falling back to plaintext when keyring unavailable — a warning
  for any keychain design: the fallback path is where leaks happen.

## Related Notes
- [README](./README.md) — how to read this folder
- all dimension notes reference this matrix
