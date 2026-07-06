# FEATURE_SYNC_AUDIT

**Audit date:** 2026-07-04  
**Source:** https://github.com/deangilmoreremix/Open-Higgsfield-AI (default branch `main`, latest recursive tree SHA: current)  
**Target:** `remix-new-editor` (incandescent-cheese worktree)  

> **Scope:** Diagnostic only. No files were copied, merged, or overwritten during this pass.

---

## PART A — Video Agent Studio (`apps/agents`)

### 1. Existence in target
- **Result:** `apps/agents` does **not** exist in the target repo at all.
- **Evidence:** `glob("apps/agents/**/*")` returned empty. `git log --oneline -- apps/agents` returned no history.
- **Implication:** This is not a "sync differences" situation. The `apps/agents` migration never completed. The correct next step is running the original migration, not a diff.

### 2. Source structure (confirmed)
Source `apps/agents/` contains:
- `package.json`
- `src/index.js`
- `src/muapi.js`
- `src/components/AgentStudio.jsx`
- `src/components/MarketingStudio.jsx`

Target has **zero** of these paths.

### 3. `workflow-builder` local dependency
- **Dangling reference:** The task references `file:../vibe-workflow/packages/workflow-builder`.
- **Source:** Contains `apps/vibe-workflow/packages/workflow-builder/` (full package with `src/WorkflowBuilder.jsx`, components, config, etc.). Source `vite.config.js` also excludes `workflow-builder` in `optimizeDeps` and `esbuild`.
- **Target:** No `apps/vibe-workflow/` directory exists. `glob("**/workflow-builder/**")` returned empty. Target `package.json` has no `workflow-builder` entry.
- **Verdict:** The local dependency does not resolve in this repo. It is a missing package.

### Verdict: NOT YET MIGRATED
`apps/agents` and its `vibe-workflow` local dependency were never brought into the target repo.

---

## PART B — Director Studio (`apps/director`)

### 1. Latest upstream commit context
- Source latest commit touching `apps/director`: `2e4316b8` — **2026-05-26** — titled "Resolve merge conflicts in `src/lib/router.js` during rebase".
- Target latest commit touching `apps/director`: `9ffc4431` — **2026-07-02** — titled "feat: add 9 new Director agents for VideoDB Content Factory coverage".
- Target has 3 director commits total (Mar 26, Apr 2, Jul 2). Source only has this one large director-touching commit on main.

**Note:** Because source's `apps/director` appears to have been introduced in a single initial migration commit (all 300 changed files show `(+X,-0)`), there are no subsequent upstream director commits to count as "stale by N." The comparison is therefore about **divergence**, not about missing commits.

### 2. Structural diff (files)
Compared recursive file listings for `apps/director`:

| Category | Count |
|---|---|
| Files present in both | ~84 |
| In source, not in target | 18 |
| In target, not in source | 26 |

**Key source-only files (missing in target):**
- `CONVERSION_PLAN.md`
- `backend/Procfile`
- `backend/tests/` (7 files: integration + unit tests)
- `frontend/IMPLEMENTATION_NOTES.md`
- `frontend/SIMPLIFIED_CONVERSION.md`
- `frontend/src/director.js`
- `frontend/src/lib/director/` — `DirectorAgentRuntime.ts`, `DirectorBackendService.ts`, `LLMKeyManager.ts`, `index.ts`
- `frontend/src/styles.css`
- `frontend/src/vue-backup/` — `App.vue`, `DefaultView.vue`, `DirectorLayout.vue`
- `frontend/tests/` — `director.test.js`, `router.test.js`, `setup.js`
- `frontend/vite.config.js`
- `frontend/vitest.config.js`

**Key target-only files (not in source):**
- `backend/.env.sample`, `backend/.dockerignore`
- `backend/director/agents/` — `ad_insertion.py`, `annual_recap.py`, `branding.py`, `content_moderation.py`, `copyright_detection.py`, `highlight_reel.py`, `lyric_video.py`, `slide_extraction.py`, `word_counter.py`
- `backend/director/tools/` — `elevenlabs.py`, `kling.py`, `stabilityai.py`
- `frontend/.env.sample`
- `frontend/src/App.vue` / `DirectorLayout.vue` / `main.js` / `views/DefaultView.vue` (original Vue stack, source moved these to `vue-backup/`)
- `frontend/src/style.css`
- `mkdocs.yml`
- `render.yaml`
- `setup.sh`

