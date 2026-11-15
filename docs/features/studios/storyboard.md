---
name: Storyboard Studio
area: studios
status: live
added: TBD
pr: TBD
route: #/storyboard; overview at #/storyboard-page
code:
  - src/components/StoryboardStudio.js
---

## What it does
Plan a video as a set of frames. Layouts: Horizontal, Grid and Story. Save and load named projects (stored in the browser), undo and redo, and export a PDF shot sheet, CSV shot list or JSON. Frames can be sent to the Template Studio.

## Where in the app
Side menu: Video > Storyboard.

## Depends on
Browser localStorage for saved projects; MuAPI and OpenAI for frame generation (`src/lib/openaiService.js`).

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
