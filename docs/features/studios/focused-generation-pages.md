---
name: Focused Generation Pages
area: studios
status: live
added: 2026-03-15
pr: TBD
route: #/text-to-image, #/image-to-image, #/text-to-video, #/image-to-video, #/video-to-video, #/video-watermark
code:
  - src/components/TextToImagePage.js
  - src/components/ImageToImagePage.js
  - src/components/TextToVideoPage.js
  - src/components/ImageToVideoPage.js
  - src/components/VideoToVideoPage.js
  - src/components/VideoWatermarkPage.js
---

## What it does
Six single-purpose landing pages, each with a hero, a model list and a hand-off to the main Image or Video studio (a model picked here is carried into the studio).

## Where in the app
Not in the side menu and no in-app link found in the code; open the route directly. TBD: confirm the intended entry point.

## Depends on
MuAPI model catalog.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
