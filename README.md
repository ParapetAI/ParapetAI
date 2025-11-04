# ParapetAI

ParapetAI is an LLM API gateway that enforces security policies, tracks budgets, and provides observability for multi-tenant AI applications. It separates configuration building (CLI) from runtime enforcement, allowing secure deployment without exposing secrets or CLI tools in production.

> **Important**: The runtime container is immutable and has no in-box admin UI. All configuration changes are made via the standalone CLI, which builds an encrypted bootstrap. To update config: edit `parapet.yaml` → run the CLI `build-config` → redeploy with the two output env vars.

## Project Structure

This is a pnpm monorepo organized into three workspaces:

- **`apps/runtime/`** - Runtime gateway application (API server, policy enforcement, telemetry)
- **`packages/cli/`** - Standalone CLI package for building encrypted config blobs (published as `@parapetai/cli`)
- **`libs/config-core/`** - Shared configuration library (YAML parsing, validation, encryption/decryption, secret resolution)

### Runtime Application (`apps/runtime/src/`)

```
apps/runtime/src/
├── index.ts                    # Entry point: bootstraps runtime and starts HTTP server
├── core/                       # Core runtime logic
│   ├── bootstrap.ts           # Bootstrap sequence: decrypt config, init vault, rebuild budgets
│   ├── providerRouter.ts      # Routes LLM calls to provider adapters
│   ├── state.ts               # Runtime state management (indices, caches, budgets)
│   └── types.ts               # Core TypeScript types
├── http/                       # Fastify HTTP server and endpoints
│   ├── server.ts              # Fastify app setup and route registration
│   ├── completions/            # Chat completions endpoint handler
│   ├── embeddings/             # Embeddings endpoint handler
│   └── openaiUtil.ts          # OpenAI-compatible request/response utilities
├── security/                   # Security features
│   ├── auth.ts                # Bearer token authentication
│   ├── redaction.ts           # Regex-based PII redaction (warn/block modes)
│   └── drift.ts               # Drift detection (strict mode + anomaly detection)
├── policy/                     # Policy enforcement
│   ├── budget.ts              # Micro-dollar budget tracking and reservation
│   └── policy.ts              # Token limits, parameter validation, enforcement pipeline
├── providers/                  # LLM provider adapters
│   ├── types.ts               # ProviderAdapter interface
│   ├── openaiProvider.ts      # OpenAI API adapter (chat_completions, embeddings)
│   ├── localProvider.ts       # Local/self-hosted LLM adapter (OpenAI-compatible)
│   ├── params.ts              # Parameter merging and validation
│   └── url.ts                 # URL utilities
├── telemetry/                  # Observability and event storage
│   ├── store.ts               # SQLite store interface
│   ├── writer.ts              # Batched event writer
│   ├── telemetry.ts           # Event emission and buffering
│   ├── replay.ts              # Budget replay on boot
│   ├── migrate.ts             # Migration runner
│   └── migrations/            # SQLite schema migrations
├── util/                       # Utilities
│   ├── cost.ts                # Cost estimation using pricing tables
│   ├── log.ts                 # Structured logging
│   ├── backoff.ts             # Exponential backoff with jitter
│   ├── cacheKey.ts            # Cache key generation
│   ├── timeWindow.ts          # UTC day boundary utilities
│   └── webhook.ts             # Webhook event emission
└── vault.ts                    # In-memory secret storage
```

### Configuration Library (`libs/config-core/src/`)

```
libs/config-core/src/
├── index.ts                    # Public API exports
├── spec/                       # Configuration schema
│   ├── types.ts               # TypeScript types for parapet.yaml
│   ├── schema.ts              # Zod validation schemas
│   └── validate.ts            # Schema validation logic
├── hydration/                  # Config hydration (resolves references)
│   ├── hydratedTypes.ts       # Runtime types (after hydration)
│   └── resolveRefs.ts         # Resolves *_ref placeholders to actual values
├── crypto/                     # Encryption/decryption
│   ├── blobEncrypt.ts         # AES-256-GCM encryption
│   ├── blobDecrypt.ts         # AES-256-GCM decryption
│   └── checksum.ts            # Config checksum computation
├── io/                         # I/O utilities
│   └── parseYaml.ts           # YAML parsing
└── constants.ts                # Built-in redaction patterns and cost tables
```

