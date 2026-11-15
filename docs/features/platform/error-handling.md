---
name: Error Boundary and Global Error Handlers
area: platform
status: live
added: 2026-07-31
pr: TBD
route: Wraps the app
code:
  - src/components/ErrorBoundary.jsx
  - src/lib/errorBoundary.js
  - src/lib/errorMessages.js
  - src/lib/studioErrors.js
---

## What it does
Catches uncaught render and runtime errors and shows a recovery screen with a reset action, with shared friendly error messages for studios.

## Where in the app
Shown automatically when something crashes.

## Depends on
None.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
