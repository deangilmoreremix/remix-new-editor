---
name: Find My Brand
area: studios
status: live
added: TBD
pr: TBD
route: #/find-my-brand
code:
  - src/components/FindMyBrandPage.js
---

## What it does
Free, signed-out brand discovery. Opens the shared personalization modal in anonymous mode and runs the free discover pipeline. Port of OpenHiggsBolt's /demo page.

## Where in the app
Not in the side menu and no in-app link found in the code; open the route directly. TBD: confirm the intended entry point.

## Depends on
`POST /api/demo/discover`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