### 3. New agents, tools, routes upstream
- **New backend agents in target (not in source):** 9 new agents added in target's July 2 commit (`ad_insertion`, `annual_recap`, `branding`, `content_moderation`, `copyright_detection`, `highlight_reel`, `lyric_video`, `slide_extraction`, `word_counter`) plus 3 new tools (`elevenlabs`, `kling`, `stabilityai`).
- These are target-only advances; upstream source does **not** have them.
- Source frontend includes test infrastructure and `lib/director` runtime that target is missing.

### 4. Vue-vs-vanilla-JS frontend (still unresolved)
- **Upstream has moved further:** Source director frontend is now vanilla JS. The original Vue files (`App.vue`, `DirectorLayout.vue`, `main.js`, `views/DefaultView.vue`) were moved to `src/vue-backup/`. Source now loads `src/director.js` with a hand-rolled vanilla router (`lib/director/LLMKeyManager.ts`, `DirectorAgentRuntime.ts`, `DirectorBackendService.ts`).
- **Target is still on Vue:** Target's `apps/director/frontend/src/router/index.js` uses `createRouter` / `createWebHistory` and imports `App.vue`, `DirectorLayout.vue`, `DefaultView.vue`. Target does **not** have `director.js` or `lib/director/`.
- **Conclusion:** The upstream migration away from Vue is complete in source. Target is unresolved on this and is now materially behind.

### Verdict: MIGRATED BUT DIVERGED
Target's director backend has actually **surpassed** upstream in agent/tool count (9 new agents + 3 new tools). However, the frontend is stale: it remains on the original Vue stack while upstream converted to vanilla JS (with Vue relegated to `vue-backup/`). Target is also missing upstream's frontend runtime (`lib/director/`), tests, and documentation. Because there is no single upstream commit to count, the divergence is better described as "frontend architecture unsynced" rather than "stale by N commits."

---

## PART C — Timeline Studio

### 1. `router.js` — `timeline` pageLoader
Target `src/lib/router.js` line 70:
```js
timeline: () => import('../components/TimelineEditorPage.js').then(m => m.TimelineEditorPage()),
```
- Points to `TimelineEditorPage.js` (the old stub).
- Source `src/lib/router.js` (commit 2026-07-03) points to:
  ```js
  timeline: () => import('../components/TimelineEditorPage.jsx').then(m => m.TimelineEditorPage()),
  ```
- **Verdict:** Open issue **still unresolved** in target. The router is still loading the stub instead of the migrated `.jsx` feature.

### 2. Backend proxy work (`backend/server.js` + `vite.config.js`)
- **`backend/server.js` exists in target** (134 lines, modified Jul 3). It is a basic Express server with `cors()`, routes for `/api/ai-agent`, `/api/scene-detection`, `/api/semantic-search`, `/api/speech-transcription`, `/videoagent`, and a `/mcp` WebSocket.
- **Source `backend/server.js`** is materially different: it adds `Redis` distributed rate limiting (`ApiRateLimiter`, `AuthRateLimiter`), `securityLogStorage`, strict CORS with allowed origins, and structured middleware. It is ahead.
- **`vite.config.js` exists in target** (116 lines, modified Jul 4). It contains:
  - `server.proxy['/api']` → `api.muapi.ai` (rewrite `/api` → empty)
  - `configureServer` with `timelineBackendProxyPaths` → `http-proxy` to `localhost:3001`
  - Security headers middleware
- **Critical issue:** The `timelineBackendProxyPaths` (`/api/ai-agent`, `/api/scene-detection`, `/api/semantic-search`, `/api/speech-transcription`, `/mcp`) will **not** take effect over the `/api` proxy in current Vite middleware ordering. By default, `server.proxy` entries are composed before `configureServer` middlewares appended via `server.middlewares.use()`. Requests to `/api/ai-agent` will match the `/api` proxy first and be forwarded to `api.muapi.ai`, never reaching `localhost:3001`.
- Additionally, `/videoagent` (mounted in `backend/server.js`) is **not** in `timelineBackendProxyPaths`.
- **Conclusion:** The backend proxy wiring exists but is **unfinished and likely non-functional** end-to-end. No evidence of confirmed working state was found in the code.

