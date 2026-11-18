# Smart Text: CineGen vs upstream

Upstream: `lib/popcorn/plugins/text/popcorn.text.js`, `components/settings/text-settings/*`.
CineGen: `SMART_TEXT` in `src/lib/editor/addons/overlayAddons.js`, renderer `buildText` in `overlayRender.js`, inspector `addonEditor.js`, export `SmartText` in `src/lib/editor/remotion/TimelineComposition.jsx`.
Method: code comparison plus the real CineGen editor in a browser (screenshots in `docs/evidence/cinegen-parity-screenshots/smart-text/`). Upstream's plugin was **not** rendered side by side: it needs its whole store and Popcorn stack, so differences below come from reading its code.

| Area | Upstream | CineGen now |
|---|---|---|
| Settings (text, position, URL / phone call-to-action, notify email, link target, rotation, font, size, scale to fit, bold, italic, alignment, colours, shadow, stroke, background, opacity, blend) | yes | same fields and defaults (already ported) |
| In / Idle / Out animations | Animate.css (its own `transition` option is forced to none) | same list |
| Text box with `{{tokens}}` as chips | contentEditable | **added** (stored value is still a plain string) |
| Personalize menu | yes | **added** (CineGen's inspector never passed the token list) |
| Text Position icons | upstream SVGs | **added** (were text glyphs) |
| Edit text on the video | no (upstream edits in the panel) | **added**: double-click; Enter keeps, Shift+Enter new line, Esc cancels |
| "Convert to Smart Speech" button | yes | **added**: opens the Smart Speech window with this text (only where the host can open it) |
| Advanced tab: font with preview, size slider (greyed out while Scale To Fit is on), B / I buttons, alignment icons, font colour with presets and hex, Shadow / Stroke / Background with their colours | yes | **rebuilt to match upstream's layout**; colour presets and hex box are extras |
| In / Idle / Out effects as preview tiles (upstream's "Add Animation" window) | yes | **added**: Browse effects under each animation, tiles play on hover; the dropdown stays |
| My presets (upstream `combined` plugin: save an overlay look, add it anywhere) | yes (classic page) | **added** to CineGen: "Save as preset" in the overlay settings, "My presets" tab in Add to timeline. Per browser, same storage as the classic editor. Saves add-on overlays only (Smart Text, image, stickers, lower thirds...) |
| Style presets | server-hosted catalogue (not in this repo) | **new content**: 10 ready-made looks (Bold headline, Neon glow, Outline, Subtitle box, Handwritten, Retro pop, Typewriter, Elegant script, Gold, Alert banner) |
| Typing, Blur In (In), Flicker, Blink (Idle) | listed in upstream's manifest, switched off, no motion | **new**: editor, and export draws the same motion |
| In / Idle effects playing in the CineGen preview | yes (classic page) | **fixed**: they never played in CineGen. They now play when an overlay appears during playback, and once as a preview when you change the effect |
| Unfilled token in the editor preview | chip | **added** (player and export keep the plain text) |
| Typing vs editor shortcuts | n/a | **fixed** for the new boxes: Space / E / V / B / Backspace no longer fire shortcuts |
| Export: size fit, bold, italic, alignment, shadow, stroke, background, animations | n/a | already covered by `SmartText` in the Remotion composition |

## Still different (not changed)
- **Out effects** (fade out, etc.) do not play in the CineGen preview; the export does draw them.
- Typing reveals the whole text box left to right in steps (it is a wipe, not letter by letter), in both the editor and the export.
- My presets cannot save forms or motion graphics.
- **Stroke width.** Upstream uses `fontSize * 0.2` px centred on the glyph edge; CineGen uses `0.04em` drawn outside the glyph (viewer) and an 8-direction shadow of the same width (export). Close, not identical.
- **Upstream `scripts` hook** (per-element custom code) is not ported.
- Fixed-size text uses a share of the frame height in CineGen; upstream uses a percentage of its own base font. Compare visually if exact sizes matter.
- Published player and export were checked by code and unit tests only, not by viewing a published page or an exported MP4.
