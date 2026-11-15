---
name: Cinema Template Studio
area: studios
status: live
added: TBD
pr: TBD
route: #/cinema-template
code:
  - src/components/CinemaTemplateStudio.js
---

## What it does
UI for the Cinematic Template System: pick a template and fill in brand and niche details (brand name, brand voice, target audience, business type, subject, setting, visual style, core narrative) to generate on-brand cinematic output.

## Where in the app
Side menu: Video > Cinema Templates.

## Depends on
Cinematic template library (`src/lib/cinematicTemplates.js`). TBD: confirm generation endpoints.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
