# SmartVideo — Lean Video Production Plan

> **Status:** DRAFT — awaiting approval  
> **Prepared:** 2026-08-06  
> **Application:** SmartVideo (open-source AI studio for images, video, and cinema)

---

## Guiding Principle

**One explainer per studio, one demo per core feature, three end-to-end workflows.**  
Nothing more until these are shipped and we know what viewers actually ask for next.

---

## Tier 1 — Marketing (3 videos)

| # | Title | Length | Purpose |
|---|-------|--------|---------|
| T1-01 | "SmartVideo — The Free, Open-Source AI Studio" | 60–75 s | Platform overview, 200+ models, 18 studios, MIT license. Landing page hero + YouTube ad. |
| T1-02 | "Sendspark AI Video — Open Source" | 75–90 s | Competitive/contrarian: voice cloning, dynamic backgrounds, bulk gen, 70%+ Sendspark parity. Blog embed + Reddit/HN launch. |
| T1-03 | "Your AI Video Editor — 12 Tools, One Interface" | 60–75 s | Video Agent teaser: scene detection, dubbing, highlights, subtitles in one click. Product Hunt / Twitter. |

---

## Tier 2 — Studio Explainers (8 videos)

One video per studio, consistent structure: **hook → what it does → 3 key features → example output → CTA**.  
90–120 s each. Screen recording + text overlays + generated output B-roll.

| # | Studio | Title | 3 Features to Show |
|---|--------|-------|-------------------|
| T2-01 | **Image Studio** | "Generate AI Images With 50+ Models" | Text-to-Image, Image-to-Image, multi-image input + LoRA |
| T2-02 | **Video Studio** | "Generate AI Videos — Text, Image, or Video In" | Text-to-Video, Image-to-Video, Seedance Extend |
| T2-03 | **Cinema Studio** | "Cinematic AI — Camera Builder + Prompt Engine" | Cinema Prompt Builder, Camera Builder (lens/focal/aperture), aspect ratios |
| T2-04 | **Effects Studio** | "350+ AI Effects & Motion Controls" | Effect search, split preview, one-click apply |
| T2-05 | **Edit Studio** | "13 AI Image Editing Tools" | Remove Object, AI Edit, Face Swap / Ghibli Style |
| T2-06 | **Timeline Editor** | "A Full NLE in Your Browser — Powered by AI" | Multi-track timeline, keyframe animation, AI assistant |
| T2-07 | **Video Render + Video Agent** | "Review, Refine & Export With AI" | Cinematic presets, action tiles (Shorts/Subtitles/Dub), render queue |
| T2-08 | **Video Personalization (Sendspark Workflow)** | "Send 1,000 Personalized Videos in 10 Minutes" | Record → clone voice → import contacts → bulk generate → analytics |

> **Note:** Studios 9–18 (Upscale, Character, Storyboard, Commercial, Influencer, Audio, Avatar, Training, Video Tools, Chat, Lip Sync, Cinema Template) are documented in README and tooltips. We'll produce explainers for these only after the first 8 ship and we see demand.

---

## Tier 3 — Feature Demos (8 videos)

Hands-on walkthroughs of the most-asked-for features.  
60–90 s each.

| # | Feature | Studio | What It Shows |
|---|---------|--------|---------------|
| T3-01 | Text-to-Image first generation | Image Studio | Prompt → model select → generate → download |
| T3-02 | Image-to-Image transform | Image Studio | Upload → i2i model → reference strength → result |
| T3-03 | Text-to-Video first generation | Video Studio | Prompt → duration → resolution → generate |
| T3-04 | Cinema Prompt + Camera Builder | Cinema Studio | Build prompt → camera type → lens → focal → aperture → generate |
| T3-05 | Remove Object / AI Edit | Edit Studio | Upload → brush over object → AI removes it |
| T3-06 | Timeline drag-and-drop + keyframe | Timeline Editor | Import clip → drag to track → add keyframe → animate |
| T3-07 | Video Agent — full pipeline | Video Agent | Upload → Run Full Pipeline → scene detection → highlights → export |
| T3-08 | Personalized video campaign | Video Personalization | Record → contacts CSV → clone voice → bulk generate → analytics |

---

## Tier 4 — Workflow Series (3 videos)

