# Global Auth vs Per-Project Config (Two Files)

Mature CLIs split config into two files with different homes and different jobs. Understanding the
split clarifies what belongs where — and it's the structural move that makes a later keychain
migration clean.

## The two files

| File | Lives in | Holds | Committed to git? |
|---|---|---|---|
| **Global auth/config** | home dir (`~/.config/<tool>/`) | credentials + the active-account pointer | never |
| **Per-project config** | the repo (`./<tool>.toml`) | *selectors* — which account/project/env to use | yes |

Examples of the per-project file: `wrangler.toml`, `.vercel/project.json`, `fly.toml`,
Terraform backend blocks, `.git/config`. **Key rule the whole industry follows: the project file
holds IDs and selectors, never the secret.** The secret always stays in the home-dir file (or
keychain). This is what lets you commit the project file safely.

## gh's finer split (the useful idea)

gh goes further and splits the *home-dir* side into two:
- `config.yml` — non-secret settings (editor, aliases, default host)
- `hosts.yml` — per-account state (which user, and the token *or a keychain reference*)

Why it matters for us: **separating non-secret metadata from the secret is the enabler for
keychain.** If `api_url` + `current_org` + the org list live in a plain file and only `api_key` /
`api_secret` are the "secret", you can later move just the secret into a keychain without disturbing
the rest. Today we store both together in one `config.yml`.

## Where we are

fob-stm has only the global file (`~/.fob-stm/config.yml`) with secret + metadata mixed. We have no
per-project file — and for a data-fetch CLI we may not need one. The worker-context variant
(`cli-fob`) instead reads a repo-local `./.env`, which is the "project file" idea in a different
form (see [engineering-standards: cli/project-structure.md](/Users/alex/ec2code/alex/engineering-standards/cli/project-structure.md)).

## The tradeoff

- **One mixed file** (today): simplest; every value in one place.
- **Split secret vs metadata**: a little more plumbing, but it's the precondition for encryption/
  keychain and for printing/diffing config without exposing secrets.
- **Add a per-project file**: only worth it if a user runs fob-stm from inside per-org repos and
  wants the org auto-selected by directory. Not obviously needed for a fetch/push CLI.

## Layering view

- **Baseline:** keep the single global file. Don't add a project file speculatively.
- **Layer (precondition for keychain):** internally separate "secret fields" from "metadata fields"
  in `config.js` even while they share one file — so [secret storage](./secret-storage.md) can later
  relocate just the secret half.

## Related Notes
- [Tool Matrix](./tool-matrix.md)
- [Secret Storage](./secret-storage.md) — why the split enables keychain
- [Config File Location](./config-location.md)
- [engineering-standards: cli/project-structure.md](/Users/alex/ec2code/alex/engineering-standards/cli/project-structure.md) — the worker-context `.env` variant
