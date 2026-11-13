# Heatmaps browser harness (Stage 7, local only, not CI)

Real Chromium (Playwright) + real Postgres 16 + the real `video-events.js` handler + the real client modules.

1. `mkdir -p /tmp/heat-e2e /tmp/heatq && cp entry-* /tmp/heat-e2e && node build.cjs` (esbuild bundles the watch-page capture and the React Heatmaps section).
2. Needs a local Postgres cluster running (the script creates DB `heat2` via `mkdb.sh`, which uses `su postgres`) and Playwright's Chromium: set the `executablePath` in `e2e.mjs` if your browser lives elsewhere.
3. `node e2e.mjs` — 6 viewer sessions are driven with real mouse clicks / scroll / playback, batches go through the handler into Postgres, owner RPCs are read back and rendered in the React section; also checks DNT, DPR canvas sizing, CSV download and the print stylesheet. Paths in the scripts are absolute to the author's sandbox; adjust as needed.
