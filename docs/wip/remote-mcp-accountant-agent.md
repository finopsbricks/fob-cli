# Remote MCP: exposing the `fob-*` family to web-chat accountants

## Status: NOT STARTED

Design capture for turning the `fob-*` CLI family into a hosted product: customers
use Claude.ai / ChatGPT (web, not terminal), ask an agent to do bookkeeping work, and
the agent drives the `fob-*` tools against *that customer's* credentials — email, Zoho
Books, statements, etc. This document records the architecture reasoning and the
concrete build path so it can be picked up later. No implementation yet.

---

## Problem Statement

The vision: sell "an agent that does the bookkeeping for individuals/SMBs." The customer
lives in a chat interface (Claude or ChatGPT web), asks their "accountant" to do work,
and the accountant uses our CLIs — with credentials the customer has shared — to do it
and report back.

In a **terminal**, this is trivial: the CLIs are installed, creds sit in local env/config,
`fob zb ...` / `fob email ...` just work. But **most customers (and most accountants) are
not in a terminal** — they're in a web chat. A web chat client cannot:

- run code on the customer's machine, or
- run code on our laptops, or
- see any local `fob-*` install or local credentials.

The only thing a web chat client can do is **call tools exposed over HTTPS**. So the whole
problem reduces to: *how do we expose the `fob-*` capabilities as remote, per-customer,
credentialed tools that Claude.ai and ChatGPT can call?*

## Key reframe (answers to the original questions)

