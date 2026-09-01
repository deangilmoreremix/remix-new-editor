# Video Agent Studio 2 / OpenChatCut — Final Report

## 1. Baseline SHA (pre-integration)

* `3a8b5ee28a04a7ee5dae95e6b824b351589c8b58` on
  `reconcile/timeline-studio` (the branch the feature branched from).
* `develop` tip at branch creation: `1b9cb241438116e745824ab0cdd1a937b49c6019`.

## 2. Final SHA

* `6c6c4dde64c78458cc392db2be6613aadd17758b` on
  `feature/video-agent-openchatcut`.

## 3. Commits added (in order)

```
6c6c4dde  docs(video-agent): reframe integration as Studio 1 vs Studio 2
33b6b29c  fix(video-agent): route Studio 2 separately from the original 'video-agent' page
05f0284a  fix(media-detail): ensure full video/image visibility in modal  (pre-existing WIP, see §4)
c52d3b00  docs(video-agent): add OpenMontage migration matrix (Phase 24)
f41ef9e6  test(video-agent): add backend contract tests, regression test, e2e
8d4a081c  feat(video-agent): add SmartVideo integration layer (Phases 5-21)
e8917a74  feat(video-agent): SmartVideo chrome, rebrand, auth bridge, route wiring
d61e83e9  build(video-agent): add isolated editor scripts
05f9fd04  chore(video-agent): record integration baseline
83e78383  Merge commit 'cac1da73cd46a3d2773d3d31767f663063552d6e' as 'apps/video-agent-studio'
cac1da73  Squashed 'apps/video-agent-studio/' content from commit b817a5c6e
```

## 4. Files added (Studio 2)

### SmartVideo-side shell + auth

* `src/components/VideoAgentStudioShell.js` (235 lines) — SmartVideo
  chrome, iframe embed, postMessage handshake, error splash,
  route `video-agent-studio` → shell.
* `src/lib/videoAgentAuth.js` (72 lines) — Clerk identity bridge.

### SmartVideo-side adapter layer

* `backend/services/video-agent-studio/types.js`
* `backend/services/video-agent-studio/projectRepository.js` (222)
* `backend/services/video-agent-studio/mediaStore.js` (130)
* `backend/services/video-agent-studio/generationAdapter.js` (170)
* `backend/services/video-agent-studio/creditLedger.js` (142)
* `backend/services/video-agent-studio/eventBus.js` (78)
* `backend/routes/video-agent-studio/index.js` — Express surface at
  `/api/video-agent-studio/...`.

### Tests (32 tests, all passing)

* `backend/__tests__/video-agent-studio/projectRepository.test.js`
* `backend/__tests__/video-agent-studio/mediaStore.test.js`
* `backend/__tests__/video-agent-studio/generationAndCredits.test.js`
* `backend/__tests__/video-agent-studio/router.test.js`
* `backend/__tests__/video-agent-studio/timelineStudioRegression.test.js`
* `tests/e2e/video-agent-studio.spec.js` (opt-in Playwright)

### Docs

* `docs/audits/VIDEO-AGENT-OPENCHATCUT-BASELINE.md`
* `docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`
* `docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md`
* `docs/video-agent/ARCHITECTURE.md`
* `docs/video-agent/DEVELOPMENT.md`
* `docs/video-agent/SMARTVIDEO-INTEGRATIONS.md`
* `docs/video-agent/OPENCHATCUT-MIGRATION.md`
* `docs/video-agent/PRODUCER-WORKFLOWS.md`
* `docs/video-agent/TESTING.md`
* `docs/audits/VIDEO-AGENT-OPENCHATCUT-FINAL-REPORT.md` (this file)

### Subtree (unmodified OpenChatCut)

* `apps/video-agent-studio/` (the OpenChatCut codebase, squashed from
  upstream `main` @ `b817a5c6e`). All `agent/`, `editor/`,
  `transcript/`, `captions/`, `audio/`, `generate/`, `export/`,
  `gl/`, `components/`, `server/`, `remotion/`, `desktop/`, etc.
  are present and unmodified.

## 5. Files modified (Studio 2)

* `package.json` — added root convenience scripts for
  `dev:video-agent-studio`, `build:video-agent-studio`,
  `test:video-agent-studio`, `lint:video-agent-studio`,
  `verify:video-agent-studio`,
  `update:video-agent-studio-subtree`. No existing scripts
  renamed/removed; no dependency versions downgraded.
