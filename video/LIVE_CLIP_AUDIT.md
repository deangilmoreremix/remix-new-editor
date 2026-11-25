# Audit of the landing clips already on develop (PR #232)

Source: `origin/develop:public/landing-videos/` (14 MP4s + posters, 370 frames at 2 fps + posters, Tesseract OCR, checked against the claims rule: no model count, price, "free" or "open source" until confirmed).

## Violations found
| Where | What is on screen | Time |
|---|---|---|
| `c06-director.mp4` + poster | "AI agentic editor with 48 agents, backed by VideoDB and FFmpeg", "AI Agentic Editor • 48 Agents", and "48 production-ready agents" in the chat greeting | whole clip (0-6.9s) and poster |
| `b-feature-reel.mp4` | same Director "48 agents" text | about 12.5-16.0s |
| `a-hero-loop.mp4` (+ webm) | example-gallery thumbnail reading "...13 IS OPEN SOUR(CE)" | start of clip (detected at t=0; tile sits at bottom edge) |
| `c01-hero-prompt.mp4` | same "IS OPEN SOUR(CE)" thumbnail | start of clip |
| `c03-model-picker.mp4` | same "IS OPEN SOUR(CE)" thumbnail | start of clip |

## Clean
`c02`, `c04`, `c05`, `c07`-`c12`, `d-social-9x16`, and all posters other than c06: no counts, prices, "free", "lifetime" or "open source" found. (OCR hits for "4 Effects Studio" are false positives from the page title.)

## Limits
OCR at 2 fps can miss small or briefly visible text, so a clean result is "none found", not proof. Live banner subtitles ("15+ models", "20+ AI models", "200+ effects") did not show up, which suggests they were already cropped or masked.

## Options to fix
- Replace `c01`, `c03`, `a-hero-loop`, `b-feature-reel` with the masked equivalents from `video/out` (same aspect, OCR-clean), and `c06-director` with `c05-cinema-director` (masked). Visual style and copy differ from the live set.
- Or re-render the five affected files from their original project (not in this repo) with masks.
