---
name: Motion Director
area: studios
status: live
added: TBD
pr: TBD
route: #/motion-director (and #/motion-director/workbench)
code:
  - src/components/MotionDirectorPage.js
---

## What it does
Chat for directing motion graphics plus its Motion Workbench editor. Ported from OpenHiggsBolt (`src/apps/motion-director`).

## Where in the app
Not in the side menu. Linked from the personalization module (`src/features/personalization/mount.jsx`).

## Depends on
Workbench build; chat backend.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
