// Rich lesson data for the AI Tools Mastery track (track 13).
// Catalog ids/order/title/summary/time/prerequisites/related* are copied VERBATIM
// from src/data/academy/catalog.ts; problem/concept/doIt/launchIt/exercises are
// distilled from the upstream markdown in src/content/academy/13-ai-tools-mastery/lessons.

export const LESSONS_13 = [
  {
    id: '13-ai-tools-mastery::01-image-models-which-one-for-which-use-case',
    slug: '13-ai-tools-mastery::01-image-models-which-one-for-which-use-case',
    order: 1,
    title: 'Image Models — Which One for Which Use Case',
    summary:
      'A buyer\'s guide and technical decision matrix for selecting the right AI image generation model for every creative outcome.',
    time: '~40 minutes',
    prerequisites: [],
    problem:
      'The image-model landscape (Midjourney v6, FLUX 1.1 Pro, SDXL, Ideogram v2, DALL-E 3, LoRAs) moves fast, and most creators use one tool for everything — Midjourney for typography (garbled text) or DALL-E 3 for headshots (plastic skin). Mismatching model to brief wastes time fighting limitations instead of shipping client-ready assets.',
    concept: [
      'Decision flow: Creative Requirement → Architectural Match → Selected Model → Client Output.',
      'Photorealism & texture: FLUX 1.1 Pro / Schnell leads on skin micro-texture and fabric weave.',
      'Typography & text: Ideogram v2 / FLUX lead on legible spelling in logos, signage, posters.',
      'Prompt adherence & spatial composition: DALL-E 3 / FLUX follow multi-subject placement best.',
      'Artistic style & painterly default: Midjourney v6 leads on cinematic color grading.',
      'Build a multi-model pipeline rather than forcing one model to do everything.',
    ],
    doIt: [
      'From the brief, name the primary constraint: headshots/products → FLUX; typography/merch → Ideogram; cinematic art → Midjourney.',
      'Set FLUX guidance 3.5, steps 28–40; Midjourney --stylize 100–250 (real) or 500+ (artistic).',
      'Generate the base asset, then layer: FLUX base, Ideogram text overlay, Midjourney atmosphere exploration.',
      'Audit the render at 100% zoom for edges, text legibility, and finger geometry against the brief.',
      'Keep an image-model-selection-guide matrix handy for repeatable brief-to-model mapping.',
    ],
    launchIt: [
      'Sell a multi-model pipeline: FLUX for base, Ideogram for text, Midjourney for atmosphere.',
      'Position as "right tool per shot," not "I use AI" — clients pay for matched, consistent output.',
      'Reuse your selection matrix as a paid add-on or audit service for other creators.',
    ],
    exercises: [
      'Easy: generate a 1-word logo in Ideogram v2 vs Midjourney v6 and compare spelling accuracy.',
      'Medium: render a corporate portrait in FLUX 1.1 Pro and inspect skin micro-texture at 100% crop.',
      'Hard: build a tool-selection decision matrix for a 3-part campaign (headshots, logos, cinematic banners).',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '13-ai-tools-mastery::model-benchmark-comparison',
      '13-ai-tools-mastery::tools-workflow-motion',
    ],
  },
  {
    id: '13-ai-tools-mastery::02-video-models-which-one-for-which-use-case',
    slug: '13-ai-tools-mastery::02-video-models-which-one-for-which-use-case',
    order: 2,
    title: 'Video Models — Which One for Which Use Case',
    summary:
      'Master the video generation ecosystem: Runway Gen-3 Alpha, Kling 1.5, Luma Dream Machine, Sora, and Seedance 2 I2V.',
    time: '~40 minutes',
    prerequisites: ['13-ai-tools-mastery::01-image-models-which-one-for-which-use-case'],
    problem:
      'Generative video is the fastest-growing sector but credits are pricey ($0.25–$1.50 per 5s). Wrong model choice wastes money: high-motion models for subtle pans cause morphing; low-motion for action freezes; Text-to-Video destroys consistency across scenes. You need a framework tying motion profile to the exact model.',
    concept: [
      'Flow: Source Image → Motion Profile Needs → Video Model Match → Render Output.',
      'I2V fidelity (face/lighting/composition lock): Kling 1.5 / Seedance 2 I2V lead.',
      'Camera controls (pan, zoom, orbit): Runway Gen-3 Alpha / Luma Dream Machine lead.',
      'Physics & fluid motion (water, smoke, fire, cloth, limbs): Kling 1.5 / Sora lead.',
      'Speed & API efficiency: Seedance 2 I2V Fast (~15s) for high-volume pipelines.',
      'Motion scale: low (2–4) for portraits/real estate, high (6–8) for action/sports.',
    ],
    doIt: [
      'Map the scene: subtle architectural pan/product rotation → Kling 1.5 / Seedance I2V; dramatic zoom → Runway Gen-3; fluid dynamics → Kling 1.5 / Sora.',
      'Append explicit camera tokens to the prompt ("camera slowly pans right, 24fps film grain, photorealistic").',
      'Set motion strength: 2–4 for portraits/real estate, 6–8 for action.',
      'Always start from a pristine 8k source image and animate via I2V to hold brand consistency.',
      'Compare Runway Gen-3 vs Kling 1.5 camera control on the same keyframe before client delivery.',
    ],
    launchIt: [
      'Never ship Text-to-Video for commercial work — generate the 8k image first, then I2V.',
      'Sell consistent multi-shot reels using I2V keyframes across scenes as a premium deliverable.',
      'Use Seedance 2 I2V Fast for high-volume social clips to protect margins.',
    ],
    exercises: [
      'Easy: animate a static product photo with Seedance 2 I2V and a slow camera zoom prompt.',
      'Medium: compare Runway Gen-3 vs Kling 1.5 camera control on the same keyframe image.',
      'Hard: produce a 3-shot scene with consistent lighting using I2V keyframes across scenes.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['13-ai-tools-mastery::camera-motion-matrix'],
  },
  {
    id: '13-ai-tools-mastery::03-voice-audio-models-which-one-for-which-use-case',
    slug: '13-ai-tools-mastery::03-voice-audio-models-which-one-for-which-use-case',
    order: 3,
    title: 'Voice/Audio Models — Which One for Which Use Case',
    summary:
      'Select the right audio stack: ElevenLabs, Suno v3.5, Udio, Bark, and Whisper speech-to-text.',
    time: '~35 minutes',
    prerequisites: [
      '13-ai-tools-mastery::01-image-models-which-one-for-which-use-case',
      '13-ai-tools-mastery::02-video-models-which-one-for-which-use-case',
    ],
    problem:
      'Viewers tolerate soft video but click away from bad audio. Creators still pick wrong: low-end TTS gives robotic monotone; full vocal music buries dialogue; voice cloning from noisy reference audio produces artifacts. You need an exact mapping for voice synthesis, music generation, and stem isolation.',
    concept: [
      'Audio Stack Pipeline: Script → ElevenLabs Voice → Suno/Udio Instrumental → Mix & Master.',
      'Voice synthesis & cloning (ElevenLabs / Bark): emotional range, multilingual, natural breath pacing.',
      'Generative music (Suno v3.5 / Udio): full song structure or instrumental scores/beats.',
      'Speech-to-text (Whisper Large-v3): 99%+ transcription, timestamps, auto open-captions.',
      'Stability 0.40–0.50 for expressive voice; clarity+similarity boost ~0.80 for studio presence.',
      'Duck music -14dB below narration so dialogue stays clear.',
    ],
    doIt: [
      'Map the brief: narration → ElevenLabs Multilingual v2 (stability 0.45, clarity 0.85); score → Suno v3.5 instrumental / Udio; subtitles → Whisper.',
      'Set ElevenLabs Stability 0.40–0.50 and Clarity+Similarity Boost 0.80.',
      'Generate the instrumental track matching voiceover tempo (e.g., "ambient corporate piano, 110 bpm").',
      'Run Whisper to auto-generate timestamped SRT subtitles.',
      'Mix: duck background music -14dB under the voiceover during edit.',
    ],
    launchIt: [
      'Use 3+ min of clean 44.1kHz WAV as reference for any client voice clone.',
      'Pitch the cost gap: $0.12 AI audio vs ~$400 for a voice actor + stock music license.',
      'Bundle voiceover + score + subtitles as a complete audio package per video.',
    ],
    exercises: [
      'Easy: generate a 30s commercial voiceover with ElevenLabs.',
      'Medium: create an instrumental Suno v3.5 track matching your voiceover tempo.',
      'Hard: produce a full audio mix (voiceover + music + subtitles) for a 60s video ad.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [],
  },
  {
    id: '13-ai-tools-mastery::04-api-vs-local-decision-framework',
    slug: '13-ai-tools-mastery::04-api-vs-local-decision-framework',
    order: 4,
    title: 'API vs. Local: A Decision Framework',
    summary:
      'Determine when to use Cloud APIs (muapi, Replicate) vs. Local Open-Source GPUs (ComfyUI, Automatic1111) based on cost, scale, and privacy requirements.',
    time: '~40 minutes',
    prerequisites: [
      '13-ai-tools-mastery::01-image-models-which-one-for-which-use-case',
      '13-ai-tools-mastery::02-video-models-which-one-for-which-use-case',
      '13-ai-tools-mastery::03-voice-audio-models-which-one-for-which-use-case',
    ],
    problem:
      'The core architecture choice — Cloud API or Local GPU — burns capital when wrong: a $3,500 RTX 4090 for 20 renders/week takes years to break even, while 10,000 monthly cloud renders at $600+/mo destroys margins, and sending NDA client assets to public APIs violates compliance. You need a math-based matrix for your business stage.',
    concept: [
      'Decision: Monthly Volume & Privacy → Cost Payback → Cloud API vs Local GPU.',
      'Cloud APIs: $0 upfront, pay-as-you-go, superior at low volume ($5–$20/mo), instant scaling, zero setup.',
      'Local GPU: $1,500–$4,500 upfront, $0 marginal cost per render (only electricity), needs Python/VRAM/CUDA.',
      'Payback = Workstation Cost ÷ Monthly Savings vs API; ~4.5–7 months at high volume.',
      'Privacy: local air-gapped rendering is mandatory for NDA headshots / unreleased prototypes.',
      'Cloud GPU (RunPod/Vast.ai) is the middle ground — rent RTX 4090/hr for burst batch jobs.',
    ],
    doIt: [
      'Run the payback calculator: 300 renders/mo @ $0.06 ≈ $18 → stay on Cloud API; 10,000/mo ≈ $600 → buy local RTX 4090 (pays back <4.5 mo).',
      'Evaluate privacy: if handling NDA/corporate/unreleased assets, enforce local air-gapped rendering regardless of volume.',
      'Implement a hybrid: Cloud API for mobile intake + burst, Local ComfyUI for heavy batch fine-tuning/LoRA.',
      'For burst work, rent RunPod at ~$0.44/hr to get ComfyUI node control without buying hardware.',
      'Document the chosen architecture per client tier so quoting stays consistent.',
    ],
    launchIt: [
      'Use RunPod cloud GPUs as the middle ground — ComfyUI control, no upfront hardware.',
      'Sell the calculator output: prove to clients when local vs API is cheaper at their volume.',
      'Offer hybrid infra plans (cloud intake + local batch) as a premium operations service.',
    ],
    exercises: [
      'Easy: calculate your monthly API spend using the formula in api-cost-calculator.md.',
      'Medium: rent a cloud GPU on RunPod and launch a ComfyUI web interface.',
      'Hard: build a hybrid plan combining Cloud API mobile submission with Local GPU batch processing.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [],
  },
];
