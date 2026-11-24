# Third-party notices

## Background removal (Asset Finder)

On-device background removal in the Personalization Modal's Asset Finder uses:

- **@bg0/browser** 0.1.1 — Apache License 2.0. <https://github.com/opencoredev/bg0>
  Runs entirely in the user's browser (WebGPU, with a WebAssembly fallback); no server or paid API is involved.
- **BiRefNet** model weights (the `studioludens/birefnet-lite-512` ONNX export), downloaded by the browser
  from huggingface.co on first use (about 192 MB) and cached locally. BiRefNet is MIT licensed; see the
  model card and BG0's third-party notices for the full terms:
  <https://github.com/opencoredev/bg0/blob/main/THIRD_PARTY_NOTICES.md>
- **@huggingface/transformers** (3.x, installed as a nested dependency of @bg0/browser) — Apache License 2.0.

BG0's own documentation lists additional third-party components (for example HEIC decoding under the LGPL) in
other BG0 packages. Version 0.1.1 of `@bg0/browser` does not include them; if a later version is adopted,
re-check its notices and keep any required attribution and distribution terms.

## Warmbly dashboard

`apps/warmbly-web/` contains the dashboard from https://github.com/warmbly/warmbly, licensed under the Apache License 2.0 (copy in `apps/warmbly-web/LICENSE`). See `apps/warmbly-web/UPSTREAM.md` for the source commit and the local changes.

## Pitch shifting / time stretching (CineGen Media tools > Audio)

- **SoundTouch JS** v0.2.3 (`src/cinegen/vendor-soundtouch/time-stretch.ts`) — GNU Lesser General Public License v2.1 or later.
  Copyright (c) Olli Parviainen, Ryan Berdeen, Jakub Fiala, Steve 'Cutter' Blades. Taken unmodified from FreeCut
  (<https://github.com/walterlow/freecut>, commit `5ceeeb388eef5423640b7db157706274bf1b8165`). The licence text is in
  `src/cinegen/vendor-soundtouch/LICENSE-LGPL-2.1.txt`; the file is kept separate so it can be replaced (see the README next to it).
- **FreeCut** (MIT, Copyright (c) 2025 FreeCut): the pitch limits and semitone/cent maths of `src/shared/utils/audio-pitch.ts` and the idea of the
  SoundTouch preview worklet (`soundtouch-preview-processor.worklet.ts`) were adapted into `src/cinegen/lib/audio/pitch.ts` and
  `pitch-worklet.processor.js` (marked in their headers).


## Local AI (Port I1)

- **FreeCut** (<https://github.com/walterlow/freecut>, commit `5ceeeb388eef5423640b7db157706274bf1b8165`) — MIT, Copyright (c) 2025 FreeCut.
  Word-timing resolution, span chunking and overlap de-duplication for local Whisper transcription, and the CLIP semantic-search approach were adapted
  into `src/cinegen/lib/local-ai/` (attribution headers in each file). No FreeCut player, renderer or store code is used.
- **@huggingface/transformers** 4.3.1 — Apache License 2.0 (runs Whisper, CLIP and SmolVLM in the browser).
- Model weights are never bundled. They are downloaded on demand from huggingface.co after the user accepts each model's licence in
  Media tools > Local AI (name, size, licence and source URL are shown there). Verified licences: Whisper (Apache-2.0 on the model card of
  `openai/whisper-*`), CLIP ViT-B/32 (`Xenova/clip-vit-base-patch32`, MIT), SmolVLM-256M-Instruct (Apache-2.0). FreeCut's LFM2.5-VL captioner
  (LFM Open License v1.0, revenue-limited commercial use) is listed but disabled. Details: `docs/stage-11/PORT_I1_REPORT.md`.

## Collab Suite: Teamchat and Meetings

- **HeyPuter/everything** (<https://github.com/HeyPuter/everything>, commit `95cf576a8efc3f9719483f87301efa87d81b1d1b`) — MIT, Copyright (c) 2026 Puter Technologies Inc.
  `collab-suite/vendor/everything/` is an unmodified copy of the upstream Teamchat and Meetings apps (see `VENDORED.md` and `LICENSE` there).
  They load Puter.js from `js.puter.com` at runtime, so people using them need a Puter account.
