---
name: type-rhythm-sync
one_liner: Two variants of text synced to sound — font-weight-pump weight pulse (strokes thicken on the drum hit and spring back) and karaoke-fill-sync karaoke fill (words light up one by one with the narration)
use_when: Passages where a title/slogan is tightly bound to the audio track; A binds to the beat (drum hits), B binds to speech (narration word by word)
length: A FontWeightPump 165f / B KaraokeFillSync 150f; A 128 BPM, 14f per beat, decay window 9–13f; B 18–33f per word depending on speech rate
energy: A high (clubbing feel) / B medium (read-along guidance)
tags: rhythm
---

## Intent
Until now the text motion library was all about "how to enter"; nothing covered "how text already on screen comes alive with the sound".
These two variants fill that gap: A turns the title into a rhythm organ — strokes twitch thicker with the bass drum and spring back,
the text is clubbing, suited to being the visual subwoofer of a high-energy passage; B turns the slogan into read-along captions —
whichever word the narration reaches fills and lights up from left to right, leading the eye along, suited to voiceover/
slogan emphasis passages. What they share is **the characters don't move, the properties do**: no displacement, no entrance or exit,
purely the weight/colour breathing on the beats of the sound.

## Variants (choose one of two)
| Variant | Approach | Use when |
|----|------|------|
| A font-weight-pump weight pulse | On the hit frame the light-weight text instantly swells to black weight (continuous variable-weight interpolation), decaying and springing back over 9–13f; accent beats additionally widen by 6%; in bar 2, stroked echo lines grow above and below and follow the beat; on the drop beat it settles into a bold gradient poster | Music-driven high-energy passages; the title as a subwoofer |
| B karaoke-fill-sync read-along fill | Two lines of slogan on a light background (demo "FRAME MOTION / CRAFT SHOTS"); each word fills and lights up from left to right with a soft edge, progress following the speech rate; the word being read fills with the accent colour, and once read it reverts to the primary ink colour and stays; the active word has a read-pointer underline | Narration/voiceover emphasis passages; eye guidance for multi-word slogans |

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| A pulse envelope | `env=(1−t/D)^0.8` (t = frames since the hit; the demo staggers the spring-back per character from centre 9f → edges 13f, returning exactly to 0 at ≥D); fontWeight `250+650·env` continuous interpolation (SF Pro variable weight); each character is pinned in a slot laid out at **weight 900** — at rest the light characters leave gaps between them, on the hit the strokes fill the slots and "close up", and the whole line doesn't reflow; without a variable font, fall back to a 300↔900 jump within an env>0.15 window + a continuously decaying `-webkit-text-stroke` to fill in the transition | Laying out the slots at the heaviest weight is key: laid out at a regular weight, the characters squeeze into and overlap each other at the peak |
| A beat | 128 BPM, one beat every 14f (16/30/…/114) + a drop on beat 9 (128f); beat 1 of each bar is an accent with `scaleX = 1+0.06·env` and tinted pink; on the drop it surges to 900 and doesn't go back to light, falling back over ~16f to freeze at weight 780 + a purple→pink per-character gradient + a horizontal light band | The beat spacing must be > the longest decay window (14>13); two overlapping beats read as twitching |
| A echo lines | from bar 2, one line of the same text with a 2px stroke above and one below, pulsing to the beat 2f late, pushed apart 26px on each beat (pushed apart 60px on the drop, then returning) | Progression comes from "adding layers", not from increasing amplitude; put the echoes on in bar 1 and you have no cards left to play |
| A beat reference | an 8+1 cell step sequencer at the bottom of the frame (two bars + a DROP cell); whichever beat hits, that cell lights up and enlarges 12%, and cells already passed stay dimly lit | In a silent environment (preview/still frame), without this row of cells you can't tell it's "following the beat"; only the cells and the text move, no whole-frame per-beat pumping |
| B word-level timetable | per-word [start,end] frame ranges, linear fill within a word; 4–10f pauses between words (breaths) | In real use the timestamps come from the narration marker sheet; even distribution reads as machine reading |
| B word-level timetable (demo) | FRAME 20–38, MOTION 42–75 (long word read slowly), CRAFT 85–103, SHOTS 107–130; 0–19f lead-in, 130–149f truly still | Give longer words a longer read window and it reads as a real human speech rate |
| B fill implementation | each word is two stacked layers of the same text: bottom layer light grey (ink at 13% opacity) + top layer revealed by progress: `mask-image: linear-gradient(90deg, #000 e−4%, transparent e+4%)`, e=p·108−4 (±4% soft leading edge; for a hard cut use `clipPath: inset(0 (1−p)·100% 0 0)`); the word being read fills with the accent colour, and reverts to the primary ink colour 10f after it's read | Independent stacked layers per word avoid having to measure each word's share of the width; a single-layer clip of the whole line needs a precise pixel table and drifts easily |
| B read pointer | an 8px rounded underline under the active word (the demo uses the accent colour), width = p·100%; once read, it retracts from left to right over 6f | 4px light grey is invisible at 1080p thumbnail size (a pitfall hit in this batch's real renders); words already read keep no line |
| B narration reference | a narration waveform of 48 vertical bars below the slogan: rising and falling where words are read, dropping at breaths, the played part tinted with the accent colour | In a silent preview/still frame, without this waveform you can't tell it's "reading along" |
| Ending | A after the last beat's decay returns to zero / B after the last word is filled, truly still ≥20f | R1 breathing ruling |

## Known pitfalls
- Tuned on placeholder material in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use.
- Both variants are techniques with **strong sound dependence**: A's hit frames must be on the same frame as the drum hits, B's fill ranges must
  follow the narration word boundaries (frame pinning follows the relative start point in sound-design §4.5) — released without sound, A reads as
  spasms and B as inexplicable colour changes; don't use them in passages without an audio track
- Variant A relies on a system variable font (macOS SF Pro) for continuous wght interpolation; with a different font or on a render machine without variable fonts
  it degrades into a few discrete jumps — first confirm font loading and renderer support, and if not, use the stroke + jump fallback
- Variant A ≤1 passage per film (P4) — a clubbing title is a major scene-stealer, and two passages in the same film undercut each other
- Variant B ≤6 words per screen: with more words the fill progress can't be followed; split the lines or split the shot

## Reference implementation
demos/typography/type-rhythm-sync/
(FontWeightPump.tsx / KaraokeFillSync.tsx)
