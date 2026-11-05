---
name: segmented-thumb-hero
one_liner: The segmented control's thumb displacement as the protagonist in close-up: an oversized pill segmented control springs up into place, an outlined arrow cursor slides in from off-frame and presses, the white thumb slides 8f ease-out to the other segment, and the instant it arrives the new icon springs out while the old icon tucks away
use_when: Announcement shots for "mode switch / pick one of two" features (in the demo, the video-shotcraft Prompt→Film, Chat→Agent style); a close-up approach where one UI micro-interaction carries a whole shot
length: ~3.5s (demo 110f: float-in 18f + cursor 24f + click + slide 8f + icon pop-out + hold)
energy: medium (a micro-interaction close-up, refined rather than loud)
---

## Intent
When a product switches to a new mode, the usual approach is to swap the whole interface. This card does the opposite: it enlarges the segmented
control to 1080px wide and shoots it in close-up, and **those 8 frames of thumb displacement are themselves the narrative**:
"we went from A to B". There's no page context whatsoever; the control is the stage. The causal chain is complete:
the cursor slides in (someone has arrived) → press + ripple (a decision was made) → thumb slides (the world responds)
→ new icon pops out (a new identity is established). None of the four beats can be missing: without the cursor it's the UI moving by itself,
without the icon pop-out the switch has no reward.

## Motion core
- The control's close-up size is 1080×220, springing up from 200px below
  (spring damping 14 / stiffness 120), with a large shadow shrinking as it lands (24→12px)
- The cursor is an oversized outlined arrow (130px, white fill with ink outline): 24f Easing.out(cubic)
  sliding from off-frame at the lower right onto the target segment; press scale 1→0.86→1 (3f down, 4f back)
- **The thumb is strictly 8f** Easing.out(cubic) (demo 52→60f): reproducing the source footage's feel;
  those 8f are the heartbeat of the whole shot, and every beat before and after serves it
- At the instant of arrival two actions start on the same frame: the new icon pops out with spring(damping 10, stiffness 220)
  overshoot; the old icon collapses over 6f Easing.in with width going to zero in sync so the text reflows naturally
- Click ripple: a 3px accent-colour thin ring expands from the click point (the cursor tip) and fades out over 12f (Easing.out(quad))
  : the ripple confirms that a "press" happened; a click without a ripple reads as the cursor passing by

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Control size | 1080×220, thumb inset 16px | Shrink to <600px wide and it's no longer a close-up; the thumb displacement doesn't read as having weight |
| Thumb duration | 8f Easing.out(cubic) | >14f reads as a slow-motion demo video; <5f reads as teleporting, the "slide" is gone |
| Cursor slide-in | 24f from off-frame, ease-out | linear or <14f reads as the cursor being thrown in; the starting point must be off-frame |
| Press | scale 0.86 + ripple 12f | Sliding the thumb directly without a press breaks the causal chain and reads as autoplay |
| Icon pop-out | spring damping 10/stiffness 220 | damping <8 bounces three times and steals the thumb's scene; if the old icon doesn't tuck away the text squeezes out of the control |
| Closing hold | New state rests ≥30f | Cutting away immediately after the switch means the "new mode" isn't seen clearly |

## Known pitfalls
- Tuned on grayscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Division of labour with cursor-flyover: that card is the cursor clicking and pushing in within a complete page
  (with context); this card takes the control out of the page and shoots it as a background-free close-up: they can coexist in the same film,
  but don't shoot both a page version and a close-up version of the same click
- Collapse the icon by zeroing width rather than only scaling: scaling alone leaves an empty space, the text doesn't reflow,
  and a "ghost gap" appears inside the control (in the demo width and scale are driven in sync)
- Use with caution on controls with more than two segments (3+ segments): an 8f thumb slide across several segments is too fast to read where it stops,
  and lengthening it breaks the feel: this card works most smoothly for "pick one of two"
- The ripple ring must have a zIndex above the thumb, with its centre locked to the click point: following the thumb
  makes it the thumb's trail, and the meaning is wrong
- Swapping in real material: just replace the segment labels/icons with real feature names, but the "new segment icon with an expression"
  (the smiling clapperboard in the demo) is half of the sense of reward; a plain outline icon is noticeably flatter

## Reference implementation
demos/interaction/segmented-thumb-hero/
(SegmentedThumbHero.tsx)
Source footage: perplexity-promo 2.3–5s
