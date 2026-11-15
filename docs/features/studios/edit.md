---
name: Edit Studio
area: studios
status: live
added: TBD
pr: TBD
route: #/edit (deep link /?tool=<slug>#/edit)
code:
  - src/components/EditStudio.js
  - src/lib/muapi.js
---

## What it does
A gallery of 16 image tools. Clicking a tool opens its own studio with inputs, settings and a before/after preview. Tools: Remove Object, Remove Background, Extend Image, AI Edit, Reframe, Change Dress, Enhance Skin, Colorize, Add Watermark, Upscale, Face Swap, Product Shot, Ghibli Style, Photo Effects, Change Angle, Character & Reference. Tools with several models (AI Edit, Upscale, Product Shot, Photo Effects, Character & Reference) show a model picker.

## Where in the app
Side menu: Image > Edit.

## Depends on
MuAPI edit endpoints; Dynamic Control Engine.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
