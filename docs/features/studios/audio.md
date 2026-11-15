---
name: Audio Studio
area: studios
status: live
added: 2026-03-18
pr: TBD
route: #/audio
code:
  - src/components/AudioStudio.js
  - src/lib/audioStudioFields.js
---

## What it does
Audio generation with model-driven forms. Uploaded audio tracks are saved to the permanent Asset Library so generation always uses a fresh upload URL. Includes MiniMax example styles. TBD: list the supported audio tasks.

## Where in the app
Side menu: Video > Audio.

## Depends on
MuAPI; Asset Library.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
