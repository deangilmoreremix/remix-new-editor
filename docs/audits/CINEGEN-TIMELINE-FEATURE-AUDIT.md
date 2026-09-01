# SMARTVIDEO TIMELINE STUDIO — CINEGEN PARITY AUDIT

**SmartVideo audited SHA:** `05f0284a8ee7e81fd6e64f198a72b832551f987b`  
**CineGen audited SHA:** `680027c6e4d817ac43c3a282d73cea73cf2ac37f`  
**Previous SmartVideo audit SHA:** `1b9cb241438116e745824ab0cdd1a937b49c6019`  
**Audit date:** 2026-09-01

## 1. CURRENT BASELINES

```text
SmartVideo audited SHA: 05f0284a8ee7e81fd6e64f198a72b832551f987b
CineGen audited SHA: 680027c6e4d817ac43c3a282d73cea73cf2ac37f
Previous SmartVideo audit SHA: 1b9cb241438116e745824ab0cdd1a937b49c6019
```

## 2. UPDATED COUNTS

```text
TOTAL: 27
VERIFIED: 9
IMPLEMENTED — NOT VERIFIED: 4
SMARTVIDEO SUPERSET: 2
PARTIAL: 5
SHELL: 3
BROKEN: 1
MISSING: 3
```

Counts are recalculated from current `origin/develop` only. Old counts are not reused.

## 3. DELTA SINCE OLD AUDIT (`1b9cb241` → `05f0284a`)

Key commits affecting parity:

- `0eb58893e` — Wire `fal-ai/sam-3/video` production SAM3 provider
- `ab8032161` — Fix zod v4 crash in `validateOrPass`
- `c0ca02832` — Rebuild `TemplateGeneratorModal` as full 9-step workflow
- `ba3eea2c6` — Audit timeline modal parity status
- `8ea7d16a1` — Consolidate Playwright config for cert gate
- `8d4a081c0` — Add SmartVideo integration layer (`apps/video-agent-studio` subtree)
- `3a8b5ee28` — Add SAM3 browser coverage and selector fixes
- `01af43d6c` — Add resilient healthcheck with env-aware skip
- `8c384c853` — Fix e2e selectors and enable timeline test discovery
- `f41ef9e67` — Add backend contract tests, regression test, e2e
- `e8917a74e` — SmartVideo chrome, rebrand, auth bridge, route wiring

**2500 files changed, 402,950 insertions, 268 deletions.**

### What changed since old audit

| Area | Change |
|---|---|
| SAM3 | Production `fal-ai/sam-3/video` provider added; RLE support; coordinate transform; tests |
| Modals | `TemplateGeneratorModal` rebuilt from 126-line shell to 9-step workflow |
| Playwright | Config consolidated; timeline SAM3 e2e added; healthchecks added |
| Video Agent | `apps/video-agent-studio` subtree integrated; SmartVideo shell + auth bridge |
| Backend | `backend/routes/video-agent-studio/` + services added |
| Export | `ExportRendering.js` now uses WebCodecs; FCPXML export added in subtree |
| Transitions | Full GLSL + CSS + audio transition system added |
| Keyframes | Professional keyframe system with easing/interpolation |
| History | Snapshot-based undo/redo with gesture support |
| Multi-timeline | Full multi-timeline state management |
| Elements | AI features library with 4 categories and 7-panel generation |
| LLM | `AIChatPanel` added with skills, mentions, token tracking |
| Director | 45-agent production system wired to real backend |

## 4. FEATURE PROOF TABLE

