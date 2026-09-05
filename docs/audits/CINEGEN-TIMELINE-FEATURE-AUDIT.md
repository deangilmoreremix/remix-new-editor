Corrected: this audit is now scoped to the Timeline Editor only, and every entry below is a CineGen-derived capability added to or claimed by the Timeline Editor. SmartVideo-native modals/pages and non-timeline surfaces are excluded.

# SMARTVIDEO TIMELINE STUDIO — TIMELINE-ONLY CINEGEN PARITY AUDIT

**SmartVideo audited SHA:** **`05f0284a8ee7e81fd6e64f198a72b832551f987b`** **CineGen audited SHA:** **`680027c6e4d817ac43c3a282d73cea73cf2ac37f`** **Previous SmartVideo audit SHA:** **`1b9cb241438116e745824ab0cdd1a937b49c6019`** **Audit date:** 2026-09-01

**Scope:** Only **`src/components/TimelineEditorPage.jsx`**, **`src/components/timeline/**`**, **`src/components/modals/{FillGapModal,ExtendModal,MusicGenerationModal}.jsx`**, **`src/lib/editor/{TimelineState,keyframeSystem,timelineTransitions,transitionEditor,transitionsLibrary,audioSync,sam3CoordinateTransform,cinegenIntegration}.js{,x}`**, **`src/components/timeline/AIChatPanel.js`**, **`src/components/timeline/ExportRendering.js`**, **`netlify/functions/{cinegen.js,cinegenProviders.js,providers/falSam3.js}`**. SmartVideo-native modals/pages and non-timeline apps are excluded.

---

## 1. BASELINES

```
SmartVideo audited SHA: 05f0284a8ee7e81fd6e64f198a72b832551f987b
CineGen audited SHA: 680027c6e4d817ac43c3a282d73cea73cf2ac37f
Previous SmartVideo audit SHA: 1b9cb241438116e745824ab0cdd1a937b49c6019
```

---

## 2. TIMELINE COUNTS

```
TOTAL: 13
VERIFIED: 3
IMPLEMENTED — NOT VERIFIED: 2
PARTIAL: 5
SHELL: 1
BROKEN: 1
MISSING: 1
SMARTVIDEO SUPERSET: 0
```

---

## 3. FEATURE PROOF TABLE — TIMELINE EDITOR ONLY

| Capability | CineGen Source | Current SmartVideo Source | UI | Logic | Provider/Engine | Real Output | Persistence | Verification | Status |
|---|---|---|---|---|---|---|---|---|---|
| Fill Gap | `src/components/edit/**`, Netlify providers | `src/components/modals/FillGapModal.jsx`, `src/lib/cinegenIntegration.js`, `netlify/functions/cinegenProviders.js` | Yes | Partial | Yes | Falls back to local simulation; no confirmed real URL insertion | Partial | Not verified | PARTIAL |
| Extend | `src/components/edit/**`, Netlify providers | `src/components/modals/ExtendModal.jsx`, `src/lib/cinegenIntegration.js`, `netlify/functions/cinegenProviders.js` | Yes | Partial | Yes | Falls back to local simulation; no confirmed real URL insertion | Partial | Not verified | PARTIAL |
| Music | `src/components/edit/**`, Netlify providers | `src/components/modals/MusicGenerationModal.jsx`, `netlify/functions/cinegenProviders.js` | Yes | Partial | Yes | Falls back to local simulation; no confirmed real audio URL | Partial | Not verified | PARTIAL |
| Mask / SAM3 | `src/components/edit/**`, fal.ai SAM 3 | `src/lib/ai/sam3Service.js`, `src/lib/editor/sam3CoordinateTransform.js`, `netlify/functions/providers/falSam3.js` | Partial | Partial | Production `fal-ai/sam-3/video` + RLE path | Real when `FAL_KEY` configured; Mask UI returns `PROVIDER_NOT_CONFIGURED` | Partial | Unit + e2e tests | BROKEN |
| Keyframes | `src/components/edit/**` | `src/lib/editor/keyframeSystem.jsx` | Yes | Yes | Yes | Yes | Partial | Not verified | VERIFIED |
| Transitions | `src/components/edit/**` | `src/lib/editor/transitionEditor.js`, `src/lib/editor/timelineTransitions.js`, `src/lib/editor/transitionsLibrary.js` | Yes | Yes | Yes | Yes | Partial | Not verified | VERIFIED |
| Multi-timeline | `src/components/edit/**` | `src/lib/editor/TimelineState.js` | Yes | Yes | Yes | Yes | Yes | Not verified | VERIFIED |
| Audio Sync | `src/components/edit/**` | `src/lib/editor/audioSync.js` | No | Partial | Yes | Single-pair offset only; no batch UI | Partial | Not verified | PARTIAL |
| Proxy Playback | `src/components/edit/**` | No Timeline provider or toggle found in timeline scope | No | No | No | No | No | Not verified | MISSING |
| Dual Viewer | `src/components/edit/**` | No source viewer found in timeline scope | No | No | No | No | No | Not verified | MISSING |
| LLM Assistant | `src/components/llm/**` | `src/components/timeline/AIChatPanel.js` | Yes | Shell | No | Canned `_processMessage` responses | No | Not verified | SHELL |
| Export | `src/components/export/**` | `src/components/timeline/ExportRendering.js` | Yes | Partial | Yes | Canvas gradient composite; no real media decode/mux | Partial | Not verified | PARTIAL |
| Undo/Redo | Basic NLE behavior | `apps/video-agent-studio/src/editor/reducerHistory.ts` | Yes | Yes | Yes | Yes | Partial | Not verified | IMPLEMENTED — NOT VERIFIED |

