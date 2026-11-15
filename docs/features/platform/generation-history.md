---
name: Generation History
area: platform
status: live
added: 2026-08-24
pr: TBD
route: Saved automatically after each generation; shown in Library
code:
  - src/lib/generationHistory.js
  - src/lib/serverHistory.js
  - supabase/functions/generation-history
---

## What it does
Saves each completed generation to the browser (immediate, works offline) and to the Supabase `generation_history` table (cross-device, feeds the Library). The server write is fire-and-forget, so a failure never loses the local copy.

## Where in the app
Library page and each studio's recent results.

## Depends on
Supabase `generation_history` table.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
