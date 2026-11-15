---
name: Apps Hub
area: studios
status: live
added: 2026-03-10
pr: TBD
route: #/apps
code:
  - src/components/AppsHub.js
---

## What it does
Explore Apps landing page: a hero, three step cards and a card for each studio. Its list is built from the side menu so the two cannot drift apart. Retired routes (training, chat, assist) land here.

## Where in the app
Side menu: Apps.

## Depends on
`src/lib/studioRoutes.js`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
