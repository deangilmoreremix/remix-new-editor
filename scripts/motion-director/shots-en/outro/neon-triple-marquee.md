---
name: neon-triple-marquee
one_liner: Three-row opposing neon marquee recap — giant hollow neon-tube letters of a three-word phrase fill the top, middle and bottom of an obliquely shot brick wall; odd and even rows scroll endlessly in opposite directions at constant speed, the three rows light up in turn at 1/3 phase, and at the end they lose power row by row
use_when: End-of-film passage replaying the theme words; an "afterglow" treatment for a three-word slogan; narration-free laying out over a music section
length: 4–5s (demo 150f: 18f row-by-row ignition power-up + loop body + 18f row-by-row power-down + 8f lights-out hold)
energy: medium-high (continuous flow + row-by-row pulses, no instantaneous impact)
tags: typography
---

## Intent
One line of marquee is just web decoration; stack three, run odd and even rows in opposite directions, then let brightness cycle by phase, and it becomes "the theme words parading in formation before the audience's eyes". The make-or-break point is **light-and-dark round singing**: at any moment only one row is the neon lead, the others are dimmed to thin-outline background — all three rows lit is a signage accident; lighting in turn is the recap. Opposing scroll creates "envelopment": top and bottom rows go right, the middle row goes left, the eye is pinched in the middle, words flow past endlessly from both sides, reading as "these three words never run out".

## Motion core
- Seamless wrap: copies are absolutely positioned at fixed equal spacing unitW, translated by `(frame*speed) % unitW` modulo — constant linear speed (the marquee class is a library linear-easing exemption)
- Hollow tube letters in three layers: `-webkit-text-stroke`, color transparent — dark-state glass tube (same colour at 0.3 opacity, always on, so the three-row structure is always there) → energised coloured tube body (stroke 6→10px + three-layer drop-shadow glow 9/36/90px) → near-white hot core (2→3.8px); brightness simultaneously drives same-colour light spill on the brick wall behind (screen blend, lighting up the mortar lines) — adjusting only opacity without glow doesn't read as "neon powered on"
- Round singing: period 42f, one 14f slot per row, slot length 16f (overlapping the next row by 2f for handover, so there's never an all-dark empty beat); within the slot the first 2 frames flicker on ignition (0.6 → 0.25 → full), 3f ramp to full, plateau, last 5f ease-in off — guaranteeing "one lit, two dark" always holds
- Camera: the whole wall sits on a 3D plane at perspective 1700, shot obliquely, rotateY −17°→−9° with a smooth, extremely slow pan-in throughout + scale 1→1.05; at the foot of the wall a strip of wet ground, with the bottom row's flipped reflection (blur 3px + fade mask) and each row's own coloured light pool on the ground breathing with brightness
- Three-row colour scheme ice cyan/magenta/sodium-lamp amber (#38d9ff/#ff3d9a/#ffae34), blue-black brick wall #0a0b14; the middle row reversed and slightly faster (9/11/9 px/f)
- Power-up / power-down: at the start the three rows run a deterministic ignition flicker sequence in turn at 0/5/10f; from 124f, top to bottom, each row staggered by 6f flickers twice and goes out, landing on a lights-out poster with only the dark-state glass tubes (not fading to dead black)
- Typeface Avenir Next Condensed Heavy 286px (fallback DIN Condensed / Impact), word spacing laid out from canvas-measured widths, separated by hollow diamonds ◇ (border same colour and weight as that row's tube)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Font size/line spacing | 286px condensed, 290px line spacing filling the wall | Gaps between rows >80px read as three banner ads, not a wall of words |
| Scroll speed | 9/11/9 px/f, middle row reversed | Condensed letters are denser, so one notch slower than a wide face; >20 the words become unreadable, just bands of light; three rows at the same speed and direction read as the whole layout panning |
| Pulse period | 42f, 14f slot per row + 2f handover overlap | Period <30f the three rows fight to flash and read as a fault; >70f the round-singing feel breaks; without overlap there's an all-dark empty beat every 14f |
| Brightness range | Dark-state glass 0.3 + energised stroke 6→10px + three-layer glow | Dark state <0.2 the dark rows vanish and the "three rows" structure is lost |
| Glow | Three-layer drop-shadow, lit state 9/36/90px + wall spill 0.55 | Single layer or <20px reads as ordinary outlined text, not neon; without wall spill it reads as "text on a screen", not "lights on a wall" |
| Oblique shot | rotateY −17°→−9°, perspective 1700 | >25° the far-end words crowd into an unreadable lump; 0° returns to flat and loses depth |
| Power-up/power-down | In: row-by-row ignition staggered 5f; out: from 124f row-by-row power-down staggered 6f | Hard cuts in and out read as the material not filling the frame; the whole group fading out at once lacks the "lights off" ceremony |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- Division of labour with page-waterfall-wall: that card is a vertical waterfall of page screenshots for "content volume"; this card is horizontally opposing text rows for "theme-word afterglow" — the material is words not pages, and the position is the end of the film, not the middle
- Division of labour with outro-group-photo-launch: the group photo is the peak final shot (elements' group photo + launch-event finale); this card is the recap lead-in before the final shot, or a low-cost alternative final shot; the two can be chained (this card → fade out → group photo) but not stacked
- Number of copies is `ceil(1920/unitW)+3` for redundancy — short words (≤4 characters) have small unitW, and too few copies will expose a gap on the right at the moment of wrapping
- Real-use brand-colour version: the three rows can share a single brand colour and be distinguished by light/dark, but the glow contrast must be ≥ the demo's range of dark-state 0.3 → fully energised + three-layer glow, otherwise the round singing doesn't read
- drop-shadow glow on a 3D oblique plane is not cheap (demo renders 150f at 1080p in about 7s); the reflection layer draws only the tube bodies, not the glow (cheap)

## Reference implementation
demos/outro/neon-triple-marquee/
(NeonTripleMarquee.tsx)
Original source: clickup-30 61–64.5s
