# Render Studio — Endpoint Audit (per feature)

**Goal:** For every Render Studio feature, document the exact request path the browser makes,
what the Director backend exposes, and what VideoDB API each agent ultimately calls. Flag any
transport/route mismatch that would cause the feature to fail (even loudly) at runtime.

**Verified against:** `directorClient.js` (frontend), `apps/director/backend/director/entrypoint/api/routes.py`
+ `socket_io.py` + `__init__.py` (backend), and `videodb_tool.py` (VideoDB primitives).

---

## A. Transport topology

```
Browser (Render Studio)
  └─ /director-api/*  (Vite proxy in dev: VITE_DIRECTOR_API_URL || localhost:8000;
                       Netlify redirect in prod: ${DIRECTOR_API_URL}/:splat)
        └─ Director backend (Flask + Flask-SocketIO, port 10000)
              ├─ HTTP blueprints:  /videodb, /agent, /session, /config
              └─ Socket.IO namespace: /chat   (event: "chat")
                    └─ ChatHandler → ReasoningEngine → registered Agents
                          └─ videodb_tool → VideoDB API (https://api.videodb.io)
```

### Backend routes that EXIST (HTTP)
| Method | Path | Purpose |
|---|---|---|
| GET  | `/config/check` | health |
| GET  | `/agent/` | list agents |
| GET  | `/session/`, `/session/<id>` | session state |
| GET/POST/DELETE | `/videodb/collection[/<id>]` | collections |
| POST | `/videodb/collection/<id>/video` | **upload video by URL** |
| GET/DEL | `/videodb/collection/<id>/video/<vid>` | video get/delete |
| POST | `/videodb/collection/<id>/upload` | raw upload |
| GET  | `/videodb/collection/<id>/{video,audio,image}/<id>` | media get |

### Backend routes that DO NOT EXIST
- ❌ **No HTTP `POST /chat`** — agent execution is **Socket.IO `/chat` namespace only**.
  The `directorClient.js` HTTP fallback `postJson('/chat', payload)` will 404.
- ❌ **No `/api/agents`** HTTP route — that path is the *local Express bridge*
  (`localhost:3001`), not Director. `directorAgentRuntime.js` calls `/api/agents` which is a
  **different service** (and is down in this env).

---

## B. Per-feature endpoint map

For each feature: **Frontend call → Director endpoint → VideoDB primitive**.

### 1. Upload source video (prerequisite for ALL finishing ops)
- Frontend: `uploadVideoToDirector(url)` → `POST /director-api/videodb/collection/<id>/video`
  `{source, source_type:"url"}`
- Backend: `POST /videodb/collection/<id>/video` → `videodb_tool.upload(source, source_type="url")`
- VideoDB: `conn.upload(...)` → returns `video_id`
- ✅ **Correct and verified.** Returns `video_id` used by every agent below.

### 2. Subtitles
- Frontend: `runDirectorFinishingOp('subtitle', url)` → upload (§1) → `invokeDirectorAgent({agent:'subtitle'})`
- Backend: **Socket.IO `/chat`** emit `{message, agents:['subtitle'], collection_id, video_id}`
- Agent: `subtitle.py` → `get_transcript` + `index_spoken_words` (+ `translate_transcript`) +
  `add_subtitle` + `Timeline.generate_stream()` → returns `stream_url`
- VideoDB primitives: `get_transcript`, `index_spoken_words`, `add_subtitle`, `translate_transcript` ✅ real
- ⚠️ **ENDPOINT BUG:** frontend connects `io('/director-api')` (default namespace `/`) but backend
  listens on `/chat`. The `chat` event never reaches `on_chat`. **Must use `io('/director-api/chat')`.**

### 3. Scene detection
- Agent `scenes` → `index_scene(video_id, shot_based)` + `list_scene_index` ✅ real
- Same Socket.IO `/chat` transport bug as §2.

### 4. Highlights / Shorts
- Agent `highlight_reel` → `index_scene` + LLM selection + Timeline stitch ✅ real
- Shorts = `scenes` + `social` (reframe). `social_agent` exists ✅.
- Same Socket.IO `/chat` transport bug.