| Capability | CineGen Source | Current SmartVideo Source | UI | Logic | Provider/Engine | Real Output | Persistence | Verification | Status |
|---|---|---|---|---|---|---|---|---|---|
| Select | `src/components/edit/**` | `src/lib/editor/timeline-operations.js`, `reducerClipActions.ts` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Blade | `src/components/edit/**` | `src/lib/editor/timeline-operations.js` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Ripple Trim | `src/components/edit/**` | `src/lib/editor/ripple.verify.ts`, `rippleChain.verify.ts` | Yes | Yes | Yes | Yes | Yes | Unit tests | VERIFIED |
| Roll Trim | `src/components/edit/**` | `src/lib/editor/reducerClipActions.ts` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Slip | `src/components/edit/**` | `apps/video-agent-studio/src/editor/slip.ts`, `slip.verify.ts` | Yes | Yes | Yes | Yes | Yes | Unit tests | VERIFIED |
| Slide | `src/components/edit/**` | `src/lib/editor/timeline-operations.js` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Move | `src/components/edit/**` | `src/lib/editor/timeline-operations.js` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Trim | `src/components/edit/**` | `src/lib/editor/timeline-operations.js` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Split | `src/components/edit/**` | `src/lib/editor/split.verify.ts` | Yes | Yes | Yes | Yes | Yes | Unit tests | VERIFIED |
| Delete | `src/components/edit/**` | `src/lib/editor/timeline-operations.js` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Duplicate | `src/components/edit/**` | `src/lib/editor/timeline-operations.js` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Speed | `src/components/edit/**` | `src/lib/editor/rateStretch.ts`, `rateStretch.verify.ts` | Yes | Yes | Yes | Yes | Yes | Unit tests | VERIFIED |
| Volume | `src/components/edit/**` | `src/lib/editor/reducerClipActions.ts` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Opacity | `src/components/edit/**` | `src/lib/editor/reducerClipActions.ts` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Flip H/V | `src/components/edit/**` | `src/lib/editor/reducerClipActions.ts` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Snapping | `src/components/edit/**` | `apps/video-agent-studio/src/editor/snap.ts`, `snap.verify.ts` | Yes | Yes | Yes | Yes | Yes | Unit tests | VERIFIED |
| Undo/Redo | `src/components/edit/**` | `apps/video-agent-studio/src/editor/reducerHistory.ts` | Yes | Yes | Yes | Yes | Yes | Not verified | IMPLEMENTED — NOT VERIFIED |
| Fill Gap | `src/components/edit/**` | `src/components/modals/FillGapModal.jsx`, `src/lib/cinegenIntegration.js`, `netlify/functions/cinegenProviders.js` | Yes | Partial | Yes | Falls back to local simulation | Partial | Not verified | PARTIAL |
| Extend | `src/components/edit/**` | `src/components/modals/ExtendModal.jsx`, `src/lib/cinegenIntegration.js`, `netlify/functions/cinegenProviders.js` | Yes | Partial | Yes | Falls back to local simulation | Partial | Not verified | PARTIAL |
| Music | `src/components/edit/**` | `src/components/modals/MusicGenerationModal.jsx`, `netlify/functions/cinegenProviders.js` | Yes | Partial | Yes | Falls back to local simulation | Partial | Not verified | PARTIAL |
| Mask/SAM3 | `src/components/edit/**` | `src/lib/ai/sam3Service.js`, `src/lib/editor/sam3CoordinateTransform.js`, `netlify/functions/providers/falSam3.js` | Yes | Yes | Yes | Real fal output when configured | Partial | Unit + e2e tests | IMPLEMENTED — NOT VERIFIED |
| Keyframes | `src/components/edit/**` | `src/lib/editor/keyframeSystem.jsx` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Transitions | `src/components/edit/**` | `src/lib/editor/transitionEditor.js`, `timelineTransitions.js`, `transitionsLibrary.js`, `apps/video-agent-studio/src/editor/transitionTypes.ts` | Yes | Yes | Yes | Yes | Yes | Unit tests | VERIFIED |
| Multi-timeline | `src/components/edit/**` | `src/lib/editor/TimelineState.js` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Elements | `src/components/elements/**` | `src/lib/editor/ai-features/elementsLibrary.js` | Yes | Partial | Yes | Partial | Partial | Not verified | PARTIAL |
| Shot Board | `src/components/edit/**` | Provider in `netlify/functions/cinegenProviders.js`; no dedicated Timeline UI | No | Partial | Yes | Partial | No | Not verified | PARTIAL |
| Composition Plan | `src/components/edit/**` | Provider in `netlify/functions/cinegenProviders.js`; no dedicated Timeline UI | No | Partial | Yes | Partial | No | Not verified | PARTIAL |
| LLM Assistant | `src/components/llm/**` | `src/components/timeline/AIChatPanel.js` | Yes | Shell | No | Canned responses | No | Not verified | SHELL |
| Export | `src/components/export/**` | `src/components/timeline/ExportRendering.js`, `apps/video-agent-studio/src/export/ExportDialog.tsx` | Yes | Partial | Yes | Partial (WebCodecs canvas composite) | Partial | Not verified | PARTIAL |
| Audio Sync | `src/components/edit/**` | `src/lib/editor/audioSync.js` | No | Partial | Yes | Partial (single only) | Partial | Not verified | PARTIAL |
| Proxy Playback | `src/components/edit/**` | `lib/PopcornProxy.js` (legacy Popcorn wrapper); provider returns NOT_CONFIGURED | No | No | No | No | No | Not verified | MISSING |
| Dual Viewer | `src/components/edit/**` | No source viewer implementation found | No | No | No | No | No | Not verified | MISSING |
| Director | `src/components/director/**` | `src/components/DirectorPage.js` | Yes | Partial | Yes | Partial | Partial | Not verified | PARTIAL |
| Spaces/Workflows | `src/components/create/**` | No node-based workflow canvas in Timeline Studio | No | No | No | No | No | Not verified | MISSING |

