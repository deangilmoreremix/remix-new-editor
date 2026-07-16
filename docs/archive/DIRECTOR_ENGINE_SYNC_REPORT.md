# Director Engine Sync Report

**Date:** 2026-07-04  
**Action:** Replaced Kling/StabilityAI/ElevenLabs video/audio generation engines in `apps/director` with upstream's MuAPI + OpenAI TTS stack. Read-only analysis outside of explicitly modified backend agent/tool files.

---

## Step 1 — Copy missing tool modules

Copied from upstream (`https://github.com/deangilmoreremix/Open-Higgsfield-AI`, `apps/director/backend/director/tools/`) to target (`apps/director/backend/director/tools/`):

| File | Notes |
|------|-------|
| `muapi.py` | Depends on `requests` and env vars `VITE_MUAPI_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Uses Supabase Edge Function proxy (`/functions/v1/muapi-proxy`). |
| `openai_tts.py` | Depends on `openai` and env var `OPENAI_API_KEY` (already present in target `.env.sample`). |

Both files copied verbatim. `openai_tts.py` was syntactically clean. `muapi.py` had a quote-matching bug in the upstream fetch (`f"Generation failed: {status_data.get("error", ...)}`); fixed to use single quotes inside the f-string so the file parses.

---

## Step 2 — Diff findings before overwriting agents

Diffed target vs upstream for `text_to_movie.py` and `video_generation.py`. The divergence is entirely engine selection. No target-only bug fixes or preserved business logic was found inside these two files.

### text_to_movie.py — target vs upstream

| Category | Target | Upstream |
|----------|--------|----------|
| Video engines | `["stabilityai", "kling", "videodb"]` | `["muapi"]` |
| Audio engines | `["elevenlabs", "videodb"]` | `["openai"]` |
| Video tool | `StabilityAITool`, `KlingAITool`, `VDBVideoGenerationTool` | `MuapiVideoTool` |
| Audio tool | `ElevenLabsTool`, `VDBAudioGenerationTool` | `OpenAITTSTool` |
| Default video engine | `stabilityai` | `muapi` |
| Default audio engine | `videodb` | `openai` |
| Engine configs | 3 (`stabilityai`, `kling`, `videodb`) | 1 (`muapi`) |
| `generate_engine_prompt` | Branching: `stabilityai` prompt vs Kling LLM-compress | Single LLM-compress path for all scenes (fixed indentation bug from upstream fetch) |
| Audio call | `audio_gen_tool.generate_sound_effect(...)` | `audio_gen_tool.text_to_speech(...)` |
| Core orchestration | Identical upload, scene loop, asset combine | Identical |

### video_generation.py — target vs upstream

| Category | Target | Upstream |
|----------|--------|----------|
| Video engines | `["stabilityai", "fal", "videodb"]` | `["muapi"]` |
| Video tool | `StabilityAITool`, `FalVideoGenerationTool`, `VDBVideoGenerationTool` | `MuapiVideoTool` |
| Config key | `stabilityai_config` / `fal_config` / `videodb_config` | `muapi_config` |
| Engine dispatch | 3-way if/elif | single `muapi` branch |
| Core orchestration | Identical | Identical |

**Conclusion:** Safe to overwrite. The target versions add only deprecated-engine-specific branching and config keys. The core flow (scenes loop, VideoDB upload, error handling, final stream assembly) is unchanged.

### Known upstream formatting bug
Upstream's fetched `text_to_movie.py` had the LLM compression block in `generate_engine_prompt` over-indented by 4 spaces relative to the method body (syntax error). Fixed to proper 8-space indentation before writing.

---

## Step 3 — Other references to old engines

Grep'd `apps/director/backend/director` for `kling`, `stabilityai`, `elevenlabs`, `fal_video`. Matches in files other than the two replaced agents:

| File | Usage | Action required |
|------|-------|-----------------|
| `tools/videodb_tool.py` | Imports `VOICE_ID_MAP` from `director.tools.elevenlabs` | No |
| `agents/voice_replacement.py` | Imports and uses `ElevenLabsTool` | No |
| `agents/image_generation.py` | Imports and uses `FalVideoGenerationTool` | No |
| `agents/dubbing.py` | Imports and uses `ElevenLabsTool` | No |
| `agents/clone_voice.py` | Imports and uses `ElevenLabsTool` | No |
| `agents/audio_generation.py` | Imports and uses `ElevenLabsTool` | No |

These agents still actively use the deprecated-engine files. They are beyond the scope of this task.

---

## Step 4 — Fate of unused tool files

`kling.py`, `stabilityai.py`, `elevenlabs.py`, and `fal_video.py` are **still imported by live agents** (see Step 3). They are no longer used by `text_to_movie.py` or `video_generation.py`, but they are **not orphaned repo-wide**.

**Recommendation:** Do not delete. Leave them in place. They can be removed only after the dependent agents (`voice_replacement.py`, `image_generation.py`, `dubbing.py`, `clone_voice.py`, `audio_generation.py`) are also migrated off those tools in a separate follow-up.

---

## Step 5 — Env vars

