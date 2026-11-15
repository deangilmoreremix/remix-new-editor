---
name: Timeline Analytics, Audience, Retarget and Alerts
area: timeline
status: live
added: 2026-11-13
pr: deangilmoreremix/remix-new-editor#121
route: Timeline editor > Analytics tab
code:
  - src/cinegen/components/analytics/analytics-tab.tsx
  - src/lib/editor/projectLibrary/analytics
  - src/lib/editor/projectLibrary/retarget
  - src/lib/notificationsBell.js
  - src/lib/editor/publish/analyticsClient.js
---

## What it does
First-party analytics for published videos, an Audience view, Retargeting, and owner Alerts (notifications) inside the new CineGen-based editor.

## Where in the app
Analytics tab of the timeline editor; alerts appear via the notifications bell.

## Depends on
Related PRs: #113, #121 (Analytics, Audience, Retarget and Alerts in the new CineGen editor), #125. Supabase `video_analytics` and `retargeting_notifications` migrations.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
