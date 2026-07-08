# Render Page — Phase 1: Real Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the render page from a mock UI shell into a real video finishing tool's foundation: real video player, real local-only actions (frame download, copy prompt, save/duplicate template, draft, queue, storyboard navigation), real dispatcher with honest "Phase 2/3" toasts for deferred actions, a11y/perf fixes, and router cleanup.

**Architecture:** Three new focused modules (`renderQueueStore`, `renderActions`, tests) plus surgical modifications to `RenderPage.js` and `router.js`. The existing UI (all 19 buttons/tiles/chips) is preserved; only the behavior behind the clicks changes.

**Tech Stack:** Vanilla JS, Vitest (existing), localStorage, native `<video>` + Canvas API. No new dependencies.

## Global Constraints

- No new npm dependencies in this phase.
- No removal of any existing UI element, button, tile, chip, or section.
- All 19 actions must remain visible and clickable after the refactor.
- Use the same imperative DOM-building style as the existing `RenderPage.js`.
- Use Vitest (`describe`, `it`, `expect`, `vi`) for all new tests.
- Tests must clean up all `localStorage` keys they create in `afterEach`.
- Commit after each task.
- Follow the existing code style (2-space indent, single quotes).

---
---

### Task 1: `src/lib/editor/renderQueueStore.js` (new file)

**Files:**
- Create: `src/lib/editor/renderQueueStore.js`
- Test: `src/test/render-queue-store.test.js`

**Interfaces:**
- Consumes: `localStorage`
- Produces: `enqueueRender(job)`, `listRenderQueue()`, `removeFromRenderQueue(id)`, `clearRenderQueue()`, `subscribe(listener)`

- [ ] **Step 1: Write the failing test**

Create `src/test/render-queue-store.test.js` with tests for: empty queue, enqueue returns entry with id/timestamp, subscriber notified on enqueue, remove by id, clear queue, unsubscribe stops notifications, legacy `render_queue` migrates to `render:queue` on first read.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/render-queue-store.test.js`
Expected: FAIL with "Cannot find module '../lib/editor/renderQueueStore.js'"

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/editor/renderQueueStore.js` with `STORE_KEY = 'render:queue'`, `LEGACY_KEY = 'render_queue'`, singleton listeners set, `migrate()` one-time from legacy key, and the five exported functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/render-queue-store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/renderQueueStore.js src/test/render-queue-store.test.js
git commit -m "feat(render): add renderQueueStore with localStorage pub/sub"
```

---
---

### Task 2: `src/lib/editor/renderActions.js` (new file)

**Files:**
- Create: `src/lib/editor/renderActions.js`
- Test: `src/test/render-actions.test.js`

**Interfaces:**
- Consumes: `localStorage`, `navigate` from `./router.js`
- Produces: `getVideoMetadata(videoUrl)`, `downloadFrame(videoEl, opts)`, `copyToClipboard(text)`, `saveDraft(entry)`, `saveTemplate(entry)`, `duplicateTemplate(id)`, `listTemplates()`, `listDrafts()`, `deleteTemplate(id)`, `deleteDraft(id)`, `sendToStoryboard(videoId, videoUrl)`

- [ ] **Step 1: Write the failing test**

Create `src/test/render-actions.test.js` with tests for: saveDraft persists with id/timestamps, saveTemplate persists, drafts/templates isolated, duplicateTemplate returns copy with "(Copy)", deleteDraft/deleteTemplate remove entries, copyToClipboard uses clipboard API with execCommand fallback, sendToStoryboard calls navigate, getVideoMetadata returns null for empty url.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/render-actions.test.js`
Expected: FAIL with "Cannot find module '../lib/editor/renderActions.js'"

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/editor/renderActions.js` with `TEMPLATE_KEY = 'render:templates'`, `DRAFT_KEY = 'render:drafts'`, and all exported functions. `getVideoMetadata` creates a `<video>`, waits for `loadedmetadata` with 8s timeout. `downloadFrame` draws to canvas and triggers download. `copyToClipboard` uses clipboard API with textarea fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/render-actions.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/renderActions.js src/test/render-actions.test.js
git commit -m "feat(render): add renderActions for real local-only finishing ops"
```

---
---

### Task 3: `src/lib/router.js` — call cleanup on navigation away

