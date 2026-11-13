# Recorder Studio

The post-production half of the [Remotion Recorder](https://www.remotion.dev/docs/recorder), running inside the timeline editor.
The recording half lives in `src/components/modals/RecorderModal.jsx` (+ `recorder/capture.js`).

Where to open it:
- **Main Timeline editor** (`#/timeline`, CineGen): **EDIT** tab → the camera icon in the vertical tool strip, above the microphone (`src/cinegen/components/edit/use-screen-recorder.ts`). Recordings go to the media pool and the first free video tracks (screen on the lowest, facecam above it as picture-in-picture, mic on an audio track).
- **Classic editor** (`#/timeline-classic`): the **Recorder** chip in the "All features" bar.

Flow: **Screen Recorder drawer → record → "Edit in Studio" → scenes, captions, style → render → "Add to timeline".**

## Layout

| Path | What |
| --- | --- |
| `composition/` | **Vendored** copy of `remotion-dev/recorder` (`remotion/` + `config/`). Excluded from ESLint. |
| `project-store.ts`, `project.ts` | In-memory project: scenes, theme/layout/platform, takes → files. One project per page session. |
| `studio-shim.ts` | Replaces the Remotion Studio / filesystem APIs the composition used (`getStaticFiles`, `writeStaticFile`, `updateDefaultProps`, …) with an in-memory file store of blob URLs. |
| `useStudioMetadata.ts` | Runs the composition's own `calculateMetadata` (the Player does not). |
| `captions/` | In-browser Whisper (transformers.js, Web Worker) + converters to the Recorder's `Caption[]`; optional cloud provider via `services/whisper-client.js`. |
| `export.ts` | `@remotion/web-renderer` export (MP4/H.264 where supported, else WebM) + `.srt`. |
| `ui/`, `RecorderStudio.tsx` | Scenes / Captions / Style / Export panels and the Player. |
| `../../components/modals/RecorderStudioModal.jsx` | Full-screen drawer host; loads the Studio lazily. |

Assets: `public/recorder-studio/` (music tracks, sounds, self-hosted Inter + Roboto Mono with their OFL licences).

## Changes made to the vendored code

Keep this list when re-syncing with upstream.

- Imports of `@remotion/studio`, `staticFile`, `getStaticFiles` → `studio-shim.ts`.
- Removed: `remotion/Root.tsx`, `remotion/index.ts`, `remotion/GoToRecorder.tsx`, `config/whisper.ts` (Node-only / Studio-only).
- `config/endcard.ts`: the template author's `jonny`/`remotion` channels replaced by one user-editable `custom` channel (`setCustomBrand`) with a generated letter avatar.
- `config/fonts.ts`: Google Fonts → self-hosted woff2 via `FontFace`.
- `captions/processing/layout-captions.ts`: `validateFontIsLoaded: false` (Remotion's check false-positives when the host page also uses Inter).
- `captions/srt/SrtPreviewAndEditor`: honours `shouldBurnLandscapeCaptions()` so landscape exports can burn captions in (upstream emits only a `.srt`).
- `captions/editor/Footer.tsx`: wording (no on-disk file here).
- `layout/get-broll-dimensions.ts`: detects image/video type from the original file name (blob URLs have no extension).
- `audio/AudioTrack.tsx`: music fade shrinks for very short clips (upstream throws for clips of ~2 s or less).

Not ported on purpose: the upstream `recorder` intro scene (a Remotion Recorder promo).
The video scenes are bound to takes by recording order, as upstream.

## Notes

- Licence: the composition is Remotion Recorder code (see Remotion's licence terms). Web exports use the same `licenseKey` convention as `motion-director/webRenderer.ts`.
- The bundled music tracks come from the Recorder template; confirm their licence covers your use before shipping.
- The standalone Recorder app is still available in `apps/remotion-recorder` (see `EDITOR_INTEGRATION.md` there).
