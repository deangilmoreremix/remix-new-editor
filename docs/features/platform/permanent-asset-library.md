---
name: Permanent Asset Library
area: platform
status: live
added: 2026-10-17
pr: deangilmoreremix/remix-new-editor#29
route: Used by upload pickers in studios; browsed in Library > Uploads
code:
  - src/lib/assetLibrary.js
  - src/lib/assetStore.js
---

## What it does
Durable, workspace-scoped store for every file a user references in a studio. Rows store the permanent Supabase Storage URL, never a MuAPI temporary URL (those expire after an hour), and generation resolves a fresh MuAPI URL from the asset when needed.

## Where in the app
Upload pickers in studios and the Library page.

## Depends on
Supabase Storage bucket `uploads`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