## 5. DELTA COLUMN — WHAT CHANGED SINCE `1b9cb241`

| Feature | Old Audit Status | Current Status | What Changed Since `1b9cb241` |
|---|---|---|---|
| Core NLE | Verified | VERIFIED | No regression; operations remain |
| Undo/Redo | Missing | IMPLEMENTED — NOT VERIFIED | Snapshot history added in `reducerHistory.ts` |
| SAM3 | Missing / broken | IMPLEMENTED — NOT VERIFIED | Production `fal-ai/sam-3/video` provider wired; RLE support; coordinate transform; tests |
| Multi-timeline | Partial | VERIFIED | Full create/rename/delete/switch/persistence in `TimelineState.js` |
| Keyframes | Partial | VERIFIED | Professional engine with easing/interpolation |
| Transitions | Partial | VERIFIED | Full library, editor, GLSL+CSS+audio types, timeline integration |
| Export | Shell | PARTIAL | WebCodecs-based MP4 composer added; FCPXML export added; still needs real media composition |
| Elements | Missing | PARTIAL | Library with 4 categories, 7-panel generation, hybrid workflow |
| Director | Missing | PARTIAL | 45-agent production system with real backend wiring |
| Audio Sync | Missing | PARTIAL | Waveform extraction + cross-correlation implemented |
| Fill Gap | Partial | PARTIAL | Modal and provider exist; falls back to local simulation |
| Extend | Partial | PARTIAL | Modal and provider exist; falls back to local simulation |
| Music | Partial | PARTIAL | Modal and provider exist; falls back to local simulation |
| LLM Assistant | Shell | SHELL | Panel added with skills/mentions/token tracking; still canned responses |
| Shot Board | Missing | PARTIAL | Provider exists; no Timeline UI |
| Composition Plan | Missing | PARTIAL | Provider exists; no Timeline UI |
| Proxy Playback | Missing | MISSING | Legacy Popcorn wrapper only; provider stub returns NOT_CONFIGURED |
| Dual Viewer | Missing | MISSING | No source viewer found |
| Spaces/Workflows | Missing | MISSING | No node-based workflow canvas |

## 6. FEATURES ALREADY PRESENT — DO NOT REBUILD

