# Render Page — Phase 1: Real Foundation

**Date:** 2026-07-07
**Status:** Approved (user said "go")
**Branch:** `incandescent-cheese`
**Scope:** Phase 1 of 4. This spec covers only the foundation slice. Phases 2–4 (real export pipeline, AI finishing, orchestration) are described only at a high level and will get their own specs.

---

## 1. Problem

`src/components/RenderPage.js` (the page at `/#/render`) is a UI shell. Every one of the 19 actions it exposes (Export Video, Download Frame, Queue Render, Trailer Cut, Social Resize, Remix Scene, Create Shorts, Generate Highlights, Add Subtitles, Dub/Voiceover, Export Variations, AI Auto-Edit, Agentic Editor, Full Editor, Copy Prompt, Duplicate Render, Save as Template, Send to Storyboard, Publish/Deliver) resolves to a single `setInterval` + `Math.random()` simulation that always reports success. The "render worker" (`src/lib/editor/renderWorker.js`) and "export worker" (`src/lib/editor/exportWorker.js`) are explicitly labeled stubs. The page ignores `?videoUrl=` and `?asset=` and never shows a real `<video>` element. The accompanying audit identified 40 issues across mock functionality, accessibility, performance, and responsive design.

## 2. Goal

Make the render page a real video finishing tool's foundation. After Phase 1:

- The page accepts a video URL/asset from upstream modules and plays it in a real `<video>` element with native controls.
- The page exposes real, local-only finishing operations: download current frame, copy prompt, save/duplicate as template, save draft, queue render, navigate to storyboard.
- The page no longer pretends to do work it can't do. Deferred actions (export pipeline, AI features) show a clear "coming in Phase 2/3" toast instead of fake progress.
- The page is accessible (keyboard focus visible, ARIA labels, contrast fixes, `prefers-reduced-motion` honored) and the leaks identified in the audit are fixed.
- **No existing UI element, button, tile, or section is removed.** All 19 actions remain visible and clickable; the ones deferred to later phases are simply honest about their status.

## 3. Non-Goals (Phase 1)

These are explicitly **out of scope** and reserved for later specs:

- Real video export / encoding (Export Video, Export Variations, Publish/Deliver, Trailer Cut, Social Resize) — **Phase 2**
- AI finishing (Subtitles, Voiceover, Highlights, Create Shorts, AI Auto-Edit) — **Phase 3**
- Real render worker implementation, orchestration, queue draining — **Phase 2 & 4**
- New dependencies (no `mp4-muxer`, `ffmpeg.wasm`, etc. added in this phase)
- Changes to upstream call sites (`VideoAgentPage.js:276`, `EditorPage.js:1116`, `DirectorPage.js:370`, `assetActions.js:106`)

## 4. Architecture

### 4.1 Component layout

```
RenderPage (DOM assembly, event wiring)
  ├── src/lib/editor/renderActions.js     NEW: pure local-only action functions
  │     ├── getVideoMetadata(videoUrl)    — probe duration / dims
  │     ├── downloadFrame(videoEl, opts)  — canvas capture → blob → download
  │     ├── copyToClipboard(text)         — navigator.clipboard + fallback
  │     ├── saveDraft({videoId,videoUrl,preset,output})
  │     ├── saveTemplate(...)
  │     ├── duplicateTemplate(id)
  │     ├── listTemplates()
  │     ├── listDrafts()
  │     ├── enqueueRender(job)
  │     ├── listRenderQueue()
  │     ├── removeFromRenderQueue(id)
  │     └── sendToStoryboard(videoId, videoUrl)  — calls navigate()
  ├── src/lib/editor/renderQueueStore.js  NEW: thin wrapper over the existing
  │                                          localStorage key 'render_queue'
  │                                          introduced in assetActions.js:127
  │     and a subscriber model so the page can re-render when queue changes.
  └── src/lib/router.js (modified)        — call container.cleanup?.() on
                                             navigation away to stop leaked
                                             intervals.
```

### 4.2 Why a separate `renderActions.js`

