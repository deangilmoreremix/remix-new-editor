# Render Page — Phase 2: Real Export Pipeline

**Date:** 2026-07-08
**Status:** Ready for implementation
**Branch:** `incandescent-cheese`

## 1. Problem

Phase 1 made the render page's foundation real: video player, local-only actions, dispatcher, a11y. But 7 user-facing actions are still deferred to "Phase 2: coming soon":
- Export Video
- Export Variations
- Trailer Cut
- Social Resize
- Remix Scene
- Publish / Deliver

These need a real export pipeline that can process video in the browser. Currently `renderWorker.js` and `exportWorker.js` are stubs that always return success with empty payloads. The `exportPipeline.js` in `src/lib/editor/` exists but is timeline-editor-specific and also relies on the stub worker.

## 2. Goal

Implement a real browser-based video export pipeline using Canvas + MediaRecorder API (with WebCodecs VideoEncoder fallback when available). All 7 Phase 2 actions become functional:
- **Export Video**: Export the current video with selected output settings
- **Export Variations**: Export in multiple formats/resolutions
- **Trailer Cut**: Export a selected time range as a trailer
- **Social Resize**: Resize to 9:16 (vertical), 1:1 (square), etc. and export
- **Remix Scene**: Apply visual filters/effects and export
- **Publish / Deliver**: Bundle exports for delivery

## 3. Non-Goals

- No ffmpeg.wasm dependency (too heavy for this phase)
- No server-side processing (all browser-based)
- No changes to upstream call sites
- No removal of any UI elements

## 4. Architecture

### 4.1 New files

```
src/lib/editor/renderExportWorker.js    NEW: real Web Worker for video export
src/lib/editor/renderFrameProcessor.js  NEW: Canvas-based frame processing
```

### 4.2 Modified files

- `src/lib/editor/renderWorker.js` — replace stub with real implementation
- `src/lib/editor/exportWorker.js` — replace stub with real implementation
- `src/components/RenderPage.js` — wire Phase 2 actions to real handlers
- `src/lib/editor/exportPipeline.js` — extract reusable parts for render page

### 4.3 Export flow

```
User clicks "Export Video"
    │
    ▼
dispatchAction('Export Video')
    │
    ▼
renderExportWorker.js (Web Worker)
    │
    ├── Create offscreen canvas
    ├── Load video frames via VideoDecoder (or ImageBitmap)
    ├── Apply preset filters (color profile, finish)
    ├── Encode via MediaRecorder or WebCodecs VideoEncoder
    ├── Post progress messages back
    │
    ▼
Complete → blob URL → trigger download
```

### 4.4 Browser support strategy

- **Modern browsers (Chrome 94+, Edge 94+)**: Use WebCodecs `VideoEncoder` + `mp4-muxer`-style muxing for MP4 output
- **Fallback**: Use Canvas + `MediaRecorder` API for WebM output
- **Progress**: Worker posts `{type: 'progress', percent}` messages
- **Completion**: Worker posts `{type: 'complete', blob, url}` message

### 4.5 Frame processing

`renderFrameProcessor.js` provides:
- `applyPresetFilter(ctx, preset, width, height)` — applies color profile, finish effects
- `resizeFrame(ctx, targetWidth, targetHeight)` — resize with aspect ratio preservation
- `applyEffect(ctx, effectType, params)` — apply visual effects (blur, contrast, etc.)

### 4.6 Error handling

| Failure | User-visible behavior |
|---|---|
| Browser doesn't support MediaRecorder | Toast: "Export not supported in this browser" |
| Video fails to decode | Toast: "Could not process video for export" |
| Export worker crashes | Toast: "Export failed — please try again" |
| User cancels mid-export | Clean up worker, revoke blob URL |

## 5. Detailed Changes

### 5.1 `src/lib/editor/renderExportWorker.js` (new)

Real Web Worker that:
1. Receives `{action, videoUrl, settings, timeRange, effects}` via `postMessage`
2. Creates an offscreen canvas (or uses `OffscreenCanvas` if available)
3. Loads the video via `new Video(url)` or `fetch` + `VideoDecoder`
4. Processes each frame: resize, apply preset filters, apply effects
5. Encodes via `MediaRecorder` (WebM) or `VideoEncoder` (MP4)
6. Posts progress updates: `{type: 'progress', percent: 0-100}`
7. On completion: posts `{type: 'complete', blob: Blob, url: string}`
8. On error: posts `{type: 'error', message: string}`

### 5.2 `src/lib/editor/renderFrameProcessor.js` (new)

Pure functions for frame manipulation:
- `applyColorProfile(ctx, profile, width, height)` — applies LUT-like color transforms
- `applyFinish(ctx, finish, width, height)` — applies bloom, contrast lift, etc.
- `resizeCanvas(canvas, targetWidth, targetHeight, preserveAspect)` — resize with options
- `drawVideoFrame(video, canvas, time)` — draw video frame to canvas at specific time

### 5.3 `src/lib/editor/renderWorker.js` (modified)

Replace stub with real implementation that:
- Imports `renderFrameProcessor` functions
- Creates export worker or processes inline
- Streams progress back to main thread
- Returns blob URL on completion

### 5.4 `src/lib/editor/exportWorker.js` (modified)

Replace stub with real implementation:
- Accepts `timelineData` and `settings`
- For simple single-clip export: delegates to `renderExportWorker` logic
- For batch export: processes each clip sequentially
- Posts progress and completion messages

### 5.5 `src/components/RenderPage.js` (modified)

Add Phase 2 handlers to `ACTION_HANDLERS`:
- `Export Video`: Call export pipeline with current video and settings
- `Export Variations`: Export in multiple formats (MP4 H.264, MP4 H.265, WebM)
- `Trailer Cut`: Export selected time range (default: first 30 seconds)
- `Social Resize`: Export at 9:16, 1:1, 4:5 aspect ratios
- `Remix Scene`: Apply effect preset and export
- `Publish / Deliver`: Create ZIP-like bundle of all exports

Each handler:
1. Shows spinner, updates status
2. Creates worker or calls processing function
3. Listens for progress → updates progress bar
4. On complete → triggers download, shows toast
5. On error → shows error toast
6. Always hides spinner in finally

## 6. Testing

### 6.1 New tests

- `src/test/render-export-worker.test.js` — test worker message handling
- `src/test/render-frame-processor.test.js` — test filter/effect/resize functions

### 6.2 Manual verification

1. Export Video → downloads MP4/WebM file
2. Export Variations → downloads 3 files
3. Trailer Cut → exports 30-second clip
4. Social Resize → exports vertical/square versions
5. Remix Scene → applies effect and exports
6. Progress bar updates during export
7. Cancel works (if cancel button added)

## 7. Rollout

- Single PR: `feat(render): phase 2 real export pipeline`
- Feature flag: none needed
- Backward compat: old stub worker behavior was no-op; new behavior is real
