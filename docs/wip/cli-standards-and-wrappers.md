# CLI Standards & the `fob-<tool>` Wrapper Family

## Status: IN PROGRESS (~80%) — Phase 3 closed (fob-stm unification + worker rewrite shipped) and **Phase 4 dispatcher DONE** (via the cli-fob split → `fob-orc` + `fob-worker` + the `fob` launcher). Remaining: Phase 5 (first external wrapper, e.g. `fob-qbo`) + rollout housekeeping (publish, GitHub repo rename, wire the 4 binaries on PATH).

Define a documented CLI standard (not a shared framework) and use it to build a family of
thin, consistent command-line wrappers — `fob-<tool>` — over both FinOpsBricks apps and
external SaaS tools (QuickBooks Online, Zoho Books, …). Each wrapper is a **2-in-1 repo**:
an importable client library *and* a CLI over the same functions, so an FDE can prototype in
the terminal and ship the exact same call into a worker. A git-style subcommand dispatcher
gives a single `fob <tool> …` entry point without coupling the wrappers together.

---

> **Sub-efforts (sibling WIPs):**
> - Config/secrets + profiles/identity model → **baseline DONE** (14-CLI survey; A/B/E/F/G/D all
>   shipped, graduated into the standard). Deferred advanced-security layers tracked in
>   `./cli-secrets-advanced-layers.md` (Layer 2/3 keychain, token
>   lifecycle C parked).
> - fob-email retrofit → `finopsbricks/cli/fob-email/docs/wip/cli-config-and-secrets.md` (all phases done).
> - **Install & distribution** (how the family ships/installs/updates/onboards) → research staged in
>   `./cli-install-and-distribution/` (9-note survey; parallels the config/secrets research). Rollout
>   housekeeping item "wire the 4 binaries on PATH" is the near-term slice of this larger question.

## Problem Statement

**The vision.** As an FDE org we constantly fetch and push data across many finance tools.
Third-party CLIs are inconsistent (a decent unofficial `qbo-cli` exists; no Zoho Books CLI
exists at all) and each has its own grammar, output, and auth quirks. Relying on a grab-bag
of external CLIs is a tax on every engagement. We want to own a **consistent** set of
wrappers so FDEs prototype and get to production fast.

**Current state that blocks this:**

- **No documented CLI standard.** The good conventions live *inside* one CLI
  (`cli-fob/docs/cli-design-style.md`) and in the heads of whoever built `cli-fobs`. Nothing
  repo-neutral exists in engineering-standards, so a new `fob-qbo` has nothing to build against.
- **The API wrapper for statements is maintained twice.** `@fob/lib-worker-statements`
  (workers import it) and `cli-fobs`'s `src/utils/http.js` + `cli/statements/**` (the CLI)
  each re-implement the same endpoints, pagination, and auth. Fixes must be made in two places.
- **`lib-email` proved a good shape but a weak CLI.** It pioneered the dual "library import
  *or* CLI" pattern, but its CLI is a hand-rolled `switch`/`parse()` — none of the yargs
  grammar, per-level `--help`, or output conventions that make `fob`/`fobs` intuitive.
- **No unified entry point.** Even if we build `fob-qbo`, `fob-zb`, `fob-stm` as separate
  binaries, there's no `git`-like `fob <tool> …` front door.

**Desired outcome:** a written standard + a growing set of `fob-<tool>` wrappers that all feel
identical, share proven code by **copy (not a package)**, expose an importable client for
workers, and are reachable through one dispatching entry point.

## Proposed Solution

Decisions locked in during brainstorming (2026-07-25):

1. **Standard as documentation, NOT a `cli-kit`/generator.** Consistency comes from a written
   spec + copying proven files (`format.js`, `safe()`, the yargs skeleton, an auth pattern)
   into each new CLI + review against the spec. This is the same "copy, don't extract" trade
   `sor-cli-convergence.md` already made for `format.js`/`http.js`. Re-evaluate extracting a
   shared lib only if we ever pass ~15 wrappers and are fixing the same bug repeatedly.

2. **Each tool = one standalone 2-in-1 repo.** `@fob/<tool>` exports a client (workers
   `import { getInvoices } from '@fob/qbo'`) *and* ships a `fob-<tool>` binary built on the
   same functions. This is the `lib-email` shape done right — it's what makes prototype→worker
   a copy-paste, not a rewrite.

3. **Grammar + infra lifted from what already works:**
   - Grammar from `cli-fob/docs/cli-design-style.md`: `resource action target options`,
     explicit verbs (no inference), `--json` everywhere, help at every level.
   - Infra conventions from `cli-fobs`: `safe()` error wrapper, `format.js` helpers, column
     selector, YAML creds file, exit codes.
   - Dual lib+CLI project shape from `lib-email` (keep the structure, drop the `parse()`).

