# ParapetAI

ParapetAI is an LLM API gateway that enforces security policies, tracks budgets, and provides observability for multi-tenant AI applications. It separates configuration building (CLI) from runtime enforcement, allowing secure deployment without exposing secrets or CLI tools in production.

> Important: The runtime container is immutable and has no in-box admin UI. All configuration changes are made via the standalone CLI, which builds an encrypted bootstrap. To update config: edit `parapet.yaml` → run the CLI `build-config` → redeploy with the two output env vars.

## Architecture

### Workspace Structure
The repository uses pnpm workspaces to separate concerns:
- `apps/runtime/` - Runtime gateway application (API server, policy enforcement, telemetry)
- `packages/cli/` - Standalone CLI package for building encrypted config blobs (published as `@parapetai/cli`)
- `libs/config-core/` - Shared configuration library (YAML parsing, validation, encryption/decryption, secret resolution)
- Root `package.json` defines workspaces and shared dependencies

### Runtime Application (`apps/runtime/src/`)
- **No CLI code in runtime**: CLI has moved to a standalone package (`packages/cli`) and is not shipped with the runtime
- `runtime/`
  - `core/` - Entry point (`index.ts`), runtime state management, provider routing
  - `http/` - Fastify server with OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/embeddings`)
  - `security/` - Authentication (Bearer token validation), redaction (regex-based), drift detection (strict mode + anomaly detection)
  - `policy/` - Budget tracking (micro-dollar precision), policy enforcement
  - `telemetry/` - SQLite-backed event store, in-memory buffer, batch writer, replay on boot
  - `util/` - Cost estimation, logging, time-window utilities, webhook event queuing
  - `vault.ts` - In-memory secret storage for provider keys
- `providers/` - Provider adapters
  - Each adapter implements `ProviderAdapter` interface (`callLLM`)
  - `openaiProvider.ts` - OpenAI API adapter (chat_completions, embeddings)
  - `localProvider.ts` - Local/self-hosted LLM adapter (chat_completions only, OpenAI-compatible API)
  - `params.ts` - Parameter merging, validation, and `max_tokens` enforcement
  - `types.ts` - Provider adapter interfaces

### Configuration Library (`libs/config-core/src/`)
Shared library used by both CLI and runtime:
- `spec/` - TypeScript types and Zod validation for `parapet.yaml` schema
- `hydration/` - Resolves `*_ref` placeholders and produces fully hydrated config
- `io/` - YAML parsing utilities
- `crypto/` - AES-256-GCM blob encryption/decryption, checksum computation
- `constants.ts` - Built-in redaction patterns and cost tables

### CLI Package (`packages/cli/src/`)
Standalone CLI published as `@parapetai/cli`:
- `commands/build-config.ts` - Main command that validates YAML, resolves secrets, encrypts config
- `secretsources/` - Secret resolution sources (environment variables, interactive prompts)
- Uses `@parapetai/config-core` library for shared functionality

### Observability
Budget governance and routing are controlled offline via the CLI; observability is emitted via:
- **Webhooks**: Configurable per-route webhook URLs that receive audit events (policy decisions, request errors, provider errors)
- **Telemetry SQLite store**: Persistent event log at `/data/parapet-telemetry.db` with full request metadata

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm (enabled via corepack)

### Development Workflow
1. Install dependencies: `pnpm install` (installs all workspace dependencies)
2. Build TypeScript: `pnpm run build` (builds all workspaces in parallel)
3. Build config blob (CLI): `pnpm --filter @parapetai/cli run build && node packages/cli/dist/main.js build-config --file ./parapet.yaml`
   - Or use published CLI: `npx @parapetai/cli build-config --file ./parapet.yaml`
4. Start runtime locally: `pnpm run start:runtime` or `pnpm --filter @parapetai/runtime run dev`

### Configuration Build Workflow
- Write `parapet.yaml` (commit to git; secrets referenced as `ENV:{NAME}` strings where applicable)
- Run CLI: `npx @parapetai/cli build-config --file ./parapet.yaml` (or use local build in this repo)
- CLI outputs env vars to stdout (or `--out` file):
  - `PARAPET_MASTER_KEY=...` (base64url-encoded 32-byte key)
  - `PARAPET_BOOTSTRAP_STATE=...` (AES-GCM encrypted config blob)
  - `PARAPET_BOOTSTRAP_VERSION=...` (schema version)
  - `PARAPET_BOOTSTRAP_TIMESTAMP=...` (ISO timestamp)
  - `PARAPET_SERVICE_<LABEL>_TOKEN=...` (one per service)
- Inject required vars as env vars in deployment; runtime decrypts and hydrates on boot

### CLI Options
- `-f, --file <path>` - Path to YAML config (default: `parapet.yaml`)
- `--non-interactive` - Fail instead of prompting for missing secrets
- `--silent` - Suppress non-error logs
- `-o, --out <path>` - Write env vars to file (e.g., `.env`)

### Deployment
- Build runtime image: `docker build -f Dockerfile.runtime -t parapet-runtime:dev .`
- Run with persistent volume: `docker run --rm -p 8000:8000 -v parapet-data:/data -e PARAPET_MASTER_KEY=... -e PARAPET_BOOTSTRAP_STATE=... parapet-runtime:dev`
- Or use docker-compose: `pnpm run compose:up` (see `docker-compose.yml`)

### Key Design Principles
- **CLI is stateless**: No network calls, no runtime dependencies. Builds encrypted config offline.
- **Runtime is sealed**: No CLI tools shipped. Decrypts config from env vars on boot.
- **Secrets never hit disk unencrypted**: Master key + blob are the only deployment secrets.
- **Telemetry drives budget**: SQLite at `/data/parapet-telemetry.db` is source of truth for spend tracking.

## Runtime Data Persistence (`/data`)

### Telemetry Storage
- Runtime persists all telemetry to SQLite at `/data/parapet-telemetry.db`
- Schema managed via migrations in `runtime/telemetry/migrations/`
  - `001_init.ts` creates `telemetry_events` table with columns: `ts`, `tenant`, `route`, `service_label`, `allowed`, `block_reason`, `redaction_applied`, `drift_strict`, `budget_before_usd`, `est_cost_usd`, `final_cost_usd`, `tokens_in`, `tokens_out`, `latency_ms`, `checksum_config`, `drift_detected`, `drift_reason`, `response_model`, `system_fingerprint`
- Writer (`runtime/telemetry/writer.ts`) batches events in-memory (~100ms window) then flushes to SQLite
- Store (`runtime/telemetry/store.ts`) provides query methods:
  - `loadTodayRows()` - All events since UTC midnight
  - `loadLastRows(limit)` - Most recent N events (DESC order)
  - `appendBatch(events)` - Transactional batch insert

### Budget Replay on Boot
- On startup, runtime calls `store.loadTodayRows()` to get all today's telemetry
- `budget.rebuildFromRows(rows)` reconstructs in-memory budget counters (tenant + route spend)
- Uses micro-dollar precision (1e-6 USD) to avoid floating-point drift
- If you redeploy without the same `/data` volume, budget counters reset to zero until new traffic arrives

### Volume Requirements
- `/data` must exist and be writable at boot (runtime checks and exits if not available)
- Append-only SQLite writes, no deletes or updates
- Hard kill can drop last ~100ms of buffered events (not yet flushed)
- Recommended: Use persistent Docker volumes or host mounts

### Example Docker Volume
```bash
docker build -f Dockerfile.runtime -t parapet-runtime:dev .
docker run --rm -p 8000:8000 -v parapet-data:/data -e PARAPET_MASTER_KEY=... -e PARAPET_BOOTSTRAP_STATE=... parapet-runtime:dev
```

## API Endpoints

### OpenAI-Compatible Interface
ParapetAI exposes OpenAI-compatible endpoints for seamless integration with existing OpenAI SDKs:

- `POST /v1/chat/completions` - Chat completions (routes configured with `endpoint_type: chat_completions`)
- `POST /v1/embeddings` - Embeddings (routes configured with `endpoint_type: embeddings`)
- `GET /health` - Health check endpoint

### Request Format
Clients send requests with OpenAI-compatible format:
- Header: `Authorization: Bearer <token>` (ParapetAI service token, not provider key)
- JSON body:
  - Chat completions: `{ "model": "<model>", "messages": [{"role": "user", "content": "..."}], ...params }`
  - Embeddings: `{ "model": "<model>", "input": "text" | ["text1", "text2"], ...params }`

**Important**: The `model` field in the request must match a route's configured model. ParapetAI uses the model name to select the appropriate route from the service's `allowed_routes`. If multiple routes expose the same model+endpoint_type, the CLI will reject the config during build.

### Enforcement Pipeline (in order)
1. **Authentication** (`security/auth.ts`)
   - Validates `Authorization: Bearer <token>` against hydrated service records
   - Maps token → service context (tenant, allowed routes, label)

2. **Route Selection** (`http/openaiUtil.ts`)
   - Selects route by matching request `model` field against service's `allowed_routes`
   - Route must have matching `endpoint_type` (chat_completions or embeddings)
   - Blocks with `drift_violation` if no matching route found

3. **Token Limits** (`policy/policy.ts`)
   - Enforces `route.policy.max_tokens_in` (prompt size)
   - Caps effective `max_tokens` parameter to `route.policy.max_tokens_out`
   - Blocks with `max_tokens_in_exceeded` or `max_tokens_out_exceeded`

4. **Drift Strict Mode** (`security/drift.ts`)
   - If `route.policy.drift_strict: true`, checks provider+model match hydrated config
   - Blocks with `drift_violation` if request specifies different provider or model

5. **Redaction** (`security/redaction.ts`)
   - Applies regex-based pattern matching to input
   - Built-in patterns: `email`, `api_key`, `ip`, `phone`
   - Custom patterns: `re:<regex>`, `/regex/flags`, or literal strings
   - Modes:
     - `off` - No redaction
     - `warn` - Scrubs matches with `[REDACTED]`, logs, continues
     - `block` - Rejects request with `redaction_blocked`

6. **Cost Estimation** (`util/cost.ts`)
   - Deterministic cost calculation per provider/model using token counts
   - Uses hardcoded pricing tables in `config/constants.ts`

7. **Budget Check** (`policy/budget.ts`)
   - Checks tenant daily cap and route daily cap
   - Reserves estimated cost atomically in micro-dollar precision
   - Blocks with `budget_exceeded` if either cap would be exceeded
   - On success, reserves cost before provider call
   - After provider response, adjusts with actual token-based cost via `finalize()`

### Response Formats
- **Blocked** (4xx): OpenAI-compatible error format
  ```json
  {
    "error": {
      "message": "...",
      "type": "invalid_request_error",
      "code": "<error_code>"
    }
  }
  ```
  Error codes: `invalid_api_key`, `invalid_body`, `unknown_route`, `drift_violation`, `insufficient_permissions`, `budget_exceeded`, `max_tokens_in_exceeded`, `redaction_blocked`, `server_error`
- **Allowed** (200): Provider response passed through directly (OpenAI-compatible format)
- **Streaming** (200): `Content-Type: text/event-stream` when `stream: true` in request
  - Streams provider SSE chunks, finalizes cost at end, logs telemetry

### Security Guarantees
- Provider API keys never exposed to clients (stored in-memory in runtime vault)
- All requests (allowed + blocked) logged to telemetry with full context
- Budget counters rebuilt from telemetry on restart (no persistent state except SQLite)

## Request Parameters

### Parameter Merging Strategy
Routes define `default_params` in `parapet.yaml` (e.g., `temperature: 0.7`). Per-request params override route defaults. The runtime enforces:
1. Route defaults merged with request params (request wins)
2. `max_tokens` capped by `route.policy.max_tokens_out`
3. Parameter validation per provider type

### Provider-Specific Parameters
**OpenAI** (chat_completions, embeddings):
- `temperature` (0-2): Sampling randomness
- `max_tokens`: Token generation limit (capped by policy)
- `top_p` (0-1): Nucleus sampling threshold
- `frequency_penalty` (-2 to 2): Penalizes token frequency
- `presence_penalty` (-2 to 2): Penalizes token presence
- `stop`: Array of stop sequences
- `stream` (boolean): Enable SSE streaming
- `n` (integer): Number of completions to generate

**Local** (chat_completions):
- Accepts common params like `temperature`, `max_tokens`, `top_p`
- Proxied to local endpoint (e.g., Ollama at `http://localhost:11434/v1/chat/completions`)
- No cost tracking (zero-cost provider)

