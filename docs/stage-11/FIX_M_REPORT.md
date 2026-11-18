# Fix M: re-editable speed curves, and the 40-piece export stall

Worktree `/home/user/wt-fixM`, branch `claude/focused-brown-9xfv3c-fixM` (base `2b7c6bddb`), nothing pushed or merged.

## Defect 1: a speed curve could not be re-edited

### What changed
- `Clip.speedCurve?: ClipSpeedCurve` (`types/timeline.ts`, additive). Every piece of a curve (video and linked audio) carries: `group` (one id per apply), `index`, `steps`, the `curve` itself, the ORIGINAL clip's `trimStart` / `trimEnd` (the source span), and on piece 0 only `origin: { speed, anim }` (what cannot be rebuilt from the pieces; slicing an anim is lossy).
- Persistence: rides in the existing `stage1_json` column next to `groupId` / `compound` / `anim` (`db-converters.ts`, one read line, one write line). Old rows have no key and load unchanged; a malformed value is dropped by `normalizeClipSpeedCurve`, nothing else is stripped.
- `lib/editor/stage11/speed-group.ts` (pure): `applySpeedCurveGroup` (= `applySpeedCurve` + stamping), `inspectSpeedGroup` (is the group intact, or why not), `reapplySpeedCurve` (collapse the pieces back into the original clip(s), move later clips back by the old length difference, then cut again with the new curve through the normal `applySpeedRamp` path, so ripple, links, transitions on the last piece and linked audio behave exactly as on the first apply; one new timeline object = one undo step). `applySpeedRamp` got two additive bits: `RampResult.chains`, and pieces never inherit a `speedCurve` from the clip they were cut from (so a preset ramp over one piece does not copy stale group info).
- UI (`use-stage1-editing.tsx`, `speed-curve-editor.tsx`): "Speed curve..." on ANY piece of an intact group opens the editor with the stored curve and step count and the note "Editing the curve of this ramped clip (N pieces). Applying replaces all its pieces."; Apply replaces the whole group over the original source span.

### Edge-case decision (documented in `speed-group.ts`)
Re-edit only while the group is INTACT. `inspectSpeedGroup` recomputes the expected pieces from the stored curve and refuses (with a reason shown in the popover) when, for any track of the group: the piece count differs (split, deleted, duplicated), an index is missing or duplicated, a piece was moved, trimmed or retimed (start, trims, speed beyond 1e-4 s / 1e-6), a transition sits between two pieces, the track is locked ("Unlock it to edit the speed curve"), or the origin snapshot is missing. For a stale group the popover says why and offers the old behaviour: a new curve over the selected piece only. Compound clips are never ramped (existing rule); pieces nested inside a compound are not top-level clips, so they are not editable until the compound is expanded.
Re-apply takes non-timing properties (fx, volume, eq, ...) from piece 0, like the first apply copies them from the one original; keyframes are rebuilt from all pieces in source time, fade-in from piece 0, fade-out from the last piece, anim from the origin snapshot. Per-piece edits made after the first apply to anything but timing (e.g. an fx on piece 3 only) are therefore not kept on re-apply.

### Verification
- `src/cinegen/__tests__/stage11/speed-group.test.ts` (17 tests, real timeline operations and the real row converters): info on every piece incl. audio; DB row round trip through JSON; old rows / garbage load; a preset ramp over a piece drops the info; re-apply replaces all pieces over the full source span, ripples the following clip, relinks audio 1:1, leaves the input timeline untouched, works from an audio piece, same curve gives identical timings, shrink / grow moves later clips by exactly the length change, keyframes / fades / anim preserved; stale for split, delete, move, trim, retime, locked track, transition between pieces; outgoing transition follows the last piece; compound untouched.
- Real browser (`docs/stage-11/smoke/curve-reedit-smoke.cjs`, ALL PASS, headless Chromium, real `#/timeline`, real imported mp4, real save and reload): apply a 12-piece hero-moment curve -> 24 cards; the saved rows (IndexedDB) all carry the curve with 12 steps and 3 points; reload the project: still 24 cards; select a MIDDLE piece, the popover opens in re-edit mode with 12 steps and the 3-point curve ("22.78 s"); switch to flash-forward with 8 steps ("4.56 s") and Apply: 16 cards, saved rows are 16 with exactly one new group and no leftovers of the old one; ONE Ctrl+Z restores 24 cards and the saved 12-step state; delete one piece, open the curve on its neighbour: "This speed curve can no longer be edited: its 12 pieces were split, deleted or duplicated (11 found on V1). Applying makes a new curve over this piece only."

