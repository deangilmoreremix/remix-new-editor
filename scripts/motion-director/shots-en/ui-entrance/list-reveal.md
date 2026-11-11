---
name: list-reveal
one_liner: A vertical menu's 6 items find their place one after another at 10f intervals via scale, settling with a slight soft-back overshoot, while the whole list container moves up at constant speed throughout. Per-item entrance and overall drift are two unrelated layers of motion
use_when: Entrance of navigation / sidebars / settings panels; any UI passage where "the interface grows itself"; also suitable as a low-energy bed under narration setup
length: about 4s (120f@30fps)
energy: low (steady beat, no peak; drift keeps the frame from going dead)
---

## Intent
A list fading in item by item is one of the motions most easily made stiff: each item stops once it has moved, and the frame is completely static between two items.
This card's solution is to give the container a slow drift layer unrelated to the per-item entrance: locally things are "finding their place", globally the frame is "breathing".
The viewer can read every item clearly, and from start to finish not a single frame is nailed still.

## Motion core
- The two layers of motion are fully decoupled: the container `translateY(DRIFT/2 − DRIFT·f/(N−1))` consumes only the global frame and is a constant-speed drift through the whole shot
  (demo: 96px total in 1920 coordinates, +48 → −48, ≈0.8px/f); each item consumes only its own local window, and neither takes part in the other's calculation
- Per-item entrance: start `2 + i·10f`, window 24f; a 10f stagger is one notch slower than a typical UI stagger. This is a "readable to the end" interval,
  not a "rapid spread" interval; the window is 2.4× the stagger → 2–3 adjacent items are moving at the same time, so the queue is continuous
- The place-finding action is scale-led: `scale(0.82 → 1)` with `translateY(44 → 0)` + focus blur 8px → 0;
  what the viewer perceives is "from blurry to sharp, growing from small into place", not "flying up from below"
- Soft overshoot `bezier(0.3, 1.18, 0.5, 1)` (~1.5%): the amount is tiny; its job is to turn the landing frame from "stopping" into "clicking in"
- Follow-through: the icon lands 2f late, the right-side shortcut / badge 4f late; opacity `min(1, lin·2.2)`, fully solid at 45% of travel
- The current item (Home) is the only highlight in the shot: a porcelain-white solid bar + one sweep of light after landing (Q4); the other items are dark graphite surfaces + hairlines

## Parameters (demo in native 1920×1080 coordinates)
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Item count | 6 (Home…Sign out) | The last item starts at 52f and settles at 76f, leaving ~44f at the tail for the viewer to wrap up; >8 items you must compress the stagger, otherwise the last item eats into the ending |
| stagger | 10f/item | 10f is "each item readable to the end"; compressed to 4f it becomes a single spread (a different technique); stretched above 16f the beat falls apart |
| Per-item window | 24f | Window 2.4× longer than stagger → adjacent items overlap; if the two are equal it becomes a hard item-by-item hand-off |
| Starting scale | 0.82 | A scale at which "it's already recognisable as an entry"; <0.5 reads as popping from zero and gets confused with pop-type techniques |
| Starting offset / blur | 44px / 8px | The offset must be smaller than the row pitch (92px row height + 14px gap), otherwise items cut through each other |
| Overshoot | soft back ~1.5% | Should be so small it's barely readable; switch to a spring or increase the overshoot and 6 items jiggling in a row looks cheap |
| Container drift | constant 96px throughout (≈0.8px/f) | Total is 2× the per-item offset, speed an order of magnitude slower: reads as "the frame is breathing"; when the speed approaches the per-item entrance speed the two layers merge into one thing |
| Opacity slope | `min(1, lin·2.2)` | Lowered to 1 you see semi-transparent items layered over the background, especially dirty on a dark field |

## Known pitfalls
- The container drift is constant-speed and runs the whole shot; the last frame ends at −48px, not 0. This motion **does not return to position on the last frame**.
  To loop it or align position with the next shot, swap the drift for a settling curve, or add a reverse ease-out at the end
- A change in item count requires recalculating the stagger: the last item's start is `2 + (n−1)·10f`, plus the 24f window; leave ≥30f for the ending
- Row width 700px, labels `nowrap`: Chinese or longer English labels will push into the right-side shortcut; when changing copy, widen accordingly;
  total list height is ~644px; before adding items, check that after drift the first and last items are still within the safe area (demo drift range y 188–928)
- The drift direction (up) matches the per-item offset direction (44px→0, also up). This is intentional (same-direction stacking is smoother),
  but the two speeds must keep an order-of-magnitude gap, otherwise it reads as "floating up together" rather than two layers
- The right-side title waits until the list is half laid out (46f) before entering: the opening gives the list alone the lead role (Q5), otherwise the viewer's eye goes back and forth between two places
- Icons are monochrome line icons; only the current item uses a solid highlight, and the unread badge uses the accent colour; on a light interface, strokes and shadows must be re-tuned

## Reference implementation
demos/ui-entrance/list-reveal/
(ListReveal.tsx: graphite dark field, sidebar poster with the list on the left + a 120px title on the right)
