---
name: SmartVideo Studio
area: studios
status: live
added: TBD
pr: TBD
route: #/smart-video-studio
code:
  - src/components/studios/SmartVideoStudio/SmartVideoStudio.tsx
---

## What it does
Mode-driven studio: a mode rail, model selector and a form generated dynamically from the model catalog, with a generations panel showing jobs.

## Where in the app
Not in the side menu and no in-app link found in the code; open the route directly. TBD: confirm the intended entry point.

## Depends on
Model registry sync (`svStudio/modelRegistry`), generation gateway.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
