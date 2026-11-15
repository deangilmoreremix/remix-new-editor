---
name: Video Agent
area: studios
status: live
added: 2026-11-02
pr: TBD
route: #/video-agent (alias #/video-agent-studio)
code:
  - src/components/studios/VideoAgentStudio/VideoAgentStudio.js
  - apps/motion-agent
---

## What it does
Describe an animation and the agent writes Remotion code, a live Player previews it, follow-up chat edits it, and Render & Download renders the MP4 in the browser. Port of Remotion's prompt-to-motion-graphics template.

## Where in the app
Side menu: Agents > Video Agent.

## Depends on
`npm run build:motion-agent` output in `public/motion-agent/`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
