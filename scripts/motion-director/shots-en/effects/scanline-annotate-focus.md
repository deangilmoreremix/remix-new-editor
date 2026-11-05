---
name: scanline-annotate-focus
one_liner: A scanline sweeps at constant speed from top to bottom over an existing page; whichever block's bottom edge it passes, that block is aimed at by a four-corner viewfinder springing in from an expanded position (one overshoot), then a machine label typed out character by character is attached, while the top status line counts 00/06→06/06 in sync
use_when: Analysis shots of "AI is reading your page/brand"; breakdown introductions of design systems/brand guidelines; self-explanatory sections on product capabilities
length: about 5s (150f@30fps)
energy: medium (mechanically calm, the rhythm pushed by the constant-speed scanline, annotations as the beat points)
---

## Intent
Make the abstract act of "analysis" into a visible causal chain: wherever the scanline reaches, that block gets framed and
named. What the viewer reads is "the machine's line of sight", so the scanline must move at constant speed and the annotations must lag strictly behind
the scanline's passing: **scanned first, then the frame snaps**; once the order is muddled it becomes a pre-choreographed animation.

## Motion core
- Two colour sets with a strict division of labour: the **brand colour** (demo terracotta `#C4552D`) only in the page content, the **machine colour** (cobalt `#2B4FD8`)
  only for the scanline / corner marks / labels / status line: the viewer can tell at a glance "the page itself" from "the machine's line of sight"
- The page (demo is the video-shotcraft website: Frame Chisel logo mark + wordmark, H1, sample film cover, CTA, colour swatches) sits in a 1560×840 browser window (two layers of soft shadow), with the status line above outside the window; throughout, a very slow push-in 1.000→1.035
- Scanline 6→80f at **strictly constant speed** travels in-window y −20→860: 3px light core + a 140px fading pale-blue wash and 18px dot-grid afterglow behind it;
  on each side of the window frame a triangular cursor sliding with the line, the left one reading out the current `Y 0412`
- Trigger frames are back-calculated from bbox: `ft = frameAtY(y + h)` (the frame on which the scanline passes the bbox's **bottom edge**), sorted by bottom edge and clamped
  to a minimum interval of 4f; demo measured LOGO 19f · NAV 23f · H1 48f · CTA 68f · HERO 72f · PALETTE 77f
- Viewfinder: four L corners (3.5px round caps) close in from 76px expanded outward to the bbox with `spring(damping 15, stiffness 210)`
  (one visible overshoot, slightly inside the bbox then back); arm length 40→26px closing a notch 3f later (follow-through); `ft+3→+6` a cobalt focus flash inside the frame
  (fill 0.075 + 2px inner stroke), falling off at `+6→+18`
- Label appears at `ft+5`: a design-tool-style small tag, white text on cobalt (height 50, 32px monospace, category weight 750 bright / detail 500 · 78% white),
  text typed out character by character at ~2.2 characters/frame, the tag's width growing with the text (right edge slightly leading) + a white block cursor, floating up 8px→0
- The status line counts triggered blocks live `SIGNALS 0n / 06` + a scan progress bar; 8f after the last block triggers it switches to `BRAND READ` (turning machine colour),
  and the ~60f hold after that is a complete poster

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Scanline | 74f constant speed, in-window y −20→860 | **Zero easing**: add ease and it reads as "someone dragging a progress bar"; below 60f the labels don't have time to finish typing and pile up |
| Trigger conversion | ft = SCAN0 + (y+h−Y0)/(Y1−Y0)·(SCAN1−SCAN0) | To change the scan window change only the four constants SCAN0/SCAN1/Y0/Y1, and triggers follow automatically |
| Minimum interval | prev + 4f | LOGO / NAV on the same row would pop on the same frame; only after clamping can they be read one by one |
| Viewfinder closing | Expanded 76px → 0, spring damping 15 | Expand by pixels rather than scale proportionally: targets big and small close by the same amount; expanded <40px and you can't see the "aiming" action |
| Corner marks | Arm length 40→26px, stroke 3.5px | Arm length over 1/3 of the target's short side becomes a full border, losing the "viewfinder" semantics |
| Focus flash | Fill peak 0.075 | Above 0.12 it becomes a grey box on a light base, reading as "selection highlight" rather than focus confirmation |
| Label | From ft+5, ~2.2 characters/frame, 32px monospace | The 5f lag is the causality of "naming only once the frame is steady"; drawing the tag at full width at once and then typing exposes an empty blue bar |
| Count line | Counted live from fired, 30px monospace | A count hard-coded to the timeline stops matching as soon as a bbox changes; it must count live |

## Known pitfalls
- **The scanline trigger moments are tightly bound to the target bboxes**: after changing page content the targets' `x/y/w/h` must be re-measured;
  bboxes are measured by hand (not measured automatically from elements), with about 12–16px margin
- Label placement is one of four (`right / above / below / belowRight`), width estimated by monospace character count `CHAR_W = 0.6em`;
  when a word gets longer first check whether it presses on an adjacent module or pokes out of the window: for wide targets like H1 put the label above, for top-right targets right-align the label below
- On light-field pages the scanline and corner marks need a dark, saturated machine colour; a pale glow line is nearly invisible on a light base
- Division of labour with `scanline-assemble-flyin`: that card is "scanned means assembled" (the page goes from empty to present),
  this card is "scanned means annotated" (the page already exists, only analysis is done)

## Reference implementation
demos/effects/scanline-annotate-focus/
(ScanlineAnnotateFocus.tsx)