### Parameter Validation
Implemented in `providers/params.ts`:
- `validateParams(provider, endpointType, params)` - Returns `{valid: boolean, error?: string}`
- OpenAI-style parameter ranges enforced; local treated the same
- Enforces type constraints (numbers, strings, arrays)

### Example: Parameter Override
```yaml
# parapet.yaml
routes:
  - name: openai
    provider:
      default_params:
        temperature: 0.7
        top_p: 0.9
    policy:
      max_tokens_out: 4000
```

Request with override:
```json
{
  "model": "gpt-4o-mini",
  "messages": [{"role": "user", "content": "Hello"}],
  "temperature": 0.9,
  "max_tokens": 500
}
```
Effective params: `{ temperature: 0.9, top_p: 0.9, max_tokens: 500 }` (request `temperature` overrides default, `top_p` uses default, `max_tokens` is within policy cap)

### Example Requests

#### Chat Completions

Basic request using route defaults:
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-service-token>" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

Request with parameter overrides:
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-service-token>" \
  -d '{
    "model": "gpt-4o-mini",
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
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-service-token>" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ],
    "stream": true
  }'
```

#### Embeddings

```bash
curl -X POST http://localhost:8000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-service-token>" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "The food was delicious"
  }'
```

Multiple inputs:
```bash
curl -X POST http://localhost:8000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-service-token>" \
  -d '{
    "model": "text-embedding-3-small",
    "input": [
      "The food was delicious",
      "The service was excellent"
    ]
  }'
