# Split `cli-fob` into `fob-orc` (orchestrator client) + `fob-worker` (local tool)

## Status: COMPLETE (2026-07-26) — all 3 phases done. `fob-orc` built (client + CLI), `cli-fob` converted to `fob-worker` (dir renamed, `workers`→`procs`, orchestrator commands stripped), and the git-style `fob` dispatcher shipped. Remaining housekeeping: publish `@fob/orc`/`@fob/worker`/`fob`; rename the GitHub `cli-fob` repo → `fob-worker`; migrate worker repos' tooling to the dispatcher (see below).

`cli-fob` is two tools wearing one binary. Every command sits cleanly on one of two **data
planes**: a remote **orchestrator control plane** (canonical station/process definitions,
work-records, tags — all HTTP) and a machine-**local execution plane** (worker step code, the
local station-file cache, live run-state, pm2 processes). This WIP splits them into two standalone
`fob-<tool>` wrappers, which also turns today's `fob` binary into the pure git-style dispatcher —
unblocking Phase 4 of the parent family WIP.

---

> **Parent WIP:** `./cli-standards-and-wrappers.md` (Phase 4, the `fob`
> dispatcher). This split is the **precondition** for that phase and **resolves its open
> "`fob` naming collision" question**: orchestrator commands move to `fob-orc`, worker-context
> commands to `fob-worker`, and `fob` becomes a dispatcher owning no built-ins.

## Problem Statement

`cli-fob` (`@fob/cli-fob`, binary `fob`) mixes two unrelated concerns behind one command tree:

- **Orchestrator control plane (remote API).** `src/utils/orchestrator.js` is a self-contained HTTP
  client (reads `ORCHESTRATOR_URL/API_KEY/SECRET`) exposing `listStations`, `getStation`,
  `createStation`, `updateStation`, `deleteStation`, `cancel/listWorkRecords`, `listTags`, `getItem`,
  `runStation`, `getSupportingDoc`, `setEntityTags`, … — **already the exact shape of a publishable
  `@fob/stm`-style client.**
- **Local execution plane (this machine).** `worker-processes.js` (pm2/`ps`/`lsof`),
  `station-files.js` (the `.orchestrator/stations/` cache), `line-state.js` (`temp/stations/` live
  run-state → lines/workpieces/bins), `steps-loader.js`/`lib-worker-loader.js` (run a step in-process).
  Zero network; pure filesystem + local processes.

**Why it matters.** The same resource word means different things on each plane — `stations list`
reads canonical defs *from the orchestrator*, while `stations status` reads live run-state *on this
box*. One binary can't cleanly own both meanings, and it blocks the dispatcher (the `fob` name is
taken by this hybrid).

## Proposed Solution

Decisions locked in 2026-07-26 (grounded in a per-handler backend audit of all 39 commands):

1. **Two standalone `fob-<tool>` wrappers, one per plane.** The tool name becomes the namespace that
   disambiguates shared resource words (`fob orc stations …` vs `fob worker stations …`).

2. **`fob-orc` / `@fob/orc` — the orchestrator client, a 2-in-1 published like `@fob/stm`.**
   Lift `orchestrator.js` into a `fobOrc(credentials)` bound client factory with per-resource
   namespaces (`orc.stations.list()`, `orc.workRecords.cancel(id)`, `orc.tags.*`, `orc.items.get()`).
   **Explicit credentials, no ambient env** (per the [No Ambient Configuration] standard, same as
   fob-stm v0.2.0). CLI handlers presentation-only. Workers and `fob-worker` import the client.
   ```js
   import { fobOrc } from '@fob/orc';
   const orc = fobOrc({ api_key, api_secret });   // api_url optional
   await orc.stations.list();
   ```

3. **`fob-worker` — the local plane, CLI-only worker-context variant.** Keeps `.env` (not a config
   file) — the grandfathered worker-context exception already documented in the standard. Renames the
   pm2 resource **`workers` → `procs`** (avoids the `fob worker workers …` double-word).

4. **The bridges (`stations pull`/`push`/`run`) live in `fob-orc`.** `pull` (remote → local files),
   `push` (local files → remote), and `run` (triggers a remote orchestrator run, returns a
   `work_record_id`) all center on the canonical station definitions; `fob-orc` owns both the remote
   API *and* its local station-file cache I/O. `stations run` reads the local station file only for
   scenario/override convenience — it is a remote action, not local execution.

5. **`fob` becomes the pure dispatcher** (parent-WIP Phase 4): no built-ins; resolves `fob orc …` →
   `fob-orc`, `fob worker …` → `fob-worker`, and the rest of the family (`fob stm …`, `fob email …`).

### Command classification (all 39 handlers)

**→ `fob-orc` (remote CRUD + bridges):**
`stations list · show · create · edit · delete · archive · unarchive · pull · push · run` ·
`work-records list · show · edit · cancel` · `tags list · create · edit · delete` ·
`supporting-docs show` · `orchestrator status` (→ becomes `fob-orc status`/health)
_(no `items` namespace — the item object is deprecated on the orchestrator; dropped.)_

