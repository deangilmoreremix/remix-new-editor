# CineGen → Timeline Studio Editor (`#/timeline`) parity matrix

Upstream: christopherjohnogden/CineGen @ `769f148` (MIT). Target: `src/cinegen`, mounted by `src/cinegen/mount.tsx` at `#/timeline`. The classic editor (`#/timeline-classic`) is untouched.
Generated from `scripts/cinegen-parity.mjs` → `docs/evidence/cinegen-parity.json` (alias-normalised per-file diff).

## File-level result
| Status | Files |
|---|---|
| Identical to upstream (after `@/`→`@cinegen/`) | 265 |
| Adapted at a host boundary (`// [remix]` marked) | 114 |
| Absent by design (desktop/cloud only) | 5 — `main.tsx`, `App.tsx`, `cloud-account.tsx`, `claude-mcp-connect.tsx`, `remote-mcp-connect.tsx` |
| Total upstream renderer files | 384 (362 reachable from the active import graph) |

## Feature matrix
Legend — **Code**: present and reachable. **Browser**: exercised in the real app. **Blocked**: needs provider keys (MuAPI/OpenAI) that the sandbox does not have.

| Area | Feature | Code | Browser-verified | Notes |
|---|---|---|---|---|
| Shell | Project Manager, tabs, undo/redo, autosave, IndexedDB ProjectStore | yes | yes | create/import/persist/reload |
| Elements | 4 categories, create modal, reference upload, Add to production, persistence | yes | yes | create → save → reload keeps card + image (this run) |
| Elements | @mentions, per-panel regeneration, angle generation | yes | no | generation Blocked: needs keys |
| Spaces | command palette, add nodes, type-checked connections, persistence | yes | yes | File Upload → Asset Output connected; reload keeps 2 nodes + 1 edge. Text→image port correctly refused |
| Spaces | model nodes (787 MuAPI models), Storyboarder, SAM3 | yes | no | Blocked: needs keys |
| Spaces | Shot Board | yes | code only | 9 camera-angle cells, identical to upstream; generation Blocked |
| Sets / Studio | viewer, Studio recipe | yes | partial | |
| Director | Script, Look Bible, Breakdown, Shotlist, Generate, Notes | yes | no | LLM + video Blocked |
| Edit | 10 tools, trim/split/move/undo, keyframes, transitions, export | yes | partial | import/blade/undo/redo/move verified; slip/slide/roll/ripple proof pending |
| Edit | Fill Gap, Extend, Music, Mask | yes | no | Blocked: needs keys |
| LLM / Assistant | Ask/Search/Cut/Timeline, skills | yes | no | Blocked: needs keys |
| Export | presets, fps, aspect | yes | partial | 1280×720 MP4 verified; 4K/60fps matrix not run |
| Cloud | Supabase/Clerk, teams, funding | no | — | desktop/cloud; see unresolved dependencies |

## Largest adapted files (host-boundary edits)
| File | Diff lines |
|---|---|
| `lib/fal/models.ts` | 1223 |
| `components/settings/settings-page.tsx` | 710 |
| `styles/globals.css` | 524 |
| `lib/cloud/funding.ts` | 336 |
| `styles/edit-tab.css` | 234 |
| `components/edit/timeline-editor.tsx` | 106 |
| `components/edit/edit-tab.tsx` | 92 |
| `lib/cloud/firebase.ts` | 91 |
| `components/edit/extend-modal.tsx` | 80 |
| `lib/fal/video-model-routing.ts` | 73 |
| `lib/director/run-llm.ts` | 65 |
| `components/edit/clip-properties-panel.tsx` | 63 |
| `components/export/export-settings.tsx` | 58 |
| `lib/llm/skill-actions.ts` | 47 |
| `components/export/export-tab.tsx` | 44 |
| `components/edit/timeline-viewer.tsx` | 39 |
| `lib/db-converters.ts` | 37 |
| `components/create/node-palette.tsx` | 36 |
| `types/timeline.ts` | 36 |
| `components/llm/llm-tab.tsx` | 29 |
| `lib/editor/playback-engine.ts` | 27 |
| `components/director/director-llm-picker.tsx` | 26 |
| `styles/director-tab.css` | 26 |
| `lib/workflows/provider-model-options.ts` | 23 |
| `lib/editor/timeline-operations.ts` | 21 |
