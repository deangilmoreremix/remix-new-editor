---
name: Website Builder (OpenThorn)
area: studios
status: live
added: TBD
pr: TBD
route: #/website-builder
code:
  - src/components/OpenThornStudio.js
  - apps/openthorn
---

## What it does
Embeds the OpenThorn AI website builder, a bring-your-own-key tool, always opening on its Dashboard. In dev it loads a separate Vite server on :5173; in production it loads the static build from `/openthorn/`.

## Where in the app
Side menu: Agents > Website.

## Depends on
apps/openthorn build; the user's own AI provider key.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
