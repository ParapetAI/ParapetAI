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