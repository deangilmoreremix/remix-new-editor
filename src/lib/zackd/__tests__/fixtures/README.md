# Upstream parity fixtures

`upstream-fixtures.json` records what Anil-matcha/zack-d-films-ai-video-generator (MIT) sends to MuAPI (sheet,
keyframe, clip and narration requests for its `swallow_gum` example) and the ffmpeg filter graphs its `assemble.py`
builds for several clip layouts. `upstream-parity.test.js` asserts our builders reproduce them.

* `gen_fixtures.py <upstream_repo> <out.json>` regenerates the file. It is a hand transcription of the upstream
  logic; it does NOT import or run upstream code.
* `verify_against_source.py <upstream_repo>` reads the upstream files as plain text and checks every transcribed
  string and rule occurs verbatim in the source (exit code 1 on any miss).

Known, intentional differences: the image fallback endpoint is `flux-dev-image` (upstream's `flux-dev` 404s on
MuAPI); narration/music mixing, captions and the other looks are our opt-in extensions.
