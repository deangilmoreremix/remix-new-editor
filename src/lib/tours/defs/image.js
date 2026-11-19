// Tours for the Image group: Image, Edit, Upscale, Character, Product Shot, Brand.
// Generate / Analyze buttons are highlighted, never clicked (they need a key and an entitlement).
import { header } from './util.js';

export default [
  {
    id: 'image', route: 'image', version: 1,
    steps: [
      { title: 'Image Studio', body: 'Turn a prompt into an image with 20+ models. Add a reference image and it becomes image-to-image automatically.', target: header('image'), side: 'bottom' },
      { title: 'Start from a picture (optional)', body: 'Add a reference image to edit or restyle it. Skip this to generate from text alone.', target: ['[data-tour="upload"]', '[data-upload-picker]'], side: 'top' },
      { title: 'Describe what you want', body: 'Write the subject, style and mood. Short and specific works best.', target: ['#i-prompt-textarea', '[aria-label="Image prompt"]'], side: 'top' },
      { title: 'Pick a model', body: 'Different models suit different looks. Open the list to compare them.', target: '#model-btn', side: 'top' },
      { title: 'Shape and size', body: 'Choose the aspect ratio (and quality, if the model offers it).', target: '#ar-btn', side: 'top' },
      { title: 'More controls', body: 'Advanced settings, extra tools and drawing live here.', target: '#advanced-btn', side: 'top' },
      { title: 'Generate', body: 'Press Generate to create your image. Everything you make is saved to your Library automatically.', target: 'button[aria-label="Generate image"]', side: 'top' },
    ],
  },
  {
    id: 'edit', route: 'edit', version: 1,
    steps: [
      { title: 'Edit Studio', body: 'Sixteen single-purpose AI editing tools: remove objects or backgrounds, extend, reframe, face swap, product shots and more.', target: header('edit'), side: 'bottom' },
      { title: 'Choose a tool', body: 'Each card is one job. Pick the one that matches what you want to fix or change.', target: '[data-edit-tool-grid]', side: 'top' },
      { title: 'Open a tool', body: 'Click a card to open its workspace.', target: '[data-edit-tool]', side: 'right' },
      { title: 'Inside a tool', body: 'Add your image, set the few options the tool needs, then press Apply Edit. Use the dropdown at the top to switch tools, and "All tools" to come back here.', target: null },
    ],
  },
  {
    id: 'upscale', route: 'upscale', version: 1,
    steps: [
      { title: 'Upscale Suite', body: 'Enlarge and sharpen an image up to 4x with AI. No prompt needed.', target: header('upscale'), side: 'bottom' },
      { title: 'Choose a method', body: 'Three upscalers with different strengths. Open the list to compare.', target: ['[data-tour="model"]', '[data-studio-action-row] button'], side: 'top' },
      { title: 'Add your image', body: 'Upload the picture you want to enlarge.', target: ['[data-tour="upload"]', '[data-upload-picker]'], side: 'top' },
      { title: 'Scale factor', body: 'Open Advanced to pick how much to enlarge (for upscalers that offer it).', target: '#upscale-advanced-btn', side: 'top' },
      { title: 'Upscale', body: 'Press the button to start. The result appears below, ready to download.', target: 'button[aria-label="Upscale image"]', side: 'top' },
    ],
  },
  {
    id: 'character', route: 'character', version: 1,
    steps: [
      { title: 'Character Studio', body: 'Keep the same face across many images. Upload a reference face and describe each new scene.', target: header('character'), side: 'bottom' },
      { title: 'Choose a model', body: 'Flux PuLID and MiniMax Subject Reference keep a face consistent in different ways.', target: ['[data-tour="model"]'], side: 'top' },
      { title: 'Reference face', body: 'Upload a clear photo of the face to keep.', target: ['[data-tour="upload"]', '[data-upload-picker]'], side: 'top' },
      { title: 'Describe the scene', body: 'Say what the character is doing and where.', target: ['#character-prompt-input', '[aria-label="Character description"]'], side: 'top' },
      { title: 'More controls', body: 'Advanced options for stronger or looser likeness.', target: '#char-advanced-btn', side: 'top' },
      { title: 'Generate', body: 'Press Generate. Try the expression presets below for quick variations.', target: 'button[aria-label="Generate character"]', side: 'top' },
    ],
  },
  {
    id: 'commercial', route: 'commercial', version: 1,
    steps: [
      { title: 'Product Shot Studio', body: 'Studio-quality product photos from one image, or a short ad video.', target: header('commercial'), side: 'bottom' },
      { title: 'Shot or ad video', body: 'Switch between a still product shot and an ad video with a presenter.', target: '[data-commercial-mode]', side: 'bottom' },
      { title: 'Choose a model', body: 'Product Shot or Product Photography, depending on the look you want.', target: ['[data-tour="model"]'], side: 'top' },
      { title: 'Your product', body: 'Upload a clear photo of the product on a plain background.', target: ['[data-tour="upload"]', '[data-upload-picker]'], side: 'top' },
      { title: 'More controls', body: 'Advanced options for the scene and output.', target: '#commercial-advanced-btn', side: 'top' },
      { title: 'Generate', body: 'Press Generate to create the shot.', target: 'button[aria-label="Generate product shot"]', side: 'top' },
    ],
  },
  {
    id: 'brand', route: 'brand', version: 1,
    steps: [
      { title: 'Brand Studio', body: 'Paste your website and SmartVideo learns your brand: colors, logos and voice, then reuses them everywhere.', target: header('brand'), side: 'bottom' },
      { title: 'Your website', body: 'Enter your site address. This is the only thing needed to build your Brand DNA.', target: 'input[aria-label="Website URL"]', side: 'bottom' },
      { title: 'Analyze', body: 'Press Analyze to extract the brand. It needs your API key, and then opens your Brand DNA.', target: 'button[aria-label="Analyze website"]', side: 'bottom' },
      { title: 'Brand tools', body: 'Brand DNA, campaigns, photo studio and animate all use your brand.', target: ['[data-tour="brand-tools"]'], side: 'top' },
    ],
  },
];
