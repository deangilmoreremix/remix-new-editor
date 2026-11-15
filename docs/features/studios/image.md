---
name: Image Studio
area: studios
status: live
added: 2026-02-12
pr: TBD
route: #/image
code:
  - src/components/ImageStudio.js
  - src/lib/muapi.js
  - src/lib/modelInputExtensions.js
---

## What it does
Generates images from text or from reference images. Pick a model, aspect ratio, negative prompt, style preset, batch count and reference strength, with extra model-specific controls under Advanced. It remembers your last text-to-image model and aspect ratio, and has a Personalize option.

## Where in the app
Side menu: Image > Image. A model chosen on the Text to Image page (`#/text-to-image`) is carried into this studio.

## Depends on
MuAPI generation calls; Dynamic Control Engine for advanced controls.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
