# V2 independent review: outcome

Fresh-context subagent, per references/final-review.md. First verdict: NOT ready to publish. Technique was clean (one timeline for both renders, no clipping, SFX offsets consistent,
cuts on the beat, no price/count/"free" text, in-app mark and tokens); the failures were content and honesty. Items and what was done:

| item | finding | action |
|---|---|---|
| F1/P2/omissions | three usable captures (Influencer, Effects, Video Agent) plus Product Shot were left out while the note read as if all omissions were forced; Image "Advanced" panel missing from the list | omission list rewritten with two explicit reasons ("not capturable" vs "capturable but not used, a choice"). NOT fixed by adding shots: the cut is still 53 s. Open: say if you want those beats added |
| P3 | Backlot showed a LIVE badge and simulator timestamps; "Research to publish" while 3 stages are pending | badge/idle status and timestamps hidden at capture; caption now "Eight steps, one board."; 3 pending stages stay visible |
| P3/D5 | Edit grid = the app's pre-composited example images, unlabelled; one card carries "AI Deepfake Technology" | face-swap card dropped; label "BUILT-IN EXAMPLE IMAGES" (36px) on screen; 9 cards left. Provenance of the face images still unrecorded |
| F3 | "Tune the settings." and "Direct the camera." showed no working control | Video Studio: third click opens the REAL Advanced Options panel (capture); Cinema: the REAL Prompt Builder (Camera/Lens fields) opens after the tilt; caption "Pick the camera and lens." Image shot still shows only the aspect-ratio menu: the "adapts to the model" claim is supported in code but not demonstrated on screen |
| Q11 | hub card text ~22px, picker ~20px, aspect labels ~24px, Backlot rail ~20-24px | hub cards 520 -> 760px wide; picker framing 1.6x -> 2.2x and held ~1.3 s; aspect menu zoom 2.12 -> 2.3 (labels ~28px, still under 32px); Backlot zoom 1.5 -> 1.9 (labels ~30px). Edit/quad/template card art remains texture |
| S5/B3/C1 | quad: AI VFX cell short, capture fragments, no rest, no caption | crops limited to the banner area, AI VFX cell right-anchored, outline pulses end at f56+6, push stops at 62 (27 f true still), caption "People, voices, motion." |
| S5 | Backlot hold cropped / caption on the script card; Edit title overlapping cards | Backlot travel ends earlier (CX1 1090); Edit title moved top-left, label under it |
| A6 | click/transition-snap near or below BGM level | click-camera 0.5 -> 0.8, transition-snap 0.7 -> 1.0; peaks -0.8 dB (music) / -1.9 dB (no music); audibility is measured, not heard |
| A10 | CREDITS.md was V1-only | V2 SFX added (click-camera, swoosh-quick, transition-snap) with hashes. keyboard/riser/sparkle/whoosh-big still untraceable |

Notes: the two renders are bit-identical in video except the carousel (frames 1348-1416, >= 46 dB PSNR, GPU noise in the 3D ring); this varies run to run.
Not re-reviewed by a second subagent after these fixes; checked by stills, the final keyframe sheets and the sync/level measurements.
Residual: dim card text "Video generation takes 1-3 minutes" is visible (app tutorial copy, ~17px, dimmed) in the Video Studio tour; Gallery reference mp4s unavailable; nothing auditioned.
