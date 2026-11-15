---
name: Add to Timeline Modal
area: timeline
status: live
added: 2026-11-12
pr: TBD
route: Timeline editor > Add to timeline
code:
  - src/cinegen/components/edit/add-to-timeline-modal.tsx
  - src/cinegen/components/edit/add-to-timeline-registry.ts
  - src/cinegen/components/edit/template-videos-modal.tsx
  - src/cinegen/components/edit/template-video-placement.ts
---

## What it does
Modal for adding content to the timeline from several sources, including a Template videos tab. Related PRs named for this: #131 (adds the Template videos tab) and #139 (template videos follow-ups).

## Where in the app
Opened from the timeline editor.

## Depends on
Template video catalog. TBD: list the other sources in the registry.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
