---
name: Timeline Studio Editor
area: timeline
status: live
added: 2026-11-07
pr: deangilmoreremix/remix-new-editor#110
route: #/timeline (previous editor at #/timeline-classic)
code:
  - src/cinegen/mount.tsx
  - src/cinegen/components/edit/timeline-editor.tsx
  - src/cinegen/components/edit/library-panel.tsx
  - src/cinegen/components/edit/track-row.tsx
  - src/cinegen/components/edit/clip-properties-panel.tsx
---

## What it does
Multi-track video editor based on the vendored CineGen workspace, with this app's colours and features. It has a media Library, drag-and-drop onto tracks, a 4-track default layout and a clip properties panel (transform, transition, zoom, effects, layout, captions, multicam). Also includes keyframe, caption and overlay lanes, a source viewer with a mask tool, sound and music popups, and Extend, Fill gap, Follow subject and Sync audio dialogs. TBD: confirm each dialog is user-visible.

## Where in the app
Side menu: Agents > Timeline.

## Depends on
Related PR: #110 (Library, drag-and-drop, 4-track default, clearer clips, playback fix). MuAPI; `src/cinegen/lib`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
