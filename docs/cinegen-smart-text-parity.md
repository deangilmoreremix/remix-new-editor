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
| Unfilled token in the editor preview | chip | **added** (player and export keep the plain text) |
| Typing vs editor shortcuts | n/a | **fixed** for the new boxes: Space / E / V / B / Backspace no longer fire shortcuts |
| Export: size fit, bold, italic, alignment, shadow, stroke, background, animations | n/a | already covered by `SmartText` in the Remotion composition |

## Still different (not changed)
- **Stroke width.** Upstream uses `fontSize * 0.2` px centred on the glyph edge; CineGen uses `0.04em` drawn outside the glyph (viewer) and an 8-direction shadow of the same width (export). Close, not identical.
- **Upstream `scripts` hook** (per-element custom code) is not ported.
- Fixed-size text uses a share of the frame height in CineGen; upstream uses a percentage of its own base font. Compare visually if exact sizes matter.
- Published player and export were checked by code and unit tests only, not by viewing a published page or an exported MP4.
