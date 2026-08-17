export const RECIPES_02 = {
  '02-ai-filmmaking::storyboard-script-template': {
    id: '02-ai-filmmaking::storyboard-script-template',
    title: 'AI Storyboard Script',
    description: 'Break a scene into an AI-ready storyboard script with master style prefix, per-shot image + motion prompts, and drift control.',
    category: '02-ai-filmmaking',
    target: 'storyboard',
    icon: 'Clapperboard',
    buildPrompt(ctx = {}) {
      const title = ctx.filmTitle || '[Film Name]';
      const genre = ctx.genre || '[Sci-Fi Noir / Cyberpunk / Cinematic Drama]';
      const scene = ctx.scene || 'Scene 1: [Scene Title]';
      const location = ctx.location || '[INT/EXT. Location - Time of Day]';
      const character = ctx.character || '[Character Name, Age, Outfit, Key Physical Attributes]';
      const palette = ctx.palette || '[Cool teal and cyan, neon orange rim lights, deep shadows]';
      return [
        `AI Storyboard Script for: ${title} (${genre})`,
        `Scene: ${scene}`,
        `Location & Setting: ${location}`,
        `Visual Anchor Character: ${character}`,
        `Color Palette & Lighting: ${palette}`,
        '',
        'Master Style Prefix (prepend to every image prompt):',
        '"Cinematic 35mm film photograph, shot on Hasselblad 85mm lens, f/2.8 depth of field, [Color Palette/Mood], highly detailed 8k render."',
        '',
        'Master Negative Prompt:',
        '"bad anatomy, cartoon, anime, 3d render, oversaturated, blurry, extra limbs, low resolution, watermark, deformed."',
        '',
        'Multi-Shot Storyboard:',
        '• Shot 1 (Wide): establishing shot of location. Motion: "Slow cinematic dolly forward into room, atmospheric smoke moving".',
        '• Shot 2 (Medium): character entrance/reaction, eye-level, shallow DoF. Motion: "Character turns head toward camera, subtle facial muscle movement".',
        '• Shot 3 (Close-up): prop/detail interaction, macro focus. Motion: "Panning reflection across surface, digital screen flickering".',
        '',
        'Drift Control Checklist:',
        '• Lock character reference image as images_list for character shots.',
        '• Keep master style prefixes identical across all prompts.',
        '• Isolate a prop in the close-up to prevent facial drift on transitions.',
        '• Align aspect ratios (16:9 landscape, 9:16 vertical shorts).',
      ].join('\n');
    },
  },

  '02-ai-filmmaking::screenplay-prompt-template': {
    id: '02-ai-filmmaking::screenplay-prompt-template',
    title: 'AI Screenplay Prompt',
    description: 'Format a short film script optimized for AI video generators (Kling, Luma, Runway) with visual anchors and shot-level video prompts.',
    category: '02-ai-filmmaking',
    target: 'cinema',
    icon: 'Film',
    buildPrompt(ctx = {}) {
      const title = ctx.title || '[Title]';
      const genre = ctx.genre || '[Sci-Fi / Noir Drama / Thriller]';
      const location = ctx.location || '[LOCATION NAME]';
      const time = ctx.time || '[TIME OF DAY]';
      const character = ctx.character || '[Character, age, hair, clothing, facial expression]';
      const style = ctx.style || 'Cinematic 35mm film, low-key lighting, moody blue and orange color grading, highly detailed texture';
      return [
        `AI Screenplay Prompt for: ${title} (${genre})`,
        `Max Characters: 1-2 key characters | Key Locations: 1-2 environments`,
        '',
        `SCENE 1: ${location} - ${time}`,
        '',
        'Scene Constraint Check:',
        '• No complex physical interactions (hugging, wrestling).',
        '• Focus on static or predictable movements (sitting at a desk, looking out a window).',
        '',
        'Visual Prompt Anchor:',
        `• Visual Style: ${style}`,
        `• Environment: [Describe location details for consistency]`,
        `• Character Anchor: ${character}`,
        '',
        'Scene Action:',
        '[1-2 sentences, highly visual.] e.g. JOHN (30s) sits at a cluttered desk, staring blankly at a glowing laptop screen. Cold blue light illuminates the dark room.',
        '',
        'Voice / TTS Script (under 15 words per shot):',
        'JOHN: (whispering) "It was here the entire time."',
        '',
        'Video Prompt (Action / Movement):',
        '"Medium shot of John sitting at the desk, slowly looking up at the camera. Blue light reflects in his eyes. Subtle camera zoom, high quality."',
        '',
        'Repeat structure for 5-8 total scenes (~1-2 minute runtime).',
      ].join('\n');
    },
  },
};
