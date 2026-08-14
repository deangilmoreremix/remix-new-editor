# Plan: Merge `PersonalizeModal.jsx` + `maigret-graph-modal.html` into One Personalization Tool

## Overview

Today there are **two separate personalization surfaces** that should be a single tool:

- **`PersonalizeModal.jsx`** — the *production* personalization modal. Launched from every studio via `personalizePopover.js`. Runs Maigret scan + GitHub lookup + website crawl + OpenAI enrichment, persists a `profile` to `localStorage` (`remix_contact_profiles`), and feeds video generation through `{{token}}` replacement in the host prompt textarea. **It has no graph.**
- **`public/maigret-graph-modal.html`** — a *standalone prototype* with the richer Maigret controls (recursion, permute, tags, keywords, proxy, AI analysis, content/tonality) **and** a force-directed connection graph (canvas) with hover/click, legend, zoom/pan, and multi-format downloads. **It is not wired into the app at all** and generates graph data *client-side* (no real backend scan).

The goal: make the graph + the richer Maigret controls a tab/section **inside** the production `PersonalizeModal`, so users get one tool — discover a contact, see the relationship graph, and apply personalization to video creation.

## Architecture Decisions

- **Keep the production modal as the shell.** `PersonalizeModal.jsx` is already integrated into EditStudio / CinemaStudio / CharacterStudio via `personalizePopover.js` and the `localStorage` profile contract that the generation code reads. We extend it rather than replace it.
- **Port the graph into a new framework-free module `src/components/modals/maigretGraph.js`** (matches the plan's C1 recommendation and the existing vanilla-class pattern of `PersonalizeModal.jsx`). This is the production home for the code currently in `maigret-graph-modal.html`.
- **Reuse the GTM design language** we just applied to `maigret-graph-modal.html` (`.gtm-prompt-modal` tokens, `.gtm-form`, `.form-section`, `.form-grid`, `.gtm-section`, `.gtm-meta-pill`, `.modal-btn`) so the merged modal looks identical to the rest of the app.
- **Graph data flows through the existing `localStorage` profile contract.** The studios read `remix_contact_profiles[id]`, so the `graph` object is added to the `profile` (and `scanResults`) so it survives end-to-end with zero changes to host generation code.
- **Two graph-data sources, one renderer.** (a) Real backend: extend the worker + `/api/personalizer/scan` to return `graph.nodes/edges` (the `plans/maigret-graph-web-interface.md` A1–A3 work). (b) Prototype fallback: reuse the client-side `generateScan()` simulator from `maigret-graph-modal.html` when no `graph` is returned, so the graph always renders. This de-risks the merge — the UI works immediately, the real-data path lands when the backend is ready.

## Data Contract (target)

`profile.scanResults.graph` (and `profile.graph` mirror) =
```
{ nodes: [{ id, label, type, url, platform, username, status }],  // types: seed|platform|alias|permutation|identity
  edges: [{ source, target, relation }] }                          // relations: claimed|alias_of|permutation_of|same_identity
```
This exactly matches the shape `generateScan()` already emits in `maigret-graph-modal.html`.

## Task List

### Phase 1 — Extract the graph renderer (foundation)
- [ ] Task 1: Create `src/components/modals/maigretGraph.js` — port `GraphView` (force-directed canvas) + GTM styles from `maigret-graph-modal.html`. Export `mountGraph(container, graphData)` and `setGraph(graphData)`; handle empty/resize. No new npm deps.
- [ ] Task 2: Extract `generateScan()` simulator into `src/lib/maigretSim.js` (shared by the prototype fallback) so both the standalone html and the modal can use identical demo data.

### Checkpoint: Foundation
- [ ] `maigretGraph.js` mounts into a test container and paints nodes/edges (headless puppeteer check); no console errors.

### Phase 2 — Add the graph + richer controls into PersonalizeModal
- [ ] Task 3: Add a "Connection Graph" tab/section to `PersonalizeModal.renderBody()` (GTM `.gtm-section` styling) that mounts `maigretGraph` after Discover. Falls back to flat list when `graph` absent.
- [ ] Task 4: Surface the richer Maigret controls (recursion, permute, tags, keywords, AI-analysis toggle, content/tonality selectors) in the Discover form using `.gtm-form` / `.form-grid` / `.checkbox-group`, mirroring `maigret-graph-modal.html`'s toolbar.
- [ ] Task 5: Persist `graph` + richer options into the `profile` and `scanResults` written to `localStorage` in `_handleDiscover` (so studios' generation code can read `profile.graph`).
- [ ] Task 6: Render the graph from real `scanData.graph` when present; otherwise call `generateScan()` simulator so the graph always shows. Add legend + zoom/pan + downloads (HTML/Neo4j/CSV/JSON) buttons (GTM `.modal-btn-secondary`).

### Checkpoint: Core Features
- [ ] Discover a contact → graph paints with seed/platform/alias/permutation nodes; clicking a node opens its URL; "Apply personalization" still token-replaces the prompt; `profile.graph` present in `localStorage`.

### Phase 3 — Backend graph (real data)
- [ ] Task 7: Worker (`scanner.py`) — emit `graph.nodes/edges` (recursion hints, permutations, same-identity) — plan A1.
- [ ] Task 8: `personalizer-api.js` `/scan` — include `graph` in `scanData` + persist to `profile_scan_results` — plan A2/A3.
- [ ] Task 9: `/export/:scanId` graph formats (HTML/Neo4j/CSV) — plan B.

### Checkpoint: Complete
- [ ] Real Maigret scan returns `graph`; modal renders it; downloads work; standalone `maigret-graph-modal.html` kept only as a visual reference (or deleted once parity is confirmed).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backend graph work is large/untested | High | Phase 1–2 ship the UI with the client-side simulator fallback; backend is Phase 3 and independently verifiable |
| Bundle size growth from embedding graph renderer | Med | Vanilla canvas module, no new dep (C1); lazy-loaded like `PersonalizeModal` already is |
| `profile` shape change breaks generation code | Med | Additive only — `graph` is a new key; existing `variables`/token flow untouched |
| Duplicate graph code (html + js) drifts | Low | Extract `generateScan` to `src/lib/maigretSim.js`; html imports or mirrors it |

## Open Questions
- Should the graph tab be default-visible or behind a toggle? (Recommend: auto-show when `graph` exists.)
- Keep `public/maigret-graph-modal.html` as a standalone demo after merge, or retire it?
- Do we want graph-derived facts (e.g. detected aliases) to become new `{{tokens}}` for video gen, or stay visualization-only for v1?
