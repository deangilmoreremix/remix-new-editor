---
name: slam-entrance-moves
one_liner: Three high-energy slam-in styles: kanada-perspective-snap Kanada perspective hard stop, score-slam score slam-down, impact-burst-kit landing impact kit (affecting neighbouring cards)
use_when: Heavy-punch entrances for hero cards/KPI cards; impact-feedback handles the feedback after landing, this card handles an entrance that is itself the impact
energy: high
length: single-style action segment 6–22f + impact aftermath ~16f + hold ≥45f (demo: A 120f / B 135f / C 140f)
tags: ui-entrance
---

## Intent
The force ceiling of the library's entrance vocabulary has always been deck-deal-flyin's "dealing cards": fast but not heavy.
This card adds the "slam" tier, in three flavours: A is directionality: the card whips in right past
the lens with fisheye-level exaggerated perspective and "snaps" flat, the flair of the anime Kanada school; B is weight: the KPI card slams down from
2.6× size in front of the lens, with the ring + dust specks + screen shake trio detonating on the same frame, the heft of a sports score pop-up;
C is transmission: on top of B's trio, as the shockwave front sweeps past the left and right neighbouring cards it visibly pushes
them away and they bounce back, "this hit shook the neighbours", conveying the size of the force in one move.
Choose by narrative need: to tell the viewer "it's here" use A, "it's heavy" use B, "it shook the whole room" use C.

## Variants
| Style | Approach | Use when |
|----|------|------|
| A kanada-perspective-snap | perspective 260→1800px + rotate3d 62°→0 + scale 1.8→1 whipping in over 18f (pose converging later than displacement), final 5f overshoot +6° spring-snapping flat + speed lines, the long slanted shadow straightening | A single card's flashy debut; tone leaning anime/brisk |
| B score-slam | The card slams down from scale 2.6/rotate 5° in front of the lens over six frames with ease-in(quad); on the landing frame impact ring + shard sparks + screen shake + white flash on the same frame, the score numbers landing a second time 3/6f later | Debuts of heavyweight KPI/score-type numbers |
| C impact-burst-kit | The main card slams from in front of the lens into an empty slot on the page + B's trio + the frame on which the shockwave front sweeps past each neighbouring card precisely computed from radius vs distance, neighbouring cards pushed out 34px + rotate ±3.5° with damped bounce back | "The whole room shaking" when the page already has neighbours |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A whip-in | 18f: translateX −1350→0 via EASE.snappy (hard stop), perspective/twist/scale via the late-converging curve bezier(.62,0,.3,1) over 16f: the card "twists" as it rushes into place and only flattens in the last few frames; horizontal SpeedBlur by x speed (0.2×speed, ≤26px) + 7 speed lines behind it | Faster than 12f and the fisheye distortion can't be read, slower than 24f and it loses steam; with pose and displacement on the same curve converging together, it's already flat a few frames before arriving and the fisheye feel survives only the first frame |
| A landing | rotateY rushes to +6° at 15–20f, from 20f spring(damping 16) back to 0 + 8px screen shake 2f + 48 speed lines dispersing outward over 9f + slanted long shadow straightening; text inside the card settles 3f later (film title −10° skew straightening) | The "snap" is in the overshoot bounce-back, not at the end of the displacement; speed lines over 10f read as an effects sticker |
| B slam-down | 0–9f hanging in front of the lens (2.75→2.6, 10px defocus, semi-transparent so the background shows) → 9–15f ease-in(quad) slamming to 0.965 → spring(damping 14) back to 1 | An ease-out landing is "putting it down", only ease-in is "slamming" |
| B trio | Impact ring diameter 120→1500px/16f (white core 9→1.5px + gold soft glow) + 14 polygonal glass/gold-leaf shards flying 280–580px (+16 sparks) + screen shake 18px exponential decay 5f (biased vertical) + 2f white flash | The original spec (720px/10px dust/8px shake) was imperceptible across the board; real renders already ×1.5–2; solid black thick rings/black square dust read as "stickers" |
| B decoupling make-or-break point | Ring/dust "spread" uses out-cubic, "dissipation" uses linear frame time | Using out-cubic for both, the front runs too fast and it fades out just as it spreads |
| C ripple frame | Inverse-solved from the front's distance to each neighbouring card's centre (ring radius 100→1100/16f, 514px distance ≈ 3f after landing); envelope cos(t/2)·e^(−t/8), hard-clamped to 0 at 40f; horizontal trail by speed at the instant of being pushed | Neighbouring cards moving on the same frame as the main card read as the whole layout shaking; only 3f later is it "being affected" |
| C hover wind-up | 0–16f the main card hovers above the empty slot: lifting 20px, scale 1.55→1.6 (smooth), the contact shadow in the slot firming with height, then 16–22f ease-in(cubic) slams into the slot | A dead stop during the hover reads as "stuck"; a wind-up amplitude over 30px becomes a separate action |
| Depth of field | For B/C when close to the lens (large scale) apply defocus by height (B ≤10px, C ≤7px), sharp on landing | Sharp elements near the lens fail to read as "slamming down from in front of the lens" |
| Ending | True stillness ≥45f after all aftermath returns to zero | Give a heavy punch's hold twice the usual (same as the beat-cut A ruling) |

## Known pitfalls
- The demo is tuned with video-shotcraft promo content (A launch film premiere card / B "Shotcraft vs Keyframes" final score / C Launch film card on the finished-film spec page): the parameters are a starting point, not final;
  re-check with real material on first real use
- On a light field (C) the impact ring needs a white pressure disc underneath, with the ring itself in a saturated accent colour; on dark fields (A/B) use a white core + coloured glow;
  a white ring on a light base / a black ring on a dark base are both nearly invisible
- All three styles carry screen shake; the screen-shake family (impact-feedback) can have only one shake source
  per shot; among the three styles, also pick only one per shot
- Heavily sound-dependent: A's "snap" and B/C's sonic boom must be nailed on the same frame (sound-design §4.5);
  in a silent version, B/C's trio reads as "the card twitching"
- Style C's neighbouring cards must be settled on screen for ≥15f before being affected: if neighbouring cards are pushed away while still entering themselves,
  the causal chain can't be read
- ≤2 slam-ins per film; three or more, each one loud, is the same as none being loud (P4)

## Reference implementation
demos/effects/slam-entrance-moves/
(ImpactBurstKit.tsx / KanadaPerspectiveSnap.tsx / ScoreSlam.tsx)
