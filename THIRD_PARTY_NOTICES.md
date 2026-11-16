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

## Email provider merge-tag list (Email tab / Share panel)

Providers marked "More providers (not checked)" in the email picker were imported from the provider list in
`lib/constants/campaigns/email-providers.js` of the upstream editor, <https://github.com/strategic-limited/remix-new-editor>
(author "Digital Strategies"; its `package.json` declares the ISC license, and the repository has no LICENSE file).
Only provider names and merge-tag syntax (opening/closing characters and the first name / last name / email fields) were
used. These entries have not been checked against the vendors' own documentation. The providers marked as checked were
written from vendor documentation instead.

The ISC license requires this notice to be kept with copies of the covered material.
