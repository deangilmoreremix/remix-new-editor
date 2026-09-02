# Video Agent Studio 2 — Testing

## Test layout

Tests added for the Video Agent Studio 2 integration live under:

* `backend/__tests__/video-agent-studio/` — Jest suites
  * `projectRepository.test.js`
  * `mediaStore.test.js`
  * `generationAndCredits.test.js`
  * `router.test.js`
  * `timelineStudioRegression.test.js`
* `tests/e2e/video-agent-studio.spec.js` — Playwright spec
  (Studio 1 + Studio 2 + Timeline Studio + OpenMontage regression).
* `scripts/verify-video-agent-studio.mjs` — full integration
  verification (subtree, build, dev server, route, iframe URL,
  shell).

The OpenChatCut-derived studio also has its own verify + test
suite under `apps/video-agent-studio/scripts/` and is exercised
through `npm run test:video-agent-studio` /
`npm run verify:video-agent-studio` (the latter runs the
SmartVideo-side verification, not the OpenChatCut-side verify
suite).

## Running

```bash
# SmartVideo root unit tests (vitest)
npm test

# SmartVideo backend tests, including the Studio 2 contract +
# regression tests
cd backend && npm test

# OpenChatCut subtree tests (uses the subtree's own runner)
npm run test:video-agent-studio

# Full Studio 2 integration verification
npm run verify:video-agent-studio

# Optional: also start the OpenChatCut dev server and probe it
npm run verify:video-agent-studio -- --with-server
```

## Contract tests (Studio 2 — historical)

The Jest suites in `backend/__tests__/video-agent-studio/` were
created during an earlier integration attempt that tried to
expose Studio 2 through a SmartVideo-side adapter layer. That
adapter layer is now documented as out-of-scope (see
`backend/services/video-agent-studio/README.md` and
`backend/routes/video-agent-studio/README.md`). The 32 contract
tests still pass against the in-memory adapters and are kept as
historical reference, but they do not exercise the iframe path.

## Regression tests (Studio 1 + Timeline Studio)

`timelineStudioRegression.test.js` asserts that the integration has
not:

* deleted or replaced `src/components/TimelineEditorPage.jsx`,
* replaced `src/lib/editor/timelineFeatureApi.js` (TimelineFeatureApi),
* changed the `timeline` route in `src/lib/router.js`,
* changed the `video-agent` route in `src/lib/router.js` (Studio 1
  still loads `VideoAgentPage.js`),
* removed the new `video-agent-studio` route or its shell.

## E2E (Playwright)

`tests/e2e/video-agent-studio.spec.js` exercises the user-facing
routes. The spec is registered in `playwright.config.ts`
`testMatch`. It covers:

1. Timeline Studio route still loads.
2. Original `video-agent` route (Studio 1) still loads.
3. `video-agent-studio` (Studio 2) shell renders the SmartVideo
   chrome with Retry button.
4. The OpenMontage page module remains loadable from the
   component layer (regression check).

## Full application verification (the directive's required scenarios)

The directive requires the verification to prove that a user can
open SmartVideo, select Studio 2, see the complete OpenChatCut
application, reach the project dashboard, create a project, open
the editor, import media, add media to the timeline, open the
AI-agent panel, access captions / effects / transitions / motion
graphics, save the project, start an export, leave the route,
open Studio 1, open Timeline Studio, and return to Studio 2.

This kind of verification is performed by:

* The OpenChatCut subtree's own verify suite
  (`apps/video-agent-studio/scripts/run-affected-verifies.mjs`),
  which is the canonical verification of the complete OpenChatCut
  application.
* The Studio 2 Playwright e2e (above) for the user-facing
  route / chrome / navigation / regression checks.
* The `scripts/verify-video-agent-studio.mjs` script for the
  wiring (subtree, build, dev server, route, iframe URL, shell).

To run the **complete** Studio 2 application end-to-end:

```bash
# Terminal 1
npm run install:video-agent-studio
npm run dev:video-agent-studio

# Terminal 2
npm run dev
# then open http://127.0.0.1:3100/#/video-agent-studio
```

## Required scenarios (Phase 23)

Per the original Phase 23 spec, the four full user journeys are:

1. **Sign in → Video Agent Studio 2 → upload → place on timeline
   → AI split/trim → review proposal → approve → verify timeline
   changed → undo → verify restored.**
2. **Captions: ask for captions → generate → verify caption
   track → export → verify output.**
3. **Generation: generate image/video through OpenChatCut's
   own generation pipeline → verify completion → asset in media
   pool → asset inserted on timeline.**
4. **Timeline Studio still works** — same-screen / same-app
   verification that the Studio 1 and Timeline Studio state
   models are not mutated by Studio 2.

The first three are *OpenChatCut* scenarios. They are verified by
the OpenChatCut subtree's own verify suite, not by SmartVideo-side
tests. The fourth is verified by the Playwright e2e and the
backend regression test.
