# V1 independent review: outcome

Fresh-context subagent, per references/final-review.md. First verdict: NOT ready (5 must-fix, several should-fix). Items and what was done:

| item | finding (frame evidence from the reviewer) | action |
|---|---|---|
| P3 | clip card after the typed prompt reads as that prompt's result (f300-f440) | label changed to "EXAMPLE FROM THE GALLERY" (36px); clip slowed to 0.85x; prompt text left as is. Residual: it still sits right after a typed prompt; see "open" below |
| Q11 | SAMPLE tag 24px | now 36px |
| D5 | rights of john10.mp4 and app stock thumbnails unverified | NOT fixable here; open |
| A2 | sparkle pinned to f727, tagline appears f750-756 | re-pinned to lockup+100 (peak f~749-751); table re-verified |
| A5/A6 | keyboard overran typing by ~21f; keyboard, whoosh-fast, sparkle quiet vs BGM | keyboard window 86f, volumes raised (keyboard 1.0, whoosh-fast 0.9, sparkle 0.9), BGM 0.34 to 0.30, render peaks -0.7 dB (music) / -1.4 dB (no music); masking judged by RMS only, not auditioned |
| overclaim | "Every studio" with 6 cells | "Your studios, one place." |
| S4 | WORD_W 118 vs measured 128, lockup 21px off centre | 128 |
| S5 | stray UI fragments in wall cells | cells crop banner art only |
| D4 | dim page text "takes 1-3 minutes" visible f243-258 | dim now starts at local 112 (was 118) and finishes by 132 |

Not re-reviewed by a second subagent after these fixes; fixes were checked by stills (out/qa/v4-*, sheet4.png) and by the sync/level measurements above.
Open: D5 rights, P3 residual (consider swapping the clip for one the user owns), nothing auditioned by a person, Gallery reference mp4s unavailable so card-vs-reference comparison unverified, "OPEN SOURCE" thumbnail text patch not checked on every intermediate frame.