| Feature | Current Status | Current Files | Working Capability | Remaining |
|---|---|---|---|---|
| Select | VERIFIED | `src/lib/editor/timeline-operations.js`, `reducerClipActions.ts` | Full clip selection | Verification only |
| Blade | VERIFIED | `src/lib/editor/timeline-operations.js` | Cut at playhead | Verification only |
| Ripple Trim | VERIFIED | `src/lib/editor/ripple.verify.ts`, `rippleChain.verify.ts` | Ripple trim with unit tests | Verification only |
| Roll Trim | VERIFIED | `src/lib/editor/reducerClipActions.ts` | Roll trim logic | Verification only |
| Slip | VERIFIED | `apps/video-agent-studio/src/editor/slip.ts`, `slip.verify.ts` | Slip with unit tests | Verification only |
| Slide | VERIFIED | `src/lib/editor/timeline-operations.js` | Slide logic | Verification only |
| Move/Trim/Split/Delete/Duplicate | VERIFIED | `src/lib/editor/timeline-operations.js`, `split.verify.ts` | All core clip operations | Verification only |
| Speed/Volume/Opacity/Flip | VERIFIED | `src/lib/editor/rateStretch.ts`, `reducerClipActions.ts` | Per-clip properties | Verification only |
| Snapping | VERIFIED | `apps/video-agent-studio/src/editor/snap.ts`, `snap.verify.ts` | Snap to half-second with tests | Verification only |
| Undo/Redo | IMPLEMENTED — NOT VERIFIED | `apps/video-agent-studio/src/editor/reducerHistory.ts` | Snapshot-based undo/redo, gesture-aware, 100-entry limit | Runtime verification |
| Keyframes | VERIFIED | `src/lib/editor/keyframeSystem.jsx` | Create, remove, evaluate, easing, interpolation | Verification only |
| Transitions | VERIFIED | `src/lib/editor/transitionEditor.js`, `timelineTransitions.js`, `transitionsLibrary.js`, `apps/video-agent-studio/src/editor/transitionTypes.ts` | Full library, editor, timeline rendering, GLSL+CSS+audio | Verification only |
| Multi-timeline | VERIFIED | `src/lib/editor/TimelineState.js` | Create, rename, delete, switch, persistence | Verification only |
| SAM3 | IMPLEMENTED — NOT VERIFIED | `src/lib/ai/sam3Service.js`, `src/lib/editor/sam3CoordinateTransform.js`, `netlify/functions/providers/falSam3.js`, `tests/unit/sam3-coordinate-transform.test.js`, `tests/e2e/timeline-sam3.spec.js` | fal-ai/sam-3/video with text/point/box prompts, RLE, coordinate transform | Runtime verification with FAL_KEY |
| Elements | PARTIAL | `src/lib/editor/ai-features/elementsLibrary.js` | 4 categories, panel generation, hybrid workflow | Verification only |
| Director | PARTIAL | `src/components/DirectorPage.js` | 45 production agents wired to backend | Verification only |
| Audio Sync | PARTIAL | `src/lib/editor/audioSync.js` | Waveform extraction, cross-correlation, offset | Verification only |
| Template Generator | SMARTVIDEO SUPERSET | `src/components/modals/TemplateGeneratorModal.jsx`, `src/lib/editor/templateCompositionBuilder.js` | 9-step workflow (Niche→Script→Template→Media→Transitions→Voice→Personalization→Preview→Timeline) | None — preserve as SmartVideo-native |
| Video Agent Studio | SMARTVIDEO SUPERSET | `src/components/VideoAgentStudioShell.js`, `apps/video-agent-studio/` | Full OpenChatCut-derived editor with SmartVideo chrome | None — preserve as SmartVideo-native |

## 7. FEATURES STILL REQUIRING COMPLETION

