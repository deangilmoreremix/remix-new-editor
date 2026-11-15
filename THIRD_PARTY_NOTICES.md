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

## Local AI (Port I1)

- **FreeCut** (<https://github.com/walterlow/freecut>, commit `5ceeeb388eef5423640b7db157706274bf1b8165`) — MIT, Copyright (c) 2025 FreeCut.
  Word-timing resolution, span chunking and overlap de-duplication for local Whisper transcription, and the CLIP semantic-search approach were adapted
  into `src/cinegen/lib/local-ai/` (attribution headers in each file). No FreeCut player, renderer or store code is used.
- **@huggingface/transformers** 4.3.1 — Apache License 2.0 (runs Whisper, CLIP and SmolVLM in the browser).
- Model weights are never bundled. They are downloaded on demand from huggingface.co after the user accepts each model's licence in
  Media tools > Local AI (name, size, licence and source URL are shown there). Verified licences: Whisper (Apache-2.0 on the model card of
  `openai/whisper-*`), CLIP ViT-B/32 (`Xenova/clip-vit-base-patch32`, MIT), SmolVLM-256M-Instruct (Apache-2.0). FreeCut's LFM2.5-VL captioner
  (LFM Open License v1.0, revenue-limited commercial use) is listed but disabled. Details: `docs/stage-11/PORT_I1_REPORT.md`.
