# Functional test report

Environment: headless Chromium (Playwright) against `vite` dev server, `#/timeline`, no provider keys.

| # | Check | Result |
|---|---|---|
| 1 | Create project, import clips, place on timeline, blade, undo/redo, move | PASS (earlier runs) |
| 2 | Smart Speech → audio clip → MP4 audio | PASS (provider stubbed, labelled) |
| 3 | Template Generator 9 steps → timeline | PASS |
| 4 | Overlays + transitions burned into MP4 | PASS |
| 5 | Legacy project exports as Cover | PASS |
| 6 | **Elements**: New Element → upload reference → Add to production | **FAIL then fixed**: `persistGeneratedAsset` returned "No source to persist." for `data:` sources. Fixed in `web-media.ts` |
| 7 | Elements: card + image persist after reload | PASS (1 card, 1 image) |
| 8 | **Spaces**: palette adds File Upload + Asset Output | PASS |
| 9 | Spaces: Prompt text → Asset Output refused (type mismatch) | PASS (CineGen behaviour) |
| 10 | Spaces: File Upload image → Asset Output connects; reload keeps 2 nodes, 1 edge | PASS |
| 11 | Shot Board node | code review only: 9 cells, identical to upstream |
| 12 | Vitest `src/cinegen` | 169 files, 1248 passed, 27 skipped |
| 13 | Elements/Spaces generation, Storyboarder, Director, LLM, Fill Gap/Extend/Music | **Blocked: needs keys** |
| 14 | trim/ripple, slip/slide/roll, keyframes/transition in MP4, export matrix | **Not completed** |
| 15 | Supabase persistence/auth | **Blocked**: no credentials |

Scripts live in the session scratchpad (es5/sp3); not yet moved to `scripts/certify/`.
