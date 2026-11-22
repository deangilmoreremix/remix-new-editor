# Smartvid Downloader web edition: what it needs to run

**Code:** folder `apps/smartvid` in this repository (the same folder is in `deangilmoreremix/remix-new-editor` and `deangilmoreremix/OpenHiggsBolt`).
Everything below is relative to `apps/smartvid`.

## Services (see `docker-compose.yml`)
| Service | Dockerfile | Port | What it is |
| --- | --- | --- | --- |
| `api` | `apps/api/Dockerfile` | **3100** (`SMARTVID_API_PORT`, host `SMARTVID_API_HOST`) | Node 22 + Fastify. Downloads (yt-dlp), queue, transcription, AI endpoints, `GET /health`. |
| `web` | `apps/web/Dockerfile` | **3000** (`SMARTVID_WEB_PORT`) | TanStack Start/Vite, run with `node server.mjs`. Serves the pages and proxies `/rpc`, `/events`, `/files`, `/images`, `/stream`, `/export` to the API at `SMARTVID_API_URL_INTERNAL` (e.g. `http://api:3100`). |

The browser only talks to `web`. `api` can stay private.

## Runtime requirements
- Node 22, pnpm 11 (build only). `yt-dlp` and `ffmpeg`/`ffprobe` binaries (set `YTDLP_PATH`, `FFMPEG_PATH`). Burned-in subtitles also need ffmpeg built with libass and a font.
- **Persistent disk, two paths:** `SMARTVID_DOWNLOAD_DIR` (default `/data/downloads`) and `SMARTVID_DATA_DIR` (default `/data/smartvid`: SQLite `smartvid.db`, settings, downloaded speech models, `ai-settings.json`, `ai-prompts.json`). Losing it loses the library.
- **No Postgres, no Redis, no GPU.** SQLite (native module `better-sqlite3`) and an in-process task queue; speech recognition is CPU (sherpa-onnx).
- Outbound internet: sites to download from, yt-dlp self-update (writes `$SMARTVID_DATA_DIR/bin`), speech-model downloads on first use, and the OpenAI API.
- Single instance only: SQLite and the queue are in-process, live AI runs are held in memory, and `/stream` is long-lived server-sent events. Do not scale to zero while jobs run, and allow long requests (`/export/video` can take minutes).

## Environment
| Variable | Purpose |
| --- | --- |
| `SMARTVID_API_PORT`, `SMARTVID_API_HOST` | API listen address |
| `SMARTVID_DOWNLOAD_DIR`, `SMARTVID_DATA_DIR` | the two persistent paths |
| `SMARTVID_PERSIST_QUEUE=1` | keep the queue in SQLite |
| `SMARTVID_MIGRATIONS_DIR` | `apps/desktop/resources/drizzle` (set in the image) |
| `SMARTVID_SKILLS_DIR` | folder of AI prompt files, `skills/` (set in the image) |
| `SMARTVID_API_URL_INTERNAL`, `SMARTVID_WEB_PORT`, `SMARTVID_WEB_HOST`, `SMARTVID_ALLOWED_HOSTS` | web service (`SMARTVID_ALLOWED_HOSTS` only matters for the Vite host check behind a proxy) |
| **`OPENAI_API_KEY`** (secret) | OpenAI key for summaries, chat, translation. Optional: it can also be typed in the UI, which stores it in the data volume. |
| `OPENAI_BASE_URL`, `SMARTVID_OPENAI_MODEL` | optional (default `https://api.openai.com/v1`, `gpt-4.1-mini`) |
| `SMARTVID_AI_LOCK_SETTINGS=1` | recommended when the API is reachable by anyone but you: stops the browser changing the key, model or base URL |
| `SMARTVID_AI_MAX_TRANSCRIPT_CHARS` | optional cap (default 400000) |
| `SMARTVID_TRANSCRIPTION_BACKEND` | leave unset in production (`fake` is for tests) |

## Security
The API and web edition have **no login** (as upstream). Anyone who can reach them can queue downloads, read downloaded files, and spend the OpenAI key. Put them behind your own auth or keep them private. (The Smartvid Downloader tab in the apps has its own gate; this web edition does not.)

## Checked and not checked
- Checked: in a clean copy of the tree, the builder stage of both Dockerfiles (frozen-lockfile install, build, `pnpm deploy`); the built API bundle ran and served `/health`, the AI, transcript, chat, translate and `/stream` endpoints; the production web server proxied pages, `/rpc`, `/stream`, `/export` and range requests.
- **Not checked:** the images themselves were never built (no Docker daemon in the build sandbox), so Alpine/musl behaviour of the native modules (`better-sqlite3`, `sherpa-onnx-node`), the font package names, and real speech-model downloads are unverified.