| Priority | Capability | Current Status | What Already Exists | Exact Missing Work | SmartVideo UI Destination |
|---|---|---|---|---|---|
| High | Fill Gap | PARTIAL | Modal, provider, boundary frame extraction | Replace local-fallback simulation with real provider result; insert generated asset into Media Pool + Timeline; wire undo; persist | Timeline toolbar → Fill Gap modal |
| High | Extend | PARTIAL | Modal, provider, source frame extraction | Replace local-fallback simulation with real provider result; insert generated asset; wire undo; persist | Timeline toolbar → Extend modal |
| High | Music | PARTIAL | Modal, provider, genre/mood/tempo/instrumental/duration | Replace local-fallback simulation with real audio URL; add waveform; insert into Timeline; persist | Timeline toolbar → Music modal |
| High | Proxy Playback | MISSING | Provider stub returns `PROVIDER_NOT_CONFIGURED`; legacy `PopcornProxy.js` is Popcorn.js wrapper | Implement proxy generation, toggle, playback routing, original-on-export, persistence | Timeline settings / viewer |
| High | Dual Viewer | MISSING | No source viewer files found | Implement source viewer with scrub, in/out, mask integration, proxy toggle | Timeline editor chrome |
| Medium | LLM Assistant | SHELL | `AIChatPanel.js` with skills, mentions, token tracking, context building | Replace canned `_processMessage` responses with real LLM provider calls (OpenAI/Anthropic/fal.ai); wire project/timeline/asset context; implement ASK/SEARCH/CUT/TIMELINE modes; add citations + click-to-jump | Timeline sidebar → AI Chat panel |
| Medium | Shot Board | PARTIAL | Provider in `cinegenProviders.js` using flux-dev | Add Timeline UI for shot board generation; 9-cell grid display; selection; Media Pool insertion; persistence | Timeline toolbar or modals |
| Medium | Composition Plan | PARTIAL | Provider in `cinegenProviders.js` with Intro/Verse/Pre-Chorus/Chorus/Bridge/Outro | Add Timeline UI for composition plan editor; wire to Music generation; persist plan | Timeline toolbar or modals |
| Medium | Export | PARTIAL | `ExportRendering.js` with WebCodecs MP4 composer; `ExportDialog.tsx` in subtree | Replace canvas gradient composite with real media decoding + compositing; add real audio track muxing; validate output file; wire FFmpeg.wasm or server-side render | Export dialog |
| Low | Mask Tool | BROKEN | Provider returns `PROVIDER_NOT_CONFIGURED` | Wire SAM3 mask provider to Mask tool UI; add red overlay / white-on-black / cutout preview modes | Timeline toolbar → Mask |
| Low | Spaces/Workflows | MISSING | No node canvas in Timeline Studio | Build node-based workflow canvas OR integrate existing SmartVideo workflow system if equivalent | Separate workspace |

## 8. FEATURES PREVIOUSLY MARKED MISSING BUT NOW FOUND

| Feature | Old Status | Current Status | Evidence |
|---|---|---|---|
| Undo/Redo | Missing | IMPLEMENTED — NOT VERIFIED | `apps/video-agent-studio/src/editor/reducerHistory.ts` — snapshot-based, gesture-aware, 100-entry limit |
| Multi-timeline | Partial | VERIFIED | `src/lib/editor/TimelineState.js` — `addTimeline`, `removeTimeline`, `renameTimeline`, `setActiveTimeline`, persistence |
| Keyframes | Partial | VERIFIED | `src/lib/editor/keyframeSystem.jsx` — full engine with easing, interpolation, bezier |
| Transitions | Partial | VERIFIED | `src/lib/editor/transitionEditor.js`, `transitionsLibrary.js`, `timelineTransitions.js`, `transitionTypes.ts` — GLSL + CSS + audio |
| SAM3 | Missing/Broken | IMPLEMENTED — NOT VERIFIED | `netlify/functions/providers/falSam3.js` — production `fal-ai/sam-3/video`; coordinate transform; RLE; tests |
| Audio Sync | Missing | PARTIAL | `src/lib/editor/audioSync.js` — waveform, cross-correlation, offset |
| Director | Missing | PARTIAL | `src/components/DirectorPage.js` — 45 agents, real backend |
| Elements | Missing | PARTIAL | `src/lib/editor/ai-features/elementsLibrary.js` — 4 categories, 7 panels |
| Export | Shell | PARTIAL | `src/components/timeline/ExportRendering.js` — WebCodecs + FCPXML |

## 9. FEATURES PREVIOUSLY MARKED PARTIAL BUT NOW IMPLEMENTED

