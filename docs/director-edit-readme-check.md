# Director + Edit: CineGen README bullets, checked in `#/timeline`

Legend: **DONE** CineGen's own code, exercised in the browser · **SWAPPED** CineGen's code, provider replaced · **KEY** runs, live result needs the user's MuAPI/OpenAI key (checked with a labelled stub at the network boundary) · **N/A** not offered on the web editor.

## Director
| Bullet | Status | Note |
|---|---|---|
| Script paste / upload .txt .md .fountain .fdx | DONE | all four load into scenes (fdx → 2 scenes, others → 3) |
| Clip length 10 / 15 / 20 / 30 s | DONE (fixed) | only 10 s was offered because the MuAPI adapter capped at 10 s; now 4–30 s (Seedance 2.5) |
| Look bible: genre, film references, mood board, Rewrite with LLM | DONE / KEY | UI present; rewrite needs OpenAI key |
| LLM picker Claude / Codex / Gemini CLI | SWAPPED | OpenAI (user key); CLIs are desktop-only |
| Breakdown with @Tags, Elements | DONE / KEY | stub returned 5 items → Breakdown 5; matching/creating Elements is CineGen code |
| Shotlist, isolate-to-hold / native | DONE / KEY | stub returned a 20 s clip with 2 beats → "1A Ledge reunion 20s" |
| Generate | SWAPPED | MuAPI `seedance-2.5-text-to-video`; Element stills (https) → `seedance-2.5-omni-reference`; Topview/Higgsfield/Artlist/RunPod N/A |
| Takes filed in Edit media pool | DONE | Director › Scene 01 › 1A › Full › take |
| Element-aware renders | SWAPPED | via omni-reference (public https stills only) |
| Notes rewrite, Keep/Discard | DONE / KEY | UI present; rewrite needs OpenAI key |
| Higgsfield blocking map | N/A | buttons hidden (no Higgsfield provider) |

## Edit
| Bullet | Status |
|---|---|
| Dual source/timeline viewers | DONE |
| 10 tools | DONE (all present; blade + undo verified) |
| Trim / split / speed 0.1–2× | DONE (we allow 0.1–8×; 0.1/2/8 verified) |
| Volume / opacity / flip | DONE (flip H verified) |
| Opacity / volume keyframes | DONE (Add keyframe UI) |
| Transitions | DONE (picker in inspector) |
| Tracks: add, delete empty, mute, solo, lock | DONE (verified). Drag-reorder of tracks is not in CineGen's code either |
| Source viewer, SAM3 mask, proxy | DONE (mask = on-device) |
| Music | DONE / KEY (request goes to MuAPI Suno) |
| Fill Gap, Extend | KEY (MuAPI) |
| Audio sync / batch sync | DONE (on-device) |
| Multiple timeline tabs | DONE (New Timeline → Timeline 2) |
