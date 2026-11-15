---
name: Security Helpers
area: platform
status: live
added: 2026-03-24
pr: TBD
route: `src/lib/security.js`
code:
  - src/lib/security.js
---

## What it does
Shared safe-DOM and input helpers: safe element, image, video, SVG and button builders, `escapeHtml`, `sanitizeUrl` and `validateFileUpload`. Studios use them instead of raw `innerHTML` for user-supplied text.

## Where in the app
No UI.

## Depends on
None.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
