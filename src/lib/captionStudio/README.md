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

## One captions window, one engine
- **Window:** every "Captions" button opens this modal: the studios (`addCaptionButton`), the Timeline editor (subtitle entry points and the captions clip's inspector, which is now only a summary + "Open Caption Studio"), ZackD Studio (replaces its paid "Burn captions"), and the library detail view.
- **Engine:** in-browser Whisper lives only in `transcribe.worker.js` / `transcribeClient.js`. `src/lib/editor/remotion/transcribe.js` re-exports it, so CineGen, the personalization editor and the Timeline agent API use the same implementation and model list.
- **Not merged (different renderers):** the personalization editor's own caption panel and CineGen/OpenChatCut's clip captions use their own caption models and renderers. They share the engine, not the window.

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
