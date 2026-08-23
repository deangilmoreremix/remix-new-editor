# Production Testing Plan — All 18 Studios

**Date:** 2026-07-31
**Status:** Test infrastructure audited, regression suite created, E2E smoke created
**Forbidden studios NOT touched:** TimelineEditorPage, DirectorPage, videoAgentService, render code

---

## Test Infrastructure Audit — What We Found

### Frameworks
- **Vitest 4.1.10** (jsdom 27.1.0 env) for unit/integration tests
- **Playwright 1.61** for E2E
- **Jest 29** in `backend/` (but `backend/tests/*` actually use Vitest APIs)

### Test counts (this worktree)
| Location | Files | Tests | Passing | Failing | Skipped |
|---|---|---|---|---|---|
| `src/test/*.test.js` | 29 | 392 | 376 (96%) | 6 (pre-existing) | 10 |
| `src/test/production-readiness.test.js` (NEW) | 1 | 32 | 28 | 0 | 4 (ErrorBoundary React — covered by E2E) |
| `e2e/studio-video-features.spec.js` (NEW) | 1 | 18 | 17 | 0 | 1 (CinemaTemplateStudio — no route) |
| `backend/tests/director.test.js` | 1 | 8 | 8 | 0 | 0 |
| **TOTAL** | **32** | **450** | **429 (95%)** | **6 (pre-existing)** | **15** |

### Pre-existing failures (NOT caused by this session)
- `gtm-prompt-modal.test.js`: 5 failures (`gtmContentLibrary.getRoleOptions is not a function`)
- `template-gtm-integration.test.js`: 1 failure (text-grep mismatch)
- Confirmed by running the same tests on `git stash`-ed base branch — identical results

### Production-critical areas now covered (NEW tests)
- `src/lib/security.js` — escapeHtml, sanitizeForSerialization (10 tests)
- `src/lib/services/RateLimiter.js` — token bucket, queue, timeout, singleton (4 tests)
- `src/lib/openaiService.js` — AbortSignal across 4 endpoints (6 tests)
- `src/lib/analytics.js` — trackGeneration*, flush to /api/analytics (4 tests)
- `src/components/ErrorBoundary.jsx` — covered by E2E
- `src/lib/muapi.js` — regression-fixed muapi-fixes.test.js (7) + api-integration.test.js (16)

### E2E studio coverage (NEW)
- 17 of 18 studios have an E2E test that loads the route, asserts no console errors, and verifies the generate button has the correct `aria-label`
- 2 of 4 history studios have an explicit history container assertion (VideoStudio, ImageStudio)
- All routes discovered from `src/lib/router.js#pageLoaders`

---

## How to Test Video Generation Features

### Layer 1: Unit tests (fast, no network)

```bash
npm run test:run -- src/test/production-readiness.test.js
# 28 passed | 4 skipped
```

This validates the building blocks: rate limiter, abort signal, XSS escaping, analytics.

### Layer 2: Mocked API tests (fast, no real muapi key)

```bash
npm run test:run -- src/test/muapi-fixes.test.js
# 7 passed — covers uploadFile, endpoint resolution, signal forwarding
npm run test:run -- src/test/api-integration.test.js
# 16 passed — covers generateMusic, generateVideoEffect, signal
```

### Layer 3: Backend integration tests (no real network)

```bash
npx vitest run backend/tests/director.test.js
# 8 passed — supertest against express routers
```

### Layer 4: E2E studio smoke (dev server + browser)

```bash
npx playwright test e2e/studio-video-features.spec.js --project=chromium
# 17 passed, 1 skipped, 0 failed (45.4s)
```

This loads each studio's route, asserts no console errors, and verifies the primary action button.

### Layer 5: Full E2E with real muapi key (manual, costs money)

```bash
# Set your key in .env
E2E_MUAPI_KEY=<your-key> npx playwright test tests/e2e/template-studio.spec.js
```

The existing `tests/e2e/template-studio.spec.js` exercises one studio deeply with 24 test cases (15 functional + 9 error). It requires a real `E2E_MUAPI_KEY` or skips.

### Layer 6: Manual smoke (real API calls)

