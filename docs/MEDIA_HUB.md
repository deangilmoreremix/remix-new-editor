# Media Hub (VidBee desktop app, run as a web app)

Media Hub is **upstream's VidBee desktop app** ([nexmoe/VidBee](https://github.com/nexmoe/VidBee), MIT) vendored in `apps/vidbee` and served to the browser, **looking exactly like upstream**
(light theme, orange accent, upstream's buttons and layout). Every screen and feature is upstream's own code: downloads queue, transcript viewer with speaker labels, the AI skills
(Overview, Bullet Points, Mindmap, FAQ, translate, …), the AI Chat agent, RSS subscriptions and Settings.

**Fidelity check** (byte-for-byte against the upstream repo at commit `6542ebd`): 520 of the 521 source files in the desktop app's `main`, `renderer` and `shared` folders are identical,
and `packages/`, `skills/` and `patches/` have zero differences. The one changed file is `src/renderer/src/lib/local-file-src.ts` (browsers can't load `file://` URLs, so media goes through the host's `/media` route).
Everything else added is in `apps/vidbee/apps/desktop/host/` (see `apps/vidbee/UPSTREAM.md`). Mounted at `#/media-hub` (Video menu), as an iframe of `/vidbee/`.

An optional palette/button re-theme exists (`HOST_THEME=1 PRIMARY=… python3 vendor.py`) but is **off**; the default is upstream's own look.

## Feature screenshots
`docs/media-hub-screenshots/compare-*.png` put upstream's official screenshots (from the upstream repo's `screenshots/`, the images used on vidbee.org) next to the same screens in this app:
downloads queue with a live progress row, transcript with four speakers, AI "Bullet Points" summary, RSS subscriptions, transcript search. `ours-*.png` are the raw captures.
vidbee.org itself could not be opened from the build sandbox, so the upstream repo's screenshots were the reference. Titles, people, thumbnails and text in the captures are **invented demo data**
(`apps/vidbee/apps/desktop/host/demo/`: seeded downloads and transcript, a throttled local download for real progress/speed, local RSS feeds, a stand-in AI provider). The sidebar labels differ from the reference
because those images come from another upstream build ("Download / Transcripts / RSS" vs "Home / Chat / Subscribe" at the vendored commit).

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
The bridge binds to 127.0.0.1 by default; expose it only through the gate.

## What differs from the Electron app
No window chrome, tray, dock, auto-update or OS protocol handlers; local-path drag-and-drop becomes browser file drop (uploaded to the server); VidBee Cloud sign-in, analytics and crash reporting are removed.
Upstream's custom `vidbee://` / `agent-artifact://` URLs (cached thumbnails, chat artifacts) are served through the host's `/protocol/…` route using the handlers upstream registered.
Upstream's Content-Security-Policy is kept as shipped (`VIDBEE_CSP_IMG_SRC` can extend its image sources, used only for the demo). Needs a long-running Node host (not serverless).
Transcription models and yt-dlp updates download from the internet on first use.

## Tested
In a real browser through the access gate: add URL → download → transcript with speakers → AI skill via upstream's runner; Chat, Subscribe, Settings and About load without errors.
Real speech models and a real AI provider were not available in the sandbox (upstream's fake transcription backend and a stand-in provider were used). `npm run test:vidbee-gate` covers the gate.

## Everything upstream ships is vendored
`apps/vidbee/apps/` now holds all of upstream's apps, unmodified: `desktop` (served here), `api` (REST/Nitro), `web` (the upstream web edition), `cli` and `extension` (browser extension), plus
upstream's `docker-compose.yml` and `biome.json`. Root scripts: `build:api|web|cli|extension`, `start:api|web`. All of them build with zero errors. The `dist/`, `.output/`, `.wxt/` build folders are gitignored.

## Browser backend (round trips the desktop app does natively)
The host bridges Electron-only calls to the browser instead of stubbing them:
- **File / folder pickers**: `dialog.showOpenDialog` opens a browser file picker; the file is uploaded and the server path is returned to upstream's code. Folder picking uses a server-side folder browser.
- **Drag and drop**: dropped `File`s are uploaded when an IPC call uses them.
- **Exports** (transcripts, subtitles, …): `showSaveDialog` writes under the data dir and the browser downloads the file.
- **Open file/URL, clipboard, notifications, message boxes**: routed to browser equivalents (new tab, Clipboard API, Notification API, modal).
- **CLI**: upstream's CLI connects to the host through upstream's automation descriptor and creates tasks.

## Standalone use and Docker
`VIDBEE_ACCESS_TOKEN` gates the bridge when it is run without the Next/Express gate (`?token=` once, then a cookie; Bearer also works). The server refuses to listen on a non-loopback address
without a token (or `VIDBEE_ALLOW_OPEN=1`). `apps/desktop/host/docker/` has a Dockerfile and compose file; **they have not been built or run**.

## Not ported
Share-image / diagram capture (`main/lib/share-capture-window.ts`) needs Electron's offscreen rendering and is not available. Not exercised here (no internet in the sandbox): real speech models, a real AI provider,
real video sites, Docker.
