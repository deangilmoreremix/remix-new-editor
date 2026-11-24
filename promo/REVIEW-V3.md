# V3 independent review: outcome

Fresh-context subagent, per references/final-review.md. First verdict: do NOT ship Localize or Produce; Automate not as is; Create, Enhance, Scale shippable after layout/audio fixes; set not ready as six.

| clip / item | finding | action |
|---|---|---|
| Produce | showed Backlot (local tool, not in the card's app list), cream paper + mono type outside the app tokens, script card clipped, counts ("0:21", "4 sections") | replaced with the five real hub cards for Storyboard, Director, Timeline Editor, Video Tools, Audio (on-brand, no Backlot) |
| Localize | idle Lip Sync form, no localization, unreadable 9-18px page text, ~4.5 s near-static | replaced by a 4-pane quad of real studios (Lip Sync, Avatar, Video Tools, Audio) with names + the app's own descriptions (>= 32px). STILL does not show localization (no dubbing/language capture exists): flagged, see below |
| Automate | title only at f150, overlap with "View Code examples", prompt shrinks to ~10px at the end, snap mis-pinned, third-party model label visible | title at f14, no pull-back (ends zoomed on the readable prompt), model dropdown blurred, snap pinned to typing complete (f146) |
| Create | description ~8px from the top cells; dark strip under wide cells | wall lowered 74px, banner crop tightened (y 82, h 258) |
| Scale | chip over the clapperboard card, description crossing the board edge | board shifted right 170px |
| audio | SFX only 0-7 dB above BGM; Create/Enhance first cue clamped to f0 (~2.9 f late) | BGM 0.30 -> 0.22; first cues use swoosh-quick (no clamp); gains set so peaks <= -1.7 dB (music) / -3.2 dB (no music); NOT heard by a person |
| dead time | 2-4.5 s near-static in four clips | clips shortened 207 -> 192 f (6.4 s); remaining holds noted |
| loop | frame 0 dark, last frame lit, music fades | documented: use poster + play-once, or add a fade on the page |
| pairs | Scale pair differed by GPU noise | after re-render all six pairs have bit-identical video (framemd5) |
| not changed | image/face provenance, 4 untraceable SFX (keyboard, riser, sparkle, whoosh-big), Gallery reference mp4s unavailable, the stale text "15 second" in the typed prompt | listed as open |

Not re-reviewed by a second subagent after these fixes; checked by stills, a full sync/level measurement of all twelve renders and frame hashes.
Open decision: Localize cannot honestly demonstrate localization. Options: ship it as the card's video anyway (shows related studios), use only its poster, or leave that card without a video until dubbing/language captures exist.
