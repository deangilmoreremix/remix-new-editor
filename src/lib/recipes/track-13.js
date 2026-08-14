export const RECIPES_13 = {
  '13-ai-tools-mastery::image-model-selection-guide': {
    id: '13-ai-tools-mastery::image-model-selection-guide',
    title: 'AI Image Model Selection Guide',
    description: 'Match project requirements to the right AI image generation model.',
    category: '13-ai-tools-mastery',
    target: 'image',
    icon: 'Image',
    buildPrompt(ctx = {}) {
      const req = (ctx.requirement || 'corporate headshots / product photos').toString().trim();
      return [
        `Plan an AI image generation brief for the requirement: ${req}.`,
        '',
        'Image Model Performance Matrix (Photorealism / Typography / Spatial / Versatility / Speed / Cost):',
        '• FLUX 1.1 Pro — 9.5 / 9.5 / 9.5 / 8.5 / ~5s / $0.04 (best all-round, text + skin).',
        '• FLUX Schnell — 8.5 / 9.0 / 9.0 / 8.0 / ~2s / $0.003 (fast brainstorm).',
        '• Midjourney v6 — 9.0 / 6.5 / 8.0 / 10.0 / ~15s / Sub (artistic, stylized).',
        '• Ideogram v2 — 7.5 / 10.0 / 9.0 / 8.5 / ~8s / $0.08 (logo typography).',
        '• DALL-E 3 — 6.5 / 8.5 / 9.0 / 7.5 / ~10s / $0.08 (broad conceptual).',
        '',
        'Use Case Decision Tree:',
        'Corporate Headshots / Product Photos ─► FLUX 1.1 Pro.',
        'Apparel Merch / Logo Typography ─► Ideogram v2 or FLUX 1.1 Pro.',
        'Film Storyboards / Artistic Fantasy ─► Midjourney v6 (--stylize 250+).',
        'Fast Conceptual Brainstorming ─► FLUX Schnell / DALL-E 3.',
        '',
        'Output: chosen model, rationale, recommended prompt structure, and expected cost per image.',
      ].join('\n');
    },
  },

  '13-ai-tools-mastery::video-audio-stack-matrix': {
    id: '13-ai-tools-mastery::video-audio-stack-matrix',
    title: 'AI Video & Audio Stack Matrix',
    description: 'Set camera motion, video model, and voice/audio engine for a project.',
    category: '13-ai-tools-mastery',
    target: 'video',
    icon: 'Video',
    buildPrompt(ctx = {}) {
      const brief = (ctx.brief || 'short branded commercial with voiceover').toString().trim();
      return [
        `Plan an AI video + audio production stack for: ${brief}.`,
        '',
        'Video Model Comparison Matrix (Keyframe / I2V Stability / Physics / Speed / Cost per 5s):',
        '• Runway Gen-3 Alpha — 10.0 / 9.0 / 9.0 / ~60s / $0.25–$0.50 (best keyframe control).',
        '• Kling 1.5 — 8.5 / 9.5 / 9.5 / ~90s / $0.20–$0.40 (best geometry + physics).',
        '• Luma Dream Machine — 8.0 / 8.5 / 8.5 / ~45s / $0.25.',
        '• Seedance 2 I2V Fast — 8.5 / 9.0 / 8.5 / ~15s / $0.15 (fastest + cheapest).',
        '',
        'Audio & Voice Engine Matrix (Domain / Emotional Range / Mix Control / Pricing):',
        '• ElevenLabs — Voice Synthesis & Cloning / 10.0 / 9.0 / Sub ($5–$330/mo).',
        '• Suno v3.5 — Generative Song & Music / 8.5 / 8.0 / Sub ($10–$30/mo).',
        '• Udio — Generative Music Production / 9.0 / 9.5 / Sub ($10–$30/mo).',
        '• OpenAI Whisper — Speech-to-Text / N/A / N/A / Free or $0.006/min.',
        '',
        'Output: recommended video model + audio engine, camera-motion parameters, and per-clip cost estimate.',
      ].join('\n');
    },
  },
};
