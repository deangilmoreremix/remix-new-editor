# RemotionUI resource ledger

217 components from https://remotionui.com (MIT, package `remotion-ui`), vendored as pinned source (`src/lib/remotionui/registry.lock.json`, sha256 per file).
Enabled = rendered with no adapter error and not blank in the sandboxed preview frame, **and** a real full-length 1080p MP4 export succeeded in the browser at >= 3 fps. Items below 8 fps are enabled and marked "slower export".

| Status | Count |
|---|---|
| export failed | 3 |
| enabled | 176 |
| needs your own audio/video file | 22 |
| needs WebGL / map packages | 13 |
| export too slow | 3 |

## Not enabled

| id | reason |
|---|---|
| rui:ai-composer-showcase | MP4 export failed: Error loading image with src: http://127.0.0.1:3101/logo.svg |
| rui:audio-pulse | needs an audio or video file that is not part of the library |
| rui:audio-reactive-scale | needs an audio or video file that is not part of the library |
| rui:audiogram-bars | needs an audio or video file that is not part of the library |
| rui:audiogram-scene | needs an audio or video file that is not part of the library |
| rui:b-roll-stack | needs an audio or video file that is not part of the library |
| rui:beat-pulse-grid | needs an audio or video file that is not part of the library |
| rui:card-stack-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:caustics-bg | export too slow (1.1 fps at 1080p) |
| rui:creator-reel | needs an audio or video file that is not part of the library |
| rui:device-mockup-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:device-mockup-zoom | needs an audio or video file that is not part of the library |
| rui:dither-field-bg | needs @paper-design/shaders-react (WebGL / map tiles): not rendered in the sandbox yet |
| rui:effector-field | export too slow (1 fps at 1080p) |
| rui:globe-points-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:grain-gradient-bg | needs @paper-design/shaders-react (WebGL / map tiles): not rendered in the sandbox yet |
| rui:grid-pixelate-wipe | MP4 export failed: Could not load mask-image URL data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%2010 |
| rui:map-canvas | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:map-flight | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:map-heat-overlay | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:map-markers | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:map-route | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:media-frame | needs an audio or video file that is not part of the library |
| rui:media-sequence | needs an audio or video file that is not part of the library |
| rui:particle-field | export too slow (1 fps at 1080p) |
| rui:podcast-clip | needs an audio or video file that is not part of the library |
| rui:product-turntable-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:scale-in | needs an audio or video file that is not part of the library |
| rui:social-clip | needs an audio or video file that is not part of the library |
| rui:srt-caption-track | needs an audio or video file that is not part of the library |
| rui:svg-mask-reveal | MP4 export failed: @remotion/web-renderer only supports URL masks with mask-size: 100% 100%, mask-position: 0% 0%, mask-repeat: no-repeat, the border box as or |
| rui:talking-head-layout | needs an audio or video file that is not part of the library |
| rui:text-extrude-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:text-mask-video | needs an audio or video file that is not part of the library |
| rui:track-matte | needs an audio or video file that is not part of the library |
| rui:tutorial-clip | needs an audio or video file that is not part of the library |
| rui:vu-meter | needs an audio or video file that is not part of the library |
| rui:warp-bands-bg | needs @paper-design/shaders-react (WebGL / map tiles): not rendered in the sandbox yet |
| rui:waveform-bars-radial | needs an audio or video file that is not part of the library |
| rui:waveform-line | needs an audio or video file that is not part of the library |
| rui:zoom-pan-frame | needs an audio or video file that is not part of the library |
