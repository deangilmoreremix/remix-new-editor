# SmartVidDownloader: one private library per signed-in user

Status: draft for approval (nothing built yet). Related: #286 (open to all signed-in users).

## Intent
Every signed-in user sees only their own downloads, queue, settings and history. Today all allowed users share
one VidBee API (one SQLite DB, one queue, one download folder). #286 would open that shared instance to everyone,
so it must not merge without this.

## Goals
- A user can never read, list, stream, delete or queue into another user's data (downloads, history, settings, AI/agent data, files).
- Any signed-in user can use it when `VIDBEE_ALLOWED_USERS` is unset (the point of #286). When set, it stays an allowlist.
- Upstream VidBee code stays as unmodified as possible (existing `[host patch]` list in `apps/vidbee/UPSTREAM.md` grows by one entry).

## Non-goals / anti-goals
- No per-user quotas or billing in this change.
- No sharing of a library between users.
- Must not "work" by only hiding rows in the UI: isolation is by separate data, not by filtering.

## Approaches considered (user picked 1)
1. **One API process per user** (chosen): separate `VIDBEE_DATA_DIR` and `VIDBEE_DOWNLOAD_DIR` per user. Full isolation, no upstream logic change; costs memory per active user.
2. Multi-tenant fork of upstream (keyed singletons): lowest memory, deep fork, leak-prone. Rejected.
3. Filter responses in the gate: weak, the IPC/event surface is large and settings/agent data stay shared. Rejected.

## Design
```
browser -> Express gate (Supabase auth, cookie) -> Beam web server (:3000) -> per-user API (127.0.0.1:<port>)
            sets x-smartvid-user = hmac(userId)     picks API by that header   data: /data/users/<id>/{vidbee,downloads}
```
1. **Gate** (`backend/services/vidbeeProxy.js`): the signed cookie already carries the user id. On proxy, verify it, derive a
   stable opaque id (`hmac-sha256(VIDBEE_GATE_TOKEN, userId)`, hex, truncated), strip any client-sent `x-smartvid-user`,
   and set it. `isAllowed`: unset list = everyone signed in (all environments), set = allowlist as before.
2. **Web server** (`apps/web/server.mjs`, host patch): requires the gate token (already does), reads `x-smartvid-user`
   (validated `^[a-f0-9]{32}$`, else 400), asks the supervisor for that user's API URL, proxies there. No header = 400, never a default shared API.
3. **Supervisor** (new, in the Beam container, replaces the single-API part of `beam/start.sh`): Node script that, on first request
   for a user, creates `/data/users/<id>/{vidbee,downloads}`, runs migrate + starts the API on a free loopback port with
   `VIDBEE_DATA_DIR`/`VIDBEE_DOWNLOAD_DIR` set to those paths, waits for `/health`, and returns the URL. Idle APIs stop after
   `VIDBEE_USER_IDLE_MINUTES` (default 15, never while a download is active). `VIDBEE_MAX_ACTIVE_USERS` (default 3) caps
   running APIs; at the cap the least-recently-used idle one is stopped, otherwise the request gets a 503 "busy, try again" page.
4. **Local dev**: with no supervisor (`VIDBEE_WEB_URL` pointing at one host) the header is ignored and it behaves as today (single user).
5. **Tests**: extend `backend/services/vidbeeProxy.nodetest.mjs` (header set, client header stripped, allowlist semantics);
   supervisor test with two fake users proving separate dirs and that user A's history never appears for user B.
6. **Docs**: `docs/MEDIA_HUB.md`, `docs/BEAM_DEPLOY.md`, `UPSTREAM.md`.

## Constraints
- Beam runs one container, `--max-replicas 1`, scale to zero, 4 GiB: hence the active-user cap and idle stop.
- Per-user data on the existing `/data` disk (fixed size, cannot shrink); no quota yet, so one user can fill it.
- Netlify-only checks, PR against `develop`, lint + build must pass, auto-merge (repo CLAUDE.md).

## My calls (change any of these)
- Opaque id is an HMAC of the Supabase user id, not the raw id/email, so paths and logs hold no PII.
- Cold start for a user's first request after idle is a few seconds slower (API boot + migrate); the error page already has Reconnect.
- Cap 3 active / 15 min idle as defaults, both env-tunable.

## Needs your answer
Existing shared data in `/data/vidbee` and `/data/downloads` (made by earlier allowlisted users): leave it untouched and
unreachable (my default, nothing is deleted), or move it into one named user's library?
