# Parapet

Parapet is an LLM API gateway that enforces security policies, tracks budgets, and provides observability for multi-tenant AI applications. It separates configuration building (CLI) from runtime enforcement, allowing secure deployment without exposing secrets or CLI tools in production.

## Architecture

### Workspace Structure
The repository uses npm workspaces to separate concerns:
- `apps/runtime/` - Runtime gateway application (API server, policy enforcement, telemetry)
- `apps/console/` - React-based admin console UI (Vite + TailwindCSS)
- Root `package.json` defines workspaces and shared dependencies

### Runtime Application (`apps/runtime/src/`)
- `config/`
  - `spec/` - TypeScript types and Zod validation for `parapet.yaml`
  - `hydration/` - Resolves `*_ref` placeholders and produces fully hydrated config
  - `io/` - YAML parsing utilities
  - `crypto/` - AES-256-GCM blob encryption/decryption, checksum computation
  - `constants.ts` - Built-in redaction rules and cost tables
- `cli/` - CLI entry and `build-config` command (not shipped in runtime container)
  - `commands/build-config.ts` - Reads `parapet.yaml`, hydrates secrets, encrypts config
  - `secretsources/` - Env-based and interactive prompt secret sources
  - `util/` - Wizard-style prompting, output formatting
- `runtime/`
  - `core/` - Entry point (`index.ts`), runtime state management, provider routing
  - `http/` - Fastify server, perimeter routes (`/:routeName`), admin console routes
  - `security/` - Session management (scrypt hashing, cookie-based auth), redaction (regex-based), drift detection (strict mode + anomaly detection)
  - `policy/` - Budget tracking (micro-dollar precision), policy enforcement
  - `telemetry/` - SQLite-backed event store, in-memory buffer, batch writer, replay on boot
  - `util/` - Cost estimation, logging, time-window utilities
  - `vault.ts` - In-memory secret storage for provider keys
- `providers/` - Provider adapters for OpenAI, Anthropic, local LLMs
  - Each adapter implements `ProviderAdapter` interface (`callLLM`)
  - `params.ts` - Parameter merging, validation, and `max_tokens` enforcement

### Admin Console (`apps/console/src/`)
- `App.tsx` - Single-page React dashboard showing:
  - Spend/Budget tables (per-tenant, per-route)
  - Blocked request summary (by block reason)
  - Config checksum verification
  - Recent telemetry events (configurable limit)
- `main.tsx` - React 18 entry point
- `index.css` - TailwindCSS utilities
- Built as static assets (`dist/app.js`, `dist/app.css`) and served from `/console/static/*`

## Getting Started

### Development Workflow
1. Install dependencies: `npm install` (installs all workspace dependencies)
2. Build TypeScript: `npm run build` (builds all workspaces in parallel)
3. Build config blob: `npm run parapet -- build-config --config ./parapet.yaml --out ./parapet_env.txt`
4. Start runtime locally: `npm run start:runtime` or `npm --workspace @parapetai/runtime run dev`

### Configuration Build Workflow
- Write `parapet.yaml` (commit to git; secrets referenced as `*_ref` strings)
- Run CLI: `npm run parapet -- build-config --config ./parapet.yaml --out ./parapet_env.txt`
- CLI outputs (to stdout and optionally to `--out` file):
  - `PARAPET_MASTER_KEY=...` (hex-encoded AES-256 key)
  - `PARAPET_BOOTSTRAP_STATE=...` (encrypted config blob: IV + ciphertext + auth tag)
  - `PARAPET_SERVICE_TOKEN_<LABEL>=...` (tokens for each service)
- Inject `PARAPET_MASTER_KEY` and `PARAPET_BOOTSTRAP_STATE` as env vars in deployment
- Runtime decrypts blob on boot using master key, hydrates in-memory state

