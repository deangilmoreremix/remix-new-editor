---
name: Personalizer
area: studios
status: live
added: 2026-08-23
pr: TBD
route: #/personalizer
code:
  - src/components/Personalizer.js
---

## What it does
Canvas editor for building personalized web pages. Drag text, image, button, form, video and spacer elements onto a free-form canvas, bind them to personalization tokens, and preview the page live for different contacts.

## Where in the app
Side menu: Agents > Personalizer.

## Depends on
Contact data (`src/lib/contactStore.js`).

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