```

#### Local Provider

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-service-token>" \
  -d '{
    "model": "llama3",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.3
  }'
```

## Webhooks

ParapetAI can emit webhook events for audit and observability. Configured per-route in `parapet.yaml`:

```yaml
routes:
  - name: openai
    webhook:
      url: "https://audit.internal/parapet-events"
      secret_ref: webhook_secret_ref
      include_prompt_snippet: false
      events:
        policy_decisions: true
        request_errors: true
        provider_errors: true
```

### Webhook Event Types
- **policy_decision**: Emitted when a request is allowed or blocked by policy (budget, redaction, drift, etc.)
- **request_error**: Emitted when a request has invalid format or missing required fields
- **provider_error**: Emitted when the upstream provider returns an error

### Webhook Payload Format
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "tenant": "default",
  "route": "openai",
  "model": "gpt-4o-mini",
  "decision": "allow",
  "reason_if_blocked": null,
  "estimated_cost_usd": 0.0001,
  "actual_cost_usd": 0.0001,
  "budget_daily_usd": 2.0,
  "budget_spend_today_usd": 0.5,
  "tenant_budget_daily_usd": 5.0,
  "tenant_budget_spend_today_usd": 1.2,
  "redaction_mode": "block",
  "drift_strict": true,
  "prompt_excerpt": ""
}
```

### Webhook Security
- Webhooks are signed with HMAC-SHA256 using the configured secret
- Signature header: `X-Parapet-Signature: sha256=<hex>`
- Fire-and-forget delivery (async, non-blocking)
- Failures are logged but do not affect request processing

### Implementation
- Webhook events are queued off the hot path (`runtime/util/webhook.ts`)
- Events are emitted asynchronously using `setImmediate` to avoid blocking requests
- Prompt excerpts (first 80 chars) included only if `include_prompt_snippet: true`

## Drift Detection

### Two-Layer Approach
1. **Drift Strict Mode** (`policy.drift_strict: true`)
   - Pre-flight check before provider call
   - Blocks if request specifies provider or model different from config
   - Use case: Prevent shadow AI usage, enforce specific model versions
   - Configured per-route in `parapet.yaml`

2. **Drift Anomaly Detection** (`policy.drift_detection`)
   - Post-flight analysis after provider response
   - Does NOT block requests (observability only)
   - Logs to telemetry with `drift_detected: true` and `drift_reason`
   - Detection signals:
     - **Model mismatch**: Response metadata `model` ≠ expected model
     - **System fingerprint change**: Provider's `system_fingerprint` changed from baseline
     - **Cost anomaly**: Actual cost deviates from expected by > threshold percentage
   - Sensitivity levels (cost anomaly threshold):
     - `low`: 25% deviation
     - `medium`: 15% deviation
     - `high`: 10% deviation

### Drift Baseline Tracking
- Runtime maintains in-memory baseline per route:
  - `lastSystemFingerprint` - Most recent fingerprint seen
  - `sampleCount` - Number of responses processed
- Baseline updates after each successful call
- Used to detect fingerprint changes (e.g., provider deployed new model build)

### Configuration Example
```yaml
routes:
  - name: openai
    policy:
      drift_strict: true  # Block non-matching provider/model
      drift_detection:
        sensitivity: medium  # 15% cost threshold
