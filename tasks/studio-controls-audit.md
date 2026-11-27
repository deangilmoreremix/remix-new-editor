# Studio controls audit

Compared with the live MuAPI catalog (`GET https://api.muapi.ai/api/v1/models`, 874 models, read 2026-11-27).
The studios build their settings from the bundled schemas in `src/lib/models.js` (auto-generated, "from models_dump.json").
`src/lib/muapi/liveModels.json` was regenerated on 2026-11-27 (854 models). Its `fields` come from `openapi.json`, which
often shares one schema across a family and so lists settings an endpoint ignores (see below); its `declared` list is
what the model list says the endpoint takes.

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

## Video Resolution: done

Of the text-to-video and image-to-video models, 26 declare `resolution` in the live model list while the bundled copy
lacked it. For **each of the 26** the real `estimate-cost` endpoint prices resolution (lowest vs highest value differ,
for example Seedance 2 VIP 720p $1.50 vs 4k $6.75, Seedance 2.5 480p $0.68 vs 4k $6.80, Grok Imagine 480p $0.125 vs
720p $0.25), so they are now listed in a marked block at the end of `src/lib/models.js` (`LIVE_VIDEO_RESOLUTION`).
`src/test/models-live-resolution.test.js` fails if a model that the live list declares `resolution` for is missing it.

* **`openapi.json` is a superset.** `seedance-2-image-to-video` lists `resolution` and `high_bitrate` in its request
  schema, but its price is $1.25 at 720p and at 4k (and with high_bitrate on), while duration doubles it. It ignores
  them, so the studios do not offer them. 1080p and 4k are separate endpoints. Use the model list's `input_fields`
  (`declared` in `liveModels.json`) to decide what to show, not the request schema.
* `scripts/build-muapi-catalog.mjs` regenerates `src/lib/muapi/liveModels.json` (854 models, +67). `src/lib/models.js`
  has no generator: its header comment ("auto-generated from models_dump.json") is stale and `models_dump.json` holds only
  about 60 entries. The Video and Cinema studios read `models.js`, so changes there are made by hand or by a block like
  the one above.
* Two older entries list `4K` where the schema says `4k`; the API prices both the same, so they were left alone.

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
