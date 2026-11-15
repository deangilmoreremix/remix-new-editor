---
name: Ask SmartVideo
area: personalization
status: live
added: 2026-11-13
pr: deangilmoreremix/remix-new-editor#122
route: Floating help assistant on every page
code:
  - src/features/ask-smartvideo/AskSmartVideo.js
  - src/features/ask-smartvideo/askCore.js
---

## What it does
Floating help assistant grounded in the studio registry. It answers questions with source chips that navigate to the right studio, offers starter prompts and video-making journeys, and keeps the conversation as you move between studios (history is kept in sessionStorage for the tab).

## Where in the app
Floating button, mounted once for the whole app (`src/main.js`).

## Depends on
Related PR: #122. `/api/ask-smartvideo`; the user's own OpenAI key.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
