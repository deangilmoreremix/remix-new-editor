# CineGen → Timeline Studio Feature Parity Audit

**Upstream:** https://github.com/christopherjohnogden/CineGen  
**Timeline Studio:** `src/components/TimelineEditorPage.jsx` + `src/lib/editor/`  
**Scope:** Web-compatible features only — Electron/desktop-only features excluded  
**Last updated:** 2026-09-09

---

## How to read this audit

| Status | Meaning |
|--------|---------|
| ✅ **DONE** | Implemented and wired into the timeline studio |
| ⚠️ **PARTIAL** | Some pieces exist, but not all sub-features are present |
| ❌ **MISSING** | Not present at all |
| 🚫 **EXCLUDED** | Desktop/Electron-only; not ported to web |

---

## 1. Director Tab

A complete production page between Spaces and Edit that turns scripts into AI-generated shotlists.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1.1 | Script import (.txt/.md/.fountain/.fdx) | ❌ MISSING | File upload UI + parser not present in timeline studio |
| 1.2 | LLM script breakdown (characters/locations/props/vehicles) | ❌ MISSING | No breakdown rail or @Tag system |
| 1.3 | Breakdown rail with element cards | ❌ MISSING | — |
| 1.4 | Scene navigation (All scenes / per-scene filter) | ❌ MISSING | — |
| 1.5 | Shotlist compiler (timed beats, coverage targets) | ❌ MISSING | — |
| 1.6 | CINEDANCE/Oneiric prompt compilation | ❌ MISSING | No craft doctrine / prompt blocks |
| 1.7 | Look Bible builder (genre, film refs, mood board) | ❌ MISSING | — |
| 1.8 | Look Bible LLM rewrite | ❌ MISSING | — |
| 1.9 | Generate page (takes, variants, Full/Shot isolation) | ❌ MISSING | — |
| 1.10 | Takes management (Full vs isolated shot, Held/Native) | ❌ MISSING | — |
| 1.11 | Shot grammar chips (size/bodies/dirty-clean/angle) | ❌ MISSING | — |
| 1.12 | Camera Life slider | ❌ MISSING | — |
| 1.13 | Blocking maps (Set frame → Make blocking map) | ❌ MISSING | — |
| 1.14 | Director's notes per-scene | ❌ MISSING | — |
| 1.15 | Director's notes per-clip | ❌ MISSING | — |
| 1.16 | Per-scene shotlisting | ❌ MISSING | — |
| 1.17 | Lens locks (diagonal FOV 8°–107°) | ❌ MISSING | — |
| 1.18 | Acting tasks (motive/goal/obstacle/tactic) | ❌ MISSING | — |
| 1.19 | Dialogue discipline (auto audio lock) | ❌ MISSING | — |
| 1.20 | Paper slate naming (1A · T01) | ❌ MISSING | — |
| 1.21 | Full-take shot ruler (S1/S2/S3 timeline) | ❌ MISSING | — |
| 1.22 | Setup page (clip length/aspect/resolution) | ❌ MISSING | — |
| 1.23 | Style prefix (collapsible + copy) | ❌ MISSING | — |
| 1.24 | Coverage section (line of action, camera movement) | ❌ MISSING | — |
| 1.25 | Reset to original | ❌ MISSING | — |

**Director Tab summary:** Entire tab is missing from timeline studio.

---

## 2. LLM Chat / Copilot

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 2.1 | Acoustic-emotional clip analysis | ❌ MISSING | No audio performance analysis |
| 2.2 | Silence boundary detection | ❌ MISSING | — |
| 2.3 | Performance-aware moment retrieval | ❌ MISSING | — |
| 2.4 | Editorial personas (documentary / promo) | ❌ MISSING | — |
| 2.5 | Story-shape map (narrative arc) | ❌ MISSING | — |
| 2.6 | Repetition/contradiction map | ❌ MISSING | — |
| 2.7 | Humanize Cut toggle | ❌ MISSING | — |
| 2.8 | Room-tone handles | ❌ MISSING | — |
| 2.9 | J/L cuts | ❌ MISSING | — |
| 2.10 | Copilot app actions (`cinegen-skill-action`) | ❌ MISSING | No add_nodes / save_elements / edit_timeline |
| 2.11 | Skill Builder | ❌ MISSING | No skill authoring UI |
| 2.12 | Skill selector (Shift+Space + `#skill-name`) | ❌ MISSING | — |
| 2.13 | AI skill authoring | ❌ MISSING | — |
| 2.14 | Background Copilot | ❌ MISSING | — |
| 2.15 | In-app toast on completion | ❌ MISSING | — |
| 2.16 | Enhance Prompt | ❌ MISSING | — |
| 2.17 | GFM markdown tables in chat | ❌ MISSING | — |
| 2.18 | Clickable timestamp citations | ❌ MISSING | — |
| 2.19 | `@` mention assets/timelines | ❌ MISSING | — |
| 2.20 | Token usage/cost tracking | ❌ MISSING | — |

