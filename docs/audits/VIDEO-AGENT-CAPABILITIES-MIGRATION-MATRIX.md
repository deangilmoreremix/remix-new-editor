# Video Agent Studio 2 — Capability migration status

> With the new iframe-embed strategy, **no Studio 1 capability is
> being migrated into Studio 2**. Video Agent Studio 2 is a
> complete, independent application. This matrix is preserved as
> a status reference for Studio 1, not as an active migration
> plan.

| Studio 1 capability | Studio 1 implementation | Studio 2 equivalent | Migration action | Status |
| --- | --- | --- | --- | --- |
| (none) | (none) | n/a | n/a | Studio 2 is the complete OpenChatCut application, not a migration of Studio 1. |

## What this means

* Studio 1 continues to be the user-facing entry at the
  `video-agent` route (`src/components/VideoAgentPage.js`).
* Studio 1's backend (`backend/services/videoAgentService.js`,
  mounted at `/videoagent`) continues to work.
* Studio 1's tools (scene detection, highlight detection,
  subtitles, profanity removal, storyboarding, text-to-video,
  faceless video, AI ad films, voice cloning, dubbing,
  clip segmentation, color correction, upscale, stabilize,
  etc.) continue to be reachable through Studio 1's UI.
* Studio 2 (route `video-agent-studio`) is a separate, complete
  application. It is the iframe-embedded OpenChatCut app.
* The two are independent. A user can use Studio 1 for one task
  and Studio 2 for another in the same session.

## Why this is the right call

The earlier integration attempt tried to migrate Studio 1's
capabilities into a SmartVideo-side adapter layer so that Studio
2 could call them. That approach was abandoned because it would
have required reimplementing OpenChatCut features inside
SmartVideo, which violates the "OpenChatCut is the complete
application" constraint. The current iframe-embed strategy keeps
OpenChatCut intact and lets each studio serve its own audience.
