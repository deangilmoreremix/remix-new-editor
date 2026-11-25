# SmartVidDownloader per-user libraries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (run natively, per the user's "complete the above").

**Goal:** Each signed-in user gets a private VidBee API (own data + download folders); #286's open access becomes safe.

**Architecture:** The Express gate derives an opaque per-user id and sends it as `x-smartvid-user`. The Beam web server (`apps/web/server.mjs`) asks a new `user-apis.mjs` pool for that user's API URL and proxies to it. The pool spawns/stops per-user API processes (cap + idle stop).

**Tech Stack:** Node 22 ESM, `node:test`, Express (gate), child_process.

**Spec:** `docs/superpowers/specs/2026-11-25-smartviddownloader-per-user-design.md`

## Global Constraints
- Header name `x-smartvid-user`; value matches `^[a-f0-9]{32}$`.
- Env: `VIDBEE_PER_USER=1` (enable pool), `VIDBEE_MAX_ACTIVE_USERS` (default 3), `VIDBEE_USER_IDLE_MINUTES` (default 15), data under `/data/users/<id>/{vidbee,downloads}`.
- No GitHub Actions; PR against `develop`; lint + build pass first.

## Review Focus
- Client sends its own `x-smartvid-user` through the gate: must be replaced, never trusted.
- Missing/invalid header while `VIDBEE_PER_USER=1`: 400, never a shared default API.
- Two users: separate dirs/ports; user A never gets B's URL.
- Cap reached with all APIs busy: 503, not an eviction of an active download.
- Concurrent first requests for one user start one API, not two.

### Task 1: Gate sends a per-user id; open to all signed-in users
**Files:** Modify `backend/services/vidbeeProxy.js`; Test `backend/services/vidbeeProxy.nodetest.mjs`
**Interfaces:** Produces `userKey(userId: string, env = process.env): string` (32 hex chars, HMAC, stable) and header `x-smartvid-user` on every proxied request; `isAllowed` returns true for any user when `VIDBEE_ALLOWED_USERS` is unset.
- [ ] Failing tests: unset allowlist allows anyone (any NODE_ENV); `userKey` is stable, 32 hex, differs per user; upstream receives `x-smartvid-user` = `userKey(id)` and a client-supplied one is dropped.
- [ ] Implement; run `npm run test:vidbee-gate`; commit.

### Task 2: Per-user API pool
**Files:** Create `apps/vidbee/apps/web/user-apis.mjs`, `apps/vidbee/apps/web/user-apis.nodetest.mjs`
**Interfaces:** Produces `createUserApiPool({ dataRoot, basePort, maxActive, idleMs, spawnApi, waitHealthy, now }) -> { acquire(id): Promise<{ url: string, release(): void }>, sweep(): void, stopAll(): void }`, `class PoolBusyError`, `isUserId(s): boolean`, `defaultSpawnApi`.
- [ ] Failing tests (fake spawn): separate dirs/ports per user; same user reuses one process; concurrent acquire starts one; at cap stops LRU idle one; at cap all active -> `PoolBusyError`; sweep stops idle only when no active requests; invalid id throws.
- [ ] Implement; run tests; commit.

### Task 3: Web server routing + container wiring
**Files:** Modify `apps/vidbee/apps/web/server.mjs`, `apps/vidbee/beam/start.sh`, `package.json` (test script)
**Interfaces:** Consumes Task 2 pool. With `VIDBEE_PER_USER=1`, API-proxied requests need a valid `x-smartvid-user` (else 400), 503 on `PoolBusyError`; `release()` when the response closes.
- [ ] Failing test: server with fake pool returns 400 without header, proxies to the pool URL with it. Implement; commit.
- [ ] `start.sh`: when `VIDBEE_PER_USER=1` skip the shared API, run only the web server.

### Task 4: Docs, verification, PR
- [ ] Update `docs/MEDIA_HUB.md`, `docs/BEAM_DEPLOY.md`, `apps/vidbee/UPSTREAM.md`.
- [ ] Run lint, build, `npm run test:vidbee-gate`; open PR to `develop`; enable auto-merge.