4. **Auth is documented as patterns, not a plugin system.** The standard shows an api-key
   example and an OAuth2-refresh example (QBO/Zoho need the latter — refresh tokens, realm IDs,
   token expiry). Each wrapper implements its own; no shared auth package.

5. **Git-style subcommand dispatch.** A `fob` launcher resolves `fob <tool> …` to an installed
   `fob-<tool>` binary on `PATH` and execs it (exactly how `git foo` finds `git-foo`). Bare
   `fob` lists discovered wrappers. This gives one front door while every wrapper stays
   independently installed, versioned, and released — no aggregator that version-couples them.
   ⚠️ Naming collision to resolve: `cli-fob` already owns the `fob` binary (worker-context
   commands). Decide whether the dispatcher *is* an evolution of that `fob`, or the
   worker-context commands move under a dispatched `fob-worker`.

6. **Deprecate `@fob/lib-worker-statements` → `@fob/stm`.** Fold the statements client and the
   `cli-fobs` statements command subtree into one `fob-stm` wrapper. Workers import the client;
   the CLI wraps the same functions (resolving creds from its config and passing them via the
   existing `credentials` override param). Kills the double-maintenance.

7. **FinOpsBricks' own apps join the family (to confirm).** If uniformity across *all* wrappers
   is the goal, `statements`/`billing` become standalone `fob-stm`/`fob-bil` and the `fobs`
   aggregator's reason-to-exist shrinks. This partially reverses `sor-cli-convergence.md` — its
   "unify because creds are shared" argument was scoped to fob's internal apps and does **not**
   extend to external vendors (independent OAuth, no shared org model). **Needs an explicit
   decision — see Open Questions.**

## Open Questions (gate the structural phases)

- [ ] **Realistic wrapper count?** 2–3 → the standard + copying is plenty. 10+ → revisit a
      shared lib. This number sizes how much rigor the standard needs.
- [x] **Does `statements` actually go standalone `fob-stm`, retiring the `fobs` aggregator?**
      **DECIDED 2026-07-25: YES.** statements becomes a standalone `fob-stm` 2-in-1 wrapper;
      the `fobs` aggregator retires (billing/orchestrator follow the same path later). This
      confirms Decision 7 and partially reverses `sor-cli-convergence.md`.
- [ ] **Dispatcher naming:** does the new `fob` launcher absorb today's worker-context `fob`,
      or do those commands move to `fob-worker`? (Decision 5.)
- [ ] **Who maintains a wrapper after an engagement ends** — the org or the authoring FDE? This
      shapes monorepo vs scattered repos.
- [ ] **Vendor-faithful or normalized?** Do wrappers expose each tool's raw API shape, or
      normalize (e.g. QBO + Zoho invoices → one schema)? Normalization is a much bigger scope
      (integration platform, not a CLI family).
- [ ] **Existing external-API code to extract from?** Any worker already talking to QBO/Zoho?
      First wrapper should be *extracted from real usage*, not designed cold.

## Implementation Phases

### Phase 1: Write the CLI standard ✅
Author a repo-neutral `cli/` section in engineering-standards (multi-note, matching the repo's
existing `architecture/`, `testing/` split).
- [x] `cli/command-grammar.md` — `resource action target options`, explicit verbs, help at
      every level, relationships-as-flags-on-edit. Distilled from `cli-design-style.md`.
- [x] `cli/project-structure.md` — the dual lib+CLI 2-in-1 shape; `src/` client vs `bin/` +
      `src/cli/` shell; file-per-action layout; naming conventions.
- [x] `cli/output-formatting.md` — `--json` everywhere, table/field/date helpers, column
      selector, presentation-separated-from-logic (link `principles/scripting/…`).
- [x] `cli/error-handling.md` — `safe()` wrapper, exit codes, stderr vs stdout, debug env var.
- [x] `cli/auth-patterns.md` — api-key example + OAuth2-refresh example; creds file location
      (`~/.fob-<tool>/`), 0600, per-call `credentials` override for multi-tenant workers.
- [x] `cli/subcommand-dispatch.md` — the git-style `fob <tool>` launcher spec.
- [x] `cli/testing.md` — Jest ESM + `captureOutput()`/`safe()` harness, mock the client.
- [x] `cli/README.md` — index + "building a new wrapper" checklist.
- [x] Linked the section into the root `README.md` topic list + structure tree.
- [x] **Added a 9th note, `cli/config-and-secrets.md`** (config dir, secret storage, profiles,
      identity caching) + updated `command-grammar.md` (the `config <entity> <verb>` namespace +
      blanket-`profiles`/domain-alias rule) and `auth-patterns.md` (config path →
      `~/.fob/<tool>/`). [eng-std `5c447d8`] Grounded in a 14-CLI survey; the underlying decisions
      shipped and graduated into the standard (deferred layers → sibling WIP
      `./cli-secrets-advanced-layers.md`).

