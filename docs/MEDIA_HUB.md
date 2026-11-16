# Media Hub (vendored upstream VidBee)

Media Hub is the **unmodified upstream [VidBee](https://github.com/nexmoe/VidBee)** API + web app (MIT, `apps/vidbee`, see `apps/vidbee/UPSTREAM.md`),
re-themed with this app's neon yellow-green palette and embedded at `#/media-hub` (Video menu).
Downloads (yt-dlp, 1000+ sites), queue, RSS subscriptions, settings and optional server-side auto-transcription are all upstream's code.

## Run it
```bash
# one-time: yt-dlp + ffmpeg must be on PATH; pnpm 11 required (apps/vidbee is its own pnpm workspace)
npm run vidbee:install && npm run vidbee:build
# env for the API: VIDBEE_API_PORT=3100 VIDBEE_DATA_DIR VIDBEE_DOWNLOAD_DIR VIDBEE_HISTORY_STORE_PATH
# env for the web: VIDBEE_WEB_PORT=3200 VIDBEE_API_URL_INTERNAL=http://127.0.0.1:3100
npm run vidbee:start
# Express backend (proxy/gate): VIDBEE_WEB_URL=http://127.0.0.1:3200  VIDBEE_ALLOWED_USERS="<user id or email>,…"
```

## Access control (important)
Upstream VidBee is single-tenant with **no login**, and it can browse server folders and change its download directory.
It is therefore only reachable through `backend/services/vidbeeProxy.js`: a signed-in user on `VIDBEE_ALLOWED_USERS` gets an 8 h
HttpOnly cookie scoped to `/vidbee`; everything else gets 401/403. With `VIDBEE_ALLOWED_USERS` unset, only `NODE_ENV=development` allows everyone.
All allowed users share one queue and library. Cross-site deployments (frontend and backend on different sites) need HTTPS (`SameSite=None; Secure`).

## Hosting
Needs long-running Node processes with yt-dlp + ffmpeg (self-hosted/Docker). Netlify functions cannot run it.
Transcription uses upstream's local sherpa-onnx models, downloaded on first use (needs internet access to the model hosts).

## Host patches to upstream
Listed in `apps/vidbee/UPSTREAM.md` (search `[host patch]`): optional sub-path (`VIDBEE_BASE_PATH=/vidbee`), a `host-theme.css` palette file, and the production start scripts.
## Transcripts + AI (host-added on top of upstream)
Upstream ships the transcript viewer and AI prompts only in its Electron desktop app, so the web version of this feature is host glue built on upstream's own pieces
(details in `apps/vidbee/UPSTREAM.md`): upstream's transcript store/queue/worker, its built-in prompts (Overview, Bullet points, Mindmap, Statistics, FAQ, Grammar, Paraphrase, Translate),
provider presets and exporters, with new `/hub/*` API routes and a **Transcripts** page in the sidebar.
- **Transcript:** transcribe a finished download (upstream's local speech models), click a line to seek, search by text or speaker, rename speakers, export TXT / MD / SRT / VTT.
- **AI:** run any built-in prompt or translate into a language code; a plain Q&A chat over the transcript. Configure the provider (OpenAI-compatible endpoints or Anthropic) under *AI settings* on the page.
  The key is stored on the server (`hub-ai-settings.json`, mode 600) and shared by everyone allowed to use Media Hub; it is never sent back to the browser.
- **Not ported:** the desktop's 9,600-line transcript UI and its agent runtime (tools, skills install, plugins, share cards, bilingual captions). The chat has no tools.
- Transcription models download on first use (internet needed). Tests here used upstream's built-in fake backend (`VIDBEE_TRANSCRIPTION_BACKEND=fake`) and a mock AI endpoint.
