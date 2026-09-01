# backend/routes/video-agent-studio — OUT OF SCOPE for the full-application integration

This router was created during an earlier attempt to integrate the
OpenChatCut-derived Video Agent Studio 2 into SmartVideo's own
backend. It is preserved here for historical context.

The current integration strategy is **iframe embed only** — see
`docs/video-agent/ARCHITECTURE.md`. The complete OpenChatCut
application runs as its own application inside the iframe, and
SmartVideo does not proxy any timeline, media, project, generation
or export commands across the iframe boundary.

This router is therefore **not mounted in `backend/server.js`**
(reverted). The 32 Jest tests under
`backend/__tests__/video-agent-studio/` still pass for reference,
but they do not exercise the iframe path.

See `backend/services/video-agent-studio/README.md` for the wider
context.
