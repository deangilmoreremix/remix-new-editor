# Heatmaps browser harness (Stage 7, local only, not CI)

Real Chromium (Playwright) + real Postgres 16 + the real `video-events.js` handler + the real client modules.

1. `mkdir -p /tmp/heat-e2e /tmp/heatq && node build.cjs` (esbuild bundles the watch-page capture and the React Heatmaps section; it copies `entry-*` to `$HEAT_S` (default `/tmp/heat-e2e`) replacing `__ROOT__` with this repo's root; env `DB`, `HEAT_S`, `HEAT_Q` select the database / scratch dirs).
2. Needs a local Postgres cluster running (the script creates DB `heat2` via `mkdb.sh`, which uses `su postgres`) and Playwright's Chromium: set the `executablePath` in `e2e.mjs` if your browser lives elsewhere.
3. `node e2e.mjs` — 6 viewer sessions are driven with real mouse clicks / scroll / playback, batches go through the handler into Postgres, owner RPCs are read back and rendered in the React section; also checks DNT, DPR canvas sizing, CSV download and the print stylesheet. Paths are repo-relative (Stage 10); only the Chromium `executablePath` is machine specific.

## watch-real.mjs (real `WatchPage.jsx`, Stage 9)
Drives the REAL watch page through the vite dev server; only the network layer is mocked (Playwright routes): the Supabase `get_published_video` RPC (an https host so the page CSP allows it), the media file (byte-range capable) and `/api/video-events` (recorded). The recorded batches are fed to the real `video-events.js` handler and a local Postgres 16 (`mkdb.sh`), and the owner RPCs are read back.
```
ffmpeg -y -f lavfi -i testsrc2=s=320x180:r=15:d=10 -c:v libvpx -b:v 120k -g 15 -an /tmp/watchreal/clip.webm
VITE_SUPABASE_URL=https://supa.test VITE_SUPABASE_ANON_KEY=x npx vite --port 3140 --strictPort &
node tests/browser-harness/heatmaps/watch-real.mjs      # env: VITE_PORT, MEDIA, CHROME, DB, OUT
```

Stage 10 (Fix F): `watch-real.mjs` also presses Play IMMEDIATELY after load (big-play overlay, control-bar button, Space) before the Remotion player exists
(asserts the press happened with no `.__remotion-player` in the stage, a pending spinner (`data-play-pending`) is shown, playback starts by itself, one play-through range starting at 0,
`watch_buckets` sent). A press lost to the wiring race fails every attempt of that check. Run it with `OUT=/tmp/watchF DB=heatF VITE_PORT=<port>` to keep your scratch dirs apart from other runs.

## watch-campaign.mjs (Stage 11, Fix P)
Real `WatchPage.jsx` in real Chromium with `?cr=<recipient token>` links; the batches the page sends are pushed through the real `netlify/functions/video-events.js` handler (including `attribute_video_session_campaign`) into a local Postgres built by `mkdb-campaign.sh`. Seven viewers: valid token, another owner's token, garbage, malformed, none, owner A's token on owner B's video, owner B's own token. Asserts the stored `campaign_id`, that the handler answer is identical in every case and that no token is stored.
```bash
VITE_SUPABASE_URL=https://supa.test VITE_SUPABASE_ANON_KEY=x npx vite --port 3141 --strictPort &
node tests/browser-harness/heatmaps/watch-campaign.mjs        # env: VITE_PORT, MEDIA, CHROME, DB, OUT, CAMPAIGNS_MIGRATION=<campaigns branch migration file> for the real schema
```
