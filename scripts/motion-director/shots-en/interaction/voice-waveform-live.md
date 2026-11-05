---
name: voice-waveform-live
one_liner: Live voiceprint in a recording pill: 64 thin vertical bars rise and fall with "speaking", towering in the middle while talking and shrinking to a dotted line during pauses, the waveform scrolling from right to left; a complete performance of speak → pause → speak → submit and collapse
use_when: Feature shots of voice input/an AI assistant "listening to you"; segments with no UI content to show but needing sustained liveliness to carry the frame
length: 172f (~5.7s: entrance 14f + speak 1.4s + pause 0.8s + speak 1.4s + submit collapse / tuck into bubble 0.8s + hold 0.7s)
energy: medium (functional liveliness, not showing off)
---

## Intent
This card is a **functional** voiceprint: a live receipt that "it's listening to you". The make-or-break point is causality:
the waveform jumps with "the user speaking" and is the product feature itself, not decorative packaging jumping to the BGM.
While speaking the waveform towers, during pauses it shrinks to a row of dotted line, and history scrolls off to the left: from the waveform's rise and fall the viewer reads "it's really listening", and a 6s+ stretch of footage is carried entirely by this
liveliness, with no other content needed. Division of labour with gauge-readout-moves: a gauge is
the mechanical ceremony of "reporting a value", this card is the vital sign of "continuous listening", with no final value.

## Motion core
- **Frame-deterministic pseudo-randomness is the make-or-break point**: mulberry32 takes values at integer sample points + smoothstep
  interpolation between neighbours (value noise), no Math.random: renders are reproducible and adjacent frames are continuous
- Sense of scrolling: bar i's sample time = f - (N-1-i)·1.6, the rightmost bar is "now",
  and history flows left; it's not the bars translating, each bar is reading the signal at a different moment
- Bar height = speech envelope (trapezoid seg with two levels, speak/pause + syllable noise 0.55+0.45·noise)
  × central spatial weight sin^0.8 × per-bar jitter (0.35+0.65·noise);
  silence is clamped to a 6px dotted line
- Submit: the button compresses over 3f scale 1→0.82→1 with rebound, the waveform collapses over 12f ease-in
  to 0.06, and the microphone's breathing ring expands outward with the envelope
- The demo adds a layer of live transcription (92px bold): each word rises from faint to solid at the syllable onset of its beat; just-spoken words are in the accent colour,
  sinking to ink a few frames later; during pauses a trailing cursor blinks; on submit the whole transcription moves up, shrinks and tucks into an accent-colour message bubble:
  the "pause" can be read from both the text and the waveform at once, and the final frame is a complete conversation poster

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Bar count/gap | 64 bars, gap 5px (1240px-wide pill, voiceprint area ≈820px) | Fewer than 40 bars reads as an equaliser; denser than 90 and individual bars don't read as rising and falling |
| Scroll rate | 1.6 frames/sample point | Faster and history refreshes too quickly like a glitch; slower and the "scrolling" feel disappears, becoming jitter in place |
| Speak/pause envelope | seg trapezoid rise 5f / fall 7f; demo speaks 15–57f, pauses 80–124f | The pause segment must really collapse into a dotted line: without the contrast of "pausing", "speaking" doesn't hold |
| Syllable noise | 0.55+0.45·noiseAt(t/4.5) | Remove the syllable layer and the waveform is a smooth hill; the cadence of "a sentence" can't be read |
| Central weight | sin^0.8 spatial envelope | Without weighting, uniform height across the field looks like an equaliser; exponent >1.5 and the middle stands alone like a single jumping bar |
| Silence clamp | max 6px dotted line (dotted line in a weak neutral colour, speaking bars in an accent-colour gradient) | Clamp to 0 and the waveform disappears, reading as disconnected; the dotted line is "listening but you're not speaking" |
| Submit collapse | 12f ease-in to 0.06 + button compress rebound 3f | The collapse is "this utterance has been taken away"; a fade-out can't convey the meaning of submitting |
| Transcription rhythm | Word appearance frame = that word's syllable onset (within the envelope's rise segment), 8f from faint to solid | Words appearing before the waveform read as subtitles ahead of the sound; 10f+ late reads as delayed recognition |
| Tuck into bubble | 22f EASE.swift move up + shrink to 0.72, bubble base / white text following within 10f | Only fading out the transcription can't convey "it's been sent" |

## Known pitfalls
- Tuned on the warm bright field of video-shotcraft voice-dictated storyboarding ("Shotcraft is listening") in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- **When there's a voice track, the waveform must follow the voice**: if the film has real narration/voice, the envelope's speak/pause segments must align with the track's speak/pause; a one-second misalignment gives the game away; a pure synthesised envelope is only usable in films with music and no voice
- The demo is a bright-field warm-white solid pill (1.5px inner highlight on top + two-layer landing shadow); for dark-field films just switch to a glass pill with a 1.5px gradient edge, and the voiceprint parameters stay the same
- The microphone is already an SVG line icon (the early emoji + grayscale placeholder has been replaced); in real use just replace it from the brand icon library
- Sound: this card's image is "the shape of the sound", so pairing it with a voice works best; one light pop for the submit button + a short downward glide for the collapse

## Reference implementation
demos/interaction/voice-waveform-live/
(VoiceWaveformLive.tsx)
Source footage: raycast-teams 19.5–26.0s
