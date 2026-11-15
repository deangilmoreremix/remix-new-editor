---
name: Photo Studio
area: studios
status: live
added: 2026-08-30
pr: TBD
route: #/photo-studio (alias #/brand-photo-studio)
code:
  - src/components/PhotoStudioPage.js
---

## What it does
Product photography with 6 categories x 5 styles = 30 presets. Starts from a brand (from Brand DNA via `?brandId=` or your last-used brand) and lets you switch brands from a dropdown.

## Where in the app
Not in the side menu. Linked from Brand Studio and the Brand DNA editor.

## Depends on
Brand DNA; MuAPI.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
