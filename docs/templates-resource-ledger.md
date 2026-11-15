# Imported template ledger

138 templates from three MIT-licensed repositories (pinned commits in `src/lib/templates/lock.json`; attribution in `docs/third-party-templates.md`).
Enabled = rendered with no adapter error and not blank in the sandboxed preview frame, a real full-length 1080p MP4 export succeeded at >= 3 fps (under 8 fps = "slower export"), and either a field visibly changes the picture or no text is shown.

| Group | Count |
|---|---|
| free: enabled | 49 |
| free: not enabled | 1 |
| rve: enabled | 62 |
| rve: not enabled | 19 |
| video: enabled | 7 |

## Repositories

- **free**: https://github.com/deangilmoreremix/free-remotion-templates @ `f648980e528defb7594e24c6447055f0540f340b` (MIT (SPDX: Trimora Inc., 2026))
- **video**: https://github.com/deangilmoreremix/remotion-video-templates @ `90149464d51a43fcb90e15491bf0d681c1b0fa49` (MIT (Copyright (c) 2026 Alejandro Brito))
- **rve**: https://github.com/deangilmoreremix/remotion-templates @ `6209b724798e48ff395f8df1a6fa2d26082372b5` (MIT (stated in README: "All templates in this repository are available under the MIT License"; fork of reactvideoeditor/remotion-templates))

## Not enabled

| id | reason |
|---|---|
| tpl:free:bokeh-circles | export too slow (1.2 fps at 1080p) |
| tpl:rve:blinds-transition | MP4 export failed: Failed to set the 'width' property on 'OffscreenCanvas': Value is not of type 'unsigned long'. |
| tpl:rve:bokeh-circles | duplicate of tpl:free:bokeh-circles (the version with typed props) |
| tpl:rve:camera-shake | duplicate of tpl:free:camera-shake (the version with typed props) |
| tpl:rve:chapter-title | duplicate of tpl:free:chapter-title (the version with typed props) |
| tpl:rve:end-card | duplicate of tpl:free:end-card (the version with typed props) |
| tpl:rve:glitch-text | duplicate of tpl:free:glitch-text (the version with typed props) |
| tpl:rve:ken-burns | MP4 export failed: Failed to construct 'VideoFrame': VideoFrames can't be created from tainted sources. |
| tpl:rve:logo-blur-reveal | duplicate of tpl:free:logo-blur-reveal (the version with typed props) |
| tpl:rve:logo-bounce-drop | duplicate of tpl:free:logo-bounce-drop (the version with typed props) |
| tpl:rve:logo-split-reveal | duplicate of tpl:free:logo-split-reveal (the version with typed props) |
| tpl:rve:logo-stroke-draw | duplicate of tpl:free:logo-stroke-draw (the version with typed props) |
| tpl:rve:noise-grain | export too slow (1.3 fps at 1080p) |
| tpl:rve:parallax-pan | duplicate of tpl:free:parallax-pan (the version with typed props) |
| tpl:rve:pixel-transition | export too slow (0.6 fps at 1080p) |
| tpl:rve:slide-wipe | duplicate of tpl:free:slide-wipe (the version with typed props) |
| tpl:rve:split-screen | duplicate of tpl:free:split-screen (the version with typed props) |
| tpl:rve:starfield | duplicate of tpl:free:starfield (the version with typed props) |
| tpl:rve:whip-pan | duplicate of tpl:free:whip-pan (the version with typed props) |
| tpl:rve:zoom-pulse | MP4 export failed: Failed to construct 'VideoFrame': VideoFrames can't be created from tainted sources. |
