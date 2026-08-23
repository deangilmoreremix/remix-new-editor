// Track 04 — AI Content Factories recipe definitions.
// Consumed by src/lib/recipes/registry.js via RECIPES (see executor/registry wiring).

export const RECIPES_04 = {
  '04-ai-content-factories::thumbnail-prompt-library': {
    id: '04-ai-content-factories::thumbnail-prompt-library',
    title: 'Thumbnail Prompt Library',
    description: 'Generate high-CTR thumbnail assets from tested nano-banana-2 prompt patterns.',
    category: '04-ai-content-factories',
    target: 'image',
    icon: 'Image',
    buildPrompt(ctx = {}) {
      const angle = (ctx.angle || 'high-contrast tech / SaaS concept').toString().trim();
      return [
        'Generate a high-CTR YouTube thumbnail in nano-banana-2 (aspect ratio 16:9 or 1:1).',
        `Requested visual angle: ${angle}`,
        '',
        'Tested prompt patterns (use one as the base):',
        '1) High-Contrast Tech/SaaS: "Widescreen 16:9, clean modern aesthetic. A shining silver key glowing with blue light, unlocking a physical metal padlock. Out of focus dark background with soft green binary code lights glowing. Cinematic lighting, photorealistic, 8k resolution, highly detailed."',
        '2) Frustrated Creator/Emotional: "Close-up portrait of a young male programmer looking at his glowing laptop screen in shock. Room is dark, backlit by cool purple and amber led light bars. Widescreen 16:9, Arri Alexa cinematic lighting, shallow depth of field, photorealistic, highly detailed."',
        '3) Financial Success/Growth: "A modern glowing green digital bar chart floating in the middle of a dark minimalist luxury office. Clean reflections on glass surfaces. Cinematic volumetric lighting, photorealistic, architectural rendering, 8k, widescreen."',
        '',
        'Thumbnail composition rules:',
        '• Rule of Thirds: place primary subject on the left/right third; keep the other side clean for large readable text.',
        '• Text Contrast: max 3 words, bold sans-serif, thick black drop shadow or solid background box.',
        '• Emotional Faces: boost contrast + saturation ~10% so faces stay readable at ~120px mobile thumbnails.',
      ].join('\n');
    },
  },

  '04-ai-content-factories::tiktok-reels-editor-preset': {
    id: '04-ai-content-factories::tiktok-reels-editor-preset',
    title: 'TikTok & Reels Editor Preset',
    description: 'Produce a fast-paced vertical video using CapCut/Premiere/DaVinci cut and caption presets.',
    category: '04-ai-content-factories',
    target: 'video',
    icon: 'Video',
    buildPrompt(ctx = {}) {
      const topic = (ctx.topic || 'a fast-paced vertical short').toString().trim();
      return [
        `Produce a fast-paced vertical (9:16) video about: ${topic}.`,
        '',
        'Visual Cut Pacing:',
        '• Hook (0.0s–3.0s): cut or zoom-in every 1.5s; first 3 seconds must have rapid movement.',
        '• Body (3.0s+): cut to a new asset or zoom scale every 2.5–3.5s; never hold a static image longer than 4s.',
        '',
        'Text Caption Configuration:',
        '• Font: bold sans-serif (Montserrat, Bold Impact, Archivo Black, Outfit).',
        '• Pacing: auto-captions output 1–3 words per screen; never whole sentences at once.',
        '• Styling: white #FFFFFF text, black #000000 stroke size 8–12, highlight #FFD700 or #00FF00 for keywords (e.g. "AUTOMATE", "FREE").',
        '• Position: center-screen, Y -100 to -150 on vertical grid (just above comments).',
        '',
        'Kinetic Scale Animations:',
        '• Slow scale-up on every still image background: Keyframe 1 start 100% -> Keyframe 2 end 108% to keep static frames feeling alive.',
      ].join('\n');
    },
  },
};
