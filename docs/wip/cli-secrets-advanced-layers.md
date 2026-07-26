# CLI Secrets — Advanced Layers & Token Lifecycle (future, opt-in)

## Status: NOT STARTED (deferred — no current pull)

The baseline config/secrets standard for the `fob-<tool>` family shipped and is done (plaintext
`0600` under `~/.fob/<tool>/`, `config profiles <verb>` surface, org-identity caching; see
[Background](#background)). What remains is the **advanced-security roadmap** the baseline was
explicitly designed to layer in *later, opt-in, without touching command handlers* — plus a parked
token-lifecycle track that is gated on the statements API. None of this is being picked up now; this
WIP exists so the deferred work and its one day-one constraint aren't lost.

---

## Background

The baseline decisions (A/B/E/F/G decided, D shipped) were made and implemented on 2026-07-25 and
graduated into `engineering-standards/cli/config-and-secrets.md`. The one architectural constraint
carried forward from that effort, which every item below depends on:

> **Keep secret storage behind a single `src/cli/config-store.js` seam** so encryption/keychain layers swap in
> without touching command handlers.

The layered roadmap the baseline preserves:

- **Layer 1 (baseline, DONE):** plaintext `0600`, single module owns storage.
- **Layer 2 (opt-in, deferred):** encrypt-file + key-in-keychain (`--use-keyring`); plaintext stays
  for headless/CI.
- **Layer 3 (deferred):** keychain-by-default with an explicit insecure escape hatch.
- **Independent track (parked):** scoped/short-lived tokens — gated on statements-API support, not
  the CLI.

## Pending Work

### 1. Token lifecycle (C) — PARKED, API-gated
Whether to push the statements API team for scoped/expiring keys, and/or document a manual rotation
habit now. Not pursuing scoped/expiring keys until the statements API offers them. Manual key
rotation stays available today via `config profiles add` replacing creds. Revisit if/when the API
gains token scopes or expiry.
See [token-types-and-lifecycle.md](./cli-industry-research/token-types-and-lifecycle.md).

### 2. Pre-split secret ↔ metadata in the data model (Layer-2 enabler)
Low-cost prep to consider the next time `src/cli/config-store.js` is touched: internally separate secret fields
(`api_key`/`api_secret`) from non-secret metadata (`api_url`, `org_id`, `org_slug`) in the stored
shape, so a future keychain move relocates only the secret. YAML nests (unlike AWS's INI), so this
stays one file — the AWS-style `credentials.yml` only ever appears as the **no-keychain fallback of
the Layer-2 keychain work** (keychain present → secret to keychain; absent → secret to
`credentials.yml`; metadata always in `config.yml`). This is the same secret-vs-metadata seam that
decisions A and F identified.

### 3. Layer 2 — `--use-keyring` (opt-in)
Encrypt the file with a key held in the OS keychain, exposed as a copyable storage module. Reference
implementation is the
[Claude Code hybrid](./cli-industry-research/secret-storage.md#how-claude-code-does-it-the-hybrid-to-copy):
keychain on the laptop → plaintext `0600` fallback where no keychain exists → env var for automation,
with one storage module choosing per environment. Plaintext stays as the headless/CI path. Never a
forced default.

### 4. Layer 3 — keychain-by-default
Make keychain the default with an explicit insecure escape hatch. Only after Layer 2 is proven as a
copyable module across a few wrappers.

### 5. Docs cleanup — graduate research, archive the survey
Graduate the durable conclusions from
[cli-industry-research/](./cli-industry-research/README.md) into
`engineering-standards/cli/config-and-secrets.md`, then archive the raw 14-CLI survey. Independent of
the security layers; can happen any time.

## Implementation Phases

### Phase 1: Data-model prep (opportunistic) ❌
- [ ] Split secret vs metadata fields in `src/cli/config-store.js`'s stored shape (item 2) — do it the next
      time `config.js` is edited for another reason.

### Phase 2: Layer 2 — opt-in keychain ❌
- [ ] `--use-keyring`: encrypt file, key in OS keychain, as a copyable module (item 3).
- [ ] Plaintext `0600` remains the headless/CI fallback.

### Phase 3: Layer 3 — keychain-by-default ❌
- [ ] Keychain default + explicit insecure escape hatch (item 4).

### Phase 4: Token lifecycle track (API-gated) ❌
- [ ] Scoped/expiring keys once the statements API supports them (item 1).

### Phase 5: Docs cleanup ❌
- [ ] Graduate `cli-industry-research/` conclusions into the standard; archive the raw survey (item 5).

## Related Files

- [cli-industry-research/](./cli-industry-research/README.md) — the six dimension notes + 14-CLI matrix
- [engineering-standards: cli/config-and-secrets.md](/Users/alex/ec2code/alex/engineering-standards/cli/config-and-secrets.md) — the shipped baseline standard; Layer 2/3 graduate here
- [parent WIP: cli-standards-and-wrappers.md](./cli-standards-and-wrappers.md) — parent family effort
- `src/cli/config-store.js` — credential store (plaintext `0600`); the single seam Layer 2/3 swap in behind

## Related Notes
- [WIP Files Pattern](/Users/alex/ec2code/alex/engineering-standards/git-workflow/wip-files.md)
- [Knowledge vs Reports](/Users/alex/ec2code/alex/engineering-standards/principles/documentation/knowledge-vs-reports.md)
