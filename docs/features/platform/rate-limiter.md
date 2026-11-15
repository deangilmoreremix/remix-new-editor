---
name: Rate Limiter
area: platform
status: live
added: 2026-07-06
pr: TBD
route: `src/lib/services/RateLimiter.js`
code:
  - src/lib/services/RateLimiter.js
---

## What it does
Token-bucket limiter with a queue, defaulting to 200 calls per hour, written to respect Pexels API limits (200 requests/hour free tier). Wired into `src/lib/muapi.js`, `src/lib/services/aiService.js` and `src/services/whisper-client.js`.

## Where in the app
No UI.

## Depends on
None.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
