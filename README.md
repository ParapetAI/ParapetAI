# ParapetAI

ParapetAI is an LLM API gateway that enforces policies, tracks budgets, and emits telemetry for multi-tenant AI apps. The runtime is an immutable container that consumes an encrypted configuration bootstrap built by a standalone CLI.

## Quickstart (internal)

- Create a `parapet.yaml` file
- Build the encrypted config locally (writes `.env` with required vars):

```bash
pnpm run parapet:build-config
```

- Pull and run the published Docker image from Docker Hub:

```bash
docker pull parapetai/parapetai-runtime:latest
docker run -p 8000:8000 -v parapet-data:/data --env-file .env parapetai/parapetai-runtime:latest
```

## Key features

- **OpenAI-compatible endpoints**: `/v1/chat/completions` (SSE streaming) and `/v1/embeddings`
- **Bearer auth** mapped to tenant and allowed routes
- **Policies**: token caps, model drift guard, regex redaction, daily budgets
- **Caching**: per-route LRU (opt-in), non-streaming only
- **Telemetry**: SQLite store + signed webhooks
- **Providers**: OpenAI and Local (OpenAI-compatible)

## Compatibility & scope

- Supported: OpenAI Chat Completions and Embeddings.
- Not implemented: Images/Audio/Assistants/Batches/Files, `Idempotency-Key`, `OpenAI-Organization`, rate limiting, circuit breaker, admin UI.

## API endpoints

### GET `/health`
- Returns runtime health for probes.

Response:

```json
{ "statusCode": 200, "data": { "isValid": true } }
```

### POST `/v1/chat/completions`
- Auth: `Authorization: Bearer <service_token>`
- Streaming: `text/event-stream` when `stream=true`
- Body:
  - `model` (string, required)
  - `messages` (array, required)
  - Additional OpenAI-style params are validated and forwarded if allowed
- Response:
  - Non-streaming: proxied OpenAI-compatible JSON
  - Streaming: SSE chunks
- Errors: OpenAI-style `{ "error": { message, type, code? } }`

### POST `/v1/embeddings`
- Auth: `Authorization: Bearer <service_token>`
- Body:
  - `model` (string, required)
  - `input` (string or string[], required)
  - Supported params: `dimensions`, `encoding_format`, `user`
- Response: OpenAI-style list with `data[].embedding` and `usage`

## Headers & auth

- Required: `Authorization: Bearer <service_token>`
- Parsed: `Authorization`
- Not parsed: `Idempotency-Key`, `OpenAI-Organization`, `OpenAI-Beta`, `X-Request-Id`

## Policies (enforcement points)

- Model routing (drift guard): exact `model` match within the caller’s `allowed_routes`; otherwise `drift_violation`.
- Token limits: `max_tokens_in` validated; `max_tokens` capped to `max_tokens_out`.
- Redaction: `warn` scrubs secrets; `block` rejects the request.
- Costing & budgets: deterministic pre-call estimate; per-tenant and per-route caps with micro-dollar accounting; finalize to actuals post-call.
- Drift detection (observability): records model mismatches, system fingerprint changes, and cost anomalies over threshold.

## Caching

- Scope: Per-route LRU; opt-in via config.
- Defaults: `ttl_ms=30000`, `max_entries=5000`, `include_params=true`.
- Key: route + endpoint_type + model + sanitized payload (+ params when enabled) + redaction_mode.
- Exclusions: Streaming responses are not cached.

## Telemetry & webhooks

- Store: SQLite at `/data/parapet-telemetry.db` with ~100ms buffered writes.
- Fields: tenant, route, service_label, allowed/blocked, reasons, redaction_applied, drift flags, budget_before_usd, (est/final) costs, tokens, latency_ms, retry_count, cache_hit, checksum.
- Webhooks: HMAC-SHA256 over raw JSON body with header `X-Parapet-Signature: sha256=<hex>`.
- Events emitted: `policy_decision`, `provider_error` (config supports `request_error`, not emitted today).

Webhook verification example (Node.js):

```javascript
import crypto from "node:crypto";

export function verifyParapetSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const received = signatureHeader.slice("sha256=".length);
  const expected = crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}
```

## Error shape (example)

Example for invalid/missing Parapet token:

