# AUDIO_AVATAR_TRAINING_AUDIT.md
**Date:** 2026-08-11  
**Baseline:** afad812a22d9f6f470222a99136b7cd651f61a89 → HEAD  
**Sub-Agent:** 3 — AUDIO/AVATAR/TRAINING STUDIOS AUDITOR

---

## AUDIO STUDIO

### What Was Present at Baseline (afad812a)
- **Model selector:** Complex dropdown with provider sidebar, search bar, model list, and provider filtering (`modelSelectorUI.js`)
- **Voice selection (TTS models):** `selectedVoice` variable (`'female-1'` default), voice `<select>` with "Female 1" and "Male Qingse" options, conditionally shown when `selectedModel.type === 'tts'`
- **Style selector (music models):** Pop, Rock, Electronic, Classical, Jazz, Hip Hop, Ambient
- **Duration selector:** 15s, 30s, 60s, 120s
- **Prompt textarea:** With GTM Boost + Personalize trigger
- **Thumbnail button:** StudioThumbnailModal integration
- **Result area:** `<audio controls>` player + Download link
- **Type-specific generation:**
  - `selectedModel.type === 'music'` → `muapi.generateMusic({ model, prompt, style, duration })`
  - `selectedModel.type === 'tts'` → `muapi.generateAudio({ model, text, speed, voice })`
  - else → `muapi.generateAudio({ model, prompt, duration, style? })`

### What Is Present at Current HEAD
- **Model selector:** Simplified to button row (one button per model, no dropdown/search/provider sidebar)
- **Style selector (music models):** Same 7 options (hidden by default, shown when `supportsStyles`)
- **Duration selector:** Same 4 options
- **Prompt textarea:** With GTM Boost + Personalize trigger
- **Thumbnail button:** Same StudioThumbnailModal integration
- **Result area:** Same `<audio controls>` player + Download link
- **Unified generation:** Always calls `muapi.generateAudio({ model, prompt, duration, style? })` regardless of model type

### Missing from Current vs Historical
| Feature | Status |
|---|---|
| **Voice selection (TTS)** | **REMOVED** — `selectedVoice` variable and voice `<select>` UI no longer exist |
| **TTS-specific generation path** | **REMOVED** — no longer calls `muapi.generateAudio({ text, speed, voice })`; TTS models now treated identically to music models |
| **`generateMusic()` API call** | **REMOVED** — all models now route through `muapi.generateAudio()` |
| **Speed/pitch controls** | **MISSING** — no speed slider or pitch control (duration was used as speed proxy for TTS, now removed) |
| **Tone/emotion controls** | **MISSING** — no emotion/tone selector for speech |
| **Volume control** | **MISSING** — no volume normalization or per-voice volume |
| **Language/pronunciation** | **MISSING** — no language selector or pronunciation guides |
| **Waveform preview** | **MISSING** — no waveform visualization (only native `<audio controls>`) |
| **Audio trimming** | **MISSING** — no trim/cut interface |
| **Audio mixing (BGM)** | **MISSING** — no ability to layer voice + music |
| **Stem separation** | **MISSING** — no vocal/instrumental separation |
| **Audio effects** | **MISSING** — no reverb, EQ, fade in/out, compression |
| **Lyrics input** | **MISSING** — no structured lyrics editor for singing |
| **Voice cloning** | **MISSING** — no reference voice upload for cloning |
| **Sound effects library** | **MISSING** — no SFX browsing or insertion |
| **Audio export options** | **MISSING** — no format/bitrate/quality selection |
| **Audio preview before download** | **MISSING** — no inline waveform scrubber (native audio controls only) |
| **Complex model selector** | **REMOVED** — downgraded from provider-sidebar dropdown to flat button row |
| **SettingsModal Audio tab** | **MISSING** — no input/output device selection, sample rate, normalization, noise reduction, echo cancellation |
| **SettingsModal Export tab** | **MISSING** — no format (MP4/WebM/MOV), quality presets, bitrate controls |

---

## AVATAR STUDIO

