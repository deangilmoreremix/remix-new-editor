---
name: Dynamic Control Engine
area: studios
status: live
added: TBD   # confirm from git log
pr: TBD
route: Every studio > Advanced controls panel
code:
  - src/lib/modelInputExtensions.js
  - src/lib/muapi.js
---

## What it does
Renders each model's advanced controls (sliders, seeds, LoRA, negative prompt, etc.) automatically from the model's input schema instead of hardcoding them per studio. Controls show or hide based on the current selections.

## Where in the app
Advanced panel in Image, Video, Edit, Lip Sync, Cinema, Storyboard, Character, Commercial, Upscale, Influencer and Avatar studios.

## Depends on
Model `inputs` schemas; `modelInputExtensions.js` fills in missing advanced params.

## How to test
Pick a model in any studio, open Advanced, change a control, and confirm it appears in the generation payload.