### Deployment
- Build runtime image: `docker build -f Dockerfile.runtime -t parapet-runtime:dev .`
- Run with persistent volume: `docker run --rm -p 8000:8000 -v parapet-data:/data parapet-runtime:dev`
- Or use docker-compose: `npm run compose:up` (see `docker-compose.yml`)

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
docker run --rm -p 8000:8000 -v parapet-data:/data parapet-runtime:dev
```

## Perimeter Request Flow

### Request Format
Clients send `POST /:routeName` with:
- Header: `X-Parapet-Service-Key: <token>` (service auth token)
- JSON body:
  - Chat completions: `{ "messages": [{"role": "user", "content": "..."}], ...params }`
  - Embeddings: `{ "input": "text" | ["text1", "text2"], ...params }`

### Enforcement Pipeline (in order)
1. **Authentication** (`security/auth.ts`)
   - Validates `X-Parapet-Service-Key` against hydrated service records
   - Maps token → service context (tenant, allowed routes, label)
   
2. **Route Access Control** (`http/routes/index.ts`)
   - Checks if service is authorized for requested route name
   - Blocks with `not_allowed` if route not in service's `allowed_routes`
   
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
- **Blocked** (4xx): `{ statusCode: 400, error: "<reason>" }`
  - Reasons: `unauthorized`, `not_allowed`, `budget_exceeded`, `drift_violation`, `redaction_blocked`, `max_tokens_in_exceeded`, `max_tokens_out_exceeded`
- **Allowed** (200): 3rd party API response is passed through directly 
- **Streaming** (200): `Content-Type: text/event-stream` when `stream: true` in request
  - Streams provider chunks, finalizes cost at end, logs telemetry

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

**Anthropic** (chat_completions):
- `temperature` (0-1): Sampling randomness (different range than OpenAI)
- `max_tokens`: Required for Anthropic, capped by policy
- `top_p` (0-1): Nucleus sampling
- `top_k` (integer): Top-k sampling (Anthropic-specific)
- `stop_sequences`: Array of stop strings
- `stream` (boolean): Enable SSE streaming

**Local** (chat_completions):
- Accepts common params like `temperature`, `max_tokens`, `top_p`
- Proxied to local endpoint (e.g., Ollama at `http://localhost:11434/v1/chat/completions`)
- No cost tracking (zero-cost provider)

### Parameter Validation
Implemented in `providers/params.ts`:
- `validateParams(provider, endpointType, params)` - Returns `{valid: boolean, error?: string}`
- Checks required params (e.g., `max_tokens` for Anthropic)
- Validates ranges (e.g., `temperature` 0-1 for Anthropic, 0-2 for OpenAI)
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

## Admin Console

### Access and Authentication
- UI available at `/console` (requires session)
- Login at `/console/login` (username + password from `parapet.yaml` users)
- Session management:
  - Scrypt-based password hashing (salt + hash stored in-memory)
  - 12-hour session TTL
  - HttpOnly cookies (`parapet_session`), SameSite=Strict
  - Sessions stored in-memory (lost on restart)
- Logout: `POST /console/logout` clears session cookie

### Dashboard Features
Built as a single-page React app (`apps/console/src/App.tsx`):

1. **Spend / Budget Table**
   - Shows per-route and per-tenant spend for today (UTC)
   - Columns: Tenant, Route, Spent Today, Route Daily Cap, Tenant Daily Cap, Remaining Route Budget, Remaining Tenant Budget
   - Data source: `/console/data/usage` (queries telemetry store)

2. **Blocked Summary**
   - Counts blocked requests by reason (`budget_exceeded`, `not_allowed`, `drift_violation`, `redaction_blocked`)
   - Data source: `/console/data/blocked`

3. **Config Checksum**
   - Displays checksum of active hydrated config
   - Format: First 8 hex chars shown in header, full checksum in dedicated card
   - Use case: Verify all runtime instances use same config version
   - Data source: `/console/data/checksum`

4. **Recent Telemetry**
   - Table of last N events (default 100, configurable 25-1000)
   - Columns: Time, Tenant, Route, Service, Outcome (allowed/blocked), Cost (USD), Latency (ms)
   - Newest first (DESC order)
   - Data source: `/console/data/telemetry?limit=N`

### Static Asset Serving
- Console UI built to `apps/console/dist/` as `app.js` and `app.css`
- Dockerfile copies to `/app/console-static/`
- Runtime serves from `/console/static/:file` (requires session)
- HTML shell served at `/console` injects `<script>` and `<link>` tags

### Security Considerations
- All console routes protected by session check (401 if no session)
- No CORS headers (console is same-origin)
- No caching (`Cache-Control: no-store`)
- Password stored as scrypt hash, never plaintext in memory after hydration

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
  callLLM(input: LlmCallInput): Promise<LlmCallResult>;
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

