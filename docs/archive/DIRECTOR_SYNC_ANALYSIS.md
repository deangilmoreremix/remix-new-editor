# Director Sync Analysis

**Date:** 2026-07-03  
**Source repo:** https://github.com/deangilmoreremix/Open-Higgsfield-AI (`apps/director`)  
**Target repo:** this repo (`apps/director`)  
**Action taken:** Read-only analysis. No files in `apps/director` were modified.

---

## Step 1 — Confirm the divergence

### Git log (last commits touching `apps/director`)

**Target repo (this repo):**
| Date | Commit | Message |
|------|--------|---------|
| 2026-07-02 | `9ffc4431` | feat: add 9 new Director agents for VideoDB Content Factory coverage |
| 2026-04-02 | `fa060b15` | fix: production readiness - security, performance, and code quality improvements |
| 2026-03-26 | `b3671df4` | Add Rendiv, LTX-Desktop, and chatvideo-yucut as submodules |

**Upstream repo:**
| Date | Commit | Message |
|------|--------|---------|
| 2026-05-26 | `2e4316b` | Resolve merge conflicts in src/lib/router.js during rebase |
| 2026-05-18 | `54e3dd9` | feat: integrate LTX-Desktop timeline editor with muapi backend |
| 2026-05-17 | `6673eb4` | chore(deploy): commit all pending changes to enable successful Netlify build |

### Conclusion on "more recently modified"

**The target repo's `apps/director` HAS been modified more recently than upstream.**  
Target last touched `apps/director` on **2026-07-02** (commit `9ffc4431`).  
Upstream last touched `apps/director` on **2026-05-26** (commit `2e4316b`).

### Check on the `coral-cemetery` commit

The target repo does contain a merge commit with that exact title (`8595dc0c` — `merge: coral-cemetery — consolidate video agent backend and refactor UI`).  
However, **this commit did not touch `apps/director` at all.** Its changed files were at the repo root level (`.env.example`, `backend/server.js`, `components/VideoPersonalizer.jsx`, `src/main.js`, etc.). None of the changed paths are inside `apps/director`.

---

## Step 2 — Structural diff

### Files unique to upstream (source repo)

| Path | Notes |
|------|-------|
| `CONVERSION_PLAN.md` | Root-level conversion plan |
| `backend/Procfile` | Deployment config |
| `backend/director/tools/muapi.py` | Video generation tool (replaced in target) |
| `backend/director/tools/openai_tts.py` | Text-to-speech tool (replaced in target) |
| `backend/pytest.ini` | Test runner config |
| `backend/tests/` | Entire test suite (integration + unit) |
| `frontend/IMPLEMENTATION_NOTES.md` | Frontend notes |
| `frontend/SIMPLIFIED_CONVERSION.md` | Docs for Vue→vanilla JS migration |
| `frontend/src/director.js` | Vanilla JS entry point replacing Vue |
| `frontend/src/lib/director/DirectorAgentRuntime.ts` | New TS runtime module |
| `frontend/src/lib/director/DirectorBackendService.ts` | New TS backend service module |
| `frontend/src/lib/director/LLMKeyManager.ts` | New TS LLM key management module |
| `frontend/src/lib/director/index.ts` | New TS module index |
| `frontend/src/styles.css` | New external stylesheet for vanilla JS app |
| `frontend/src/vue-backup/App.vue` | Archived Vue entry component |
| `frontend/src/vue-backup/DefaultView.vue` | Archived Vue default view |
| `frontend/src/vue-backup/DirectorLayout.vue` | Archived Vue layout |
| `frontend/tests/` | Vitest test suite (director.test.js, router.test.js, setup.js) |
| `frontend/vite.config.js` | Additional Vite config |
| `frontend/vitest.config.js` | Vitest configuration |

### Files unique to target (this repo)

| Path | Notes |
|------|-------|
| `backend/.env.sample` | Backend environment sample |
| `backend/director/agents/ad_insertion.py` | New agent (9 total added in target) |
| `backend/director/agents/annual_recap.py` | New agent (9 total added in target) |
| `backend/director/agents/branding.py` | New agent (9 total added in target) |
| `backend/director/agents/content_moderation.py` | New agent (9 total added in target) |
| `backend/director/agents/copyright_detection.py` | New agent (9 total added in target) |
| `backend/director/agents/highlight_reel.py` | New agent (9 total added in target) |
| `backend/director/agents/lyric_video.py` | New agent (9 total added in target) |
| `backend/director/agents/slide_extraction.py` | New agent (9 total added in target) |
| `backend/director/agents/word_counter.py` | New agent (9 total added in target) |
| `backend/director/tools/elevenlabs.py` | TTS tool (replaced in upstream) |
| `backend/director/tools/kling.py` | Video generation tool (replaced in upstream) |
| `backend/director/tools/stabilityai.py` | Video generation tool (replaced in upstream) |
| `frontend/.env.sample` | Frontend environment sample |
| `frontend/src/App.vue` | Active Vue entry component |
| `frontend/src/layout/DirectorLayout.vue` | Active Vue layout |
| `frontend/src/main.js` | Active Vue/JS entry point |
| `frontend/src/views/DefaultView.vue` | Active Vue default view |

