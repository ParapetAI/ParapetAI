# Parapet (MVP) – LLM Middleware Proxy

[![License](https://img.shields.io/badge/license-MIT-blue)](#)

---

## Overview

Parapet is an LLM perimeter. It sits between your internal services and any LLM provider (OpenAI, Anthropic, local models, etc.) and acts as the single choke point for:

- who is allowed to call what
- which exact model/version is allowed
- how much they’re allowed to spend
- what data is allowed to leave
- how usage is tracked and audited

Parapet is **not SaaS**. You run it yourself. We do not see your traffic, your keys, or your prompts.

Parapet is **immutable at runtime**. All behavior is defined ahead of time in one encrypted bootstrap blob. Parapet will refuse to mutate itself in production. If you want to change anything — routes, budgets, provider keys, who’s allowed to call what — you regenerate the blob and redeploy. There is no “just flip this switch in prod.”

Think “Terraform/Pulumi for LLM access,” not “AI analytics dashboard.”

---

## Key Properties

### 1. Immutable Configuration, No Runtime Mutation
Parapet does not let you edit config on a live instance. There is:
- no admin API that changes limits
- no web UI that grants new access
- no CLI that “hot-patches” policies

Every rule is defined in a single config spec file (`parapet.yaml`) that you keep in git. That spec is compiled into an encrypted blob. Parapet loads that blob at boot. After boot, it cannot be changed.

If you need to raise a spend cap, add a new service, rotate a provider key, or let a service hit a new route, you update `parapet.yaml`, regenerate a new blob, and redeploy Parapet with that blob. That’s the only way. This is intentional. It prevents drift and gives you full auditability.

### 2. Infrastructure, Not SaaS
Parapet is delivered as something you deploy (container, VM, pod) inside your network.

- It does not “phone home.”
- It does not require an external control plane.
- It does not upload your usage data to us.
- It does not need our cloud to run.

Prompts, credentials, and telemetry stay in your environment.

### 3. Enforcement Layer for AI Usage
Parapet enforces, on every request:
- Which internal service is calling.
- Which route it’s allowed to hit.
- Which model/provider that route is pinned to.
- Whether that model is still allowed (drift lock).
- Whether that call would blow past spend limits.
- Whether tokens / size are within limits.
- Whether prompt content violates basic redaction rules (PII / credentials, etc.).

Blocked calls are rejected and logged. Allowed calls are forwarded to the underlying LLM provider with the correct provider API key injected from Parapet’s vault. The calling service never directly holds provider keys.

### 4. Spend and Quota Control
You can cap how much each route or tenant is allowed to spend in a rolling period (ex: “summarizer route can’t exceed $500/day,” “this tenant can’t exceed $1000/day total”).

Parapet tracks usage: token counts, cost estimates, request counts. When a request would exceed a budget, Parapet blocks it and logs it. That prevents “we woke up to a $40k OpenAI invoice.”

### 5. Model Drift Lock
Vendors silently update model behavior or version. That can break compliance and produce inconsistent output.

Parapet lets you pin a route to a specific model identifier (ex: `gpt-4o`, `claude-3-opus-2025-09-20`, etc.) and mark it as `drift_strict: true`. If the provider changes the underlying model in a way that doesn’t match your allowed fingerprint, Parapet can reject or flag those calls instead of silently allowing them.

That gives you stable, reviewable behavior.

### 6. Redaction and Leak Protection
Parapet can apply deterministic redaction filters to input prompts before they ever leave your network. Example patterns:
- email addresses
- obvious API keys
- “looks like a bearer token”
- etc.

You control behavior per route:
- `redaction.mode: warn` → scrub obvious secrets and continue, log that we scrubbed
- `redaction.mode: block` → reject the request if it appears to contain sensitive data
- `redaction.mode: off` → do nothing

This is not “perfect PII detection.” It’s practical guardrails to stop the most obvious leaks to external LLMs.

Also: Parapet can log request metadata without logging full raw prompts by default. So telemetry is useful without becoming a data breach risk.

### 7. Multi-tenant Accounting
Parapet groups usage into “tenants.” A tenant is a logical boundary for spend, policy, and isolation. In most normal setups, **a tenant just maps 1:1 to an environment** (like `prod` or `staging`). For more advanced setups, you can run multiple tenants in one Parapet instance (like `prod-marketing` vs `prod-legal`) with separate budgets and provider keys.

You get:
- per-tenant caps
- per-route caps
- per-service access control
- traceable spend per tenant

---

## High-Level Architecture

### Components
- **Parapet runtime**: the service you deploy. It exposes routes your internal services call (ex: `/summarizer`). It forwards to the configured model/provider if allowed.
- **Internal vault / internal DB**: Parapet stores provider keys, service tokens, usage telemetry. Secrets are encrypted at rest using a master key.
- **Your config spec (`parapet.yaml`)**: human-readable, lives in git, no secrets.
- **The encrypted blob (`PARAPET_BOOTSTRAP_STATE`)**: full hydrated config + secrets, encrypted.
- **The master key (`PARAPET_MASTER_KEY`)**: symmetric key used to decrypt the blob at startup and encrypt secrets internally.

### Boot sequence (what happens when Parapet starts)
1. Parapet reads two environment variables:
   - `PARAPET_MASTER_KEY`
   - `PARAPET_BOOTSTRAP_STATE` (the encrypted, base64 config blob)
2. It decrypts the blob using `PARAPET_MASTER_KEY`.
3. It validates the config (tenants, routes, policies, service identities, admin users, provider credentials).
4. It initializes its internal state:
   - Loads route policies (budgets, drift rules, token limits, redaction rules).
   - Loads provider credentials into its vault.
   - Creates / opens an encrypted internal store (for usage telemetry).
   - Creates service identities and maps which routes they can call.
   - Creates admin/view-only dashboard users if defined.
5. It computes a checksum of that plaintext config and logs it. You can store that hash to prove “prod is running config X.”
6. It wipes plaintext secrets from memory, drops direct references to `PARAPET_MASTER_KEY` where possible, and starts serving requests.
7. From then on, Parapet is read-only. No live mutation is possible. If you want to change policy, you must redeploy with a new blob.

### Request flow (runtime)
1. Your internal service calls Parapet’s route (e.g. `POST /summarizer`) and includes its Parapet-issued token.
2. Parapet authenticates the caller, maps it to a `service` record in config, and checks:
   - Is this service allowed to call this route?
   - Is this route part of this service's tenant?
3. Parapet enforces the route’s policy:
   - Is there budget left for this route / tenant?
   - Is request size within `max_tokens_in`?
   - Does drift policy allow this model right now?
   - Redaction needed?
4. If allowed:
   - Parapet injects the correct provider API key (stored in vault, not visible to the caller).
   - Parapet forwards the sanitized request to the upstream LLM provider.
   - On response, Parapet can apply output policy if configured.
   - Parapet logs usage metadata (tokens, cost estimate, latency, enforcement notes) to telemetry.
   - Parapet returns final output to the caller.
5. If not allowed:
   - Parapet blocks and logs why (quota exceeded, drift violation, redaction violation, route not allowed, etc.).

No service ever needs direct OpenAI/Anthropic keys. They only ever talk to Parapet.

---

## Configuration Model

Parapet is configured from a single spec file you keep in git, typically called `parapet.yaml`.

Important:
- `parapet.yaml` is **plaintext, human-readable, version controlled, code-reviewed.**
- It contains **no actual secrets.**
- Instead, secrets are referenced using `*_ref` keys.
- A build step (`parapet-build`) resolves those refs using your secret manager (env vars, Vault, Key Vault, etc.) and produces the encrypted blob.

After the build, you deploy Parapet with:
- `PARAPET_BOOTSTRAP_STATE` = the encrypted blob string
- `PARAPET_MASTER_KEY` = the symmetric key used to seal/unseal that blob

At runtime Parapet only trusts those two values.

### Canonical shape of `parapet.yaml`

```yaml
version: 1

tenants:
  - name: prod
    spend:
      daily_usd_cap: 1000          # optional overall cap for this tenant
    notes: "primary production tenant"

# Note: In a simple deployment, you'll have exactly one tenant (e.g. "prod").
# In more advanced setups you can define multiple tenants in the same Parapet
# instance to isolate spend/policies across internal groups.

routes:
  - name: summarizer
    tenant: prod

    provider:
      type: openai                 # openai | anthropic | local | ...
      model: gpt-4o                # explicit provider model ID
      provider_key_ref: OPENAI_KEY_PROD   # secret ref, NOT the raw key

    policy:
      max_tokens_in: 6000
      max_tokens_out: 2000
      budget_daily_usd: 500        # this route cannot exceed $500/day
      drift_strict: true           # block if provider/model drifts
      redaction:
        mode: warn                 # warn | block | off
        patterns:
          - EMAIL
          - API_KEY
          # Built-in pattern sets for obvious leaks.
          # (Custom regex/patterns can exist in future versions.)

  # You can define more routes here, possibly pointing at different providers
  # (Anthropic, local model on LAN, etc.) with different policies.

services:
  - label: service-a
    tenant: prod
    allowed_routes:
      - summarizer
    parapet_token_ref: SERVICE_A_TOKEN  # secret ref to service-a's auth token

  # Add more services as needed. Each service is locked to explicit routes.
  # If service-a tries to call a route it's not allowed to use, Parapet blocks it.

users:
  - username: trip
    role: admin                  # admin can view internal telemetry, future dashboard
    password_ref: PARAPET_ADMIN_TRIP_PW

  - username: finance
    role: viewer                 # viewer gets read-only spend/usage insight
    password_ref: PARAPET_FINANCE_PW
````

#### Notes:

* `tenants[]`

  * A tenant is an accounting and policy boundary.
  * In most setups, there's just one tenant, like `prod`.
  * You can also run multiple tenants in one Parapet instance if you want per-team isolation (e.g. `prod-marketing`, `prod-legal`) with different budgets / models / redaction strictness.

* `routes[]`

  * A “route” is an LLM capability your services can call. Ex: `summarizer`.
  * Each route:

    * is assigned to exactly one tenant
    * pins a provider+model
    * sets token limits
    * sets spend cap
    * sets drift behavior
    * sets redaction rules

  This is the enforcement unit. Finance and security review these.

* `services[]`

  * Each “service” entry describes an internal caller: a backend, a worker, etc.
  * `allowed_routes` defines exactly which routes that caller can hit.
  * `parapet_token_ref` points to the secret token that service will use to auth with Parapet at runtime.
  * If that service tries to call a route not listed, requests are blocked.

  This gives you per-service blast radius control without giving that service provider credentials.

* `users[]`

  * Internal human accounts for Parapet’s usage/telemetry view (future dashboard, logs).
  * `admin` can see everything.
  * `viewer` is read-only (finance, audit, etc.).
  * These accounts are defined in the config. Even here, we store only `password_ref`, not raw password.

No secrets appear inline in `parapet.yaml`. The file is safe to commit to git.

---

## The Build Step (`parapet-build`)

`parapet-build` is how you go from the git-committed config (`parapet.yaml`) to something Parapet can actually boot.

It does three jobs:

### 1. Bootstrap / Wizard mode

If `parapet.yaml` does not exist, running `parapet-build` can walk you through an interactive setup:

* Asks you to name your first tenant (ex: `prod`)
* Asks you to define your first route (ex: `summarizer`)

  * which provider/model?
  * daily spend cap?
  * token limits?
  * redaction mode?
  * drift strict?
* Asks you to define at least one service that will call that route

  * service label
  * allowed routes
  * generate a token ref name (e.g. `SERVICE_A_TOKEN`)
* Asks you to define at least one admin user

  * username
  * password ref name (e.g. `PARAPET_ADMIN_TRIP_PW`)

Then it writes out a starter `parapet.yaml` for you with placeholders like `*_ref`. Example:

```yaml
version: 1
tenants:
  - name: prod
    spend:
      daily_usd_cap: 1000
    notes: "primary production tenant"
routes:
  - name: summarizer
    tenant: prod
    provider:
      type: openai
      model: gpt-4o
      provider_key_ref: OPENAI_KEY_PROD
    policy:
      max_tokens_in: 6000
      max_tokens_out: 2000
      budget_daily_usd: 500
      drift_strict: true
      redaction:
        mode: warn
        patterns:
          - EMAIL
          - API_KEY
services:
  - label: service-a
    tenant: prod
    allowed_routes:
      - summarizer
    parapet_token_ref: SERVICE_A_TOKEN
users:
  - username: trip
    role: admin
    password_ref: PARAPET_ADMIN_TRIP_PW
```

It will also tell you:

* “Create the following secrets in your secret manager: OPENAI_KEY_PROD, SERVICE_A_TOKEN, PARAPET_ADMIN_TRIP_PW”
* “Do not check those secret values into git. Only the ref names go into this file.”

### 2. Validation / Completion mode

If `parapet.yaml` exists but is missing required fields (e.g. a route without `budget_daily_usd`, or no `users[]` defined), `parapet-build` will:

* point out what’s missing
* ask you interactively to fill those in (e.g. “enter a daily_usd_cap for tenant prod”)
* update the in-memory spec
* optionally write the completed spec back to `parapet.yaml`

This keeps config consistent without forcing you to memorize every required field.

### 3. Final build mode (the important one)

Once `parapet.yaml` is valid:

1. `parapet-build` loads it.
2. For each `*_ref` in the file (like `OPENAI_KEY_PROD`, `SERVICE_A_TOKEN`, `PARAPET_ADMIN_TRIP_PW`), it resolves the real secret value from your secret source.

   * Could be environment variables that you export before running the build.
   * Could be a Vault/Key Vault provider.
   * Could be interactive prompts in extreme lock-down mode.
3. It assembles a fully hydrated config in memory:

   * tenants exactly as specified
   * routes with actual provider keys inlined (not `_ref`)
   * services with actual Parapet service tokens inlined
   * users with actual initial passwords inlined
   * all policy fields resolved
4. It either:

   * generates a `PARAPET_MASTER_KEY` (or uses an existing one for that environment), and
   * encrypts the hydrated config using that master key.
5. It base64-encodes that encrypted payload. That is your `PARAPET_BOOTSTRAP_STATE`.
6. It outputs:

   * `PARAPET_BOOTSTRAP_STATE` (the sealed blob)
   * `PARAPET_MASTER_KEY` (the symmetric key)

Those two values are what you inject into the Parapet container at runtime.

### CI / trust model

You control where this final build happens.

* For dev / staging:

  * You can let CI run `parapet-build` using staging secrets.
  * CI produces staging blob + staging master key and deploys them to staging Parapet.
  * This is fine because staging secrets are lower sensitivity.

* For prod:

  * Many orgs will not allow generic CI to ever access prod secrets.
  * That’s fine. You can run `parapet-build` in a privileged environment (internal runner, ops laptop with Vault access, etc.).
  * You produce the prod blob + prod master key yourself.
  * You then pass those two secrets into your prod deployment system.
  * CI never touches prod plaintext secrets.

This supports strict orgs without us forcing them into bad patterns.

---

## Deploying Parapet

To actually run Parapet, you deploy it like any internal service.

At runtime you must provide:

* `PARAPET_BOOTSTRAP_STATE`
  The encrypted, base64 blob that contains your entire resolved config (all tenants, routes, policies, provider keys, service tokens, admin users). This is output by `parapet-build`.

* `PARAPET_MASTER_KEY`
  The symmetric key that can decrypt that blob and is also used by Parapet to encrypt secrets at rest in its own internal vault.

You inject these as secret env vars or injected secrets in your orchestrator (Docker secrets, Kubernetes secrets, Azure Container Apps secret envs, etc.).

Example: docker run (conceptually)

```bash
docker run -p 8000:8000 \
  -e PARAPET_BOOTSTRAP_STATE="<base64...>" \
  -e PARAPET_MASTER_KEY="base64-master-key..." \
  parapet:latest
```

After that:

* Parapet boots.
* Decrypts blob.
* Initializes internal state (policies, vault, telemetry store).
* Logs the config checksum.
* Wipes plaintext from memory.
* Starts serving.

If Parapet restarts with the same env vars, behavior is deterministic.
If you provide a new blob (because you changed config), you’re effectively rolling out a new policy set.

This is how you do changes and rollbacks:

* New blob, redeploy.
* Old blob, redeploy back.

No “someone SSH’d in and flipped a flag.” There is no SSH story. There’s only “what blob is this instance running.”

---

## Runtime Surfaces

In MVP, Parapet should expose only:

1. The LLM gateway routes your services are allowed to call.
2. (Optionally) a read-only internal usage/telemetry view for admins/viewers you defined in `users[]`.

Parapet should NOT expose:

* a public admin panel that can mutate config
* a `/setBudget` or `/addRoute` endpoint
* anything that changes enforcement at runtime

Attack surface stays minimal.

---

## Telemetry / Audit

Parapet records:

* which service called which route
* which tenant that maps to
* which provider/model the route used
* request token counts (in/out)
* cost estimate
* latency
* enforcement events:

  * redaction happened?
  * spend cap hit?
  * drift violation?
  * route access denied?

It intentionally does NOT need to keep raw prompts by default.

You get:

* accountability (“who spent $400 yesterday?”)
* compliance evidence (“legal route only ever got hit by compliance-bot”)
* early warning on cost blowups
* proof that redaction / drift lock is actually running

Long term, we can add:

* optional push of summary metrics to a central dashboard
* anomaly detection
* A/B routing / model benchmarking
* cheaper-model recommendations

Those are later. MVP is local telemetry only.

---

## Why This Matters

Without Parapet:

* Every service ends up holding direct LLM provider keys.
* Nobody knows which service is burning which budget.
* Spend explodes unpredictably.
* Sensitive data leaks to third-party LLMs.
* Vendors silently swap models and behavior changes without warning.
* Compliance has no paper trail.

With Parapet:

* All LLM access is forced through one choke point.
* Every request is attributed, governed, and budgeted.
* Provider keys stay in a vault instead of being sprayed into 9 microservices.
* Drift is enforced. If the model behind `legal_checks` suddenly changes, calls fail instead of silently “just using the new thing.”
* Finance / security can actually answer: who is using GPT-4, why, and how much is it costing us?
* You can prove you are not sending disallowed data to external LLMs.

Parapet is not “AI feature velocity.” Parapet is “AI perimeter hardening.”

---

## MVP Scope (What Exists Now)

Included in MVP:

* `parapet.yaml` spec (plaintext, git-friendly, no inline secrets)
* Tenant / Route / Service / User model
* Secret reference fields (`*_ref`)
* `parapet-build`:

  * bootstrap wizard if no spec
  * validator/filler if spec incomplete
  * final builder that resolves refs from secrets and emits:

    * `PARAPET_BOOTSTRAP_STATE` (encrypted blob)
    * `PARAPET_MASTER_KEY` (symmetric key)
* Immutable runtime model:

  * No live mutation
  * Redeploy with new blob to change config
* Inline enforcement:

  * per-route spend caps
  * per-tenant spend caps
  * token limits
  * redaction policy (warn / block / off)
  * drift_strict lock on model/provider
  * service identity auth with per-route allowlists
* Provider key vaulting:

  * Caller never sees provider API keys
  * Parapet injects keys only when forwarding
* Basic telemetry / audit logging:

  * cost, tokens, latency, enforcement events
  * no raw prompts by default
* Startup checksum logging:

  * Parapet logs the hash of the decrypted config it booted with
  * You can prove “prod is running blob X”

Deferred / future work (not MVP, but roadmap):

* Centralized multi-instance telemetry aggregation
* HA state sync / external DB (today: each instance keeps its own telemetry)
* Fancier PII detection
* UI dashboard with cost graphs, drift alerts, PII hits
* Model performance benchmarking / A/B routing suggestions
* Cloud metrics rollup (opt-in, metrics only, still no prompts / keys)

---

## Mental Model

Parapet is not “AI magic.”
Parapet is not “observability SaaS.”

Parapet is **infrastructure**.

You:

* describe allowed AI access in `parapet.yaml`
* reference secrets symbolically
* build a sealed blob from that spec + your real secrets
* deploy Parapet with that blob and a master key
* get an enforceable, auditable AI perimeter

No hotfix knobs. No “trust me bro.” No mystery runtime drift.

If something changes, it’s because you changed the spec, rebuilt, and redeployed. Which means you can prove it, review it, and roll it back.

That’s the point.
