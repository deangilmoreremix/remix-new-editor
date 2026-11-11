# Vendored CineGen source

Files under `src/cinegen/` are copied from https://github.com/deangilmoreremix/CineGen
(MIT) with the smallest changes needed to run in the browser inside the Timeline Editor:

- `@/` imports become `@cinegen/` (see `vite.config.js` / `vitest.config.js`).
- Electron IPC (`window.electronAPI`) is replaced by `src/cinegen/adapters/`.
- fal calls go to MuAPI, LLM calls to the OpenAI Responses API (`/api/timeline-llm`),
  images to OpenAI Images 2.6 — all on the user's own keys. No fal. No Render.

Every other change to a vendored file is marked with a `// [remix]` comment.
