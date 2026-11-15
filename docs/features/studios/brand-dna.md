---
name: Brand DNA Editor
area: studios
status: live
added: 2026-08-30
pr: TBD
route: #/brand-dna
code:
  - src/components/BrandDnaEditor.js
---

## What it does
Editable review of a brand's extracted "DNA" before it is used elsewhere. Port of Open-Pomelli's DnaEditor.

## Where in the app
Not in the side menu. Linked from Brand Studio and the other brand pages (campaign, asset editor).

## Depends on
`src/lib/brandApi.js`, `brandAnalyzer.js`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
