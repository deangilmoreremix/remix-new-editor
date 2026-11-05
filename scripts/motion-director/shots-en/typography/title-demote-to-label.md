---
name: title-demote-to-label
one_liner: Two variants of a big title demoted to a section label — A: the big title develops in the centre, holds for a beat, then continuously shrinks to 0.3x and translates to the top-left corner to become a section label, while the content area grows beneath it; B: the same routine, but on entrance a text-selection highlight block sweeps in and is then withdrawn
use_when: Chapter openings (the title is the hero first, then gives way to the content); section handovers in tutorial / feature-demo films; variant B adds an identity hint for "text/editing" type products
length: A ~3.7s (112f) / B ~4.5s (134f); in the demo the two variants play back to back, 246f
energy: low-medium (layout-transformation type, an atmosphere shot)
tags: transition
---

## Intent
The usual fate of a chapter title is "appear → disappear → content enters", with title and content strangers to each other.
This card makes the title **demote rather than exit**: the big centred word holds for a beat announcing the theme, then in a single continuous
tween shrinks to 0.3x and flies to the top-left corner, landing as this section's column label — it's still on screen,
it has just gone from hero to door plate. The audience gets free spatial memory: the big word from a moment ago is
the small word in the top-left now, and that's what this section is about. The content skeleton starts growing while the demotion is still in progress,
so the handover has zero gap.

## Motion core
- The demotion is a **single continuous tween**, 26f asymmetric in-out (bezier(0.6,0,0.18,1): a decisive start, a very soft landing):
  scale 1→0.22 (220px title → ≈48px label) + position (960,540)→(216,196) on the same curve — splitting it into two stages (shrink first, then fly) reads as two actions
- transform-origin left-centre; the centring correction translate(-50%) returns to zero in sync with the tween
  (`translate(${-(1-dem)*50}%, -50%)`) — if it doesn't return to zero, the end point is off by half a width
- Entrance development: the title rises character by character from below a mask line (rise, 16f/character, 1.6f staggered overlap), and the vermilion full stop pops out with overshoot 10f later;
  the mono eyebrow "CHAPTER 01" tightens its letter spacing from wide. After developing it must hold ≥18f before demoting (demo 20f, with a very slow 1.5% push-in during it) —
  shrinking before it has settled eats the announcement beat. The eyebrow fades out over 6f as it takes off, and before landing the label prefix "01 /" wipes in from the left to take over
- The content grows with staggered overlap (the demo is video-shotcraft's storyboard workbench page, with the two section titles taken from the brand taglines "Frame." and "Craft.":
  A = a 60px lead-in + three cards (shot recipe card / user review / beat-sync rhythm); B = a 58px storyboard script + an in-sentence selection → connecting line → a side note matching the shot card): each block's crop reveals from the left (width 0.3→1, text not squashed) + rises 30px and fades in,
  staggered dense first then sparse; growth starts when the demotion is 12f in, so the content is already growing while the title is still flying — this overlap is the source of "a handover with no gap".
  Draw the full-width divider line a few frames later; don't let it grow on the same frame along the title's flight path
- Variant B selection highlight: left edge and width are two percentages tweened separately — when sweeping in, width 0→100%
  (covering, 10f); when withdrawing, left edge 0→100% (moving out of the way from the left, 8f); start the demotion only after the highlight has fully withdrawn
- The demotion flight gets directional motion blur according to the position difference (velocity) (0 when still); the variant B selection uses the accent colour at 20% opacity + an insertion caret following the right edge
- No more white flash when the two variants play back to back: they share one stage; A's content ease-in rises out over 12f → B's big title develops in place;
  before B demotes, A's label moves up one line, shrinks to 0.7 and turns grey as "the previous section", and B's label lands in the same slot (the way to use multiple sections in a row without stacking)
  (the demo exports `TITLE_DEMOTE_TO_LABEL_DURATION` = 246f, look = paper)

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Demotion tween | 26f asymmetric in-out, scale→0.22 (lands at ≈48px) | <14f reads as the title being flicked away; an end point >0.45 makes the label too big and crowds the content; a label <40px is unreadable |
| Hold beat | ≥18f of rest after developing | Skip this beat and it runs off before the audience has read the title; the demotion is wasted |
| Content stagger | dense first then sparse, blocks 18–22f, width 0.3→1 | Everything growing at the same time reads as a page refresh rather than "growing" |
| Growth start | +12f after the demotion begins | Waiting until the title has fully landed before growing leaves an 8f dead gap |
| Selection highlight | sweep in 10f / hold 10f / withdraw 8f, accent colour at 20% opacity | A highlight hold <5f reads as a flicker bug; demote before it has fully withdrawn and the colour block flies along, very messy |
| Two-section handover | old content exits rising over 12f; old label moves up one line and turns grey over 16f | If the old label doesn't give way, the new label lands on top of it = a label graveyard |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- Division of labour with the scene-lock approach of "the title nailed into 3D space, deforming with the camera's perspective" (now retired)
  (spatial type); this card is a continuous demotion within the 2D layout hierarchy (layout type) — to have "the title live in
  the product space" use that card, to have "the title become a column name" use this card; pick one per film
- No other element may move along the demotion path — the title's flight is the only focus on the whole screen; the skeleton growth
  sits below its landing point and doesn't compete (with a staggered start), but popups / cursors entering on the same frame will certainly compete
- When used for multiple sections in a row (one demotion per section), the top-left labels must **move to a new line, not stack**: when the new label lands,
  the old label moves up to make room, otherwise from the second section on the top-left corner becomes a label graveyard
- Variant B's selection highlight is a product hint that "the text can be selected"; for products that aren't editors/documents
  it is semantically empty — don't add it just because it looks nice
- Title copy ≤3 words — after demoting to 0.3x it still has to work as a readable label; a long sentence shrunk down is just a grey line

## Reference implementation
demos/typography/title-demote-to-label/
(TitleDemoteToLabel.tsx)
Original source: perplexity-promo 16–18.5s; the variant B variation comes from framer text-selection-title
