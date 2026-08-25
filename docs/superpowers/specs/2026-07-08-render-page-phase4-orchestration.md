# Render Page — Phase 4: Orchestration & Queue

**Date:** 2026-07-08
**Status:** Ready for implementation
**Branch:** `incandescent-cheese`

## 1. Problem

Phase 1-3 made individual actions real. Now we need:
1. Real queue draining — the `render_queue` localStorage queue should actually process items
2. Agentic Editor / Full Editor navigation — these should open real editors
3. Integration with the existing `PerformanceManager.RenderQueue` from timeline editor

Currently:
- Queue items are stored in localStorage but never processed
- Agentic Editor / Full Editor show "Phase 4: coming soon"
- The `RenderQueue` class in `performanceManager.js` exists but isn't connected to the render page

## 2. Goal

Wire up the render queue to actually process jobs, connect Agentic Editor / Full Editor to real destinations, and integrate with the existing timeline editor infrastructure.

## 3. Non-Goals

- No new editor implementations (use existing `TimelineEditorPage.jsx`, `EditorPage.js`, `DirectorPage.js`)
- No changes to existing editor behavior
- No removal of any UI elements

## 4. Architecture

### 4.1 Modified files

- `src/components/RenderPage.js` — add Phase 4 handlers
- `src/lib/editor/renderQueueStore.js` — add processing methods
- `src/lib/editor/performanceManager.js` — integrate with render page queue

### 4.2 Queue processing

```
Queue Render clicked
    │
    ▼
enqueueRender(job) → localStorage
    │
    ▼
RenderPage subscribes to queue changes
    │
    ▼
Background processor picks up job
    │
    ├── Export Video: calls renderWorker with job settings
    ├── Social Resize: calls resize + export
    ├── Trailer Cut: calls time-range export
    │
    ▼
On complete: update job status, show notification, trigger download
```

### 4.3 Navigation handlers

- `Agentic Editor`: Navigate to `/#/edit?asset=...` with AI editing enabled
- `Full Editor`: Navigate to `/#/timeline?asset=...` with video loaded

## 5. Detailed Changes

### 5.1 `src/lib/editor/renderQueueStore.js` (modified)

Add:
```js
export function processNextJob() // process next queued job
export function getQueueProcessor() // returns processor instance
```

### 5.2 `src/components/RenderPage.js` (modified)

Add Phase 4 handlers:
- `Agentic Editor`: Navigate to edit page with asset context
- `Full Editor`: Navigate to timeline page with video loaded

## 6. Testing

- `src/test/render-queue-processor.test.js` — test job processing flow
- Manual: queue multiple items, verify they process in order

## 7. Rollout

- Single PR: `feat(render): phase 4 orchestration and queue`
- Reuses existing `renderWorker.js` from Phase 2
- No new dependencies
