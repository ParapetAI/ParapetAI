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
