# Caption Studio (shared core)

Free, on-device captions for every studio. **One codebase, two repos:** this folder is the source of truth in `remix-new-editor`
and is copied verbatim into OpenHiggsBolt (`src/shared/captionStudio/`). It imports only its own files plus three npm packages,
and `__tests__/captionStudio.test.js` fails if that stops being true or if it drifts from the Timeline caption model.

| Piece | File |
|---|---|
| Whisper (Transformers.js), WebGPU → WASM fallback, in a worker | `transcribe.worker.js`, `transcribeClient.js`, `engines.js` |
| Live microphone captions (Web Speech, on-device when offered) | `live.js` |
| Caption model, 32 looks, SRT/VTT | `model.js`, `styles.js` |
| Canvas painter (shared by preview and export) | `painter.js` |
| Free render with captions burned in (mediabunny/WebCodecs → MediaRecorder fallback) | `burn.js` |
| Modal (plain DOM, no framework) | `modal.js` → `openCaptionStudio(options)` |

Dependencies: `@remotion/captions` (match your `remotion` version), `@huggingface/transformers@4.3.1`, `mediabunny@1.64.0`.
Browser-only: call it from a click handler / client component. Nothing is uploaded and no credits are used.

## Host adapters (the only per-repo code)
- **remix-new-editor:** `src/lib/editor/captionActions.js` → `addCaptionButton({ videoUrl, appTheme, onComplete, onApply })`.
- **OpenHiggsBolt:** `hosts/openhiggsbolt/CaptionStudioAction.js` (→ `components/CaptionStudioAction.js`), injected into studios through a
  `renderCaptionAction` render prop, the same pattern as `PersonalizeVideoAction`.

## Keeping the repos in sync
```bash
node scripts/sync-caption-studio.mjs ../OpenHiggsBolt          # copy core + adapter, list missing dependencies
node scripts/sync-caption-studio.mjs ../OpenHiggsBolt --check  # exit 1 if they differ
```
Edit the core here, run the sync, commit in both repos.
