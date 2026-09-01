# SmartVideo Integrations

The OpenChatCut-derived Video Agent Studio is integrated with the
existing SmartVideo infrastructure through narrow, well-defined
adapters. The studio does NOT replace or duplicate those integrations.

## Auth — SmartVideo Clerk

* Source: `src/lib/clerkInit.js`, `src/lib/clerkEntitlements.js`,
  `backend/middleware/auth.js`.
* Adapter: `src/lib/videoAgentAuth.js`.
* Contract: the shell resolves the current SmartVideo user from
  `window.Clerk` and forwards only `{ id, email, isAuthenticated,
  source }` to the iframe via postMessage.
* The iframe NEVER receives a Clerk session token, an API key, or
  any private profile data. It calls back into the SmartVideo
  backend with its own authenticated session if it needs anything
  more than the id.

## Storage — Supabase / hybrid / R2

* Sources: `src/lib/hybrid-supabase.js`, `src/lib/supabase.js`,
  `src/lib/offline-storage.js`.
* Adapter: `backend/services/video-agent-studio/mediaStore.js`.
* Asset layout: `video-agent/{userId}/{projectId}/{assetId}/{filename}`.
* Validation: server-side mime and size limits
  (`isAllowedUploadMime`, `MAX_UPLOAD_BYTES`).
* The concrete production implementation plugs the existing
  `hybrid-supabase.js` helpers into the `VideoAgentMediaStore`
  contract. The in-memory implementation is for tests.

## Model registry + MuAPI

* Sources: `src/lib/modelCatalog.js`, `src/lib/models.js`,
  `src/lib/muapi.js`, `src/lib/muapiKeyValidator.ts`,
  `backend/services/modelCatalogService.js`,
  `backend/services/agentActionsService.js`.
* Adapter: `backend/services/video-agent-studio/generationAdapter.js`.
* Capabilities (whitelisted): `video.generate`, `image.generate`,
  `audio.tts`, `audio.music`, `audio.sfx`, `video.lipsync`,
  `video.upscale`, `video.reframe`, `video.transcribe`,
  `video.analyze`, `stock.video.search`, `stock.image.search`.
* The studio NEVER holds a provider key. It asks for a capability;
  SmartVideo resolves the model + provider, reserves credits, calls
  MuAPI, persists the output as a SmartVideo asset, and returns the
  asset to the studio's media pool.

## Credits

* Source: existing SmartVideo usage/billing tables under
  `supabase/migrations/*`.
* Adapter: `backend/services/video-agent-studio/creditLedger.js`.
* Lifecycle: `estimate → reserve → execute → reconcile`.
* Approval modes: `AUTO`, `BALANCED`, `MANUAL`. See
  `requiresApproval()` for the gate.
* No second credit system is introduced.

## Publishing

* The OpenChatCut-derived studio's final publish step will route
  through the existing SmartVideo Social Publisher rather than a
  duplicate. Wiring is deferred until the studio's export step is
  reachable from the iframe; in the meantime, the export step
  produces a downloadable file the user can hand off.

## Realtime

* Source: existing SmartVideo realtime channel.
* Adapter: `backend/services/video-agent-studio/eventBus.js` and the
  `/api/video-agent-studio/events` SSE endpoint.

## Authenticated SmartVideo studios exposed as agent tools

Phase 13. Existing SmartVideo studios that have a clean backend
capability (e.g. image generation, lip sync, upscale, social
publishing) are exposed to the agent as **SmartVideo agent tools**
through the same `SmartVideoGenerationAdapter` lifecycle. The
tool-layer additions will land in a follow-up; the wire contract
(resolve capability → resolve model → reserve credits → call
provider → return asset) is already in place.

## See also

* `docs/video-agent/ARCHITECTURE.md`
* `docs/video-agent/TESTING.md`
* `docs/audits/VIDEO-AGENT-CAPABILITIES-MIGRATION-MATRIX.md`
* `docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md`
