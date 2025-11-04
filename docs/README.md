## Parapet YAML configuration (`parapet.yaml`)

This document defines how to configure Parapet using `parapet.yaml`: all keys, allowed values, defaults, and constraints, with examples. It also explains how secret references are resolved from the environment.

### Quick start

Place a `parapet.yaml` at the repository root:

```yaml
version: 1

tenants:
  - name: default
    spend:
      daily_usd_cap: 5.0

services:
  - label: my-app
    tenant: default
    allowed_routes: [openai]
    parapet_token_ref: my_app_token_ref

routes:
  - name: openai
    tenant: default
    provider:
      type: openai
      model: gpt-4o-mini
      endpoint_type: chat_completions
      provider_key_ref: openai_api_key_ref
      default_params:
        temperature: 0.7
    policy:
      max_tokens_in: 4000
      max_tokens_out: 4000
      budget_daily_usd: 2.0
      drift_strict: true
      redaction:
        mode: block
        patterns: ["email", "api_key", "ip", "phone"]
    retries:
      max_attempts: 3
      base_ms: 200
      jitter: true
      retry_on: [429, 500, 502, 503, 504]
      max_elapsed_ms: 10000
    cache:
      enabled: true
      mode: exact
      ttl_ms: 30000
      max_entries: 5000
      include_params: true
```

---

## Top-level structure

```yaml
version: <number>
tenants: <TenantSpec[]>
routes: <RouteSpec[]>
services: <ServiceSpec[]>
```

- **version**: Schema version. Currently `1`.
- **tenants**: Billing and limits per tenant.
- **routes**: Model/provider routing configuration and policies.
- **services**: Client-facing services authorized to call specific routes.

All arrays must be present (even if empty). Names/labels must be unique within their collections.

---

## Tenants

```yaml
tenants:
  - name: <string>
    spend:
      daily_usd_cap: <number>
    notes?: <string>
```

- **name**: Required, unique.
- **spend.daily_usd_cap**: Required, non-negative number. Daily tenant budget cap.
- **notes**: Optional free-form text.

Validation:
- Names must be unique.
- `daily_usd_cap` ≥ 0.

---

## Services

```yaml
services:
  - label: <string>
    tenant: <string>        # must refer to an existing tenant.name
    allowed_routes: <string[]> # route names
    parapet_token_ref: <string>
```

- **label**: Required, unique. Identifier for a client/application.
- **tenant**: Required. Must match a defined tenant `name`.
- **allowed_routes**: Required, array of route names that the service may call.
- **parapet_token_ref**: Required secret ref. Resolved to the actual token; if not found in env, a token is randomly generated with prefix `parapet-<service-label>-` at runtime.

Validation:
- Labels must be unique.
- Each `allowed_routes[]` must reference an existing route `name`.

Hydration/Resolution:
- Resolved token field is exposed at runtime as `parapet_token`.

Runtime authentication:
- Clients authenticate with `Authorization: Bearer <parapet_token>`.
- Tokens are mapped to a caller context containing `serviceLabel`, `tenant`, and `allowed_routes` (see `apps/runtime/src/core/state.ts#indexServices`).
- Requests without a valid token are rejected with `invalid_parapet_api_key`.

---

## Routes

```yaml
routes:
  - name: <string>
    tenant: <string>   # must refer to an existing tenant.name
    provider: <ProviderSpec>
    policy?: <PolicySpec>
    retries?: <RetrySpec>
    cache?: <CacheSpec>
    webhook?: <WebhookSpec>
```

- **name**: Required, unique.
- **tenant**: Required. Must match a defined tenant `name`.

### ProviderSpec

```yaml
provider:
  type: <"openai" | "local">
  model: <string>
  endpoint_type?: <"chat_completions" | "embeddings"> # default: chat_completions
  provider_key_ref?: <string>   # required for non-local providers
  endpoint?: <string>           # required for local providers
  default_params?: <object>     # arbitrary provider params
```

- **type**: `openai` or `local`.
- **model**: Required model name.
- **endpoint_type**: Optional; defaults to `chat_completions`. Use `embeddings` for embedding routes.
- **provider_key_ref**: Required when `type != local`. Secret reference to provider API key.
- **endpoint**: Required when `type == local`. Base URL for the local provider endpoint.
- **default_params**: Optional object merged into request parameters for the provider.

Validation:
- For `type: local`, `endpoint` is required.
- For non-local types, `provider_key_ref` is required.
- The other field (if provided) is ignored.

Hydration/Defaults at runtime:
- `endpoint_type` becomes required on the hydrated config (default applied).
- Non-local `provider_key_ref` resolves to `provider_key` via secret resolution.

