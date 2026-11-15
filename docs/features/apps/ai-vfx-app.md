---
name: AI VFX app
area: apps
status: live
added: 2026-07-06
pr: TBD
route: apps/ai-vfx (in-app: #/ai-vfx)
code:
  - apps/ai-vfx
  - src/components/AIVFXPage.js
---

## What it does
Standalone AI VFX generator that turns a still image into a cinematic video with one-click effects: 50+ cinematic camera moves (orbit, crash zoom, dolly, crane, Matrix shot, vertigo) and 30+ VFX (disintegration, explosions, fire, electricity, tornado, tsunami). The in-app studio is a native port of it.

## Where in the app
In the app as AI VFX Studio (Side menu: Video > AI VFX). See the studios page.

## Depends on
Standalone Next.js app with its own `netlify.toml`; MuAPI.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
