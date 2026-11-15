---
name: Asset Finder Background Removal
area: timeline
status: live
added: 2026-11-12
pr: deangilmoreremix/remix-new-editor#130
route: Personalization modal > discovered assets
code:
  - src/features/personalization/shared/personalization/backgroundRemoval/backgroundRemovalClient.ts
  - src/features/personalization/shared/personalization/backgroundRemoval/useAutoCutout.ts
  - src/features/personalization/shared/personalization/DiscoveredAssetGrid.tsx
---

## What it does
Automatically removes the background from discovered brand assets on the user's device (no upload), using a worker. Includes a before/after slider.

## Where in the app
Personalization modal, in the discovered asset grid (opened from Lead Finder and Find My Brand).

## Depends on
Related PRs: #130, #133 (follow-up fixes). On-device model via a web worker.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