Field requirements and defaults (from code):
- `type` (required): one of `openai`, `local` (see `libs/config-core/src/spec/validate.ts`).
- `model` (required): any non-empty string.
- `endpoint_type` (optional): default `chat_completions` (see `libs/config-core/src/hydration/resolveRefs.ts`).
- `provider_key_ref` (conditional): required iff `type != local` (validated).
- `endpoint` (conditional): required iff `type == local` (validated).
- `default_params` (optional): merged with request params; request overrides route defaults (see `apps/runtime/src/providers/params.ts#mergeParams`).

Behavior notes:
- If both `endpoint` and `provider_key_ref` are provided, only the field relevant to the provider type is used; the other is ignored by runtime consumers.
- On call, params are merged, validated per endpoint type, and `max_tokens` may be enforced from policy (details below).

Parameter validation (from `apps/runtime/src/providers/params.ts`):
- Chat completions allowed keys: `temperature`, `top_p`, `frequency_penalty`, `presence_penalty`, `max_tokens`, `max_completion_tokens`, `stop`, `n`, `logit_bias`, `logprobs`, `top_logprobs`, `seed`, `response_format`, `tools`, `tool_choice`, `parallel_tool_calls`, `service_tier`, `store`, `stream_options`, `modalities`, `metadata`, `reasoning_effort`, `prompt_cache_key`, `safety_identifier`, `prediction`.
  - Constraints:
    - `temperature` in [0, 2].
    - `top_p` in [0, 1].
    - `frequency_penalty`, `presence_penalty` in [-2, 2].
    - `reasoning_effort` one of: `minimal`, `low`, `medium`, `high`.
    - `stop` string or string[].
    - `n` positive integer.
    - `logit_bias` object with numeric values in [-100, 100].
    - `logprobs` boolean; `top_logprobs` integer in [0, 20].
    - `seed` integer.
    - `response_format.type` in `text | json_object | json_schema`; when `json_schema`, `response_format.json_schema` must be an object.
    - `tools` array; `tool_choice` in `none | auto | required` or an object; `parallel_tool_calls` boolean.
    - `service_tier` one of `auto | default | flex | scale | priority`.
    - `store` boolean; `stream_options` object.
    - `modalities` array containing `text` and/or `audio`; `metadata` object.
    - `max_completion_tokens` positive integer.
- Embeddings allowed keys: `dimensions`, `encoding_format`, `user`.
  - Constraints:
    - `dimensions` positive integer.
    - `encoding_format` in `float | base64`.
    - `user` string.
- Global: if present, `max_tokens` must be a positive integer.

### PolicySpec

```yaml
policy:
  max_tokens_in: <number>      # ≥ 0
  max_tokens_out: <number>     # ≥ 0
  budget_daily_usd: <number>   # ≥ 0
  drift_strict: <boolean>
  drift_detection?:
    enabled?: <boolean>                 # default: drift_strict
    sensitivity?: <"low"|"medium"|"high"> # default: medium
    cost_anomaly_threshold?: <number>   # 0..1, default by sensitivity
  redaction:
    mode: <"warn" | "block" | "off">
    patterns: <string[]>
```

- **max_tokens_in/out**: Non-negative numeric limits per request.
- **budget_daily_usd**: Non-negative; per-route daily budget.
- **drift_strict**: When true, drift detection defaults to enabled.
- **drift_detection**: Optional fine-tuning:
  - `enabled`: Defaults to `drift_strict`.
  - `sensitivity`: Defaults to `medium`. Thresholds: `low` 25%, `medium` 15%, `high` 10%.
  - `cost_anomaly_threshold`: 0..1 override; otherwise derived from sensitivity.
