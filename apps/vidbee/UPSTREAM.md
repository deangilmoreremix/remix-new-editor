# Vendored: VidBee desktop app (https://github.com/nexmoe/VidBee)

MIT-licensed upstream code (see `LICENSE`) from commit `6542ebd`, **run as a web app**:
- the **unmodified desktop renderer** (`apps/desktop/src/renderer`) built with plain Vite and served to the browser;
- the **unmodified desktop main process** (`apps/desktop/src/main`, including `index.ts` and every IPC service) running in Node
  behind an HTTP/SSE bridge, with `electron` replaced by a small shim;
- the workspace packages it depends on (`db`, `downloader-core`, `i18n`, `logger`, `subscriptions-core`, `task-queue`, `transcription`, `ui`) and `skills/`.

So the screens, features, downloads, transcripts with speaker labels, AI prompts/chat/agent, RSS subscriptions and settings are upstream's own code.

## Host layer (new files, `apps/desktop/host/`)
| File | Purpose |
|---|---|
| `server.ts` | Imports upstream's `main/index.ts`; HTTP bridge: `POST /ipc/invoke`, `POST /ipc/send`, `GET /ipc/events` (SSE), `GET /media` (Range, download folders only), static renderer, optional `VIDBEE_BASE_PATH` |
| `electron-stub.mjs` | `electron` stand-in (`ipcMain` handler map, fake window whose `webContents.send` feeds SSE, `app.getPath`, …) |
| `web-shim.js` | Replaces the Electron preload in the browser: `window.electron.ipcRenderer` + `window.api` over HTTP/SSE |
| `electron-log-stub.mjs`, `electron-toolkit-stub.mjs`, `electron-updater-stub.mjs`, `better-auth-electron-stub.mjs`, `ga4-renderer-stub.js` | Inert stand-ins for Electron-only/telemetry modules (no analytics, crash reporting, auto-update or cloud sign-in) |
| `build-host.mjs`, `vite.web.config.ts` | esbuild bundle of the main process + workers; Vite build of the renderer (mirrors upstream's electron-vite renderer config) |
| `setup-binaries.mjs` | Links the server's yt-dlp / ffmpeg / ffprobe / node into `resources/` (upstream bundles them for Electron) |

## `[host patch]` edits to upstream files
- `src/renderer/src/lib/local-file-src.ts`: media URLs use the host `/media` route instead of `file://`.
- `src/renderer/src/assets/global.css` + new `host-theme.css`: SmartVideo (neon yellow-green) palette (dark).
- `packages/ui/src/components/ui/{button,sonner}.tsx`, `agent-chat-composer.css`: outlined, transparent buttons (the host studios' button language) instead of solid fills.
- `host/web-shim.js` keeps the `.dark` class on `<html>` (the palette is dark-only).
- `package.json` (desktop): `electron-ga4-telemetry` removed (telemetry), scripts replaced; workspace files trimmed.

## Not available in the web port
Native window/tray/dock/auto-update/protocol handlers, file pickers and drag-drop of local paths (browsers don't expose them), VidBee Cloud sign-in.
Transcription models and yt-dlp updates download from the internet on first use.

## Updating
Re-run the vendor script against a newer upstream checkout and re-test; `git diff` shows exactly what changed.
