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
        ┌─────────────┬──────────┴──────────┬───────────────┐
        │             │                     │               │
        ▼             ▼                     ▼               ▼
  VIDEO AGENT   VIDEO AGENT           TIMELINE         OTHER
   STUDIO 1     STUDIO 2               STUDIO         STUDIOS
  (existing)    (NEW, OCC)        (manual editor)    (image,
        │             │                     │          video,
   legacy        OpenChatCut-          EXISTING       cinema,
   SmartVideo    derived              SMARTVIDEO     ...)
    state        ProjectDoc               STATE
                     │                     │
                EditorCore                 │
                     │                     │
                ┌────┼─────┐                │
                │    │     │                │
              Edit  AI   Producer           │
                   Chat                    │
                │    │     │                │
                └────┼─────┘                │
                     │                      │
              SmartVideo Services           │
                     │                      │
        ┌────────────┼────────────┐         │
        │            │            │         │
       MuAPI      Storage     Credits      │
        │            │            │         │
        └────────────┼────────────┘         │
                     │                      │
                 Rendering                  │
                     │                      │
                 Publishing                 │
                     │                      │
                     └── optional adapter ──┘
                         (Phase 17 hand-off)
```

## Three editors, three state systems

There are exactly three independent editor state systems by design:

* **Video Agent Studio 1** — the existing SmartVideo
  implementation at `src/components/VideoAgentPage.js`, route
  `video-agent`. The AI tools grid + backend at `/videoagent`
  remains the source of truth for Studio 1.
* **Video Agent Studio 2** — the OpenChatCut-derived
  implementation under `apps/video-agent-studio/`, route
  `video-agent-studio`. Studio 2 is the new "AI edits with you"
  experience. Its own `ProjectDoc` is canonical inside Studio 2.
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

The SmartVideo side of Studio 2 lives in:

* `src/components/VideoAgentStudioShell.js` — the iframe shell,
  SmartVideo chrome, postMessage handshake, error splash.
* `src/lib/videoAgentAuth.js` — Clerk identity bridge.
* `src/lib/router.js` — route wiring (`video-agent-studio` → shell,
  `video-agent` unchanged → Studio 1).
* `backend/routes/video-agent-studio/index.js` — Express surface.
* `backend/services/video-agent-studio/*` — adapter contracts and
  in-memory implementations for dev/test.
* `vite.config.js` — CSP allowance for the iframe origin.

The OpenChatCut side of Studio 2 is **unmodified** during this work.
Subtree updates (see
`npm run update:video-agent-studio-subtree`) are expected to apply
cleanly.

## SmartVideo services Studio 2 depends on

* **Auth** — `src/lib/clerkInit.js`, `src/lib/clerkEntitlements.js`.
  Studio 2 receives only an opaque identity (id, email,
  isAuthenticated, source) via postMessage. It never sees a Clerk
  session token.
* **Storage** — `src/lib/hybrid-supabase.js`, `src/lib/supabase.js`,
  `src/lib/offline-storage.js`. The Studio 2 asset layout is
  `video-agent/{userId}/{projectId}/{assetId}` (Phase 9).
* **Model registry** — `src/lib/modelCatalog.js`, `src/lib/models.js`,
  `src/lib/muapi.js`, `backend/services/modelCatalogService.js`,
  `backend/services/agentActionsService.js`. Studio 2 does NOT
  talk to providers directly; it goes through the
  `SmartVideoGenerationAdapter` which resolves the capability into a
  concrete model + provider.
* **Credits** — existing usage/billing tables and metering. Studio 2
  goes through `CreditLedger` which is the single source of truth for
  `estimate → reserve → execute → reconcile`.
* **Publishing** — the existing SmartVideo Social Publisher
  (Phase 16). Studio 2 does not build a duplicate publisher.
* **Realtime** — SSE endpoint at
  `/api/video-agent-studio/events` backed by
  `InMemoryVideoAgentEventBus`. In production the bus can be backed
  by the existing SmartVideo realtime channel.

## State ownership

* OpenChatCut `ProjectDoc` is the canonical project model for
  Studio 2. Agent edits MUST go through registered OpenChatCut editor
  commands and the draft/proposal engine. The LLM never mutates
  timeline JSON directly.
* The SmartVideo `TimelineFeatureApi` is the canonical mutation API
  for the Timeline Studio. It is never replaced by OpenChatCut.
* Generated media becomes a SmartVideo asset (Phase 11) and is
  inserted into Studio 2's media pool. Studio 2's own asset system
  is the consumer; the source of truth for the asset binary is
  SmartVideo storage.

## Security model

* No provider keys in browser bundles. Studio 2 requests a
  capability, the SmartVideo backend resolves a model, reserves
  credits, calls the provider, persists the output.
* Auth is derived from the SmartVideo Clerk session, never from
  browser-supplied `userId`.
* All routes are user-scoped; the contract tests assert that
  cross-user reads/writes are rejected.
* The iframe is sandboxed (`allow-scripts allow-same-origin
  allow-forms allow-popups allow-popups-to-escape-sandbox
  allow-downloads`) and only accepts postMessages from the
  configured studio origin.

## Update strategy

The OpenChatCut subtree is updated via:

```bash
npm run update:video-agent-studio-subtree
```

This runs `git fetch openchatcut && git subtree pull --prefix=apps/video-agent-studio openchatcut main --squash`.

After an update, the SmartVideo-side adapter layer should keep
working because Studio 2 does not depend on internal OpenChatCut
APIs directly — it talks to the SmartVideo-side HTTP surface at
`/api/video-agent-studio/...`. If the studio's internal message
contract changes, the bridge layer in
`src/components/VideoAgentStudioShell.js` is the single point of
adaptation.

## See also

* `docs/video-agent/DEVELOPMENT.md`
* `docs/video-agent/SMARTVIDEO-INTEGRATIONS.md`
* `docs/video-agent/OPENCHATCUT-MIGRATION.md`
* `docs/video-agent/PRODUCER-WORKFLOWS.md`
* `docs/video-agent/TESTING.md`
* `docs/audits/VIDEO-AGENT-OPENCHATCUT-BASELINE.md`
* `docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`
* `docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md`
