---
name: CineGen app
area: apps
status: live
added: 2026-10-25
pr: TBD
route: apps/cinegen (in-app: #/timeline)
code:
  - apps/cinegen
  - src/cinegen/mount.tsx
---

## What it does
Upstream CineGen: a video editor with a multi-track timeline, node-based generation workflows and an LLM assistant that can search the project and make edits, with 50+ AI models for image, video and audio. Its workspace is vendored into `src/cinegen` and powers the Timeline Studio Editor; the unmodified clone can still be shown in an iframe via `CineGenFramePage.js`.

## Where in the app
In the app as the Timeline (Side menu: Agents > Timeline). The old `#/cinegen` link redirects to the Workbench.

## Depends on
Electron desktop build in `apps/cinegen`; vendored web build in `src/cinegen`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
