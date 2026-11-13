# Stage 4 — audio mix: real-browser acceptance check

`node scripts/stage4-audio-check/check.mjs` (≈ 2 min; needs ffmpeg/ffprobe/libmp3lame). Builds deterministic fixtures with ffmpeg (speech-like band-limited noise bursts with a faint 40 Hz rumble and a 2.5 kHz tone over the sample person clip; music with a 6 kHz lead, a 330 Hz pad and a 60 Hz kick at 120 BPM), then in headless Chromium:

* measures the sources in the browser (loudness vs ffmpeg, tempo, quiet gaps);
* bakes the real mix (Web Audio decode, IndexedDB store, reuse, error on a missing file);
* exports with the app's own exporter and measures the MP4s independently: EBU R128 integrated loudness (ffmpeg `ebur128`), correlation/lag against the offline mixdown, ducking depth and timing (Goertzel on the music's own tone), EQ (Goertzel/band filters), fades, peak ceiling, stale-mixdown handling, silence;
* drives the real editor panel and checks the preview Player switches between sources and mixdown (`data-audio-source`).

`out/` is git-ignored.
