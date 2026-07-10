# Port timeline-studio features into the Higgsfield timeline editor

## Context

We are porting selected `src/features/*` modules from `chatman-media/timeline-studio` (Next.js 16 + React 19 + XState v5 + Tauri/Rust) into the **root React 19 Vite SPA** of this repo (`open-higgsfield-ai`), which currently uses **MobX 6**, Chakra UI v2 + Tailwind v4, and a workspace of `packages/*` + `apps/*`.

Current timeline (`components/Timeline.jsx`, `components/Timeline.js`, `components/common/timeline/*`) is a basic layer list consumed by ~175 references (`PersonalizationEditor`, `ClipEditor`, `VideoTransitionSettings`, `Stickers`, `LowerThirds`, `Library`, etc.). It relies on legacy deps (`@material-ui/core`, `react-svg-inline`, `moment`, `@react-hook/window-size`, `use-click-outside`, the `timeline` npm package) and has no track model, keyframes, undo/redo, or virtualization.

**Backend is kept as-is.** `backend/server.js` already exposes an MCP WebSocket (`/mcp`) with `get_timeline_state` and clip commands (`add_clip`, `remove_clip`, `move_clip`, `set_playhead`), plus AI routes (`/api/ai-agent`, `/api/scene-detection`, `/api/speech-transcription`, `/api/agents`, `/api/model-catalog`, `/videoagent`). These are reused instead of adding new backend features.

## Locked decisions

1. **License** — User has secured commercial rights to timeline-studio (MIT + Commons Clause). No legal gate.
2. **Layout** — New workspace packages (`packages/timeline-editor` + sub-packages). Legacy `Timeline.jsx` stays working until consumers migrate.
3. **State** — Keep XState v5 as-is inside the new packages (`@xstate/react`, `xstate`). Do not rewrite to MobX.
4. **Render** — `video-compiler` encodes client-side via `@ffmpeg/ffmpeg` (ffmpeg.wasm). No new backend render endpoint.

## Dependencies to add (root `package.json`)

Runtime: `xstate`, `@xstate/react`, `@tanstack/react-virtual`, `wavesurfer.js`, `peaks.js`, `clsx`, `tailwind-merge`, `class-variance-authority`, `sonner`, `react-resizable-panels`, `react-hotkeys-hook`, the subset of `@radix-ui/react-*` the ported components import, `@ffmpeg/ffmpeg`, `@ffmpeg/util`. (`idb-keyval` already present.)

Legacy to remove (after migration): `@material-ui/core` (timeline usage only), `react-svg-inline`, `moment` (timeline usage), `use-click-outside`, `@react-hook/window-size`, the `timeline` npm package.

## Adapter / shim layer (critical — satisfies upstream `Depends on` contracts without porting the whole repo)

Create `packages/timeline-editor/src/adapters/`:
- `appStateAdapter.ts` — maps upstream `@/domains/app-state` to our MobX stores / WS MCP.
- `mediaAdapter.ts` — maps `@/domains/media-management` to `lib/media` + Supabase.
- `playerAdapter.ts` — maps `@/features/video-player` to `components/VideoPlayer.jsx`.
- `tauriShim.ts` — replaces `@tauri-apps/api`: file dialogs → `react-dropzone`/native `<input type=file>`; backend commands & version snapshots → WS MCP (`get_timeline_state`, `add_clip`, …) or `idb-keyval`.
- `vite.config.js` + `tsconfig.base.json` path aliases: `@/` → `packages/timeline-editor/src`; `@/domains/*` → adapter modules.

## Execution phases

### P0 — Scaffolding
- Create dirs: `packages/timeline-editor`, `packages/color-grading`, `packages/audio-mixer`, `packages/transitions`, `packages/subtitles`, `packages/style-templates`, `packages/video-compiler`, `packages/ai-chat`.
- Add deps + register packages in root `workspaces`.
- Add Vite/tsconfig path aliases.
- Write the four adapters above.

