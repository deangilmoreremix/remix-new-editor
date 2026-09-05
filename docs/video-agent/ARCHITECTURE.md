# SmartVideo Video Agent Studio 2 — Architecture

This document describes the target architecture after the OpenChatCut
integration lands. It is the canonical reference for **Video Agent
Studio 2** inside SmartVideo and the boundary it maintains with the
existing SmartVideo Timeline Studio and the existing Video Agent
Studio 1.

## Top-level

```
                          SMARTVIDEO
                               │
       ┌─────────────┬─────────┴──────────┬───────────────┐
       │             │                    │               │
       ▼             ▼                    ▼               ▼
  VIDEO AGENT   VIDEO AGENT           TIMELINE         OTHER
   STUDIO 1     STUDIO 2               STUDIO         STUDIOS
  (existing)    (NEW, OCC)        (manual editor)    (image,
       │             │                    │          video,
   legacy        OpenChatCut-          EXISTING       cinema,
   SmartVideo    derived              SMARTVIDEO     ...)
    state        ProjectDoc               STATE
       │             │                    │
       │        (iframe)                  │
       │             │                    │
       │        SmartVideo                │
       │        shell only                │
       │             │                    │
       └─── no cross-editor state ────────┘
```

## Three editors, three state systems

There are exactly three independent editor state systems by design:

* **Video Agent Studio 1** — the existing SmartVideo
  implementation at `src/components/VideoAgentPage.js`, route
  `video-agent`. The AI tools grid + backend at `/videoagent`
  remains the source of truth for Studio 1.
* **Video Agent Studio 2** — the complete OpenChatCut
  application under `apps/video-agent-studio/`, embedded as an
  iframe in the SmartVideo shell at route `video-agent-studio`.
  Studio 2's own OpenChatCut `ProjectDoc` is canonical inside
  Studio 2.
* **Timeline Studio** — the existing SmartVideo implementation,
  route `timeline`, with its own state via `TimelineEngine` and
  `TimelineFeatureApi`. The manual "I want to edit my video"
  experience.

The three editors **do not share a mutable timeline store**. Any
cross-editor hand-off happens through a defined adapter (Phase 17)
and is not required for Studio 2 to function.

## Video Agent Studio 2 boundaries

Video Agent Studio 2 is a structurally isolated sub-application
inside the SmartVideo repo at `apps/video-agent-studio/`. It is
imported via `git subtree` from `deangilmoreremix/OpenChatCut`. Its
own dependency boundary is `apps/video-agent-studio/package.json`;
it does not pull OpenChatCut's deps into the SmartVideo root
package, and the root package does not downgrade any of its existing
versions to accommodate the subtree.

The SmartVideo-side surface for Studio 2 is intentionally tiny:

* `src/components/VideoAgentStudioShell.js` — the iframe shell,
  SmartVideo chrome (header, splash, error splash, Retry button,
  back button), minimal readiness handshake.
* `src/lib/router.js` — route wiring (`video-agent-studio` →
  shell). The `video-agent` and `timeline` routes are unchanged.
* `src/lib/studioRoutes.js` — navigation catalog entry under the
  "Tools" category so the studio shows up in the same drawer,
  dashboard, or launcher as every other studio.
* `vite.config.js` — CSP allowance for the iframe origin.
* `package.json` — convenience scripts for
  `install:video-agent-studio`, `dev:video-agent-studio`,
  `dev:all`, `build:video-agent-studio`, `test:video-agent-studio`,
  `verify:video-agent-studio`, `update:video-agent-studio-subtree`.
* `scripts/verify-video-agent-studio.mjs` — verifies the
  full-application integration path (subtree, build, server
  responds, route, iframe URL, shell).

The OpenChatCut side of Studio 2 is **unmodified** during this
work. Subtree updates (see
`npm run update:video-agent-studio-subtree`) are expected to apply
cleanly.

## Iframe boundary (the only Studio 2 ↔ SmartVideo surface)

