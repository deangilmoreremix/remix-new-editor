# Media Hub

Download video/audio from 1000+ sites (yt-dlp), transcribe with speaker labels, then summarize, translate or chat with the transcript. Inspired by VidBee; written from scratch.

- **UI:** `src/components/MediaHubPage.js` (route `#/media-hub`, Video menu) — themed with the app's primary color (neon yellow-green `--color-primary` on near-black).
- **API:** `/api/media-hub` → `backend/services/mediaHub/core.mjs` via `backend/services/mediaHubService.js` (one framework-agnostic `handleMediaHub(Request)` handler; the same file is used in both apps).
- **Auth:** every route needs a signed-in user and jobs are scoped to that user. Only signed file links (`/file/:id?t=…`, HMAC, 1 h) are token-authenticated so `<video>`/`<a>` can load them.

## Server requirements
`yt-dlp` and `ffmpeg`/`ffprobe` on PATH (or `YT_DLP_PATH`, `FFMPEG_PATH`, `FFPROBE_PATH`) and a long-running Node server.
Serverless hosts (e.g. Netlify functions) cannot run it — `GET /api/media-hub/status` and the header chip show what is missing.
Optional: `whisper` CLI (`WHISPER_PATH`) for local transcription.

| Env | Purpose |
|---|---|
| `MEDIA_HUB_DIR` | downloads, transcripts, `jobs.json` (default `~/.media-hub`) |
| `MEDIA_HUB_MAX_CONCURRENT` | parallel downloads (default 2) |
| `MEDIA_HUB_SECRET` | HMAC secret for file links (default: random per process — set it when running multiple instances) |
| `MEDIA_HUB_AI_KEY` / `OPENAI_API_KEY` | optional server-side fallback key |
| `MEDIA_HUB_ALLOW_PRIVATE=1` | allow localhost/private URLs and AI endpoints (dev / self-hosted only; off by default to block SSRF) |

## Features
- Queue with progress, speed, ETA; pause / resume / retry / cancel; batch links, playlists, video quality, MP4/MKV/WebM, audio (MP3/M4A/Opus/WAV/FLAC), subtitles, metadata/chapters.
- Transcription: OpenAI-compatible endpoint (`gpt-4o-transcribe-diarize` → speaker labels; `whisper-1` otherwise) or local Whisper CLI (no speakers). Long media is chunked (20 min); speaker labels are best-effort across chunks.
- Transcript view: search by text/speaker, click a line to seek, rename speakers, export TXT / MD / SRT / VTT / JSON.
- AI: summarize, key points, chapters, FAQ, mind map, clean-up, translate, and chat — OpenAI-compatible providers (OpenAI, Groq, DeepSeek, OpenRouter, Ollama, LM Studio…) or Anthropic. The user's key is stored in their browser only.

## Tests
`npm run test:media-hub` — URL/SSRF validation, yt-dlp argument building, progress parsing, transcript export, and a full download → transcribe → rename → AI flow against local mock servers (needs yt-dlp + ffmpeg; skipped otherwise).

Only download content you have the rights to.
