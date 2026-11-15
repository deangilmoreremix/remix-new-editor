---
name: Upscale Studio
area: studios
status: live
added: 2026-03-10
pr: TBD
route: #/upscale; overview at #/upscale-page
code:
  - src/components/UpscaleStudio.js
---

## What it does
Upscales images with AI Upscaler (MuAPI), Topaz Upscale or Seed Upscale (ByteDance), with upscale factor buttons. An in-flight upscale can be cancelled.

## Where in the app
Side menu: Image > Upscale.

## Depends on
MuAPI; Asset Library for reference images.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
