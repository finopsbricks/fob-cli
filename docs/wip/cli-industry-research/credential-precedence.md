# Credential Precedence and the CI Env Var

When a secret could come from several places at once, which wins? Every tool answers the same way.

## The universal order

```
command-line flag  >  environment variable  >  stored config
```

All 14 tools surveyed follow this, with no exceptions. It is the closest thing to a law in CLI
design. Reasons it works: the flag is the most explicit (you typed it now), env is the ambient
override (set for this shell/CI job), and the stored config is the fallback default.

Our resolver already implements it: `--org` flag → `FOB_STM_API_*` env → `current_org` in the
config file.

## The one env var that bypasses everything (the CI story)

Every tool exposes a **top-priority credential env var** that skips the whole interactive/profile
flow, so automation never touches a config file or keychain:

| Tool | CI env var |
|---|---|
| gh | `GH_TOKEN` |
| AWS | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
| Cloudflare | `CLOUDFLARE_API_TOKEN` |
| Stripe | `STRIPE_API_KEY` |
| Vercel | `VERCEL_TOKEN` |
| Heroku | `HEROKU_API_KEY` |
| **fob-stm (ours)** | `FOB_STM_API_URL` / `FOB_STM_API_KEY` / `FOB_STM_API_SECRET` |

Ours is three vars instead of one because our auth is url + key + secret, not a single opaque token.
That's fine and unavoidable for Pattern A — but note the ergonomic cost: a user must set all three,
and our resolver correctly requires all three present before the env path activates.

**A subtle footgun to avoid:** flyctl *persists* a token passed via env back into its config file on
the next command. Don't do that — env-supplied creds should stay ephemeral and never be written to
disk.

## The tradeoff

None on the ordering — it's settled. The only open question is cosmetic: whether to also accept a
single combined env var (some tools take a `TOOL_TOKEN`) alongside the three. Low value for us since
url+key+secret don't pack cleanly into one string.

## Layering view

- **Baseline:** already correct — flag > 3-var env > stored, all-or-nothing on the env triple.
- **Keep:** the one-time stderr hint naming the source (env vs config) so users know which identity
  is live.

## Related Notes
- [Tool Matrix](./tool-matrix.md)
- [Secret Storage](./secret-storage.md) — the env path never touches disk storage
- [Profiles & Switching](./profiles-and-switching.md)
- [engineering-standards: cli/auth-patterns.md](/Users/alex/ec2code/alex/engineering-standards/cli/auth-patterns.md)
