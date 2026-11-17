# Media Hub (VidBee desktop app, run as a web app)

Media Hub is **upstream's VidBee desktop app** ([nexmoe/VidBee](https://github.com/nexmoe/VidBee), MIT) vendored in `apps/vidbee` and served to the browser:
the unmodified desktop **renderer** (every screen: Home/downloads, Transcript viewer with speaker labels, Overview / Mindmap / FAQ and the other AI skills,
translate, the AI **Chat** agent, Subscribe/RSS, Settings) plus the unmodified **main process** running in Node behind a small HTTP/SSE bridge.
Only colors and buttons differ from upstream: neon yellow-green (`#d9ff00`) on black with the outlined button style of our studios. Full list of host files and patches: `apps/vidbee/UPSTREAM.md`.

Mounted at `#/media-hub` (Video menu), as an iframe of `/vidbee/`.

## Run it
Needs yt-dlp, ffmpeg/ffprobe and node on the server, and pnpm 11.
```bash
npm run vidbee:install     # pnpm install (Electron binary download skipped)
npm run vidbee:setup       # links the server's yt-dlp / ffmpeg / ffprobe / node into apps/vidbee/apps/desktop/resources
npm run vidbee:build       # esbuild (main process + workers) + Vite (renderer), base path /vidbee
npm run vidbee:start       # VIDBEE_PORT=3300 VIDBEE_DATA_DIR=… VIDBEE_DOWNLOAD_DIR=…  (optional: VIDBEE_HOST, VIDBEE_BASE_PATH)
# Express backend: VIDBEE_WEB_URL=http://127.0.0.1:3300 VIDBEE_ALLOWED_USERS="<user id or email>,…"
```

## Access control (important)
Upstream VidBee is single-user and has no login; it can browse server folders, change its download directory and run an AI agent with tools.
The host server is therefore only reachable through `backend/services/vidbeeProxy.js` (Supabase JWT + cookie session). Everything except the built static assets requires a signed-in, allow-listed user
(`VIDBEE_ALLOWED_USERS`, user id or email; unset = everyone only in `NODE_ENV=development`). All allowed users share one library, queue, AI provider key and agent history.
The bridge binds to 127.0.0.1 by default — keep it that way and expose it only through the gate.

## What differs from the Electron app
Window chrome, tray, dock, auto-update, protocol handlers and native file pickers don't exist in a browser; local-path drag-and-drop is unavailable; VidBee Cloud sign-in, analytics and crash reporting are removed.
Media plays through a `/media` route limited to the download folders. Needs a long-running Node host (not serverless).
Transcription models and yt-dlp updates download from the internet on first use.

## Tested
In a real browser through the gate with upstream's own fake transcription backend (`VIDBEE_TRANSCRIPTION_BACKEND=fake`) and a mock OpenAI-compatible provider: add URL → download → transcript with speakers →
Overview via upstream's AI runner; Chat, Subscribe, Settings and About load without errors. Real speech models and a real AI provider were not available in the sandbox.
`npm run test:vidbee-gate` covers the access gate.
