# Stage 7 — thumbnails and GIFs: real-browser acceptance check

`node scripts/stage7-stills-check/check.mjs` (about 2 min; needs ffmpeg). In headless Chromium the thumbnail and GIF are made from the REAL composition through Remotion web renderer, then decoded with ffmpeg (an independent GIF/JPEG reader) and compared with the source video frames:

* every GIF frame shows the colour of the source at its moment (the old encoder got frames 2+ wrong); the personalized headline is in every frame; a different recipient makes a different GIF; the same inputs give identical bytes; loop flag; clipping at the video end; size under 1 MB;
* the automatic thumbnail avoids a black first second, is a real JPEG/PNG of the right size, shows the video own picture at a manual frame, draws the play button only in the middle;
* the legacy thumbnail-studio encoder (src/lib/gifEncoder.js) now produces correct frames;
* the real editor: create, preview, download GIF and JPG.

`out/` is git-ignored.