### P1 — No-backend client features (priority, in this order)
- **1.1** `color-grading` → `packages/color-grading` (Canvas scopes; only Tauri shim is LUT file-import).
- **1.2** `transitions` → `packages/transitions` (18 components + 6 hooks + 9 services; no Tauri).
- **1.3** `subtitles` → `packages/subtitles` (inline editor; client-only).
- **1.4** `style-templates` → `packages/style-templates` (templates/animation logic).
- **1.5** `fairlight-audio` → `packages/audio-mixer` (Web Audio API + AudioWorklet; no backend; only Tauri shim is file load).
- **1.6** `timeline` core → `packages/timeline-editor` (the large port):
  - Components: `TimelineContent`, `TimelineScale`, `Track`/`TrackHeader`, `VideoClip`/`AudioClip`/`SubtitleClip`, `markers`, `jl-cuts`, `speed-ramping`, `keyframes`, `clip-groups`, `linked-clips`, `edit-mode-selector`, `snap-feedback`, `undo-redo`, `workspace-tabs`, `preview-strip`, `drag-drop-provider`, `transitions`, `clip-effects-panel`.
  - Hooks: `useClips`, `useTracks`, `useTimelineSelection`, `useVirtualizedClips`, `useVirtualizedTracks`, `useDragDropTimeline`, `useTimelineDrop`, `useMarkers`, `useJLCuts`, `useLinkedClips`, `useSpeedRamping`, `useClipGroups`.
  - Services (XState + logic): `timeline-ui-machine`, `undo-redo-service`, `slip-slide-service`, `split-edit-service`, `keyframe-animation-service`, `effects-cache` (LRU+prefetch), `batch-operations-service`, `group-manager`, `clip-transition-sync`, `transition-collision-detector`, `transition-manager`, `video-fade-service`.
  - Types + utils (keyframes).
  - Persistence: `version-control-integration` → `idb-keyval` (no Tauri).
  - **Integrate `@tanstack/react-virtual` from day one** for `virtualized-timeline-content`.
  - Defer/stub: `ai-analysis`, `ai-markers`, `ai-suggestions` (need P2), `persons-panel`, `script-view`, `analysis` (can be no-op stubs).

### P2 — AI features reusing existing backend
- **2.1** `ai-chat` → `packages/ai-chat` (UI `AiChat`/`AIActionPreview`/`CacheStatsPanel`; providers `ChatProvider`/`MCPProvider`; `chatMachine`; hooks `useTimelineAI`, `usePlayerAIIntegration`, `useBrowserAIIntegration`, `useResourcesAIIntegration`).
- **2.2** Port `packages/domains/src/ai-tools` (82 typed tool contracts) into `packages/intelligence/src/ai-tools` (extends existing `packages/intelligence`).
- **2.3** Wire `ChatProvider`/`chatMachine` to existing `POST /api/ai-agent` (adapt stream/JSON contract) + WS MCP for tool execution; sessions in `idb-keyval`. **No new backend endpoint.**
- **2.4** Wire `useTimelineAI` into timeline core so AI can suggest cuts/transitions and operate clips via existing WS commands.

### P3 — video-compiler (client-side)
- **3.1** `video-compiler` → `packages/video-compiler` (services `cache-service`, `frame-extraction-service`, `metadata-cache-service`, `video-compiler-service`; hooks `use-cache-stats`, `use-frame-extraction`, `use-gpu-capabilities`, `use-metadata-cache`, `use-prerender`, `use-render-jobs`, `use-video-compiler`; components `cache-statistics-modal`, `gpu-status`, `render-jobs-dropdown`).
- **3.2** Map `video-compiler-service.startRender` → `@ffmpeg/ffmpeg` wasm encode. GPU detection stays informational (HW-accel deferred).
- **3.3** Render output → Supabase storage or local blob URL.

### P4 — Integration & migration of consumers
- **4.1** Export `<TimelineEditor />` from `packages/timeline-editor` wrapping `TimelineProvider` + `TimelineContent` + optional panels (color-grading, audio-mixer, transitions, subtitles, ai-chat).
- **4.2** Mount it where `components/Timeline.jsx` is used: `PersonalizationEditor`, `ClipEditor`, `VideoTransitionSettings`, `Stickers`, `LowerThirds`, `Library`.
- **4.3** Provide a backward-compat adapter so existing `useTimelineStore`/`useProjectStore` calls keep working (map old actions → XState events) during transition.
- **4.4** Deprecate then remove `components/Timeline.jsx`, `components/Timeline.js`, `components/common/timeline/*`, and the legacy deps listed above.

### P5 — Validation
- **Unit:** port upstream vitest tests into each package's `__tests__/`; run `vitest` (already in root).
- **Type:** `tsc --noEmit` per package.
- **Integration (manual E2E):** load media → add tracks → place clips → trim/slip/slide → markers → speed ramp → apply color grade + scopes → mix audio (LUFS meters) → add transitions + subtitles → undo/redo → AI suggest cuts → export via ffmpeg.wasm.
- **Regression:** confirm the ~175 existing timeline references still function via the compat adapter.
- **Build:** `vite build` succeeds; `grep -r "@tauri-apps" packages/` returns nothing.

## Risks
- **Tauri shim surface** is broad (file dialogs, backend commands, fs). Mitigate with the adapter layer + the P5 grep gate.
- **Radix vs Chakra** — ported components import Radix; adding the used primitives is fine but watch bundle size (tree-shake, only used primitives).
- **Performance** — large projects need virtualized rendering + LRU effects cache; integrate `@tanstack/react-virtual` in P1.6 from the start.
- **XState + MobX coexistence** — keep XState strictly inside the new packages; expose a thin imperative API (events + selectors) so root MobX consumers never import XState directly.
- **ffmpeg.wasm** is a large download; lazy-load only when export is triggered.

## Out of scope / open
- `apps/director` is a separate **Vue 3** app with its own Python backend — not part of this port (future optional).
- Server-side HW-accelerated export — declined (would need a new backend feature).
- VST/AU plugins, 8K/HDR — not implemented upstream either.
