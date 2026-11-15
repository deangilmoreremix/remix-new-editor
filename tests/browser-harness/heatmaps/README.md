# Heatmaps browser harness (Stage 7, local only, not CI)

Real Chromium (Playwright) + real Postgres 16 + the real `video-events.js` handler + the real client modules.

1. `mkdir -p /tmp/heat-e2e /tmp/heatq && cp entry-* /tmp/heat-e2e && node build.cjs` (esbuild bundles the watch-page capture and the React Heatmaps section).
2. Needs a local Postgres cluster running (the script creates DB `heat2` via `mkdb.sh`, which uses `su postgres`) and Playwright's Chromium: set the `executablePath` in `e2e.mjs` if your browser lives elsewhere.
3. `node e2e.mjs` — 6 viewer sessions are driven with real mouse clicks / scroll / playback, batches go through the handler into Postgres, owner RPCs are read back and rendered in the React section; also checks DNT, DPR canvas sizing, CSV download and the print stylesheet. Paths in the scripts are absolute to the author's sandbox; adjust as needed.

## watch-real.mjs (real `WatchPage.jsx`, Stage 9)
Drives the REAL watch page through the vite dev server; only the network layer is mocked (Playwright routes): the Supabase `get_published_video` RPC (an https host so the page CSP allows it), the media file (byte-range capable) and `/api/video-events` (recorded). The recorded batches are fed to the real `video-events.js` handler and a local Postgres 16 (`mkdb.sh`), and the owner RPCs are read back.
```
ffmpeg -y -f lavfi -i testsrc2=s=320x180:r=15:d=10 -c:v libvpx -b:v 120k -g 15 -an /tmp/watchreal/clip.webm
VITE_SUPABASE_URL=https://supa.test VITE_SUPABASE_ANON_KEY=x npx vite --port 3140 --strictPort &
node tests/browser-harness/heatmaps/watch-real.mjs      # env: VITE_PORT, MEDIA, CHROME, DB, OUT
```