- **redaction** (actual behavior):
  - `mode`:
    - `off`: No checks, request body passed through unchanged.
    - `block`: If any pattern matches the request text, the request is rejected with reason `redaction_blocked`.
    - `warn`: If any pattern matches, text is scrubbed in-place and processing continues.
  - `patterns`: Array combining built-in rule names and custom matchers. Order does not affect the decision to block/scrub (the system first checks if any compiled regex matches at all; if none match, nothing is changed). Details:
    - Built-in names (case-insensitive matching): `email`, `api_key`, `ip`, `phone`.
    - Custom regex via `re:<body>` (flags default to `gi`).
    - Slash-regex `/body/flags` is supported; flags default to `gi` when omitted.
    - Any other string is treated as a literal substring (compiled as `gi`).
  - Replacement when `mode: warn` maps by tag:
    - `email` → `[REDACTED_EMAIL]`
    - `api_key` → `[REDACTED_API_KEY]`
    - `ip` → `[REDACTED_IP]`
    - `phone` → `[REDACTED_PHONE]`
    - custom/other → `[REDACTED]`
  - Application to request bodies (only when policy present and `mode != off`):
    - For `embeddings` endpoint: If `input` is an array, it is joined with `"\n"` for scanning; after scrubbing, the result is split on `"\n"` and mapped back to an array. If `input` is a string, it is scrubbed as a single string.
    - For `chat_completions` endpoint: All `messages[].content` are joined with `"\n"` and scanned once. After scrubbing, the text is split on `"\n"` and mapped back to messages by index (`parts[i] ?? original`). Note: if any message content contains internal newlines, the split-by-line mapping can misalign with original message boundaries.
  - Telemetry integration: `redaction_applied` is recorded as `true` only when `mode: warn` caused replacements; it is `false` for both `mode: off` and for blocked requests; absent policy is equivalent to `mode: off`.

Exact built-in regexes (from `apps/runtime/src/security/redaction.ts`):

```
  email: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  api_key: /(?:api|key|secret)[_\-]?(?:id|key)?[:=\s]*[A-Za-z0-9_\-]{16,}/gi,
  ip: /\b(?:(?:2(5[0-5]|[0-4]\d))|1?\d?\d)(?:\.(?:(?:2(5[0-5]|[0-4]\d))|1?\d?\d)){3}\b/g,
  phone:
    /(?<!\d)(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]*\d{3}[-.\s]*\d{4}(?!\d)/g,
```

Validation:
- If `policy` is present, `redaction` is required and must include both `mode` and `patterns`.

Field requirements and defaults (from code):
- If `policy` is present:
  - `max_tokens_in`, `max_tokens_out`, `budget_daily_usd`: required, non-negative numbers.
  - `drift_strict`: required boolean.
  - `drift_detection` (optional):
  - `enabled` default: value of `drift_strict`.
  - `sensitivity` default: `medium`.
  - `cost_anomaly_threshold` default by sensitivity: `low: 0.25`, `medium: 0.15`, `high: 0.10` (see `resolveRefs.getCostThreshold`).
- `redaction` (required when policy present): `mode` in {`warn`,`block`,`off`}; `patterns` is an array (see validation).

Behavior notes (from runtime):
- If `policy` is omitted: pass-through behavior is expected — no redaction, no token cap enforcement, no budget checks, and drift detection disabled. Pre-selection by exact model still applies for chat.
- If `policy` is present:
  - Max tokens in: request is blocked if estimated input tokens exceed `max_tokens_in` (see `apps/runtime/src/policy/policy.ts`).
  - Max tokens out: for `chat_completions`, the outgoing `max_tokens` param is enforced to be ≤ `policy.max_tokens_out` (set/overridden when higher or absent). For `embeddings`, enforcement is skipped (see `enforceMaxTokens`).
- Output token estimate (for budget pre-check):
  - If embeddings: 0.
  - If chat: heuristic `max(1, min(effectiveCap, max(32, ceil(tokensIn*1.4), ceil(tokensIn + 12))))`, where `effectiveCap = min(request.max_tokens (if provided), policy.max_tokens_out)` (see `policy.ts`).

Drift controls (strict vs detection):
- Pre-selection by model (always): For chat completions, the runtime selects a route by exact model match within the caller's `allowed_routes` and endpoint type; if none match, the request is rejected with `drift_violation` (see `apps/runtime/src/http/openaiUtil.ts#selectRouteNameByModel`).
- `drift_detection` (post-response, only when policy present and enabled): After the provider call the runtime checks:
  - Response `metadata.model` mismatch vs expected model → `detected: true` with `model_mismatch:<model>`.
  - Response `metadata.systemFingerprint` change vs last baseline for the route → `detected: true` with `fingerprint_changed:<fp>`.
  - Cost anomaly: if `abs(actual - expected) / expected > cost_anomaly_threshold` → `detected: true` with `cost_anomaly:<percent>`.
  - Baseline is updated per route with last `systemFingerprint` and sample count (see `apps/runtime/src/security/drift.ts`).

### RetrySpec (optional)

If the `retries` object is present, all its fields become required.

```yaml
retries:
  max_attempts: <number>     # integer, 2..5
  base_ms: <number>          # 100..1000
  jitter: <boolean>          # full jitter when true
  retry_on: <number[]>       # subset of [429, 500, 502, 503, 504], non-empty
  max_elapsed_ms: <number>   # ≥ base_ms
```

