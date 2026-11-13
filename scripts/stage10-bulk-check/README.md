# Stage 10 — bulk personalization: real-browser acceptance check

`node scripts/stage10-bulk-check/check.mjs` (about 1–2 min; needs ffmpeg, ffprobe, unzip, python3).

Real headless Chromium, real IndexedDB, the real composition and the real batch runner. A CSV becomes a batch; each recipient gets a
thumbnail, a GIF and an MP4 made from their own copy of the design. The batch is interrupted in the middle of a recipient, the page is
closed and reopened, and the batch is resumed. The ZIP is then verified by independent tools (`unzip -t`, Python `zipfile`, `ffprobe`,
`ffmpeg`): every file is real media, each recipient has their own headline, recipient 1's thumbnail equals the ordinary single-video
thumbnail with the name typed in, and the manifest is spreadsheet-safe. A second scenario repeats the interruption in a private-window
profile, where stored files can disappear, and checks that the repair loop yields a complete, readable package.

`out/` is git-ignored.
