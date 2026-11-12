# RemotionUI resource ledger

217 components from https://remotionui.com (MIT, package `remotion-ui`), vendored as pinned source (`src/lib/remotionui/registry.lock.json`, sha256 per file).
Enabled = rendered with no adapter error and not blank in the sandboxed preview frame, **and** a real full-length 1080p MP4 export succeeded in the browser at >= 3 fps. Items below 8 fps are enabled and marked "slower export".

| Status | Count |
|---|---|
| export failed | 3 |
| enabled | 149 |
| needs your own audio/video file | 22 |
| other | 27 |
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
| rui:blur-in | shows text that a customer cannot change (no field visibly changes it) |
| rui:blur-reveal | shows text that a customer cannot change (no field visibly changes it) |
| rui:card-stack-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:caustics-bg | export too slow (1.1 fps at 1080p) |
| rui:chromatic-aberration-wipe | shows text that a customer cannot change (no field visibly changes it) |
| rui:creator-reel | needs an audio or video file that is not part of the library |
| rui:deploy-reveal | shows text that a customer cannot change (no field visibly changes it) |
| rui:device-mockup-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:device-mockup-zoom | needs an audio or video file that is not part of the library |
| rui:directional-wipe | shows text that a customer cannot change (no field visibly changes it) |
| rui:dither-field-bg | needs @paper-design/shaders-react (WebGL / map tiles): not rendered in the sandbox yet |
| rui:effector-field | export too slow (1 fps at 1080p) |
| rui:frosted-glass-wipe | shows text that a customer cannot change (no field visibly changes it) |
| rui:globe-points-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:grain-gradient-bg | needs @paper-design/shaders-react (WebGL / map tiles): not rendered in the sandbox yet |
| rui:grid-pixelate-wipe | MP4 export failed: Could not load mask-image URL data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%2010 |
| rui:hero-loop | shows text that a customer cannot change (no field visibly changes it) |
| rui:landing-code-showcase | shows text that a customer cannot change (no field visibly changes it) |
| rui:map-canvas | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:map-flight | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:map-heat-overlay | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:map-markers | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:map-route | needs maplibre-gl, @turf/turf (WebGL / map tiles): not rendered in the sandbox yet |
| rui:media-frame | needs an audio or video file that is not part of the library |
| rui:media-sequence | needs an audio or video file that is not part of the library |
| rui:particle-field | export too slow (1 fps at 1080p) |
| rui:podcast-clip | needs an audio or video file that is not part of the library |
| rui:pricing-focus | shows text that a customer cannot change (no field visibly changes it) |
| rui:product-turntable-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:scale-in | needs an audio or video file that is not part of the library |
| rui:shake-emphasis | shows text that a customer cannot change (no field visibly changes it) |
| rui:slide-left | shows text that a customer cannot change (no field visibly changes it) |
| rui:social-clip | needs an audio or video file that is not part of the library |
| rui:spatial-push | shows text that a customer cannot change (no field visibly changes it) |
| rui:srt-caption-track | needs an audio or video file that is not part of the library |
| rui:stagger-children | shows text that a customer cannot change (no field visibly changes it) |
| rui:strikethrough-replace | shows text that a customer cannot change (no field visibly changes it) |
| rui:svg-mask-reveal | MP4 export failed: @remotion/web-renderer only supports URL masks with mask-size: 100% 100%, mask-position: 0% 0%, mask-repeat: no-repeat, the border box as or |
| rui:talking-head-layout | needs an audio or video file that is not part of the library |
| rui:text-extrude-3d | needs @remotion/three, @react-three/fiber, @react-three/drei (WebGL / map tiles): not rendered in the sandbox yet |
| rui:text-mask-video | needs an audio or video file that is not part of the library |
| rui:tool-menu-slide | shows text that a customer cannot change (no field visibly changes it) |
| rui:track-matte | needs an audio or video file that is not part of the library |
| rui:transition-blinds | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-card-flip | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-circle-reveal | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-clock-wipe | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-fade | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-light-leak | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-liquid-warp | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-morph-shape | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-slide | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-whip-pan | shows text that a customer cannot change (no field visibly changes it) |
| rui:transition-wipe | shows text that a customer cannot change (no field visibly changes it) |
| rui:tutorial-clip | needs an audio or video file that is not part of the library |
| rui:vu-meter | needs an audio or video file that is not part of the library |
| rui:warp-bands-bg | needs @paper-design/shaders-react (WebGL / map tiles): not rendered in the sandbox yet |
| rui:waveform-bars-radial | needs an audio or video file that is not part of the library |
| rui:waveform-line | needs an audio or video file that is not part of the library |
| rui:zoom-pan-frame | needs an audio or video file that is not part of the library |
| rui:zoom-through | shows text that a customer cannot change (no field visibly changes it) |
