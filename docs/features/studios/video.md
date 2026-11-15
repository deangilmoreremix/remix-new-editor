---
name: Video Studio
area: studios
status: live
added: TBD
pr: TBD
route: #/video
code:
  - src/components/VideoStudio.js
  - src/lib/muapi.js
---

## What it does
Generates video in several modes: Text to video, Animate image, Keyframes (start + end), References, Edit video, Extend uploaded video and Motion transfer. Has model selection, advanced controls and a Personalize option.

## Where in the app
Side menu: Video > Video. A model chosen on the Text to Video page (`#/text-to-video`) wins over the remembered one.

## Depends on
MuAPI generation calls; Dynamic Control Engine.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
