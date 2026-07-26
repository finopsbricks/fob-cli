# Token Types and Lifecycle

*What* secret a CLI holds matters as much as *where* it's stored. A short-lived, narrowly-scoped
token that leaks does little damage; a long-lived god-key that leaks is a breach. This is the
security lever with the highest payoff-to-complexity ratio — and it's mostly a *server-side* choice,
not a CLI one.

## The spectrum

| Type | Lifetime | Blast radius if leaked | Examples |
|---|---|---|---|
| **Long-lived API key/secret** | until manually revoked | full account, forever | AWS IAM keys, **our api-key/secret** |
| **Scoped token** | until revoked, but limited rights | only the granted scope | Stripe restricted keys, fly macaroons, npm granular tokens |
| **Short-lived / refreshed** | minutes–hours, auto-renewed | small time window | OAuth access tokens (gh, Wrangler, Heroku), AWS SSO/STS |
| **Federated (OIDC)** | per-run, no stored secret at all | none stored | npm trusted publishing, GitHub Actions OIDC, GCP Workload Identity |

The industry is visibly moving down this table: Stripe caps restricted keys at 90 days, npm caps
granular tokens at 90 days and pushes OIDC, AWS's own docs rank SSO/short-term above IAM keys, fly
defaults tokens to scopable macaroons.

## Two concepts worth naming

- **Scope** = *what* the token can do (read-only, one app, deploy-only). Limits damage by
  permission. fly's deploy-only tokens and Stripe's restricted keys are scope.
- **Expiry / rotation** = *how long* the token lives. Limits damage by time. A 90-day key that
  leaks stops working in ≤90 days without anyone noticing the leak.

They're independent: you can have a scoped-but-eternal key, or an unscoped-but-short one. Best is
both.

## Where we are

fob-stm uses **Pattern A: a long-lived api-key/secret pair** — top-left of the table, the widest
blast radius. That's dictated by the statements API, not the CLI. The CLI can't invent expiry or
scopes the server doesn't offer.

## The tradeoff

- **Long-lived keys**: dead simple — issue once, paste into config, done. No refresh code, no
  token-exchange machinery. Weakness: a leak is total and permanent until someone manually rotates.
- **Short-lived / scoped**: dramatically smaller blast radius, but requires *server-side* support
  (an endpoint to mint scoped or expiring keys) and usually client-side refresh logic. For OAuth
  tools this is the bulk of the wrapper's auth code.

## Layering view

This layer is **gated by the API, not the CLI** — so it's a roadmap item, not a day-one choice:

- **Baseline:** accept the long-lived key the statements API issues today. Keep it behind the
  credentials seam so nothing downstream cares about token type.
- **Layer (needs server work first):** if/when the statements API can mint **scoped** keys
  (read-only, single-entity) or **expiring** keys, the CLI adds `auth login` / rotation. Our
  [/cli/auth-patterns.md](/Users/alex/ec2code/alex/engineering-standards/cli/auth-patterns.md)
  Pattern B (OAuth2 refresh) already sketches the shape for external tools like QBO/Zoho.

**Cheap win available now, independent of the API:** document a rotation habit (rotate the
api-secret every N days; `config add` supports replacing it). Time-based blast-radius reduction with
zero code.

## Related Notes
- [Secret Storage](./secret-storage.md) — a short-lived token is safe even in plaintext
- [Tool Matrix](./tool-matrix.md)
- [Credential Precedence](./credential-precedence.md)
