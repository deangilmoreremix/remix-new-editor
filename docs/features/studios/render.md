---
name: Render
area: studios
status: live
added: TBD
pr: TBD
route: #/render
code:
  - src/components/RenderPage.js
  - src/lib/editor/renderAiActions.js
---

## What it does
Render and export page. Exports WebM (VP9), MP4 (H.264) and MP4 (H.265), and offers AI actions: subtitles, highlights, voiceover, shorts and AI auto-edit. Shows which connected engines power rendering (Open Higgsfield, SmartVideo, Director, ViMax, Rendiv, LTX-Desktop, chatvideo-yucut).

## Where in the app
Not in the side menu. Linked from the landing page header, the Director page and the OpenMontage page.

## Depends on
Render engines; `renderAiActions.js`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