---

## Step 3 — Content diff on files present in both

### Identical (no action needed, ~100 files)

All backend agents except `text_to_movie.py` and `video_generation.py`, all backend core/DB/LLM/tools/constants, all docs, most config files (`.gitignore`, `LICENSE`, `Makefile`, `backend/Dockerfile`, etc.), and most frontend scaffold files (`frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/tailwind.config.js`, etc.).

### Diverged — both sides changed the same file differently (real merge needed)

| File | Nature of divergence |
|------|----------------------|
| `backend/director/agents/text_to_movie.py` | **Major diff (~113 lines).** Upstream migrated from `muapi` + `openai_tts` to `stabilityai` + `kling` + `elevenlabs`. Target still uses the old MuAPI and OpenAI TTS imports and schemes. |
| `backend/director/agents/video_generation.py` | **Major diff (~79 lines).** Upstream migrated from `muapi` to `stabilityai` + `fal` + `videodb`. Target still uses the old MuAPI engine and parameters. |
| `backend/director/handler.py` | **Moderate diff (~18 lines).** Both have the same base, but target registered **9 new agents** that upstream does not have (`HighlightReelAgent`, `SlideExtractionAgent`, `CopyrightDetectionAgent`, `ContentModerationAgent`, `AnnualRecapAgent`, `LyricVideoAgent`, `WordCounterAgent`, `BrandingAgent`, `AdInsertionAgent`). Upstream's handler.py does not reference these agents. |
| `frontend/index.html` | **Major diff (~136 lines).** Upstream replaced the Vue-loaded shell with a vanilla JS static shell loaded by `director.js`. Target retains the Vue app shell with `<div id="app">` and `vite` build output. |
| `frontend/package.json` | **Moderate diff (~20 lines).** Upstream dropped Vue, Vue Router, vitest, jsdom, and testing-library; switched to plain Vite. Target added Vue + vue-router + @vitejs/plugin-vue + testing deps, plus monorepo-local packages (`@higgsfield/layout`, `@higgsfield/tokens`, `@higgsfield/navigation`). |
| `frontend/src/router/index.js` | **Major diff (~331 lines).** Upstream converted from a custom vanilla JS hash router with `/timeline`, `/library`, and `/settings` routes to a minimal Vue-Router setup with only `/`. Target retains the Vue-Router setup (which is what matched upstream's `vue-backup` naming convention, but the content actually differs because upstream's `router/index.js` was rewritten to vanilla JS). |
| `frontend/vite.config.ts` | **Minor diff (~3 lines).** Target adds `@vitejs/plugin-vue` to plugins array. Upstream removed the Vue plugin and uses an empty plugins array. |
| `render.yaml` | **Moderate diff (~27 lines).** Target defines `director-backend` and `director-frontend` services with a `starter` backend plan and explicit env vars (`VIDEO_DB_API_KEY`, `OPENAI_API_KEY`, etc.). Upstream defines `backend` and `frontend` services with a `free` backend plan and stripped-down env vars (no explicit API keys). |

### Target is ahead

There is **no strictly "upstream is ahead"** file in the traditional sense because upstream has made incompatible architectural changes (vanilla JS vs Vue). The closest to "target is ahead" is `backend/director/handler.py`, where target added 9 new agent registrations that upstream does not have at all.

---

## Step 4 — Vue restructure investigation

### What upstream did

Upstream moved the Vue frontend files out of the active source tree and replaced them with a vanilla JavaScript application.

**The migration happened in upstream commit `2446dc6`:**  
`feat: complete timeline editor testing framework and AI storyboarder app`

Specific changes in that commit:
- `frontend/src/main.js` was renamed to `frontend/src/director.js` (254 lines changed)
- `frontend/src/App.vue` was moved to `frontend/src/vue-backup/App.vue`
- `frontend/src/views/DefaultView.vue` was moved to `frontend/src/vue-backup/DefaultView.vue`
- `frontend/src/layout/DirectorLayout.vue` was moved to `frontend/src/vue-backup/DirectorLayout.vue`
- `frontend/src/router/index.js` was rewritten from a custom hash router to a minimal Vue-Router (and later converted fully to vanilla JS)
- `frontend/index.html` was rewritten to load the vanilla JS entry and styles
- A new `frontend/src/styles.css` was added
- Vue dependencies were removed from `frontend/package.json`
- Vitest config was added

**Why?**  
The commit message explicitly states: *"Also removes broken Vue Router from Director app"*. The broader upstream history shows a deliberate move away from Vue:
- `6275c75 refactor(director-frontend): migrate timeline editor UI to vanilla JS`
- `31ceff7 feat(vimax): migrate to vanilla JS architecture with custom Vite config`
- `e035aab feat(vanilla): wire 45 agents to Render backend with Supabase auth`

**What upstream now uses in place of those Vue files:**

