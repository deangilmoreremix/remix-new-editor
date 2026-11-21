# Studio tour videos

One captioned tour video per studio guide (`/studios/<slug>`), recorded with Playwright
from the real studio UI. Voiceover is a separate, later step; the videos work silent.

```
scripts/guide-videos/narration/<slug>.json     the script (one file per guide)   ← you edit these
tests/e2e/guide-targets/<slug>.json            which control each feature is (shared with guide screenshots)
tests/e2e/guide-videos.spec.js                 records the clips
scripts/guide-videos/assemble.mjs              joins clips → tour.mp4, poster.webp, captions.vtt
node_modules/.cache/guide-videos/<slug>/       output (git-ignored)
```

## Run it

```bash
npm run dev                                   # app on http://localhost:3100
npm run check:narration                       # validate every script against the guide data
GUIDES=image-studio npm run capture:videos    # record one studio (about 4 minutes)
npm run capture:videos                        # record all (GUIDE_WORKERS=3 for three at a time)
npm run assemble:videos                       # or: npm run assemble:videos -- image-studio
npm run assemble:videos -- --publish          # also copy tour.mp4 / poster.webp / captions.vtt to public/guides/<slug>/
```

`FORCE=1` re-records studios whose script and targets are unchanged (otherwise they are skipped).
`website-builder` and `video-pages` need services the capture machine may not have, so they are only
recorded when named: `GUIDES=website-builder,video-pages`.
Needs `ffmpeg` and `ffprobe` on the PATH. Nothing is generated or billed: the app runs with `?dev`
and the cursor never touches controls matched by `DANGEROUS` in `guide-screenshot-targets.js`.

## Script format

```json
{
  "slug": "image-studio",
  "name": "Image Studio",
  "intro": "12–40 words, names the studio and what it is for.",
  "features": { "<feature id from the guide>": "14–38 words: what the control is, why use it." },
  "outro": "8–35 words, different for every studio."
}
```

Feature order is the order they appear in the video. 4–10 features, at most 330 words in total.
Write for the ear: no symbols, URLs or emoji, numbers as spoken. The tour never generates anything, so
describe controls, not results. `npm run check:narration` enforces this.

If a feature's control is picked wrongly, fix it in `tests/e2e/guide-targets/<slug>.json`
(same format as the screenshot targets), and the guide screenshot gets fixed too.

## Adding voiceover later

Put one MP3 per line in `scripts/guide-videos/audio/<slug>/` named `intro.mp3`, `<feature-id>.mp3`,
`outro.mp3`, and the length of each in seconds in `durations.json` next to them:

```json
{ "intro": 7.2, "text-to-image": 9.8, "outro": 5.1 }
```

Then record again (`FORCE=1`) so each feature is held for exactly as long as its line is spoken, and
assemble: `assemble.mjs` places each MP3 at the start of its segment automatically.
Re-recording is only needed when durations change.
