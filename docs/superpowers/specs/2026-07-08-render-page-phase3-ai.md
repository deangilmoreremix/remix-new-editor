# Render Page — Phase 3: AI Finishing

**Date:** 2026-07-08
**Status:** Ready for implementation
**Branch:** `incandescent-cheese`

## 1. Problem

Phase 1 made the foundation real. Phase 2 made export real. Now 5 AI-powered actions need real implementations:
- Add Subtitles
- Dub / Voiceover
- Generate Highlights
- Create Shorts
- AI Auto-Edit

Currently all 5 show "Phase 3: coming soon" toasts. The codebase already has real services that can be wired up:
- `src/services/whisper-client.js` — real Whisper transcription
- `src/components/timeline/SceneDetector.js` — scene detection API (with fallback)
- `src/lib/services/aiService.js` — MuAPI integration for AI effects
- `src/lib/editor/aiMuapi.js` — AI video/image processing

## 2. Goal

Wire all 5 Phase 3 actions to real implementations using existing services. Each action becomes functional end-to-end.

## 3. Non-Goals

- No new AI models or services
- No changes to upstream call sites
- No removal of any UI elements
- No server-side deployment changes

## 4. Architecture

### 4.1 New files

```
src/lib/editor/renderAiActions.js   NEW: AI action implementations
```

### 4.2 Modified files

- `src/components/RenderPage.js` — add Phase 3 handlers
- `src/lib/editor/renderWorker.js` — extend to support subtitle burn-in, effects

### 4.3 Service integration

| Action | Service | Method |
|---|---|---|
| Add Subtitles | `whisper-client.js` | `transcribe(audioSource, options)` → SRT/VTT |
| Generate Highlights | `SceneDetector.js` | `callSceneDetectionAPI(videoUrl)` → scene list |
| Dub / Voiceover | MuAPI TTS | `aiService.generateAudio(prompt, voice)` |
| Create Shorts | SceneDetector + export | Detect scenes → select best → resize 9:16 → export |
| AI Auto-Edit | Orchestration | Run scene detection → highlights → subtitles → export |

## 5. Detailed Changes

### 5.1 `src/lib/editor/renderAiActions.js` (new)

```js
// Functions:
export async function generateSubtitles(videoUrl, language) // uses whisper-client
export async function generateHighlights(videoUrl, sensitivity) // uses SceneDetector API
export async function generateVoiceover(script, voice) // uses MuAPI TTS
export async function createShorts(videoUrl, maxDuration) // scene detection + resize
export async function runAiAutoEdit(videoUrl, options) // orchestrate multiple steps
```

### 5.2 `src/components/RenderPage.js` (modified)

Add Phase 3 handlers:
- `Add Subtitles`: Extract audio from video → call whisper → generate SRT → offer download
- `Dub / Voiceover`: Generate voiceover from prompt → overlay on video → export
- `Generate Highlights`: Detect scenes → select top 3 → create highlight reel
- `Create Shorts`: Detect scenes → select best 60s → resize 9:16 → export
- `AI Auto-Edit`: Run full pipeline (scene detect → highlights → subtitles → export)

Each handler shows progress, handles errors, and provides downloadable output.

## 6. Testing

- `src/test/render-ai-actions.test.js` — mock service calls, verify orchestration
- Manual: each action produces expected output (SRT file, MP4 with subtitles, etc.)

## 7. Rollout

- Single PR: `feat(render): phase 3 AI finishing`
- All actions use existing backend services (MuAPI, Whisper)
- Graceful fallbacks when services unavailable
