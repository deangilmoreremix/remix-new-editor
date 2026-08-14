// Recipes for track 06 (AI Audio & Music). Imported by the recipe registry
// aggregator; each recipe is looked up by id via executeRecipe() from the
// template "Create With Smart Video" CTA.

export const RECIPES_06 = {
  '06-ai-audio-and-music::audio-prompt-library': {
    id: '06-ai-audio-and-music::audio-prompt-library',
    title: 'Generate Audio Prompt Library',
    description: 'Build copyright-free background music and SFX prompt patterns for generators like Suno, Udio, or Mubert.',
    category: '06-ai-audio-and-music',
    target: 'audio',
    icon: 'Music',
    buildPrompt(ctx = {}) {
      const use = (ctx.useCase || 'background video integration').toString().trim();
      return [
        'Generate a copyright-free audio prompt library (no vocals) for: ' + use,
        '',
        '1. Background Music (BGM) — formula: [Tempo/BPM] [Genre] [Instruments] [Mood] [Use Case]',
        '• Tech/SaaS explainer loop: "120 BPM, clean corporate tech house loop. Minimalist synthesizer, warm deep bass, soft digital percussion, optimistic mood. No vocals, seamless audio loop, high fidelity."',
        '• Cinematic suspense b-roll: "90 BPM, ambient cinematic electronic. Atmospheric pads, distant organic percussion, dark moody analog synthesizer, building tension. No vocals, cinematic master."',
        '• Lofi productivity: "80 BPM, lofi hip hop loop. Warm electric piano chords, dusty vinyl crackle, relaxed jazz drums, soothing aesthetic mood. Ideal for coding streams, background audio loop."',
        '',
        '2. Sound Effects (SFX) — formula: [Action] [Subject] [Acoustic environment] [Quality descriptor]',
        '• Digital UI click: "A single high-pitched modern UI digital click sound effect, clean, isolated, no echo, software dashboard button press, close microphone."',
        '• Whoosh transition: "Cinematic sub-bass whoosh transition sound effect, deep low rumble, fast panning left to right, high impact, clean isolated track."',
        '• Paper slide: "A single clean paper page slide sound effect, texture sliding across a desk, isolated, studio-quality, high detail."',
        '',
        'Output a reusable prompt library with both BGM and SFX formulas I can paste into an audio generator.',
      ].join('\n');
    },
  },

  '06-ai-audio-and-music::podcast-production-sheet': {
    id: '06-ai-audio-and-music::podcast-production-sheet',
    title: 'Podcast Production Sheet',
    description: 'Specify cleaning, EQ, compression, and mastering targets to output studio-quality voice tracks.',
    category: '06-ai-audio-and-music',
    target: 'audio',
    icon: 'Mic',
    buildPrompt(ctx = {}) {
      const ep = (ctx.episode || 'Untitled Episode').toString().trim();
      return [
        'Produce a studio-quality voice track for podcast episode: ' + ep,
        '',
        '1. Clean-Up Station (Noise & Hum Removal)',
        '• Noise Gate Threshold: -45dB to -50dB (silence gaps).',
        '• High-Pass Filter (HPF): cut below 80Hz (male) / 100Hz (female) to remove rumble.',
        '• De-Esser: target sibilance 4kHz–8kHz.',
        '',
        '2. Equalization (EQ) & Compression',
        '• Presence boost (clarity): +2dB at 3kHz–5kHz.',
        '• Low boost (warmth): +1.5dB at 120Hz–150Hz.',
        '• Compressor: Ratio 3:1 or 4:1, Attack 10–15ms, Release 100–200ms.',
        '',
        '3. Mastering Targets (Loudness)',
        '• Mono dialogue: -19 LUFS.',
        '• Stereo master: -16 LUFS.',
        '• True Peak Limit: -1.0 dBTP (prevent clipping on mobile).',
        '',
        'Apply this chain and return a clean, broadcast-ready mastered voice track.',
      ].join('\n');
    },
  },
};
