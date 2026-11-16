# Stage 11 fix K: leftovers after the FreeCut ports

Run on the merged branch (ports H, I1, I2, J merged). Everything below was run for real unless marked not run.

## Fixed
- **Undo/redo was never saved.** Ctrl+Z / Ctrl+Shift+Z (and the Voice Director undo) called `historyDispatch` directly, so no save was marked pending and the stored project kept the undone-away state until something else saved. Found while chasing "Undo after Lift needs two presses" (Port J): the screen undid in one press, the stored project did not. Both now go through `wrappedDispatch`. This also exists on origin/develop. `range-smoke.cjs`: undo restores the clip after 1 press, stored project included.
- **Import popped a "Background Transcription Failed" modal** for every user with no speech model installed (regression from Port I1 replacing the silent download with consent). The "No speech model is installed" failure no longer opens the modal; the asset keeps its failed badge with the message that points to Media tools > Local AI.
- **Classic editor downloaded Whisper silently** (`transcribe.js`). It now asks once per model (confirm dialog with size and licence, remembered in localStorage); declining rejects like a cancel. 2 new tests.
- **Kokoro cancel unhandled rejection**: swallowed only while the cancelled load is settling.
- **Deleting a local audio model** now also removes the repo's tokenizer/config/voice files, unless another installed model of the same repo still needs them.
- **Scene-search vectors are saved** (IndexedDB, keyed by scene id + thumbnail hash) and reused after a reload; a changed thumbnail is re-embedded. New unit test with an in-memory store. Not exercised in a real browser.
- **Caption language / model picker**: Generate captions now has "Spoken language" and "Speech model" selects (default auto + best installed) with help entries. UI not exercised in a real browser.
- **Speed curve piece cap 64 -> 32.** Real exports: 16, 24, 32 and 36 pieces finished in about a minute; 40 never produced a file in 290 s (no crash this time). Cause not diagnosed; the cap is a mitigation.

## Checks (merged branch)
- Full `vitest run`: 12,382 passed, 3 failed before the help-entry fix; after it only the 2 develop-owned failures remain (guide for `zackd`, zackd studio test; both also fail on plain origin/develop). Help-coverage test re-run: passes.
- ESLint on the changed files: 0 errors.
- `vite build` with a 12 GB heap: exit 0 (4 min). It is killed with smaller heaps on this machine.
- Real Chromium: `combined-smoke.cjs` all PASS; `pitch-smoke.cjs` ALL PASS (880 Hz preview and export); `recovery-smoke.cjs` ALL PASS; `range-smoke.cjs` ALL PASS.

## Not done / not run
- Firefox / Safari, WebGPU, MusicGen, multilingual Whisper, Lottie panel UI, WebM through the picker.
- Why a 40-piece speed-curve export stalls.
- Crash recovery still covers timelines and assets only.
