---
name: Character Studio
area: studios
status: live
added: TBD
pr: TBD
route: #/character; overview at #/character-page
code:
  - src/components/CharacterStudio.js
---

## What it does
Creates consistent character images from a reference photo using face ID preservation. Models: Flux PuLID (Black Forest Labs) and Subject Reference (MiniMax).

## Where in the app
Side menu: Image > Character.

## Depends on
MuAPI; Dynamic Control Engine.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