`RenderPage.js` is currently 454 lines of mixed DOM creation, fake simulation, and event wiring. The pure local-only actions (download frame, copy, save template, etc.) have nothing to do with the DOM assembly and can be unit-tested in isolation. Extracting them:

- Lets the simulation function `runAction()` shrink to a dispatcher that calls the right action based on the action name.
- Makes Phase 1 testable: each action can be exercised with a stubbed DOM/video element.
- Makes Phase 2/3 easier: when the real export worker ships, only the dispatcher changes; the pure actions stay.

### 4.3 Data flow

```
URL bar (?videoId&videoUrl | ?asset=…)
     │
     ▼
RenderPage constructor
     │
     ├── If ?asset= present → assetStore.getAsset(id) → use asset.media.url
     ├── Else → use ?videoUrl or fallback to ''
     │
     ▼
<video src=videoUrl controls />
     │
     ├── onloadedmetadata → probe duration/dims → update #statsRow
     ├── onerror           → show "video failed to load" message, no fake play
     │
     ▼
User clicks a button
     │
     ▼
dispatchAction(name, payload)          // in RenderPage.js
     │
     ├── local action    → renderActions.<fn>(...)   → toast
     ├── navigation      → navigate('storyboard', …)  → router
     ├── deferred action → showToast(`${name} — available in Phase 2/3`)
     │                    (this replaces the fake setInterval)
     │
     ▼
For Queue Render: enqueueRender({...}) → renderQueueStore.notify() →
                    RenderPage re-renders the queue list inside the page
```

### 4.4 localStorage keys (all namespaced under `render:`)

| Key | Type | Owner | Purpose |
|---|---|---|---|
| `render:templates` | JSON array | renderActions | Saved render templates |
| `render:drafts` | JSON array | renderActions | Saved drafts (hero "Save Draft") |
| `render:queue` | JSON array | renderQueueStore (wraps existing `render_queue` from `assetActions.js:127` and the original `sendToRenderQueue` in `assetActions.js:119–143`; both keys are read & migrated on first load) | Render queue, displayed in the sidebar |

The `render:queue` key is the existing one used by `assetActions.sendToRenderQueue()`. We additionally accept the older `render_queue` key on read for backwards compatibility, but write only to `render:queue` going forward.

### 4.5 `runAction` → `dispatchAction` refactor

Today `runAction(action)` (lines 371–406) does two things: updates UI status labels and runs the fake simulation. In Phase 1, we replace it with `dispatchAction(name)` which:

1. Looks the name up in a new `ACTION_HANDLERS` map (local in the file).
2. If a handler exists → call it; show toast on success/failure.
3. If no handler but the name is in `ACTION_PIPELINES` → show a "Coming in Phase 2/3" toast with the phase label derived from a new `PHASE` field added to each `ACTION_PIPELINES` entry.
4. Unknown names → no-op + console warn (defensive).

`ACTION_PIPELINES` gets a new `phase: 2 | 3 | 4` property. Existing UI is unchanged.

### 4.6 A11y / perf wiring

- All buttons in the file get a Tailwind `focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none` class.
- `#progressPercent` and `#progressStatus` get `aria-live="polite" aria-atomic="true"`.
- Active preset/active action button get `aria-pressed="true"`.
- `text-white/40` and `text-white/45` labels bump to `text-white/70` (≥4.5:1 on `#0a0a0b`).
- The always-spinning `animate-spin` on line 325 gets gated by `isRunning` (only spins when a job is active).
- A `@media (prefers-reduced-motion: reduce)` style block in `RenderPage.js` (added via a one-time `document.head` style append, same pattern as `LandingPage.jsx:46–91`) disables `animate-spin`/`animate-pulse`.
- `container.cleanup?.()` is now called by the router (see §6).

## 5. Detailed changes

### 5.1 `src/components/RenderPage.js` (modified)

