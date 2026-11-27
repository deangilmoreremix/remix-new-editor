# Recording engine (ported from Remotion Recorder)

The Video Outreach studio and `RecorderModal` record with code ported from
[Remotion Recorder](https://github.com/remotion-dev/recorder) at commit `4c09934`
(docs: https://www.remotion.dev/docs/recorder).

| File | Ported from | What it does |
|---|---|---|
| `codec.js` | `src/helpers/find-good-supported-codec.ts` | MP4 (H.264/AAC) first, then WebM (VP8/Opus) |
| `streams.js` | `src/helpers/get-video-stream.ts` | Camera, screen and microphone streams with exact device ids |
| `devices.js` | `src/helpers/enumerate-devices-or-time-out.ts`, `get-devices.ts` | Device lists, with a timeout |
| `fileStorage.js` | `src/helpers/store-file.ts` | Writes takes to the browser's private file system (OPFS); memory fallback |
| `startRecorder.js` | `src/helpers/start-media-recorder.ts` | One recorder per source, saved every 10 s, stopped when a track ends |
| `session.js` | `src/RecordButton.tsx` (start/stop logic only) | Starts and stops all sources together |
| `convert.js` | `src/helpers/convert-in-browser.ts` | Mediabunny conversion, first video track, max 1080p |

`composeBoth.jsx` is new: it combines a Both take (separate screen and camera files) into one video
with `@remotion/web-renderer`, in the browser.

Not ported: Recorder's Remotion Studio editing, Whisper.cpp captions and its local-server upload.

Like Recorder itself, the browser's MediaStream Recording API does the actual recording.

**License:** Remotion Recorder is under the Remotion license
(https://www.remotion.dev/license, https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
Some companies need a Remotion company license to use it.
