---
name: blur-slide
one_liner: The title enters word by word, with y 0.38em→0 + blur 18→0 + opacity 0→1 — three channels converging in sync on one shared ease-out, about 4f between words; the subtitle follows in staggered overlap before the title has finished settling
use_when: Almost any place a title/subtitle appear as a pair; product-page hero copy, section subheads; whenever you need a default text reveal that is "professional but doesn't steal the scene"
length: about 4.0s (120f@30fps)
energy: low (a single convergence, no peak, no loop)
---

## Intent
This is the **default answer** for text reveals — no spectacle, nothing mechanical, it just places
the words one by one, softly. All of its professionalism comes from one thing: the y, blur and opacity channels share
the same progress `p` and the same easing, so a word "rises out of defocus" rather than "slides in
and fades a bit on the way". When a film already has another heavy technique (scramble / roller), the title should
use this card and give way to the hero.

## Motion core
- Per-word progress `p = ramp(frame, start, dur, EASE.out)` (quint-out class); all three channels bind to the same p:
  `opacity = p`, `translateY = (1-p)·dy`, `blur = (1-p)·B`px (in the demo the hero word's tracking tightening also hangs on the same p)
- Main title (170px serif, two lines): line one, 3 words starting at 10f, 4f between words, 22f per word; line two first pauses 6f for a breath,
  "feel" at 26f, the hero word "cinematic." starts at 30f with a 30f entrance window (lands last); `dy = 64`px, `B = 18`px
- Subtitle (46px sans-serif, 9 words): starts at 34f, 2.4f between words, 20f per word, `dy = 26`px, `B = 9`px
  — tighter spacing, smaller travel: **the hierarchy difference comes from amplitude, not duration**
- Staggered overlap, not queueing: the subtitle starts at 34f while the title only finishes at 60f, so the two overlap by 26f —
  queueing reads as two beats; overlap reads as one sentence
- Split by word, not by character: after `text.split(' ')` each word gets one span, and `line` uses `gap:0.32em`
  for word spacing (not spaces) — per-character entrance is too fragmented; word level is what gives the feel of "being spoken"
- Demo layout: paper look (warm-white paper + ink + vermilion), a magazine masthead (video-shotcraft wordmark) / footer hairlines framing a page, vermilion all-caps eyebrow →
  170px serif main title (hero word italic vermilion) → 46px sans-serif subtitle, left-aligned on a 168px grid; in the background a 5%-ink
  760px issue number drifts slowly in the opposite direction for parallax; the text layer pushes in extremely slowly 1→1.03 (smooth) throughout, and the footer hairline starts drawing at 72f to close out the hold section

## Parameters
| Parameter | Typical value | Tuning feel |
|------|--------|----------|
| Word stagger | main 4f / sub 2.4f | 3–4f is the sweet spot for "word by word"; <2f the whole line enters together with no stagger, >8f viewers start counting the words one by one |
| Per-word entrance window | main 22f (hero word 30f) / sub 20f, `EASE.out` | <10f reads as a hard pop; >30f every word floats up slowly and the whole sentence drags |
| y travel | main 64px (≈0.38em) / sub 26px | Unequal main/sub amplitude is the source of hierarchy; <0.15em travel is imperceptible, >0.6em the words fly in from off-frame and become a slide-in |
| blur channel | main `(1-p)·18`px / sub `(1-p)·9`px | This channel *is* the "professional feel"; delete it and it degrades into an ordinary fade-up; beyond ~12% of the font size the in-between frames smear into blobs of colour |
| Main/sub staggered overlap | main 10f–60f / sub 34f–80f | ~26f overlap is "one sentence"; push the subtitle start to after the main title finishes and it reads as two beats |
| Size and weight | 170px serif 400 vs 46px sans-serif 400 | Needs more than a 2× difference to read as main/sub; with equal weights the distinction comes from the type family; putting 600+ weight on the subtitle fights the main title |
| Closing hold | subtitle finishes at 80f, tail of about 40f (only the very slow push-in and the footer close-out remain) | A rest of <8f cuts away before viewers have finished reading |

## Known pitfalls
- Tuned on placeholder copy in the demo: the parameters are a starting point, not final;
  re-check with real material on first real use
- **The placeholder copy is 5 words main (two lines) / 9 words sub; when swapping in project copy keep the word counts close**: total stagger length
  = `gap × word count`; double the word count and the last word's start moves back by double, squeezing the last word's entrance into the closing hold
  — beyond 8 words, compress the gap to 2–2.5f at the same time
- All three channels must share the same `p`: writing three separate easings (even with identical curves) produces
  "the travel has arrived but it's still blurry" misalignment, and the softness falls apart immediately
- Word-level splitting must be done by hand for Chinese copy: `split(' ')` on Chinese yields one solid block,
  so segment it yourself by meaning into 3–5 spans — don't degrade to per-character
- Each line is an absolutely positioned `flex` row (left-aligned on a 168px grid), with word spacing via `gap`, not spaces;
  when swapping copy keep line one under ~1450px wide (about 17 characters at 170px serif), or it collides with the issue-number background on the right
- This is a **low-energy default card**: it serves a different function from the scramble/roller cards in this category, and in the same film they can
  and should coexist (the hero gets the heavy technique, every other title uses this card)

## Reference implementation
demos/typography/blur-slide/
(BlurSlide.tsx)