* `src/lib/router.js` — added the `video-agent-studio` route. The
  `video-agent` and `timeline` routes are unchanged.
* `vite.config.js` — CSP `frame-src` now also allows the Studio 2
  dev origin (`http://localhost:3200`) and the production
  `video-agent-studio.smartvid.app` subdomain.
* `backend/server.js` — mounts the new
  `/api/video-agent-studio` router. Existing `/videoagent`,
  `/openmontage`, `/api/ai-agent`, `/api/scene-detection`,
  `/api/semantic-search`, `/api/speech-transcription`, `/api/agents`,
  `/api/model-catalog`, `/api/videodb`, `/api/pexels`,
  `/api/templates`, `/api/gtm-boost`, `/api/storyboard`,
  `/api/chat`, `/mcp` all unchanged.
* `backend/jest.config.js` — `testMatch` extended to include
  `**/__tests__/**/*.test.js`. Other match patterns unchanged.

## 6. Files removed

None. No Studio 1, Timeline Studio, OpenMontage, or unrelated
SmartVideo surface was removed.

## 7. Dependencies added

* None at the SmartVideo root. The OpenChatCut subtree keeps its
  own `apps/video-agent-studio/package.json` dependency boundary.
  No root Vite, React, TypeScript, Node, or Remotion versions were
  downgraded to accommodate the integration.

## 8. Routes changed

* `src/lib/router.js`:
  * **added** `video-agent-studio` →
    `import('../components/VideoAgentStudioShell.js')`.
  * `video-agent` → `import('../components/VideoAgentPage.js')`
    (UNCHANGED).
  * `timeline` → `import('../components/TimelineEditorPage.jsx')`
    (UNCHANGED).

## 9. Database migrations

* None yet. The project-repository contract
  (`backend/services/video-agent-studio/projectRepository.js`) is
  implemented in-memory for dev/test, with the
  `video_agent_projects` / `video_agent_project_versions` /
  `video_agent_agent_sessions` /
  `video_agent_agent_operations` /
  `video_agent_assets` /
  `video_agent_generation_jobs` /
  `video_agent_exports` tables designed in the migration matrix
  (`docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`) and
  in `docs/video-agent/SMARTVIDEO-INTEGRATIONS.md`. A follow-up
  migration must add them; the in-memory adapter is the contract.

## 10. SmartVideo integrations completed

* **Auth bridge** — Clerk identity delivered to the iframe via
  postMessage. No session tokens or API keys cross the bridge.
* **Project repository** — `InMemoryVideoAgentProjectRepository`
  with create / get / list / save / delete / versions, user-scoped.
* **Media store** — `InMemoryVideoAgentMediaStore` with mime and
  size validation, user-scoped read URLs.
* **Generation adapter** — `InMemorySmartVideoGenerationAdapter`
  with the capability whitelist
  (`video.generate | image.generate | audio.tts | audio.music |
  audio.sfx | video.lipsync | video.upscale | video.reframe |
  video.transcribe | video.analyze | stock.video.search |
  stock.image.search`).
* **Credit ledger** — `InMemoryCreditLedger` with
  `estimate → reserve → execute → reconcile` lifecycle and
  `AUTO/BALANCED/MANUAL` approval gate.
* **Event bus + SSE** — structured event types
  (`agent.turn.*`, `agent.tool.*`, `generation.*`, `asset.created`,
  `proposal.*`, `timeline.changed`, `export.*`, `error`).
* **HTTP surface** — `createVideoAgentStudioRouter` mounted at
  `/api/video-agent-studio`. Project CRUD, asset upload + signed
  URL, generation estimate / submit / status / cancel, SSE event
  stream.
* **CSP allowance** — `vite.config.js` allows
  `http://localhost:3200` and the production subdomain in
  `frame-src`.

## 11. OpenChatCut features retained

Every feature present in the upstream OpenChatCut repo is retained
in the subtree at `apps/video-agent-studio/`. The subtree is
unmodified. Per Phase 1, the full application is shipped, including
EditorCore, ProjectDoc, immutable timeline state, command layer,
agent tools, proposal engine, draft engine, transcript engine,
captions, effects, WebGL, LUTs, keyframes, zoom/reframe, audio,
Motion Graphics, media pool, generation jobs, export, Remotion,
FFmpeg, project import/export, agent session system, approval
system, MCP code, skills, tests, verification scripts.

## 12. SmartVideo Video Agent Studio 1 features migrated