**Removed/replaced:**
- Lines 90–91 `let progress = 0; let currentStage = 'finishing';` — dead state, removed.
- Lines 190–193 (static play triangle `<div>`) — replaced with a real `<video src controls>` element built with `document.createElement('video')` (so the rest of the imperative DOM-building style is preserved).
- Lines 199–204 (hardcoded "Duration / Resolution / Estimated Time" stat boxes) — values are filled at runtime from the loaded video's `duration`, `videoWidth`, `videoHeight`, and the chosen preset's estimated time (preset table already exists, lines 17–22).
- Lines 339–346 (static "Output Format / Frame Rate / Quality" `<div>`s) — replaced with real `<select>` and `<input type="range">` controls that update an `outputSettings` state object in closure. State is read by future phases; Phase 1 only persists it to the saved template.
- Lines 371–406 (`runAction`) — replaced with `dispatchAction` (see §4.5). The fake `setInterval` and `Math.random()` are deleted. The closure variables `activeIntervals` and `isRunning` are removed because the simulation is gone.
- Line 444 (`#saveDraftBtn` click) → calls `dispatchAction('Save Draft')` which is now a real handler.
- Line 445 (`#startRenderBtn` click) → calls `dispatchAction('Queue Render')` which is now a real handler.

**Added:**
- A new `videoElement` closure variable (the `<video>` DOM node) and a `loadVideo(url)` function that sets `videoElement.src` and waits for `loadedmetadata`.
- Event listeners on `videoElement`: `loadedmetadata`, `error`, `timeupdate` (debounced for stat refresh).
- An on-page render queue list inside the right sidebar that subscribes to `renderQueueStore` and re-renders on changes.
- An on-page templates/drafts list (toggleable, hidden by default behind a small "Show saved" button to keep the existing layout intact).
- `role="status" aria-live="polite"` on progress nodes.
- `aria-pressed` on preset buttons and action buttons.
- A `prefers-reduced-motion` style block.

**Unchanged:**
- All 19 actions remain in `ACTION_BUTTONS`, `ACTION_TILES`, `QUICK_ACTIONS`, `NEXT_ACTIONS` (lines 48–69). No button is removed.
- `REPO_ENDPOINTS`, `PRESET_CONFIG`, `ACTION_PIPELINES` keep their keys. `ACTION_PIPELINES` entries get a `phase: 2 | 3 | 4` annotation.
- Hero, layout, grid classes, theme — unchanged.
- The `container.cleanup` function is kept (now actually called by the router).

### 5.2 `src/lib/editor/renderActions.js` (new file)

Pure functions, no DOM dependencies for the storage operations, but the frame download accepts a `<video>` element and a target filename. Functions throw on error; callers (the dispatcher) translate to toasts.

```js
// Shape
export async function getVideoMetadata(videoUrl) -> { duration, width, height } | null
export async function downloadFrame(videoEl, { filename = 'frame.png' } = {}) -> void
export async function copyToClipboard(text) -> boolean
export function saveDraft(entry) -> entry                       // returns entry with id+ts
export function saveTemplate(entry) -> entry
export function duplicateTemplate(id) -> entry | null
export function listTemplates() -> entry[]
export function listDrafts() -> entry[]
export function deleteTemplate(id) -> void
export function deleteDraft(id) -> void
export function sendToStoryboard(videoId, videoUrl) -> void     // calls navigate()
```

`entry` shape: `{ id, videoId, videoUrl, title, preset, outputSettings, createdAt, updatedAt }`.

### 5.3 `src/lib/editor/renderQueueStore.js` (new file)

A thin pub/sub wrapper around `localStorage.render:queue` (with one-time migration from legacy `render_queue`):

```js
export function enqueueRender(job) -> entry
export function listRenderQueue() -> entry[]
export function removeFromRenderQueue(id) -> void
export function clearRenderQueue() -> void
export function subscribe(listener) -> unsubscribe
```

`enqueueRender` calls `notify()` which calls all subscribers synchronously. The page subscribes once on mount and re-renders the queue list on every notification.

### 5.4 `src/lib/router.js` (modified)

