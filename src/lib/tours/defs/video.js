// Tours for the Video group: Video, Cinema, Cinema Templates, Storyboard, Effects, AI VFX, Animate, Lip Sync,
// Video Tools, Avatar, Audio. Generate buttons are highlighted, never clicked.
import { header } from './util.js';

export default [
  {
    id: 'video', route: 'video', version: 1,
    steps: [
      { title: 'Video Studio', body: 'Create AI video from text, images, keyframes or an existing clip, with 15+ models.', target: header('video'), side: 'bottom' },
      { title: 'What are you starting from?', body: 'Text, one image, first and last frame, references, a video to edit or extend. Pick the workflow first; the models and controls follow.', target: ['#v-workflow-btn', '[data-workflow-pill]'], side: 'top' },
      { title: 'Add media', body: 'Upload the image or frames your workflow needs.', target: ['[data-tour="upload"]', '[data-upload-picker]'], side: 'top' },
      { title: 'Describe the shot', body: 'Say what happens: subject, action, camera, mood.', target: ['#v-v-prompt-textarea', '[aria-label="Video prompt"]'], side: 'top' },
      { title: 'Pick a model', body: 'Models differ in length, quality and price. Open the list to compare.', target: '#v-model-btn', side: 'top' },
      { title: 'Shape and length', body: 'Aspect ratio first; duration and resolution appear when the model supports them.', target: '#v-ar-btn', side: 'top' },
      { title: 'Generate', body: 'Press Generate. Video takes a little while; finished clips are saved to your Library.', target: 'button[aria-label="Generate video"]', side: 'top' },
    ],
  },
  {
    id: 'cinema', route: 'cinema', version: 1,
    steps: [
      { title: 'Cinema Studio', body: 'Cinematic shots with real camera, lens, focal length and movement controls.', target: header('cinema'), side: 'bottom' },
      { title: 'Video or image', body: 'Make a moving shot or a still frame.', target: '[data-cinema-mode]', side: 'bottom' },
      { title: 'Add a reference', body: 'Optional: add a character, product or frame to build the shot around. Type @ in the prompt to reference it.', target: ['[data-tour="upload"]', '[data-upload-picker]'], side: 'top' },
      { title: 'Describe the scene', body: 'Describe what happens in the shot.', target: ['textarea[aria-label="Cinema prompt"]', 'textarea[data-studio-prompt]'], side: 'top' },
      { title: 'Model, shape, resolution', body: 'Pick the model, aspect ratio and resolution for the shot.', target: ['[data-tour="model"]'], side: 'top' },
      { title: 'Camera controls', body: 'Open the camera builder to choose camera body, lens, aperture and movement like a cinematographer.', target: ['[data-tour="camera"]', '[data-advanced-label]'], side: 'top' },
      { title: 'Generate', body: 'Press Generate to shoot it.', target: 'button[aria-label="Generate cinema shot"]', side: 'top' },
    ],
  },
  {
    id: 'cinema-template', route: 'cinema-template', version: 1,
    steps: [
      { title: 'Cinema Templates', body: 'Ready-made cinematic templates: pick one, add your media, generate.', target: ['[data-studio-header="cinema-template"]', '.cinema-template-studio h1'], side: 'bottom' },
      { title: 'Favorites, recent, your own', body: 'Filter the list to what you saved or used before.', target: ['#favorites-btn', '#recent-btn'], side: 'bottom' },
      { title: 'Choose a template', body: 'Click a card to open it.', target: ['[data-tour="template-card"]'], side: 'right' },
      { title: 'Fill in the template', body: 'After you pick one: fill in the details, add your images or video, choose a model, then press Generate. Quick mode keeps it simple; Advanced shows every control.', target: null },
    ],
  },
  {
    id: 'storyboard', route: 'storyboard', version: 1,
    steps: [
      { title: 'Storyboard Studio', body: 'Describe a story and an AI plans the shots as an editable board, generates each frame, then sends them on to video.', target: header('storyboard'), side: 'bottom' },
      { title: 'Your story', body: 'Write the premise in a sentence or two.', target: '#vi-premise', side: 'bottom' },
      { title: 'Length and frames', body: 'Optional: set the duration and how many frames you want.', target: '#video-intent-toggle', side: 'bottom' },
      { title: 'Generate the board', body: 'The AI writes the shots as frame cards you can edit, reorder and regenerate.', target: '#vi-generate-btn', side: 'bottom' },
      { title: 'Prefer to build by hand?', body: 'Start with a blank board and add frames yourself.', target: '#start-blank', side: 'bottom' },
    ],
  },
  {
    id: 'effects', route: 'effects', version: 1,
    steps: [
      { title: 'Effects Studio', body: '200+ motion and visual effects for a photo or video, plus a motion-graphics generator.', target: header('effects'), side: 'bottom' },
      { title: 'Effects or motion graphics', body: 'Switch between applying an effect and generating motion graphics.', target: ['[data-tour="mode"]'], side: 'bottom' },
      { title: 'Find an effect', body: 'Search the catalog or browse by category.', target: 'input[placeholder="Search effects..."]', side: 'bottom' },
      { title: 'Pick one', body: 'Click an effect card to select it.', target: ['[data-tour="effects-grid"]'], side: 'top' },
      { title: 'Add your media', body: 'Upload the photo or video to apply it to.', target: ['[data-tour="upload"]', '[data-upload-picker]'], side: 'top' },
      { title: 'Optional prompt', body: 'Some effects need a short description. Follow the placeholder text.', target: ['#fx-prompt-input', '[aria-label="Effect prompt"]'], side: 'top' },
      { title: 'Apply', body: 'Press the button to generate with the selected effect.', target: ['button[aria-label="Generate with the selected effect"]', 'button[aria-label="Apply effect"]'], side: 'top' },
    ],
  },
  {
    id: 'ai-vfx', route: 'ai-vfx', version: 1,
    steps: [
      { title: 'AI VFX Studio', body: 'Camera moves, VFX and AI effects from a single image. Pick an effect, add a picture, get a short video.', target: header('ai-vfx'), side: 'bottom' },
      { title: 'Three effect families', body: 'AI video effects, motion controls and VFX. Switch tabs to browse each.', target: '[data-vfx-tab]', side: 'bottom' },
      { title: 'Pick an effect', body: 'Click a card. The selection shows at the top.', target: '[data-vfx-grid]', side: 'top' },
      { title: 'Your image', body: 'Upload a picture or paste an image link.', target: '[data-vfx-image]', side: 'bottom' },
      { title: 'Settings', body: 'Aspect ratio, duration, resolution and quality.', target: '[data-vfx-control="aspect_ratio"]', side: 'bottom' },
      { title: 'Generate', body: 'Press Generate. The result appears in the results area.', target: '[data-vfx-generate]', side: 'bottom' },
    ],
  },
  {
    id: 'animate', route: 'animate', version: 1,
    steps: [
      { title: 'Animate Studio', body: 'Bring an image, a photoshoot or a campaign asset to life as a 3 to 12 second video.', target: header('animate'), side: 'bottom' },
      { title: 'Where is your image from?', body: 'Upload one, or use a Photo Studio shoot or a campaign asset.', target: ['[data-tour="source"]'], side: 'bottom' },
      { title: 'Add your image', body: 'Upload the picture to animate.', target: ['[data-tour="upload"]', '[data-upload-picker]'], side: 'top' },
      { title: 'Describe the motion', body: 'Optional. Say what should move and how, or tap a suggestion.', target: 'textarea[placeholder^="Describe the motion"]', side: 'top' },
      { title: 'Length and quality', body: 'Choose duration and resolution. The default model is Seedance Lite; you can choose another.', target: ['[data-tour="settings"]'], side: 'top' },
      { title: 'Animate', body: 'Press Animate to create the video.', target: ['[data-tour="generate"]'], side: 'top' },
    ],
  },
  {
    id: 'lipsync', route: 'lipsync', version: 1,
    steps: [
      { title: 'Lip Sync Studio', body: 'Make a portrait talk to your audio, or re-sync an existing video to new audio.', target: header('lipsync'), side: 'bottom' },
      { title: 'Image or video', body: 'Start from a portrait photo or from a video. The controls and models change with this choice.', target: ['[data-tour="mode"]'], side: 'bottom' },
      { title: 'Your portrait or video', body: 'Upload the face to animate.', target: ['button[title="Upload portrait image"]', 'button[title="Upload source video"]'], side: 'top' },
      { title: 'Your audio', body: 'Upload the speech or song the face should say or sing.', target: 'button[title="Upload audio file"]', side: 'top' },
      { title: 'Model', body: 'Models trade off quality, length and price.', target: '#ls-model-btn', side: 'top' },
      { title: 'Generate', body: 'Press Generate to create the lip-synced video.', target: '#ls-generate-btn', side: 'top' },
    ],
  },
  {
    id: 'videotools', route: 'videotools', version: 1,
    steps: [
      { title: 'Video Tools', body: 'Upscale, edit, reframe, translate, caption or remove watermarks from a video. Also Recast and Motion control.', target: header('videotools'), side: 'bottom' },
      { title: 'Three modes', body: 'Tools is the catalog; Recast swaps a character into a motion video; Motion control transfers motion.', target: ['[data-tour="mode"]'], side: 'bottom' },
      { title: 'Choose a tool', body: 'Pick what you want to do to your video.', target: ['[data-tour="model"]'], side: 'top' },
      { title: 'Your video', body: 'Upload the source video.', target: ['[data-video-source-row]', '[data-tour="upload"]'], side: 'top' },
      { title: 'Optional prompt', body: 'Some tools take a short instruction.', target: 'textarea[aria-label="Video processing prompt"]', side: 'top' },
      { title: 'Process', body: 'Press the button to run the tool.', target: 'button[aria-label="Process video"]', side: 'top' },
    ],
  },
  {
    id: 'avatar', route: 'avatar', version: 1,
    steps: [
      { title: 'Avatar Studio', body: 'A talking avatar video from a photo or video plus your audio.', target: header('avatar'), side: 'bottom' },
      { title: 'Choose a model', body: 'Kling Avatar, LTX LipSync, VEED, Creatify and LatentSync each have their own look.', target: ['[data-tour="model"]'], side: 'top' },
      { title: 'Your avatar', body: 'Upload the photo or video of the person.', target: ['[data-tour="upload"]'], side: 'top' },
      { title: 'Your audio', body: 'Upload the voice they should speak.', target: 'button[title="Upload audio"]', side: 'top' },
      { title: 'Direction (optional)', body: 'Describe the animation you want.', target: ['textarea[aria-label="Avatar prompt"]'], side: 'top' },
      { title: 'Generate', body: 'Press Generate to create the avatar video.', target: 'button[aria-label="Generate avatar video"]', side: 'top' },
    ],
  },
  {
    id: 'audio', route: 'audio', version: 1,
    steps: [
      { title: 'Audio Studio', body: 'Generate music, speech and sound effects, then trim and fade them in the built-in player.', target: header('audio'), side: 'bottom' },
      { title: 'Pick a model', body: 'The model decides what you can make (music, speech, effects) and which controls appear.', target: ['[data-tour="model"]'], side: 'right' },
      { title: 'Describe the sound', body: 'Say what you want to hear, or paste the text to speak.', target: 'textarea[aria-label="Audio prompt"]', side: 'top' },
      { title: 'Fine-tune', body: 'Speed and pitch live under Advanced. Style, duration and voice appear when the model supports them.', target: '#audio-advanced-btn', side: 'top' },
      { title: 'Generate', body: 'Press Generate. Your result opens in the player with trim and fade controls.', target: 'button[aria-label="Generate audio"]', side: 'top' },
    ],
  },
];