**Files:**
- Modify: `src/lib/router.js`

- [ ] **Step 1: Inspect current state**

Read `src/lib/router.js`. Confirm `currentPage` is declared around line 76 and the navigation flow empties `contentArea` before appending a new page. There is currently no cleanup hook.

- [ ] **Step 2: Modify router.js**

Add `currentPageEl = null` next to `currentPage`. Before clearing `contentArea` and loading the new page, call `currentPageEl?.cleanup?.()` and set `currentPageEl = null`. After appending the new element, set `currentPageEl = element`.

- [ ] **Step 3: Manual verification**

Run dev server, navigate to `/#/render`, then away. Confirm no leaked interval errors in console.

- [ ] **Step 4: Commit**

```bash
git add src/lib/router.js
git commit -m "fix(router): call page cleanup on navigation away"
```

---
---

### Task 4a: `src/components/RenderPage.js` — real video player, metadata, frame download, output controls

**Files:**
- Modify: `src/components/RenderPage.js`

- [ ] **Step 1: Update imports**

Add:
```js
import { getVideoMetadata, downloadFrame } from '../lib/editor/renderActions.js';
import { listRenderQueue, subscribe, removeFromRenderQueue } from '../lib/editor/renderQueueStore.js';
```

- [ ] **Step 2: Remove dead state**

Delete lines:
```js
  let activeIntervals = [];
  let isRunning = false;
  let progress = 0;
  let currentStage = 'finishing';
```

Keep `let activeAction = 'Export Video';` — it is used for `aria-pressed`.

- [ ] **Step 3: Add videoElement/helpers**

After `const inner = document.createElement('div');` add:
```js
  let videoElement = null;
  let currentVideoUrl = videoUrl;
  let videoMeta = null;

  function loadVideo(url) { ... }
  async function updateStatsFromMeta() { ... }
  function renderStats() { ... }
```

- [ ] **Step 4: Replace static play triangle with real `<video>`**

In preview area innerHTML, replace the play triangle divs with:
```html
<video id="previewVideo" class="relative aspect-video w-[88%] max-w-3xl ..." controls playsinline></video>
```

After `leftSection.appendChild(previewArea);` add wiring:
```js
  videoElement = previewArea.querySelector('#previewVideo');
  if (videoElement && resolvedVideoUrl) {
    videoElement.src = resolvedVideoUrl;
    videoElement.load();
    videoElement.addEventListener('loadedmetadata', () => updateStatsFromMeta());
    videoElement.addEventListener('error', () => { showToast('Could not load video preview'); videoMeta = null; renderStats(); });
  }
```

- [ ] **Step 5: Update stats row with IDs and real data**

Replace stats row labels from `text-white/40` to `text-white/70`, add `id="statDuration"`, `id="statResolution"`, `id="statEstimated"` to the value elements.

- [ ] **Step 6: Replace static output settings with real form controls**

Replace Output Format/Frame Rate/Quality divs with real `<select>` and `<input type="range">` elements with `for=` labels. Wire quality label update on input.

- [ ] **Step 7: Add `getOutputSettings` function**

```js
  function getOutputSettings() {
    const formatEl = container.querySelector('#outputFormat');
    const frameRateEl = container.querySelector('#frameRate');
    const qualityEl = container.querySelector('#quality');
    return { format: ..., frameRate: ..., quality: ... };
  }
```

- [ ] **Step 8: Wire `?asset=` param**

Replace URL param parsing with `rawAssetId`, `resolveAsset()` async helper that imports `assetStore`, and `resolvedVideoUrl`/`resolvedVideoId`/`resolvedTitle` variables. Update header to use resolved values.

- [ ] **Step 9: Replace NEXT_ACTIONS sidebar with saved-items toggle + render queue panel**

Remove `NEXT_ACTIONS.forEach` block. Add saved toggle/panel with `renderSavedItems()`, queue panel with `renderQueue()` using `listRenderQueue`, `subscribe(renderQueue)`, and `removeFromRenderQueue`.

- [ ] **Step 10: Update cleanup function**

Replace `container.cleanup` to pause and detach the video element:
```js
  container.cleanup = () => {
    if (videoElement) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
    }
    videoElement = null;
  };
```

- [ ] **Step 11: Manual verification**

