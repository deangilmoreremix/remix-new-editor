# Merge: PersonalizeModal + maigretGraph (Connection Graph)

Plan: `tasks/plan.md`. Branch: `cleanup/remove-orphans`. Worktree: `coral-cemetery`.

## Status
- [x] T1: `src/components/modals/maigretGraph.js` — force-directed canvas graph renderer (seed/platform/alias/permutation/identity nodes; claimed/alias_of/permutation_of/same_identity edges); zoom/pan/relayout; legend; `downloadGraph` (JSON/CSV/Neo4j/HTML).
- [x] T2: `src/lib/maigretSim.js` — `generateScan()` + `ensureGraph()` client-side scanner simulator (shared fallback).
- [x] T3: PersonalizeModal "Connection graph" section mounts `maigretGraph` after Discover.
- [x] T4: Richer Maigret controls in Discover form (scope/tags/keywords/proxy/recursion/permute/parsing/CF-bypass/AI).
- [x] T5: `graph` + `scanOptions` persisted into `profile` (and `scanResults`) in `localStorage`.
- [x] T6: Render from real `scanData.graph` when present; otherwise `ensureGraph()` simulator so graph always shows. Legend + zoom/pan + Download (JSON/CSV/Neo4j/HTML) wired.
- [x] BUG FIX: added missing `MaigretGraph.zoom()` method (PersonalizeModal called `this._graph.zoom()` which did not exist).
- [x] VERIFY: jsdom+canvas render test passes (13 checks) — graph paints, zoom works, downloads serialize. Vitest modal-integration test: 21/21 pass. Vite transforms clean.
- [ ] Phase 3 (backend real graph) — DEFERRED: `services/maigret-worker/app/scanner.py` does not yet emit `graph.nodes/edges`; `/api/personalizer/scan` returns no `graph`. UI works via simulator fallback (by design). `personalizer-api.js` `/export/:scanId` exists (JSON/CSV/MD/HTML; no Neo4j).

## Verification
- `node test-graph-render.mjs` → ALL CHECKS PASSED
- `npx vitest run src/components/modals/modal-integration-test.test.js` → 21 passed, 10 skipped
- Vite dev server transforms PersonalizeModal.jsx + maigretGraph.js (HTTP 200), no error.

## Open
- Phase 3 backend graph emission (scanner.py Task 7) is independently verifiable later; UI is complete with fallback.
- `public/maigret-graph-modal.html` retained as visual reference.