End-to-end journeys that combine multiple studios. These are the "watch this and you'll understand the product" videos.  
180–240 s each.

| # | Workflow | Path | Persona |
|---|----------|------|---------|
| T4-01 | **Cinema Production** | Cinema Prompt Builder → Camera Builder → generate scenes → import to Timeline → add keyframes + Audio Studio music → export | Filmmaker / content creator |
| T4-02 | **Personalized Video Campaign** | Record base video → clone voice → import contacts → configure tokens → bulk generate → landing pages → analytics | Sales / marketing |
| T4-03 | **Full NLE Edit with AI** | Import footage → AI scene detection → AI assistant suggests cuts → keyframe animation → PIP compositing → subtitle generation → export | Video editor |

---

## What We're NOT Making Yet

| Skipped | Why | When to revisit |
|---------|-----|-----------------|
| Individual explainers for studios 9–18 | Low traffic until core studios are understood | After T2-01 through T2-08 ship |
| Individual feature playgrounds beyond T3-01…T3-08 | T3 covers the entry points; deeper features get embedded in docs | Per user feedback / support tickets |
| T5 Technical videos | Developers read docs; video is for users | When we have a contributor onboarding spike |
| T3-CON concept series | Concepts are taught within T2/T3 explainers | If we get repeated questions about LoRA, prompts, etc. |

---

## Total: 22 Videos

| Tier | Count | Total Runtime |
|------|-------|---------------|
| T1 Marketing | 3 | ~3.5 min |
| T2 Studio Explainers | 8 | ~12–15 min |
| T3 Feature Demos | 8 | ~9–11 min |
| T4 Workflows | 3 | ~9–12 min |
| **Total** | **22** | **~34–42 min** |

---

## Production Pipeline

### Phase 1: Pre-Production (1 week)
- [ ] Write scripts for all 22 videos using the template below
- [ ] Set up recording: OBS (1080p@60fps), USB mic, test Muapi key
- [ ] Prepare demo assets: sample images, contacts CSV, pre-generated videos for B-roll
- [ ] Design thumbnail template + 5 s intro bumper

### Phase 2: Record (2 weeks)
- [ ] Week 1: T1 (3) + T2-01 through T2-04 (4) = 7 videos
- [ ] Week 2: T2-05 through T2-08 (4) + T3-01 through T3-04 (4) = 8 videos
- [ ] Week 3: T3-05 through T3-08 (4) + T4-01 through T4-03 (3) = 7 videos

### Phase 3: Post-Production (1 week)
- [ ] Edit + text overlays + B-roll
- [ ] Captions (Whisper / YouTube auto-captions)
- [ ] Thumbnails (batch from template)
- [ ] Export: 1080p MP4, 720p MP4, 9:16 vertical for Shorts

### Phase 4: Publish (ongoing)
- [ ] YouTube unlisted → public on launch days
- [ ] Embed in docs/README at relevant studio sections
- [ ] Clips to Twitter, LinkedIn, landing page

---

## Script Template

```
[0:00 - 0:08]  HOOK
               "Here's the thing about [feature]..."
               Visual: striking output or contrarian claim.

[0:08 - 0:20]  WHAT IT IS
               "In [Studio], [feature] lets you..."
               Visual: studio UI with feature highlighted.

[0:20 - 0:45]  HOW IT WORKS
               Step 1 → Step 2 → Step 3
               Visual: screen recording with cursor highlights.

[0:45 - 0:55]  THE RESULT
               "And here's what you get..."
               Visual: before/after or output showcase.

[0:55 - 1:00]  CTA
               "Try it now in [Studio]"
               Visual: CTA button or link animation.
```

---

## File Naming Convention

```
{TIER}-{NN}-{short-description}.mp4

Examples:
  T1-01-platform-overview.mp4
  T2-03-cinema-studio.mp4
  T3-06-timeline-keyframes.mp4
  T4-02-personalized-campaign.mp4
```

---

## Approval Checklist

- [ ] 22-video scope is approved
- [ ] T1, T2, T3, T4 priorities are confirmed
- [ ] Studios 9–18 explainers deferred (not cancelled)
- [ ] Recording environment and test assets are ready
- [ ] Script review process is defined
- [ ] Thumbnail/bumper style is approved
