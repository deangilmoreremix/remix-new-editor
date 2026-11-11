---
name: beat-step-list-theme-cycle
one_liner: Three-channel metronome — a list of adjectives on a dark field steps up one row per beat, a fixed pill at the centre of the viewport "catches" the next word and changes colour, and the whole field's background changes on the same beat; row, colour and field, three channels locked to the same beat
use_when: Passages showing "one product, many personalities / many themes" (rapid-fire adjectives like modern/playful/expressive); the densest-rhythm stretch of the film; syncing to a music section
length: 30f lead-in + 18f per beat × number of beats + closing hold; 4 beats ≈4.7s (demo 140f)
energy: high (three channels jump together every 0.6s; density-type high energy)
tags: typography
---

## Intent
Changing the theme colour once is a feature demo; changing it every 0.6 seconds, three times in a row, with "selected row + pill colour + whole-field background" all jumping on the same frame each time — that becomes a metronome. The cheapest variable switch produces the highest rhythmic density in the film. There are two make-or-break points: first, **the three channels must be locked to the same beat** — if any channel lags half a beat, the "jump together" degrades into three animations each doing its own thing; second, **the boundary between jumping and sliding** — the jump occupies only the first 6f of each beat, the remaining 12f are completely still; the beat must "jump", not "slide" — a list scrolling at constant speed is just a list.

## Motion core
- The pill stays fixed on the viewport's centre row and **does not move**; the list steps its translateY each beat — visually it reads as "the pill jumps to the next row to catch the new word", but what actually moves is the world, not the pill
- Beat length 18f (0.6s @30fps ≈ 100BPM), the jump window is only the first 6f of the beat: `snap(t) = 1-(1-x)^3.2` (steep ease-out), the remaining frames are still
- Three channels driven from one source: the same tInBeat simultaneously feeds the list offset, the per-channel rgb cross-mix of pill/background, and the pill squash — one clock; no hanging separate curves on each
- The theme table changes pair each beat (demo "Make it modern → playful → expressive → BOLD → yours.": bone white/deep espresso → orange/deep plum → iris purple/deep indigo → mint/deep teal → sunflower yellow/deep navy); the pill colour and background are a matched light/dark pair, not independent random colours; each theme also carries a typeface for the selected word (sans-serif / rounded / serif italic / all-caps Futura), changed on the same beat — the reskin reads as "many personalities", not just a colour change
- Pill = lens: outside the pill is a uniform dim-white list; inside the pill is a cropped copy of the same list (dark text + theme typeface); a word changes colour and typeface only at the moment it crosses the pill's edge; pill width = measured width of the selected word + padding, interpolated off the same tInBeat
- Pill landing squash: vertical 1.14→0.96→1, horizontal in antiphase 0.97→1.01→1, completed within the first 6f of the beat; at the moment of catching, the pill brightens + a same-colour glow swells briefly (exponential, retracts in ~3f)
- Unselected words fade by row distance from the viewport centre (adjacent rows 42% white, −15% for each row further away, slight font-size shrink, distant rows blurred); top and bottom background-colour gradients feather into the viewport — the feather colour must stay synced with bgColor in real time; hard-coding the colour breaks the illusion when the field changes
- Element-level echo (optional): a corner theme counter 03/05 and a swatch row hang off the same integer beat to change state; add no full-frame impact
- 30f of still lead-in before the beats start — first let the audience see clearly "this is a list", then start beating

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Beat length | 18f (BEAT_LEN; change it to change BPM to match the audio track) | <12f the audience can't read the words and only sees flashing colours; >26f the beat feel scatters into one-by-one display |
| Jump window | First 6f of the beat, ease-out exponent 3.2 | Window >10f or a gentle curve and "jump" becomes "slide"; the metronome collapses into a scrolling list |
| Number of beats | 3–4 beats | 5+ beats the audience adapts to the rhythm and drifts off; 1–2 beats can't establish the "metronome" persona |
| squash | Vertical 1.14→0.96→1 / horizontal antiphase 0.97→1.01→1 | Without it the pill looks like a texture swapping colour; >1.2 the bounce steals the show from the colour change |
| Background span | Adjacent themes' backgrounds must share lightness but differ in hue (all dark) | A lightness jump (dark→light) reads as a screen flash, not a reskin |
| Lead-in/closing | 30f still at the start; hold ≥30f after the last beat | Without lead-in the first beat reads as a bug; cutting right on the last beat gives no confirmation of "settling on the final colour" |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final; re-check with real material on first real use
- Division of labour with theme-switch-moves: that card is a ceremony for a single reskin (sweep/ripple, one change telling one story); this card uses several consecutive reskins as beats — use that card to talk about a "dark mode feature", use this card to talk about "many personalities / theme volume"
- **Strongly sound-dependent**: beats align to drum hits (change BEAT_LEN to match BPM); a silent version of the three channels jumping together reads as the UI glitching
- Word list length ≥ number of beats + 2 — leave unselected words padding the bottom of the list; if the last beat stops on the final row, it exposes "there's nothing below"
- Don't use "integer-beat-based inverted highlight" for the selected state: during the 6f jump the new word turns black while still below the pill, which reads as a glitch. The demo uses the pill lens (cropped copy) — text colour / typeface is determined by the geometric boundary; colour still follows the fractional tInBeat
- Pill width is hard-coded from the measured width of the selected word (re-measure when changing typeface / font size), otherwise text hugs the edge or the pill is half-empty
- Theme typefaces use system stacks: Chrome doesn't recognise `ui-rounded`; rounded falls back to Arial Rounded MT Bold; missing typefaces fall back to sans-serif

## Reference implementation
demos/rhythm/beat-step-list-theme-cycle/
(BeatStepListThemeCycle.tsx)
Original source: bear-app 22.3–24.6s
