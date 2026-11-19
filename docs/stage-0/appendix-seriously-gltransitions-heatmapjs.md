# Audit: Seriously.js, gl-transitions, heatmap.js

All paths are relative to `/tmp/claude-0/-home-user/ed6a1d8a-3b9d-58b8-9841-6ef0cfce8ef8/scratchpad/up/`.
Read-only static audit. Nothing from the repos was executed. Line counts come from `wc -l`.
Seriously.js was inspected by grep and reading only. Counts of "types" come from regexes over `inputs:` blocks and can be off by one for odd files.

---------------------------------------------------------------------
## 1. Seriously.js (`Seriously.js/`, commit 513d2b8)

### 1.1 Repo-level facts
| Item | Finding |
|---|---|
| Last commit | **2015-09-08** (the clone is shallow: 1 commit visible). No `package.json`, no tags/version in `seriously.js`. |
| Maintenance | **Abandoned**. About 11 years old at the audit date (2026-11-13). Written as AMD/CommonJS/global UMD per file; no build system, no TypeScript, no npm package in the tree. |
| Overall licence | **MIT**, `Seriously.js/LICENSE` ("Copyright (c) 2012-2014 Brian Chirls"). `Seriously.js/README.md` L111-114: "Individual plugins may be licensed differently. Check source code comments." `CONTRIBUTING.md` L10: copied shaders need "appropriate license and credit". |
| WebGL version | **WebGL 1 only**: `canvas.getContext('webgl' / 'experimental-webgl')` (`seriously.js` L539-552). All shaders are GLSL ES 1.00 (`attribute`, `varying`, `texture2D`, `gl_FragColor`, `precision mediump float`). Per `README.md` L83-94 and the code there is no WebGL2 path. GLSL ES 1.00 still compiles in a WebGL2 context, so lifted fragment bodies work if wrapped as in `gl-transitions/packages/remotion/src/renderer.ts`. |
| Runtime | `seriously.js` is 6776 lines: node graph, shader program cache, `commonShader` template (a `vTexCoord` varying, a `source` sampler, `resolution`, `transform` uniforms), FrameBuffer utility, video/canvas/image sources. Effects only register via `Seriously.plugin(name, def)`. Using them outside it means copying the GLSL string and rewriting the uniform plumbing. |
| Other dirs | `sources/` (array, camera, depth, imagedata, three; 50-180 lines): source adapters, tied to Seriously runtime and DOM media, **not portable**. `targets/seriously.three.js` (168 lines): three.js target. `transforms/` (camerashake 470, transform3d 586): vertex/matrix transforms in Seriously's pipeline. `lib/` is vendored: `three.js` (35133 lines), `require.js`, `rStats.js`, `webgl-debug.js`. `util/medialoader.js` (136 lines). Not relevant for a lift. |
| External deps | None at runtime, except `expression.js` which embeds **jsep v0.2.9** (MIT, minified at L537-538). Examples vendor three.js (MIT, in `lib/`). |

