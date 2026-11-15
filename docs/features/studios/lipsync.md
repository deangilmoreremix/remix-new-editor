---
name: Lip Sync Studio
area: studios
status: live
added: TBD
pr: TBD
route: #/lipsync
code:
  - src/components/LipSyncStudio.js
---

## What it does
Makes a face speak supplied audio. Image mode takes a portrait image plus audio and produces a video; Video mode takes an existing video plus audio and produces a lip-synced video.

## Where in the app
Side menu: Video > Lip Sync.

## Depends on
MuAPI lip sync models; Dynamic Control Engine.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