```json
{
  "error": {
    "message": "Invalid ParapetAI API key in Authorization header.",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

## Configuration & CLI

- YAML schema (high level):
  - `tenants[]`: `{ name, spend: { daily_usd_cap } }`
  - `routes[]`: `{ name, tenant, provider: { type: openai|local, model, endpoint_type? (chat_completions|embeddings), provider_key_ref?, endpoint?, default_params? }, policy?: { max_tokens_in, max_tokens_out, budget_daily_usd, drift_strict, drift_detection?: { enabled?, sensitivity?, cost_anomaly_threshold? }, redaction: { mode: warn|block|off, patterns[] } }, retries?, cache?, webhook? }`
  - `services[]`: `{ label, tenant, allowed_routes[], parapet_token_ref }`
- CLI builds an encrypted bootstrap and prints env vars. Example:
  - `npx @parapetai/cli build-config --file parapet.yaml`
  - Outputs: `PARAPET_MASTER_KEY=...` and `PARAPET_BOOTSTRAP_STATE=...` (plus service tokens)
- Required runtime envs: `PARAPET_MASTER_KEY`, `PARAPET_BOOTSTRAP_STATE`
- Optional: `PORT` (defaults to `8000`)

## Configuration YAML (layout, options, minimums)

- **Top-level**: `version`, `tenants[]`, `routes[]`, `services[]`.
- **Minimum viable config** (single tenant, one chat route, one service):

```yaml
version: 1

tenants:
  - name: acme
    spend:
      daily_usd_cap: 50

routes:
  - name: acme-chat
    tenant: acme
    provider:
      type: openai            # or "local"
      model: gpt-4o-mini
      endpoint: https://api.openai.com/v1
      provider_key_ref: ENV:OPENAI_API_KEY

services:
  - label: myapp
    tenant: acme
    allowed_routes: [acme-chat]
    parapet_token_ref: ENV:PARAPET_SERVICE_MYAPP_TOKEN
```

- **Providers**:
  - `openai`: requires `model`, `endpoint` (base or full), and `provider_key_ref`.
  - `local`: requires `model` and `endpoint`; no provider key required.
  - Optional `default_params` are merged with request params (request wins) and validated per endpoint.
- **Endpoints**:
  - Default is `chat_completions`.
  - Use `endpoint_type: embeddings` for embeddings routes.
- **Policy** (optional): `max_tokens_in`, `max_tokens_out`, `budget_daily_usd`, `drift_strict`, `drift_detection { enabled, sensitivity, cost_anomaly_threshold }`, `redaction { mode, patterns[] }`.
- **Retries** (optional): `{ max_attempts, base_ms, jitter, retry_on[], max_elapsed_ms }`.
- **Cache** (optional): `{ enabled, mode: exact, ttl_ms, max_entries, include_params }`.
- **Webhook** (optional): `{ url, secret_ref, include_prompt_snippet, events { policy_decisions, request_errors, provider_errors } }`.
- **Services**: each service maps a `parapet_token_ref` to a tenant and a set of `allowed_routes`.

## Build-config output and runtime env injection

- The CLI encrypts the hydrated config with AES-256-GCM and prints two env vars:
  - `PARAPET_MASTER_KEY`
  - `PARAPET_BOOTSTRAP_STATE`
- Both must be injected into the runtime container’s environment. Example:

```bash
docker run -p 8000:8000 -v parapet-data:/data \
  -e PARAPET_MASTER_KEY=... \
  -e PARAPET_BOOTSTRAP_STATE=... \
  parapet-runtime:dev
```

- The CLI also prints service tokens (e.g., `PARAPET_SERVICE_<LABEL>_TOKEN`) for clients to use as `Authorization: Bearer ...`; these are not required by the runtime container itself.

## Deployment

- Container: exposes `8000`; runs as non-root; requires writable `/data` volume.
- Health: `GET /health` → `{ isValid: true }`.
- Env: set `PARAPET_MASTER_KEY` and `PARAPET_BOOTSTRAP_STATE` at startup.

## Known limitations

- No rate limiting or circuit breaker.
- No admin UI; configuration is immutable at runtime.
- No support for OpenAI Images/Audio/Assistants/Batches/Files.
- No request idempotency (`Idempotency-Key` not parsed).
- `request_error` webhook type is not emitted.

## Security contact

If you believe you’ve found a security issue, please open a private issue or contact the maintainers.