### 1.2 Licence flags (grep over `effects/`)
| Licence | Files | Consequence |
|---|---|---|
| **CC BY-NC-SA 3.0 (non-commercial, share-alike)**, v002 / Anton Marini (vade) | `seriously.blur.js` (L5-9), `seriously.directionblur.js` (L5-9), `seriously.bleach-bypass.js` (L22-25), `seriously.opticalflow.js` (L22-26, Andrew Benson shader, https://v002.info/licenses/) | **Do not copy into a commercial or MIT product.** Re-implement from scratch (a standard Gaussian or box blur is trivial and unencumbered). |
| **CC BY 3.0** (attribution), Martins Upitis | `seriously.filmgrain.js` (L5-8, "Modified to preserve alpha") | Usable with attribution; not MIT. Must carry the credit and the CC BY notice. |
| MIT (embedded notice), BBC / David Lewis | `seriously.daltonize.js` (L26-50) | OK; keep the BBC copyright notice. |
| "borrowed from Paul Golds @ BBC R&D, with permission" | `seriously.lut.js` (L24) | **No licence text, only a "with permission" note.** Legally unclear for redistribution. Treat as unlicensed; write a LUT shader from scratch (it is a standard 2D-strip LUT lookup). |
| "todo: apply proper credit and license", adapted from Romain Dura mouaif.wordpress.com blend-mode GLSL | `seriously.blend.js` (L23-27); `seriously.accumulator.js` (L21-22) credits the same source | Licence unknown. The Photoshop-blend-mode GLSL math is widely reproduced; still flag it. |
| Adapted from **glfx.js** (Evan Wallace, MIT) | `seriously.hex.js` (L22-23), `seriously.vibrance.js` (L24-25); `hue-saturation.js` L20 "inspired by" | MIT; keep a notice. |
| Other credited or inspired-by, licence not stated | `ascii.js` (tllabs / gfxile textfx), `dither.js` (Martins Upitis blog), `edge.js` (rastergrid Frei-Chen), `fxaa.js` (horde3d FXAA), `nightvision.js` (geeks3d tutorial), `ripple.js` (MSDN XNA), `sepia.js`, `sketch.js` ("inspired by" adjazent pixel bender), `temperature.js` (Tanner Helland algorithm), `colorcube.js` (Gregg Tavares video), `whitebalance.js` (Stanford thesis, ikaros GPL project, Bruce Lindbloom matrices), `vibrance.js`, `colorcomplements.js` | No explicit licence. Formulae are generic, but treat as "clean-room re-implement advisable". `whitebalance.js` references `ikaros` (GPL) as an algorithm source, not copied code. |
| No third-party note (Brian Chirls, so MIT via repo LICENSE) | everything else, e.g. chroma, displacement, exposure, emboss, kaleidoscope, lumakey, noise, pixelate, scanlines, vignette, freeze, tvglitch, polar, mirror, invert, etc. | MIT. Note `tvglitch.js` has no credit although it is unusual code (original by Chirls). |

### 1.3 Effects requested (the 22 you named)
Line counts are the whole plugin file (about 20-25 lines of JS/AMD boilerplate included). "Single-pass" means the `commonShader: true` plus `shader: function(inputs, shaderSource)` form that returns one GLSL fragment string. "Multi-pass" or "runtime" means the plugin overrides `draw`, uses `Seriously.util.FrameBuffer`, or keeps state between frames.

| Effect (file) | Seriously type | Params (name:type=default) | Lines | Licence | Portability |
|---|---|---|---|---|---|
| Film grain (`filmgrain.js`) | single-pass | `amount:number=0.03 [0..1]`, `colored:boolean=false`, `time:number` (host must advance it) | 157 | **CC BY 3.0** (martinsh) | **High**. Pure fragment shader; feed `time` = frame/fps. Needs attribution; or re-write (hash noise is trivial). |
| Chroma key (`chroma.js`) | single-pass, inPlace | `screen:color=(66,195,31)/255`, `weight:number=1 [min 0]`, `balance:number=1 [0..1]`, `clipBlack:number=0`, `clipWhite:number=1`, `mask:boolean=false` | 178 | MIT | **High**. Pure GLSL; one `texture2D`. |
| Blur / Gaussian (`blur.js`) | **2-pass** (horizontal then vertical FrameBuffers) | `amount:number=0.2 [0..1]`, `blendGamma:number=2.2 [0..4]` | 260 | **CC BY-NC-SA 3.0 (v002)** | **Licence blocker**, and needs a 2-pass runtime. Re-implement. |
| Directional blur (`directionblur.js`) | single draw override with extra framebuffers | `amount:number=0.4`, `angle:number=0`, `blendGamma:number=2.2` | 260 | **CC BY-NC-SA 3.0 (v002)** | **Licence blocker.** Re-implement. |
| Displacement (`displacement.js`) | single-pass, **2 image inputs** (`source`, `map`) | `xChannel:enum=red`, `yChannel:enum=green`, `fillMode:enum=color`, `color:color=(0,0,0,0)`, `offset:number=0.5`, `mapScale:vector=[1,1]`, `amount:number=1` | 195 | MIT | **High** as GLSL, provided the host binds a second texture (map). Needs `shaderDirty` enum switching via string-built GLSL. |
| TV glitch (`tvglitch.js`) | **multi-pass**: draws particle geometry into a FrameBuffer, then composites (`inPlace: false`) | `time`, `distortion=0.1`, `verticalSync=0.1`, `lineSync=0.2`, `scanlines=0.3`, `bars=0`, `barsRate=1`, `frameShape=0.27`, `frameLimit=0.34`, `frameSharpness=8.4`, `frameColor=(0,0,0,1)` | 310 | MIT (no third-party note) | **Low/Medium**. Particle pass (`particleCount=20`, own shader + buffer) needs porting to a second pass or a procedural replacement. The main-pass GLSL could be lifted alone. |
| Kaleidoscope (`kaleidoscope.js`) | single-pass | `segments:number=6`, `offset:number=0` | 75 | MIT | **High**, tiny. |
| Night vision (`nightvision.js`) | single-pass | `time`, `luminanceThreshold=0.1`, `amplification=1.4`, `color=[0.1,0.95,0.2]` | 87 | MIT in repo; "based on" geeks3d tutorial (no licence) | **High**; has a noise function driven by `time`. |
| Vignette (`vignette.js`) | single-pass | `amount:number=1 [min 0]` | 56 | MIT | **High**. |
| Optical flow (`opticalflow.js`) | **multi-pass + previous-frame FrameBuffer** (Horn-Schunck) | `lambda=0`, `scaleResult=[1,1]`, `offset=1 [1..100]` | 145 | **CC BY-NC-SA 3.0** (Andrew Benson, v002) | **Do not use**: NC licence and needs frame history. |
| LUT (`lut.js`, also `colorcube.js` 71 lines) | single-pass, **2 image inputs** (`source`, `lut` texture) | `amount:number=1 [0..1]` | 87 | "borrowed from Paul Golds @ BBC R&D, with permission" (no licence text); `colorcube.js` is Chirls MIT but "based on tutorial by Gregg Tavares" | GLSL is portable, **licence is unclear**. Needs a second texture. Write a fresh LUT shader. |
| Luma key (`lumakey.js`) | single-pass | `clipBlack=0.9`, `clipWhite=1`, `invert=false` | 78 | MIT | **High**. |
| Freeze (`freeze.js`) | runtime: `draw` override that **skips drawing** when `frozen` (not a shader at all) | `frozen:boolean=false` | 44 | MIT | **Not a shader.** In Remotion do it with `useCurrentFrame()` clamping or `<Freeze>`. |
| Edge detect (`edge.js`) | single-pass; shader string rebuilt per `mode` | `mode:enum=sobel` (`sobel`, `frei-chen`) | 170 | MIT; Frei-Chen matrices adapted from rastergrid blog (no licence) | **High** (3x3 kernel, one sampler). |
| Emboss (`emboss.js`) | single-pass | `amount:number=1 [-85..85]` | 91 | MIT | **High**. |
| Noise (`noise.js`) | single-pass | `overlay:boolean=true`, `amount=1`, `time` | 86 | MIT | **High**. |
| Scanlines (`scanlines.js`) | single-pass | `lines:number=60`, `size=0.2`, `intensity=0.1` | 74 | MIT | **High**. |
| Sketch (`sketch.js`) | single-pass (9 texture taps) | no params (source only) | 87 | MIT; "inspired by" a Pixel Bender post | **High**. |
| Ripple (`ripple.js`) | single-pass | `wave:number=PI/0.75`, `distortion=1`, `center:vector=[0.5,0.5]` | 72 | MIT; formula from an MSDN XNA page | **High**. |
| Pixelate (`pixelate.js`) | single-pass | `pixelSize:vector=[8,8]` (pixels) | 56 | MIT | **High**. |
| White balance (`whitebalance.js`) | **multi-pass**: `draw` override averages the frame, then corrects (7 `texture2D` taps) | `white:color=[1,1,1]`, `auto:boolean=true` (plus an `inputs` input set) | 249 | MIT; theory from a Stanford paper, matrices from Bruce Lindbloom | **Medium/Low**. Auto mode needs a downsample/readback pass. Manual mode is a pure matrix in a fragment shader. |
| Exposure (`exposure.js`) | single-pass | `exposure:number=1 [-8..8]` (stops) | 58 | MIT | **High**. |

Not found in the repo: no "glitch" other than `tvglitch`; no `grain` besides `filmgrain`/`noise`; no standalone "gaussian" besides `blur.js`; no "kaleidoscope" besides `kaleidoscope.js`.

### 1.4 Full effects inventory (`effects/`, 60 files)
Param types are counted from `inputs:`; "src" means the `source` image input. Class: **S** = single-pass commonShader (liftable), **M** = multi-pass / stateful / multiple inputs needing runtime, **R** = not a shader (runtime/JS).

| File | Effect | Lines | Class | Notes (type counts) | Licence note |
|---|---|---:|---|---|---|
| accumulator | Accumulator | 434 | M | prev-frame FrameBuffer; bool, color, enum, 2 number | Romain Dura (no licence) |
| ascii | Ascii Text | 186 | M | draw override, FrameBuffer (glyph texture); color | tllabs / gfxile (no licence) |
| bleach-bypass | Bleach Bypass | 90 | S | 1 number | **CC BY-NC-SA (vade)** |
| blend | Blend | 627 | M | 2 images (top/bottom), 2 enum, 2 number | **"todo: apply proper credit and license"** |
| blur | Gaussian Blur | 260 | M | 2-pass | **CC BY-NC-SA (v002)** |
| brightness-contrast | Brightness/Contrast | 72 | S | 2 number | MIT |
| channels | Channel Mapping | 375 | M | 5 enum, 5 images | MIT |
| checkerboard | Checkerboard | 132 | S | generator, no source | MIT |
| chroma | Chroma Key | 178 | S | see 1.3 | MIT |
| color-select | Color Select | 264 | S | 12 number, bool | MIT |
| color | Color | 145 | M | generator | MIT |
| colorcomplements | Color Complements | 129 | S | color, 3 number | link to HSV GLSL (lolengine) |
| colorcube | Color Cube | 71 | S | 2 images | Gregg Tavares tutorial |
| crop | Crop | 158 | M | geometry; 4 number | MIT |
| daltonize | Daltonize | 170 | S | enum | MIT (BBC notice embedded) |
| directionblur | Directional Motion Blur | 260 | M | see 1.3 | **CC BY-NC-SA (v002)** |
| displacement | Displacement Map | 195 | S (2 images) | see 1.3 | MIT |
| dither | Dither | 98 | S | none | Martins Upitis blog |
| edge | Edge Detect | 170 | S | enum | rastergrid blog |
| emboss | Emboss | 91 | S | 1 number | MIT |
| exposure | Exposure | 58 | S | 1 number | MIT |
| expression | Expression | 541 | R | string expressions compiled to GLSL; embeds **jsep v0.2.9** | MIT (jsep) |
| fader | Fader | 64 | S | color, number | MIT |
| falsecolor | False Color | 64 | S | 2 colors | MIT |
| filmgrain | Film Grain | 157 | S | see 1.3 | **CC BY 3.0** |
| freeze | Freeze | 44 | R | see 1.3 | MIT |
| fxaa | FXAA | 142 | S | none (9 taps) | horde3d wiki |
| gradientwipe | Gradient Wipe | 190 | M | 2 images + gradient | MIT |
| hex | Hex | 105 | S | vector, number | glfx.js (MIT) |
| highlights-shadows | Highlights/Shadows | 71 | S | 2 number | MIT |
| hue-saturation | Hue/Saturation | 119 | S | 2 number | glfx-inspired |
| invert | Invert | 48 | S | none | MIT |
| kaleidoscope | Kaleidoscope | 75 | S | see 1.3 | MIT |
| layers | Layers | 255 | M | multi-input compositor | MIT |
| linear-transfer | Linear Transfer | 63 | S | 2 vectors | MIT |
| lumakey | Luma Key | 78 | S | see 1.3 | MIT |
| lut | Color LUT | 87 | S (2 images) | see 1.3 | **unclear ("with permission")** |
| mirror | Mirror | 47 | S | none | MIT |
| nightvision | Night Vision | 87 | S | see 1.3 | geeks3d tutorial |
| noise | Noise | 86 | S | see 1.3 | MIT |
| opticalflow | Optical Flow | 145 | M | see 1.3 | **CC BY-NC-SA** |
| panorama | Panorama | 185 | M | geometry; 5 number | MIT |
| pixelate | Pixelate | 56 | S | see 1.3 | MIT |
| polar | Polar Coordinates | 58 | S | 1 number | MIT |
| repeat | Repeat | 204 | M | geometry; 3 number | MIT |
| ripple | Ripple Distortion | 72 | S | see 1.3 | MSDN |
| scanlines | Scan Lines | 74 | S | see 1.3 | MIT |
| select | Select | 178 | R/M | enum switch over inputs | MIT |
| sepia | Sepia | 61 | S | none | techrepublic link |
| simplex | Simplex Noise | 145 | S | generator; 6 number, 2 vector, 2 color, `time` | MIT (check: simplex noise code is commonly Ashima/MIT, no credit given) |
| sketch | Sketch | 87 | S | none | inspired-by |
| split | Split | 281 | M | 2 inputs | MIT |
| temperature | Color Temperature | 101 | S | 1 number | Tanner Helland algorithm |
| throttle | Throttle | 55 | R | frame-rate limiter (time, FrameBuffer) | MIT |
| tone | Tone | 81 | S | 2 colors, 2 number | MIT |
| tvglitch | TV Glitch | 310 | M | see 1.3 | MIT |
| vibrance | Vibrance | 78 | S | 1 number | glfx.js (MIT); v002 link at L49 |
| vignette | Vignette | 56 | S | see 1.3 | MIT |
| whitebalance | White Balance | 249 | M | see 1.3 | MIT (research refs) |
| sepia, invert, mirror, fader etc. | (small colour ops) | 47-64 | S | | MIT |

Summary: 60 effects. About 38 are single-pass `commonShader` fragments (liftable with only the uniform plumbing rewritten). About 16 need a multi-pass, multi-input or stateful runtime. 5 (`expression`, `freeze`, `throttle`, `select`, partly `layers`) are runtime logic rather than shaders.
**NC/SA blockers: blur, directionblur, bleach-bypass, opticalflow.** Attribution-only: filmgrain. Unclear: lut, blend.

### 1.5 Verdict
Treat Seriously.js as a **reference collection of GLSL snippets**, not a dependency. It cannot run in Remotion (WebGL1, global DOM sources, no module build). Safe-to-lift (MIT, single-pass): chroma key, displacement (2 textures), kaleidoscope, night vision, vignette, luma key, edge, emboss, noise, scanlines, sketch, ripple, pixelate, exposure, hue/saturation, brightness/contrast, sepia, etc. Re-implement from scratch: blur, directional blur, optical flow, LUT, bleach bypass. Attribute: film grain (CC BY 3.0). TV glitch needs porting of its particle pass.

---------------------------------------------------------------------
## 2. gl-transitions (`gl-transitions/`, commit d2f250e, HEAD dated 2026-11-13)

### 2.1 Repo facts
| Item | Finding |
|---|---|
| Root licence | **MIT**, `gl-transitions/LICENSE` ("Copyright (c) 2017-present gl-transitions contributors"). README L"License": "Each transition states its license in its header... all are MIT except two under BSD licenses". |
| Maintenance | **Active**. Last commit 2026-11-13; npm `gl-transitions` 3.2.0 (`packages/gl-transitions/package.json`), changelog lists new transitions; CI renders every transition, compatibility matrix in the npm package. |
| Spec | `gl-transitions/README.md` "GL Transition Specification v1": GLSL **ES 1.00 (WebGL1)**. Host provides `precision`, `progress`, `ratio`, `getFromColor(uv)`, `getToColor(uv)`, `main()`. No `gl_FragCoord`, no `resolution`. Straight (non-premultiplied) RGBA. Header: `// Author:` and `// License:` required (missing licence is treated as MIT). Optional `// Description:` and `// Tags:`. Parameters are `uniform` with default in a `// = value` comment. Hints: `@range`, `@color`, `@param`. |
| Count | **220** `*.glsl` in `transitions/`, no other file types. 220 have Description/Tags lines. 127 are authored by `gre`. |
| Extra textures | **2** transitions declare a `uniform sampler2D`: `DisplacementMap` (`displacementMap`) and `LumaWipe` (`luma`). `GlitchDisplace.glsl` mentions `texture2D(from, p)` only in a comment (L75); it needs no extra texture. |
| Licence distribution | **MIT: 218. BSD 3 Clause: 1 (`InvertedPageCurl`, Hewlett-Packard). BSD 2 Clause: 1 (`StereoViewer`, Ted Schundler).** No GPL/NC. All 220 have a `License:` line. |
| Other packages in this repo | `packages/gl-transitions` (npm lib: `index.d.ts`, `sksl/`, README, CHANGELOG), `packages/react-native-skia`, `packages/remotion`. **`gl-transition-libs` and `gl-transition-utils` are not in this repo**: README points to `github.com/gl-transitions/gl-transition-libs` (separate repo providing `gl-transition`, `regl-transition`, `react-gl-transition`, `gl-transition-scripts`). Also in-tree: `swift/`, `android/`, `crates/` (Rust), `skills/gl-transitions/SKILL.md` (agent skill), `scripts/`. |
| npm lib format | `packages/gl-transitions/index.d.ts`: `Transition { name, author, license, glsl, description?, tags[], params{name:{type,default?,min?,max?,step?,color?,description?}}, textures[], paramsTypes, defaultParams (legacy), createdAt?, updatedAt? }`. Also ships GLSL3, SkSL, WGSL, MSL, AGSL translations with `compatibility.json` and `layouts.json`. |

### 2.2 All 220 transitions
Format: name | author | licence | lines | custom params (type name=default). `TEX x` = extra sampler2D. (None) = only `progress`/`ratio`. All MIT unless marked.

Abbreviated rows, params as parsed from the `// = value` comments:

| Name | Author | Lic | Ln | Params |
|---|---|---|---:|---|
| Accordion | gre | MIT | 84 | int pleats=4; vec2 direction=(-1,0); float shading=0.7; float perspective=1.5; vec4 backColor=(0,0,0,1) |
| ApertureWipe | gre | MIT | 44 | int blades=6; float rotation=60; float shadow=0.5 |
| ArrowWipe | gre | MIT | 99 | vec2 direction=(1,0); float notch=0.4; float width=80; int count=1; bool origin=false; float smoothness=0.004 |
| Ascii | gre | MIT | 123 | float cellSize=0.04; bool colored=true; vec4 ink=(0.3,1,0.45,1); vec4 background=(0,0,0,1) |
| BandWipe | gre | MIT | 66 | int bands=8; bool vertical=false; float smoothness=0.02; float stagger=0.1 |
| BlockCover | gre | MIT | 86 | int blocks=16; vec4 color=(0.95,0.32,0.26,1); float pop=0.5; float smoothness=0.03 |
| BlockSlide | gre | MIT | 86 | ivec2 grid=(5,4); vec2 direction=(1,0); float stagger=0.6; float zoom=0.35; vec4 background=(0,0,0,1) |
| BloomDissolve | gre | MIT | 109 | float spread=0.25; float threshold=0.6; float intensity=1.5; vec3 tint=(1,0.9,0.75) |
| BokehDissolve | gre | MIT | 122 | float radius=0.05; int blades=0; float threshold=0.7; float intensity=1 |
| BookFlip | hong | MIT | 139 | float perspective=0.5; float shading=0.6; float curl=0.5 |
| Bounce | Adrian Purser | MIT | 35 | vec4 shadow_colour=(0,0,0,.6); float shadow_height=0.075; float bounces=3 |
| BowTie | KMojek | MIT | 73 | float adjust=0.5; bool reverse=false |
| BowTieHorizontal | huynx | MIT | 122 | (none) |
| BrushWipe | gre | MIT | 99 | float strokes=4; float angle=-7; float roughness=0.6; float waviness=0.5 |
| BurnThrough | liubailin2020@gmail.com | MIT | 54 | vec3 burnColor=(1,0.5,0) |
| ButterflyWaveScrawler | mandubian | MIT | 33 | float amplitude=1; float waves=30; float colorSeparation=0.3 |
| CameraShake | gre | MIT | 97 | float strength=0.5; float jolts=12; float blur=0.5; float split=0.5 |
| CardSwipe | gre | MIT | 80 | vec2 direction=(1,0.25); float rotation=0.5; float depth=0.15; vec4 backColor=(0.06,0.06,0.07,1) |
| CellDissolve | gre | MIT | 90 | float cells=8; float smoothness=0.1; float border=0.006; vec4 borderColor=(1,0.95,0.8,1); float seed=0 |
| Chessboard | lql | MIT | 27 | float grid_num=10 |
| CircleBurst | gre | MIT | 76 | vec2 center=(0.5,0.5); vec4 color1; vec4 color2; vec4 color3; float stagger=0.3 |
| CircleIris | Fernando Kuteken | MIT | 23 | vec2 center=(0.5,0.5); vec4 backColor=(0.1,0.1,0.1,1) |
| CircleOpen | gre | MIT | 17 | float smoothness=0.3; bool opening=true |
| ClockWipe | Fernando Kuteken | MIT | 24 | float startingAngle=90 |
| Clothesline | gre | MIT | 216 | float direction=1; float sway=0.5; float size=0.72; vec4 background; vec4 lineColor; vec4 pinColor |
| CodeRain | gre | MIT | 113 | float cellSize=0.045; float trail=0.5; float tint=0.5; vec4 glow=(0.2,1,0.4,1) |
| ColorCoords | haiyoucuv | MIT | 17 | (none) |
| ColorDistance | P-Seebauer | MIT | 18 | float power=5 |
| ColorPanelWipe | gre | MIT | 74 | vec2 direction=(1,0); int panels=3; vec4 color1,2,3; float stagger=0.35; float skew=0.25 |
| ColorPhase | gre | MIT | 18 | vec4 fromStep=(0,0.2,0.4,0); vec4 toStep=(0.6,0.8,1,1) |
| ColorWrap | Yoni Maltsman @friendlyspinach | MIT | 20 | float r_strength=1; float g_strength=1; float b_strength=1 |
| Comb | gre | MIT | 25 | int strips=10; bool vertical=false |
| ComicPanels | gre | MIT | 173 | float gutter=0.03; vec4 gutterColor=(1,1,1,1); vec4 borderColor=(0,0,0,1); float seed=0 |
| CrazyParametricFun | mandubian | MIT | 19 | float a=4; float b=1; float amplitude=120; float smoothness=0.1 |
| Crosshatch | pthrasher | MIT | 19 | vec2 center=(0.5); float threshold=3; float fadeEdge=0.1 |
| CrossWarp | Eke Peter | MIT | 9 | (none) |
| CrossZoom | rectalogic | MIT | 67 | float strength=0.4 |
| Crumple | gre | MIT | 172 | int creases=16; float size=0.2; vec2 direction=(1,0.4); vec4 paper; vec4 shadow |
| Cube | gre | MIT | 123 | float persp=0.7; float unzoom=0.3; float reflection=0.4; float floating=3; float shading=0.5 |
| CurtainRise | gre | MIT | 70 | float swags=3; float sag=0.14; float ruffles=14; float shading=0.7 |
| Curtains | gre | MIT | 46 | float folds=7; float shading=0.7; float bunch=0.12; float sway=0.4 |
| CurvedWipe | gre | MIT | 51 | vec2 direction=(0,1); float curvature=0.6; float smoothness=0.02; vec4 shadow |
| CylinderRoll | gre | MIT | 101 | float curvature=0.8; float blur=0.5; float shading=0.6; float chroma=0.5; bool downward=false |
| DefocusBlur | Sergey Kosarevsky | MIT | 46 | float blurSize=0.02 |
| DiamondWipe | gre | MIT | 20 | vec2 center=(0.5); float smoothness=0.03 |
| Directional | Gaetan Renaudeau | MIT | 17 | vec2 direction=(0,1) |
| DirectionalEased | Max Plotnikov | MIT | 18 | vec2 direction=(0,1) |
| DirectionalScaled | Thibaut Foussard | MIT | 34 | vec2 direction=(0,1); float scale=.7 |
| DirectionalWarp | pschroen | MIT | 19 | float smoothness=0.1; vec2 direction=(-1,1) |
| DirectionalWipe | gre | MIT | 21 | vec2 direction=(1,-1); float smoothness=0.5 |
| Disintegrate | gre | MIT | 111 | float particleSize=0.008; vec2 direction=(1,-0.15); float spread=0.75 |
| **DisplacementMap** | Travis Fischer | MIT | 25 | **TEX displacementMap**; float strength=0.5 |
| DitherDissolve | gre | MIT | 26 | float dotSize=0.02 |
| DominoFall | gre | MIT | 113 | int count=12; bool reverse=false; float knock=0.2; float lean=0.8; float perspective=0.8; float shading=0.6 |
| DoomMelt | Zeh Fernando | MIT | 61 | int bars=30; float amplitude=2; float noise=0.1; float frequency=0.5; float dripScale=0.5 |
| Doorway | gre | MIT | 90 | float reflection=0.4; float perspective=0.4; float depth=3 |
| Drape | gre | MIT | 185 | float folds=6; float depth=0.7; float sway=0.4; float shadow=0.5 |
| Dreamy | mikolalysenko | MIT | 13 | (none) |
| DreamyZoom | Zeh Fernando | MIT | 43 | float rotation=6; float scale=1.2 |
| DuotoneFade | gre | MIT | 57 | vec4 shadowInk; vec4 highlightInk; float contrast=0.6; float grain=0.4 |
| EdgeGlow | Woohyun Kim | MIT | 53 | float edge_thickness=0.001; float edge_brightness=8 |
| EyeBlink | gre | MIT | 82 | float blur=0.5; float softness=0.12; int blinks=1; vec4 color |
| FacetedGlass | gre | MIT | 136 | float facets=5; float refraction=0.1; float bevel=0.6; vec4 highlight; float seed=0 |
| Fade | gre | MIT | 12 | (none) |
| FadeColor | gre | MIT | 14 | vec4 color=(0,0,0,1); float colorPhase=0.4 |
| FadeGrayscale | gre | MIT | 20 | float intensity=0.3 |
| FallOver | gre | MIT | 35 | float perspective=0.8; float shading=0.7 |
| FilmBurn | Anastasia Dunbar | MIT | 62 | float Seed=2.31 |
| FilmDissolve | gre | MIT | 48 | float overlap=0.25; float smoothness=0.5 |
| FilmStrip | gre | MIT | 104 | int frames=2; float shrink=0.2; float blur=0.5; float weave=0.5; vec4 filmColor; vec4 holeColor |
| Fisheye | gre | MIT | 22 | float strength=0.8 |
| FlameWipe | gre | MIT | 153 | vec2 direction=(0,1); float height=0.4; float scorch=0.7; float glow=0.6; vec3 color=(1,0.4,0.08) |
| FlashFade | gre | MIT | 13 | vec3 color=(0.9,0.4,0.2) |
| FlowerWipe | Fernando Kuteken | MIT | 23 | int segments=5 |
| FlyEye | gre | MIT | 20 | float size=0.04; float zoom=50; float colorSeparation=0.3 |
| Fold | nwoeanhinnogaehr | MIT | 11 | (none) |
| FrostWipe | gre | MIT | 175 | float spread=0.5; float scale=5; float blur=0.5; vec4 color |
| Funnel | gre | MIT | 70 | float target=0.7; float curvature=0.8; float shadow=0.5 |
| Gallery | gre | MIT | 132 | float direction=1; float tilt=0.6; float gap=0.15; float zoom=2; float reflection=0.3; vec4 background |
| GeometricCollage | gre | MIT | 240 | int cells=2; float stagger=1; bool plates=true; vec4 color1,2,3; float shadow=0.6 |
| GlintDissolve | gre | MIT | 124 | float size=0.15; float threshold=0.6; float intensity=2; bool diagonals=false; float rotation=0; float rainbow=0.35; vec3 tint |
| GlitchBands | Yoni Maltsman | MIT | 28 | float ampx=1; float ampy=1 |
| GlitchDisplace | Matt DesLauriers | MIT | 76 | (none) |
| GlitchFlicker | bread | MIT | 160 | float frameRate=24; float rgbOffset=0.014; float blockAmount=0.72; float ghostAmount=0.62; float redCyan=0.58; float scanline=0.075 |
| GlitchMemories | Gunnar Roth | MIT | 18 | (none) |
| GlitterDissolve | gre | MIT | 170 | float tiles=20; bool hexagons=false; float sparkle=1; vec3 glint; float seed=0; vec4 backColor |
| GlowDissolve | hjm1fb | MIT | 53 | float uLineWidth=0.1; vec3 uSpreadClr=(1,0,0); vec3 uHotClr=(0.9,0.9,0.2); float uPow=5; float uIntensity=1 |
| GooeyWipe | gre | MIT | 96 | float blobs=5; float smoothness=0.5; vec4 highlight; vec4 shadow |
| GravityLens | gre | MIT | 65 | vec2 center=(0.5,0.5); float strength=0.6; float glow=0.6; vec4 hole |
| GridFlip | TimDonselaar | MIT | 171 | ivec2 size=(4,4); float pause=0.1; float dividerWidth=0.05; vec4 bgcolor; float randomness=0.1 |
| Halftone | gre | MIT | 48 | float dots=28; float angle=45; vec4 paper |
| HeartWipe | gre | MIT | 78 | vec2 center=(0.5,0.5); float smoothness=0.006; float pulse=0.5; vec3 glowColor; float glow=0.3 |
| HeatHaze | gre | MIT | 78 | float strength=0.04; float scale=6; float speed=2 |
| Hexagonalize | Fernando Kuteken | MIT | 77 | int steps=50; float horizontalHexagons=20 |
| HingedSquares | gre | MIT | 120 | int cells=5; float shading=0.6; float zoom=0.5 |
| Hologram | gre | MIT | 96 | vec3 tint; vec4 background; float scanlines=150; float jitter=0.04; float flicker=0.6 |
| Honeycomb | gre | MIT | 54 | float size=6 |
| HorizontalClose | martiniti | MIT | 15 | (none) |
| HorizontalHold | gre | MIT | 61 | int slips=3; float shear=1.25; float barWidth=0.14; vec4 barColor |
| HorizontalOpen | martiniti | MIT | 17 | (none) |
| HsvFade | nwoeanhinnogaehr | MIT | 28 | (none) |
| InkBleed | gre | MIT | 95 | float drops=4; float tendrils=0.7; float rim=0.5; float seed=3 |
| InsetWipe | gre | MIT | 57 | vec2 anchor=(1,1); float smoothness=0; float borderWidth=0; vec4 borderColor; bool reverse=false |
| InsideCube | gre | MIT | 113 | vec2 direction=(1,0); float fov=90; float shading=0.6; vec4 background |
| **InvertedPageCurl** | Hewlett-Packard | **BSD 3 Clause** | 228 | (none); adapted by Sergey Kosarevsky from rectalogic/webvfx |
| Kaleidoscope | nwoeanhinnogaehr | MIT | 24 | float speed=1; float angle=1; float power=1.5 |
| KeyholeWipe | gre | MIT | 103 | vec2 center; float rim=0.6; float smoothness=0.002 |
| LayoutGrid | gre | MIT | 146 | float gutter=0.04; float overlap=0.55; float band=0.22; float shadow=0.4; vec4 paper; vec4 accent |
| LeafWipe | @Flexi23 | MIT | 17 | (none) |
| LedWall | gre | MIT | 126 | float cells=24; float glow=0.6; float flash=0.7; float zoom=0.15; bool triads=false; vec2 direction; vec4 panel |
| LeftRight | zhmy | MIT | 27 | (none) |
| LensFlare | gre | MIT | 124 | float angle=-12; float height=0.18; float intensity=1; vec3 color |
| LightningFlash | gre | MIT | 199 | int bolts=2; float strike=0.55; float seed=0; vec3 color; float glow=0.5; int flashes=3 |
| LightRays | gre | MIT | 105 | vec2 center=(0.5,0.6); float drift=0.15; float reach=0.6; float threshold=0.65; float intensity=1.5; vec3 tint |
| LightStreaks | gre | MIT | 116 | float reach=0.6; float threshold=0.7; float intensity=1.5; vec3 tint; float blur=0.1; bool vertical=false |
| LightWipe | gre | MIT | 88 | vec2 direction=(1,-0.35); float width=0.04; float intensity=1.2; vec3 color |
| LiquidFill | gre | MIT | 101 | vec2 direction=(0,1); float amplitude=0.06; float waves=1.5; vec4 highlight; float refraction=0.03; float bubbles=0.5 |
| LissajousTiles | Boundless | MIT | 39 | float speed=0.5; vec2 freq=(2,3); float offset=2; float zoom=0.8; float fade=3 |
| **LumaWipe** | gre | MIT | 14 | **TEX luma** |
| LuminanceMelt | 0gust1 | MIT | 130 | bool direction=true; float l_threshold=0.8; bool above=false |
| MoireWipe | gre | MIT | 74 | float density=36; float bands=3; float drift=0.25; float lines=0.5 |
| Morph | paniq | MIT | 19 | float strength=0.1 |
| Mosaic | Xaychru | MIT | 44 | int endx=2; int endy=-1 |
| MultiplyBlend | Fernando Kuteken | MIT | 19 | (none) |
| NoiseDissolve | towrabbit | MIT | 14 | (none) |
| Overexposure | Ben Zhang | MIT | 24 | float strength=0.6 |
| PaperFold | gre | MIT | 167 | vec2 direction=(1,0.5); float tilt=0.6; float shading=0.6; vec4 paper |
| PaperTear | gre | MIT | 75 | float roughness=0.12; float tilt=0.1; float rim=0.012; vec4 paper; vec4 shadow |
| PerlinDissolve | Rich Harris | MIT | 65 | float scale=4; float smoothness=0.01; float seed=12.9898 |
| PhotoDevelop | gre | MIT | 58 | vec4 card; float wash=0.35; float tint=0.8 |
| Pinwheel | Mr Speaker | MIT | 19 | float speed=2 |
| Pixelize | gre | MIT | 20 | ivec2 squaresMin=(20,20); int steps=50 |
| PixelStretch | gre | MIT | 72 | vec2 direction=(1,0); float stretch=0.45; float chroma=0.5; float softness=0.03; float jitter=0.5 |
| PlasmaDissolve | gre | MIT | 50 | float scale=3; float smoothness=0.1; float flow=1; vec3 edgeColor; float edgeStrength=0.6 |
| PlusWipe | gre | MIT | 37 | float smoothness=0.01; bool reverse=false |
| PolkaDotsCurtain | bobylito | MIT | 13 | float dots=20; vec2 center=(0,0) |
| PopIn | gre | MIT | 56 | vec2 center=(0.5,0.5); float bounce=1; float corner=0.12; float shadow=0.5 |
| PowerKaleido | Boundless | MIT | 56 | float scale=2; float z=1.5; float speed=5 |
| Prisms | gre | MIT | 80 | int slats=8; float stagger=0.45; float perspective=1; float shading=0.6; bool horizontal=false; vec4 backColor |
| ProjectorThrow | gre | MIT | 74 | float darkness=0.8; float keystone=0.45; float blur=0.015 |
| Puzzle | gre | MIT | 123 | float pieces=5; float shadow=0.6 |
| PuzzleCube | gre | MIT | 204 | int size=3; float gap=0.012; float shading=0.6; vec4 background |
| RadialWipe | Xaychru | MIT | 18 | float smoothness=1 |
| RandomSquares | gre | MIT | 19 | ivec2 size=(10,10); float smoothness=0.5 |
| RectangleCover | martiniti | MIT | 28 | vec4 bgcolor=(0,0,0,1) |
| RectangleIris | martiniti | MIT | 29 | vec4 bgcolor=(0,0,0,1) |
| Refraction | gre | MIT | 94 | float strength=0.15; float scale=2.5; float dispersion=0.5; float brightness=1 |
| Revolve | bread | MIT | 97 | vec2 center=(0.46,0.52); float direction=-1; float maxRotation=1.95; float peakZoom=2.22; float swirl=2.85; float barrel=0.38; float motionBlur=1; float switchStart=0.30; float switchEnd=0.50; float shadow=0.16 |
| RibbonTwist | gre | MIT | 52 | float spread=0.8; float perspective=0.4; float shading=0.6; bool vertical=false; vec4 backColor |
| RingSpin | gre | MIT | 111 | int rings=6; bool square=false; int turns=1; float stagger=0.5; float blur=0.6; float settle=0.5 |
| RingsWipe | gre | MIT | 105 | int count=6; vec2 center; float stagger=0.5; bool radial=false; float borderWidth=0.008; vec4 borderColor; float smoothness=0.004 |
| Ripple | gre | MIT | 19 | float amplitude=100; float speed=50 |
| Rolls | Mark Craig | MIT | 41 | int type=0; bool RotDown=false |
| RotateScaleFade | Fernando Kuteken | MIT | 38 | vec2 center; float rotations=1; float scale=8; vec4 backColor |
| RotateScaleVanish | Mark Craig | MIT | 41 | bool FadeInSecond=true; bool ReverseEffect=false; bool ReverseRotation=false |
| SawtoothWipe | gre | MIT | 72 | vec2 direction=(1,0); int teeth=8; float depth=1; bool jaws=false; float smoothness=0.004 |
| Shatter | lbl | MIT | 249 | vec2 center=(0.5,0.5); float shards=6; float gravity=1; float seed=0 |
| Shred | gre | MIT | 66 | int strips=20; float stagger=0.4; float tilt=0.1; float shadow=0.5 |
| ShutterWipe | gre | MIT | 67 | int blades=5; float tilt=0.06; float gate=0.035; vec4 color |
| SimpleFlip | nwoeanhinnogaehr | MIT | 14 | (none) |
| SimpleZoom | 0gust1 | MIT | 19 | float zoom_quickness=0.8 |
| SimpleZoomOut | Tianshuo | MIT | 22 | float zoom_quickness=0.8; bool fade=true |
| SketchDissolve | gre | MIT | 99 | float lineWidth=1.5; float edges=1; float hatching=0.6; vec4 paper; vec4 ink |
| SlideAwayRight | lizhongjian | MIT | 20 | (none) |
| Slides | Mark Craig | MIT | 40 | int type=0; bool In=false |
| SlotReels | gre | MIT | 117 | int reels=5; float blur=0.6; float stagger=0.45; float bounce=0.5; vec4 separator |
| SmokeDissolve | gre | MIT | 101 | vec2 direction=(0.5,0.1); float scale=2.5; float spread=0.4; float softness=0.5; vec4 color |
| SnakeBlockWipe | gre | MIT | 39 | ivec2 grid=(8,6); bool vertical=false; float smoothness=0.5 |
| Snapshot | gre | MIT | 85 | float tilt=0.35; float border=0.04; float flash=0.85; float shadow=0.45; vec4 borderColor |
| Sphere | gre | MIT | 94 | vec2 direction=(1,0); float size=0.3; float shading=0.6; float shadow=0.5 |
| SpiralBlockWipe | gre | MIT | 64 | ivec2 grid=(8,6); bool inward=true; bool clockwise=true; float smoothness=0.05 |
| SpiralWipe | gre | MIT | 40 | float turns=3; float smoothness=0.05; bool clockwise=true |
| SplatterWipe | gre | MIT | 153 | float splats=4; float spikiness=0.6; float droplets=0.6; float drips=0.5; float rim=0.5; float seed=3 |
| SplitFlap | gre | MIT | 123 | ivec2 size=(8,6); float stagger=0.6; float randomness=0.3; int flaps=1; float gap=0.004; float perspective=0.35; float shading=0.4; vec4 background |
| SplitSlideInHorizontal / InVertical / OutHorizontal / OutVertical / InOutHorizontal / InOutVertical | OllyOllyOlly | MIT | 21-25 | bool reverse=false (each) |
| SpotlightWipe | gre | MIT | 62 | vec2 center; float size=0.3; float darkness=0.85; vec3 warmth |
| SquaresWipe | gre | MIT | 25 | ivec2 squares=(10,10); vec2 direction=(1,-0.5); float smoothness=1.6 |
| Squeeze | gre | MIT | 22 | float colorSeparation=0.04 |
| StarWipe | Ben Lucas | MIT | 50 | float border_thickness=0.01; float star_rotation=0.75; vec4 border_color=(1,1,1,1); vec2 star_center=(0.5) |
| StaticFade | Ben Lucas | MIT | 46 | float n_noise_pixels=200; float static_luminosity=0.8 |
| StaticWipe | Ben Lucas | MIT | 38 | bool u_transitionUpToDown=true; float u_max_static_span=0.5 |
| **StereoViewer** | Ted Schundler | **BSD 2 Clause** | 213 | float zoom=0.88; float corner_radius=0.22 |
| StretchSlide | gre | MIT | 61 | vec2 direction=(-1,0); float stretch=0.6; float bounce=0.6 |
| StripDatamoshGlitch | bread | MIT | 188 | float strength=1; float horizontalBars=42; float verticalSlits=18; float tear=0.18; float chroma=0.032; float residue=0.62; float noiseAmount=0.16; float scanAmount=0.13; float flashAmount=0.20 |
| Swap | gre | MIT | 63 | float reflection=0.4; float perspective=0.2; float depth=3 |
| Swirl | Sergey Kosarevsky | MIT | 64 | float strength=1; float radius=0.9; vec2 center=(0.5,0.5) |
| TangentMotionBlur | chenkai | MIT | 146 | (none) |
| TilesWave | numb3r23 | MIT | 62 | ivec2 tileCount=(8,8); bool flipX=true; bool flipY=false |
| TopBottom | zhmy | MIT | 26 | (none) |
| TruchetWipe | gre | MIT | 79 | float cells=8; float outline=0.6; float spread=0.75 |
| Tumble | gre | MIT | 112 | float flips=2; float spin=0.15; vec2 direction=(0,0.3); float perspective=0.6; float shading=0.7 |
| Tunnel | gre | MIT | 41 | float speed=6; float twist=0.5 |
| TvLostSignal | mernking (gitlab.com/Godswork) | MIT | 50 | (none) |
| TvRoll | gre | MIT | 42 | int rolls=3; float barHeight=0.12; vec4 barColor |
| TvStatic | Brandon Anzaldi | MIT | 28 | float offset=0.05 |
| TvTurnOff | gre | MIT | 46 | vec4 color=(0,0,0,1); float glow=1 |
| UndulatingBurnOut | pthrasher | MIT | 55 | float smoothness=0.03; vec2 center=(0.5); vec4 color=(0,0,0,1) |
| VerticalClose / VerticalOpen | martiniti | MIT | 15-16 | (none) |
| VhsTracking | gre | MIT | 126 | int bands=3; float noise=0.6; float bleed=0.5; float wobble=0.5 |
| Vortex | gre | MIT | 105 | int grid=24; vec2 center; float spin=1; float randomness=0.2 |
| WarpSpeed | gre | MIT | 119 | vec2 center; float streaks=160; vec4 streakColor; float strength=0.6; float flash=0.5 |
| WaterDrop | Pawel Ploociennik | MIT | 76 | float amplitude=30; float speed=30; vec2 center; float refraction=0.015; float highlight=0.5 |
| WaveWipe | gre | MIT | 153 | vec2 direction=(1,0); float curl=0.3; float foam=0.6; float refraction=0.04; vec4 water; vec4 foamColor |
| WedgeWipe | gre | MIT | 34 | float angle=0; float smoothness=0.01; vec2 center=(0.5) |
| WhipPan | gre | MIT | 49 | vec2 direction=(-1,0); float blur=0.4 |
| WhipSpin | gre | MIT | 68 | float turns=1; float blur=0.5; float chroma=0.6; float zoom=0.25 |
| WhipTilt | gre | MIT | 78 | bool down=false; float blur=0.5; float chroma=0.5; float perspective=0.7 |
| Wind | gre | MIT | 24 | float size=0.2; bool reversed=false |
| WindowBlinds | Fabien Benetou | MIT | 17 | (none) |
| WindowSlices | gre | MIT | 15 | float count=10; float smoothness=0.5 |
| ZoomInCircles | dycm8009 | MIT | 39 | (none) |
| ZoomInOut | OllyOllyOlly | MIT | 19 | (none) |
| ZoomWipeLeft / ZoomWipeRight | Handk | MIT | 35 | float zoom_quickness=0.8 |

(`Fade`, `FadeColor` etc. appear exactly as in `transitions/*.glsl`; the table above is sorted alphabetically and covers all 220 files, the `SplitSlide*` group and `Vertical*`/`Zoom*Left/Right` pairs are merged to one row each to save space.)

Notes on the transitions:
- **Non-MIT**: `InvertedPageCurl` (BSD 3-Clause, Hewlett-Packard, via rectalogic/webvfx), `StereoViewer` (BSD 2-Clause, Ted Schundler). Both need only a retained copyright notice. No GPL, CC-NC or unlicensed ones.
- **Extra textures**: `LumaWipe` (`luma`), `DisplacementMap` (`displacementMap`) only. The Remotion wrapper throws if they are not given in `textures:` (`packages/remotion/src/glTransition.ts` L53-55).
- Several transitions are "scene-in-3D" style (Cube, Doorway, InsideCube, PuzzleCube, Sphere) and return `vec4(0.0)` outside the images; Remotion's README warns what shows there (see 2.3).
- Author field forms are mixed (names, handles, e-mail, "Eke Péter <peterekepeter@gmail.com>"); the spec says Author must not contain `:`.

### 2.3 `packages/remotion` (`@gl-transitions/remotion`)
| Item | Finding |
|---|---|
| package.json | `packages/remotion/package.json`: name `@gl-transitions/remotion`, **version 2.0.0**, MIT, ESM (`"type": "module"`), `main ./dist/index.js`, `files: [dist]`, `sideEffects: false`. |
| peerDependencies | `@remotion/transitions >=4.0.500`, `remotion >=4.0.500`, `gl-transitions ^3.2.0`. **No `react` / `react-dom` peer** declared (they are devDependencies: react 19.2.3, react-dom 19.2.3, `@types/react ^19.2.0`, remotion and `@remotion/transitions` 4.0.540, TypeScript ^7.0.2). |
| Source files | `src/index.ts` (7 lines: exports `glTransition`, types), `src/glTransition.ts` (72), `src/renderer.ts` (196), `src/textures.ts` (24); plus generated `src/transition-types.generated.ts` (built by `scripts/catalog/generate-transition-types.mjs`, not committed). |
| How it renders | `glTransition({name, params?, textures?})` returns `makeHtmlInCanvasPresentation(shader)` from `@remotion/transitions`: i.e. the **HTML-in-canvas presentation API**, not the older `TransitionPresentation` React component API. `shader(canvas)` does `canvas.getContext("webgl2", { premultipliedAlpha: false })` and throws "WebGL 2 is not available" otherwise. Remotion captures both scenes as images (`prevImage` = incoming/`to`, `nextImage` = outgoing/`from`, `time` = progress). `renderer.ts` wraps the transition GLSL (GLSL ES 1.00 `precision highp`, `getFromColor/getToColor` via `texture2D`, `progress`, `ratio`, a full-screen triangle) and uploads the captured images with `texImage2D` plus `UNPACK_FLIP_Y_WEBGL`. Params are typed per transition and set via `gl.uniform*`. Extra textures are loaded by `loadImage()` with `delayRender`/`continueRender`/`cancelRender`. |
| Web renderer (`renderMediaOnWeb`) | Judged from code only. **It needs a `<canvas>` with a real `webgl2` context created by Remotion's `makeHtmlInCanvasPresentation` host, and the scene images come from Remotion's "HTML-in-canvas" capture.** `README.md` says it works for server-side rendering (`npx remotion render`, server-side APIs, Lambda, `--gl=swangle`/`angle`) and the Studio only behind Chrome 149+ flag `chrome://flags/#canvas-draw-element`. The word "web renderer"/`renderMediaOnWeb` appears **nowhere** in the repo (grep). So compatibility is **unverified, and depends on whether Remotion's web renderer implements `makeHtmlInCanvasPresentation` with WebGL2-capable canvases**. The package does not itself touch WebGL canvas capture; if the host provides a `canvas` plus both `prevImage`/`nextImage` as `TexImageSource`, the code would work, but it relies on that host. Risk: high until tested. |
| README caveats | (1) Requires Remotion >= 4.0.500. (2) Studio preview needs Chrome 149+ with a flag and may flash at the start of a transition. (3) Transparent pixels (no image drawn) show "one of the captured scenes or black", not layers beneath `<TransitionSeries>`. (4) Textures for `LumaWipe` / `DisplacementMap` must be supplied as URLs (`staticFile()`). (5) WebGL without a GPU: `--gl=swangle`. |
| Transition catalogue source | Imports `gl-transitions` (npm) at runtime, so all 220 GLSL strings come from the npm package, `byName` map, unknown name throws. |
| Changelog | `packages/remotion/CHANGELOG.md`: 2.0.0 removed 12 duplicate transitions (WipeLeft/Right/Up/Down, BowTieVertical, Box, LinearBlur, MosaicBlend, MosaicFade, ScaleIn, RotateFade, BlockDissolve); 1.0.0 renamed everything. |

### 2.4 Portability summary (gl-transitions)
Every transition is a pure GLSL ES 1.00 `vec4 transition(vec2 uv)` function. They lift directly into any WebGL1/WebGL2 canvas by reusing the 12-line wrapper in `packages/remotion/src/renderer.ts` (L8-24). Only 2 need an extra texture. `@gl-transitions/remotion` is the right integration only if the editor runs on Remotion >= 4.0.500 with HTML-in-canvas; otherwise reuse `renderer.ts` directly with your own canvas. Licence risk: none (MIT/BSD, keep BSD notices).

---------------------------------------------------------------------
## 3. heatmap.js (`heatmap.js/`, commit 4e64f5a)

### 3.1 Facts
| Item | Finding |
|---|---|
| Version / licence | `package.json`: **2.0.5**, author Patrick Wied. `LICENSE`: MIT (c) 2015 Patrick Wied. **Caveat:** `build/heatmap.js` header says "Copyright 2008-2016 ... All rights reserved. **Dual licensed under MIT and Beerware license**"; `bower.json` says `MIT`. Acceptable (MIT is available), but note the header wording. |
| Dates | Last commit **2017-02-02** (shallow clone, 1 commit). Build stamp in `build/heatmap.js` header: **2016-09-05**. |
| Maintenance | **Unmaintained for ~9-10 years.** `CONTRIBUTE.md` is "@ TODO: more". `src/core.js` has "@TODO: add API documentation". `Store.removeData` is a stub (`// TODO: implement`). Empty placeholder files `src/renderer/vml.js` and `src/renderer/canvas-webgl.js` (0 lines). |
| Layout | `src/config.js` (13 lines, defaults), `src/core.js` (142, Heatmap + event Coordinator), `src/data.js` (212, `Store`), `src/renderer.js` (10, picks renderer), `src/renderer/canvas2d.js` (305, the only renderer), `src/util.js` (14, `merge`). Concatenated by `Gruntfile.js` per `package.json buildFiles` into `build/heatmap.js` (723 lines, UMD global name `h337`) and `heatmap.min.js`. |
| Plugins | `plugins/`: `gmaps-heatmap`, `leaflet-heatmap` (each with package.json), `svg-area-heatmap.js`, `segment-heatmap.js`, `angular-heatmap/angular-heatmap.js` (AngularJS 1.x wrapper), `boilerplate.js`. **No React wrapper** and no TypeScript typings (`*.d.ts` search: none). |
| Dependencies | None at runtime. Dev: grunt, coffee-script, grunt plugins. |

### 3.2 API
| Feature | Behaviour (cited) |
|---|---|
| Create | `h337.create({container, ...config})`; `container` is required (`getComputedStyle(config.container)` for size, `canvas2d.js` L74-85); a `canvas` can be passed. Sets `container.style.position='relative'` and appends a `canvas.heatmap-canvas` absolutely positioned. |
| Defaults (`src/config.js`) | `defaultRadius 40`, `defaultBlur .85`, `defaultMaxOpacity 1`, `defaultMinOpacity 0`, gradient `{0.25: blue, 0.55: lime, 0.85: yellow, 1.0: red}`, field names `x`, `y`, `value`. |
| Data format | `setData({min, max, data:[{x, y, value, radius?}, ...]})`. `addData(point | point[])`. `setDataMax(n)`, `setDataMin(n)`, `getData()`, `getValueAt({x,y})`, `getDataURL()`, `repaint()`, `configure(partialConfig)`, `removeData()` (not implemented). Custom field names via `xField/yField/valueField`. |
| Config knobs | `radius`, `blur` (0..1; 1 = hard-edged circle), `maxOpacity`, `minOpacity`, `opacity` (fixed), `gradient`, `useGradientOpacity`, `backgroundColor`, `width/height`, `onExtremaChange`, `plugin`. |
| Aggregation | `Store._organiseData`: points are keyed **by exact integer pixel `x`,`y` in a sparse JS array-of-arrays** (`store[x][y]`); a point landing on an existing cell **adds its value** (`store[x][y] += value`); the **first** radius for a cell sticks. No spatial binning/kernel density; the "density" arises only from drawing overlapping alpha-blended radial-gradient stamps. `value` defaults to 1 (`|| 1`, so 0 becomes 1). Max/min auto-raise on `addData` (via `setDataMax`/`setDataMin`, which triggers a full redraw) but `setData` takes `max` as given. Note `store._min` starts at **10** and `_max` at 1 (`data.js` L8-9), a quirk that yields odd extrema before the first point. |
| Rendering | `canvas2d.js`: for each point, `drawImage` of a cached per-radius template (radial gradient, black alpha) onto an offscreen "shadow" canvas with `globalAlpha = (value-min)/(max-min)` (floored at 0.01); `_colorize` then reads `getImageData` over the dirty bounding rectangle and maps alpha through a 256-entry palette from a 1x256 gradient canvas into the visible canvas (`putImageData`). `addData` does partial render using `renderBoundaries`. |
| Coordinate scaling | **None.** Coordinates are raw canvas pixels (`x - radius`). There is no data-space-to-pixel mapping, no axis, no domain. The caller must scale. Canvas size is fixed at creation (`config.width/height` or the container's computed CSS pixel size); `setDimensions()` exists on the renderer but not on the public `Heatmap` API. Points outside the canvas are still stored and drawn clipped. |
| devicePixelRatio | **Not handled** (grep for `devicePixel` in `src/` and `build/heatmap.js`: none). On HiDPI screens the canvas is CSS-pixel resolution and gets blurry; to fix you must pass 2x `width/height` and scale coordinates yourself, and then also CSS-size the canvas. |
| Performance | Fine for thousands of points; cost is `drawImage` per point plus `getImageData`/`putImageData` over the touched region. Whole `renderall` on every `configure`/`setDataMax`/`setDataMin`. `Object.keys` over a sparse array for every full render (`_prepareData`). `getValueAt` reads alpha of the shadow canvas (1 px `getImageData`), returns an integer approximation. Per-radius template cache grows with distinct radii. Not suitable for 100k+ points or animation at 60 fps with full redraws. |
| Known issues | No ES module build or types (UMD only, name `h337`); the CommonJS `main` is the built UMD (assumes `document`, so it breaks in SSR); `blur` 0 vs falsy handled specially; `getValueAt` quality; `removeData` missing; fixed canvas size; a `README` points users to bower; a stale-bounds `_renderBoundaries` reset to `[1000,1000,0,0]` after colorize but initialised `[10000,10000,0,0]` (inconsistent, partly masked by clamping). |

### 3.3 Fit for 1-D timeline charts
**Not suited.** heatmap.js is a 2-D scattered-point density renderer in raw pixel space with no axes, scaling, time domain, or binning. A 1-D timeline (value vs. time) would need you to fake `y` and hand-scale `x`, and you would get radial blobs rather than cell-aligned intensity strips. A better fit is a simple canvas/SVG strip: bin time into N buckets, map the value to a colour with a palette, and draw N rects (about 20 lines, also deterministic per frame in Remotion). If you want the heatmap.js look anyway, copy the idea: radial-gradient stamp, alpha accumulate, colourise with a 256-entry palette (about 150 lines).

---------------------------------------------------------------------
## 4. Overall recommendations
| Source | Use |
|---|---|
| gl-transitions | **Adopt** (MIT/BSD, active, spec-clean). Reuse `packages/remotion/src/renderer.ts` or the `@gl-transitions/remotion` package; verify web-renderer support before relying on it. |
| Seriously.js | **Mine selectively for MIT shaders only; do not depend on it.** Avoid copying blur, directionblur, bleach-bypass, opticalflow (CC BY-NC-SA); attribute film grain (CC BY); write your own LUT; skip the legacy runtime. |
| heatmap.js | **Skip** for timeline use; if a 2-D heatmap is later needed, expect to wrap it (no React, no types, no DPR). |
