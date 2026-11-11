---
name: impact-feedback
one_liner: Two hit-feedback styles: hit-counter combo counter (hit-stop + damage numbers + combo jump text), anime-impact anime impact frame (negative + speed lines + chromatic aberration)
use_when: The "moment of impact" when an element lands/collides: giving slam-ins and crash stops game-grade feel; pick the style on an intensity ladder
length: n/a (element-level technique, riding on a landing action; the frames each style takes are in the parameters table)
energy: high (instantaneous impact)
---

## Intent
An element slams into place but without a "it hit" instant, the landing reads as a PPT fly-in. Game juice
(Vlambeer screenshake theory) and anime direction's impact frames give the same answer:
bite down on time for those few frames of impact, and only then does the impulse reach the viewer's hands. The two styles form an intensity ladder:
B uses local hit-stop layered with damage numbers and combo jump text, cutting the feature list into a combo,
with the strongest narrative feel; C is the heaviest punch: 3 frames at the crash stop flip to a negative and burst into speed lines, the highest accent level,
the most stylised.

## Variants
| Style | Approach | Use when |
|----|------|------|
| B hit-counter combo counter | Three cards slam in one after another, each hit = 2f hit-stop + damage number floating up + ×N counter jump text escalating each time; the demo writes the "damage" as the production time each video-shotcraft feature saves, which drifts off and lands in the card footer | Rapid-fire feature-point sections: tell "lots of features" as a combo; heavy game-style language |
| C anime-impact impact frame | On the crash-zoom crash stop, 3f full-frame negative inversion + radial speed lines + red-cyan chromatic aberration, all withdrawn on the 4th f | The single climactic punch of the whole film; the accent level maxed out |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| B rhythm | Three cards 28f apart each (animation time 30/58/86), slamming down with ease-in(quad) over the 10f before the hit; each hit freezes everything for 2f (the background diagonal stripe scroll freezes too) | Only even intervals give the "combo" beat feel |
| B damage numbers | Struck on the lower middle of the card face, scale 1.45→1 + floating up 150px past the card edge, fading out over 12f after 4f; size per hit 88/104/124px, yellow italic + hard drop shadow | Fade-out >16f drags and blocks the next hit; taking off from above the card top bumps into the corner counter |
| B counter | Pulse peaks 1.3/1.45/1.6, rotate −2/−4/−6°, size 140/166/196px, `exp(−t/2.4)` falling back; three-cell heat bar lighting cell by cell | Escalating each time is the make-or-break point: three hits the same size can't read as "hitting harder and harder" |
| C crash push and stop | First a 6f anticipation pull-back to 0.985, then crash-zoom 6f ease-in(cubic) pushing to 2.25x (card height 454×2.25 ≈ 95% of frame height, so the outline isn't cut in half by the frame), card centre converging to frame centre; flight frames get time-sampled motion blur + a sharp central copy | Crash push parameters follow the crash-zoom-punch card |
| C impact frame | 3f from the crash stop: `invert(1) grayscale(1) contrast(1.45)` + 34 thick wedges + 22 thin needles of speed lines (changing shape every frame, the inner ends eaten by a radial fade to leave a focal point) + red/cyan negative copies screen-blended with ±8px offset; all withdrawn on the 4th f, the page outside the card darkened for one beat | 3f is the sweet spot: from 4f the viewer starts to "see" the negative clearly, and the magic trick is given away |
| C recovery shake | From the 4th f 6px exponential decay (τ≈2.2f), settled in ~12f | Amplitude must cross the naked-eye threshold (perceptibility ruling) |

## Known pitfalls
- Tuned on greyscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Style B's hit-stop **must be global**: the background scroll must freeze too, otherwise "time being
  bitten" can't be read, it just looks like that card dropped frames. The demo driving all layers with one unified remapped frame df is the make-or-break point;
  only effects that "must also happen during the freeze", like the white flash, are driven by the real frame f
- Frame remap shares a technical root with speed-ramp-freeze; don't stack the two cards in the same shot:
  two remaps fight each other and the rhythm reads as a glitch
- Style C's negative frames steal the show badly in paper-and-ink aesthetic films: limit to one climax, and it must
  land on the same frame as an impact sound effect (foley via sound-design); a silent negative frame reads as a broken flash
- Style B's game-style language is heavy (damage numbers/combo are blatant gaming tropes); use with care when the product tone
  leans serious
- After multiple hit-stops in style B, real frames run ahead of animation time by the accumulated frozen frames; when laying out the shot budget
  convert with `real hit frame = animation hit frame + frames already frozen` (demo HITS_REAL)

## Reference implementation
demos/effects/impact-feedback/
(AnimeImpact.tsx / HitCounter.tsx)
