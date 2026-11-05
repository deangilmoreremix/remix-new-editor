---
name: type-and-filter
one_liner: Typing a search into the real UI, the grid converges by itself into one card, and a click punches through into the detail page
use_when: The "operation narrative" segment of a feature demo; any interaction chain of searching/filtering/entering details
length: about 2.5s (118–190f)
energy: medium (an unhurried beat after the high-energy card-dealing segment)
---

## Intent
Let the viewer "follow along once": see clearly what was typed, how the page responds, and where was clicked. This is the only shot in the film that simulates a real person operating it; the rhythm must feel like a human hand, not a script.

## Motion core
- The camera hugs the search box (zoom 2.0, effective glyph height of the typed text ≈30px) and types character by character, the cursor solid → blinking; at the breathing pause after typing, it pulls back to the full-frame wide view (zoom 1.0) to watch the grid converge
- After typing, leave a breath, then non-target cards fade out and sink with staggered overlap in reading order, and the grid converges
- The target card slides to the first-row slot, lifting + its shadow widening on the way
- The pointer slides to the target card in the wide view (constant screen size), a double-ring accent-colour (amber in the template film) ripple confirms the click, and the camera pushes in to punch through into the detail page, handing off to the transition

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Typing speed | 3f/character (TYPE_START=128, "nano-lab" 8 characters ≈ finishes at 149) | The final value after the first version was found too fast and reworked ("unhurried"); interaction demos go at a real person's operating speed (R3) |
| Breathing pause | From finishing typing to filtering, FILTER_START=160, leaving ~11f (0.37s) | Filtering immediately after typing reads as machine automation; the viewer can't keep up with the causality |
| Cursor | Solid while typing, then blinking on an 8f cycle; click at 176f, cursor disappears at 185f | Blinking while typing reads as stuttering; the switch from solid → blinking is itself the signal that "typing is done" |
| Filter exit | 25 non-target cards staggered in reading order at 0.4f intervals, each 5f fade-out + sink 8px | Disappearing all at once reads as the page crashing; a staggered overlap of even just 0.4f is enough |
| Target card slide | 10f slide to the first-row slot, bezier(0.35,0,0.2,1), lifting by sin to z 18px, scale +0.02, shadow widening with the lift on the way | The end point must be a real slot in the layout (Q9); sliding to hover in the middle of the frame is fake |
| Click confirmation | Two concentric accent-colour ripples (start offset 3f, 10f each, radius 14→54/78) + 3px outline + 40px glow, then the camera pushes in to zoom 2.2 over 16f | A single-ring ripple is too light to see; the push-in hands off to flash-cut to cover the hard cut of the page change (component in assets/lib/FlashCut.tsx, usage: from = cut point − 5, straddling the hard cut by 5f on each side) |
| Search box | A page-background-colour patch covers the placeholder baked into the texture (keeping the magnifier icon), and the text layer is stacked on top for typing | Stacking text directly on the screenshot texture ghosts against the baked-in placeholder |

## Sound
Pin keyboard.mp3 on the typing segment and cut it with Sequence to 24f, strictly the same length as the action (S4); pin click-camera on the click (the loudest in the film, vol 0.6, S2 loudness layering); pin whoosh-fast on the grid flying away.

## Known pitfalls
- The first version's typing + filtering was "too fast" and reworked (R3): the first version of an interaction shot is almost always too fast, so draft at 3f/character from the start
- If after filtering the target card doesn't return to a real slot and instead hovers above the grid, it reads as fake (Q9; this once led to rewriting nearly the whole file)

## Reference implementation
demos/interaction/type-and-filter/TypeAndFilter.tsx (originally the 118–190 segment of template/src/aifl/live/SceneFlyIn.tsx)