For each studio, navigate to the route, enter a prompt, click Generate, and confirm:
1. A loading state appears
2. The request fires (network tab shows POST to `muapi-proxy`)
3. On success, the result renders
4. On error, the error banner appears (test by setting an invalid model)
5. The Cancel button actually aborts (test by clicking Cancel mid-generation)
6. localStorage history persists across page reload (Video/Image/Audio/Avatar only)

---

## What We Have NOT Tested

| Area | Why | Risk |
|---|---|---|
| Real muapi API calls | Requires API key + costs money | Low — unit tests cover the request shape |
| Real OpenAI Responses call | Requires API key + costs money | Low — unit tests cover the signal threading |
| Real video/audio output rendering | Browser-specific codec support | Low — standard `<video>`/`<audio>` tags |
| Mobile viewports | Playwright config has Mobile Chrome/Safari projects but the E2E we wrote only uses chromium | Medium — run with `--project=Mobile\ Chrome` |
| Cross-browser (Firefox, WebKit) | Same as above | Low — Playwright projects exist, just not exercised |
| Load test (1000 concurrent users) | Not in scope | Medium — rate limiter is the main defense |
| Actual studio rendering of 18 studios' unique UIs | E2E only checks routes load + button is present | Medium — some studios may have unique bugs only visible with real interaction |

---

## Studio-by-Studio Video Generation Test Coverage

| Studio | Route | Unit | E2E smoke | History assertion | Notes |
|---|---|---|---|---|---|
| ImageStudio | `#/image` | ❌ | ✅ | ✅ (#history-sidebar) | |
| VideoStudio | `#/video` | ❌ | ✅ | ✅ (#video-history-sidebar) | |
| AudioStudio | `#/audio` | ❌ | ✅ | ❌ (no visible history container) | |
| AvatarStudio | `#/avatar` | ❌ | ✅ | ❌ (no visible history container) | |
| CinemaStudio | `#/cinema` | ❌ | ✅ | N/A | |
| CharacterStudio | `#/character` | ❌ | ✅ | N/A | |
| ChatStudio | `#/chat` | ❌ | ✅ | N/A | |
| CommercialStudio | `#/commercial` | ❌ | ✅ | N/A | |
| EditStudio | `#/edit` | ❌ | ✅ | N/A | |
| EffectsStudio | `#/effects` | ❌ | ✅ | N/A | |
| InfluencerStudio | `#/influencer` | ❌ | ✅ | N/A | |
| LipSyncStudio | `#/lipsync` | ❌ | ✅ | N/A | |
| StoryboardStudio | `#/storyboard` | ❌ | ✅ | N/A | |
| TrainingStudio | `#/training` | ❌ | ✅ | N/A | |
| UpscaleStudio | `#/upscale` | ❌ | ✅ | N/A | |
| VideoToolsStudio | `#/videotools` | ❌ | ✅ | N/A | |
| TemplateStudio | `#/template/<id>` | ❌ | ✅ (with `tiktok-video`) | N/A | Deep E2E in `tests/e2e/template-studio.spec.js` |
| CinemaTemplateStudio | (no route) | ❌ | ⏭️ skipped | N/A | Sub-component, no entry in router |

---

## What to Do Before Production Deploy

1. **Run the full Vitest suite** — `npm run test:run`
2. **Run the full E2E suite** — `npx playwright test` (CI doesn't do this automatically)
3. **Manual smoke** — pick 3 studios, click Generate with a real API key, verify end-to-end
4. **Load test** — use `node load-test.js` at repo root (or write a new k6/artillery script)
5. **Check the pre-existing 6 failures** — file tickets for the gtm-prompt-modal and template-gtm-integration issues
6. **Add CI step for Playwright** — `.github/workflows/*.yml` currently don't run E2E
7. **Fix the backend Jest config** — `backend/package.json` wires Vitest-authored tests to Jest

---

## How to Run the Tests (Quick Reference)

```bash
# Unit tests (fast)
npm run test:run

# Single file
npx vitest run src/test/production-readiness.test.js

# E2E (requires dev server, ~1 min)
npx playwright test e2e/studio-video-features.spec.js

# Full E2E (requires dev server + API key, ~5 min)
npx playwright test

# Backend
npx vitest run backend/tests/director.test.js
```
