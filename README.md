# Parapet

Parapet splits into a CLI (config build) and a runtime (policy enforcement/gateway).

### Layout
- `src/config/`
  - `spec/` types + validation
  - `hydration/` hydrated types + ref resolution
  - `io/` YAML parsing
  - `crypto/` blob encode/decode + checksum
  - `constants.ts`
- `src/cli/` CLI entry and commands
- `src/runtime/`
  - `core/` entry, state, types, provider router
  - `http/` server, handlers, admin API
  - `security/` auth, redaction, drift
  - `policy/` policy and budget
  - `telemetry/` buffer, writer, store, replay
  - `util/` log, timeWindow, cost
- `src/providers/` provider adapter stubs

### Getting started
1) Install deps: `npm install`
2) Build TypeScript: `npm run build`
3) Build a config blob and start the runtime

Workflow:
- Write `parapet.yaml` (commit to git; secrets only as *_ref strings). See `parapet.yaml.example` for structure.
- Run: `npm run parapet -- build-config --config ./parapet.yaml --out ./parapet_env.txt`
- The CLI prints two lines and optionally writes them to `--out`:
  - `PARAPET_MASTER_KEY=...`
  - `PARAPET_BOOTSTRAP_STATE=...`
- Inject those two values as env vars in your deployment.
- Deploy the runtime container (built from `Dockerfile.runtime`) with a persistent volume mounted at `/data`.

Notes:
- The CLI makes no network calls and does not depend on runtime code.
- The runtime container does NOT ship the CLI.

### Runtime data persistence (/data)

- The runtime now persists telemetry to SQLite at `/data/parapet-telemetry.db`.
- `/data` must exist and be writable at boot; otherwise startup fails with: "/data is required; mount a persistent volume".
- On startup, Parapet replays today's telemetry to seed in-memory budget counters. If you redeploy without reattaching the same volume, Parapet will boot but think today's budget usage is 0 until new traffic arrives.
- Telemetry is append-only and flushed in small batches (~100ms). A hard kill can drop the last few milliseconds of events.

Docker example with a persistent volume:

```
docker build -f Dockerfile.runtime -t parapet-runtime:dev .
docker run --rm -p 8000:8000 -v parapet-data:/data parapet-runtime:dev
```

### Perimeter request flow

- Caller sends `POST /:routeName` with header `X-Parapet-Service-Key: <token>` and JSON body:
  - Chat completions: `{ "messages": [{"role": "user", "content": "..."}], ...params }`
  - Embeddings: `{ "input": "text" | ["text1", "text2"], ...params }`
- Runtime gates in order:
  1. Auth: token → service context (tenant, allowed routes)
  2. Route access: service must be allowed for `:routeName`
  3. Token limits: prompt tokens ≤ `route.policy.max_tokens_in`, output cap `max_tokens_out`
  4. Drift: if `route.policy.drift_strict`, provider+model must match hydrated config
  5. Redaction: regex-based; mode `warn` scrubs and continues, `block` rejects, `off` no-op
  6. Cost estimate: deterministic per provider/model
  7. Budget: per-tenant and per-route daily caps, best-effort in-memory with telemetry replay on boot

Responses:
- Blocked: 4xx JSON `{ statusCode: 400, error: <reason> }` (e.g., unauthorized, not_allowed, budget_exceeded, drift_violation, redaction_blocked)
- Allowed: 200 JSON `{ statusCode: 200, data: { output: string | number[][], decision: {...} } }`
- Streaming: 200 with `Content-Type: text/event-stream` when `stream: true` in request

Provider keys are never exposed to callers; they are stored in-memory and used only by the runtime when invoking the provider adapter.

All calls (allowed or blocked) are recorded to telemetry and flushed to `/data`. On restart with the same `/data` volume, budget counters are rebuilt for today from telemetry.

### Request Parameters

Routes can define `default_params` in `parapet.yaml`. These defaults can be overridden per-request:

```yaml
provider:
  default_params:
    temperature: 0.7
    top_p: 0.9
```

Common parameters (provider-dependent):
- `temperature` (0-2 for OpenAI, 0-1 for Anthropic): Controls randomness
- `max_tokens`: Maximum tokens to generate (capped by route policy)
- `top_p` (0-1): Nucleus sampling
- `frequency_penalty` (-2 to 2, OpenAI only): Reduce repetition
- `presence_penalty` (-2 to 2, OpenAI only): Encourage new topics
- `stop` / `stop_sequences`: Stop sequences
- `top_k` (Anthropic only): Top-k sampling
- `stream` (boolean): Enable streaming responses

Request parameters override route defaults. Route `max_tokens_out` policy always caps the effective `max_tokens` value.

### Example Requests

#### Chat Completions

Basic request using route defaults:

```bash
curl -X POST http://localhost:8000/openai \
  -H "Content-Type: application/json" \
  -H "X-Parapet-Service-Key: <your-service-token>" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

Request with parameter overrides:

```bash
curl -X POST http://localhost:8000/openai \
  -H "Content-Type: application/json" \
  -H "X-Parapet-Service-Key: <your-service-token>" \
  -d '{
    "messages": [
      {"role": "user", "content": "Write a story"}
    ],
    "temperature": 0.9,
    "max_tokens": 500,
    "top_p": 0.95
  }'
```

Streaming request:

```bash
curl -X POST http://localhost:8000/openai \
  -H "Content-Type: application/json" \
  -H "X-Parapet-Service-Key: <your-service-token>" \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ],
    "stream": true
  }'
```

#### Embeddings

```bash
curl -X POST http://localhost:8000/embeddings \
  -H "Content-Type: application/json" \
  -H "X-Parapet-Service-Key: <your-service-token>" \
  -d '{
    "input": "The food was delicious"
  }'
```

Multiple inputs:

```bash
curl -X POST http://localhost:8000/embeddings \
  -H "Content-Type: application/json" \
  -H "X-Parapet-Service-Key: <your-service-token>" \
  -d '{
    "input": [
      "The food was delicious",
      "The service was excellent"
    ]
  }'
```

#### Local Provider

```bash
curl -X POST http://localhost:8000/local \
  -H "Content-Type: application/json" \
  -H "X-Parapet-Service-Key: <your-service-token>" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.3
  }'
```

### Response Format

Success response (200):
```json
{
  "statusCode": 200,
  "data": {
    "output": "response text or embeddings array",
    "decision": {
      "allowed": true,
      "routeMeta": {...},
      "budgetBeforeUsd": 0.05,
      "estCostUsd": 0.0001,
      ...
    }
  }
}
```

Error response (4xx):
```json
{
  "statusCode": 400,
  "error": "max_tokens_in_exceeded"
}
```