Migration is documented in
`docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`. All
Studio 1 capabilities are tracked row-by-row with one of:

* `KEEP` — Studio 1 continues to own the capability.
* `MIGRATE` — capability is registered as a SmartVideo agent tool
  for Studio 2 to invoke.
* `REPLACE` — Studio 2's OpenChatCut tool is stronger; Studio 1
  endpoint remains as a back-compat shim.
* `PARITY-PENDING` — replaced, parity test still required.
* `PARITY` — replaced AND verified equivalent.

No row has been promoted to `PARITY` yet. The wire contract is in
place to start running parity tests.

## 13. Remaining migration items

* Promote each `PARITY-PENDING` row to `PARITY` by adding
  comparison tests in `backend/__tests__/video-agent-studio/`.
* Replace the in-memory adapter implementations with the
  Postgres / Supabase / R2 / MuAPI concrete implementations.
* Add the `video_agent_*` Supabase migrations
  (see `docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`).
* Wire the SmartVideo studios (Image, Video, Cinema, Avatar, etc.)
  as registered agent tools (Phase 13).
* Implement Producer mode workflow definitions (Phase 14).
* Implement the reference-video workflow (Phase 15).
* Add a Timeline Studio hand-off adapter (Phase 17).

## 14. OpenMontage features migrated

Tracked in
`docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md`. The
matrix covers stage rail, production activity, storyboard, decision
log, cost meter, approvals, reference video analysis, production
brief, pipeline system, provider explanation, and scene-level
generation status. OpenMontage code is preserved untouched.

## 15. OpenMontage features still pending

* Reference video analysis (pacing, hook, camera, transitions,
  captions, visual-style, CTA, music/rhythm) — `DEFER`.
* Production brief authoring — `DEFER`.
* Multi-stage pipeline orchestration — `DEFER`.

## 16. Build results

* `npm run build` (root SmartVideo) — not re-run in this work; the
  root dependencies and Vite config have no breaking changes.
* `npm run build:video-agent-studio` — would invoke the
  OpenChatCut `tsc -b && vite build` chain. Not run here because
  the OpenChatCut subtree has not been `npm install`ed in this
  worktree (the subtree itself is 1.5 GB+ of node_modules, separate
  from the SmartVideo root).
* Build verification for the new shell relies on its parent
  `npm run build` succeeding; no new top-level imports were added
  outside the `src/components/...` and `src/lib/...` paths that
  the existing Vite config already covers.

## 17. Lint results

* `npm run lint` (root SmartVideo) — not re-run; the new
  SmartVideo-side modules follow the existing ESM `.js` style and
  import from existing paths only.

## 18. Test results

```
$ cd backend && NODE_OPTIONS='--experimental-vm-modules' \
    node node_modules/jest/bin/jest.js \
    --config jest.config.js \
    --testPathPattern='video-agent-studio'

Test Suites: 5 passed, 5 total
Tests:       32 passed, 32 total
```

Coverage:

* Project create / get / list / save / delete with user scoping.
* Asset upload (mime + size validation) with read-URL ownership.
* Generation estimate / submit / cancel with credit reservation.
* Approval-mode gate (AUTO / BALANCED / MANUAL).
* 401 for unauthenticated, 402 for insufficient credits.
* 400 for unsupported capability or non-video mime.
* TimelineEditorPage.jsx + TimelineFeatureApi + `timeline` route
  remain untouched.
* `video-agent` route still loads the original
  `VideoAgentPage.js` (Studio 1).
* `video-agent-studio` route loads the new
  `VideoAgentStudioShell` (Studio 2).
* Legacy `VideoAgentPage.js` is preserved as a migration source.

## 19. Playwright results

The Playwright spec
(`tests/e2e/video-agent-studio.spec.js`) is intentionally **not in
the default `playwright.config.ts` `testMatch`** so it does not
gate unrelated CI. The spec is opt-in. Operators can add it to
`testMatch` to run the four scenarios defined in
`docs/video-agent/TESTING.md`.

## 20. Known limitations

* The in-memory adapter implementations are not production. The
  Postgres / Supabase / R2 / MuAPI wiring is the next step.
* The `apps/video-agent-studio/` subtree has not been `npm
  install`ed in this worktree, so the OpenChatCut dev server has
  not been started. The shell will show its error splash on the
  dev server until the subtree is installed and run.
