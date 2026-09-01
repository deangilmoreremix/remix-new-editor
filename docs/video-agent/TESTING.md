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
  (opt-in; not in the default Playwright `testMatch`).

The OpenChatCut-derived studio also has its own verify suite under
`apps/video-agent-studio/scripts/run-affected-verifies.mjs`. It is
exercised through `npm run verify:video-agent-studio`.

## Running

```bash
# SmartVideo root unit tests (vitest)
npm test

# backend tests, including the Video Agent Studio 2 contract +
# regression tests
cd backend && npm test

# Video Agent Studio 2 verify suite (only when the subtree is
# installed)
npm run verify:video-agent-studio
```

## Contract tests (Studio 2)

The Jest suites assert that the SmartVideo-side adapter layer:

1. **Scoping** — every project / asset / job is owned by the
   authenticated user. Cross-user reads and writes are rejected.
2. **Validation** — uploads must be video/audio/image mime and
   under the configured size limit. Unsupported capabilities are
   rejected with 400.
3. **Credit lifecycle** — `reserve → finalise` is irreversible;
   `reserve → release` returns credits. Approval modes
   (`AUTO`/`BALANCED`/`MANUAL`) gate generation submission.
4. **Auth** — unauthenticated requests are rejected with 401.
5. **Cross-user data isolation** — a user cannot get the read URL
   for another user's asset.

## Regression tests (Studio 1 + Timeline Studio)

`timelineStudioRegression.test.js` asserts that the integration has
not:

* deleted or replaced `src/components/TimelineEditorPage.jsx`,
* replaced `src/lib/editor/timelineFeatureApi.js` (TimelineFeatureApi),
* changed the `timeline` route in `src/lib/router.js`,
* changed the `video-agent` route in `src/lib/router.js` (Studio 1
  still loads `VideoAgentPage.js`).

## E2E (Playwright)

`tests/e2e/video-agent-studio.spec.js` exercises the user-facing
route. Add it to `playwright.config.ts` `testMatch` to run it
through the cert gate.

The spec covers:

1. The Timeline Studio route still loads (regression).
2. The Video Agent Studio 2 route loads the new shell.
3. The shell shows an actionable splash when the OpenChatCut dev
   server is offline.

## Parity matrix

`docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md` defines
the rules by which a Studio 1 capability moves from `PARITY-PENDING`
to `PARITY` (i.e. fully migrated into Studio 2). Until parity is
proven, the Studio 1 endpoint MUST continue to work.

## Required scenarios (Phase 23)

These are the full user workflows the spec requires. They are
partially covered by the unit tests above; the full user-journey
Playwright run is a follow-up.

1. **Sign in → Video Agent Studio 2 → upload → place on timeline →
   AI split/trim → review proposal → approve → verify timeline
   changed → undo → verify restored.**
2. **Captions: ask for captions → generate → verify caption track →
   export → verify output.**
3. **Generation: generate image/video through SmartVideo adapter →
   verify completion → asset in media pool → asset inserted on
   timeline.**
4. **Timeline Studio still works** — same-screen / same-app
   verification that the Studio 1 and Timeline Studio state models
   are not mutated by Studio 2.
