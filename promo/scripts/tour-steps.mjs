// Walkthrough scripts: what a user does, step by step, in each studio. Only SAFE controls are used (menus, pickers, tabs, typing, toggles, scrolling, hovering).
// Never: Generate / Create / Delete / Publish / Upload / Download / Apply... (the recorder also refuses those by name).
// `say` is the on-screen step caption (kept short and literal to what the UI does); `sub` is optional detail text from the app's own copy.
export const STUDIOS = {
  video: {
    route: 'video', title: 'Video Studio', blurb: 'Create AI videos from text and images',
    steps: [
      { say: 'Choose how to start', sub: 'Text to video, Animate image, Keyframes, References, Edit video', do: [
        { click: '#v-workflow-btn', wait: 1800 },
        { hover: 'text:Animate image', wait: 1200 },
        { hover: 'text:Keyframes', wait: 1200 },
        { hover: 'text:Text to video', wait: 900 },
        { click: 'text:Text to video', wait: 800 },
      ] },
      { say: 'Write your prompt', sub: 'Describe the scene, subject and motion', do: [
        { type: { sel: '#v-v-prompt-textarea', text: 'A lone cyclist crosses a neon-lit bridge at dusk, slow cinematic push-in', delay: 65 }, wait: 1200 },
      ] },
      { say: 'Pick a model', sub: 'Every model has its own options', do: [
        { click: '#v-model-btn', wait: 1800 },
        { hover: 'text:Seedance pro I2V Fast', wait: 1400 },
        { click: 'text:Seedance pro I2V Fast', wait: 1600 },
      ] },
      { say: 'The form reshapes to the model', sub: 'Image-to-video model: duration and prompt hint change', do: [
        { hover: '#v-duration-btn', wait: 1300 },
        { click: '#v-duration-btn', wait: 1600 },
        { key: 'Escape', wait: 600 },
        { hover: '#v-v-prompt-textarea', wait: 1500 },
      ] },
      { say: 'Switch back to a text-to-video model', do: [
        { click: '#v-model-btn', wait: 1600 },
        { click: 'text:Seedance lite', wait: 1600 },
      ] },
      { say: 'Fine-tune the look', sub: 'Motion & Style, Advanced options', do: [
        { click: '#v-motion-style-btn', wait: 1800 },
        { key: 'Escape', wait: 400 },
        { click: '#v-advanced-btn', wait: 2000 },
      ] },
      { say: 'Then press Generate', sub: 'The result appears in your library when ready', do: [
        { hover: 'text:Generate', wait: 2200 },
      ] },
    ],
  },
  image: {
    route: 'image', title: 'Image Studio', blurb: 'Create images from a prompt, with any model',
    steps: [
      { say: 'Describe the image', sub: 'Plain-language prompt', do: [
        { type: { sel: '#i-prompt-textarea', text: 'A ceramic coffee cup on a sunlit marble counter, soft morning light', delay: 65 }, wait: 1000 } ] },
      { say: 'Pick a model', sub: 'Different models, different looks', do: [
        { click: '#model-btn', wait: 2200 }, { key: 'Escape', wait: 500 } ] },
      { say: 'Choose the aspect ratio', do: [
        { click: '#ar-btn', wait: 2000 }, { key: 'Escape', wait: 500 } ] },
      { say: 'Open Advanced options', do: [
        { click: '#advanced-btn', wait: 2200 } ] },
      { say: 'Then press Generate', sub: 'Your image lands in the gallery below', do: [
        { hover: 'text:Generate', wait: 2000 } ] },
    ],
  },
  cinema: {
    route: 'cinema', title: 'Cinema Studio', blurb: 'Direct a cinematic shot: camera, lens and look',
    steps: [
      { say: 'Describe the shot', sub: 'Subject, setting, mood', do: [
        { type: { sel: 'text:Cinema prompt', text: 'A detective walks through rain-soaked neon streets, slow dolly forward', delay: 65 }, wait: 1000 } ] },
      { say: 'Switch between Video and Image output', do: [
        { hover: 'text:Image', wait: 1000 }, { hover: 'text:Video', wait: 1000 } ] },
      { say: 'Open the Builder', sub: 'Camera, lens and style controls', do: [
        { click: 'text:Builder', wait: 2600 } ] },
      { say: 'Fine-tune with Advanced', do: [
        { click: 'text:Advanced', wait: 2200 } ] },
      { say: 'Then press Generate', do: [
        { hover: 'text:GENERATE', wait: 2000 } ] },
    ],
  },
  character: {
    route: 'character', title: 'Character Studio', blurb: 'Consistent characters across every scene',
    steps: [
      { say: 'Describe your character', sub: 'Look, outfit, personality', do: [
        { type: { sel: '#character-prompt-input', text: 'A friendly robot barista with round glasses and a green apron', delay: 65 }, wait: 1000 } ] },
      { say: 'Choose the character model', do: [
        { click: 'text:Flux PuLID', wait: 2200 }, { key: 'Escape', wait: 500 } ] },
      { say: 'Open Advanced options', do: [
        { click: '#char-advanced-btn', wait: 2200 } ] },
      { say: 'Then press Generate Character', do: [
        { hover: 'text:Generate Character', wait: 2000 } ] },
    ],
  },
  commercial: {
    route: 'commercial', title: 'Product Shot Studio', blurb: 'Studio-quality product photos and ads',
    steps: [
      { say: 'Pick a scene preset', sub: 'Studio, marble, outdoor, neon and more', do: [
        { hover: 'text:Luxury marble surface', wait: 900 }, { click: 'text:Luxury marble surface', wait: 1200 },
        { click: 'text:Neon tech showroom', wait: 1200 } ] },
      { say: 'Choose the output format', sub: 'Banner, social post, story, billboard', do: [
        { click: 'text:Story (9:16)', wait: 1200 }, { click: 'text:Social Post (1:1)', wait: 1200 } ] },
      { say: 'Switch to Ad video', do: [
        { click: 'text:Ad video', wait: 1800 }, { click: 'text:Product shot', wait: 1200 } ] },
      { say: 'Open Advanced options', do: [
        { click: '#commercial-advanced-btn', wait: 2200 } ] },
      { say: 'Then press Generate Product Shot', do: [
        { hover: 'text:Generate Product Shot', wait: 2000 } ] },
    ],
  },
  avatar: {
    route: 'avatar', title: 'Avatar Studio', blurb: 'AI avatars and lip sync video',
    steps: [
      { say: 'Pick an avatar model', do: [
        { click: 'text:LTX LipSync', wait: 2200 }, { key: 'Escape', wait: 500 } ] },
      { say: 'Add a portrait and audio', sub: 'Upload, or browse stock', do: [
        { hover: 'text:Reference media', wait: 1200 }, { hover: 'text:Upload audio', wait: 1400 } ] },
      { say: 'Open Advanced options', do: [
        { click: '#avatar-advanced-btn', wait: 2200 } ] },
      { say: 'Then press Generate Avatar Video', do: [
        { hover: 'text:Generate Avatar Video', wait: 2000 } ] },
    ],
  },
  lipsync: {
    route: 'lipsync', title: 'Lip Sync Studio', blurb: 'Animate portraits or sync lips to audio',
    steps: [
      { say: 'Portrait image or video', sub: 'Choose what to animate', do: [
        { click: 'text:Video', wait: 1500 }, { click: 'text:Portrait Image', wait: 1500 } ] },
      { say: 'Add speech audio', do: [ { hover: 'text:AUDIO', wait: 1500 } ] },
      { say: 'Pick the model', do: [ { click: '#ls-model-btn', wait: 2200 }, { key: 'Escape', wait: 500 } ] },
      { say: 'Set the resolution', do: [ { click: '#ls-resolution-btn', wait: 2000 }, { key: 'Escape', wait: 500 } ] },
      { say: 'Then press Generate', do: [ { hover: '#ls-generate-btn', wait: 2000 } ] },
    ],
  },
  upscale: {
    route: 'upscale', title: 'Upscale Studio', blurb: 'Sharpen and enlarge images and video',
    steps: [
      { say: 'Image or video', do: [ { click: 'text:VIDEO', wait: 1500 }, { click: 'text:IMAGE', wait: 1500 } ] },
      { say: 'Pick the upscaler', do: [ { click: 'text:AI Upscaler', wait: 2200 }, { key: 'Escape', wait: 500 } ] },
      { say: 'Open Advanced options', do: [ { click: '#upscale-advanced-btn', wait: 2200 } ] },
      { say: 'Then press Upscale', do: [ { hover: 'text:Upscale Image', wait: 2000 } ] },
    ],
  },
  edit: {
    route: 'edit', title: 'Edit Studio', blurb: 'Twelve AI editing tools in one place',
    steps: [
      { say: 'Pick an editing tool', sub: 'Remove objects, backgrounds, extend, reframe...', do: [
        { hover: 'text:Remove Background', wait: 1400 }, { hover: 'text:Extend Image', wait: 1400 },
        { hover: 'text:AI Edit', wait: 1400 } ] },
      { say: 'Scroll for more tools', sub: 'Dress change, skin, colorize...', do: [
        { scroll: 420, wait: 2200 }, { hover: 'text:Colorize', wait: 1400 } ] },
    ],
  },
  storyboard: {
    route: 'storyboard', title: 'Storyboard Studio', blurb: 'Turn a premise into a scene-by-scene plan',
    steps: [
      { say: 'Write your premise', sub: 'One sentence is enough', do: [
        { type: { sel: '#vi-premise', text: 'A short launch ad for a trail running shoe', delay: 65 }, wait: 1000 } ] },
      { say: 'Choose what to include', sub: 'Images, video, audio', do: [
        { hover: 'text:VIDEO', wait: 1200 }, { hover: 'text:AUDIO', wait: 1200 } ] },
      { say: 'Then press Generate storyboard', do: [ { hover: '#vi-generate-btn', wait: 2000 } ] },
    ],
  },
  templates: {
    route: 'templates', title: 'Templates', blurb: 'Start from a ready-made style',
    steps: [
      { say: 'Search templates', do: [
        { type: { sel: 'ph:Search templates', text: 'product', delay: 90 }, wait: 1400 } ] },
      { say: 'Filter by category', sub: 'Social Media, Commercial, Camera & Cinematic...', do: [
        { click: 'text:Social Media', wait: 1500 }, { click: 'text:Commercial', wait: 1500 } ] },
    ],
  },
  audio: {
    route: 'audio', title: 'Audio Studio', blurb: 'Music, speech and sound effects',
    steps: [
      { say: 'Pick an audio tool', sub: 'Speech, music, sound effects, voice', do: [
        { hover: 'text:Minimax Speech HD', wait: 1200 }, { hover: 'text:Suno Create Music', wait: 1200 },
        { click: 'text:Suno Create Music', wait: 1800 } ] },
      { say: 'Describe the sound', do: [
        { type: { sel: 'text:Audio prompt', text: 'Upbeat electronic track with a warm bassline', delay: 65 }, wait: 1000 } ] },
    ],
  },
  videotools: {
    route: 'videotools', title: 'Video Tools', blurb: 'Upscale, recast and control motion',
    steps: [
      { say: 'Switch tool', sub: 'Tools, Recast, Motion control', do: [
        { click: 'text:Recast', wait: 1800 }, { click: 'text:Motion control', wait: 1800 }, { click: 'text:Tools', wait: 1500 } ] },
      { say: 'Pick the video tool', do: [ { click: 'text:AI Video Upscaler', wait: 2200 }, { key: 'Escape', wait: 500 } ] },
      { say: 'Open Advanced options', do: [ { click: '#vt-advanced-btn', wait: 2200 } ] },
      { say: 'Then press Process Video', do: [ { hover: 'text:Process Video', wait: 2000 } ] },
    ],
  },
  effects: {
    route: 'effects', title: 'Effects', blurb: 'Hundreds of ready-made effects',
    steps: [
      { say: 'Browse effect families', sub: 'Image, video, motion controls', do: [
        { click: 'text:Video Effects', wait: 1800 }, { click: 'text:Motion Controls', wait: 1800 }, { click: 'text:Video FX v2', wait: 1800 } ] },
      { say: 'Search effects', do: [ { type: { sel: 'ph:Search effects', text: 'zoom', delay: 90 }, wait: 1500 } ] },
    ],
  },
};
