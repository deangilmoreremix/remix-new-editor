---
name: OpenThorn app (AI website builder)
area: apps
status: live
added: 2026-10-08
pr: TBD
route: apps/openthorn (in-app: #/website-builder)
code:
  - apps/openthorn
  - src/components/OpenThornStudio.js
---

## What it does
Free, bring-your-own-key AI website builder (a Lovable / Bolt.new / v0 alternative). You pay your AI provider directly.

## Where in the app
In the app as Website (Side menu: Agents > Website).

## Depends on
Own API key; static build served at `/openthorn/`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
