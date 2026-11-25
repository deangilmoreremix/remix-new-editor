# SmartVideo demo videos: portable bundle

69 files (about 72 MB): 15 landing-page videos, 50 studio videos, music-free copies of the three videos that have music, and the hero as WebM.
`manifest.json` lists every file with title, size, duration, resolution, checksum, source type and quality notes. Open `index.html` in a browser to preview everything.

## Format (verified with ffprobe and a full decode of every file)
- Video: H.264 High, `yuv420p`, limited range, BT.709, constant 30 fps, even dimensions, `+faststart` (starts playing before it finishes downloading).
- Audio: none, except `landing/a-hero-loop.mp4`, `b-feature-reel.mp4` and `d-social-9x16.mp4` (AAC, 128 kb/s). Each has a `-nomusic.mp4` twin with no audio track at all.
- `landing/a-hero-loop.webm`: VP9, silent, for browsers that prefer WebM.
- Posters: `.poster.jpg` (works everywhere) and `.poster.webp` (smaller) next to every video.
- Size: every clip is under about 2 MB; hero 3 MB, reel 9.9 MB.

## Use in a web page
```html
<video autoplay muted loop playsinline preload="metadata" poster="videos/landing/c04-image-studio.poster.jpg">
  <source src="videos/landing/c04-image-studio.mp4" type="video/mp4">
</video>
```
- Browsers only autoplay when `muted` is set. Keep `playsinline` for iPhones.
- Hero: put `<source src=".../a-hero-loop.webm" type="video/webm">` before the mp4 source.
- Below the fold: load the sources only when scrolled near (see `examples/lazy-video.js`), and show only the poster image if `prefers-reduced-motion: reduce`.
- Use `a-hero-loop-nomusic.mp4` (or any file without audio) if you don't want the music in the file at all.
- React: `<video autoPlay muted loop playsInline preload="metadata" poster={poster}><source src={src} type="video/mp4" /></video>`. Note React sets `muted` as a property, so also set `ref.current.muted = true` if autoplay is blocked.

## Use outside a browser
Any editor or player that reads standard H.264 MP4 will open these (VLC, QuickTime, Premiere, DaVinci, CapCut, ffmpeg, Android/iOS native players). Upload-based platforms (Shopify, WordPress, Webflow, Wix, Squarespace) accept the MP4 plus the JPG poster.

## Hosting
Serve over HTTPS with `Content-Type: video/mp4` and support for HTTP Range requests (almost every host and CDN does). If the videos are on a different domain than the page, plain `<video>` playback needs no CORS setup; reading frames into a canvas does.

## Things to know before you reuse them
1. **A studio name is burned into the picture** of every studio clip and most landing clips (bottom-left caption). It cannot be removed from these files. Caption-free versions of the studio clips can be rendered on request.
2. **They show the SmartVideo app**, including its name, logo and the floating "Ask SmartVideo" button. Use them where that fits.
3. **Nothing is AI-generated.** They are screen recordings (`source: real-screen-recording`) or screenshots with camera moves (`screenshots-with-camera-moves`) of the real app; `mixed` means both. No frame shows a live generated result.
4. **Quality flags:** 9 studio clips are marked `weak` in the manifest (the page was empty or showed "Brand not found"): asset-editor, brand-dna-editor, campaign-studio, content-library, library, smart-video-scheduler, smartviddownloader, timeline-editor, personalizer. Filter on `quality`.
5. **SmartWarmupAI** (`studio/smartwarmupai.mp4`) shows demo plan and price wording ("10 mailboxes free", "$18.42"). Review before publishing.
6. **Counts:** the app's own pages disagree on model and app counts, so count badges were hidden in these videos. Do not add a count of your own without checking the code.
7. **Music licence:** see `NOTICE.md`. The three music videos use a background track whose original source cannot be traced. Use the `-nomusic` files unless you have checked the licence.