### CLI Package (`packages/cli/src/`)

```
packages/cli/src/
├── main.ts                     # CLI entry point (Commander.js)
├── commands/
│   └── build-config.ts        # build-config command: validates YAML, resolves secrets, encrypts
└── secretsources/              # Secret resolution sources
    ├── envSource.ts           # Environment variable resolution
    └── promptSource.ts        # Interactive prompt resolution
```

## Features Overview

### 1. Authentication & Authorization

**Location**: `apps/runtime/src/security/auth.ts`

- Bearer token authentication via `Authorization: Bearer <token>` header
- Token-to-service mapping: validates token and resolves to service context (tenant, allowed routes, label)
- Rejects invalid tokens with `invalid_api_key` error
- Service tokens are generated by CLI (or from env vars) and never exposed to providers

### 2. Route Selection & Model Matching

**Location**: `apps/runtime/src/http/openaiUtil.ts`

- Route selection by exact model name match within service's `allowed_routes`
- Endpoint type matching (chat_completions vs embeddings)
- Blocks requests with `drift_violation` if no matching route found
- Model names must be unique per endpoint_type within a service's allowed routes

### 3. Policy Enforcement Pipeline

**Location**: `apps/runtime/src/policy/policy.ts`

Enforcement happens in order:

1. **Token Limits** - Enforces `max_tokens_in` (prompt size) and caps `max_tokens` to `max_tokens_out`
2. **Drift Strict Mode** - Pre-flight check: blocks if provider/model mismatch (when `drift_strict: true`)
3. **Redaction** - Applies regex patterns to input (see Redaction below)
4. **Cost Estimation** - Deterministic cost calculation using token counts and pricing tables
5. **Budget Check** - Reserves estimated cost atomically; blocks if daily cap would be exceeded
6. **Provider Call** - Makes actual LLM call via provider adapter
7. **Budget Finalization** - Adjusts reservation with actual token-based cost

### 4. Budget Tracking

**Location**: `apps/runtime/src/policy/budget.ts`

- Micro-dollar precision (1e-6 USD) to avoid floating-point drift
- Per-tenant and per-route daily spend caps (UTC day boundary)
- Atomic cost reservation before provider call
- Budget rebuild on boot from telemetry SQLite store
- Uses in-memory counters rebuilt from persistent telemetry

### 5. Redaction

**Location**: `apps/runtime/src/security/redaction.ts`

- Regex-based pattern matching on request input
- Built-in patterns: `email`, `api_key`, `ip`, `phone`
- Custom patterns: `re:<regex>`, `/regex/flags`, or literal strings
- Modes:
  - `off` - No redaction
  - `warn` - Scrubs matches with `[REDACTED]` tags, logs, continues
  - `block` - Rejects request with `redaction_blocked`
- Applied to chat completions messages and embeddings input

### 6. Drift Detection

**Location**: `apps/runtime/src/security/drift.ts`

Two-layer approach:

1. **Drift Strict Mode** (`policy.drift_strict: true`)
   - Pre-flight check before provider call
   - Blocks if request specifies different provider/model than config
   - Prevents shadow AI usage