---

## 4. DELTA SINCE `1b9cb241`

| Feature | Old Status | Current Status | What Changed Since `1b9cb241` |
|---|---|---|---|
| Fill Gap | Partial | PARTIAL | Modal + provider wired; local-fallback path masks real output |
| Extend | Partial | PARTIAL | Modal + provider wired; local-fallback path masks real output |
| Music | Partial | PARTIAL | Modal + provider wired; local-fallback path masks real output |
| SAM3/Mask | Missing/Broken | BROKEN | Production fal provider added; Mask UI still returns `PROVIDER_NOT_CONFIGURED` |
| Keyframes | Partial | VERIFIED | Full engine with easing/interpolation added |
| Transitions | Partial | VERIFIED | Library + editor + timeline rendering added |
| Multi-timeline | Partial | VERIFIED | Full CRUD + persistence in `TimelineState.js` |
| Audio Sync | Missing | PARTIAL | Waveform + cross-correlation added; no batch UI |
| Proxy Playback | Missing | MISSING | No change |
| Dual Viewer | Missing | MISSING | No change |
| LLM Assistant | Shell | SHELL | Panel added; still canned responses |
| Export | Shell | PARTIAL | WebCodecs composer added; still not real-media output |
| Undo/Redo | Missing | IMPLEMENTED — NOT VERIFIED | Snapshot history added in subtree |

---

## 5. TIMELINE ADDITIONS — DO NOT REBUILD

| Feature | Status | Timeline Files | Working Capability | Remaining |
|---|---|---|---|---|
| Keyframes | VERIFIED | `src/lib/editor/keyframeSystem.jsx` | Create/remove/evaluate with easing/interpolation | Verification only |
| Transitions | VERIFIED | `src/lib/editor/transitionEditor.js`, `src/lib/editor/timelineTransitions.js`, `src/lib/editor/transitionsLibrary.js` | Library + editor + timeline rendering | Verification only |
| Multi-timeline | VERIFIED | `src/lib/editor/TimelineState.js` | Create/rename/delete/switch/persistence | Verification only |
| Undo/Redo | IMPLEMENTED — NOT VERIFIED | `apps/video-agent-studio/src/editor/reducerHistory.ts` | Snapshot-based undo/redo, gesture-aware | Runtime verification in Timeline Editor |

---

## 6. TIMELINE COMPLETION BACKLOG

