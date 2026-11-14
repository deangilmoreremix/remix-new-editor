# Remotion Recorder inside this repo

This folder is an **unmodified copy of https://github.com/remotion-dev/recorder** (`diff -r` against upstream shows only this file and `embed/`).
Remotion's licence terms apply: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md

## How the editor uses it

The editor shows upstream's own recorder UI (`src/`) in an iframe; no recording code was rewritten.

```bash
npm run build:remotion-recorder   # builds apps/remotion-recorder/src -> public/recorder-ui/ (also part of `npm run build`)
npm run test:remotion-recorder    # upstream's own tests (tests/), unchanged, run with vitest instead of bun
```

- **Build** (`embed/vite.config.mjs`): bundles upstream's `src/` with upstream's own `index.html` and Tailwind 3 config.
  It swaps exactly five modules by build-time aliasing (nothing in `src/` is edited) because they call upstream's Bun server:
  `helpers/upload-file`, `helpers/transcribe-video`, `helpers/cancel-transcribe`, `actions/fetch-project-folders`, `actions/create-folder`
  → `embed/adapters/*` (postMessage to the editor). It also fills upstream's `<!--remotion-server-placeholder-->` with the same
  `window.remotionServerEnabled = true` flag its server injects, as an external script (the editor's CSP blocks inline scripts), and rebases the
  one absolute `/logo.png` path.
- **Editor side** (`src/components/modals/RecorderModal.jsx`): hosts the iframe, receives the converted takes, transcribes them in the browser,
  and offers **Add to timeline** / **Recorder Studio**. It also turns upstream's "Go to Studio" link (which pointed at its Remotion Studio
  server on localhost:3000) into the editor's own Studio.

## Running upstream completely standalone

```bash
npm run install:remotion-recorder && npm run dev:remotion-recorder   # Bun server + Remotion Studio on http://localhost:4000
```
Needs Node 20.19+/22.13+ and Bun 1.1.11+.
