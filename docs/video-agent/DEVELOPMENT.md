# SmartVideo Video Agent — Local Development

## Prerequisites

* Node.js >= 20 (the root SmartVideo dev server).
* Node.js >= 24, < 25 (the OpenChatCut dev server, per
  `apps/video-agent-studio/package.json` engines).
* The SmartVideo root dev server (Vite, port 3100) must be running.
* (Optional) the OpenChatCut dev server must be running on port 3200
  for the Video Agent Studio to fully boot.

## One-time setup

```bash
# at the SmartVideo repo root
npm install

# in the OpenChatCut subtree
cd apps/video-agent-studio
npm install
cd ../..
```

## Run

```bash
# Terminal 1 — SmartVideo root
npm run dev

# Terminal 2 — OpenChatCut-derived Video Agent Studio
npm run dev:video-agent-studio
```

Then open <http://127.0.0.1:3100/#/video-agent-studio>.

Without Terminal 2, the SmartVideo shell still loads and shows a
clear error splash telling the user how to start the studio.

The original Video Agent Studio 1 (AI tools grid, Pexels, etc.)
continues to be reachable at <http://127.0.0.1:3100/#/video-agent>.
The two are independent.

## Build

```bash
# build the SmartVideo app
npm run build

# build the OpenChatCut-derived Video Agent Studio
npm run build:video-agent-studio
```

## Test

```bash
# root SmartVideo unit tests
npm test

# backend tests, including the Video Agent Studio contract + regression tests
cd backend && npm test

# Video Agent Studio verify suite (runs only if the studio is installed)
npm run verify:video-agent-studio
```

## Update the OpenChatCut subtree

```bash
npm run update:video-agent-studio-subtree
```

This pulls the latest `main` from the `openchatcut` remote and
applies it as a squashed subtree at `apps/video-agent-studio/`.

## Editor separation invariants (do not break)

* `src/components/TimelineEditorPage.jsx` is the Timeline Studio
  implementation. Do not edit it for Video Agent work.
* `src/lib/editor/timelineFeatureApi.js` (`TimelineFeatureApi`) is
  the Timeline Studio's authoritative mutation API. Do not replace
  it.
* `src/components/VideoAgentPage.js` is Video Agent Studio 1.
  It remains the user-facing entry at the `video-agent` route.
  Do not edit it for Video Agent Studio 2 work.
* `src/components/VideoAgentStudioShell.js` is Video Agent Studio 2.
  It is the user-facing entry at the `video-agent-studio` route.
* `src/components/OpenMontagePage.js`,
  `backend/services/openmontageProxy.js`, and `vendor/openmontage/`
  are Video Agent Studio 1's reference sources. They are not
  deleted; they are not used by Studio 2 directly.

The regression test in
`backend/__tests__/video-agent-studio/timelineStudioRegression.test.js`
enforces these invariants; if it fails, the integration has
regressed.