### Added to `apps/director/backend/.env.sample`

| Variable | Status | Notes |
|----------|--------|-------|
| `VITE_MUAPI_URL` | Added | Default `https://api.muapi.ai`. Already present at repo root `.env.example`. |
| `VITE_SUPABASE_URL` | Added | Required by `muapi.py` for proxy auth. |
| `VITE_SUPABASE_ANON_KEY` | Added | Required by `muapi.py` for proxy auth. |
| `OPENAI_API_KEY` | Already present | Used by `openai_tts.py`. |

### Reuse note

`ai-vfx` uses `VITE_MUAPI_KEY` for direct MuAPI calls, but `apps/director/backend` does **not** use the same access pattern. `muapi.py` requires Supabase URL + anon key for the Edge Function proxy, plus uses the MuAPI secret at the proxy layer (configured in Supabase Edge Function secrets, not app env). Therefore director's backend cannot simply reuse `apps/ai-vfx`'s `VITE_MUAPI_KEY`. Treat the Supabase URL/key as director-backend-specific unless the deployment shares a single Supabase project, in which case those values can point to the same project.

---

## Step 6 — Verification

### Syntax check
All four modified files pass `python3 -m py_compile`:
- `tools/muapi.py` — OK
- `tools/openai_tts.py` — OK
- `agents/text_to_movie.py` — OK
- `agents/video_generation.py` — OK

### Runtime import check
No backend `venv` exists in the target worktree, and `make test`/`pytest` cannot run without dependencies installed. The backend Makefile requires:
1. `make venv`
2. `make install`
3. `make test`

**No `backend/tests/` directory exists** in this repo (unlike upstream), so there is no existing test suite to run against.

**Full dependency-based verification deferred until backend deps are installed.**

---

## Step 7 — Files modified

| Path | Action |
|------|--------|
| `apps/director/backend/director/tools/muapi.py` | Added + 1 syntax fix + divergence comment |
| `apps/director/backend/director/tools/openai_tts.py` | Added |
| `apps/director/backend/director/agents/text_to_movie.py` | Overwritten with upstream version + upstream indentation fix + divergence comment |
| `apps/director/backend/director/agents/video_generation.py` | Overwritten with upstream version |
| `apps/director/backend/.env.sample` | Added `VITE_MUAPI_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

No other files in `apps/director` were modified.

---

## Follow-up 1 — OPENAI_API_KEY confirmation

`OPENAI_API_KEY=` was already present in `apps/director/backend/.env.sample` at line 24, before this task started. `openai_tts.py` can use it as-is. No new placeholder was needed.

## Follow-up 2 — Post-facto diff of overwritten agents

Both agents were diffed against their HEAD versions from git history after the overwrite. The diffs are purely engine-swap changes. No target-only business logic, bug fixes, or feature additions were present in the old target versions that are absent from upstream.

### text_to_movie.py — old vs new
- Removed imports: `KlingAITool`, `StabilityAITool`, `ElevenLabsTool`, `VDBAudioGenerationTool`
- Replaced with: `MuapiVideoTool`, `OpenAITTSTool`
- Engine lists changed from `["stabilityai", "kling", "videodb"]` to `["muapi"]`
- Audio engines changed from `["elevenlabs", "videodb"]` to `["openai"]`
- Config keys renamed: `video_stabilityai_config` / `video_kling_config` → `video_muapi_config`; `audio_elevenlabs_config` → `audio_openai_config`
- `generate_engine_prompt` switched from StabilityAI branch + Kling LLM-compress branch to a single MuAPI LLM-compress path
- Audio generation call switched from `generate_sound_effect(...)` to `text_to_speech(...)`
- Scene orchestration, VideoDB upload loop, asset combine, and error handling are byte-for-byte identical

### video_generation.py — old vs new
- Removed imports: `StabilityAITool`, `FalVideoGenerationTool`, `VDBVideoGenerationTool`
- Replaced with: `MuapiVideoTool`
- Engine list changed from `["stabilityai", "fal", "videodb"]` to `["muapi"]`
- Config keys renamed: `stabilityai_config`, `fal_config` → `muapi_config`
- Engine dispatch simplified from 3-way if/elif to single `muapi` branch
- Image URL resolution and text/image-to-video orchestration are otherwise identical
- Removed unused `VDBVideoGenerationTool` import; `VideoDBTool` retained for upload

**Conclusion:** Nothing was lost. The old target code contained only deprecated-engine wiring. Core agent behavior is preserved in the upstream replacements.

## Divergence comments added

Two upstream source bugs were fixed during copy and annotated in-file so they don't get reintroduced on later syncs:

1. `backend/director/tools/muapi.py` line 146 — f-string had unmatched double quotes:
   - Upstream: `f"Generation failed: {status_data.get("error", "Unknown error")}"`
   - Fixed to single quotes inside the f-string, with comment above

2. `backend/director/agents/text_to_movie.py` `generate_engine_prompt` — LLM compression block was over-indented by 4 spaces relative to the method body (SyntaxError). Fixed indentation and added docstring note explaining the divergence.