interface LlmCallResult {
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
   - API: `https://api.openai.com/v1/...`
   - Supports streaming, all OpenAI-specific params
   - Returns `model` and `system_fingerprint` in metadata

2. **Anthropic** (`providers/anthropicProvider.ts`)
   - Endpoints: `chat_completions`
   - API: `https://api.anthropic.com/v1/messages`
   - Supports streaming, Anthropic-specific params (`top_k`)
   - Returns `model` in metadata

3. **Local** (`providers/localProvider.ts`)
   - Endpoints: `chat_completions`
   - Configurable endpoint (e.g., Ollama, LM Studio, vLLM)
   - Zero-cost provider (cost always 0.0)
   - Proxies to local OpenAI-compatible API

### Provider Routing
- `runtime/core/providerRouter.ts` dispatches calls to correct adapter
- Merges route defaults + request params
- Enforces `max_tokens` cap
- Validates params per provider type
- Estimates cost using `util/cost.ts` pricing tables

### Adding New Providers
1. Create adapter in `providers/<name>Provider.ts`
2. Implement `ProviderAdapter` interface
3. Add to registry in `providerRouter.ts`
4. Add cost tables to `config/constants.ts` (if not zero-cost)
5. Update `config/spec/types.ts` to include provider type in schema

## Build System

### Workspace Scripts
Root `package.json` defines workspace-level commands:
- `npm run build` - Builds all workspaces (`@parapetai/runtime`, `@parapetai/console`)
- `npm run dev` - Runs dev mode for all workspaces (parallel)
- `npm run parapet -- <args>` - Executes CLI from `@parapetai/runtime` workspace
- `npm run build:console:ws` - Builds only console workspace
- `npm run build:runtime:ws` - Builds only runtime workspace
- `npm run compose:up` - Starts docker-compose stack
- `npm run compose:down` - Stops docker-compose stack
- `npm run compose:logs` - Tails docker-compose logs

### Workspace Configuration
Each workspace has its own `package.json` with isolated dependencies:
- `apps/runtime/package.json` - No dependencies listed (inherits from root)
  - Scripts: `build` (tsc), `dev` (tsx), `cli` (tsx cli entry)
- `apps/console/package.json` - React, Vite, TailwindCSS
  - Scripts: `build` (vite build), `dev` (vite dev server)
- Root manages shared dependencies: `typescript`, `better-sqlite3`, `fastify`, `yaml`

### TypeScript Compilation
- Root `tsconfig.json` - Base config for all workspaces
- `apps/runtime/tsconfig.json` - Extends root, outputs to `apps/runtime/dist/`
  - Module resolution: Node16 ESM
  - Preserves JSX for React components (not used in runtime)
- `apps/console/tsconfig.json` - Extends root, used by Vite (no direct tsc build)
  - Vite handles TypeScript → JS transpilation

### Multi-Stage Docker Build (`Dockerfile.runtime`)
**Builder Stage:**
1. Install all dependencies (including dev deps for TypeScript)
2. Copy runtime sources (`apps/runtime/src`, `apps/runtime/tsconfig.json`)
3. Build runtime: `npm --workspace @parapetai/runtime run build`
   - Output: `apps/runtime/dist/runtime/`, `apps/runtime/dist/config/`, `apps/runtime/dist/providers/`
4. Copy console sources (`apps/console/`)
5. Build console: `npm run build --prefix apps/console`
   - Output: `apps/console/dist/` (app.js, app.css, assets/)

**Runtime Stage:**
1. Install only production dependencies (`npm ci --omit=dev`)
2. Copy runtime dist artifacts from builder (no source, no CLI)
3. Copy console static assets to `/app/console-static/`
4. Create `/data` volume mount point
5. Run as non-root user (`node`)
6. Entrypoint: `node dist/runtime/index.js`

**Key Decisions:**
- No TypeScript in runtime image (pre-compiled in builder)
- No CLI tools in runtime (only `dist/runtime/` copied, not `dist/cli/`)
- Native modules (`better-sqlite3`) compiled in builder, binaries copied to runtime
- Console UI pre-built, served as static files

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
- `users` (array) - Admin console users (username, password_ref, role)
- `services` (array) - Client service auth tokens and route permissions
- `routes` (array) - LLM routes with provider config and policies
- `secrets` (object) - Ref → value mappings (e.g., `my_ref: ENV:VAR_NAME` or `my_ref: PROMPT:description`)

### Secret References
- Format: `<key>_ref: <value>`
- All `*_ref` fields resolved during config hydration (in CLI)

### Route Policy Fields
- `max_tokens_in` - Maximum prompt tokens allowed
- `max_tokens_out` - Maximum completion tokens allowed (caps `max_tokens` param)
- `budget_daily_usd` - Daily spend cap for this route (UTC day boundary)
- `drift_strict` (boolean) - Block if request provider/model ≠ config
- `drift_detection` - Anomaly detection config (sensitivity: low/medium/high)
- `redaction` - Redaction config (mode: off/warn/block, patterns: array)

### Example Full Config
See `parapet.yaml` in repo root for reference configuration with:
- Multiple tenants and routes
- OpenAI, Anthropic, and local providers
- Redaction patterns and drift detection
- Admin users and service tokens
