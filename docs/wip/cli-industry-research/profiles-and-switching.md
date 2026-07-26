# Multiple Accounts: Profiles, Contexts, and Switching

Every CLI that talks to more than one account/environment needs a way to name them, mark one
active, and switch. The shape is near-universal — we already implement it.

## The universal shape

1. **A named entity** holding one account's settings/creds.
2. **An active-selection pointer** persisted in the config (which name is current).
3. **A switch command** to change the pointer (`use` / `switch` / `activate`).
4. **A per-command flag** to override the pointer for one invocation.

Only the *vocabulary* differs per tool:

| Tool | Name for the entity | Switch command | Per-command flag |
|---|---|---|---|
| AWS | **profile** | (edit / `AWS_PROFILE`) | `--profile` |
| gcloud | **configuration** | `config configurations activate` | `--configuration` |
| kubectl | **context** | `config use-context` | `--context` |
| Docker | **context** | `context use` | `--context` |
| doctl | **context** | `auth switch --context` | `--context` |
| gh | per-**host** account | `auth switch` | `--hostname` |
| **fob-stm (ours)** | **org** | `config use <org>` | `--org` |

Our `orgs` map + `current_org` pointer + `config use` + `--org` flag is exactly this pattern. The
model is done and correct; "org" is the right word for us because our tenancy *is* per-org.

## Two things the mature tools add

- **A `status` / `current` command** that prints the active identity and *where it came from* (flag
  vs env vs stored). gh's `auth status`, aws's `sts get-caller-identity`. We partly do this — every
  command resolves a `source` string; we could surface it in a `config status`.
- **A one-time stderr hint** when the active identity comes from a non-obvious source (e.g. a local
  `.env` overriding the config). Our standard already requires this; keep it.

## The tradeoff

There isn't much of one — the pattern is cheap and universal. The only choice is vocabulary, and
"org" already fits our domain. Don't rename to "profile"/"context" for conformity's sake; the
switch UX is what users recognize, not the noun.

## Layering view

- **Baseline:** what we have — `orgs` + `current_org` + `config use` + `--org`.
- **Layer (small, high-value UX):** a `config status` / `whoami` command that prints active org,
  api_url, and resolution source. Cheap, and it's the first thing users reach for.

## Related Notes
- [Tool Matrix](./tool-matrix.md)
- [Credential Precedence](./credential-precedence.md) — how flag/env/stored rank
- [engineering-standards: cli/auth-patterns.md](/Users/alex/ec2code/alex/engineering-standards/cli/auth-patterns.md)
