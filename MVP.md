# Parapet (MVP)

Parapet is an LLM perimeter.

You run it yourself. It sits between your internal services and any LLM provider (OpenAI, Anthropic, local models, etc.), and it becomes the single point of enforcement for:
- who is allowed to call which model
- spend limits
- data leak rules
- model/version drift lock
- audit trail

Parapet is **infra, not SaaS**. We do not see your prompts, we do not see your usage, we do not hold your provider keys. You deploy it in your own environment.

Parapet is **immutable at runtime**. There is no “log in and toggle a setting in prod.” All rules live in one config file in git, are compiled into an encrypted blob, and that blob is what Parapet boots from. If you want to change policy, you regenerate the blob and redeploy. That’s on purpose.


---

## Why Parapet exists

Without Parapet:
- Every service in your org is holding raw OpenAI / Anthropic keys.
- You have no clue which service is spending what.
- A dev can call GPT-4 with customer data and you’ll never know.
- Vendors silently swap model behavior under you.
- Finance finds out about AI spend when the invoice lands.

With Parapet:
- Only Parapet holds provider keys.
- Each internal service gets a Parapet-issued token with explicit allowed routes.
- Each route is pinned to an approved model with spend caps and redaction rules.
- All usage is attributed (service X, tenant Y, route Z, cost $N).
- Budgets are enforced in real time.
- Any attempt to send disallowed data or blow budget is blocked.

This is not “AI features.” This is a perimeter and an audit trail.


---

## High-level model

### Core ideas:
1. **Config is code.**  
   You write a single YAML file (`parapet.yaml`). It defines:
   - tenants (usually environments, or teams)
   - routes (LLM capabilities your services are allowed to call)
   - services (internal callers + which routes they can hit)
   - users (admin/viewer accounts for read-only dashboards)
   - budgets, redaction rules, drift lock

   Secrets do **not** go in this file. You only reference them symbolically (`*_ref`).

2. **Build step.**  
   You run `parapet-build`. It:
   - validates the YAML
   - resolves secret refs from env / secure source
   - produces two outputs:
     - `PARAPET_MASTER_KEY`
     - `PARAPET_BOOTSTRAP_STATE` (an encrypted, base64 blob of the fully hydrated config)
   You deploy Parapet with those two values as secrets.

3. **Runtime is immutable.**  
   The Parapet container:
   - reads `PARAPET_MASTER_KEY` and `PARAPET_BOOTSTRAP_STATE` from environment
   - decrypts the blob into memory
   - initializes its policy state, auth map, budgets, and provider clients
   - logs a config checksum for audit
   - starts serving
   - never accepts live mutation of policy

   If you want to change anything (budgets, allowed routes, provider keys, etc.), you regenerate a new blob and redeploy.

4. **All LLM calls go through Parapet.**  
   Your internal service hits Parapet instead of calling OpenAI/Anthropic directly.  
   Parapet:
   - authenticates the caller
   - checks if that caller is allowed to hit that specific route
   - enforces spend caps, redaction, drift lock, token limits
   - injects the correct provider API key
   - forwards to the provider
   - logs telemetry
   - returns the response

   Your service never touches provider keys directly.

5. **Telemetry + budgets.**  
   Parapet tracks who called what, how big, how expensive, and whether anything was blocked.  
   Spend caps are enforced in real time.  
   Budget usage persists across restarts.


---

## Tenants, routes, services, users

These are the core objects you define in `parapet.yaml`.

### Tenant
Represents an accounting/policy boundary. In most setups, a tenant == one environment (`prod`, `staging`). In more advanced setups, a single Parapet instance can run multiple tenants (e.g. `prod-marketing` and `prod-legal`) with different provider keys and different redaction strictness.

Tenants allow:
- per-tenant spend caps
- isolation between groups
- finance to see “legal spent $X, marketing spent $Y”

### Route
A route is an allowed LLM capability. Example: `summarizer`.

Each route:
- belongs to one tenant
- pins to a specific provider/model (like `openai:gpt-4o`)
- has spend caps (per-day budget)
- has token limits
- has redaction rules
- has drift lock (reject if provider silently swaps the model)

This is the enforcement unit. You can’t “just call GPT-4”. You call a specific named route that is approved and controlled.

### Service
A service is an internal caller (your backend, your worker, etc.).

Each service:
- belongs to a tenant
- has a `parapet_token_ref` which resolves to its Parapet-issued auth token
- has `allowed_routes` which lists which routes it’s allowed to call