2. **Drift Anomaly Detection** (`policy.drift_detection`)
   - Post-response analysis (observability only, does not block)
   - Detects:
     - Model mismatch (response `model` ≠ expected)
     - System fingerprint change (provider's `system_fingerprint` changed)
     - Cost anomaly (actual cost deviates > threshold from expected)
   - Sensitivity levels: `low` (25%), `medium` (15%), `high` (10%)

### 7. Provider System

**Location**: `apps/runtime/src/providers/`

- Provider adapter interface (`ProviderAdapter`) with `callLLM()` method
- Built-in providers:
  - **OpenAI** (`openaiProvider.ts`) - chat_completions, embeddings, streaming support
  - **Local** (`localProvider.ts`) - chat_completions only, zero-cost, OpenAI-compatible API
- Parameter merging: route defaults + request params (request wins)
- Parameter validation per provider/endpoint type
- Provider routing via `providerRouter.ts` registry

### 8. Telemetry & Observability

**Location**: `apps/runtime/src/telemetry/`

- SQLite-backed event store at `/data/parapet-telemetry.db`
- Schema migrations in `telemetry/migrations/`
- In-memory buffer (~100ms window) for batched writes
- Event fields: tenant, route, service, allowed/blocked, costs, tokens, latency, drift flags, etc.
- Budget replay on boot: `loadTodayRows()` → `budget.rebuildFromRows()`
- Append-only writes (no deletes or updates)

### 9. Webhooks

**Location**: `apps/runtime/src/util/webhook.ts`

- Configurable per-route webhook URLs
- HMAC-SHA256 signed payloads (`X-Parapet-Signature` header)
- Event types: `policy_decisions`, `request_errors`, `provider_errors`
- Fire-and-forget delivery (async, non-blocking)
- Optional prompt excerpt (first 80 chars) when `include_prompt_snippet: true`

### 10. Caching

**Location**: `apps/runtime/src/core/bootstrap.ts`, `apps/runtime/src/util/cacheKey.ts`

- Per-route LRU cache using `tiny-lru` (TTL + max entries)
- Cache key includes: route, endpoint_type, model, payload, params (optional), redaction_mode
- Only for non-streaming responses
- Cache hits finalize budget with zero cost
- Telemetry records `cache_hit: true`

### 11. Retry Logic

**Location**: `apps/runtime/src/util/backoff.ts`, `apps/runtime/src/providers/*`

- Exponential backoff with jitter
- Configurable: `max_attempts`, `base_ms`, `jitter`, `retry_on` status codes, `max_elapsed_ms`
- Auth errors (401) never retried
- Network errors always retried
- Streaming retries at SSE reader level (separate from non-streaming)

### 12. Configuration System

**Location**: `libs/config-core/src/`

- YAML schema with Zod validation
- Secret references: `*_ref` fields resolved during hydration
- Resolution sources: `ENV:VAR_NAME`, `PROMPT:description`, or direct values
- AES-256-GCM encryption of hydrated config
- Config checksum for audit trail
- Runtime decryption on boot from env vars

## How to Add New Things

### Adding a New Provider

1. **Create adapter** in `apps/runtime/src/providers/<name>Provider.ts`:
   - Implement `ProviderAdapter` interface
   - Export named adapter with `name` property
   - Handle `callLLM()` with `LlmCallInput` → `LlmCallOutput`

2. **Register in router** (`apps/runtime/src/core/providerRouter.ts`):
   - Add to provider registry: `registry[<type>] = <adapter>`

3. **Update config schema** (`libs/config-core/src/spec/types.ts`):
   - Add provider type to `ProviderType` union

4. **Add cost tables** (`libs/config-core/src/constants.ts`):
   - Add pricing tables if not zero-cost
   - Format: `{ [model: string]: { input: number, output: number } }`

5. **Update validation** (`libs/config-core/src/spec/validate.ts`):
   - Add provider-specific validation if needed

**Example**: See `openaiProvider.ts` and `localProvider.ts` for reference implementations.

### Adding a New Endpoint Type

1. **Update config schema** (`libs/config-core/src/spec/types.ts`):
   - Add endpoint type to `EndpointType` union

2. **Update provider types** (`apps/runtime/src/providers/types.ts`):
   - Add endpoint type to `EndpointType` union

3. **Update provider adapters**:
   - Add support for new endpoint type in all provider adapters

4. **Add HTTP route handler** (`apps/runtime/src/http/`):
   - Create new directory (e.g., `images/`)
   - Implement handler similar to `completions/index.ts` or `embeddings/index.ts`
   - Register route in `server.ts`

5. **Update parameter validation** (`apps/runtime/src/providers/params.ts`):
   - Add validation rules for new endpoint type if needed

### Modifying the Config Schema

1. **Update types** (`libs/config-core/src/spec/types.ts`):
   - Add new fields to TypeScript interfaces

2. **Update Zod schema** (`libs/config-core/src/spec/schema.ts`):
   - Add validation rules for new fields

3. **Update validation** (`libs/config-core/src/spec/validate.ts`):
   - Add cross-field validation if needed

4. **Update hydration** (`libs/config-core/src/hydration/resolveRefs.ts`):
   - Add resolution logic if new `*_ref` fields are added
   - Apply defaults if needed

5. **Update runtime types** (`libs/config-core/src/hydration/hydratedTypes.ts`):
   - Add hydrated equivalents if types change during hydration

6. **Update runtime consumers**:
   - Update code that reads config (e.g., `bootstrap.ts`, `state.ts`, handlers)

### Adding a New Policy Feature

1. **Define policy field** in config schema (see above)

2. **Add enforcement logic** (`apps/runtime/src/policy/policy.ts`):
   - Add check in enforcement pipeline
   - Return appropriate error code if blocked

3. **Update telemetry** (`apps/runtime/src/telemetry/`):
   - Add new fields to telemetry events if needed
   - Create migration if schema changes

4. **Update budget** (`apps/runtime/src/policy/budget.ts`):
   - Add tracking if feature affects spend

### Adding a New Security Feature

1. **Create module** in `apps/runtime/src/security/`:
   - Implement feature (e.g., rate limiting, IP allowlist)

2. **Integrate into pipeline**:
   - Add to enforcement pipeline in `policy.ts` or handler
   - Or add as middleware in `server.ts`

3. **Update config schema**:
   - Add configuration fields if needed

4. **Update telemetry**:
   - Log feature decisions in telemetry events

## Development Guide

### Prerequisites

- Node.js 22+
- pnpm (enabled via corepack)

### Setup

```bash
# Install dependencies
pnpm install

# Build all workspaces
pnpm run build

# Start runtime in dev mode
pnpm run start:runtime
```

### Building Config

```bash
# Using local CLI
pnpm --filter @parapetai/cli run build
node packages/cli/dist/main.js build-config --file ./parapet.yaml

# Using published CLI
npx @parapetai/cli build-config --file ./parapet.yaml

# Write to .env file
pnpm run parapet:build-config
```

### Running Tests

```bash
# Run runtime tests
pnpm run test:runtime
```

### Docker Development

```bash
# Build and start with docker-compose
pnpm run compose:up

# View logs
pnpm run compose:logs

# Stop
pnpm run compose:down
```

### Debugging

- Runtime logs to stdout/stderr
- Check telemetry DB: `sqlite3 /data/parapet-telemetry.db "SELECT * FROM telemetry_events ORDER BY ts DESC LIMIT 10"`
- Check config checksum at boot (logged on startup)
- Use `apps/runtime/scripts/decrypt-bootstrap.ts` to inspect bootstrap state (requires master key)

### Workspace Scripts

- `pnpm run build` - Builds all workspaces in parallel
- `pnpm run start:runtime` - Runs dev mode for runtime
- `pnpm run build:runtime:ws` - Builds only runtime workspace
- `pnpm run compose:up` - Starts docker-compose stack
- `pnpm run compose:down` - Stops docker-compose stack
- `pnpm run compose:logs` - Tails docker-compose logs
- `pnpm run test:runtime` - Runs runtime tests

## Contributing

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/parapetai.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `pnpm install`
5. Make your changes
6. Build and test: `pnpm run build && pnpm run test:runtime`
7. Commit your changes: `git commit -m "Add feature: description"`
8. Push to your fork: `git push origin feature/your-feature-name`
9. Open a pull request

### Code Style

- TypeScript with strict type checking
- Use explicit types (avoid `any` when possible)
- Follow existing code patterns and structure
- Add comments only when logic is complex and not obvious
- Use structured logging via `util/log.ts`
- Prefer negative space programming (early returns, avoid nesting)

### Testing

- Write tests for new features in `apps/runtime/src/__tests__/`
- Use Jest for testing
- Test both success and failure cases
- Test edge cases and boundary conditions

### Pull Request Guidelines

- Keep PRs focused and small when possible
- Include a clear description of changes
- Reference related issues if applicable
- Ensure all tests pass
- Update documentation if needed
- Follow the project's commit message conventions

### Areas for Contribution

- **New Providers**: Add support for additional LLM providers (Anthropic, Cohere, etc.)
- **New Endpoint Types**: Add support for other OpenAI-compatible endpoints (images, audio, etc.)
- **Policy Features**: Add new enforcement capabilities (rate limiting, IP allowlists, etc.)
- **Security**: Improve redaction patterns, add security features
- **Observability**: Enhance telemetry, add metrics, improve webhook payloads
- **Performance**: Optimize caching, reduce latency, improve throughput
- **Documentation**: Improve code comments, add examples, update docs

### Questions?

If you have questions about contributing or need help getting started, please open an issue with the `question` label.