```

### Telemetry Fields
- `drift_detected` (boolean) - True if any anomaly detected
- `drift_reason` (string) - e.g., `"model_mismatch:gpt-4"`, `"fingerprint_changed:abc123"`, `"cost_anomaly:18.3%"`
- `response_model` (string) - Model name from provider response
- `system_fingerprint` (string) - Provider-specific fingerprint

## Provider System

### Adapter Interface
All providers implement `ProviderAdapter` interface (`providers/types.ts`):
```typescript
interface ProviderAdapter {
  name: string;
  callLLM(input: LlmCallInput): Promise<LlmCallOutput>;
}

interface LlmCallInput {
  endpointType: "chat_completions" | "embeddings";
  model: string;
  apiKey: string;
  endpoint?: string;
  messages?: Array<{ role: string; content: string }>;
  input?: string | string[];
  params: Record<string, unknown>;
  stream?: boolean;
}

interface LlmCallOutput {
  output: unknown;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  stream?: ReadableStream;
  metadata?: { model?: string; systemFingerprint?: string };
}
```

### Built-in Providers
1. **OpenAI** (`providers/openaiProvider.ts`)
   - Endpoints: `chat_completions`, `embeddings`
   - API: `https://api.openai.com/v1/...` (or custom endpoint via `endpoint` param)
   - Supports streaming, all OpenAI-specific params
   - Returns `model` and `system_fingerprint` in metadata

