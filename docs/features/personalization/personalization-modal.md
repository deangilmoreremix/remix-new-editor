---
name: Personalization and Lead Finder Modal
area: personalization
status: live
added: 2026-11-02
pr: TBD
route: Personalize button in studios; Lead Finder; Find My Brand
code:
  - src/features/personalization/mount.jsx
  - src/features/personalization/shared/personalization/PersonalizationModal.tsx
  - src/features/personalization/shared/personalization/DemoPersonalizeProvider.tsx
  - src/features/personalization/shared/personalization/DiscoveredAssetGrid.tsx
---

## What it does
One shared modal, ported from OpenHiggsBolt, for personalizing content with a business's brand and finding prospects. It is a single React island mounted on first use; every studio's Personalize button, the Lead Finder page and Find My Brand open the same modal. It includes image, AI-clip and analytics personalization work, plus automatic background removal on discovered assets.

## Where in the app
Personalize buttons in studios such as Image and Video; the Lead Finder page; the Find My Brand page.

## Depends on
Related PRs: #71, #73, #74, #75, #76, #77 (image finder, reliability, polish, AI images, AI clips, analytics), #120 (newer OpenHiggsBolt modal), #135 (sync with OpenHiggsBolt main). `/api/personalization/*`, `/api/demo/discover`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
