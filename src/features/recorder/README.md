# Recorder (browser port of Remotion Recorder)

Route: `#/recorder` (side menu: Agents → Recorder), and the **Full Recorder** button in the
Video Outreach studio's Record step.

Source: [remotion-dev/recorder](https://github.com/remotion-dev/recorder) at commit `4c09934`,
ported so everything runs in the browser. Recorder needs a local Node server (saving takes,
Whisper.cpp captions) and Remotion Studio (editing props, previewing, rendering). Neither exists
here, so those parts are replaced:

| Recorder | Here |
| --- | --- |
| `public/<folder>/` on disk, written by the local server | IndexedDB project store, `studio/project-store.ts` (same file names, served as object URLs; memory only if IndexedDB is unavailable) |
| `@remotion/studio` `writeStaticFile`, `deleteStaticFile`, `watchStaticFile`, `updateDefaultProps`, `saveDefaultProps`, `focusDefaultPropsPath`, and `getStaticFiles()` from `remotion` | Same names and contracts in `studio/project-store.ts` |
| Project folders and composition registration (`scripts/server`) | Projects in the store (`app/actions/*`, `studio/project-defaults.ts`) |
| Whisper.cpp on the server (`scripts/captions`) | In-browser Whisper worker (`src/lib/editor/remotion/transcribe.js`), saved as Recorder caption JSON (`app/helpers/transcribe-video.ts`) |
| Remotion Studio props sidebar | `studio/ScenesPanel.tsx` (every field in `config/scenes.ts`) and `studio/TakesPanel.tsx` |
| Studio preview, `useVideoConfig().id` as the folder, `isStudio` editing tools | `@remotion/player` with `studio/project-context.tsx` (folder and editing flag) |
| Rendering with the CLI or Lambda | `@remotion/web-renderer` (`studio/export.tsx`): MP4/H.264, else WebM/VP8 |

Kept as in Recorder: the recording app (`app/`: up to four sources, device pickers, rescan,
permissions, browser support check, resolution limiter, mirror, rotate, crop indicator, volume
meter, timer, R shortcut, keep/discard take, in-browser conversion), and the compositions
(`remotion/`: layouts, video scenes with webcam positions, display + webcam, B-roll,
silence trimming from captions, boxed and SRT captions with the caption editor, chapters, table
of contents, title, end card, transitions, music and sound effects).

Changes beyond the replacements above, each marked in the code:

- End card: a `custom` channel with the scene's own profile (avatar and handles), instead of only
  Remotion's own channels.
- A new webcam take adds a video scene to the project (Recorder asks you to add one by hand).
- If captions fall outside a take (Whisper can invent words in silence), the whole take is kept
  instead of being trimmed to nothing.
- Caption layout skips Remotion's font check, which misfires because the app's UI font is also
  Inter. Fonts are still awaited before captions are laid out.
- Playback controls sit under the preview, so clicks in the video reach captions and scene tools.
- Assets live in `public/recorder/`.

Licensing: Remotion's license applies to this code, and some companies need a company license
(set `VITE_REMOTION_LICENSE_KEY` for exports). Recorder's sample music
(`public/recorder/sounds/utope-*.mp3`) ships with the Recorder template, which doesn't state
its license. Confirm you may use those tracks before publishing videos with them.

Tests: `src/features/recorder/__tests__/studio.test.tsx`.
