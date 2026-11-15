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

## Pitch shifting / time stretching (CineGen Media tools > Audio)

- **SoundTouch JS** v0.2.3 (`src/cinegen/vendor-soundtouch/time-stretch.ts`) — GNU Lesser General Public License v2.1 or later.
  Copyright (c) Olli Parviainen, Ryan Berdeen, Jakub Fiala, Steve 'Cutter' Blades. Taken unmodified from FreeCut
  (<https://github.com/walterlow/freecut>, commit `5ceeeb388eef5423640b7db157706274bf1b8165`). The licence text is in
  `src/cinegen/vendor-soundtouch/LICENSE-LGPL-2.1.txt`; the file is kept separate so it can be replaced (see the README next to it).
- **FreeCut** (MIT, Copyright (c) 2025 FreeCut): the pitch limits and semitone/cent maths of `src/shared/utils/audio-pitch.ts` and the idea of the
  SoundTouch preview worklet (`soundtouch-preview-processor.worklet.ts`) were adapted into `src/cinegen/lib/audio/pitch.ts` and
  `pitch-worklet.processor.ts` (marked in their headers).

