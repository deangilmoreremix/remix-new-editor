# Studio controls audit

Compared with the live MuAPI catalog (`GET https://api.muapi.ai/api/v1/models`, 874 models, read 2026-11-27).
The studios build their settings from the bundled schemas in `src/lib/models.js` (auto-generated, "from models_dump.json").
The older `src/lib/muapi/liveModels.json` (787 models, 2026-11-07) is **not** a reliable reference for what an endpoint
accepts: it attached one shared schema to whole families (for example `resolution` and `high_bitrate` on every Seedance 2
endpoint, including the `-1080p` and `-4k` ones), which the live catalog does not do.

## Live settings the bundled copy does not list

| Group | Models | Not in live catalog | With a live setting not shown | Most common |
|---|---|---|---|---|
| Text to image | 84 | 3 | 0 | - |
| Image edit | 92 | 10 | 1 | Change Angle: aspect_ratio, loras, output_format |
| Text to video | 115 | 7 | 22 | resolution (9), camera_fixed (6), generate_audio (6), draft (3) |
| Image to video | 188 | 7 | 34 | resolution (17), last_image (16), draft (9) |
| Video to video | 77 | 0 | 20 | resolution (10), aspect_ratio (3), duration (2), language (2) |
| Lip sync | 16 | 1 | 3 | seed, align_audio, open_scenedet, separate_vocal |
| Audio | 24 | 1 | 6 | model (4), style / custom_mode / title (3 each) |
| Avatar | 13 | 1 | 5 | resolution (5), seed |
| Training | 3 | 1 | 2 | aspect_ratio, resolution, quality, duration |
| Video tools | 13 | 3 | 10 | resolution (4), aspect_ratio (3), language (2) |

The catalog lists setting **names** only, not their allowed values or ranges, so a value list still has to come from
somewhere else (the old snapshot, the provider's docs, or a real call).

## Video Resolution, narrowed

Of the text-to-video and image-to-video models, **26** declare `resolution` in the live catalog while the bundled copy
does not (130 others never declared it, 133 already have it):

* Grok Imagine text-to-video and image-to-video: 480p, 720p.
* Seedance 2 vip / spicy (11): 720p, 1080p, 4k.
* Seedance 2 other (3, `seedance-2-t2v`, `seedance-2-vip-extend`, `seedance-2-omni-reference`).
* Seedance 2.5 (10): 480p, 720p, 1080p, 4k.

Value lists are from the November snapshot, so confirm them before use. Not applied yet: `models.js` is generated, so the
right fix is to regenerate it from the live catalog (`scripts/generate-model-catalog.mjs`, 87 models are new) and review
the diff, not to hand-edit it. Do that in its own change with a browser pass on the Video and Cinema studios.

## Already handled
* The 72 Edit Studio apps. Settings added from `src/data/muapiAppModelControls.json`: MiniMax H3 duration 5-15 s,
  face index 0-10 (Video Face Swap), all 9 Video Background Remover formats. Guarded by
  `src/test/muapi-app-model-controls.test.js`, which also checks every app setting against
  `src/test/fixtures/muapi-live-input-fields.json` (the live catalog's declared fields for the apps' models).
* **Seedance 2 apps do not get Resolution or High bitrate.** The live `seedance-2-image-to-video` endpoint declares only
  `aspect_ratio` and `duration`; 1080p and 4k are separate, pricier endpoints (`...-1080p` about 2.7x, `...-4k` about 5.4x
  the base price).
* Seed, negative prompt and audio on/off are not offered: none of the apps' models declares them.
* The 16 built-in Edit Studio tools: `src/test/edit-studio-tool-controls.test.js` (known gaps listed in the test).