**→ `fob-worker` (filesystem + pm2, zero network):**
`steps list · run` · `lines list · show · status · empty-bins` · `workpieces list · show · watch` ·
`procs list · start · stop · restart · logs · monit` (was `workers`) ·
`stations status · empty-bins · update-step-metadata` (local run-state / local-file ops) · `config show`

## Open Questions

- [x] **`fob-worker` → `@fob/orc` cross-dependency — RESOLVED 2026-07-26: eliminated.** The `item`
      object is being **deprecated on the orchestrator**, so `steps run --item` and the whole `items`
      namespace/`getItem` are **dropped** entirely (not just locally). `fob-worker` therefore has **no**
      orchestrator touchpoint and needs no `@fob/orc` dependency. Follow-up: `stations run` also passed
      an `itemId` to `runStation` + called `getItem` for display — revisit whether `runStation` still
      takes an item once the orchestrator-side deprecation lands (flag during Phase 1 port).
- [ ] **`fob-worker` package identity.** Published `@fob/worker`, or CLI-only/unpublished (no library
      consumers — it's the worker-context variant)? Note potential confusion with existing
      `@fob/lib-worker`. Leaning CLI-only, binary `fob-worker`, package name TBD.
- [ ] **`stations update-step-metadata`** writes *local* station files (no orchestrator import today)
      but station metadata is conceptually orchestrator-owned. Confirm it stays local (edit-then-push)
      vs. becoming an `fob-orc` mutation.
- [ ] **Migration/sequencing.** `cli-fob` is installed as `fob` inside worker repos. Renaming to
      `fob-worker` + introducing `fob-orc` + the dispatcher touches every worker repo's tooling.
      Sequence so nothing breaks mid-flight (dispatcher last).

## Implementation Phases

### Phase 1: Extract `@fob/orc` (orchestrator 2-in-1) ✅
New repo `finopsbricks/cli/fob-orc`, built to the CLI standard (copy the fob-stm skeleton).
- [x] **Client library DONE** (2026-07-26). `fobOrc(credentials)` factory + `src/resources/*`
      (`stations`, `work-records`, `tags`, `supporting-docs`) lifted from `orchestrator.js`.
      Category-based return shapes (unwrapped record / `{data, page_context}` / flat array), mirroring
      fob-stm. **Explicit creds, no ambient env** (`http.js` never reads `process.env`; optional
      `X-Location` via a `location` cred for the `checkConnection` worker-poll). `@ts-check` + written
      types (`src/types/api/*`, `src/types/general/*`); co-located `*Api` typedefs with `@returns` so
      `tsc` verifies each impl. **Path contract preserved**: CRUD → `/api/v1/processes/*`,
      archive/unarchive → canonical `/api/v1/stations/*`, work-records `station`→`?process=`. `items`
      dropped (deprecated). `npm run typecheck` → 0 errors.
- [x] **Client tests DONE** — `tests/resources/stations.test.js` (mock `fetch`, 9 cases): unwrap,
      envelope, pagination, POST bodies, `/stations/*` vs `/processes/*`, per-client cred binding,
      `station`→`process` mapping. Suite 9/9 green.
- [x] **CLI skeleton + config + stations vertical slice DONE** (2026-07-26, commit `2b676f3`).
      yargs 3-level tree, `safe()`, `clientFor()`, `format.js`; `config profiles`
      (add/list/use/remove/current) → `~/.fob/fob-orc/config.yml` (0600), no whoami-refresh
      (orchestrator has no identity endpoint). Stations commands (presentation-only): `list`, `show`,
      `run`, `archive`, `unarchive`, `delete`. Verified: help tree walks; config flow; no-creds → exit
      1; unknown resource → exit 1; typecheck 0 errors; tests 9/9.
- [x] **Remaining resources DONE** (2026-07-26, commit `aeca9af`). Presentation-only handlers over
      the client: `work-records` (list/show with --report/--steps/--supporting-docs/--activity/--all,
      cancel, edit-tags via a shared `editEntityTags` helper), `tags` (list/create/edit/delete),
      `supporting-docs` (show + `--save` download via the client's `downloadStream`), and a top-level
      **`fob-orc status`** → `checkConnection` (an `orchestrator` resource would be redundant — the tool
      IS the orchestrator). Verified: full help tree walks; all no-creds paths → exit 1; typecheck 0
      errors; tests 13/13 (added tags `resolveNames`/`ensure` coverage).
- [x] **Bridges DONE** (2026-07-26, commit `c1108d0`). Ported a trimmed `station-files.js` cache util;
      `stations pull` (client → `.orchestrator/stations/`, deps id→short_code + tags→names), `push`
      (local files → client create/update, deps short_code→id, id/created_at/org/tags stripped, tags
      synced separately auto-creating missing; 404-on-update → `--force` create-with-same-id, using
      `err.status` not message-parsing), `edit` (short_code + tags), and `run --scenario` (local
      scenario merged with direct `--k=v` flags). Verified end-to-end: pull→push round-trip lossless
      (both dep + tag conversions). Full 9-action help tree walks; typecheck 0 errors; tests 15/15
      (added a mocked-orchestrator + temp-cwd bridge test).

### Phase 2: Convert `cli-fob` → `fob-worker` (local plane) ✅
Done 2026-07-26 (commit `bdd346b`); local dir renamed `cli/cli-fob` → `cli/fob-worker`.
- [x] Renamed package `@fob/cli-fob` → `@fob/worker`; binary `fob` → `fob-worker` (v2.0.0).
- [x] Stripped the orchestrator-plane commands (now in `fob-orc`): stations
      list/show/edit/pull/push/run/delete/unarchive, work-records, tags, supporting-docs,
      orchestrator status; deleted `utils/orchestrator.js` + `utils/tags.js`.
- [x] Renamed the pm2 resource `workers` → `procs` (source + tests + completion).
- [x] `steps run` dropped `--item`/`getItem` (item deprecated) — **zero orchestrator API code left**
      in fob-worker (open-question resolution: no `@fob/orc` dependency after all).
- [x] Kept steps / lines / workpieces / procs / local-`stations` (status/empty-bins/update-step-metadata)
      / `config show`. Rewrote the yargs tree + completion + `scriptName`; `.env` worker-context retained.
- [x] Pruned removed-handler tests; moved `workers`→`procs` tests. Verified: help tree walks; `procs
      list` works; `steps run` 8/8; **the split added zero new test failures** (baseline already had 38
      failing tests in pre-existing/thin handler suites; unchanged).

### Phase 3: `fob` dispatcher (= parent WIP Phase 4) ✅
Done 2026-07-26 (new repo `cli/fob`, commit `0a38d3c`).
- [x] Git-style launcher, **no built-ins**: `fob <tool> …` resolves `fob-<tool>` on `$PATH` and execs it
      transparently (inherited stdio, argv forwarded untouched, exit code propagated). Bare `fob` / `fob
      help` list discovered tools; unknown tool → `fob: '<tool>' is not a fob command` (exit 1).
- [x] Pure dispatch logic in `src/dispatch.js` (discoverTools/resolveTool/plan); bin does the spawn.
      Verified: exit-code propagation (child 7→7), miss→1, list→0; tests 7/7. `fob orc/worker/stm/email`
      all dispatch to their standalone binaries with no version coupling.

### Rollout / housekeeping ✅ (done 2026-07-26)
- [x] **Published** all four as private `finopsbricks` GitHub repos: `fob-orc` (release `v0.1.0`),
      `fob` (release `v1.0.0`), plus `fob-worker` and `fob-stm` pushed. Mirrors the `@fob/stm` precedent.
- [x] **Renamed** the GitHub repo `finopsbricks/cli-fob` → `fob-worker` (`gh repo rename`); local remote
      updated; 6 commits pushed.
- [x] **Linked** the family: `npm link` for `fob`/`fob-orc`/`fob-worker` (+ existing `fob-stm`/`fob-email`).
      Cleaned up the stale `@fob/cli-fob` global link + its dangling `fob` bin so `fob` now resolves to
      the dispatcher. Verified the real shell `fob` dispatches to `orc`/`worker`/`stm` end-to-end
      (nested subcommands + `fob bogus`→exit 1).
- [x] **Worker migration** — *no tooling migration needed*: no worker declares `@fob/cli-fob` as a
      dependency and none call it in npm scripts (the CLI was used globally via `npm link`, so re-linking
      completed it). Updated the two active guidance docs that named wrong commands: worker-agilitas
      runbook (`fob worker steps` / `fob orc stations`, committed+pushed `9d2e830`) and worker-newnowapps
      `CLAUDE.md` (`d5bb387`).
- [ ] *Left as historical (low value):* `worker-alex/docs/wip/fob-stations-delete.md` (a completed WIP —
      the `stations delete` feature it describes now lives in `fob-orc`) and handbook/ops references to the
      old `fob stations|work-records` commands. Not worth churning; they're records of past state.

## Related Files

**Created:**
- `cli/fob-orc/**` — new orchestrator 2-in-1 (client `@fob/orc` + `fob-orc` CLI)
- `cli/fob/**` — the git-style `fob` dispatcher

**Transformed:**
- `cli/fob-worker/**` (was `cli/cli-fob/`) — local plane; `workers`→`procs`; orchestrator commands removed
- the old `cli/cli-fob/src/utils/orchestrator.js` — client surface lifted into `@fob/orc`

## Related Notes

- [Parent WIP: CLI Standards & the fob-<tool> Wrapper Family](./cli-standards-and-wrappers.md)
- [Sibling: fob-stm library/CLI unification](../../../fob-stm/docs/wip/cli-lib-unification.md) — the `fobStm` factory pattern `fobOrc` copies
- [No Ambient Configuration](/Users/alex/ec2code/alex/engineering-standards/principles/no-ambient-configuration.md)
- [WIP Files Pattern](/Users/alex/ec2code/alex/engineering-standards/git-workflow/wip-files.md)