### Phase 2: Audit existing CLIs against the standard ✅
Audited all three against the 8-note standard (2026-07-25).

- [x] `cli-fob` — **~80% compliant.** Grammar ✓, output ✓ (minor: list filter diagnostics go to
      stdout, should be stderr — `stations/list.js:10`, `work-records/list.js:12`). Gaps:
      no `safe()` wrapper (30+ handlers duplicate try/catch; debug var is `DEBUG` not `FOB_DEBUG`);
      thin handler tests (only `stations/run.test.js`). **Two deliberate exceptions** (not a
      2-in-1; `.env` not config file) are the *worker-context CLI* variant — now documented in
      the standard, not gaps.
- [x] `cli-fobs` — **compliant + more evolved**, EXCEPT the 2-in-1 gap: `src/index.js` exports
      only `run`; client logic lives in `utils/http.js` + handlers; the worker client is the
      *separate* `lib-worker-statements`. 4-level app-first tree collapses to 3-level on
      extraction. Output/error/auth ✓; handler tests + `captureOutput` missing.
- [x] `lib-email` — **the 2-in-1 shape, weakest CLI.** GAPs: `bin/cli.js` hand-rolled
      `switch`/`parse()` (no yargs, no `src/cli/`, no per-level help); output always-JSON (no
      toggle, no `format.js`); no `safe()`; only `filter` tested. Auth ✓ (protocol pattern).
- [x] Per-CLI decision: **retrofit `lib-email`** (Phase 6) and **fold `cli-fobs`/statements into
      `fob-stm`** (Phase 3). `cli-fob` gets low-effort cleanups only (`safe()`, stderr fix),
      grandfathered as the worker-context variant.

**Standard gaps the audit exposed (fixed in this pass):**
- Added **Pattern C — protocol/connection credentials** to `auth-patterns.md` (lib-email is
  IMAP/SMTP: live `Session`, no `http.js`/`page_context`/`ApiError`).
- Added the **worker-context CLI exception** to `project-structure.md` (cli-fob is CLI-only +
  `.env`, by design).
- Marked the **column selector optional** for small domain CLIs in `output-formatting.md`.

**Path mismatch — RESOLVED (not a conflict).** Both hit `/api/v1/accounts`; they just split
`/api/v1` differently. Workers set `FOB_STATEMENTS_API_URL=…/api/v1` (base includes it) and the
client appends bare `/accounts`; `cli-fobs` uses an origin-only `api_url` and appends
`/api/v1/accounts` in code. **Decision for `fob-stm`: origin-only base URL + `/api/v1/...` in
the code** (cli-fobs convention) — explicit in source, no footgun where an env var must remember
`/api/v1` or bare calls 404. Worker `.env`s drop the `/api/v1` suffix at migration.

### Phase 3: Deprecate `lib-worker-statements` → `fob-stm` 🔄
Extract the statements slice into a standalone 2-in-1 `@fob/stm` (client + `fob-stm` CLI) at
`finopsbricks/cli/fob-stm` (own git repo, like the sibling CLIs).

- [x] **GATE resolved**: origin-only base URL + `/api/v1` in code (see above).
- [x] **Client core** (`src/index.js` exports; `src/client.js` + `src/http.js`): full statements
      surface (accounts, statements, transactions, rules, work-records) with per-call
      `credentials` override, `ApiError`, capped `apiGetAll`. Workers can import today.
- [x] **CLI scaffold + vertical slice**: `fob-stm <resource> <action>` on yargs; `safe()`;
      `config` (add/list/use/remove) → `~/.fob-stm/config.yml` (0600); **`accounts` list/show**
      as the resource template (`--json`, `--fields/--format/--output`). `format.js`/`list.js`
      copied. Tests pass; CLI smoke-tested (help tree, config flow, no-creds → exit 1). [`803c757`]
- [x] **Fan out remaining resources** [`f50b7a9`]: transactions, statements (14 actions incl.
      upload/download/submit-*), rules (+_rule-args), reports, categories, entities — plus the
      full accounts CRUD/admin set. Ported from `cli-fobs/src/cli/statements/*`, repointed at the
      credential-pure transport (creds threaded per call), app level dropped. Full `fob-stm`
      help tree walks; 59 files syntax-clean; accounts test passing.