If a service tries to call a route not on its allowlist, Parapet blocks it.

This means you can give different internal services different power. “frontend-worker can only call `summarizer`” while “legal-reviewer can call `legal_checks`.” Blast radius is enforced.

### User
A human account for Parapet’s internal read-only admin surface (if enabled).

Each user:
- has `role` of `admin` or `viewer`
- is backed by `password_ref` that resolves to the real password at build time

Admins/viewers can pull usage summaries, spend reports, and see which calls were blocked and why. They **cannot** mutate live config from the UI.


---

## Example `parapet.yaml` (what lives in git)

This file is human-readable, committed, reviewed. It has **no** real secrets. Only `*_ref` placeholders.

```yaml
version: 1

tenants:
  - name: prod
    spend:
      daily_usd_cap: 1000          # overall daily budget for this tenant
    notes: "primary production tenant"

routes:
  - name: summarizer
    tenant: prod

    provider:
      type: openai                 # "openai" | "anthropic" | "local"
      model: gpt-4o                # exact upstream model identifier
      provider_key_ref: OPENAI_KEY_PROD  # secret ref, not the actual key

    policy:
      max_tokens_in: 6000
      max_tokens_out: 2000
      budget_daily_usd: 500        # cap specific to this route
      drift_strict: true           # block if provider/model drifts
      redaction:
        mode: warn                 # "warn" | "block" | "off"
        patterns:
          - EMAIL
          - API_KEY

services:
  - label: service-a
    tenant: prod
    allowed_routes:
      - summarizer
    parapet_token_ref: SERVICE_A_TOKEN   # secret ref, not actual token

users:
  - username: trip
    role: admin
    password_ref: PARAPET_ADMIN_TRIP_PW

  - username: finance
    role: viewer
    password_ref: PARAPET_FINANCE_PW
````

Notes:

* `tenants[]`: normally you define a single tenant (e.g. `prod`) for that environment. If you want isolation within one runtime (legal vs marketing), you can define multiple tenants.
* `routes[]`: each route is a capability and includes all enforcement policy.
* `services[]`: each service is allowed to call only specific routes.
* `users[]`: future-facing read-only dashboard access.

---

## The build step (`parapet-build`)

`parapet-build` is a CLI that prepares the encrypted blob Parapet will boot from.

It does 3 things:

### 1. First-time bootstrap

If there is no `parapet.yaml`, `parapet-build` walks you through a wizard:

* asks for tenant name (`prod`)
* asks you to define your first route (provider, model, budget, redaction, drift lock, etc.)
* asks you to define at least one service that can call it
* asks you to define at least one admin user
* emits a starter `parapet.yaml` with `*_ref` placeholders, not real secrets
* tells you which secrets you now need to provide (e.g. `OPENAI_KEY_PROD`, `SERVICE_A_TOKEN`, etc.)

### 2. Fill missing

If `parapet.yaml` exists but is incomplete (missing required fields like `budget_daily_usd`, or no admin user defined), `parapet-build` will:

* validate the file
* interactively ask you to fill what’s missing
* update the file in-place

This keeps the spec consistent and reviewable.

### 3. Final build (the important part)

When `parapet.yaml` is valid:

* `parapet-build` loads it.
* For each `*_ref`, it resolves the real secret using a source:

  * preferred: environment variables (e.g. `process.env.OPENAI_KEY_PROD`)
  * fallback: prompt you interactively
  * (future: Vault / Key Vault / AWS Secrets Manager)
* It now has a fully hydrated config: real provider keys, real service tokens, real admin passwords.
* It generates (or reuses) a symmetric `PARAPET_MASTER_KEY`.
* It encrypts that hydrated config with that key into a base64 blob: `PARAPET_BOOTSTRAP_STATE`.
* It prints:

  ```text
  PARAPET_MASTER_KEY=<master-key-here>
  PARAPET_BOOTSTRAP_STATE=<base64-encrypted-blob-here>

  Deploy Parapet with these two environment variables set.
  ```

Those 2 values (the master key and the blob) are all the runtime needs.

This is also where CI/CD can get involved:

* For dev/staging: You can run `parapet-build` in CI using staging secrets in env vars.
* For prod: You can run `parapet-build` on a secure runner / ops machine to avoid giving generic CI access to prod keys.

---

## Runtime boot sequence

When you start the Parapet container in prod:

1. You pass two env vars (usually via your orchestrator's secret storage):

   * `PARAPET_MASTER_KEY`
   * `PARAPET_BOOTSTRAP_STATE`

2. On startup Parapet:

   * decrypts `PARAPET_BOOTSTRAP_STATE` using `PARAPET_MASTER_KEY`
   * gets the fully hydrated config (tenants, routes, services, users, provider keys, budgets, policies)
   * builds in-memory indexes:

     * service token → { service label, tenant, allowed routes }
     * route name → { provider adapter, policy, spend caps, drift settings, redaction rules }
     * tenant → spend caps
   * initializes a “vault” in memory with provider credentials
   * initializes in-memory spend counters for each `(tenant, route)`
   * initializes telemetry (see below)
   * logs a deterministic checksum of the config for audit (“prod is running config hash abc123”)
   * wipes any transient plaintext copies of secrets we don’t need anymore

3. Parapet starts serving HTTP.

4. From this point on, Parapet is read-only. It will not accept changes to policy at runtime. There is no admin API to mutate budgets/routes.
   If you need to change anything, you build a new blob and redeploy the container with the updated secrets.

This is deliberate. No drift, no “someone SSH’d in and turned off redaction quietly.”

---

## Request flow at runtime

When your internal service calls Parapet:

1. It hits `POST /:routeName` on Parapet (e.g. `/summarizer`) and includes its Parapet-issued token.
2. Parapet resolves that token to a service identity.
   If invalid → reject immediately.
3. Parapet checks:

   * is the service allowed to call this route?
   * what tenant is this request billed to?
4. Parapet pulls the route’s policy:

   * token limits
   * budget caps
   * redaction mode
   * drift lock (model pinning)
5. Parapet checks real-time budget counters for that `(tenant, route)`:

   * would this call (estimated cost) blow past any daily cap?
   * if yes → reject and log it
6. Parapet applies redaction rules if configured:

   * `warn`: scrub obvious leaks (EMAIL, API_KEY, etc.) and continue, with a log flag
   * `block`: if we see sensitive patterns, reject outright
   * `off`: skip redaction
7. Parapet injects the correct provider API key (from its in-memory vault — the caller never sees it)
8. Parapet forwards the sanitized request to the upstream model (OpenAI, Anthropic, local, etc.) using a provider adapter
9. Parapet gets the response, records tokens used / cost / latency, and returns the output to the caller.
10. Parapet enqueues a telemetry event describing what happened.

The caller never talks to OpenAI/Anthropic directly.
The caller never holds your provider key.

---

## Budget enforcement and telemetry

### Real-time budgets

Parapet maintains in-memory “spend counters” per `(tenant, route)` for the current window (“today”).

Before allowing a request, Parapet:

* estimates the cost
* checks if allowing it would exceed the configured `budget_daily_usd` for the route or tenant
* blocks if it would

This gives you “we will not blow $5k overnight by accident” guarantees.

Those counters are updated immediately in memory, so enforcement is O(1) and does not block on disk.

### Telemetry store

Parapet also needs an audit trail:

* which service called which route
* when
* allowed or blocked
* tokens in/out
* cost
* enforcement flags (budget hit, redaction triggered, drift violation, etc.)

Parapet stores telemetry locally using a lightweight append-only store (SQLite or equivalent) on disk.

Importantly:

* We do **not** store raw prompt text by default.
* We store metadata only.

### Performance under load

We do not write to disk for every request in-line.

Instead:

* Parapet queues telemetry events in memory.
* A background flusher wakes up on a short interval (ex: ~100ms) or when the buffer reaches a certain size.
* The flusher writes a batch of events to disk in one transaction.

Benefits:

* The hot path never waits on disk.
* Even at 10,000 RPS, disk writes are amortized.

If the process crashes between flushes, you could lose the last slice of telemetry (tens of ms worth). That is acceptable for MVP. We document this clearly.

### Replay on startup

When Parapet boots, it:

* opens the telemetry DB
* loads “today’s” records
* rebuilds the in-memory spend counters from those records

So budget enforcement survives restarts.

This is why Parapet needs persistent storage (below).

---

## Persistent data directory

Parapet needs a writable directory that survives container restarts.

We’ll refer to this path as `/data`.

What goes in `/data`:

* Telemetry database (append-only record of usage / spend / enforcement decisions)
* State needed to rebuild today’s spend counters

Why we need it:

* If you redeploy Parapet without attaching the same volume, Parapet loses its telemetry history and will treat budgets like they’re fresh.
* That means spend caps reset on restart. That’s bad.
* It also means you lose auditing (“show me who called what yesterday”).

So: **You must mount a persistent volume at `/data`.**

Examples:

* Docker: `-v parapet-data:/data`
* Kubernetes: PVC mounted at `/data`
* Azure Container Apps / ECS: equivalent persistent storage / volume mount

This does NOT leave your VPC / cluster. It’s still fully self-hosted. We’re just asking you to persist one directory between deploys.

Important:

* We do not store raw prompts by default.
* We only store metadata: caller identity, route, budget decisions, spend estimates, token counts, timestamps, and flags like `redacted=true`.

Security/compliance teams get an audit trail. Finance gets attribution. You still keep sensitive content out of long-term disk.

---

## Admin surface (read-only)

Parapet can optionally expose a small read-only internal admin API for humans (not for services). This is protected by the `users` you defined in the config.

Roles:

* `admin`: full read access to telemetry summaries
* `viewer`: read-only access to spend/usage, but maybe not all enforcement reasons depending on policy

What this surface can return:

* budget usage per route / tenant (“summarizer has used $312.40 of its $500 daily cap”)
* total calls by service
* how many calls were blocked and why (budget, redaction, drift)
* current config checksum (the hash printed at boot)

What it cannot do:

* change budgets
* add new services
* flip off redaction
* touch provider keys
* reload config

If someone wants to change policy, they must edit `parapet.yaml`, rebuild the blob, and redeploy.

That’s the point. We do not allow silent runtime drift.

---

## Project layout (TypeScript implementation)

Repo is split into two executables:

* `parapet-build` (builder CLI)
* `parapet-runtime` (the actual gateway service)

Directory sketch:

```text
parapet/
├─ package.json
├─ tsconfig.json
├─ README.md
├─ parapet.yaml.example
└─ src/
   ├─ config/
   │   specTypes.ts        # types for parapet.yaml (no secrets, only *_ref)
   │   hydratedTypes.ts    # types after secret resolution (runtime view)
   │   schema.ts           # structural validation rules
   │   parseYaml.ts        # load parapet.yaml -> SpecConfig
   │   validate.ts         # enforce required fields, invariants
   │   resolveRefs.ts      # resolve *_ref -> real secrets (build step only)
   │   blobEncrypt.ts      # build: HydratedConfig -> encrypted base64 blob
   │   blobDecrypt.ts      # runtime: env -> decrypt blob -> HydratedConfig
   │   checksum.ts         # deterministic config hash for audit
   │   constants.ts        # version, supported providers, redaction patterns
   │
   ├─ buildtool/
   │   index.ts            # CLI entrypoint
   │   wizard.ts           # create new parapet.yaml interactively
   │   fillMissing.ts      # if parapet.yaml exists but is incomplete
   │   secretsources/
   │   │   envSource.ts    # resolve *_ref from environment variables
   │   │   promptSource.ts # fallback interactive secret input
   │   buildBlob.ts        # main "final build": produce MASTER_KEY + BLOB
   │   output.ts           # print deployment instructions
   │
   ├─ runtime/
   │   index.ts            # runtime entrypoint. reads env, boots server.
   │   bootstrap.ts        # decrypt blob, assemble runtime state, init budgets
   │   state.ts            # in-memory runtime state holder (maps, vault, etc)
   │   auth.ts             # map caller token -> service identity / tenant
   │   policy.ts           # core enforcement (budget, drift, redaction, tokens)
   │   budget.ts           # in-memory spend counters + checkAndReserve/finalize
   │   drift.ts            # model/version pinning checks
   │   redaction.ts        # scrub EMAIL/API_KEY/etc (warn/block/off)
   │   providerRouter.ts   # choose provider adapter for a route, call it
   │   telemetry/
   │   │   telemetry.ts    # enqueue telemetry events for async flush
   │   │   writer.ts       # background flusher (batch writes to disk)
   │   │   store.ts        # append-only local store (SQLite or similar)
   │   │   replay.ts       # rebuild today's spend counters on boot
   │   vault.ts            # in-memory provider creds and service tokens
   │   httpServer.ts       # HTTP server setup (Fastify or similar)
   │   handlers.ts         # request handler glue: auth -> policy -> provider -> telemetry
   │   adminApi.ts         # read-only admin/viewer endpoints for spend/usage
   │   types.ts            # runtime-only types (CallerContext, RoutePolicy, etc)
   │   util/
   │       cost.ts         # estimate cost from tokens/model
   │       timeWindow.ts   # define "today" for spend windows
   │       log.ts          # minimal structured logging
   │
   ├─ providers/
   │   types.ts            # ProviderAdapter interface
   │   openaiProvider.ts   # upstream call to OpenAI-compatible API
   │   anthropicProvider.ts# upstream call to Anthropic-compatible API
   │   localProvider.ts    # call a local/self-hosted model endpoint on LAN
   │
   └─ docs/
       SPEC.md             # parapet.yaml reference
       BOOT.md             # blob/master key boot process
       RUNTIME.md          # request flow, enforcement order
       SECURITY_MODEL.md   # threat model, persistence guarantees