**LLM Chat summary:** No LLM chat is wired into the timeline studio. `AIChatPanel.js` exists as a stub/mock.

---

## 3. Node Workflow Additions

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 3.1 | Storyboarder node (scene → 3–12 shots) | ❌ MISSING | — |
| 3.2 | Storyboarder video generation per shot | ❌ MISSING | — |
| 3.3 | Storyboarder import to timeline | ❌ MISSING | — |
| 3.4 | Shot Board node (9-cell camera grid) | ❌ MISSING | — |
| 3.5 | Composition Plan node (music scoring) | ❌ MISSING | — |
| 3.6 | Multi Prompt node (Kling 3 multi-shot) | ❌ MISSING | — |
| 3.7 | Seedance 2.0 (text/image + reference-to-video) | ❌ MISSING | — |
| 3.8 | Video quality selectors per model | ❌ MISSING | — |
| 3.9 | Spaces file drop (desktop files → canvas) | ❌ MISSING | — |

**Node Workflow summary:** Node editor UI exists (`nodeWorkflow.js`), but these specific node types and quality controls are not implemented.

---

## 4. Edit Page / Timeline Features

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4.1 | Dual viewer (source + timeline) | ❌ MISSING | Single preview stage only |
| 4.2 | Source viewer frame-accurate scrubbing | ❌ MISSING | — |
| 4.3 | Audio sync (auto-align) | ⚠️ PARTIAL | `audioSync.js` exists; not wired into timeline UI |
| 4.4 | Batch sync (multiple clips) | ❌ MISSING | — |
| 4.5 | Proxy playback toggle | ❌ MISSING | `FEATURE_FLAGS.proxyPlayback` not present |
| 4.6 | Multiple timeline tabs | ❌ MISSING | No tabbed timeline UI |
| 4.7 | Music generation presets (genre/mood/style/tempo) | ⚠️ PARTIAL | `MusicGenerationModal.jsx` exists; integration is partial |
| 4.8 | Instrumental toggle | ⚠️ PARTIAL | Modal has option; backend not verified |
| 4.9 | Duration snapping for music | ❌ MISSING | — |
| 4.10 | Horizontal/vertical flip per clip | ❌ MISSING | — |
| 4.11 | Speed adjustment (0.1x–2x) | ❌ MISSING | — |

---

## 5. Elements Library

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5.1 | Global Elements library (cross-project) | ❌ MISSING | Per-project only |
| 5.2 | Multi-select (⌘/Ctrl-click, Shift-click, marquee) | ❌ MISSING | — |
| 5.3 | Bulk delete | ❌ MISSING | — |
| 5.4 | Folder organization (All/Unfiled/per-project) | ❌ MISSING | — |
| 5.5 | Move elements between folders | ❌ MISSING | — |
| 5.6 | Per-panel regeneration | ❌ MISSING | — |
| 5.7 | Hybrid workflow (upload + AI) | ⚠️ PARTIAL | Element generation exists but not fully integrated |

---

## 6. UI / UX Features

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 6.1 | Project Manager (home page) | ❌ MISSING | No dedicated project dashboard |
| 6.2 | Settings page (API key config) | ⚠️ PARTIAL | `SettingsModal` exists; not full settings page |
| 6.3 | Header Assistant (right drawer chat) | ❌ MISSING | — |
| 6.4 | Export page (dedicated settings + progress) | ⚠️ PARTIAL | Export UI exists; real rendering not implemented |
| 6.5 | Copy buttons flash "Copied" | ❌ MISSING | — |
| 6.6 | Multiple timeline tabs | ❌ MISSING | — |
| 6.7 | Source viewer with SAM3 masking | ❌ MISSING | — |

---

## 7. SAM3 Segmentation

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 7.1 | Text prompt segmentation | ❌ MISSING | TODO placeholder in `aiMuapi.js` |
| 7.2 | Click prompt segmentation | ❌ MISSING | — |
| 7.3 | Box prompt segmentation | ❌ MISSING | — |
| 7.4 | Preview modes (red overlay / white-on-black / cutout) | ❌ MISSING | — |
| 7.5 | Video frame extraction for segmentation | ❌ MISSING | — |

---

## 8. Real Export Rendering

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 8.1 | FFmpeg MP4 rendering | ⚠️ PARTIAL | Simulated; `exportSystem.js` uses fake Blob URL |
| 8.2 | Resolution presets (720p/1080p/4K) | ⚠️ PARTIAL | UI exists, no real encode |
| 8.3 | Frame rate options (24/30/60fps) | ✅ DONE | Present in export UI |
| 8.4 | Configurable aspect ratio | ✅ DONE | 16:9, 4:3, 21:9, 1:1, 9:16 |
| 8.5 | Real-time encoding progress | ❌ MISSING | Simulated progress only |

