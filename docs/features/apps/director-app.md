---
name: Director app (VideoDB agents)
area: apps
status: live
added: 2026-03-26
pr: TBD
route: apps/director (in-app: #/director)
code:
  - apps/director
  - src/components/DirectorPage.js
---

## What it does
Framework for building video agents that reason through video tasks (search, editing, compilation, generation) and stream results, built on VideoDB's "Video-as-Data" infrastructure. The Director page exposes 45 agents wired to the backend.

## Where in the app
In the app as Director (Side menu: Agents > Director).

## Depends on
Python backend and frontend in `apps/director`; VideoDB.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
