---
name: Timeline Projects and Publishing
area: timeline
status: live
added: 2026-11-11
pr: deangilmoreremix/remix-new-editor#113
route: Timeline editor > Projects, Share
code:
  - src/lib/editor/projectLibrary/projectStore.js
  - src/lib/editor/projectLibrary/projectsPanel.js
  - src/lib/editor/projectLibrary/projectTabs.js
  - src/lib/editor/publish/publishClient.js
  - src/lib/editor/publish/sharePanel.js
  - src/lib/editor/publish/interactivePlayer.js
  - src/lib/editor/publish/viewerOverlays.js
---

## What it does
Save and organise timeline projects, with a Projects overview on the home screen and on the empty Analytics tab. Projects can be published to a shareable watch page with an interactive player, viewer overlays and personal voice.

## Where in the app
Timeline editor home screen and Share panel; published videos play at the watch route (`src/pages/WatchPage.jsx`).

## Depends on
Related PRs: #113 (Projects, publishing, first-party analytics, retargeting, owner notifications), #125 (Projects overview). Supabase migrations dated 2026-11-12 (`publish_hardening_slugs`, `video_analytics`, `retargeting_notifications`).

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
