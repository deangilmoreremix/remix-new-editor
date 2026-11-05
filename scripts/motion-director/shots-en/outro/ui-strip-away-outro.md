---
name: ui-strip-away-outro
one_liner: A subtractive closing — after Publish is clicked, the whole editor UI evaporates layer by layer from the periphery to the centre in staggered overlap, leaving only that button on black, which slides to screen centre and enlarges, then fades out to hand off to the wordmark sign-off
use_when: outros with "publish/done" semantics; product closings that want to say "after one click, all complexity disappears"
length: ~4.8s (144f: cursor in position 34f → evaporation ~40f → button alone → wordmark takes over → wordmark hold ≥1s)
energy: medium (quiet operation at the start, continuous exit in the middle, no instantaneous impact)
---

## Intent
The library's closings are all "additive": outro-group-photo-launch has elements flying in for a group photo; the logo sting holds and then adds an easter egg. This card is the only "subtractive" route — the click detonates the exit of the entire UI, leaving only the semantic focus on black (the clicked button), translating "publish = complexity reset to zero" into motion narrative. There are two make-or-break points: **the evaporation must be orderly** — from periphery to centre, one layer every 4f, each layer with directional displacement (each scattering off-frame its own way); out of order or all vanishing on the same frame reads as a power failure; **the button is the sole survivor and must migrate** — during the evaporation it slides from the toolbar corner to screen centre and enlarges 1.5×, its white halo intensifying as the background goes black, completing its promotion from "UI control" to "ceremonial lead", and finally fades out to hand the black over to the wordmark.

## Motion core
- 6 evaporation layers: sidebar → properties panel → canvas cards → toolbar ends → canvas base → toolbar middle, starting +4f after the click, one layer every 4f; each layer STRIP_DUR 14f, Easing.in(quad) accelerating exit, fade + directional displacement + 0→7px evaporation blur (sidebar −140,0 / panel −90,20 / toolbar ends ∓80,−60 / canvas base 0,40 / toolbar middle 0,−50)
- The 4 cards on the canvas are further staggered by 3f each, with displacement alternating left and right (±70px) — a large block vanishing whole reads as a layer being deleted; breaking apart is what reads as "evaporating"
- Background goes black: with the canvas base layer's evaporation (20f starting at +20f) grey background → #111110
- Button: on click, a spring(damping 12, stiffness 220) compression pulse; during evaporation position/size interpolate toward screen centre (18f, inOut cubic), scale ×1.5, white halo 30→70px intensifying with the black; from +52f fade out over 12f
- Wordmark takes over: at +62f spring(damping 14, stiffness 90) fade in + 86%→100% scale, sign-off on black
- The cursor fades out within 10f after the click — the lead has changed, the cursor must exit

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Inter-layer stagger | 4f × 6 layers | All vanishing on the same frame reads as a power failure; >8f drags into a slow demolition and the sense of ceremony scatters |
| Single-layer duration | 14f, ease-in accelerating | An ease-out exit reads as "drifting away", not "evaporating"; >20f feels sticky |
| Evaporation order | Periphery → centre, the button's layer last | Centre emptying first reads as a fault; the button's layer leaving first collapses the whole card |
| Displacement amount | 50–140px, each in its own direction toward off-frame | Pure fade with no displacement reads as adjusting transparency; all in the same direction reads as a full-screen pan |
| Button migration | Slides to screen centre in 18f + scale ×1.5 + halo intensifies | Without migration it's a small corner button on black, reading as something missed in deletion; migrate first, vanish later — the order can't be reversed |
| Wordmark takeover | Enters ~10f after the button fades out, spring sign-off | On screen together with the button they fight for attention; an empty black gap >20f looks like the video ended |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- Division of labour with outro-group-photo-launch: the family photo is the "additive" peak final shot (whole cast curtain call for a multi-feature product); this card is a "subtractive" closing (single-action semantics, getting quieter as it goes) — choose one based on the product's personality; no double closings in the same film
- Each evaporation layer must be **a semantically complete UI block** (sidebar/panel/toolbar); slicing layers by pixel region exposes structurally implausible broken states during the stagger
- Keep the button at the top zIndex throughout its migration — any evaporating layer drifting in front of the button breaks the illusion
- The trigger action must have "terminal" semantics (Publish/Ship/Done); triggering full-UI evaporation with Save or an ordinary confirm doesn't earn the spectacle
- In real use the button uses the brand highlight colour (Framer blue in the original); the demo uses an indigo accent colour as a placeholder — the contrast of the button and its halo against the black is the lead's aura; a weak colour and the promotion fails

## Reference implementation
demos/outro/ui-strip-away-outro/
(UiStripAwayOutro.tsx)
Original source: framer-ai 33–36.5s
