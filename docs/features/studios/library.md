---
name: Asset Library
area: studios
status: live
added: TBD
pr: TBD
route: #/library
code:
  - src/components/LibraryPage.js
  - src/lib/assetLibrary.js
---

## What it does
Your generated and uploaded assets. The Uploads view shows permanent storage references only, never expiring URLs, and assets can be handed to studios that accept an Asset Library reference.

## Where in the app
Side menu: My Work > Library.

## Depends on
`src/lib/assetLibrary.js`, `assetStore.js`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
