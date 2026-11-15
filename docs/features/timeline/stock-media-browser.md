---
name: Stock Media Browser
area: timeline
status: live
added: 2026-11-12
pr: deangilmoreremix/remix-new-editor#109
route: Timeline editor > stock media panel
code:
  - src/cinegen/components/edit/stock-media-popup.tsx
  - src/cinegen/components/edit/stock-categories.ts
  - src/cinegen/adapters/web-media.ts
---

## What it does
AI-assisted and Pexels/Pixabay media browser inside the timeline editor, organised into 100 categories, for adding stock clips and images to a project.

## Where in the app
Opened from the timeline editor's media tools.

## Depends on
Related PR: #109. Pexels and Pixabay.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
