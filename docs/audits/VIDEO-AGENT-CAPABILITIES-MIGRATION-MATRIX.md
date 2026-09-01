# Video Agent Capabilities — Migration Matrix

> Phase 5: every existing capability on the legacy `video-agent` route
> (`src/components/VideoAgentPage.js`) and its `backend/services/videoAgentService.js`
> backend is enumerated here. For each row we record whether OpenChatCut
> has a stronger equivalent, whether the capability should be re-exposed
> as a SmartVideo agent tool, and the current migration status.

Status legend:
* **KEEP** — keep the existing SmartVideo implementation in place.
* **MIGRATE** — move the capability to the new Video Agent Studio (it
  is registered as a SmartVideo agent tool).
* **REPLACE** — OpenChatCut already provides a stronger equivalent
  inside the new studio; the SmartVideo tool is deprecated in favour
  of the studio capability, but the SmartVideo HTTP endpoint remains
  for legacy callers until parity is proven.
* **PARITY** — replaced AND verified equivalent.
* **PARITY-PENDING** — replaced, parity test still required.

| Existing capability | SmartVideo impl | OpenChatCut equivalent | Migration action | Status |
| --- | --- | --- | --- | --- |
| Scene Detection | `backend/services/sceneDetectionService.js`, `AI_TOOLS.scene-detection` in `VideoAgentPage.js` | `src/scene-detection/`, agent tools in `src/agent/tools/*` | REPLACE with studio scene tools; keep SmartVideo endpoint as fallback | PARITY-PENDING |
| Highlight Detection | `AI_TOOLS.highlight-detection`, backend `highlights` action | agent `highlight-tools` (see `src/agent/tools/highlight-*`) | REPLACE | PARITY-PENDING |
| Visual Search | `AI_TOOLS.visual-search` | agent visual-search / semantic-search tools | REPLACE | PARITY-PENDING |
| Keyword Search & Compilation | `AI_TOOLS.keyword-search` | transcript search tools in `src/transcript/` | REPLACE | PARITY-PENDING |
| ImageBind (multimodal) | `AI_TOOLS.imagebind` | vision / capabilities.ts | REPLACE (capability) | PARITY-PENDING |
| Subtitle / SRT Agent | `AI_TOOLS.subtitle` + `backend/services/speechTranscriptionService.js` | `src/transcript/`, `src/captions/` (full subtitle engine) | REPLACE | PARITY-PENDING |
| Profanity Remover | `AI_TOOLS.profanity` | caption / content tools | REPLACE | PARITY-PENDING |
| Automated Highlights | `AI_TOOLS.highlights` | highlight tools | REPLACE | PARITY-PENDING |
| Storyboarding Agent | `AI_TOOLS.storyboarding` | `src/script/`, `src/storyboard` agent tools | REPLACE | PARITY-PENDING |
| Text-to-Movie | `AI_TOOLS.text-to-movie` | `src/script/`, `src/generate/` | REPLACE | PARITY-PENDING |
| Text-to-Video | `AI_TOOLS.text-to-video` | `src/generate/`, `src/agent/tools/generation-*` | REPLACE (uses SmartVideo model registry) | PARITY-PENDING |
| Kids Storyteller | `AI_TOOLS.kids-storyteller` | script/generate pipeline | REPLACE | PARITY-PENDING |
| Faceless Video Creator | `AI_TOOLS.faceless-video` | script/generate pipeline | REPLACE | PARITY-PENDING |
| AI Ad Films | `AI_TOOLS.ai-ad-films` | script/generate pipeline | REPLACE | PARITY-PENDING |
| TikTok Lyric Videos | `AI_TOOLS.tiktok-lyric` | audio + script pipeline | REPLACE | PARITY-PENDING |
| Year in Frames | `AI_TOOLS.year-in-frames` | timeline + asset pipeline | REPLACE | PARITY-PENDING |
| Trailer Narration | `AI_TOOLS.trailer-narration` | `src/audio/`, narration tools | REPLACE | PARITY-PENDING |
| CosyVoice (TTS / clone) | `AI_TOOLS.cosyvoice` | `src/transcript/`, `server/plugins/voice.ts` | REPLACE | PARITY-PENDING |
| Fish Speech (TTS) | `AI_TOOLS.fish-speech` | `server/plugins/voice.ts` | REPLACE | PARITY-PENDING |
| Seed-VC (voice conversion) | `AI_TOOLS.seed-vc` | `src/audio/`, voice tools | REPLACE | PARITY-PENDING |
| Whisper (transcription) | `AI_TOOLS.whisper` + `speechTranscriptionService` | `src/transcript/`, `server/plugins/transcription.ts` | REPLACE | PARITY-PENDING |
| Voice Cloning Agent | `AI_TOOLS.voice-cloning` | `server/plugins/voice.ts` | REPLACE | PARITY-PENDING |
| Gen AI Audio Overlays | `AI_TOOLS.audio-overlay` | `src/audio/` | REPLACE | PARITY-PENDING |
| AI Voiceovers | `AI_TOOLS.ai-voiceovers` | `src/audio/`, `server/plugins/voice.ts` | REPLACE | PARITY-PENDING |
| Dubbing Agent | `AI_TOOLS.dubbing` | `src/transcript/`, voice tools | REPLACE | PARITY-PENDING |
| Multi-Language Dubbing | `AI_TOOLS.multi-lang-dubbing` | `src/transcript/`, voice tools | REPLACE | PARITY-PENDING |
| Clip Segmentation | `AI_TOOLS.clip-segmentation` | `src/agent/tools/edit-*` (split, trim) | REPLACE | PARITY-PENDING |
| Color Correction | `AI_TOOLS.color-correct` | `src/color/`, `src/agent/tools/color-scope-tools.ts`, `auto-grade-tools.ts` | REPLACE | PARITY-PENDING |
| Video Upscale | `AI_TOOLS.upscale` | `src/agent/tools/auto-grade-tools.ts` + SmartVideo Upscale Studio | REPLACE | PARITY-PENDING |
| Stabilize | `AI_TOOLS.stabilize` | OpenChatCut has stabilized clip ops via `edit-item-*` | REPLACE | PARITY-PENDING |
| Intro / Outro | `AI_TOOLS.intro-outro` | script + clip ops | REPLACE | PARITY-PENDING |
| Brand Elements | `AI_TOOLS.brand-elements` | design / overlay tools | REPLACE | PARITY-PENDING |
| Dynamic Ads | `AI_TOOLS.dynamic-ads` | `src/components/personalize/`, `src/agent/tools/personalize-*` | REPLACE | PARITY-PENDING |
| Intelligent Output Formatting | `AI_TOOLS.output-formatting` | `src/export/` | REPLACE | PARITY-PENDING |
| Sales Assistant Agent (CRM) | `AI_TOOLS.sales-assistant` | not present in OpenChatCut directly; SmartVideo CRM integration | KEEP SmartVideo endpoint; expose as tool | MIGRATE |
| Slack Agent | `AI_TOOLS.slack` | not present in OpenChatCut | KEEP SmartVideo endpoint; expose as tool | MIGRATE |
| Thumbnail Agent | `AI_TOOLS.thumbnail` | not present in OpenChatCut | KEEP SmartVideo; expose as tool | MIGRATE |
| Comparison Agent | `AI_TOOLS.comparison` | not present in OpenChatCut | KEEP SmartVideo; expose as tool | MIGRATE |
| Use case: Stand-up Comedy | `USE_CASES.standup` | agent + asset pipeline | REPLACE | PARITY-PENDING |
| Use case: Commentary | `USE_CASES.commentary` | audio + script | REPLACE | PARITY-PENDING |
| Use case: Video Overview | `USE_CASES.overview` | agent summarisation | REPLACE | PARITY-PENDING |
| Use case: Meme Generator | `USE_CASES.meme` | captions + clips | REPLACE | PARITY-PENDING |
| Use case: Music Video | `USE_CASES.music-video` | audio intelligence | REPLACE | PARITY-PENDING |
| Use case: Video Q&A | `USE_CASES.qa` | not directly available | KEEP SmartVideo; expose as tool | MIGRATE |

## Verification rules

A capability only moves from **PARITY-PENDING** to **PARITY** when:

1. A parity test (see `docs/video-agent/TESTING.md`) covers the same
   input/output shape the SmartVideo endpoint used to expose.
2. The studio UI can perform the same end-user action (e.g. "split
   clip at silence") without re-uploading media.
3. The SmartVideo HTTP endpoint either is removed or is kept only as
   a documented back-compat shim.

Until then the SmartVideo endpoint MUST continue to work, and the new
Video Agent Studio must NOT silently replace it.
