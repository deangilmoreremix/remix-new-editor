---
name: paper-title-card
one_liner: A sentence is pressed onto paper word by word, one word marked in the accent colour and italics, closed off by a short dash
use_when: Chapter transitions / value-proposition title cards; a lead-in card before an important feature appears; a breathing spot in the film
length: 1.7–1.8s (50–55f)
energy: low (a breathing spot that separates two high-energy shots)
tags: transition, rhythm
---

## Intent
Between two stretches of product footage, give the audience one sentence of breathing room: say clearly "what's coming next and what it's worth". The letterpress texture puts the title card in the same world as the paper-and-ink styled product footage.

## Motion core
- The single sentence of copy enters word by word: scale pressed down from large to 1 + blur→0 + opacity (the letterpress recipe); the demo copy is the video-shotcraft slogan
  "Direct the film. / Let the agent shoot it." (emphasis word *shoot*); the word list can be marked with `br` to force a line break; the two lines are close in length, with no orphan word
- Each sentence has exactly one key word: italic + accent colour (amber in the template film)
- An accent-coloured short underline scaleX 0→1 closes it off
- At the end the whole card fades out to hand over; can carry a small mono subline + DigitRoll numbers

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Word-by-word entrance | word i delay = 4 + i·4, 9f, bezier(0.2,0.75,0.3,1); scale 1.28→1 + blur 7px→0 + opacity | A scale start of 1.28 is the sweet spot for the "pressed" read — compare the dark-field TitleCard, which uses a 40px rise + blur 10; same recipe, light and dark versions |
| Key word | italic + accent colour oklch(52% 0.115 65), exactly one accent per sentence | Two accents equal no accent; choose a feature name / benefit word as the key word (C2) |
| Underline | scaleX 0→1 over 16→34f, 220×6px accent colour | The underline is the closing signal; its appearance announces that this card is about to end |
| Length | All 4 title cards in the film are 50–55f (≈1.8s) | Title card length is standardised — the time it takes the audience to read one sentence; longer drags the pace, shorter can't be read through |
| Layout | Font size 116/serif; paper background oklch(97.5% 0.008 82) + central warm-light radial; 8f fade-out at the end | Paper background + warm light in the same colour family as the product footage, so the title card doesn't feel like an ad break |
| Subline | small mono text + DigitRoll (demo "12 shots rendered today"); for digit-roll parameters see the counter row of the list-stack-press card | A specific number in the subline is most convincing; the number roll must settle before this card fades out (lesson learned) — schedule the beats by working backwards from this card's fade-out frame |

## Sound
Title card entrances are uniformly pinned to swoosh-quick (the four title cards in the template film are pinned at f220/565/725/885 with the same sound) — same sound for the same kind of element is vocabulary discipline (S2); the title card itself has no landing accent, leaving the energy to the shots before and after.

## Known pitfalls
- Copy must be specific: include the product feature name + a specific benefit; abstract metaphor words got rewritten word for word by the user (C2 — "one board"→"one place to go", adding "Paper Radar"); rewrite the copy once against the final shots after the picture is locked (C1)
- An important feature should have a lead-in title card before it appears (C2 ruling: before the document shot, add a lead-in line such as "Every project, linked to your weekly report") — title cards aren't decoration, they are chapter signposts

## Reference implementation
demos/typography/paper-title-card/PaperTitleCard.tsx (originally template/src/aifl/PaperTitleCard.tsx, parameterised: words/sub/subDigits can swap the copy)