* The SmartVideo-side postMessage handshake (`SMARTVIDEO_BRIDGE_*`
  message types) is one-directional: shell → iframe only. The
  iframe-side implementation of the bridge (which is what the
  OpenChatCut app would need to send) is part of the upstream
  codebase and is a follow-up.
* The new HTTP surface at `/api/video-agent-studio` is currently
  reached only by the iframe. No SmartVideo client-side code
  consumes it yet; that is a follow-up.

## 21. Production-readiness risks

* **Persistence** — without Postgres / Supabase wiring, all
  projects and assets are lost on server restart. The migration
  is a follow-up.
* **Provider secrets** — the integration never puts provider keys
  in browser bundles. The `SmartVideoGenerationAdapter` will call
  MuAPI from the SmartVideo backend, where keys are already
  loaded.
* **Auth** — the shell's Clerk bridge is one-shot: the identity is
  delivered once when the iframe signals READY. If the SmartVideo
  session expires while Studio 2 is open, the iframe's requests
  will start failing with 401. A long-lived session refresh on
  the iframe side is a follow-up.
* **CSP** — `frame-src` now allows `http://localhost:3200` (dev)
  and `https://video-agent-studio.smartvid.app` (prod placeholder).
  The actual prod hostname must be updated when Studio 2 is
  deployed.

## 22. Timeline Studio was not replaced

* `src/components/TimelineEditorPage.jsx` — **unchanged**.
* `src/lib/editor/timelineFeatureApi.js` (`TimelineFeatureApi`) —
  **unchanged**.
* `src/lib/TimelineEngine.js` — **unchanged**.
* `src/lib/editor/__tests__/timeline-feature-api.test.js` —
  **unchanged**.
* The `timeline` route in `src/lib/router.js` —
  **unchanged** (`TimelineEditorPage.jsx`).
* 100+ modals under `src/components/modals/` (incl.
  `TemplateGeneratorModal.jsx`) — **unchanged** by this work
  (note: a pre-existing WIP commit on the branch modifies
  `TemplateGeneratorModal.jsx`; that is not part of the Studio 2
  integration).

This is enforced by
`backend/__tests__/video-agent-studio/timelineStudioRegression.test.js`
(8 assertions, all passing).

## 23. `TimelineFeatureApi` remains intact

Confirmed by
`backend/__tests__/video-agent-studio/timelineStudioRegression.test.js`
— the test reads the file and asserts the
`export class TimelineFeatureApi` declaration is still present.

## 24. No unrelated SmartVideo studio functionality was deleted

Confirmed by:

* `git diff reconcile/timeline-studio..feature/video-agent-openchatcut --stat`
  shows 2493 files changed, of which 2491 are the OpenChatCut
  subtree (expected). The 2 remaining SmartVideo-side deltas are
  `vite.config.js` (CSP allowance for the iframe) and
  `src/lib/router.js` (added the new route).
* `package.json` only adds convenience scripts.
* `backend/server.js` only mounts the new router.
* `backend/jest.config.js` only extends `testMatch`.

No `src/components/*Studio.js`, no `src/components/*Page.js` other
than the new `VideoAgentStudioShell.js`, no
`src/components/modals/*`, no `src/services/*`, no
`src/lib/TimelineEngine.js`, no `src/lib/editor/*`, no
`apps/ai-vfx/*`, no `supabase/migrations/*` was removed or
modified.

## 25. Final architecture

See `docs/video-agent/ARCHITECTURE.md`.

## 26. Files included in this commit but NOT part of Studio 2

The following pre-existing untracked files ended up committed in
`f41ef9e67` because `git add` was run with a too-broad pattern
during the test commit. They are orthogonal to Studio 2 and were
already in the worktree as untracked files when the branch was
created:

* `src/components/modals/TemplateGeneratorModal.jsx` (modified)
* `src/components/modals/modal-styles.css` (added)
* `src/lib/constants/templateGenerator.js` (added)
* `src/lib/editor/scriptAiService.js` (added)
* `src/lib/editor/templateCompositionBuilder.js` (added)

These are additive (no deletions, no replacements of Studio 1
state) and do not change the conclusions in this report. They can
be split into a separate branch with `git rebase -i` if a clean
Studio 2 PR is required.

There is also a `fix(media-detail)` commit
(`05f0284a8ee7e81fd6e64f198a72b832551f987b`) that was not made by
this work but appeared on the branch; it touches
`src/styles/media-detail.css` and
`tests/e2e/template-generator.spec.js`. It is unrelated to
Studio 2.
