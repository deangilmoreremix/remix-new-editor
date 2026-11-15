---
name: Effects Studio
area: studios
status: live
added: TBD
pr: TBD
route: #/effects; overview at #/effects-page
code:
  - src/components/EffectsStudio.js
  - src/lib/muapi.js
---

## What it does
Applies effects to images and video. Tabs: Image Effects, Nano Banana, Kontext Effects, Video Effects, Motion Controls and Video FX v2. Source can be an uploaded file, a reference photo or a Pexels image, with Advanced guidance and steps controls.

## Where in the app
Side menu: Video > Effects.

## Depends on
MuAPI effect endpoints (flux-kontext-effects, generate_wan_ai_effects); Pexels.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
