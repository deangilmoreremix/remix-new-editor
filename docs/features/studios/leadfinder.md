---
name: Lead Finder
area: studios
status: live
added: TBD
pr: TBD
route: #/leadfinder
code:
  - src/components/LeadFinderStudio.js
  - src/features/personalization
---

## What it does
Finds local business prospects. "Find business" searches OpenStreetMap by niche and location, scores each prospect and saves leads. The page opens the personalization modal at the Find-business step and lists saved leads with their pipeline stage. Ported from OpenHiggsBolt.

## Where in the app
Not in the side menu and no in-app link found in the code; open the route directly. TBD: confirm the intended entry point.

## Depends on
`/api/personalization/leads` (Supabase); OpenStreetMap.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