2. **Local** (`providers/localProvider.ts`)
   - Endpoints: `chat_completions` only
   - Configurable endpoint (e.g., Ollama, LM Studio, vLLM)
   - Zero-cost provider (cost always 0.0)
   - Proxies to local OpenAI-compatible API
   - Requires `endpoint` configured in route provider settings

### Provider Routing
- `runtime/core/providerRouter.ts` dispatches calls to correct adapter
- Registry maps provider type → adapter implementation
- Merges route defaults + request params
- Enforces `max_tokens` cap
- Validates params per provider type
- Estimates cost using `util/cost.ts` pricing tables

### Adding New Providers
1. Create adapter in `apps/runtime/src/providers/<name>Provider.ts`
2. Implement `ProviderAdapter` interface (export named adapter with `name` property)
3. Add to registry in `providerRouter.ts`: `registry[<type>] = <adapter>`
4. Add cost tables to `libs/config-core/src/constants.ts` (if not zero-cost)
5. Update `libs/config-core/src/spec/types.ts` to include provider type in `ProviderType` union

## Build System

### Workspace Scripts
Root `package.json` defines workspace-level commands:
- `pnpm run build` - Builds all workspaces in parallel
- `pnpm run start:runtime` - Runs dev mode for runtime (`pnpm --filter @parapetai/runtime run dev`)
- `pnpm run build:runtime:ws` - Builds only runtime workspace
- `pnpm run compose:up` - Starts docker-compose stack
- `pnpm run compose:down` - Stops docker-compose stack
- `pnpm run compose:logs` - Tails docker-compose logs
- `pnpm run compose:ps` - Shows docker-compose service status

