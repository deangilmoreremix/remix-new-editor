# Director × VideoDB Integration — Design Spec

**Date:** 2026-07-18
**Branch context:** `develop` (DirectorPage.js was reverted to the older 24-agent simulated design; this spec restores the 45-agent real design and wires it to VideoDB.
**Approach:** Proxy to the existing Python Director backend (`apps/director/backend`) — Option A from the design discussion.

## Goal

Make the Director page a real, working, VideoDB-powered agentic editor:

1. **45 agents** with buttons and real logic behind each (restore the registry from `af344bd7` + wire to the Python Director backend that already implements them).
2. **Real chat** using VideoDB's video-context-aware chat (PromptClip-style: describe what you want → run against indexed video → get stream/clip back).
3. Confirm the **VideoDB REST APIs** (search, index/upload, stream, generate video) are connected and used.

## Key decision: muapi is NOT required for Director

Verified against VideoDB docs + `apps/director/backend/requirements.txt`:
- VideoDB video generation is a native endpoint `POST /collection/{id}/generate/video/` (SDK: `coll.generateVideo(prompt, duration)`), authenticated only by the user's VideoDB key (`x-access-token`).
- The Director Python backend depends only on `videodb`, `openai`, `anthropic`, `googleai` (LLM reasoning) — **zero muapi**.
- muapi is used by *other* app features (StoryboardPanel) and stays out of Director.

## Architecture

```
DirectorPage.js (45 agents, chat UI)
        │  POST /api/director/agent/:id   │  POST /api/director/chat
        ▼                                 ▼
Express backend (:3001)  /api/director/*  ──proxy──▶  Python Director backend (:8000)
                                                     /agent  /session  /videodb  (socket.io /chat)
                                                              │
                                                              ▼
                                                  VideoDB API (api.videodb.io)
                                                  + LLM (OpenAI/Anthropic/GoogleAI)
```

The Python Director backend already implements all 45+ agents in `apps/director/backend/director/agents/` (66 files) and is the official VideoDB "Director" framework. We do NOT re-implement them.

## Components

### 1. DirectorPage.js (frontend)
- Restore from `af344bd7`: `leftAgents` (45 entries), `quickActions` (24), `AGENT_NAME_TO_ID` (45), `AGENT_META` (45 `{action, tool, success}`), `starterPrompts`.
- Keep the older design's 3-pane layout/header styling (the design we reverted to and the user confirmed).
- Replace the simulated `processCommand()` (fake `setTimeout` + canned responses) with real dispatch:
  - `runAgent(agentId, input)`:
    - Read VideoDB key via `apiKeyManager.getVideoDBKey()`; if missing → toast "Add your VideoDB key in Settings" and stop.
    - `POST /api/director/agent/:id` with `{ input, videoId, videoUrl }`.
    - Render real result into `#chat-messages`: summary text, or playable stream URL (VideoDB `stream_url`/`player_url`), or search result list, etc.
    - On error → clear, honest message (no fake "processing complete").
  - Free-text chat → `POST /api/director/chat` (PromptClip behavior).
- Wire every agent card button + every quick action to `runAgent`.
- Import `apiKeyManager` from `../lib/apiKeyManager.js` and `videoDb` from `../lib/videoDb.js` for key/stream resolution.

### 2. Express backend — new `services/directorProxy.js` + mount `/api/director`
- `POST /api/director/agent/:id` → forwards to `http://localhost:8000/agent/:id` (Python Director backend) with body `{ input, video_id, video_url, collection_id }`.
  - If `VIDEO_DB_API_KEY` env is set on the Express side, pass it; otherwise the Python backend uses its own env key. Support an optional `videoDbKey` from the request body (user-supplied) forwarded as the Director backend expects.
  - Return the backend JSON (normalize `streamUrl`/`output`/`summary`).
- `POST /api/director/chat` → forwards to `http://localhost:8000/chat` (socket.io) OR, simpler, calls VideoDB Chat Completions through the existing `/api/videodb/proxy`. Prefer proxying the Python `/chat` for full agentic reasoning; fall back to VideoDB chat-completions REST.
- Mount in `backend/server.js`: `app.use('/api/director', directorProxy)`.
- Reuse existing `backend/services/videodbProxy.js` (`/api/videodb/proxy`) for search/upload/stream/generate — no change needed there except confirming `generate/video` and `search` endpoints are allowed.

### 3. Python Director backend (mostly unchanged)
- Already implements agents. Ensure it boots with `VIDEO_DB_API_KEY` + at least one LLM key.
- Vite dev proxy `/director-api` → `localhost:8000` already exists (`vite.config.js:589`), so the browser can reach it directly in dev too; the Express `/api/director` proxy is for prod/Render parity.
- Document `.env` requirements in README.

### 4. Chat (PromptClip-style)
- Natural-language command → Director backend reasoning → runs against indexed video → returns clip/stream.
- If a `videoId` is present (from `?videoId=` deep link or uploaded), pass it so the backend searches that video; otherwise operate on the user's default collection.
- Render stream URLs in an embedded player (`<video>` with mp4 stream_url from `videoDb.getStreamUrl`).

## Agent → Backend mapping (from `af344bd7` `AGENT_META`, 45 entries)
Each `agentId` maps to the Python Director backend agent. Examples: `summarizer→summarize-video`, `search→search-media`, `clipper→create-clip`, `dubbing→dub-video`, `subtitler/subtitle_agent→generate-subtitles`, `highlighter/auto_highlights→extract-highlights`, `scenes→detect-scenes`, `voiceover/ai_voiceovers→add-voiceover`, `voice_cloning→clone-voice`, `broll→add-broll`, `editor→edit-video`, `enhancer→enhance-video`, `compiler→compile-videos`, `compilation→build-compilation`, `meme→create-meme`, `musicvideo→create-music-video`, `trailer/trailer_narration→create-trailer`, `social→create-social-clip`, `preview→generate-preview`, `montage→create-montage`, `story→build-story`, `color→color-correct`, `stabilize→stabilize-video`, `speed→adjust-speed`, `reverse→reverse-video`, `comparison→compare-videos`, `keyword_search→keyword-search`, `output_formatting→format-output`, `thumbnail→generate-thumbnail`, `visual_search→visual-search`, `text_to_movie→text-to-movie`, `storyboarding→generate-storyboard`, `faceless_video_creator→create-faceless-video`, `ai_ad_films→create-ad-film`, `tiktok_lyric_video→create-lyric-video`, `kids_storyteller→tell-kids-story`, `year_in_frames→build-year-recap`, `profanity_remover→remove-profanity`, `slack_agent→send-slack-message`, `sales_assistant→sales-assist`.

## VideoDB REST endpoints used
- Upload/index: `POST /collection/{id}/upload` (via `videoDb.indexVideo`)
- Search: `POST /collection/{id}/search/` and `POST /video/{id}/search/` (via `videoDb.searchCollection` / `searchVideo`)
- Stream: `POST /video/{id}/stream/` (via `videoDb.getStreamUrl`)
- Generate video: `POST /collection/{id}/generate/video/`
- Chat completions: VideoDB chat endpoint (via proxy)

## Testing / Verification
1. Boot Python Director backend (`:8000`) with `VIDEO_DB_API_KEY` + LLM key.
2. Boot Express backend (`:3001`).
3. `curl -X POST localhost:3001/api/director/agent/summarizer` with a test video → expect a real summary (not a fake message).
4. In browser `/#/director`: click each of the 45 agent buttons → real responses; type a PromptClip-style command → chat returns a stream/clip.
5. Grep: confirm no `muapi` import anywhere under Director code paths (`src/components/DirectorPage.js`, `src/lib/directorAgentRuntime.js`, `backend/services/directorProxy.js`, `apps/director/backend`).

## Out of scope (YAGNI)
- Not running the Python Director backend as a separate Render service in this task (proxying locally + documenting is enough; deploy config is separate).
- Not re-implementing agent logic in Express (the Python backend owns it).
- Not touching `src/lib/agents/directorAgent.js` (that's the timeline-analysis agent, unrelated).