### What Was Present at Baseline (afad812a)
- **Model selector:** Complex dropdown with provider sidebar, search bar, model list (`modelSelectorUI.js`)
- **Source Video/Image upload:** Conditional on `selectedModel.hasVideo`
- **Audio upload (lip sync):** Conditional on `selectedModel.hasAudio`
- **Prompt input:** Conditional on `selectedModel.hasPrompt`, with GTM Boost + Personalize
- **Thumbnail button:** StudioThumbnailModal integration
- **Generate button:** Calls `muapi.generateAvatar({ model, video_url, audio_url?, prompt?, customThumbnailUrl? })`
- **Result area:** `<video controls>` player + Download link

### What Is Present at Current HEAD
- **Model selector:** Simplified to button row (one button per model)
- **Source Video/Image upload:** Same conditional logic (`hasVideo`)
- **Audio upload (lip sync):** Same conditional logic (`hasAudio`)
- **Prompt input:** Same conditional logic (`hasPrompt`) + GTM Boost + Personalize
- **Thumbnail button:** Same StudioThumbnailModal integration
- **Generate button:** Same API call shape
- **Result area:** Same `<video controls>` player + Download link
- **New:** `updateModelBtns()` helper for active state styling

### Missing from Current vs Historical
| Feature | Status |
|---|---|
| **Complex model selector** | **REMOVED** — downgraded from provider-sidebar dropdown to flat button row |
| **Avatar character customization** | **MISSING** — no hair, clothes, skin, or appearance controls |
| **Avatar expression controls** | **MISSING** — no preset expressions (happy, sad, angry, surprised, neutral) |
| **Background replacement** | **MISSING** — no background swap or green screen controls |
| **Camera/framing controls** | **MISSING** — no angle, zoom, or framing controls |
| **Script editor** | **MISSING** — no multi-line script or dialogue editor |
| **Multi-speaker support** | **MISSING** — no two-speaker conversation mode |
| **Subtitles/captions** | **MISSING** — no subtitle generation or overlay |
| **Language selection** | **MISSING** — no language or accent controls for avatar speech |
| **Avatar library** | **MISSING** — no saved avatar presets or templates |
| **Voice selection** | **MISSING** — only audio upload; no built-in voice library |
| **Gesture/pose controls** | **MISSING** — no gesture library or pose presets |
| **Preview before generation** | **MISSING** — no input preview collage (video + audio + prompt) |
| **Video trim/editing** | **MISSING** — no timeline or clip editing in result |
| **Batch generation** | **MISSING** — no multi-variant generation |
| **Aspect ratio / resolution** | **MISSING** — no output resolution selector |
| **SettingsModal** | **MISSING** — no avatar-specific settings panel |

---

## TRAINING STUDIO

### What Was Present at Baseline (afad812a)
- **Model selector:** Complex dropdown with provider sidebar, search bar, model list (`modelSelectorUI.js`)
- **LoRA Name input:** Text field
- **Trigger Word input:** Optional text field
- **Training Epochs:** 5, 10, 20, 30 button group
- **Training Images upload:** Multi-file upload (10-20 recommended) via UploadPicker
- **Image count display:** Shows selected image count
- **Thumbnail button:** StudioThumbnailModal integration
- **Train LoRA button:** Calls `muapi.trainLora({ model, name, images, epochs, trigger_word? })`
- **Result area:** Success message + LoRA download link

### What Is Present at Current HEAD
- **Model selector:** Simplified to button row (one button per model)
- **LoRA Name input:** Same
- **Trigger Word input:** Same
- **Training Epochs:** Same 5/10/20/30 options
- **Training Images upload:** Same multi-file upload
- **Image count display:** Same
- **Thumbnail button:** Same
- **Train LoRA button:** Same flow, but parameter renamed: `images_list` instead of `images`
- **Result area:** Same success/download flow
- **New:** `updateModelBtns()` helper for active state styling