---

## 9. Already Implemented (No Action Needed)

| Feature | Implementation |
|---------|---------------|
| Multi-track timeline UI | `TimelineEditorPage.jsx` — full NLE |
| Drag-and-drop clips | `TimelineDragManager.js` |
| Snap system | Snap to edges, playhead, grid |
| Insert/overwrite/ripple | `timeline-operations.js` |
| Split, delete, duplicate, merge | `timeline-operations.js` |
| Copy/paste, nudge | `timeline-operations.js` |
| Undo/redo (50-entry stack) | `TimelineState.js` |
| Zoom + mini-map + ruler | `TimelineEditorPage.jsx` |
| Playhead + keyboard scrubbing | `TimelineEditorPage.jsx` |
| Keyframe animation | `keyframeSystem.jsx` |
| Transitions | `transitionEditor.js` / `timelineTransitions.js` |
| Color correction (UI) | `colorCorrectionSystem.jsx` (feature-flagged off) |
| Subtitles + SRT/VTT export | `subtitleTimeline.js` |
| Multi-camera (PIP, split screen) | `multiCamera.js` |
| CineGen tool registry | `cinegenIntegration.js` — 11 tools |
| Fill Gap / Extend / Music modals | `FillGapModal.jsx`, `ExtendModal.jsx`, `MusicGenerationModal.jsx` |
| Elements Library (per-project) | `elementsLibrary.js` |
| Node Workflow canvas | `nodeWorkflow.js` |
| LLM Assistant (Ask/Search/Cut/Timeline) | `llmAssistant.js` |
| Agent system | `TimelineAgentIntegration.js`, `DirectorPage.js` |
| Media management + upload | `mediaLibrary.js`, `uploadPipeline.js` |
| Auto-save + versioning | `TimelineState.js` + `persistence.js` |
| Scene detection UI | `SceneDetector.js` |
| Camera effects | `CameraEffects.js` |
| CutAI storyboard integration | `AIStoryboardStudio.jsx` (dynamic import) |

---

## 10. Excluded — Electron/Desktop-Only

| Feature | Why Excluded |
|---------|-------------|
| Native AVFoundation playback | macOS C++ module, desktop only |
| SQLite via better-sqlite3 | Node native module; web uses IndexedDB / HTTP storage |
| CLI LLM detection (Claude Code, Codex, Gemini CLI local paths) | Desktop CLIs; web uses cloud APIs or server-side CLIs |
| Local model runners (Python venvs: WhisperX, SAM3, LTX) | Desktop Python scripts |
| Desktop file dialogs / arbitrary local paths | Browser uploads only |
| Custom C++ AVFoundation module | macOS/Electron only |
| Worker threads (Electron `electron/workers/`) | Replaced by web server processing |
| DMG/ZIP packaging | Desktop distribution |
| Device-level Higgsfield login/logout | Desktop-only in CineGen |

---

## 11. Recommended Porting Order

### Batch 2 — Core Timeline Editing Gaps
1. **Source viewer** — frame-accurate scrubbing, SAM3 masking entry point
2. **Dual viewer** — source + timeline viewers
3. **Audio sync** — wire `audioSync.js` into timeline UI
4. **Proxy playback toggle** — draft-quality playback mode
5. **Multiple timeline tabs** — tabbed timeline UI
6. **Horizontal/vertical flip** — per-clip transform
7. **Speed adjustment** — 0.1x–2x per clip

### Batch 3 — LLM & Intelligence
8. **LLM Chat panel** — wire real backend into timeline
9. **Acoustic-emotional analysis** — audio performance per clip
10. **Humanize Cut** — silence-aware boundaries
11. **Skill Builder** — skills system
12. **Background Copilot** — persistent LLM session

### Batch 4 — Director Tab
13. **Script import + breakdown rail**
14. **Shotlist compiler + CINEDANCE prompts**
15. **Look Bible builder**
16. **Generate page + takes**

### Batch 5 — Node Workflow & Export
17. **Storyboarder / Shot Board / Composition Plan nodes**
18. **Multi Prompt / Seedance 2.0 nodes**
19. **Real FFmpeg export** — replace simulation with real render
20. **Global Elements library + multi-select**

---

## 12. Current Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| CineGen backend (`/.netlify/functions/cinegen`) not deployed | Fill Gap / Extend / Music fall back to simulation | Deploy backend or mock for dev |
| `FEATURE_FLAGS.colorCorrection = false` | Color correction disabled | Enable when import issue resolved |
| Export rendering simulated | No real MP4 export | Implement FFmpeg WASM or backend render |
| AIChatPanel mock responses | LLM chat not functional | Wire real LLM API |
| SAM3 runtime not configured | Segmentation unavailable | Configure `CINEGEN_SAM3_BASE_URL` or worker |
