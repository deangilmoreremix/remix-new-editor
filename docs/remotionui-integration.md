# RemotionUI animations in the timeline editor

The Animations library (on for everyone, same switches as the HyperFrames animations) also offers components from
**RemotionUI** (https://remotionui.com, package `remotion-ui`, MIT). They are placed, edited, saved, previewed and exported exactly like the
other animations: same overlay lane, same sandboxed preview frame and export runner, same error toasts, same kill switches
(`VITE_HYPERFRAMES_RUNTIME_DISABLED=true` or `localStorage remix.hyperframes.kill='1'` switch both families off; saved projects are never rewritten).

## What is vendored
- `scripts/remotionui/vendor.mjs` copies the 254 registry items (217 components + helper libs/hooks) from `https://remotionui.com/r/presets/default`
  into `src/lib/editor/remotion/remotionui/vendored/` with `@/remotion/...` imports rewritten to relative paths and `from "remotion"` pointed at
  `remotionui/shim.ts`. `src/lib/remotionui/registry.lock.json` records the sha256 of every original file.
- The shim re-exports `remotion` unchanged except `useVideoConfig`, which reports the **clip's** length, because RemotionUI scenes plan their
  whole life across `durationInFrames`.
- Added packages (same version as the other Remotion packages, 4.0.540): `@remotion/paths`, `@remotion/media-utils`, `@remotion/light-leaks`.
- The vendored folder is excluded from ESLint (third-party source).

## How an item renders
The registry ships no sample data, so each item uses the **usage example from its docs page** (`src/lib/remotionui/docs-usage.json`) as its demo:
`scripts/remotionui/demos.mjs` turns every example into a small module under `remotionui/demos/` (props, children, sample captions/data from
`scripts/remotionui/samples.mjs`). Transitions are shown between two coloured scenes. The inspector fields are the literal props of that example plus the
component's literal defaults (`scripts/remotionui/catalog.mjs`), and an edit is passed straight to the component as a prop.
A RemotionUI layer is a normal `hyperframes` overlay with `blockId` `rui:<name>`; `HyperframesLayer` hands those ids to `RemotionUiClip.jsx`.

## Gates (nothing is enabled by hand)
`src/lib/remotionui/verification.json` is written by `scripts/remotionui/verify.py` from measurements made through the production path
(sandboxed preview frame at `/code-preview.html`, export runner `/export-runner.html`):
1. rendered at three times with no adapter error and not blank;
2. a real, full-length 1920x1080 browser MP4 export succeeded with no adapter error;
3. export throughput >= 3 fps. Items under 8 fps are enabled and labelled "slower export" on their card.

Result: see `docs/remotionui-resource-ledger.md` / `.csv` (one row per component, with the reason for every one that is not enabled).

## Editable fields are measured
Every inspector field was changed one at a time (first five per item) and the sandboxed render compared with the default (`scripts/remotionui/fields.py`, data in `src/lib/remotionui/fields.json`).
Only fields that visibly change the picture are offered. An item with no effective field AND visible text was removed (27 items: wrappers whose only text is fixed demo content, and the transitions, whose demo is
two placeholder scenes). Result (updated below): **149 enabled**, 147 with at least one effective field (83 with a text field, 69 with a color field); `confetti-burst` and `subtitle-translate` have no fields and showed no text.

## Not enabled, and why
- **Need your own audio/video file** (audiograms, waveform and VU meters, beat grids, footage mattes, split screens with video): the library has no
  file to feed them.
- **Need WebGL / map packages** (3D scenes, globes, map scenes, GPU shader fields): `three`, `@react-three/*`, `maplibre-gl`, `@paper-design/shaders-react`
  are not installed and not rendered through the sandbox yet.
- **Export failed in the browser renderer**: CSS masks the web renderer cannot rasterise (`grid-pixelate-wipe`, `svg-mask-reveal`) and one scene that needs an app image
  (`ai-composer-showcase`).
- **No effective field and fixed text** (27): see above.
- **Too slow to export** (about 1 fps at 1080p): `effector-field`, `particle-field`, `caustics-bg`.

## Regenerating
```bash
node scripts/remotionui/vendor.mjs --items <dir of registry item JSON>   # pinned source + lock
node scripts/remotionui/catalog.mjs && node scripts/remotionui/demos.mjs && node scripts/remotionui/catalog.mjs
# run the production-path render/export sweeps (poc/hyperframes-remotion/prod-render.mjs, prod-export.mjs), then
python3 scripts/remotionui/verify.py <analysis.json> <export-full.json> <export-half.json> && node scripts/remotionui/catalog.mjs
python3 scripts/remotionui/make-thumbs.py <stills dir> && node scripts/remotionui/ledger.mjs
```

## Honest limits
- Measured in headless Chromium only (no Firefox/Safari). Throughput numbers were taken with two exports running at once, so they are conservative.
- Demos use the docs' sample content; whether each item looks right with a customer's own text/data is only covered for the editable fields listed in the inspector.
- Google Fonts are fetched at render time (the sandbox frames already allow `fonts.googleapis.com` / `fonts.gstatic.com`).
- This has not been independently security-reviewed; vendored source is pinned by hash and runs only inside the sandboxed frames.

## Update: transitions and wrapper effects restored (168 enabled)
The transition demos now show two scenes whose text and colors are editable (`textA`, `textB`, `colorA`, `colorB`), so each has fields that visibly change the result (measured: 53 of 68 field tests changed the picture). 17 transitions were re-verified (real 1080p exports, 9-60 fps) and re-enabled, plus `blur-in` and `slide-left` (their demo text is an editable field). 168 of 217 are enabled. Still not enabled: 22 need your own audio/video file, 13 need WebGL/map/shader packages, 3 export failures, 3 too slow, and 8 wrapper/scene items without an effective field (`deploy-reveal`, `hero-loop`, `landing-code-showcase`, `pricing-focus`, `shake-emphasis`, `stagger-children`, `strikethrough-replace`, `tool-menu-slide`).