| Priority | Capability | Current Status | What Already Exists | Exact Missing Work | Timeline UI Destination |
|---|---|---|---|---|---|
| High | Fill Gap | PARTIAL | Modal + provider stub | Replace local-fallback with real result; insert generated asset into Media Pool + Timeline; wire undo; persist | Timeline toolbar → Fill Gap |
| High | Extend | PARTIAL | Modal + provider stub | Replace local-fallback with real result; insert generated asset; wire undo; persist | Timeline toolbar → Extend |
| High | Music | PARTIAL | Modal + provider stub | Replace local-fallback with real audio URL; waveform; Timeline insertion; persist | Timeline toolbar → Music |
| High | Mask / SAM3 | BROKEN | fal-ai/sam-3/video provider + coordinate transform | Wire provider to Mask UI; add red overlay / white-on-black / cutout preview; add as layer; save/reload | Timeline toolbar → Mask |
| Medium | Audio Sync | PARTIAL | Waveform + cross-correlation | Batch sync UI + offset application + persistence | Timeline toolbar / clip context |
| Medium | LLM Assistant | SHELL | `AIChatPanel.js` | Replace canned responses with real provider calls; implement ASK/SEARCH/CUT/TIMELINE modes; project/timeline/asset context; citations; token/cost | Timeline sidebar |
| Medium | Export | PARTIAL | `ExportRendering.js` | Real media compositing + audio muxing + validated download | Timeline Export dialog |
| Low | Proxy Playback | MISSING | None in timeline scope | Proxy generation, toggle, playback routing, original-on-export | Timeline viewer/settings |
| Low | Dual Viewer | MISSING | None in timeline scope | Source viewer with scrub, in/out, SAM3 mask integration | Timeline chrome |

---

## 7. PREVIOUSLY MISSING / PARTIAL — NOW IN TIMELINE

| Feature | Old Status | Current Status | Evidence |
|---|---|---|---|
| Undo/Redo | Missing | IMPLEMENTED — NOT VERIFIED | `apps/video-agent-studio/src/editor/reducerHistory.ts` |
| Multi-timeline | Partial | VERIFIED | `src/lib/editor/TimelineState.js` |
| Keyframes | Partial | VERIFIED | `src/lib/editor/keyframeSystem.jsx` |
| Transitions | Partial | VERIFIED | `src/lib/editor/transitionEditor.js`, `timelineTransitions.js`, `transitionsLibrary.js` |
| SAM3/Mask | Missing/Broken | BROKEN | `netlify/functions/providers/falSam3.js`, `src/lib/editor/sam3CoordinateTransform.js` |
| Audio Sync | Missing | PARTIAL | `src/lib/editor/audioSync.js` |
| Export | Shell | PARTIAL | `src/components/timeline/ExportRendering.js` |

---

## 8. ACTUAL MISSING FROM TIMELINE EDITOR

| Capability | Status | Notes |
|---|---|---|
| Proxy Playback | MISSING | Not present in timeline scope |
| Dual Viewer | MISSING | Not present in timeline scope |
| Real LLM calls | SHELL | Panel exists; responses are not real |
| Real Fill/Extend/Music output | PARTIAL | Provider stubs fall back to local simulation |
| Mask UI wiring | BROKEN | Provider exists; Mask UI returns `PROVIDER_NOT_CONFIGURED` |

---

## 9. DESIGN ADAPTATION NEEDED

| Feature | Design Status |
|---|---|
| Fill Gap | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED |
| Extend | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED |
| Music | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED |
| SAM3/Mask | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED |
| Keyframes | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED |
| Transitions | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED |
| Multi-timeline | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED |
| LLM Assistant | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED |
| Export | FUNCTION EXISTS — DESIGN ADAPTATION NEEDED |

---

## 10. RECOMMENDED ORDER

1. Fill Gap — real provider result + Timeline insertion + undo + persistence
2. Extend — real provider result + Timeline insertion + undo + persistence
3. Music — real audio URL + waveform + Timeline insertion + persistence
4. Mask/SAM3 — wire provider to Mask UI + preview modes
5. Audio Sync — batch UI + offset application + persistence
6. LLM Assistant — real provider calls + ASK/SEARCH/CUT/TIMELINE modes
7. Export — real media compositing + audio muxing + validated download
8. Proxy Playback — proxy generation + toggle + routing
9. Dual Viewer — source viewer + scrub + SAM3 mask integration
