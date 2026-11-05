---
name: tear-streak-transitions
one_liner: Tear transition: glitch-displace noise tear (hard cut in the middle of 16 horizontal strips jittering out of alignment), a strip-level tear with digital-glitch semantics
use_when: High-energy page changes: digital glitch/rupture semantics; a strip-level tear that keeps page integrity intact while maxing out energy
length: before state ≥40f + tear 16–24f + ending ≥40f, about 4.5s (135f)
energy: high
tags: effects
---

## Intent
This card handles **strip-level tearing**: the page is cut into horizontal strips moving at high speed, but each strip's content is intact.
This is a taste boundary drawn by repeated rulings: fragment-type transitions were rejected three times in a row (doom-melt falling vertical strips,
pixel-dissolve squares flipping to black, facade-block bricks flying all eliminated), while strip-type passed. Fragments read as "the page being destroyed", strips read as "the page moving at
high speed": integrity intact, energy maxed out. Horizontal tear: strips jitter out of alignment left and right +
two-colour silhouette ghosting (a restrained version of RGB split: two monochrome silhouettes of the same page content, using only the frame's two accent colours, offset ±12px).
Suits system glitch/instant jump semantics; the demo uses it for the state jump of "the release console jumping from Rolling out 99% to is live".

## Variants
| Style | Approach | Use when |
|----|------|------|
| A glitch-displace | 16 horizontal strips of unequal height (outer clip + inner full page translateY for alignment), each strip's translateX driven by library hash h(i*31+f*7) jittering ±70px, overlaid with two-colour silhouette ghosting + scan highlight lines; at 54f, in the middle of full-amplitude jitter, hard cut to page B, then jitter 6f more until settling at 60f | Glitch/rupture semantics; state jumps (going live, switching versions); violent page change before a climax |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Jitter amplitude | ±70px, energy distributed per strip (about 20% don't move / 30% full amplitude / the rest tremble lightly), displacement passed through exponent 0.6 to push toward the extremes; a full page laid underneath to prevent gaps showing the base | On peak frames the strip misalignment must be clearly visible to the naked eye: at the ±12px level the tear can't be read; all strips jittering at the same amplitude looks like water ripples |
| Envelope | 44–47f out-cubic surge → plateau → 54–60f linear dissipation | Impact ruling: spread out-cubic, dissipate linear |
| Ghosting | ±12px two-colour silhouettes (accent-colour monochrome copies of the page content, screen blend, misaligned along with the strips, only on strips with large misalignment) | Without ghosting it's just jitter, not glitch; silhouettes draw only the content, not the base, so they don't go grey on a dark field |
| Cut edges / scanlines | On strips misaligned >25px, a 1.5px bright line on the top edge and a 3px dark gradient on the bottom edge; each frame 2 full-width scan highlight lines at random heights | Drawing bright edges on every strip reads as ruled paper: only on heavily torn strips |
| Cut point cover | 54f exposure 1.28 / 55f 1.12 + whole-screen 1.6% impact enlargement retracting over 6f; at 30–31f two thin strips ±12px as a precursor | The precursor is anticipation: the viewer first "senses something's wrong", then the tear |
| Remove the mask | From 60f strips, ghosting, scanlines and filters are all conditionally unmounted, outputting bare B directly | opacity 0 doesn't count as removing; filter residue ruins true stillness |
| Ending | 75f (aftermath 40f: region-grid teal wave, counting, metrics rising + hold 35f) | R1; the aftermath is only in the page content layer, no more tear elements |

## Known pitfalls
- The demo is tuned on a programmatically drawn dark-field console page (midnight look): the parameters are a starting point, not final;
  re-check with real material on first real use; on light-background pages switch the silhouette ghosting to multiply for it to be visible
- **Strips, not fragments**: all later techniques of this kind must be strips: each horizontal strip intact,
  never cracking into squares/bricks/independently falling pieces (triple-rejection ruling, see Intent)
- High-energy transition; in the same film as whip-pan/crash family, mind the energy budget:
  high-energy transitions crowded together dilute each other
- The hard cut is hidden inside full-amplitude jitter (cut at 54f, settle at 60f): a cut point exposed on a still frame
  loses the glitch's cover
- Strip pages must carry their own opaque base (gradient + dot grid), with vignette and grain drawn only once on the top layer:
  transparent strips double-expose with the full page underneath, and a vignette misaligned along with the strips gives it away

## Reference implementation
demos/transition/tear-streak-transitions/
(GlitchDisplace.tsx)
