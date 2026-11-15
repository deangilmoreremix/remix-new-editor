---
name: Campaign Studio
area: studios
status: live
added: 2026-08-30
pr: TBD
route: #/campaign; saved campaign detail at #/campaign-page
code:
  - src/components/CampaignWizard.js
  - src/components/CampaignPage.js
  - src/lib/campaignGenerator.js
---

## What it does
Pick a goal, generate campaign concepts, then produce platform-specific assets. A saved campaign's concepts and generated assets can be reopened on the detail page.

## Where in the app
Not in the side menu. Linked from Brand Studio and the Brand DNA editor.

## Depends on
Brand DNA; `campaignGenerator.js`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
