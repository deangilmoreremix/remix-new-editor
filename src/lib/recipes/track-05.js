// Track 05 — AI Avatars & Influencers recipe definitions.
// Consumed by src/lib/recipes/registry.js via RECIPES (see executor/registry wiring).

export const RECIPES_05 = {
  '05-ai-avatars-and-influencers::character-style-guide': {
    id: '05-ai-avatars-and-influencers::character-style-guide',
    title: 'Character Style Guide',
    description: 'Generate a locked, reference-conditioned AI character with consistent visual identity.',
    category: '05-ai-avatars-and-influencers',
    target: 'character',
    icon: 'User',
    buildPrompt(ctx = {}) {
      const name = (ctx.name || '[CHARACTER NAME]').toString().trim();
      const age = (ctx.age || '[AGE]').toString().trim();
      const gender = (ctx.gender || '[GENDER]').toString().trim();
      const hair = (ctx.hair || '[HAIR DETAILS]').toString().trim();
      const face = (ctx.face || '[FACIAL DETAILS]').toString().trim();
      const wardrobe = (ctx.wardrobe || 'dark blue crewneck sweater').toString().trim();
      return [
        `Create a consistent AI character: ${name}, a ${age}-year-old ${gender}.`,
        '',
        'Core Character Profile (lock these tokens across every generation to prevent face drift):',
        `• Name: ${name}`,
        `• Age & Gender: ${age} / ${gender}`,
        `• Ethnicity / Facial Structure: ${face}`,
        `• Hair Details: ${hair}`,
        '',
        'Text-to-Image Generation Prompt Anchors (use as baseline prefix for every scene):',
        `• Identity Token: "A close-up portrait of ${name}, a ${age}-year-old ${gender} with ${hair}, ${face}..."`,
        `• Wardrobe Anchor: "wearing a ${wardrobe}..."`,
        '• Aesthetic / Lighting Anchor: "cinematic office background, out of focus warm ambient lighting, 35mm film photography, photorealistic, 8k..."',
        '• Locked Seed: set and reuse the same seed across sessions.',
        '',
        'Scene Setting Matrix (maintain cohesion across backgrounds):',
        '| Scene # | Location / Background | Wardrobe | Camera Angle | Reference |',
        '| 01 | Modern corporate office | Dark blue sweater | Medium close-up | examples/avatar-anchor.jpg |',
        '| 02 | Moody home office | Dark blue sweater | Close-up profile | |',
        '| 03 | Minimalist cafe | Dark blue sweater | Wide shot | |',
        '',
        'Use reference-image conditioning for every generation; drift-check before delivery.',
      ].join('\n');
    },
  },

  '05-ai-avatars-and-influencers::voice-cloning-checklist': {
    id: '05-ai-avatars-and-influencers::voice-cloning-checklist',
    title: 'Voice Cloning Checklist',
    description: 'Prepare high-fidelity source audio and validate a cloned voice before delivery.',
    category: '05-ai-avatars-and-influencers',
    target: 'audio',
    icon: 'Mic',
    buildPrompt(ctx = {}) {
      const voice = (ctx.voice || '[CHARACTER VOICE]').toString().trim();
      return [
        `Prepare a high-fidelity voice clone for: ${voice}.`,
        '',
        '1. Source Audio Requirements (Instant Voice Cloning):',
        '• Total duration: minimum 5 minutes continuous high-quality audio (target 10 min).',
        '• Single speaker only: no background voices, crosstalk, or crowd noise.',
        '• Noise floor: remove room reverb/echo/fan noise; record in a carpeted room or closet.',
        '• File quality: uncompressed .wav, 44.1kHz or 48kHz, mono.',
        '',
        '2. Professional Voice Cloning (Fidelity Capture):',
        '• Total duration: minimum 30 minutes high-fidelity reading (target 1–2 hours).',
        '• Tone variety: read neutral, excited, calm, questioning passages to train emotional range.',
        '• Pronunciation clearances: include brand/industry words & acronyms (e.g. "SaaS", "muapi", "CRM").',
        '',
        '3. Post-Clone Validation Check:',
        '• Clarity test: 15s sentence — check for rasps, hiss, synthetic pops.',
        '• Inflection test: excited sentence — must not sound monotone/robotic.',
        '• Age & gender match: generated voice must match the Character Style Guide profile.',
      ].join('\n');
    },
  },
};