Behavior (non-streaming calls):
- Attempts: uses `max_attempts` (default 1 when `retries` absent). If `stream: true`, retries are disabled in the provider call path (attempts forced to 1) (see `providerRouter.ts`).
- Classification:
  - Auth errors (401 or `invalid_api_key`) are never retried.
  - Network errors (no HTTP status) are treated as retryable.
  - Otherwise, status must be in `retry_on` to retry.
- Window: total elapsed time since first attempt must be < `max_elapsed_ms` to continue retrying.
- Backoff: delay between attempts is `base_ms * 2^(attempt-1)`; if `jitter: true`, a random integer in `[0, max(base_ms, delay)]` is used (see `apps/runtime/src/util/backoff.ts`).

Behavior (streaming chat completions):
- Streaming retries happen at the stream reader level (SSE). On a read error, the code waits for a backoff delay (same formula as above) and re-invokes the provider to obtain a fresh stream, up to `max_attempts` and `max_elapsed_ms`. There is no status-based classification at this level (see `pipeStreamWithRetries` in `apps/runtime/src/http/completions/index.ts`).

### CacheSpec (optional)

```yaml
cache:
  enabled?: <boolean>       # default: false
  mode?: <"exact">         # only "exact" is allowed
  ttl_ms?: <number>         # default: 30000 (≥ 0)
  max_entries?: <number>    # default: 5000 (≥ 1)
  include_params?: <boolean> # default: true
```

Runtime cache key composition (mode `exact`):
- Includes `route`, `provider.type`, `endpoint_type`, `model`, `redaction_mode`, payload (messages/input), and optionally params.
- When `include_params: true`, volatile params (`client_request_id`, `request_id`, `trace_id`) are excluded automatically.

Validation:
- `mode` must be `exact` when provided.
- Numeric fields must be within bounds noted above.

Runtime behavior:
- Scope: Cache is per-route, opt-in. Caching is used only for non-streaming responses (`stream: false`) (see handlers in `apps/runtime/src/http/*/index.ts`).
- Store: On success, the full provider response body is cached with status 200. On cache hit, budgets are finalized with zero additional cost (reservation released), and telemetry/audit reflects `cache_hit: true`.
- Engine: Uses `tiny-lru(max_entries, ttl_ms)` per enabled route; TTL is applied at insert time; evictions increment a per-route `evictions` counter when a set replaces an entry at full capacity without growth (see `apps/runtime/src/core/bootstrap.ts` and usage in handlers).
- Key: Built via `buildCacheKey(route, endpoint_type, payload, params, include_params, redaction_mode)` and includes:
  - `route`, `provider.type`, `endpoint_type`, `model`, `redaction_mode`.
  - Payload: chat → sanitized `messages` structure; embeddings → sanitized `input`.
  - Params: included when `include_params: true` (default) after stripping volatile keys `client_request_id`, `request_id`, `trace_id`.
- Redaction interaction: Keys incorporate `redaction_mode` and the sanitized payload (post-redaction), so changes in redaction settings or scrubbed content affect cache keys.
  - When policy is omitted, `redaction_mode` is effectively treated as `off` and payload is the original (unscrubbed) content.

### WebhookSpec (optional)

```yaml
webhook:
  url: <string>
  secret_ref: <string>
  include_prompt_snippet?: <boolean>  # default: false
  events?:
    policy_decisions?: <boolean>  # default: true
    request_errors?: <boolean>    # default: true
    provider_errors?: <boolean>   # default: true
```

Validation:
- When present, `url` and `secret_ref` are required and must be non-empty strings.

Hydration/Defaults at runtime:
- `secret_ref` resolves to `secret` via secret resolution.
- `include_prompt_snippet` defaults to `false`.
- Each `events.*` defaults to `true` unless explicitly `false`.

Runtime behavior:
- Emission gating: A webhook is emitted only if the route has a `webhook` configured and the corresponding event flag is `true` (policy decisions, request errors, provider errors). If a webhook is configured but a specific event is disabled, logs are written instead (see `apps/runtime/src/util/webhook.ts`).
- Signature: Requests are signed with `X-Parapet-Signature: sha256=<hex>`, where the HMAC is computed over the JSON body with the configured secret (see `emitAuditEvent`).
- Payload fields include: timestamp, tenant, route, model, decision (allow/block), reason_if_blocked, estimated_cost_usd, actual_cost_usd, budget caps and current spend, `redaction_mode`, `drift_strict`, optional `retry_count`, `cache_hit` flags (see `AuditEventBody`).
- Prompt excerpt: When both the route sets `include_prompt_snippet: true` and the emitter call indicates `include_prompt_snippet: true`, the first 80 characters of sanitized messages are included as `prompt_excerpt`. Otherwise it is empty.