### Missing from Current vs Historical
| Feature | Status |
|---|---|
| **Complex model selector** | **REMOVED** — downgraded from provider-sidebar dropdown to flat button row |
| **Learning rate control** | **MISSING** — no LR slider or preset (e.g., 1e-4, 5e-5) |
| **Batch size control** | **MISSING** — no batch size selector |
| **Optimizer selection** | **MISSING** — no Adam/AdamW/Lion choice |
| **Learning rate scheduler** | **MISSING** — no cosine/linear/constant scheduler |
| **Training progress indicator** | **MISSING** — no live progress bar, ETA, or step counter |
| **Training status display** | **MISSING** — no queued/training/complete/failed status states |
| **Dataset preview/gallery** | **MISSING** — no image gallery to review training data |
| **Dataset validation** | **MISSING** — no duplicate detection, quality check, or caption review |
| **Validation split** | **MISSING** — no train/val split control |
| **Data augmentation controls** | **MISSING** — no flip/rotate/crop augmentation toggles |
| **Resume training** | **MISSING** — no resume from checkpoint |
| **Checkpoint management** | **MISSING** — no intermediate checkpoint saving or selection |
| **LoRA metadata output** | **MISSING** — no metadata editor (description, tags, base model) |
| **LoRA rank/dimension** | **MISSING** — no rank selector (4, 8, 16, 32, 64) |
| **LoRA alpha** | **MISSING** — no alpha/scale factor control |
| **Training presets** | **MISSING** — no preset configurations (fast/balanced/quality) |
| **Model management** | **MISSING** — no LoRA library, version history, or delete/rename |
| **Training cost estimate** | **MISSING** — no GPU time or credit estimate |
| **Webhook/notification** | **MISSING** — no notification on completion |
| **Caption/text input per image** | **MISSING** — no per-image caption editor |
| **SettingsModal** | **MISSING** — no training-specific settings panel |

---

## CROSS-STUDIO FINDINGS

### Pattern Regression
All three studios share the same regression pattern:
1. **Model selector downgrade:** The rich `modelSelectorUI.js` dropdown (provider sidebar + search + filtered model list) was replaced with a flat button row. This removes:
   - Provider filtering
   - Model search
   - Provider logo display
   - Scrollable model list for large catalogs

2. **Removed imports:** `modelSelectorUI.js` imports removed from all three files.

3. **No new functionality added:** The refactor simplified the selector but added no new capabilities to compensate.

### Git Diff Summary
| File | Lines Changed | Nature |
|---|---|---|
| `src/components/AudioStudio.js` | −94 lines | Removed complex model selector, voice selector, type-specific generation branching |
| `src/components/AvatarStudio.js` | −94 lines | Removed complex model selector, added `updateModelBtns()` |
| `src/components/TrainingStudio.js` | −94 lines | Removed complex model selector, added `updateModelBtns()`, renamed `images` → `images_list` |

### Key Risks
1. **AudioStudio TTS regression:** TTS models that previously had voice selection and `text`/`speed`/`voice` parameters now receive only `prompt` + `duration`. This may break TTS functionality or produce incorrect output.
2. **AudioStudio music regression:** `muapi.generateMusic()` removed; music models now call `muapi.generateAudio()`. If the API expects different parameters, music generation may fail.
3. **TrainingStudio API breakage:** Parameter renamed from `images` to `images_list`. If the backend still expects `images`, training will fail.
4. **Model selector UX regression:** Studios with many models (Audio, Training) lose search/filter, making model discovery harder.

### What Historical Had That Current Lacks (Consolidated)
| Capability | Audio | Avatar | Training |
|---|---|---|---|
| Voice selection/controls | ✅→❌ | — | — |
| Tone/emotion/speed/pitch/volume | — | — | — |
| Waveform/audio editor/trim/mix/effects | — | — | — |
| Avatar customization (hair/expressions/background) | — | — | — |
| Script/multi-speaker/subtitles | — | — | — |
| Learning rate/batch size/optimizer/checkpoints | — | — | — |
| Training progress/status/dataset preview | — | — | — |
| Complex model selector (search/provider) | ✅→❌ | ✅→❌ | ✅→❌ |
| SettingsModal tabs (Audio/Video/Export/Keyboard) | — | — | — |

---

*End of AUDIO_AVATAR_TRAINING_AUDIT.md*
