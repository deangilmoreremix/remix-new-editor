---
name: theme-switch-moves
one_liner: Two styles of theme switch: theme-sweep diagonal sweep (the skin changes in place wherever the boundary passes) and palette-ripple combo (the ⌘K panel shrinks to a dot, a ripple spreads from the dot changing the skin)
use_when: Narrative sections for dark-mode/theme features; the same UI "changing colour before your eyes" rather than cutting to a new scene
length: A 140f (4.7s) / B 156f (5.2s)
energy: A medium / B medium-high (the combo has a complete causal chain)
---

## Intent
Two ways to shoot a dark/light mode switch. A (Notion/Figma/Linear's usual approach): a 15° diagonal
boundary band with a bright line sweeps across the whole frame (in the demo from the right side where the toggle is, sweeping toward the left), and wherever the boundary passes, light turns dark **in place**; the same layout
with both themes coexists for an instant: what the viewer sees is "the same UI changing its skin", not a transition.
B (combo variant): type "dark" into the ⌘K panel and press enter, the panel shrinks into a bright dot,
and a dark ripple spreads **from that dot** across the whole UI: the causal chain of "a command triggers the skin change" is completely readable.
The combo's make-or-break point: the ripple's centre must be the panel's shrink point, and its start frame must be the frame where the shrink completes.

## Variants
| Style | Approach | Use when |
|----|------|------|
| A theme-sweep-toggle | Close-up of the day/night toggle in the top bar (zoom 2.0): the pointer presses, the knob springs over to the moon (the sun retracts its rays and grows a crescent) → the dark world's clip-path polygon 15° diagonal edge sweeps from the toggle's side (64f, bezier(.3,0,.35,1)), while the camera pulls back to the full view over 30f; boundary = terminator line: a white-hot core line + a sunset-orange twilight band on the bright side that widens with speed + a cool blue glow on the night side; after the sweep, "the lights come on" (today pill / now line / window rim light lighting up in sequence) to confirm it | Directly showcasing the theme feature |
| B palette-theme-ripple | The panel springs down → letter-by-letter input at a human rhythm → on enter the panel shrinks CRT-power-off style (first squashed vertically into a bright line, then contracted horizontally into a bright dot) + the bright dot and horizontal afterglow pinned for 5f → circular clip radius 6→1260px spreads with strong ease-out, a 3px white-hot ring + coral outer glow / white inner glow + an echo ring 4f later; the dark version confirms with 1.035→1, and the camera exhales and pulls back along with it | Highlight segment linking the command palette and the theme |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Making the dark version | Hand-map the palette key by key (bg/card/border each get their own dark values) | Dark versions produced by filter inversion are wrong (images/avatars all inverted) |
| A diagonal oversweep | Compute the polygon with the diagonal extended 400px outward in world coordinates, the end point passing beyond the lower-left corner | Without oversweep, a light triangle remains in the corner |
| A causality | The sweep starts right against the toggle, and the boundary sweeps past the toggle ~6f after the press; the camera pulls back from the toggle close-up | If the boundary appears from far away or 10f+ late, you can't read "this toggle caused it" |
| A poster frame | The camera reaches the full view (40f) earlier than the terminator line crosses the centre line (~44–50f) | Pulling back too late → the full view never shows day and night on screen together, and the technique is reduced to a close-up |
| A confirmation | After the sweep, the lights that only exist at night come on in sequence (today pill / now line / window rim light) | More meaningful than scale 0.99; don't stack a full-screen white flash on top |
| B causal pinning | The bright dot hangs at the shrink point for 5f (+ horizontal afterglow), ripple centre = that point's coordinates, start frame = the frame the bright dot ends | A misplaced centre/wrong frame breaks the "command → skin change" causality (the combo's make-or-break point) |
| B ripple radius | Final value ≈ distance from centre to the farthest corner × 1.1 (demo 1260px) | Make the final value too large (like 2000+) and the front of the curve flashes past; the circle can't be read |
| B light layer | Conditionally unmounted after the sweep completes | Precondition for true stillness |

## Known pitfalls
- Tuned on a video-shotcraft UI designed for the shot (A launch-week production schedule / B sample-film gallery) in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- The two layouts must be pixel-for-pixel identical: any difference in layout reads as "switching to a different page",
  and the technique fails
- Real-page use: take real screenshots of the dark and light versions separately (Q1); don't fake dark mode with a filter
- ≤1 theme switch per film: it's feature narrative, not a transition; switching repeatedly reads as a demo accident
- Sound: A one long whoosh for the sweep; B one confirm on enter + a whoosh as the ripple spreads
  (S4, foley first)

## Reference implementation
demos/interaction/theme-switch-moves/
(PaletteThemeRipple.tsx / ThemeSweepToggle.tsx)