### 5. Voiceover
- Agent `voiceover` → `generate_voice(text, voice_name)` + Timeline ✅ real
- Same Socket.IO `/chat` transport bug.

### 6. Dubbing
- Agent `dubbing` → `get_video` + `download` + `dub_video` (or `upload` re-stitch) ✅ real
- Same Socket.IO `/chat` transport bug.

### 7. Enhance / "upscale"
- Agent `enhancer` → `Timeline` + `Filter.boost` (contrast/boost filter, **NOT true upscaling**) ⚠️ partial
- Same Socket.IO `/chat` transport bug.

### 8. Speed / Stabilize / Reverse
- Agents `speed_agent`, `stabilize_agent`, `reverse_agent` exist as files; their `run()` bodies were
  **NOT verified** to call real VideoDB Timeline ops. Must confirm before claiming ✅.
- Same Socket.IO `/chat` transport bug.

### 9. Health check
- Frontend: `checkDirectorHealth()` → `GET /director-api/config/check`
- Backend: `GET /config/check` ✅ exists.
- ✅ Correct (HTTP, no Socket.IO needed).

---

## C. Bugs found in the endpoint layer (must fix before features work)

### BUG 1 — Socket.IO namespace mismatch (BLOCKER for all agent execution) — ✅ FIXED
- `directorClient.js:121` → `io(DIRECTOR_BASE, ...)` connected to default namespace `/`.
- Backend registers `ChatNamespace("/chat")` and `on_chat` only fires on `/chat`.
- **Fix applied:** connect to `${DIRECTOR_BASE}/chat` via `DIRECTOR_SOCKET_URL`
  (`io(DIRECTOR_SOCKET_URL, ...)`), with `VITE_DIRECTOR_SOCKET_URL` override for prod WS.

### BUG 2 — Dead HTTP `/chat` fallback (misleading, not fatal) — ✅ FIXED
- `postJson('/chat', payload)` hit `POST /director-api/chat`, which has **no route** (404).
- **Fix applied:** removed the HTTP fallback; a dropped Socket.IO connection now rejects loudly.

### BUG 3 — `directorAgentRuntime.js` uses `/api/agents` (wrong service) — open
- `directorAgentRuntime.js:612` calls `POST /api/agents/agent/<action>` → proxies to
  `localhost:3001` (local Express bridge), NOT Director. This runtime is currently **unused**
  by RenderPage (RenderPage uses `directorClient`/`renderAiActions`), but if anything invokes it,
  it targets a different, down service. The `simulated:true` fallback was already removed (throws).

---

## D. Production (Netlify) endpoint note
- `netlify.toml` redirects `/director-api/*` → `${DIRECTOR_API_URL}/:splat` (HTTP only).
- **Socket.IO does NOT traverse a Netlify redirect proxy** the same way — the `/chat` Socket.IO
  upgrade must reach the Director backend. Confirm `DIRECTOR_API_URL` serves Socket.IO and that
  Netlify's redirect forwards the WebSocket upgrade, or use a direct `wss://` URL for the socket
  in production (e.g. set `DIRECTOR_SOCKET_URL` separately from the HTTP `DIRECTOR_API_URL`).
- This is the **single biggest production risk**: dev works via Vite proxy (which handles WS),
  but Netlify's `to = "${DIRECTOR_API_URL}/:splat"` may not proxy the Socket.IO upgrade.

---

## E. Verified-good endpoints (no change needed)
- Upload: `POST /videodb/collection/<id>/video` ✅
- Health: `GET /config/check` ✅
- CORS: `cors_allowed_origins="*"` ✅ (browser can call Director directly)
- VideoDB primitives for subtitle/scenes/highlight/voiceover/dubbing: all real ✅

## F. Action list
1. **Fix BUG 1** (namespace `/chat`) — required for every finishing feature.
2. **Fix BUG 2** (remove dead `/chat` HTTP fallback) — cleanup.
3. **Verify BUG 3** scope — confirm `directorAgentRuntime` isn't on RenderPage's path.
4. **Production socket** — add `DIRECTOR_SOCKET_URL` (wss) and use it for the Socket.IO connection
   so Netlify doesn't break the WS upgrade.
5. **Verify** `speed`/`stabilize`/`reverse` agent `run()` bodies call real VideoDB Timeline ops.
