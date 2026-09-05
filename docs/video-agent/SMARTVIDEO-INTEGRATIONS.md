# SmartVideo Video Agent Studio 2 — SmartVideo integrations

Video Agent Studio 2 is embedded as an iframe. **The OpenChatCut
application does not integrate with SmartVideo's backend systems.**
This is a deliberate architectural decision: OpenChatCut operates
as the complete original application, and SmartVideo provides
only the route, the chrome, the navigation entry, and the
dev/build scripts.

This document therefore lists what Studio 2 does **not** consume
from SmartVideo, and what Studio 2 provides for itself.

## What Studio 2 does NOT use from SmartVideo

* **Auth** — Studio 2 does not use SmartVideo Clerk. OpenChatCut
  has its own auth surface (configured inside Studio 2's own
  settings UI).
* **Storage** — Studio 2 does not use SmartVideo's Supabase /
  hybrid / R2 storage. OpenChatCut stores projects, media, and
  models in its own data directory.
* **Model registry + MuAPI** — Studio 2 does not use SmartVideo's
  model registry or MuAPI. OpenChatCut has its own provider
  model registry, configured inside Studio 2's settings.
* **Credits** — Studio 2 does not use SmartVideo's credit
  ledger. OpenChatCut has its own quota / approval surface.
* **Publishing** — Studio 2 has its own export pipeline
  (Remotion + FFmpeg + FCPXML + browser export). It does not
  route through SmartVideo's Social Publisher.
* **Realtime** — Studio 2 has its own SSE / event surface.
* **Timeline Studio** — Studio 2 does not use TimelineFeatureApi
  or any Timeline Studio state.
* **Video Agent Studio 1** — Studio 2 does not reuse the
  `VideoAgentPage.js` implementation or the Studio 1 backend.
* **OpenMontage** — Studio 2 does not reuse the OpenMontage
  reference source.

## What SmartVideo provides for Studio 2

* The `video-agent-studio` route in `src/lib/router.js` →
  `src/components/VideoAgentStudioShell.js`.
* A navigation entry in `src/lib/studioRoutes.js` (Tools
  category) so Studio 2 shows up in the SmartVideo drawer,
  dashboard, launcher, or catalog next to the other studios.
* SmartVideo-branded chrome inside the shell (header, splash,
  error splash with Retry button, back button).
* CSP allowance for the iframe origin in `vite.config.js`.
* Root npm scripts: `install:video-agent-studio`,
  `dev:video-agent-studio`, `dev:all`,
  `build:video-agent-studio`, `test:video-agent-studio`,
  `verify:video-agent-studio`,
  `update:video-agent-studio-subtree`.
* A verification script (`scripts/verify-video-agent-studio.mjs`)
  that asserts the full-application integration path is wired up.

## Optional future cross-studio workflows (not part of this work)

If a future strategy requires Studio 2 results to land in Timeline
Studio, that hand-off would be a future feature implemented as a
download/upload flow or a separate cross-studio adapter. It is
**not part of this work**.

## See also

* `docs/video-agent/ARCHITECTURE.md`
* `docs/video-agent/TESTING.md`
* `docs/video-agent/PRODUCTION-DEPLOYMENT.md`
* `docs/audits/VIDEO-AGENT-OPENCHATCUT-BASELINE.md`
* `docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`
* `docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md`
