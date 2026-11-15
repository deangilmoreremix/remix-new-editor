---
name: Animations Library
area: timeline
status: live
added: 2026-11-10
pr: deangilmoreremix/remix-new-editor#90
route: Timeline editor > Animations (HyperFrames + RemotionUI)
code:
  - src/lib/hyperframes/featureFlag.js
  - src/lib/hyperframes/placement.js
  - src/lib/hyperframes/catalog.enabled.json
  - src/cinegen/components/edit/hyperframes-modal.tsx
  - src/lib/editor/remotion
---

## What it does
Library of ready-made animated overlays for the timeline (lower thirds and more) built on HyperFrames and RemotionUI. Started as 267 flag-gated animations, grew by 118 imported templates from three MIT template repos, and has placement controls. On for everyone now; a saved project keeps its animations either way.

## Where in the app
Opened from the timeline editor's Animations entry point. QA can hide it on one browser with localStorage `remix.hyperframes.v1` = `0`.

## Depends on
Related PRs: #90 (267 flag-gated animations), #107 (on for everyone), #108 (placement controls, lower-third fixes), #111 (118 imported templates). Catalog JSON files in `src/lib/hyperframes/`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
