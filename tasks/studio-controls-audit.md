# Studio controls audit (bundled `src/lib/models.js` vs live `src/lib/muapi/liveModels.json`, 2026-11-07, 787 models)

The studios build their settings from the bundled model schemas. This compares each bundled model with the
live schema and counts the live settings the bundled copy does not list.

| Group | Models | Not in live snapshot | With a live setting not shown | Most common missing settings |
|---|---|---|---|---|
| Text to image | 84 | 3 | 10 | seed, model, num_images, sync |
| Image edit | 92 | 11 | 5 | num_images, seed, loras |
| Text to video | 115 | 8 | 43 | resolution (29), draft (12), generate_audio (6), seed |
| Image to video | 188 | 8 | 86 | resolution (65), draft (36), last_image (16), seed |
| Video to video | 77 | 0 | 43 | resolution (32), aspect_ratio, language |
| Lip sync | 16 | 1 | 3 | seed, align_audio |
| Audio | 24 | 1 | 6 | voice/speed/pitch/emotion, music style fields |
| Avatar | 13 | 1 | 5 | resolution, seed |
| Training | 3 | 1 | 2 | aspect_ratio, resolution, quality |
| Video tools | 13 | 3 | 10 | resolution, aspect_ratio, language |

## Not fixed here, and why
A live setting is not proof the studio should show it. `muapi.js` already notes that models such as Kling v2.6
I2V reject the `resolution` the validator would fill in, and some live entries are per-resolution endpoints
(`...-1080p`, `...-4k`). Adding the settings blind could break working generations or change prices, so each
needs a check against the real endpoint first. Start with image-to-video and text-to-video `resolution`
(about 94 models), which is also the largest group.

## Already handled
* The 72 Edit Studio apps: see `src/data/muapiAppModelControls.json` (resolution, high bitrate, full duration range,
  face index 0-10, all 9 background-remover formats), guarded by `src/test/muapi-app-model-controls.test.js`.
* The 16 built-in Edit Studio tools: guarded by `src/test/edit-studio-tool-controls.test.js` (known gaps listed there).
* Seed, negative prompt and audio on/off are not offered for the apps because none of their models accepts them
  (Seedance 2 / Seedream 5.0 Pro Edit / MiniMax H3 / Wan 2.2 have no such field; only Seedance 2.5 and mini variants do).
