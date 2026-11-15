---
name: Motion Agent app (Remotion prompt to motion graphics)
area: apps
status: live
added: 2026-11-02
pr: TBD
route: apps/motion-agent (in-app: #/video-agent)
code:
  - apps/motion-agent
  - src/components/studios/VideoAgentStudio/VideoAgentStudio.js
---

## What it does
Remotion's prompt-to-motion-graphics template: describe an animation, an agent writes Remotion code, a Player previews it, and chat edits refine it. Built into `public/motion-agent/` and hosted by the Video Agent studio.

## Where in the app
In the app as Video Agent (Side menu: Agents > Video Agent).

## Depends on
`npm run build:motion-agent`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