- [x] **Config & secrets on-standard (B/E/F)** — config moved to the family root
      `~/.fob/fob-stm/config.yml` (`0600`); command surface is now `config profiles <verb>`
      (canonical `profiles`, alias `orgs`); global flag `--profile` (alias `--org`); `list` shows
      a table + `config: <path>` footer. **The earlier `~/.fobs` first-run migration (`2539fc5`)
      was removed** — pre-customer hard refactor, no migration path (decision B).
      [`b28c6f3`, `007b2aa`, `3adcfd5`]
- [x] **Org-identity caching (G)** — profiles cache the server-resolved `org_id`/`org_slug` via the
      statements app's new `GET /api/v1/whoami`; resolve-on-`add`, `config profiles refresh
      <name>`/`--all`, enriched `list`. Whoami endpoint + `getIdentity()` shipped in the statements
      app and `@fob/lib-worker-statements`. [`7151257`] Detail: graduated into
      `engineering-standards/cli/config-and-secrets.md`.
- [x] **CHECKPOINT: CLI use case validated.** `fob-stm` was `npm link`ed alongside `fobs` and
      `fob-stm <args>` compared against `fobs stm <args>`. CLI use case confirmed; library/worker
      use case now unpaused.
- [x] **Library/CLI unification (SUPERSEDES the superset plan) → sibling WIP
      `cli-lib-unification.md` (Phases 1–6 done).** The per-object superset reshape of `client.js` was
      tried, then dropped: it left the CLI and the library as two independent implementations of the
      same endpoints (drift-prone by design). Instead, a shared `src/resources/` layer became the
      single source of endpoint truth, consumed by both the CLI (presentation only) and the library —
      now a `fobStm(creds)` bound client factory with per-resource namespaces (`stm.accounts.list()`).
      Backward-compat (legacy `FOB_STATEMENTS_*` env, `/api/v1` tolerance, drop-in signatures) dropped;
      Phase 6 went further to explicit-injection creds (`fobStm({api_key,api_secret})`, no ambient env).
- [x] **Migrate worker consumers** — done as a **clean rewrite** onto `fobStm` (no compat shim),
      tracked in `cli-lib-unification.md` Phase 5. All 16 worker files (worker-alex ×13,
      worker-sarveda ×3) rewritten; `@fob/stm` published (v0.1.0 → v0.2.0), both worker repos pushed
      and `npm install` chain validated against `github:finopsbricks/fob-stm`. Ground-truth check:
      no worker src imports `lib-worker-statements` and no `FOB_STATEMENTS_*` refs remain.
      Live smoke-run **validated** 2026-07-26 (`resolveAccounts` step; `stm.accounts.get()` returned
      the unwrapped record against real creds) — `cli-lib-unification.md` now COMPLETE.
- [x] **Deprecated `@fob/lib-worker-statements`** (clean cut — no shim was ever built; the lib was
      fully orphaned). **Tombstoned** 2026-07-26: implementation removed, `src/index.js` throws on
      import with a redirect to `@fob/stm`, README/package.json rewritten as a deprecation notice
      (check-pattern docs retained). Committed `75bef56`, pushed, and the GitHub repo
      **archived** (`gh repo archive finopsbricks/lib-worker-statements`, `isArchived: true`).
- [ ] Remove the statements subtree from `cli-fobs` — **reserved for the very end**: keep
      `cli-fobs` intact so `fob-stm` can be tested side-by-side; it's abandoned (not modified),
      not refactored. **Decision 2026-07-26: leave it in place** — `cli-fobs` still hosts active
      `billing`/`orchestrator`/`orgs`/`apps` subtrees, so retire the whole aggregator in one move
      when those migrate (do **not** archive `cli-fobs` yet — archiving would block that work).

### Phase 4: Git-style dispatcher ✅
Mirror exactly how `git foo` dispatches: git resolves built-in subcommands first, then falls
back to an executable named `git-foo` on `$PATH` and execs it with the remaining argv. Any
`git-*` on `$PATH` becomes a subcommand with no registry or manifest (this is how `git-lfs`,
`git-flow`, and `gh` extensions ship). The `fob` launcher copies this wholesale.

> **DONE via the cli-fob split** (sibling WIP **`./split-into-fob-orc-and-fob-worker.md`**,
> 2026-07-26). `cli-fob` was split into `fob-orc` (orchestrator 2-in-1 client + CLI) and `fob-worker`
> (local plane; `workers`→`procs`), freeing the `fob` name. The dispatcher is a new repo `cli/fob`
> (commit `0a38d3c`).

- [x] **Resolve the `fob` naming collision** — `fob` keeps **no** built-ins; the old commands moved to
      `fob-orc`/`fob-worker`. `fob` is pure dispatch.
- [x] **Resolution order:** no built-ins — `fob <tool>` resolves straight to `fob-<tool>` on `$PATH`;
      on miss → `fob: '<tool>' is not a fob command` (exit 1).
- [x] **Discovery:** bare `fob` / `fob help` scan `$PATH` for the `fob-*` prefix and list discovered
      wrappers (`discoverTools`).
- [x] **Transparent proxy:** exec `fob-<tool>` with `stdio: 'inherit'`, argv forwarded untouched, child
      exit code propagated (verified 7→7, miss→1). `--help` passes straight through.
- [x] Each `fob-<tool>` stays independently installed/versioned/runnable; the dispatcher is pure sugar
      (no version coupling). Tests 7/7.

### Phase 5: First external wrapper (proof) ❌
- [ ] Pick `fob-qbo` or `fob-zb` (prefer the one with existing worker usage to extract from).
- [ ] Build to the standard, including the OAuth2-refresh auth pattern.
- [ ] Validate the prototype→worker story end-to-end with a real step.

### Phase 6: Retrofit `lib-email` CLI ✅ (done as `fob-email`)
Renamed `@fob/lib-email` → `@fob/email`, moved to `finopsbricks/cli/fob-email`, retrofitted onto
the fob-stm yargs skeleton. [`d867a87`] Own sibling WIP (all phases done).
- [x] Replaced `bin/cli.js` `parse()`/`switch` with the yargs skeleton + grammar; per-level help.
- [x] Config on-standard: `~/.fob/fob-email/config.yml` (0600); `config accounts`/`profiles`
      surface; cache the authenticated mailbox address (identity G, protocol/Pattern-C variant).
- [x] Library exports preserved. Tracked in `cli/fob-email/docs/wip/cli-config-and-secrets.md`.

## Related Files

**The standard (engineering-standards repo):**
- `engineering-standards/cli/` — the 9-note CLI standard (Phase 1 done), incl. `config-and-secrets.md`
- `engineering-standards/principles/scripting/separate-presentation-from-logic.md` — linked principle

**Sibling WIPs:**
- `./cli-secrets-advanced-layers.md` (co-located in this repo) — deferred advanced-security
  layers (Layer 2/3 keychain, token lifecycle). Baseline config/secrets standard + 14-CLI survey is
  DONE (A/B/E/F/G/D shipped, graduated into `engineering-standards/cli/config-and-secrets.md`)
- `./split-into-fob-orc-and-fob-worker.md` (co-located) — the cli-fob split → `fob-orc` + `fob-worker`
  + this `fob` dispatcher (all done)
- `./cli-install-and-distribution/` (co-located) — **install & distribution research** (9-note survey:
  runtime/packaging, channels, code-signing, open-vs-closed, family install model, updates, onboarding
  + a 15-CLI tool matrix). Draft knowledge; decisions still open (compiler, batteries-included vs
  siblings, OSS, which channels). Sibling to `../cli-industry-research/`.
- `../../../fob-stm/docs/wip/cli-lib-unification.md` — fob-stm's own CLI+library unification (done)
- `../../../fob-email/docs/wip/cli-config-and-secrets.md` — applying config/secrets to fob-email (done)
- `finopsbricks/apps/statements.finopsbricks.com/docs/wip/whoami-endpoint.md` — the
  `GET /api/v1/whoami` dependency (shipped)

**Reference CLIs (finopsbricks):**
- `cli/fob-worker/docs/cli-design-style.md` (was `cli/cli-fob/`) — grammar source of truth
- `cli/fob-worker/docs/architecture/sor-cli-convergence.md` — prior decision being partly revisited
- `cli/cli-fobs/docs/architecture/command-signature.md` — app-first tree, short codes
- `cli/cli-fobs/src/utils/` — `safe()`, `format.js`, `http.js`, `config.js`, column selector
- `cli/fob-email/` — dual lib+CLI shape, retrofitted onto the yargs skeleton (was `lib/lib-email`)

**To deprecate / migrate:**
- `lib/lib-worker-statements/src/statements.js` — client to fold into `fob-stm`
- `cli/cli-fobs/src/cli/statements/**` — kept intact for side-by-side (abandoned, not modified)

## Related Notes

- [WIP Files Pattern](/Users/alex/ec2code/alex/engineering-standards/git-workflow/wip-files.md)
- [Separate Presentation from Logic](/Users/alex/ec2code/alex/engineering-standards/principles/scripting/separate-presentation-from-logic.md)
