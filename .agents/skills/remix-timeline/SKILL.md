---
name: remix-timeline
description: Drive the Remix timeline editor (route #/timeline) through its WebMCP tools or its in-app AI Agent — add stock footage, overlays, captions, effects, keyframes, transitions and Remotion animations, then preview and export. Use when an agent in the user's browser should build or edit a video in this editor.
---

# Remix timeline editor — agent tools

The timeline editor (`src/components/TimelineEditorPage.jsx`) renders with Remotion (preview in `@remotion/player`, export with `@remotion/web-renderer` in a sandboxed iframe). The same tool set powers:

- **In-app AI Agent** — the 🤖 AI Agent panel (rail button "AI Agent" or the 🤖 top-bar button). The browser runs the tool loop (`src/lib/editor/agent/videoAgent.js`); each model step goes through `netlify/functions/video-agent.js` (OpenAI Responses API by default, Claude when `ANTHROPIC_API_KEY` is set). One undo step per turn.
- **WebMCP** — when the page has `navigator.modelContext` (W3C WebMCP draft; Chrome flag/origin trial), every tool is registered as `timeline_<name>` (`src/lib/editor/agent/webmcp.js`). Read-only tools run directly; editing/export tools ask the user to confirm in the page (approval lasts one minute per tool).

Tool definitions and handlers: `src/lib/editor/agent/tools.js`.

## Tools

| Tool | Read-only | What it does |
|---|---|---|
| `get_timeline` | ✓ | Timeline length, playhead, tracks and clips (ids, type, start/end seconds, options, effects, keyframes) |
| `search_stock` | ✓ | Pixabay/Pexels videos or images → ids for `add_media_clip` |
| `add_media_clip` | | Video/image (Main Video track) or audio (Voiceover) from a stock id or https URL |
| `add_overlay` | | Smart Text, Image, Personalized Image, Stickers, Lower Thirds, Wrapper, Text Mask, Overlay Transition |
| `add_video_transition` | | Transition centred on a cut (`fade`, `wipeleft`, `slideleft`, `circleopen`, `cube`, `clockwise`, gl-transitions names…) |
| `add_interactive` | | `addon-pause`, `addon-loop`, `addon-skip`, `lead-form`, `click-to-call` (player only, not in exports) |
| `list_effects` | ✓ | The 88 `@remotion/effects` presets with parameters |
| `add_effect` | | Effect on a video/image clip or image overlay; returns its `uid` |
| `set_keyframes` | | Animate `x`, `y`, `scale`, `rotation`, `opacity`, `volume` or `fx:<uid>:<param>` with easing |
| `add_captions` | | Transcribe a clip in the browser (Whisper) or add caption lines; styles `tiktok`, `classic`, `box`, `karaoke`, `minimal` |
| `remove_background` | | MODNet person cut-out → transparent WebM/PNG (slow on CPU) |
| `add_voiceover` | | Text-to-speech narration (MiniMax via MuAPI) on the Voiceover track, sized to the speech |
| `add_music` | | Instrumental music (Suno via MuAPI) on a Music track, with fades and ducking under voiceovers |
| `create_animation` | | Remotion component code (`function Animation({ props })`) as a timeline clip |
| `update_clip` / `remove_clip` | | Timing, name, options, volume, fit, animation code/props / delete |
| `set_duration` | | Timeline length (5–600 s); clip times are preserved |
| `preview_frame` | ✓ | Renders one export-accurate frame, reports animation errors |
| `export_video` | | MP4/WebM/MOV at 720p/1080p/4K (always asks the user) |

## Animation code rules (`create_animation`)

- One component named `Animation`, plain JS + JSX, **no imports** — `React`, `AbsoluteFill`, `Sequence`, `Series`, `Loop`, `Freeze`, `useCurrentFrame`, `useVideoConfig`, `interpolate`, `interpolateColors`, `spring`, `Easing`, `random`, `Img`, `Video`, `Audio`, `Lottie`, `TransitionSeries`, `linearTiming`, `springTiming`, `fade`, `slide`, `wipe`, `flip`, `clockWipe`, `iris`, `measureText`, `fitText` are in scope; `props` holds what you passed.
- Animate only from `useCurrentFrame()`; clamp `interpolate`; size relative to `width`/`height`.
- Blocked by the gate (`src/lib/editor/agent/codeGate.js`): imports, `require`, `eval`, `Function`, `constructor`/prototype tricks, network, browser globals, storage, messaging, timers, `Math.random`, raw HTML. Max 20 KB.
- The code runs only in sandboxed opaque-origin iframes (`export-runner.html`, `code-preview.html`), never in the editor page.

See `.agents/skills/remotion-best-practices` for Remotion techniques.
