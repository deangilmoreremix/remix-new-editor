# Render Page — Phase 3: AI Finishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire all 5 Phase 3 AI actions (Add Subtitles, Dub/Voiceover, Generate Highlights, Create Shorts, AI Auto-Edit) to real implementations using existing services (`whisper-client.js`, `SceneDetector.js`, `aiService.js`, `aiMuapi.js`).

**Architecture:** New `renderAiActions.js` module wraps existing services. Modified `RenderPage.js` adds Phase 3 handlers. Each handler orchestrates one or more existing services.

**Tech Stack:** Vanilla JS, existing aiService/whisper-client/SceneDetector. No new dependencies.

## Global Constraints

- No new npm dependencies.
- No removal of any UI element.
- All 19 actions remain visible.
- Follow existing code style.
- Commit after each task.

---
---

### Task 1: `src/lib/editor/renderAiActions.js` (new)

**Files:**
- Create: `src/lib/editor/renderAiActions.js`
- Test: `src/test/render-ai-actions.test.js`

**Interfaces:**
- Consumes: `whisper-client.js`, `SceneDetector.js`, `aiService.js`
- Produces: `generateSubtitles(videoUrl, language)`, `generateHighlights(videoUrl, sensitivity)`, `generateVoiceover(script, voice)`, `createShorts(videoUrl, maxDuration)`, `runAiAutoEdit(videoUrl, options)`

- [ ] **Step 1: Write tests with mocked services**
- [ ] **Step 2: Implement functions wrapping real services**
- [ ] **Step 3: Run tests and commit**

---
---

### Task 2: Wire Phase 3 handlers in `RenderPage.js`

**Files:**
- Modify: `src/components/RenderPage.js`

- [ ] **Step 1: Add Phase 3 imports and handlers**
- [ ] **Step 2: Wire progress updates and output handling**
- [ ] **Step 3: Test all 5 Phase 3 actions**
- [ ] **Step 4: Commit**

---
---

### Task 3: Audit and test

- [ ] **Step 1: Run full test suite**
- [ ] **Step 2: Manual verification**
- [ ] **Step 3: Commit**