After the `navigate` function successfully mounts a new page (line 130), call the previous page's `cleanup` if present. Track `currentPageEl` at module scope; on teardown, call `currentPageEl?.cleanup?.()` then null it before mounting the new page. This is a one-place change.

The router already keeps a reference to `currentPage` (the route name, line 76/96). Add a parallel `currentPageEl` (the DOM node) on line 76.

### 5.5 `src/lib/editor/renderWorker.js` (NOT modified in Phase 1)

The stub stays for now. In Phase 2, we'll replace this file with a real WebCodecs/mp4-muxer implementation. In Phase 1, the page does not call it at all — only `dispatchAction` does, and `dispatchAction` only routes local actions.

## 6. Error handling

| Failure | User-visible behavior |
|---|---|
| `?asset=xxx` doesn't resolve in assetStore | Toast: "Asset not found" + still render the page with the placeholder title. Don't crash. |
| `<video>` errors (404, codec, CORS) | Show inline "Failed to load video" message inside the preview area; toast: "Could not load video". Disable Download Frame, Export, and Queue Render buttons until source is valid. |
| `navigator.clipboard` unavailable or denied | Fallback to `document.execCommand('copy')` on a temp textarea; if that also fails, toast: "Copy failed — please copy manually". |
| localStorage quota exceeded | Catch `QuotaExceededError`, toast: "Storage full — clear saved templates". |
| `duplicateTemplate` called on a missing id | Return `null`; toast: "Template not found". |
| `dispatchAction` called with unknown name | `console.warn`; no toast. |

## 7. Testing

Phase 1 introduces no test framework changes. The existing test setup uses Vitest (per the imports in `src/test/timeline-renderer.test.js`).

**New test file:** `src/test/render-actions.test.js`
- `getVideoMetadata` — uses a small synthetic `HTMLVideoElement` mock to verify it returns `null` on error and a `{duration, width, height}` object on success.
- `saveDraft` / `saveTemplate` / `listDrafts` / `listTemplates` / `deleteDraft` / `deleteTemplate` / `duplicateTemplate` — pure localStorage round-trips; clean up the keys in `afterEach`.
- `enqueueRender` / `listRenderQueue` / `removeFromRenderQueue` / `clearRenderQueue` — verify the legacy `render_queue` key is migrated on first read.
- `subscribe` — verify listeners are called on every queue mutation and that `unsubscribe()` works.

**Manual smoke test (recorded in PR description):**
1. `npm run dev` and open `/#/render?videoUrl=<any-public-mp4>` → video plays.
2. Stats row shows real duration and resolution.
3. Click "Download Frame" → PNG downloads with the current frame.
4. Click "Copy Prompt" → toast, paste works.
5. Click "Save Draft" / "Save as Template" → entries appear in the saved list; persist across reload.
6. Click "Duplicate Render" on a saved template → a `(Copy)` entry appears.
7. Click "Queue Render" → entry appears in the on-page queue; reload → still there.
8. Click "Send to Storyboard" → navigates to `/#/storyboard?videoId=…&videoUrl=…`.
9. Click a deferred action (e.g. "Export Video") → toast says "Available in Phase 2".
10. Tab through the page with the keyboard → every button has a visible focus ring.
11. `prefers-reduced-motion: reduce` in devtools → spinner and pulse animations stop.
12. Open `/#/render?asset=<a-known-asset-id>` → loads asset URL; `?asset=missing` → toast + still usable.
13. Console: no errors, no warnings about deprecated APIs.

## 8. Rollout

- Single PR: `feat(render): phase 1 real foundation`
- No feature flag needed — the page has always been reachable at `/#/render`, and Phase 1 strictly improves correctness without removing capabilities.
- No data migration required (we read legacy `render_queue` on first load).
- No documentation site changes — the existing `apps/director/docs/get_started/render.md` is for the Render.com platform YAML, unrelated to this page.

## 9. Open questions

None — the user approved the design ("go"). Deferred actions clearly point to Phase 2/3/4 toasts, which is honest behavior. If a real backend integration becomes available mid-Phase 1, the dispatcher is the single place to add it.