| Question | Answer |
|---|---|
| Plugins? | No. ChatGPT "plugins" are deprecated; Claude Code "plugins" are a local dev construct. Not the path. |
| MCP? | Yes — a **remote** MCP server (HTTP transport), not the local stdio kind used in a terminal. |
| Remote server to execute code? | Yes. The remote MCP server *is* that surface. It runs our `fob-*` logic server-side. |
| Inject secrets how? | Per-tenant encrypted vault, resolved at call-time from the OAuth-identified session, injected through the credentials seam the CLIs already expose (`flag > env > config`). |
| Ephemeral server? | The service is long-lived + multi-tenant. Credential *materialization* is ephemeral (decrypt-use-discard per call). Per-call sandboxed compute is optional (we own the code, so it's for tenant isolation, not code safety). |
| How do others do it? | Remote MCP + an OAuth broker + a token vault. See "Buy vs build". |

Both platforms now speak MCP, so **one remote MCP server serves customers on both**:
- **Claude.ai** → "Custom Connectors" (remote MCP over HTTP); also the Claude API `mcp_servers` param.
- **ChatGPT** → connectors / Apps SDK / Responses API `mcp` tool type — all MCP underneath.

## Architecture

### The two-layer auth model (the crux)

There are two independent auth layers; conflating them is the classic mistake.

1. **Customer ↔ our MCP server.** Adding our connector in Claude/ChatGPT triggers an
   **OAuth login to our product** (MCP defines an OAuth 2.1 flow for exactly this). This
   binds a chat session to a tenant ("this session is customer #4172").
2. **Our server ↔ Gmail / Zoho, on behalf of the customer.** Customers do **not** paste
   IMAP passwords into chat. Instead, in our own product dashboard they OAuth-connect
   their Gmail and Zoho Books once; we store the **refresh tokens** per tenant. `fob-zb`
   already models this precisely (`client_id/client_secret/refresh_token/organization_id/region`
   with token refresh behind the credentials seam).

Runtime flow of a single tool call:
```
chat → tool call → MCP server reads OAuth token → map to tenant
  → decrypt tenant's Gmail/Zoho creds from vault
  → call fobZb({ ...creds }) / fobEmail({ ...creds })  (library, not shelling out)
  → return result to chat
```
The customer never sees a credential and never touches a terminal.

### Why our CLI design makes this cheap

Every `fob-*` tool is a **2-in-1**: CLI *and* importable library over the same
`src/resources/` layer, with config resolved **flag > env > config file**. That means
**MCP is just a third transport over the same resource layer**, with near-zero drift:

- `import { fobZb } from '@fob/zb'` — call the library directly (don't exec the binary in prod).
- Register each resource/action as an MCP tool (`zoho_invoices_list`, `email_emails_list`, …).
- Inject the tenant's creds as **explicit per-call overrides** (`fobZb({ client_id, ... })`) —
  the seam already exists. No env juggling, no config files on disk.

The MCP server becomes a thin adapter that loops over resource definitions — mostly generated,
not a rewrite. A generic wrapper can front the *entire* family (one adapter, N tools),
conceptually a sibling of the `fob` dispatcher.

### Secret storage

Real secrets manager (AWS KMS-backed / GCP Secret Manager / Vault), envelope-encrypted,
keyed by tenant. Decrypt into memory at call time; never log, never persist plaintext.

### Isolation / ephemerality — two separate questions

- **Sandboxing untrusted code** — *not* our problem. We wrote the fob libraries; the LLM only
  chooses which tool + args to call. No per-call container needed for code safety.
- **Isolating tenant data + creds** — the real requirement. Request/process-level tenant scoping
  + per-tenant vault keys. Start shared-multi-tenant with strict scoping; graduate to isolated
  compute per tenant only if compliance demands it.

## Buy vs build

The "per-user OAuth + token vault + tool gateway" is a product category. Buy the
undifferentiated middle; keep the fob-* domain logic as the moat.

- **Auth brokers / tool-calling infra for agents:** Arcade.dev, Composio, Pipedream Connect —
  broker downstream OAuth (Gmail/Zoho/etc.), hold per-user tokens, expose tools as MCP.
- **Layer-1 (customer↔us OAuth):** Auth0 / WorkOS / Stytch.
- **Reference remote MCP servers:** Stripe, GitHub, Linear, Notion.

Likely split: buy layer-1 auth (and possibly a broker for connectors we lack CLIs for),
keep the `fob-*` tools as ours.

## Risks & compliance (before selling)

- **Custodian of bank-email access + accounting tokens** → high-trust posture: encryption at
  rest, audit logs, least-privilege scopes, eventually SOC 2.
- **Prefer Gmail API + OAuth over IMAP-with-stored-password** (himalaya's model). Google's
  policies are hostile to stored-password IMAP automation; OAuth restricted-scope review is
  needed anyway. (Current `recent-spends.js` uses himalaya/IMAP — fine as a local toy, not the
  product path.)
- **Human-in-the-loop for writes.** Reads (email/statements) are low-risk; posting to Zoho Books
  or anything that moves money needs a confirmation gate. MCP can return structured "confirm?" responses.
- **Plan-tier gotchas.** Custom connectors on Claude.ai are gated by plan; ChatGPT connector
  availability varies. Alternative: drive MCP via the **API** inside our own thin web app, so we
  don't depend on the customer's Claude/ChatGPT subscription tier.

## Proposed Solution (build path)

## Implementation Phases

### Phase 1: Prove the transport — wrap one tool ❌
- [ ] Stand up a minimal remote MCP server (`@modelcontextprotocol/sdk`, streamable-HTTP transport)
- [ ] Wrap `fob-zb`'s `src/resources/` layer (cleanest OAuth/credentials seam) as MCP tools
- [ ] Inject creds via the existing `fobZb({ ...creds })` per-call override seam (hardcode one tenant's creds for now)
- [ ] Add as a Custom Connector in Claude.ai; call it end-to-end from a chat
- [ ] Repeat the same server in ChatGPT to confirm cross-platform parity

### Phase 2: Auth layer-1 (customer ↔ our server) ❌
- [ ] Put OAuth 2.1 in front of the MCP server (start with an off-the-shelf provider: Auth0/WorkOS/Stytch)
- [ ] Map an authenticated session → tenant id
- [ ] Gate every tool call on a valid token

### Phase 3: Per-tenant secret vault + downstream OAuth (layer-2) ❌
- [ ] Product dashboard flow: customer OAuth-connects Gmail + Zoho Books once
- [ ] Store refresh tokens per tenant in a KMS-backed vault (envelope encryption)
- [ ] Resolve creds at call time from the OAuth-identified session; decrypt-use-discard
- [ ] Swap the himalaya/IMAP email path for Gmail API + OAuth

### Phase 4: Generalize across the family ❌
- [ ] One generic resource→MCP-tool adapter fronting all `fob-*` tools (sibling of the `fob` dispatcher)
- [ ] Consistent tool naming / descriptions / arg schemas across tools
- [ ] Human-in-the-loop confirmation gate for write/mutating tools

### Phase 5: Productionize ❌
- [ ] Tenant isolation review; audit logging; per-tenant rate limits
- [ ] Least-privilege scopes; secret rotation
- [ ] Compliance path (SOC 2), ToS/consent screens for Google/Zoho
- [ ] Decide API-driven web app vs. relying on customers' own Claude/ChatGPT connectors

## Open Questions

- Is the "accountant" a human using assisted tooling, or is the **LLM agent itself** the
  accountant? (This doc assumes the latter — agent drives the CLIs.) If humans stay in the loop,
  the same MCP surface still serves them via an internal console.
- Buy vs build the auth/vault middle — how much of Arcade/Composio/Pipedream to adopt vs. own.
- Multi-tenant shared service first, or isolated compute per tenant from day one (compliance-driven).
- Where does the *product* repo live? This is bigger than the CLI family (auth, vault, hosting,
  GTM). May warrant its own repo rather than living under `fob-cli`.

## Related Files

- `cli/fob-zb/` (`@fob/zb`) — Zoho Books client+CLI; **OAuth2 credentials seam**, the Phase-1 starting point. See `src/index.js`, README "As a library".
- `cli/fob-email/` (`@fob/email`) — IMAP/SMTP email client+CLI; creds via `FOB_EMAIL_ACCOUNTS` JSON or flags. Email path to migrate to Gmail API + OAuth.
- `cli/fob-cli/` (`@fob/cli`) — the `fob` dispatcher; the generic MCP adapter (Phase 4) is its conceptual sibling.
- `cli/fob-stm/`, `cli/fob-orc/`, `cli/fob-worker/` — additional resource layers to expose in Phase 4.
- `~/.claude/scripts/recent-spends.js` — the toy that started this: a local Node script over the `himalaya` CLI (IMAP + local Gmail creds). Illustrates exactly why terminal-only doesn't reach web-chat customers.

## References

- Engineering standards — CLI: `engineering-standards/cli/` (the 2-in-1 / credentials-seam pattern this leans on)
- MCP spec (remote transport + OAuth 2.1 authorization)
- Anthropic "Custom Connectors" (Claude.ai) + Claude API `mcp_servers`
- OpenAI MCP support (ChatGPT connectors / Apps SDK / Responses API `mcp` tool)
- Auth/tool brokers: Arcade.dev, Composio, Pipedream Connect