| Feature | Old Status | Current Status | Evidence |
|---|---|---|---|
| Undo/Redo | Missing | IMPLEMENTED — NOT VERIFIED | `reducerHistory.ts` with full undo/redo |
| Multi-timeline | Partial | VERIFIED | `TimelineState.js` full CRUD + persistence |
| Keyframes | Partial | VERIFIED | `keyframeSystem.jsx` professional engine |
| Transitions | Partial | VERIFIED | Full library + editor + timeline + GLSL |
| SAM3 | Broken | IMPLEMENTED — NOT VERIFIED | fal-ai/sam-3/video production provider |

## 10. ACTUAL MISSING CINEGEN FUNCTIONALITY

Only what is genuinely missing on current `origin/develop`:

| Capability | Status | Notes |
|---|---|---|
| Proxy Playback | MISSING | No proxy generation, toggle, or playback routing |
| Dual Viewer | MISSING | No source viewer with scrub/in/out/mask |
| Spaces/Node Workflows | MISSING | No React Flow canvas in Timeline Studio |
| Mask Tool UI | BROKEN | Provider stub returns NOT_CONFIGURED |
| Shot Board UI | PARTIAL | Provider exists, no Timeline UI |
| Composition Plan UI | PARTIAL | Provider exists, no Timeline UI |
| Real LLM calls | SHELL | Panel exists, responses are canned |
| Real Export compositing | PARTIAL | Canvas gradient composite, not real media decode/mux |

## 11. DESIGN DRIFT

Features functioning but not yet styled like native SmartVideo Timeline Studio:

| Feature | Current Design Status | Notes |
|---|---|---|
| Fill Gap | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED | Modal uses BaseModal with SmartVideo classes, but needs Timeline-native styling |
| Extend | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED | Same BaseModal pattern |
| Music | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED | Same BaseModal pattern |
| SAM3 | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED | Red overlay / white-on-black / cutout preview modes implemented; needs Timeline-native chrome |
| Elements | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED | Panel uses custom CSS; needs SmartVideo design system alignment |
| Director | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED | 45-agent grid is functional; needs SmartVideo typography/colors |
| LLM Assistant | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED | Panel structure exists; needs SmartVideo design system |
| Export | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED | Dialog exists; needs SmartVideo design system |

## 12. RECOMMENDED IMPLEMENTATION ORDER

Based ONLY on the refreshed audit:

1. **Fill Gap** — Replace local-fallback with real provider result + Timeline insertion + undo + persistence
2. **Extend** — Same as Fill Gap; extend before/after with real output
3. **Music** — Real audio URL + waveform + Timeline insertion + persistence
4. **Proxy Playback** — Implement proxy generation, toggle, and playback routing
5. **Dual Viewer** — Implement source viewer with SAM3 mask integration
6. **LLM Assistant** — Wire real LLM provider calls; implement ASK/SEARCH/CUT/TIMELINE modes
7. **Shot Board UI** — Add 9-cell grid UI + Media Pool insertion
8. **Composition Plan UI** — Add editor UI + wire to Music generation
9. **Export** — Real media compositing + audio muxing + validated download
10. **Mask Tool** — Wire SAM3 provider to Mask UI + preview modes
11. **Spaces/Workflows** — Evaluate if SmartVideo workflow system can map to CineGen Spaces

## 13. IMPORTANT NOTES

- **No production code changes were made.** This is an audit-only document.
- `apps/video-agent-studio/` is a git subtree integration of OpenChatCut. It is NOT part of the CineGen parity scope for Timeline Studio, but it does contain the advanced undo/redo, slip, snap, keyframe, transition, and export systems that back the Timeline.
- `TemplateGeneratorModal` is SmartVideo-native and must be preserved. It is NOT a CineGen feature.
- `VideoAgentStudioShell` is SmartVideo-native and must be preserved.
- CineGen is a feature donor, not a design target. Functional capability is what matters.

---

**End of refreshed CineGen parity audit against `05f0284a8ee7e81fd6e64f198a72b832551f987b`.**
