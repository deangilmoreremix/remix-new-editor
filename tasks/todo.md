# TODO: Merge PersonalizeModal + maigretGraph (Connection Graph) — STATUS

Branch: `cleanup/remove-orphans` (worktree `coral-cemetery`). Plan: `tasks/plan.md`.

## Phase 1–2 (UI, done)
- [x] T1 `maigretGraph.js` — force-directed canvas renderer + zoom/pan/relayout + legend + `downloadGraph` (JSON/CSV/Neo4j/HTML).
- [x] T2 `maigretSim.js` — `generateScan()` + `ensureGraph()` client fallback.
- [x] T3 PersonalizeModal "Connection graph" section mounts `maigretGraph` after Discover.
- [x] T4 Richer Maigret controls (scope/tags/keywords/proxy/recursion/permute/parsing/CF/AI).
- [x] T5 `graph` + `scanOptions` persisted to `localStorage` profile.
- [x] T6 Render real `scanData.graph` or simulator fallback; legend + zoom/pan + Download wired.
- [x] BUG FIX: added missing `MaigretGraph.zoom()`.

## Phase 3 (backend real graph, DONE)
- [x] T7 `scanner.py` `build_graph()` derives `graph` from real `platforms` (seed→claimed, alias_of, same_identity). Added to `ScanResult`.
- [x] `main.py` `ScanResponse` includes `graph`; `/scan` returns it.
- [x] T8 `personalizer-api.js` `/scan` passes worker `scanData` (incl. `graph`) to modal.
- [x] T9 `/export/:scanId` supports JSON/CSV/MD/HTML; client `downloadGraph` adds Neo4j.
- [x] `render.yaml` blueprint now also deploys `maigret-worker` (docker, oregon).

## Verification (all green)
- `test-graph-render.mjs` → ALL CHECKS PASSED (13)
- `test-personalize-functional.mjs` → ALL FUNCTIONAL CHECKS PASSED (20)
- `test-personalize-trigger.mjs` → ALL TRIGGER CHECKS PASSED (4) — studio mount path
- `modal-integration-test` (vitest) → 21 passed, 10 skipped
- `pytest tests/test_scanner.py` → 5 passed, 1 skipped
- Live worker: `GET /health` ok; `POST /scan` returns `graph`; no-key → 401
- `ensureGraph(realScan)` keeps worker graph (simulator only when absent)

## Open (deploy-side, not code)
- Set `MAIGRET_WORKER_URL` + `MAIGRET_WORKER_SECRET` in Netlify dashboard (from the Render maigret-worker service) so production Discover uses real graph data.
- `public/maigret-graph-modal.html` retained as visual reference.