```

Key properties of this layout:

* Runtime code (`src/runtime/*`) never imports build-only code.
* Policy is centralized in `policy.ts`. Anyone can read that file and understand enforcement.
* Budget and telemetry are isolated. The HTTP handler stays brain-dead simple.
* Provider adapters are in their own folder so we can add new LLM backends without touching core policy logic.
* Everything we need to port the runtime to Go later is already modular and explicit.

This keeps the runtime small, grokkable, and portable.

---

## Deployment

You deploy Parapet like any internal service.

### Prereqs you must provide:

1. Two secrets as environment variables:

   * `PARAPET_MASTER_KEY`
   * `PARAPET_BOOTSTRAP_STATE`
     (These come from `parapet-build`.)

2. A persistent volume mounted at `/data`:

   * Parapet writes telemetry and spend state here.
   * If you don’t persist `/data`, budget enforcement resets on restart and you lose audit trail.

3. Network access:

   * Parapet must be reachable by your internal services.
   * Parapet must be allowed outbound to the LLM providers you configured (OpenAI/Anthropic/etc.) or to your own local model endpoint.

Example (conceptual Docker run):

```bash
docker run -p 8000:8000 \
  -e PARAPET_MASTER_KEY="base64-master-key..." \
  -e PARAPET_BOOTSTRAP_STATE="base64-encrypted-blob..." \
  -v parapet-data:/data \
  ghcr.io/your-org/parapet-runtime:latest
```

Now your internal service calls `http://parapet.internal:8000/summarizer` instead of calling OpenAI directly.

---

## Security model / honesty notes

* Parapet is not magic. It’s a choke point with policy.
* If a developer hardcodes their own OpenAI key in their service and bypasses Parapet entirely, Parapet can’t stop that. Parapet gives you visibility and enforcement where it’s used. You still need basic code review / network policy.
* Secrets are decrypted in memory at runtime. In TypeScript/Node we cannot hard-guarantee zeroization due to GC, but we try to avoid unnecessary copies and never write provider keys to disk.
* Telemetry persistence is batched. A crash between flushes can lose a short slice of recent usage. We document that so finance/legal understand the limits.
* We do not store raw prompt bodies by default in telemetry. We store metadata.
* We enforce model drift lock by comparing configured provider/model identifiers to what we’re actually calling. If `drift_strict` is true and something doesn’t match, we block.
* We enforce spend caps in-memory in real time and refuse calls that would blow the cap.

In other words: this is not marketing fluff. This is actually enforceable behavior an auditor can understand and legal can point to.

---

## Roadmap / non-MVP

Not in MVP, but planned:

* Multiple Parapet instances + central reporting sync
* TypeORM / richer analytics mode for reporting, outside the hot path
* More complex redaction patterns and custom regex/rulesets per route
* A/B / model benchmarking (route → “candidate backends,” log cost/quality)
* Auto-suggest: “this route is burning $X, you could move to a cheaper model with minimal change”
* UI dashboard on top of telemetry with charts
* Go runtime binary for hardened / security-audit buyers
* Encrypted-at-rest telemetry rows using a subkey derived from `PARAPET_MASTER_KEY`
* Vault / KMS secret source resolver in `parapet-build`

---

## Summary

Parapet gives you:

* A single controlled surface for all LLM usage
* Per-service route access control
* Spend caps that actually block overages
* Redaction and leak prevention on outbound prompts
* Model/version drift lock
* Audit trail of who called what, at what cost, and whether we allowed or blocked it
* A deployment story that lives entirely in your environment

No opaque SaaS. No “just trust us.”
Parapet is infrastructure.
