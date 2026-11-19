# Fix N report (Stage 11): crash recovery covers more than timelines and assets

Gap: the Port J snapshot held timelines, the active timeline and assets only. A crash lost overlays, the Spaces graph, the Director show and so on.

## What the saved project contains (from `persistWorkspace` in `workspace-shell.tsx`)
nodes, edges, spaces (each with nodes/edges), activeSpaceId, openSpaceIds, assets, mediaFolders, timelines, activeTimelineId, exports, director, providerUsage, sets, overlays. The elements library is saved separately.

## Now covered (snapshot v2)
| Slice | Snapshot | Recover (ordinary actions via `wrappedDispatch`) |
|---|---|---|
| timelines, active timeline, assets | as before | `SET_TIMELINE`, `ADD_TIMELINE`, `SET_ACTIVE_TIMELINE`, `ADD_ASSET`, `UPDATE_ASSET` |
| overlays | by id | `ADD_OVERLAY`, `UPDATE_OVERLAY` |
| Spaces graph: every space with nodes, edges, node config and node results, active + open spaces | the live canvas is merged into the active space exactly as the save does; `selected`/`dragging` stripped | `ADD_SPACE`, `SET_ACTIVE_SPACE` + `RENAME_SPACE`, `SET_NODES`, `SET_EDGES`, `OPEN_SPACE`, final `SET_ACTIVE_SPACE` |
| media folders | by id | `ADD_FOLDER`, `UPDATE_FOLDER` |
| sets | by id | `ADD_SET`, `UPDATE_SET` |
| Director show | whole object | `SET_DIRECTOR` |

All of these actions are in `WORKSPACE_PERSIST_ACTIONS` and are undoable, so the normal debounced save then persists the recovered state (the unit test asserts this for every emitted action type; the browser run shows it in the real store).

## Design
- `RECOVERY_VERSION` 2. `parseSnapshot` accepts v1 and v2 (v2 is validated more strictly). A v1 snapshot is compared with `coreFingerprint` (timelines/assets only), so a new-slice difference can never cause a prompt for it; it recovers timelines/assets as before. Newer versions and newer project schemas are still rejected.
- Comparison: `fingerprintFor(snap, current)` is key-order independent (`stableStringify`), list order of id collections does not matter, session-only values are normalised. A project with no changes in any slice makes no prompt and no plan (unit tests plus the real run: "no prompt after a normal save + reload").
- Size safety: the store is IndexedDB (`cinegen-recovery`), written off the save path and never awaited by it. `write()` never throws; if the full v2 snapshot exceeds `RECOVERY_MAX_BYTES` (24 MB) or the store rejects it (quota), it retries with the small v1 core snapshot; if that fails too nothing is stored. Heavy payloads: any `data:` string over 4096 chars is replaced by a marker, and in the non-asset slices `blob:` URLs too (a dead blob URL is worse than none). On recovery the live value at the same path (nodes matched by id) is put back, otherwise the key is dropped. Assets keep today's behaviour (blob URL kept, still ignored for comparison), only big data URLs are elided.
- Wiring in `workspace-shell.tsx` is small: one memoised `recoverySliceFromState(state)` passed to the hook and used for `markSaved`. The recover action list lives in the pure `recoveryActions()`.
- The prompt text now also mentions overlay and graph-node counts when present.

## Tests
- `src/cinegen/__tests__/stage11/crash-recovery.test.ts`: 14 tests (6 old, 8 new): v2 round trip, no plan for an unchanged project (key/list order, selection flags), plan for overlay / node / edge / space rename / new space / director / set / folder edits, `resolveSpaces`, heavy data/blob payloads (size bound, live value restored, marker never written back), v1 snapshots (recover core, never prompt on new slices), size fallback to v1 and quota/dead-store behaviour, malformed v2 rejection, and a round trip through the real `workspaceReducer` (edit overlay, nodes, edge, director; snapshot; recover from the saved state; fingerprint equals the snapshot; all action types are persist actions).
- `npx vitest run src/cinegen`: 236 files passed, 3 skipped; 1854 tests passed.
- eslint on the changed files: 0 errors (only pre-existing style warnings).

## Real browser (headless Chromium 1243, Vite dev server)
- `docs/stage-11/smoke/recovery-full-smoke.cjs`, log `docs/stage-11/results/recovery-full-smoke.log`, ALL PASS. Real UI edits: add a text overlay from the Library panel (saved normally); then, with project writes forced to fail (same technique as `recovery-smoke.cjs`): a second overlay, two canvas nodes (the canvas' own add-node event), a prompt typed into a node, a real mouse drag connecting them, and a Director film reference typed in the look-bible field. A v2 snapshot exists (2 overlays, 2 nodes) while the saved project still has the old state; the page is closed without a clean unload; reopen shows "Recover unsaved changes? ... 2 overlays, 2 graph nodes"; before Recover the canvas shows 0 nodes; after Recover the 2 nodes, the prompt text, the edge and the Director film are back; the project store then holds 2 overlays, 2 nodes, 1 edge, the prompt and the film; snapshot gone; reload shows no prompt. Discard path: another unsaved overlay + node + director edit, kill, reopen, Discard: saved project unchanged, discarded director edit not shown, snapshot gone.
- The original `recovery-smoke.cjs` (timeline ramp edit) was re-run on the new code: ALL PASS.
- Not covered by the browser run: node results and heavy-payload elision (unit tests only), set / media-folder recovery (unit and reducer tests only), the "closed page" is not an OS-level kill of the browser.

## NOT covered, and why
- Elements library (elements, element folders): saved by its own debounced writer to a separate store, not by the project save and not flagged by `markWorkspaceSavePending`; the snapshot cannot sit "while a save is pending" for it. A crash inside its 300 ms window can still lose an element edit.
- Exports (`exports`): job state with output file paths and progress; stale after a crash by nature, not user-authored work.
- `providerUsage`: observed provider balances (telemetry), re-observed on the next run.
- Deletions of id-keyed items (timelines, assets, overlays, folders, sets, spaces) are not replayed: recovery never deletes from the loaded project (same rule as Port J). A removal made just before the crash comes back after Recover. Node and edge deletions on a space that exists are replayed (the graph is replaced as a whole per space).
- Heavy media: a node result that exists only as a big `data:` URL (or a blob URL) in the lost session cannot be recovered (the snapshot deliberately does not hold it); the node comes back without that value. Recovered assets that were never saved still keep their old `blob:` URL (Port J limit unchanged).
- Node edits that fire `SET_NODES` on every drag tick write a snapshot at most once per 150 ms debounce; a very large graph costs a JSON copy per write (not measured; the size guard and the fallback bound the damage).
- Node running state / `SET_NODE_RUNNING` is not persisted by the project either, so it is not recovered.
