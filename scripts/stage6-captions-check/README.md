# Stage 6 — captions, transcription, scene detection: real-browser acceptance check

`node scripts/stage6-captions-check/check.mjs` (about 3 min; needs ffmpeg, espeak-ng and internet for the Whisper model). Builds fixtures with ffmpeg (a grey video with synthesized speech, clips with known cuts, a static clip, a slow cross-fade, continuous motion, HEVC and VP9), then in headless Chromium:

* SRT/VTT import/export round trip and refusal of empty, binary and oversized files;
* captions measured IN THE EXPORTED PIXELS: present exactly while their page is up and absent in pauses, word highlight position moving left to right, top/middle/bottom thirds, size following the frame height, boxed preset, hostile markup shown as text, captions off;
* real Whisper transcription of the synthesized speech: word error rate, word spans against the audio own activity, captions lining up with speech in the export;
* real scene scan (cuts found at the right time, thumbnails, no false cuts on static/fade/motion clips) and codec probe;
* the real editor: file import, cue edit, Player vs export parity, SRT download.

`out/` is git-ignored.
