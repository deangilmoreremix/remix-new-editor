# Render Page — Phase 2: Real Export Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the stub `renderWorker.js` and `exportWorker.js` with real implementations that process video in the browser using Canvas + MediaRecorder API, and wire up all 7 Phase 2 actions (Export Video, Export Variations, Trailer Cut, Social Resize, Remix Scene, Publish/Deliver).

**Architecture:** New `renderExportWorker.js` Web Worker handles video frame extraction, processing, and encoding. New `renderFrameProcessor.js` provides pure functions for preset filters, resizing, and effects. Modified `renderWorker.js` delegates to the export worker. Modified `RenderPage.js` adds real Phase 2 handlers.

**Tech Stack:** Vanilla JS, Web Workers, Canvas API, MediaRecorder API, WebCodecs VideoEncoder (when available). No new dependencies.

## Global Constraints

- No new npm dependencies.
- No removal of any UI element.
- All 19 actions remain visible.
- Follow existing code style (2-space indent, single quotes).
- Commit after each task.

---
---

### Task 1: `src/lib/editor/renderFrameProcessor.js` (new)

**Files:**
- Create: `src/lib/editor/renderFrameProcessor.js`
- Test: `src/test/render-frame-processor.test.js`

**Interfaces:**
- Consumes: Canvas 2D context, video element
- Produces: `applyPresetFilter(ctx, preset, width, height)`, `applyFinish(ctx, finish, width, height)`, `resizeCanvas(canvas, targetWidth, targetHeight, preserveAspect)`, `drawVideoFrame(video, canvas, time)`

- [ ] **Step 1: Write tests**
- [ ] **Step 2: Implement minimal functions**
- [ ] **Step 3: Run tests and commit**

---
---

### Task 2: `src/lib/editor/renderExportWorker.js` (new)

**Files:**
- Create: `src/lib/editor/renderExportWorker.js`
- Test: `src/test/render-export-worker.test.js`

**Interfaces:**
- Consumes: `postMessage`, `importScripts`
- Produces: Web Worker that handles `{action, videoUrl, settings, timeRange, effects}` and posts back `{type: 'progress', percent}` or `{type: 'complete', blob, url}` or `{type: 'error', message}`

- [ ] **Step 1: Write tests**
- [ ] **Step 2: Implement worker with MediaRecorder + Canvas fallback**
- [ ] **Step 3: Run tests and commit**

---
---

### Task 3: Replace stubs in `renderWorker.js` and `exportWorker.js`

**Files:**
- Modify: `src/lib/editor/renderWorker.js`
- Modify: `src/lib/editor/exportWorker.js`

- [ ] **Step 1: Replace renderWorker.js stub with real implementation**
- [ ] **Step 2: Replace exportWorker.js stub with real implementation**
- [ ] **Step 3: Commit**

---
---

### Task 4: Wire Phase 2 handlers in `RenderPage.js`

**Files:**
- Modify: `src/components/RenderPage.js`

- [ ] **Step 1: Add Phase 2 handlers to ACTION_HANDLERS**
- [ ] **Step 2: Wire progress updates from worker to UI**
- [ ] **Step 3: Test all 7 Phase 2 actions**
- [ ] **Step 4: Commit**

---
---

### Task 5: Audit and test

- [ ] **Step 1: Run full test suite**
- [ ] **Step 2: Manual verification of all Phase 2 actions**
- [ ] **Step 3: Commit**