## Defect 2: the 40-piece export that never finished

### Result: NOT reproduced; no threshold or quadratic cost found
Measured with `export-smoke.cjs` (new env: `PROGRESS=1` logs the renderer's progress messages and heap every 10 s, `DL_TIMEOUT=<ms>`), real Export tab, Draft 720p 30 fps, mp4, tcode.mp4 curve "Flash forward" (131 output frames; the pieces are video + linked audio, so 2 x N clips). Headless Chromium 153, dev server, 4 cores shared with other agents.

| pieces | clips | export wall time | frame timing vs piece list |
|---|---|---|---|
| 32 | 64 | 13 s | mean abs 0.026 s |
| 40 | 80 | 14 s | ok |
| 48 | 96 | 21 s | mean 0.032 s, p95 0.110 |
| 64 | 128 | 21 s | mean 0.024 s, p95 0.077 |
| 64, with 4 busy-loop processes added (load average 16) | 128 | 21 s | passes; peak RSS of the whole Chromium tree about 2.2 GB |

Progress messages arrive steadily (about 3 per second, encoded frames grow linearly), JS heap stays flat at about 200 MB at every piece count. The Remotion composition mounts only the sequences active at a frame (a clip is a `Sequence`), so at most one or two video elements exist at once regardless of piece count; time per frame did not grow with piece count between 32 and 64 beyond noise (13 to 21 s for the whole file). I read `@remotion/media` 4.0.540 (shared per-source iterator cache, size-capped) but found no cost that scales with the number of clips in this range.

What the evidence does show: my first export attempt on a freshly started dev server (a plain 1x single-clip export, nothing to do with curves) also produced no file in 290 s, while the identical export on the warm server took 23 s. A first export on a cold Vite dev server has to compile the sandboxed export runner and the encoder chunks (Vite logged deoptimised-babel notes for the 500 KB `mediabunny-aac-encoder` chunk) while the machine was at load average above 10, so the original 290 s "stall" is most likely that cold start plus machine load (the Port J report notes load above 20 and Chromium crashes on this machine), not the piece count. I tried to prove this with a cold run on a fresh Vite cache; that run failed in the page-load helpers (goto timeout, a flaky click on a not yet ready page) before reaching the export, so the cold-start explanation is a likely cause supported by one observation, NOT proven.

### Cap
`CURVE_MAX_STEPS` is raised from 32 back to 64 (the original value). Proven by real exports: 40, 48 and 64 pieces (64 twice, once under CPU load), each finished in 13 to 21 s with correct frame timing. Not proven: a longer timeline (all measurements are a 4.4 s output with 131 frames, so 64 pieces is about 2 frames per piece), a production build instead of the dev server, other machines or browsers, or any export while memory is tight (peak RSS about 2.2 GB for 64 pieces). If the stall ever reproduces, the first thing to look at is cold-start compile of the export runner, with `PROGRESS=1`.

## Not verified / limits
- Preview playback of many-piece seams and a real export of a RE-EDITED curve were not run (a re-applied group is ordinary clips, the same as the first apply that was exported before).
- Locked track, transition-between-pieces, compound, and moved / trimmed pieces are covered by unit tests only, not in the browser (the browser run covers delete / count mismatch).
- The cold-start explanation for the stall (above) is unproven.
- No `vite build` was run (no bundling change); no whole-project `tsc`.