### Workspace Configuration
Each workspace has its own `package.json` with isolated dependencies:
- `apps/runtime/package.json` - Runtime application (no dependencies listed, inherits from root)
  - Scripts: `build` (tsc), `dev` (tsx runtime entry), `cli` (tsx cli entry - deprecated, use packages/cli)
- `packages/cli/package.json` - CLI package (depends on `@parapetai/config-core`, `commander`, `inquirer`)
  - Scripts: `build` (tsc), `dev` (ts-node), `clean` (rimraf dist)
- `libs/config-core/package.json` - Config library (no runtime dependencies, only TypeScript)
  - Scripts: `build` (tsc), `clean` (rimraf dist)
- Root manages shared dependencies: `typescript`, `better-sqlite3`, `fastify`, `yaml`, `tsx`

### TypeScript Compilation
- Root `tsconfig.json` - Base config for all workspaces
- `apps/runtime/tsconfig.json` - Extends root, outputs to `apps/runtime/dist/`
  - Module resolution: Node16 ESM
- `packages/cli/tsconfig.json` - Extends root, outputs to `packages/cli/dist/`
- `libs/config-core/tsconfig.json` - Extends root, outputs to `libs/config-core/dist/`

### Multi-Stage Docker Build (`Dockerfile.runtime`)
**Builder Stage:**
1. Install all dependencies (including dev deps for TypeScript)
2. Copy workspace manifests (`package.json`, `tsconfig.json`) and sources
3. Build shared library: `pnpm --filter @parapetai/config-core... run build`
4. Build runtime: `pnpm --filter @parapetai/runtime... run build`
   - Output: `apps/runtime/dist/runtime/`, `apps/runtime/dist/config/`, `apps/runtime/dist/providers/`
5. Ensure native bindings are built (`better-sqlite3`)
6. Prune dev dependencies

**Runtime Stage:**
1. Install only production dependencies (`npm ci --omit=dev` equivalent)
2. Copy runtime dist artifacts from builder (no source, no CLI)
3. Create `/data` volume mount point
4. Run as non-root user (`node`)
5. Entrypoint: `node dist/runtime/index.js`

**Key Decisions:**
- No TypeScript in runtime image (pre-compiled in builder)
- No CLI tools in runtime (only `dist/runtime/` copied, not `dist/cli/`)
- Native modules (`better-sqlite3`) compiled in builder, binaries copied to runtime
- Uses pnpm workspaces for dependency management

### Docker Compose Stack (`docker-compose.yml`)
- Single service: `runtime`
- Named volume: `parapet-data` (persists telemetry SQLite DB)
- Env file: `.env` (must contain `PARAPET_MASTER_KEY`, `PARAPET_BOOTSTRAP_STATE`)
- Port mapping: `8000:8000`
- Restart policy: `unless-stopped`
- Auto-rebuild on compose up: `docker compose up -d --build`

## Configuration Schema

### Top-Level Fields (`parapet.yaml`)
- `version` (number) - Schema version (currently 1)
- `tenants` (array) - Tenant definitions with spend caps
- `services` (array) - Client service auth tokens and route permissions
- `routes` (array) - LLM routes with provider config and policies
- `secrets` (object, optional) - Ref → value mappings (e.g., `my_ref: ENV:VAR_NAME` or `my_ref: PROMPT:description`)

