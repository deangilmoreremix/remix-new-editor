---
name: canvas-materialize-moves
one_liner: Two styles of content "materialising onto the canvas": panel-to-canvas row-to-card (panel table rows fly out along an arc and morph across containers into canvas cards) and diagram-cascade cascading generation tree (after a prompt is typed, nodes pop out layer by layer, connecting lines grow before the nodes)
use_when: Narrative sections for AI/collaboration tools where "the generated result lands on the canvas"; style A tells "existing content changing its form of existence", style B tells "a structure growing out of one sentence"
length: A ~5s (150f) / B ~6s (180f)
energy: medium
tags: ui-entrance
---

## Intent
The library's generation narratives only have "written out word by word inside a window" (document-typewriter-reveal, the document writing itself)
and "the chart coming alive by itself" (chart-live-moves); there's no word for **content leaving its container and materialising as a new entity
on an open canvas**. This card fills that gap: the canvas is the stage, and the generated things are actors coming on
stage. Style A's make-or-break point is cross-container form migration: the same piece of content changes from a "row" into a "card", with position
/width-height/corner radius/content layout interpolated in sync on one spring, so the viewer reads "it flew over and
transformed" rather than "one deleted, one added"; style B's make-or-break point is cascade timing: lines pull out nodes, layers
feed out layers, and the sense of structure comes from sequence rather than simultaneity.

## Variants
| Style | Approach | Use when |
|----|------|------|
| A panel-to-canvas row-to-card | The cursor clicks checkboxes one by one to tick them → button pressed → three rows first lift up then fly out along an upward-tossed arc with staggered overlap; on the way, row form and card form cross-fade, and they land with a tilt and a squash on touchdown; the panel's row slots collapse into dashed blank space | Batch import / one-click to board: content migrating from a list state to a spatial state |
| B diagram-cascade cascading generation tree | The prompt is typed out letter by letter (outline confirms when typing finishes; after submit the outline streams light = generating) → a drip line from the bottom of the prompt connects to the root (gradient-outline protagonist) → 2 children → 4 grandchildren pulled out layer by layer from the top ports; elbow connecting lines with comet heads lead by 10f; the camera pulls back from the prompt close-up to reveal the whole tree; once the tree is formed, the whole tree breathes for one beat | AI-generated structure diagrams/mind maps/ER diagrams: a tree growing out of one sentence |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A ticking | One by one at 14/24/34f (the cursor clicks each via a swift arc), spring(damping 11, stiffness 300) pop + check line drawn in 7f | The ticks are the "preview"; without them the viewer doesn't know what will fly; all ticked on the same frame reads as statically pre-selected |
| A take-off staggered overlap | Button pressed at 52f, the three rows lift at 56/62/68f (4f: enlarge 2% + deeper shadow) then take off (staggered 6f) | All flying on the same frame reads as copy-paste; staggered >12f the last row looks left behind; flying without lifting reads as being deleted |
| A flight interpolation | spring(damping 17, stiffness 95, mass 0.9); position runs on a quadratic bezier, midpoint raised 220px; width/height converge 3f later | Flying in a straight line reads as translation, not "pouring out"; midpoint raised <100px and the arc feel disappears; size in sync with position loses the "parent first, child after" weight |
| A form migration | Row 626×104 → card 486×300, corner radius 18→24, rowOp goes out over us 0.08→0.4, cardOp comes up over 0.5→0.8 | The cross-fade between the two sets of content must be offset: both states showing in the middle gives the game away |
| A landing tilt | −2.5 / 1.8 / −1.2°, a 6f scaleY 0.97 squash and rebound on landing | All positive reads as grid layout; >4° reads as a scattered glitch |
| A speed blur | SpeedBlur amount 0.32, max 14 (along the arc's velocity direction) | Only in the flight segment; back to zero after landing |
| B typing | 0.95–1.2f per letter, uneven, 1.7f pause on spaces; when done, the prompt bar's outline turns purple to confirm, +4f the submit key is pressed | Constant-speed typing reads as a machine; with no confirm state there's no causal link between "done typing" and "starting to generate" |
| B camera | Opens pushed in to 1.3× with the prompt centred; after submit, 72f smooth pull-back to 1.0 | Without the push-in the bottom half of the frame is empty for the first 2s; the pull-back must happen at the same time as the cascade, so the tree grows in the space the camera "retreats" to open up |
| B cascade timing | Root = submit +14f, 22f between layers, 5f staggered overlap between siblings on the same layer; nodes spring(damping 14, stiffness 190), scale origin = midpoint of the top edge (pulled out of the port) | Layer interval <12f reads as everything appearing at once; siblings on the same frame read as copies; scaling from the centre reads as a popup |
| B lines lead | SVG arc elbow path (parent's bottom port → centre line → child's top port) drawn over 16f ease-out, 10f earlier than the child node; a comet light dot at the head of the line | "Lines pulling out nodes" is the source of the causal feel; a line later than its node becomes an afterthought stroke |
| B closing breath | From last node +22f, scale 1→1.03→1 with the tree centre as origin (smooth, 28f), with the aurora behind brightening a notch at the same time | The breath is the full stop of "the tree is formed"; >1.06 reads as a scaling glitch |

## Known pitfalls
- Tuned on grayscale/placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- Division of labour with chart-live-moves: that card is the liveliness of a data chart itself (flow lines/dot matrix/exploding axes),
  style B is the **birth process** of a structure diagram: a chart being alive ≠ a chart being generated; don't use style B to perform an existing chart
- Style A's row slots must collapse into dashed blank space: if the original position is intact after the row flies away, "migration" degrades into
  "copying", and the meaning is lost entirely
- Style A's cross-fade window (rowOp goes out before u≈0.45, cardOp comes up after it) is the make-or-break point for not giving the game away
  ; the spring overshoots, so u can briefly be >1; clamp all content opacity
- Style B's breath origin must be the tree's visual centre of gravity (demo 960,620), not the frame centre,
  otherwise it reads as a whole-screen zoom
- Style B's comet head takes points by path arc length: use SVG arcs (the A command) for the elbows rather than quadratic beziers, so the length can be computed analytically and accurately,
  and the line head doesn't come apart from the drawn line's endpoint

## Reference implementation
demos/interaction/canvas-materialize-moves/
(DiagramCascadeBuild.tsx / PanelToCanvasMaterialize.tsx)
Source footage: miro-promo 84–92s (style A) / 104–116s (style B)
