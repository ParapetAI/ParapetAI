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
3) Start runtime: `npm run start:runtime`

The runtime will listen on `http://localhost:3030` and respond:

```
Parapet runtime up
```

CLI example:

```
npm run parapet -- build-config
```

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