### Secret References
- Format: `<key>_ref: <value>`
- All `*_ref` fields resolved during config hydration (in CLI)
- Supported resolution sources:
  - `ENV:VAR_NAME` - Resolve from environment variable
  - `PROMPT:description` - Prompt interactively (if `--non-interactive` not set)
  - Direct value (fallback for non-sensitive config)

### Route Policy Fields
- `max_tokens_in` - Maximum prompt tokens allowed
- `max_tokens_out` - Maximum completion tokens allowed (caps `max_tokens` param)
- `budget_daily_usd` - Daily spend cap for this route (UTC day boundary)
- `drift_strict` (boolean) - Block if request provider/model ≠ config
- `drift_detection` - Anomaly detection config (sensitivity: low/medium/high, optional `cost_anomaly_threshold`)
- `redaction` - Redaction config (mode: off/warn/block, patterns: array)
- `webhook` (optional) - Webhook config (url, secret_ref, include_prompt_snippet, events)

### Route Provider Fields
- `type` - Provider type: `"openai"` | `"local"`
- `model` - Model identifier (must be unique per endpoint_type within a service's allowed_routes)
- `endpoint_type` - Endpoint type: `"chat_completions"` | `"embeddings"` (default: `"chat_completions"`)
- `provider_key_ref` - Secret ref for provider API key (required for `openai`, not used for `local`)
- `endpoint` - Custom endpoint URL (optional for `openai`, required for `local`)
- `default_params` - Route-level parameter defaults

### Example Full Config
See `parapet.yaml` in repo root for reference configuration with:
- Multiple tenants and routes
- OpenAI and local providers
- Redaction patterns and drift detection
- Webhook configuration
- Service tokens

## Development Tips

### Adding a New Provider
1. Create `apps/runtime/src/providers/<name>Provider.ts`
2. Implement `ProviderAdapter` interface
3. Register in `apps/runtime/src/runtime/core/providerRouter.ts`
4. Add provider type to `libs/config-core/src/spec/types.ts` (`ProviderType` union)
5. Add cost tables to `libs/config-core/src/constants.ts` (if not zero-cost)
6. Update validation in `libs/config-core/src/spec/validate.ts` if needed

### Adding a New Endpoint Type
1. Add endpoint type to `libs/config-core/src/spec/types.ts` (`EndpointType` union)
2. Add endpoint type to `apps/runtime/src/providers/types.ts` (`EndpointType` union)
3. Update provider adapters to support the new endpoint type
4. Add HTTP route handler in `apps/runtime/src/runtime/http/` (see `completions/index.ts` or `embeddings/index.ts`)
5. Register route in `apps/runtime/src/runtime/http/server.ts`

### Modifying the Config Schema
1. Update types in `libs/config-core/src/spec/types.ts`
2. Update Zod schema in `libs/config-core/src/spec/schema.ts`
3. Update validation in `libs/config-core/src/spec/validate.ts`
4. Update hydration logic in `libs/config-core/src/hydration/resolveRefs.ts` if new `*_ref` fields are added
5. Update runtime types in `libs/config-core/src/hydration/hydratedTypes.ts` if needed

### Debugging Runtime Issues
- Runtime logs to stdout/stderr
- Check telemetry DB: `sqlite3 /data/parapet-telemetry.db "SELECT * FROM telemetry_events ORDER BY ts DESC LIMIT 10"`
- Check config checksum at boot (logged on startup)
- Use `apps/runtime/scripts/decrypt-bootstrap.ts` to inspect bootstrap state (requires master key)

### Working with the CLI
- CLI can be run locally during development: `pnpm --filter @parapetai/cli run build && node packages/cli/dist/main.js build-config --file ./parapet.yaml`
- For CI/CD, use published package: `npx @parapetai/cli build-config --file ./parapet.yaml --non-interactive`
- CLI outputs service tokens as additional env vars: `PARAPET_SERVICE_<LABEL>_TOKEN=...`
- Use `--out` flag to write to a file instead of stdout
