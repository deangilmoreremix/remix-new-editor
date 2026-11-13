# Stage 2 website-background check

Verifies the whole chain with real components: **real capture engine → real editor → real preview → real exported MP4**.

```bash
# 1. Capture a site you own or have permission to use (default: https://smartvid.app/). Runs the REAL engine
#    (netlify/functions/_personalization/src/server/browserDiscovery.ts) and the REAL storage/response builders, with only the
#    Supabase bucket replaced by a local folder. Writes out/capture.json and out/capture/**.
npx tsx scripts/stage2-website-check/capture.mjs [url]
#    Only in a sandbox where direct internet egress is blocked (the engine dials sites directly, which is right on Netlify):
USE_SANDBOX_EGRESS=1 npx tsx scripts/stage2-website-check/capture.mjs [url]

# 2. Drive the editor + preview + exporter and assert on pixels (needs ffmpeg/ffprobe and a Chromium; set CHROMIUM_PATH if needed).
node scripts/stage2-website-check/check.mjs
```
It asserts: the capture client's job polling, the panel's controls, attribution, the live Player (fade-in, scroll, cursor, click ripple, hand-over to
the presenter video), the app's own exporter (ffprobe + decoded frames), preview/export agreement, an A/B click comparison, and scroll accuracy
against the ACTUAL captured screenshot. Output (videos, PNGs, captures) goes to `out/`, which git ignores.
