# MuAPI → VideoDB/Director Migration Plan

**Purpose:** Enumerate every place the app calls **MuAPI** (`api.muapi.ai`) and decide whether it
should move to **VideoDB** (via the **Director** backend, `apps/director/backend`), stay on MuAPI,
or be removed. This supports the "Render Studio must use real APIs, no mock" mandate and the spec's
rule: *"Keep Director as the finishing engine."*

**Legend**
- ✅ **Move to VideoDB/Director** — VideoDB can do it; MuAPI was a stand-in.
- ⚠️ **Optional move** — VideoDB *can* do it but swaps the underlying model provider (quality/style change). Product decision.
- ❌ **Keep MuAPI** — VideoDB has no equivalent.

---

## 1. Render Studio finishing ops (SPEC-MANDATED move) ✅

These are post-production operations. The spec explicitly says finishing must go through Director.
The committed `src/lib/editor/renderAiActions.js` still calls MuAPI — this is the primary drift.

| Feature | Current MuAPI path | VideoDB/Director agent | File:line |
|---|---|---|---|
| Subtitles | `whisperService.transcribe` (MuAPI / local `:8080`) | `subtitle` / `transcription` | `renderAiActions.js:83` |
| Scene detection | `SceneDetector.callSceneDetectionAPI` (MuAPI `transnet-v2`) | `scenes` | `renderAiActions.js:140` |
| Highlights | `detectScenes` → above | `highlight_reel` | `renderAiActions.js:101,237` |
| Shorts | `detectScenes` → above | `scenes` → `social` (reframe) | `renderAiActions.js:189` |
| Voiceover / TTS | `aiService.muapi.generateAudio` | `voiceover` | `renderAiActions.js:170` |
| Auto-Edit plan | (none) | OpenAI Responses API (orchestration) | `renderAiActions.js:224` |

**Target:** rewrite `renderAiActions.js` to call `src/lib/directorClient.js` (Director `subtitle`,
`scenes`, `highlight_reel`, `voiceover`) + `src/lib/openaiResponses.js` (plan). This makes the
existing `src/test/render-ai-actions.test.js` (already Director-shaped) pass.

**Note:** `browserVideoProcessor.js` does real in-browser frame analysis (motion highlights, TTS) —
keep as a non-mock local fallback, not a substitute for Director.

---

## 2. Video post-processing studios ✅

| Feature | Current | VideoDB/Director | File:line |
|---|---|---|---|
| Video tools (trim/speed/etc.) | `muapi.processVideoTool` | `editing` agents + `speed`/`stabilize`/`reverse`/`color` | `VideoToolsStudio.js:151` |
| Reverse video | (via processVideoTool) | `reverse_agent` | — |
| Stabilize | — | `stabilize_agent` | — |
| Speed adjust | — | `speed_agent` | — |
| Color / enhance / upscale | `muapi.generateI2I` (UpscaleStudio) | `enhancer` | `UpscaleStudio.js:125` |
| B-roll / branding / social / trailer | — | `broll_agent` / `branding` / `social_agent` / `trailer_agent` | — |

---

## 3. Image / video generation ⚠️ OPTIONAL

VideoDB's Director has `image_generation` and `video_generation` agents, but they run on
**Fal / Stability / VideoDB engines**, *not* MuAPI's models (e.g. `nano-banana`). Moving these
changes output style/quality. Decide per-studio.

| Feature | Current | VideoDB/Director | File:line |
|---|---|---|---|
| Image t2i/i2i | `muapi.generateImage` / `generateI2I` | `image_generation` | `ImageStudio.js:1126,1109`; `EditStudio.js:206`; `CharacterStudio.js:209`; `CommercialStudio.js:173`; `InfluencerStudio.js:152`; `CinematicTemplateWizard.js:369`; `StoryboardStudio.js:175`; `CinemaStudio.js:701`; `TemplateStudio.js:658,656`; `cinegen.js:11` |
| Video t2v/i2v | `muapi.generateVideo` / `generateI2V` | `video_generation` | `VideoStudio.js:1224,1181`; `EffectsStudio.js:388,390`; `CinematicTemplateWizard.js:371`; `TemplateStudio.js:654`; `cinegen.js:36,39` |
| Video effects | `aiService.muapi.generateVideoEffect` | `video_generation` | `aiService.js:227` |
| Image/video via aiService | `muapi.generateImage/Video` | `image_generation` / `video_generation` | `aiService.js:93,161` |

**Recommendation:** Leave generation on MuAPI for now (it works, models differ). Move only when
you want a single vendor. The finishing layer (§1, §2) is the priority.

---

## 4. MuAPI-ONLY (cannot move to VideoDB) ❌

| Feature | Why VideoDB can't replace | File:line |
|---|---|---|
| **LoRA training** | No model-training endpoint in VideoDB | `TrainingStudio.js:208` (`muapi.trainLora`) |
| **Voice cloning** | Director `clone_voice` delegates to external TTS (ElevenLabs), not pure VideoDB | `clone_voice.py` (Director) |
| **File upload** | Upload target is different API (`videodb_tool.upload` for VideoDB, MuAPI upload for MuAPI asset store) — not interchangeable | `UploadPicker.js:341,357`; `VideoStudio.js:199`; `LipSyncStudio.js:459,485,511` |
| **LLM chat / text** | Unrelated to video; keep MuAPI or OpenAI | `ChatStudio.js:233` (`muapi.generateText`) |
| **General audio/music** | Director `audio_generation` is VideoDB-specific; MuAPI audio is a separate service | `AudioStudio.js:191`; `cinegen.js:42`; `renderAiActions.js:170` (covered by `voiceover` in §1) |

---

## 5. Prerequisites before any move works

1. **Director backend deployed** on Render (blocked by the 2026-07-16 Render outage — all regions).
   Blueprint `apps/director/render.yaml` validates cleanly (`valid: true`).
2. **`VIDEO_DB_API_KEY`** + **`OPENAI_API_KEY`** set on `director-backend` (both `sync: false`).
3. **Frontend proxy** wired: dev `VITE_DIRECTOR_API_URL`, production `DIRECTOR_API_URL` (Netlify
   `netlify.toml` redirect added in commit `952a27e5`).
4. **No `simulated` fallback** remains — `directorAgentRuntime.js` now throws on total backend
   failure; `SceneDetector` throws when unavailable; `renderQueueStore` marks jobs `failed`.

## 6. Recommended execution order

1. **§1 Render Studio finishing** → rewrite `renderAiActions.js` to Director/VideoDB. Unblocks the
   failing `render-ai-actions.test.js` and fulfills the spec. **Highest priority.**
2. **§2 Video post-processing studios** → route `VideoToolsStudio`, `UpscaleStudio` to Director
   editing/enhancer agents.
3. **§3 Generation** → optional, later, after deciding on model-provider consistency.
4. **§4** → leave on MuAPI; document as intentionally MuAPI-only.

## 7. Verification

- Every moved feature must return a **real, different** URL from Director; never `simulated: true`.
- `curl <director-backend>/config/check` green; real `subtitle` agent call returns non-mock URL.
- No `/mock/`, `placeholder.supabase.co`, `mock_user`, or hardcoded scene arrays in source.
- Console must show backend errors loudly, not silent success.
