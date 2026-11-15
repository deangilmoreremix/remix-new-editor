---
name: Templates
area: studios
status: live
added: 2026-03-10
pr: TBD
route: #/templates (template/<id> deep links)
code:
  - src/components/TemplatesPage.js
  - src/lib/templates.js
---

## What it does
Browse the template library by category (Social Media, Style Transfer, Entertainment, Commercial, VFX & Action, Portrait & Creator, Decade & Era) and by niche. Each template has a thumbnail and opens in the Template Studio.

## Where in the app
Side menu: Templates.

## Depends on
`src/lib/templates.js`, niche and matrix template files.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
