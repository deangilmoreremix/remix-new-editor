---
name: Motion Workbench
area: studios
status: live
added: TBD
pr: TBD
route: #/workbench (old #/cinegen redirects here)
code:
  - src/components/studios/WorkbenchStudio/WorkbenchStudio.js
  - apps/shotcraft
---

## What it does
Motion Workbench hosted in a same-origin iframe. It replaced CineGen Studio, and old `#/cinegen` links redirect here.

## Where in the app
Side menu: Agents > Workbench.

## Depends on
`npm run build:workbench` output in `public/workbench-app/`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
