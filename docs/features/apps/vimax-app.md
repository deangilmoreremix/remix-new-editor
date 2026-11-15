---
name: ViMax pipelines
area: apps
status: live
added: 2026-03-26
pr: TBD
route: apps/vimax
code:
  - apps/vimax
  - src/lib/agents/screenwriterAgent.js
  - src/lib/agents/characterExtractorAgent.js
---

## What it does
Python pipelines that turn an idea (`main_idea2video.py`) or a script (`main_script2video.py`) into a video, using agents such as screenwriter, character extractor, scene extractor and camera image generator. Some of those agents are ported to JavaScript in `src/lib/agents` and used by the agent panel and take selector. The Render page lists ViMax as a connected finishing engine.

## Where in the app
Used inside the app through the agent panel and Render page rather than its own route.

## Depends on
Python backend (Dockerfile, docker-compose) in `apps/vimax`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
