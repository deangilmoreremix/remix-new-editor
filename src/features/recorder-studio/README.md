# Recorder Studio

The Remotion Recorder, inside the timeline editors. Upstream = https://github.com/remotion-dev/recorder (commit 4c09934).

## What is upstream code and what is ours

**Recording UI: 100% upstream.** `apps/remotion-recorder/src` runs unmodified in an iframe (`/recorder-ui/`). See
`apps/remotion-recorder/EDITOR_INTEGRATION.md`. Our code there is only glue:

| Ours | Size | Purpose |
| --- | --- | --- |
| `apps/remotion-recorder/embed/adapters/*` (6 files) | ~150 lines | answer the 5 calls upstream's UI makes to its Bun server (save take, transcribe, cancel, folders) over postMessage |
| `apps/remotion-recorder/embed/vite.config.mjs`, `vitest.config.mjs` | ~90 lines | build/test upstream as-is |
| `src/components/modals/RecorderModal.jsx` | ~190 lines | iframe host + receives takes |
| `src/cinegen/components/edit/use-screen-recorder.ts` + sidebar button | ~120 lines | puts a take on the CineGen timeline |

**Post-production: upstream's composition, with our glue.** `composition/` is upstream's `remotion/` + `config/` (scenes, layouts, captions,
chapters, transitions, end card, B-roll, music). Upstream edits it in **Remotion Studio**, which needs a Node/Bun server and cannot run in a
browser-only app, so these files are ours and replace that Studio: `RecorderStudio.tsx` + `ui/` (scene/caption/style/export panels),
`project.ts`, `project-store.ts`, `studio-shim.ts` (in-memory stand-ins for the Studio/filesystem APIs the composition calls),
`useStudioMetadata.ts`, `export.ts` (web-renderer export) and `captions/` (in-browser Whisper replacing Whisper.cpp on the server).

## Where to open it

- **Main Timeline editor** (`#/timeline`, CineGen): **EDIT** tab → the camera icon in the vertical tool strip, above the microphone.
  A take goes to the media pool and the first free video tracks (screen lowest, facecam above it as picture-in-picture, mic on an audio track).
- **Classic editor** (`#/timeline-classic`): the **Recorder** chip in the "All features" bar.

Flow: record in upstream's UI → its **Copy to public/timeline-project** button (upstream converts the take in the browser) → the editor receives
the files and transcribes them → **Add to timeline** or **Recorder Studio** → scenes, captions, style → render → **Add to timeline**.

## Changes made to the vendored composition (`composition/`)

Keep this list when re-syncing with upstream.

- Imports of `@remotion/studio`, `staticFile`, `getStaticFiles` → `studio-shim.ts` (16 of the 20 edited files are only this).
- Removed: `remotion/Root.tsx`, `remotion/index.ts`, `remotion/GoToRecorder.tsx` (Remotion Studio entry points), `config/whisper.ts` (Node-only).
- `config/endcard.ts`: the template author's `jonny`/`remotion` channels replaced by one user-editable `custom` channel (`setCustomBrand`).
- `config/fonts.ts`: Google Fonts → self-hosted woff2 (`public/recorder-studio/fonts`, SIL OFL) via `FontFace`.
- `captions/processing/layout-captions.ts`: `validateFontIsLoaded: false` (Remotion's check false-positives when the host page also uses Inter).
- `captions/srt/SrtPreviewAndEditor`: honours `shouldBurnLandscapeCaptions()` so landscape exports can burn captions in.
- `captions/editor/Footer.tsx`: wording (no on-disk file here).
- `layout/get-broll-dimensions.ts`: image/video type from the original file name (blob URLs have no extension).
- `audio/AudioTrack.tsx`: music fade shrinks for clips of ~2 s or less (upstream throws).

Not ported on purpose: the upstream `recorder` intro scene (a Remotion Recorder promo). Video scenes are bound to takes by recording order, as upstream.

## Tests

- `npm run test:remotion-recorder`: upstream's own 5 test files, unchanged.
- `__tests__/upstream/`: upstream's caption-processing tests re-pointed at `composition/` (the copy the editor actually runs).

## Notes

- Licence: upstream is Remotion Recorder code (see Remotion's licence terms). Web exports use the same `licenseKey` convention as `motion-director/webRenderer.ts`.
- The bundled music tracks come from the Recorder template; confirm their licence covers your use before shipping.
- Dev: run `npm run build:remotion-recorder` once, otherwise the Recorder window explains that it is missing. `npm run build` does it for you.