| Old Vue file | Replacement in upstream |
|--------------|------------------------|
| `frontend/src/App.vue` | Deleted. The `<div id="app">` is now in `frontend/index.html`. Bootstrapping is done by `frontend/src/director.js`, which exports `initDirector()`. |
| `frontend/src/main.js` | Replaced by `frontend/src/director.js` (vanilla JS, 500 lines). It handles Socket.io setup, Axios API client, `connectToBackend()`, DOM rendering (playback UI, timeline, media grid, chat, generate panel), and `initDirector()`. |
| `frontend/src/views/DefaultView.vue` | Deleted. The view logic is now embedded directly in `director.js` and rendered via plain DOM manipulation. |
| `frontend/src/layout/DirectorLayout.vue` | Deleted. Layout structure moved entirely into `frontend/index.html` as static HTML. |
| `frontend/src/router/index.js` | Rewritten from Vue-Router to a custom vanilla JS hash router (in earlier commits), then simplified. |
| `frontend/vite.config.ts` | Stripped of Vue plugin; plain Vite build. |

**Important note:** The vue-backup files are byte-for-byte identical to the target repo's active Vue files (verified by `diff`), except for `DefaultView.vue` which has additional workflow content in upstream's backup copy. This means upstream's `vue-backup` preserves the original Vue implementation before any subsequent edits.

### What this means for the target repo

The target repo is **still running the Vue-based frontend** that upstream has already deprecated and moved to `vue-backup`. Upstream's active frontend is vanilla JS. This is a fundamental architectural divergence, not just a file move.

---

## Step 5 — Report and recommendation

### Summary of actual differences

1. **Frontend architecture:** Target is Vue-based (`App.vue`, `DirectorLayout.vue`, `DefaultView.vue`, `vue-router`, Vite Vue plugin). Upstream has migrated to vanilla JS (`director.js`, static HTML in `index.html`, custom hash router). The Vue files live in `upstream's vue-backup/` only.

2. **Backend video engines:** Target uses **MuAPI** + **OpenAI TTS** in `text_to_movie.py` and `video_generation.py`. Upstream has migrated to **StabilityAI**, **Kling**, **Fal**, and **ElevenLabs** in those same files.

3. **New backend agents:** Target added 9 agents (`ad_insertion.py`, `annual_recap.py`, `branding.py`, `content_moderation.py`, `copyright_detection.py`, `highlight_reel.py`, `lyric_video.py`, `slide_extraction.py`, `word_counter.py`) plus matching imports in `handler.py`. Upstream does not have these files at all.

4. **Testing:** Upstream has a significant test suite (`backend/tests/`, `frontend/tests/`) that target lacks.

5. **Other tooling:** Upstream added `DirectorAgentRuntime.ts`, `DirectorBackendService.ts`, `LLMKeyManager.ts` (TypeScript). Target does not have these.

6. **Deployment / render config:** Different service names, plans, and env vars.

### Recommendation

**This is NOT safe to sync as a simple upstream-wins.** The two trees have diverged in ways that make naive overwriting destructive.

**Specific risks of upstream-wins:**
- You would overwrite the active Vue frontend with a vanilla JS app that downstream consumers may depend on.
- You would drop the 9 new VideoDB Content Factory agents that were added in target.
- You would revert video generation engines from StabilityAI/Kling/Fal back to the deprecated MuAPI.

**Target's refactor direction to keep:**
The target repo's local refactor (keeping Vue active, adding new agents, retaining MuAPI/ElevenLabs/Kling/StabilityAI) represents the **more recently modified** and feature-complete side. However, upstream does have valuable additions (test suite, TypeScript runtime modules, deployment fixes) that could be pulled in selectively.

### Recommended sync direction

Do **not** do a blind upstream-wins sync. Instead:

**Option A — Keep target's current structure and cherry-pick specific upstream fixes:**
- Pull upstream's new test suite (`backend/tests/`, `frontend/tests/`)
- Pull upstream's TypeScript modules (`frontend/src/lib/director/`)
- Pull upstream's `render.yaml` and `backend/pytest.ini` if desired
- Ignore upstream's Vue→vanilla JS migration for now, or schedule it as a deliberate separate task

**Option B — Real file-by-file merge:**
- For `backend/director/agents/text_to_movie.py` and `video_generation.py`, merge upstream's engine migration (stabilityai/kling/elevenlabs/fal) while preserving target's additional features.
- For `backend/director/handler.py`, retain target's 9 new agent registrations (upstream doesn't have them, so these are target-only additions).
- For frontend, decide explicitly: keep Vue (target) or adopt vanilla JS (upstream). Do not let this decision be made accidentally.

**Option C — Adopt upstream's architecture fully:**
- Switch the frontend to vanilla JS (`director.js`, static HTML)
- Move Vue files to `vue-backup/`
- Drop Vue dependencies from `package.json`
- Update the build pipeline
- Then pull target's 9 new agents and any other forward ports

**Final recommendation:** Start with **Option A** (cherry-pick) for low-risk improvements (tests, TS modules). The frontend and backend engine decisions require explicit product/architectural buy-in and should not be decided by an automatic sync.