Verify: video player visible, stats update, Download Frame works, output controls interactive, queue panel renders, saved toggle works.

- [ ] **Step 12: Commit**

```bash
git add src/components/RenderPage.js
git commit -m "feat(render): real video player, metadata, frame download, output controls"
```

---
---

### Task 4b: `src/components/RenderPage.js` — real action dispatcher, local handlers, deferred toasts

**Files:**
- Modify: `src/components/RenderPage.js`

- [ ] **Step 1: Add imports**

```js
import {
  saveDraft, saveTemplate, duplicateTemplate,
  listTemplates, listDrafts,
  sendToStoryboard, downloadFrame, copyToClipboard,
} from '../lib/editor/renderActions.js';
import { enqueueRender } from '../lib/editor/renderQueueStore.js';
```

- [ ] **Step 2: Add `PHASE_MAP` and `ACTION_HANDLERS`**

After `ACTION_TILES` (line 55), add:
```js
const PHASE_MAP = { 'AI Auto-Edit': 3, 'Agentic Editor': 4, ... };
const ACTION_HANDLERS = { 'Download Frame': async () => { ... }, ... };
```

- [ ] **Step 3: Replace `runAction` with `dispatchAction`**

Replace lines 371–406 with:
```js
  async function dispatchAction(action) {
    const handler = ACTION_HANDLERS[action];
    if (handler) { try { await handler(); } catch (err) { showToast(`${action} failed: ${err.message}`); } return; }
    const phase = PHASE_MAP[action];
    if (phase) { showToast(`${action} — Phase ${phase}: coming soon`); return; }
    console.warn(`[RenderPage] Unknown action: ${action}`);
  }
```

- [ ] **Step 4: Wire all buttons to `dispatchAction`**

Replace `runAction` references in hero buttons (lines 444–445), action button row (line 215), action tiles (line 247), quick actions (line 263), NEXT_ACTIONS sidebar (line 316).

- [ ] **Step 5: Update progress spinner to be conditional**

Change spinner to `id="progressSpinner"` with `hidden` class. In `dispatchAction`, show/hide spinner and update `#progressStatus` text.

- [ ] **Step 6: Manual verification**

Verify all 19 actions: 7 local actions do real work, 12 deferred actions show "Phase 2/3/4: coming soon".

- [ ] **Step 7: Commit**

```bash
git add src/components/RenderPage.js
git commit -m "feat(render): real dispatcher, local actions, deferred phase toasts"
```

---
---

### Task 4c: `src/components/RenderPage.js` — a11y, perf, cleanup

**Files:**
- Modify: `src/components/RenderPage.js`

- [ ] **Step 1: Add focus-visible style block**

Before building DOM, append a `<style>` element with `.render-page button:focus-visible` ring and `@media (prefers-reduced-motion: reduce)` disabling animations. Add `container.classList.add('render-page');`.

- [ ] **Step 2: Add ARIA attributes**

Preset buttons: `btn.setAttribute('aria-pressed', String(preset === selectedPreset));`
Action buttons: `btn.setAttribute('aria-pressed', String(action === activeAction));`
Progress: add `role="status"` to `#progressStatus`, `aria-live="polite" aria-atomic="true"` to `#progressPercent`.

- [ ] **Step 3: Bump low-contrast labels**

Change remaining `text-white/40` and `text-white/45` label text to `text-white/70` in: header ID label, pipeline info, section captions, progress label.

- [ ] **Step 4: Manual verification**

Tab through page → focus rings visible. `prefers-reduced-motion` → animations stop. Navigate away → no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/RenderPage.js
git commit -m "fix(render): a11y, prefers-reduced-motion, contrast fixes, router cleanup"
```

---
---

### Task 5: Audit verification and docs update

**Files:**
- Modify: `docs/superpowers/specs/2026-07-07-render-page-real-phase1-design.md`

- [ ] **Step 1: Re-run audit categories**

Verify each of the 40 original issues against the new code and fill in the status table.

- [ ] **Step 2: Run test suite**

```bash
npx vitest run
```

- [ ] **Step 3: Update spec with Phase 1 resolution summary**

Append the resolution section to the spec doc.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-07-render-page-real-phase1-design.md
git commit -m "docs(audit): add Phase 1 resolution summary"
```