### 3. `TimelineEditorPage.jsx` + dependency graph
**Source state (2026-07-03 commits):**
- `src/components/TimelineEditorPage.jsx`: 4,985 lines
- `src/lib/editor/timelineAnimationIntegration.js`
- `src/lib/editor/timelineEditorWithAnimation.js`
- `src/lib/timelineAgentHooks.js`
- `src/lib/timelineIntegrationCoordinator.js`
- `src/lib/timeline/TimelineEngine.js`
- `src/timelineAgentIntegration.js`
- `src/styles/timeline-editor.css`, `timeline-editor.css.backup`
- `src/types/timeline-editor.d.ts`
- `src/test/` — 8 test files including `unified-timeline-editor-phase4-integration.test.js`
- `src/components/videco/features/editor-v2/timeline/index.tsx`

**Target state:**
- `src/components/TimelineEditorPage.jsx`: 5,052 lines — **diverged by 194 lines** from source.
  - Source has **no** duplicate subtitle imports. Target duplicates `SubtitleTimeline` / `SubtitleControls` / `SubtitleEditorModal` / `whisperService` imports (lines 34–43 appear twice).
  - Multiple CSS spacing differences inside the embedded `<style>` block: `.top-actions` gap/justify-content, `.main-grid` column widths, `.timeline-top` gap/margin, `.side-card` padding, etc.
- `src/lib/editor/timelineAnimationIntegration.js` — **missing** in target
- `src/lib/editor/timelineEditorWithAnimation.js` — **missing** in target
- `src/lib/timeline/TimelineEngine.js` — present ✓
- `src/lib/timelineAgentHooks.js` — present ✓
- `src/lib/timelineIntegrationCoordinator.js` — **missing** in target
- `src/timelineAgentIntegration.js` — present ✓
- `src/styles/timeline-editor.css` — present ✓
- `src/styles/timeline-editor.css.backup` — **missing**
- `src/types/timeline-editor.d.ts` — present ✓
- `src/test/` — 7 files present; missing `unified-timeline-editor-phase4-integration.test.js`
- `src/components/videco/features/editor-v2/timeline/index.tsx` — **missing** in target
- `src/lib/editor/` — also diverged: target has `exportWorker.js` and `renderWorker.js` (stubs) that source does not have; source has `cutoutPro.js`, `dragDrop-lazy.js`, `dragDrop.js`, `dragGuides.js`, `dropBehavior.js`, `dynamicFormGenerator.js`, `timelinePlayback.js`, `timelineRenderer.js`, `timelineRendererEnhanced.js`, `timelineRendererOriginal.js`, `timelineStateAdapter.js` that target does not have.

### Verdict: MIGRATED BUT STALE / DIVERGED
- The router-vs-stub bug is still open.
- The backend proxy was added but is not end-to-end working (middleware ordering bug + missing `/videoagent` proxy).
- `TimelineEditorPage.jsx` has drifted from upstream (68 extra lines, duplicate imports, CSS differences).
- Upstream has added several timeline integration files (`timelineIntegrationCoordinator.js`, `timeline-editor.css.backup`, one test, `videco` timeline module) that are not yet reflected in target.

---

## Summary Verdicts

| Studio | Verdict |
|---|---|
| **Video Agent Studio** | **Not yet migrated.** `apps/agents` does not exist. The migration never completed. The `vibe-workflow/packages/workflow-builder` local dependency is also absent and does not resolve. |
| **Director Studio** | **Migrated but diverged.** Backend in target is actually newer than upstream (9 new agents + 3 new tools added after the last upstream director commit). Frontend, however, is unsynced: upstream moved to vanilla JS (`vue-backup/` legacy), while target still uses the original Vue router/components and is missing upstream's `lib/director/`, tests, and docs. |
| **Timeline Studio** | **Migrated but stale/diverged.** Router still points to the old `.js` stub. Backend proxy is wired but broken (middleware ordering prevents localhost:3001 routing). `TimelineEditorPage.jsx` has drifted (duplicate imports, CSS differences). Upstream has added integration files and tests that target has not re-synced. |
