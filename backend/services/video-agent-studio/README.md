# backend/services/video-agent-studio — OUT OF SCOPE for the full-application integration

This directory was created during an earlier attempt to integrate
the OpenChatCut-derived Video Agent Studio 2 into SmartVideo's own
backend (project repository, media store, generation adapter,
credit ledger, event bus, HTTP router).

The current Video Agent Studio 2 integration strategy is **iframe
embed only** (see `docs/video-agent/ARCHITECTURE.md`,
`docs/video-agent/OPENCHATCUT-MIGRATION.md` and
`src/components/VideoAgentStudioShell.js`). The complete OpenChatCut
application — including its own backend, project store, media
processing, generation services, transcription services, export
services, FFmpeg integration, Remotion integration, and MCP endpoint
— runs as its own application inside the iframe. SmartVideo does
not route any timeline, media, project, generation, or export data
across the iframe boundary.

This directory is therefore **outside the full-application
integration path**. The code here is preserved (not deleted) so
historical context is available, but:

* It is NOT mounted in `backend/server.js` (reverted; the
  `/api/video-agent-studio` Express router is no longer wired in).
* No production deployment depends on it.
* The 32 Jest tests under `backend/__tests__/video-agent-studio/`
  still pass against the in-memory adapters for historical /
  contract reference, but they do not exercise the iframe path.

If a future strategy requires SmartVideo-side adapters again, the
modules in this directory are the starting point.
