# SmartVideo Video Agent Studio 2 — Local Development

## Prerequisites

* Node.js >= 20 (the SmartVideo root dev server).
* Node.js 24.x (the OpenChatCut dev server, per
  `apps/video-agent-studio/package.json` `engines.node`).
* The SmartVideo root dev server (Vite, port 3100) must be
  running for Studio 2 to be reachable through the SmartVideo
  shell.

## One-time setup

```bash
# at the SmartVideo repo root
npm install

# inside the OpenChatCut subtree
npm run install:video-agent-studio
```

`npm run install:video-agent-studio` installs the OpenChatCut
subtree's dependencies into `apps/video-agent-studio/node_modules/`.
It does **not** install the subtree's dependencies into the root
dependency tree.

## Run

```bash
# Terminal 1 — SmartVideo root
npm run dev

# Terminal 2 — OpenChatCut-derived Video Agent Studio 2
npm run dev:video-agent-studio
```

Or run both in one process:

```bash
npm run dev:all
```

`npm run dev:all` uses `concurrently` to start both processes. It
shuts down both processes when the parent is stopped, propagates
exit codes, and does not silently hide startup failures.

Then open <http://127.0.0.1:3100/#/video-agent-studio>.

Without Terminal 2 (or without `npm run install:video-agent-studio`),
the SmartVideo shell still loads and shows a clear error splash
with the command required to start the studio and a Retry button.

The original Video Agent Studio 1 (AI tools grid, Pexels, etc.)
continues to be reachable at <http://127.0.0.1:3100/#/video-agent>.
The two are independent.

## Iframe URL

The shell reads its iframe URL from
`VITE_VIDEO_AGENT_STUDIO_URL`. The default is
`http://localhost:5199/` (the port OpenChatCut's `dev:shared`
script binds by default). Set this environment variable in
`.env.local` for non-default hosts or ports.

## Build

```bash
# build the SmartVideo root application
npm run build

# build the OpenChatCut-derived Video Agent Studio 2
npm run build:video-agent-studio
```

`npm run build:video-agent-studio` runs the OpenChatCut
subtree's own production build (`tsc -b && vite build`).

## Test

```bash
# root SmartVideo unit tests
npm test

# backend tests, including the existing 32 contract tests
cd backend && npm test

# OpenChatCut subtree tests (uses the subtree's own test runner)
npm run test:video-agent-studio

# full integration verification (subtree + build + dev server +
# SmartVideo route + iframe URL + shell)
npm run verify:video-agent-studio
```

`npm run verify:video-agent-studio` reports each step as
`PASS`, `BLOCKED`, or `FAIL`. Pass `--with-server` to also start
the OpenChatCut dev server and probe it. Pass `--skip-build` to
skip the build + dev-server steps.

## Update the OpenChatCut subtree

```bash
npm run update:video-agent-studio-subtree
```

This pulls the latest `main` from the `openchatcut` remote and
applies it as a squashed subtree at `apps/video-agent-studio/`.

## Editor separation invariants (do not break)

* `src/components/TimelineEditorPage.jsx` is the Timeline Studio
  implementation. Do not edit it for Video Agent Studio 2 work.
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