* `src/components/VideoAgentStudioShell.js` is the *only* place
  that talks to Studio 2. The shell sets the iframe `src` to
  `VITE_VIDEO_AGENT_STUDIO_URL` (default `http://localhost:5199/`)
  and waits for the iframe to load.
* The shell listens for an *optional* readiness message
  (`studio.ready` or `health.pong`) from the OpenChatCut app. If
  the readiness handshake is not used, the iframe `load` event is
  the readiness signal.
* No timeline, media, project, generation, or export commands
  cross the iframe boundary. Studio 2 operates as a complete,
  independent application.

## What Studio 2 does NOT use from SmartVideo

* `TimelineFeatureApi` — Studio 2 does not mutate Timeline Studio
  state.
* Timeline Studio state — Studio 2 does not share state with
  Timeline Studio.
* `VideoAgentPage.js` — Studio 1 is untouched; Studio 2 does not
  reuse Studio 1 code.
* OpenMontage — Studio 1's reference sources are preserved but
  not used by Studio 2.
* SmartVideo's project format — Studio 2 uses its own
  OpenChatCut `ProjectDoc`.
* SmartVideo's media store — Studio 2 stores media inside
  OpenChatCut's own data directory.
* SmartVideo's generation adapter — Studio 2 talks to providers
  through OpenChatCut's own provider model registry.
* SmartVideo's event bus — Studio 2 has its own SSE / event
  surface.
* SmartVideo's credit ledger — Studio 2 has its own quota /
  approval surface.
* SmartVideo's export implementation — Studio 2 has its own
  Remotion / FFmpeg export pipeline.

## Historical / out-of-scope adapter layer

The earlier integration attempt left a SmartVideo-side adapter
layer at `backend/services/video-agent-studio/*` and
`backend/routes/video-agent-studio/*`. The current Studio 2
integration strategy does NOT use that layer. It is preserved
(not deleted) for historical reference and is explicitly
documented as out-of-scope in
`backend/services/video-agent-studio/README.md` and
`backend/routes/video-agent-studio/README.md`.

## State ownership

* OpenChatCut `ProjectDoc` is the canonical project model for
  Studio 2. Agent edits MUST go through registered OpenChatCut
  editor commands and the draft/proposal engine. The LLM never
  mutates timeline JSON directly.
* The SmartVideo `TimelineFeatureApi` is the canonical mutation API
  for the Timeline Studio. It is never replaced by OpenChatCut.
* The original `VideoAgentPage.js` remains the canonical entry
  for Studio 1 (route `video-agent`).

## Security model

* Studio 2 runs as its own application on its own host. The
  iframe is sandboxed (`allow-scripts allow-same-origin
  allow-forms allow-popups allow-popups-to-escape-sandbox
  allow-downloads`) and only accepts postMessages from the
  configured studio origin.
* No SmartVideo credentials, API keys, or session tokens cross
  the iframe boundary. Authentication for Studio 2 is configured
  inside Studio 2's own settings UI.
* SmartVideo's CSP allows the iframe origin via `frame-src` (see
  `vite.config.js`). The current allowance is
  `http://localhost:5199` (dev) and
  `https://video-agent.smartvid.app` (prod placeholder).

## Update strategy

The OpenChatCut subtree is updated via:

```bash
npm run update:video-agent-studio-subtree
```

This runs `git fetch openchatcut && git subtree pull --prefix=apps/video-agent-studio openchatcut main --squash`.

After an update, the SmartVideo shell should keep working because
it does not depend on internal OpenChatCut APIs directly — it
only embeds the iframe and waits for it to load.

## See also

* `docs/video-agent/DEVELOPMENT.md`
* `docs/video-agent/SMARTVIDEO-INTEGRATIONS.md`
* `docs/video-agent/OPENCHATCUT-MIGRATION.md`
* `docs/video-agent/PRODUCER-WORKFLOWS.md`
* `docs/video-agent/TESTING.md`
* `docs/video-agent/PRODUCTION-DEPLOYMENT.md`
* `docs/audits/VIDEO-AGENT-OPENCHATCUT-BASELINE.md`
* `docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`
* `docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md`