---

## Secret reference resolution

Several fields accept secret references (e.g., `provider_key_ref`, `parapet_token_ref`, `webhook.secret_ref`). These are resolved at runtime as follows:

1) Explicit env var reference:

```yaml
provider_key_ref: "ENV:OPENAI_API_KEY"
```

- The `ENV:` prefix tells Parapet to load from that exact environment variable name.

2) Implicit env var names:

Given a ref like `openai_api_key_ref`, Parapet checks these environment variables, in order:
- Uppercased, sanitized base name with `_ref` removed and non-alphanumerics replaced by `_`, e.g. `OPENAI_API_KEY`.
- The same name prefixed with `PARAPET_`, e.g. `PARAPET_OPENAI_API_KEY`.

3) Prompt or generation fallback:
- For `provider_key_ref` and `webhook.secret_ref`, if not found and prompting is allowed, Parapet may prompt (when a prompt function is provided) and will error if still empty.
- For `parapet_token_ref` on services, if no env var is found, Parapet generates a random token like `parapet-<service-label>-<random>`.

Bearer tokens and provider keys at runtime:
- Provider keys are loaded into an in-memory vault keyed by `route:<routeName>:provider_key`. Webhook secrets similarly use `route:<routeName>:webhook_secret` (see `apps/runtime/src/core/bootstrap.ts`).
- Service tokens are used only for request authentication and permission checks; they are never sent to providers.

### Setting environment variables

- Windows PowerShell:

```powershell
$env:OPENAI_API_KEY = "sk-..."
$env:PARAPET_OPENAI_API_KEY = "sk-..."  # alternative prefixed form
```

- POSIX shells (bash/zsh):

```bash
export OPENAI_API_KEY="sk-..."
export PARAPET_OPENAI_API_KEY="sk-..."  # alternative prefixed form
```

---

## Validation rules (summary)

- `version` must be a number.
- `tenants`, `routes`, `services` must be arrays (present even if empty).
- Tenant `name`s are required and unique; `daily_usd_cap` ≥ 0.
- Route `name`s are required and unique; each route must reference an existing tenant.
- Provider:
  - `type` in {`openai`, `local`}.
  - `model` required.
- If `type == local`, `endpoint` is required; `provider_key_ref` (if present) is ignored.
- If `type != local`, `provider_key_ref` is required; `endpoint` (if present) is ignored.
- Policy optional; if present, `redaction` is required within policy; see constraints above. Without policy: no token cap/budget enforcement, redaction off, drift detection off.
- If `retries` present, all its fields are required and must pass bounds checks.
- If `cache` present, values must pass bounds checks; `mode` when provided must be `exact`.
- If `webhook` present, `url` and `secret_ref` are required; boolean subfields must be booleans if provided.
- Service `label`s are required and unique; must reference an existing tenant; each `allowed_routes[]` must reference an existing route.

---

## Endpoint types

`provider.endpoint_type` controls the runtime endpoint Parapet will use:
- `chat_completions`: default; routes requests to chat completion flows.
- `embeddings`: routes requests to embeddings flows.

Ensure the model supports the selected endpoint type.

---

## Examples

### OpenAI embeddings route

```yaml
routes:
  - name: embeddings
    tenant: default
    provider:
      type: openai
      model: text-embedding-3-small
      endpoint_type: embeddings
      provider_key_ref: openai_api_key_ref
    policy:
      max_tokens_in: 8000
      max_tokens_out: 0
      budget_daily_usd: 2.0
      drift_strict: true
      drift_detection:
        sensitivity: high
      redaction:
        mode: block
        patterns: ["email", "api_key", "ip", "phone"]
```

### Local provider route

```yaml
routes:
  - name: local
    tenant: default
    provider:
      type: local
      model: deepseek-r1:8b
      endpoint_type: chat_completions
      endpoint: https://example.local/v1/chat/completions
      default_params:
        temperature: 0.5
    policy:
      max_tokens_in: 4000
      max_tokens_out: 4000
      budget_daily_usd: 2.0
      drift_strict: true
      redaction:
        mode: warn
        patterns: ["email", "api_key", "ip", "phone"]
```

---

## Notes

- Keep names/labels simple; they are used by services, routing, and caching.
- Prefer `ENV:VARNAME` when you want explicit env var wiring; otherwise the implicit resolution works well for conventional names like `openai_api_key_ref` → `OPENAI_API_KEY` or `PARAPET_OPENAI_API_KEY`.
- When enabling caching, confirm your provider params are safe to coalesce across requests; otherwise set `include_params: true` (default) so parameter differences affect the cache key.


