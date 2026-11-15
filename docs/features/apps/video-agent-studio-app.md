---
name: OpenChatCut (video-agent-studio)
area: apps
status: live
added: TBD
pr: TBD
route: apps/video-agent-studio
code:
  - apps/video-agent-studio
  - src/openchatcut
  - src/components/VideoAgentStudioShell.js
---

## What it does
Open-source, agent-native, local-first AI video editor (a ChatCut alternative). Its editor code is vendored in `src/openchatcut` and shared with the timeline export runner. TBD: confirm where `VideoAgentStudioShell.js` is mounted in the UI.

## Where in the app
TBD. Runs alongside the main app with `npm run dev:all`.

## Depends on
`apps/video-agent-studio` dev server; see its CHANGELOG.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
