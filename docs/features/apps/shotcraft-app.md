---
name: ShotCraft and Motion Workbench
area: apps
status: live
added: 2026-11-02
pr: TBD
route: apps/shotcraft (in-app: #/workbench)
code:
  - apps/shotcraft
  - src/components/studios/WorkbenchStudio/WorkbenchStudio.js
---

## What it does
Motion Workbench is a post-production bench: multi-track timeline, asset library (finished units, 150 shot-card demos, sound effects, backgrounds), a schema-driven properties panel, live Remotion preview and one-click export. Ported from video-talkcraft. `apps/shotcraft` also holds the shot-card demos and a gallery.

## Where in the app
In the app as Workbench (Side menu: Agents > Workbench).

## Depends on
`npm run build:workbench` into `public/workbench-app/`; Remotion.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
