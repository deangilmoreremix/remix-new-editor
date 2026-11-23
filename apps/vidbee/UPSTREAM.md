# Vendored: VidBee desktop app (https://github.com/nexmoe/VidBee)

MIT-licensed upstream code (see `LICENSE`) from commit `6542ebd`, **run as a web app**:
- the **unmodified desktop renderer** (`apps/desktop/src/renderer`) built with plain Vite and served to the browser;
- the **unmodified desktop main process** (`apps/desktop/src/main`, including `index.ts` and every IPC service) running in Node
  behind an HTTP/SSE bridge, with `electron` replaced by a small shim;
- the workspace packages it depends on (`db`, `downloader-core`, `i18n`, `logger`, `subscriptions-core`, `task-queue`, `transcription`, `ui`) and `skills/`;
- upstream's other apps, **unmodified**: `apps/api` + `apps/web` (standalone browser edition), `apps/cli` and `apps/extension`, plus its `docker-compose.yml`. They build with `npm run build:api|build:web|build:cli|build:extension` from this folder.
  The CLI and the extension talk to the desktop host through upstream's local extension API (port 27100, `automation.json`), which the host server starts like the desktop does.

So the screens, features, downloads, transcripts with speaker labels, AI prompts/chat/agent, RSS subscriptions and settings are upstream's own code.

## Host layer (new files, `apps/desktop/host/`)
| File | Purpose |
|---|---|
| `server.ts` | Imports upstream's `main/index.ts`; HTTP bridge: `POST /ipc/invoke`, `POST /ipc/send`, `GET /ipc/events` (SSE), `GET /media` (Range, download folders only), `GET /protocol/<scheme>/…` (calls the `vidbee://` / `agent-artifact://` handlers upstream registered), static renderer, optional `VIDBEE_BASE_PATH`, optional `VIDBEE_CSP_IMG_SRC`, `POST /upload` (picked/dropped files → server), `GET /host/list` (server folder picker), `GET /exports/…` (saved files → browser download), optional `VIDBEE_ACCESS_TOKEN` (refuses non-loopback binds without it) |
| `electron-stub.mjs` | `electron` stand-in: `ipcMain` handler map, fake window whose `webContents.send` feeds SSE, and browser-backed `dialog` (open → picker + upload, save → download, message → modal), `shell` (open in new tab), `clipboard`, `Notification`, `nativeImage`, `protocol` |
| `web-shim.js` | Replaces the Electron preload in the browser: `window.electron.ipcRenderer` + `window.api` over HTTP/SSE; rewrites `vidbee://` / `agent-artifact://` URLs to the host's `/protocol/…` route |
| `electron-log-stub.mjs`, `electron-toolkit-stub.mjs`, `electron-updater-stub.mjs`, `better-auth-electron-stub.mjs`, `ga4-renderer-stub.js` | Inert stand-ins for Electron-only/telemetry modules (no analytics, crash reporting, auto-update or cloud sign-in) |
| `build-host.mjs`, `vite.web.config.ts` | esbuild bundle of the main process + workers; Vite build of the renderer (mirrors upstream's electron-vite renderer config) |
| `docker/` | Dockerfile + compose for the browser host (**not tested**: no Docker in the build sandbox) |
| `demo/` | Optional demo tooling for feature screenshots (seed data, throttled live downloads, local RSS feeds, a stand-in AI provider, `capture.cjs`); not used in normal operation |
| `setup-binaries.mjs` | Links the server's yt-dlp / ffmpeg / ffprobe / node into `resources/` (upstream bundles them for Electron) |

## Rebrand (`brand/`, not upstream)
Shown in SmartVid as **SmartVidDownloader**. `brand/rebrand.mjs` rewrites user-facing text at build time (hooked into `host/vite.web.config.ts` and `host/build-host.mjs`; `VIDBEE_BRAND=off` disables it) and hides the VidBee Cloud / GitHub sign-in UI, so the upstream files below stay untouched. See `brand/README.md`.

## `[host patch]` edits to upstream files
- `src/renderer/src/lib/local-file-src.ts`: media URLs use the host `/media` route instead of `file://`.
- (only with `HOST_THEME=1`) `src/renderer/src/assets/global.css` + new `host-theme.css`: remix neon palette (light + dark).
- (only with `HOST_THEME=1`) `packages/ui/src/components/ui/{button,sonner}.tsx`, `agent-chat-composer.css`: outlined, transparent buttons.
- (only with `HOST_THEME=1`) `packages/ui/src/components/ui/title-bar.tsx` (+`extra` slot), `src/renderer/src/components/ui/title-bar.tsx` and new `host-theme-toggle.tsx`: Light/Dark/System switch in VidBee's own title bar.
- (only with `HOST_THEME=1`) `host/web-shim.js` syncs upstream's theme setting (default dark; `?theme=` / postMessage from the embedding page).
- `package.json` (desktop): `electron-ga4-telemetry` removed (telemetry), scripts replaced; workspace files trimmed.

- `packages/downloader-core/src/types.ts`: `DownloadRuntimeSettings` gains the optional `downloadWithoutChannelSubfolders` and `downloadMirror` fields that
  `DownloadRuntimeSettingsSchema` already defines (upstream's web client did not type-check without them).
- `apps/web/server.mjs`: `/export` and `/stream` are added to the paths proxied to the API (needed by video export and live AI streaming).
- `pnpm-workspace.yaml`: `onnxruntime-node: false` (the Node binding is not used; browser Whisper uses onnxruntime-web).

## Changed in the web client
- `apps/web/src/components/pages/download-page.tsx`: the cookies banner button asked for `history.cookiesTipAction`, which no locale defines (they define `history.cookiesTipCta`), so it showed the raw key. It now uses `history.cookiesTipCta`.

## Added for the web edition (not upstream)
Transcripts, AI summaries, chat, translation and `GET /stream` in `apps/api` and `apps/web` (see `docs/VIDBEE_WEB_TRANSCRIPTS_AI.md`),
plus `packages/transcription/src/web-contract.ts`.

## Not available in the web port
Native window/tray/dock/auto-update/protocol handlers and VidBee Cloud sign-in (removed). **Share-image / diagram-image rendering** (`main/lib/share-capture-window.ts`) screenshots a hidden Electron window via offscreen paint events and raw bitmaps; it needs a headless Chromium on the server and is not ported.
File pickers, drag-and-drop, exports, open/show-in-folder, clipboard and notifications are implemented by the browser (see the host table).
Transcription models and yt-dlp updates download from the internet on first use.

## Updating
Re-run the vendor script against a newer upstream checkout and re-test; `git diff` shows exactly what changed.
