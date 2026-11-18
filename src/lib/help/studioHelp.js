// Hover-help copy for the creation studios. One flat map: normalized control label -> { name, summary, what?, shortcut? }.
// `summary` shows on hover; `what` appears after the card has been open ~1s. Keys are lower-case with no shortcut suffix or trailing
// punctuation; look entries up through resolveStudioHelp() so labels like "Generate (Ctrl+Enter)" or "Advanced…" still match.
// Controls can also opt in explicitly with data-help="<key>".

const h = (name, summary, what, shortcut) => ({ name, summary, what, shortcut });

export const STUDIO_HELP = {
  // ── Shared controls ─────────────────────────────────────────────────────────
  'model': h('Model', 'Picks the AI model.', 'Different models trade speed, cost and style. The credit cost updates when you switch.'),
  'aspect ratio': h('Aspect Ratio', 'Frame shape of the result.', '16:9 suits YouTube, 9:16 suits Reels, TikTok and Shorts, and 1:1 suits feed posts.'),
  'resolution': h('Resolution', 'Output sharpness.', 'Higher resolution looks better but costs more credits and takes longer.'),
  'duration': h('Duration', 'Clip length in seconds.', 'Longer clips cost more credits and take longer to generate.'),
  'quality': h('Quality', 'Speed versus detail.', 'Standard is faster and cheaper. High takes longer and renders finer detail.'),
  'seed': h('Seed', 'Fixes the randomness.', 'Reuse a seed to reproduce a result. Leave it blank for a different result each time.'),
  'negative prompt': h('Negative Prompt', 'Things to keep out of the result.', 'For example: blurry, extra fingers, watermark.'),
  'prompt': h('Prompt', 'Describe what you want.', 'Subject, setting, lighting and style give the best results.'),
  'reference images': h('Reference Images', 'Guide the look with images.', 'Upload images to steer style, character or composition.'),
  'advanced': h('Advanced', 'Extra settings for fine control.', 'The defaults work for most jobs.'),
  'less': h('Advanced', 'Hide the extra settings.'),
  'effect': h('Effect', 'Apply a preset look or motion.', 'Pick an effect to apply to the result.'),
  'draw': h('Draw', 'Sketch to guide the AI.', 'Draw on the image to show exactly where something should change.'),
  'generate': h('Generate', 'Run the job.', 'The credit cost is shown before you commit.'),
  'download': h('Download', 'Save the result to your device.'),
  'save': h('Save', 'Keep this in your library.'),
  'copy link': h('Copy link', 'Copy a shareable link.'),
  'undo': h('Undo', 'Step back one change.', undefined, 'Ctrl+Z'),
  'redo': h('Redo', 'Step forward one change.', undefined, 'Ctrl+Shift+Z'),

  // ── Image Studio ────────────────────────────────────────────────────────────
  'text to image': h('Text to Image', 'Turn a description into a new image.'),
  'image to image': h('Image to Image', 'Rework an uploaded image.', 'Restyle or change an image while keeping its structure.'),
  'swap face': h('Swap Face', 'Put a chosen face on another image.'),
  'style preset': h('Style Preset', 'One-click art direction.', 'Photoreal, anime, cinematic and more.'),
  'batch count': h('Batch Count', 'How many variations to make at once.'),
  'reference strength': h('Reference Strength', 'How closely to follow the reference.', 'Low is loose inspiration. High is a near copy.'),
  'personalize': h('Personalize', 'Apply your saved character or brand look.'),

  // ── Edit Studio ─────────────────────────────────────────────────────────────
  'ai edit': h('AI Edit', 'Change an image with a text instruction.'),
  'remove object': h('Remove Object', 'Erase something cleanly.', 'Paint over the object and the background is filled in.'),
  'remove background': h('Remove Background', 'Cut the subject out on a transparent background.'),
  'extend image': h('Extend Image', 'Grow the canvas.', 'The new area is filled to match the original.'),
  'reframe': h('Reframe', 'Re-crop to a new aspect ratio.', 'Missing areas are filled in.'),
  'change dress': h('Change Dress', 'Swap the outfit.', 'Upload an outfit image to apply it.'),
  'enhance skin': h('Enhance Skin', 'Natural skin retouching without the plastic look.'),
  'colorize': h('Colorize', 'Add color to black-and-white photos.'),
  'add watermark': h('Add Watermark', 'Place a logo or text.', 'Opacity, position and size control how it sits.'),
  'upscale': h('Upscale', 'Increase resolution and detail.'),
  'face swap': h('Face Swap', 'Replace a face.', 'Target Face Index picks which face when several are present.'),
  'product shot': h('Product Shot', 'Place a product in a clean, styled scene.'),
  'ghibli style': h('Ghibli Style', 'Repaint the photo in a soft hand-drawn look.'),
  'change angle': h('Change Angle', 'Re-render the subject from a new camera angle.'),
  'photo effects': h('Photo Effects', 'Film, glow and mood effects.'),

  // ── Upscale / Character ─────────────────────────────────────────────────────
  'ai upscaler': h('AI Upscaler', 'Balanced all-round upscaling.'),
  'topaz upscale': h('Topaz Upscale', 'Best for photos and faces.'),
  'seed upscale': h('Seed Upscale', 'Adds new detail to soft or AI-made images.'),
  '2x': h('2x', 'Double the size.'),
  '4x': h('4x', 'Four times the size.', 'Slower and costs more.'),
  'flux pulid': h('Flux PuLID', 'Keeps a face consistent across scenes.'),
  'subject reference': h('Subject Reference', 'Locks identity from a reference photo.'),

  // ── Video Studio ────────────────────────────────────────────────────────────
  'text to video': h('Text to Video', 'Describe a scene and get a clip.'),
  'animate image': h('Animate image', 'Bring a still image to life.'),
  'image to video': h('Image to Video', 'Bring a still image to life.'),
  'keyframes': h('Start & end frames', 'Set the first and last frame.', 'The AI fills in the motion between them.'),
  'start & end frames': h('Start & end frames', 'Set the first and last frame.', 'The AI fills in the motion between them.'),
  'use references': h('Use references', 'Guide style or characters with images.'),
  'edit video': h('Edit video', 'Change a clip with text instructions.'),
  'extend video': h('Extend video', 'Add more seconds to an existing clip.'),
  'continue this video': h('Continue this video', 'Add more seconds to this clip.'),
  'transfer motion': h('Transfer motion', 'Copy movement from one video onto your character.'),
  'motion style': h('Motion style', 'Overall movement feel, from calm to dynamic.'),
  'workflow': h('Workflow', 'Preset recipes for common outputs.'),

  // ── Cinema Studio ───────────────────────────────────────────────────────────
  'camera': h('Camera', 'The camera body that sets the look.', 'Sensor and grain character.'),
  'lens': h('Lens', 'Lens character.', 'Wide, anamorphic and more.'),
  'focal length': h('Focal length', 'Wider shows more.', 'Longer focal lengths compress the scene and isolate the subject.'),
  'aperture': h('Aperture', 'Depth of field.', 'A low f-number gives a blurrier background.'),
  'shoot': h('Shoot', 'Generate the shot.'),
  'copy prompt': h('Copy prompt', 'Copy the final prompt text.'),
  'fullscreen preview': h('Fullscreen Preview', 'View the result full size.'),

  // ── Lip Sync / Motion ───────────────────────────────────────────────────────
  'portrait image': h('Portrait Image', 'The still photo to make talk.'),
  'sync lip': h('Sync Lip', 'Run the lip sync.'),
  'swap body': h('Swap Body', 'Replace the person in the video.'),

  // ── Storyboard ──────────────────────────────────────────────────────────────
  'compare frames': h('Compare frames', 'View two frames side by side.'),
  'random seed': h('Random seed', 'Reroll a frame.'),
  'save project': h('Save project', 'Save the whole storyboard.', undefined, 'Ctrl+S'),
  'gtm boost': h('GTM Boost', 'Marketing angles for your concept.'),
  'monetize': h('Monetize', 'Revenue angles for your concept.'),
  'recipes': h('Recipes', 'Saved prompt starters.'),
  'prompts': h('Prompts', 'Saved prompt starters.'),

  // ── Audio / Clipping ────────────────────────────────────────────────────────
  'generate track': h('Generate Track', 'Create the audio.'),
  'lyrics': h('Lyrics / Prompt', 'Words to sing, or a style description.'),
  'max highlights': h('Max Highlights', 'Upper limit of clips to pull out.'),
  'coordinates only': h('Coordinates Only', 'Return timestamps without cutting the video.'),
};

const SHORTCUT = /\s*\((?:ctrl|cmd|alt|shift|⌘|⌥|⇧)[^)]*\)\s*$/i;

/** Normalize a control label into a STUDIO_HELP key. */
export function helpKey(label) {
  return String(label || '').replace(/\s+/g, ' ').trim().replace(SHORTCUT, '').replace(/[….:]+$/, '').trim().toLowerCase();
}

/** Help entry for a control label, or null. */
export function resolveStudioHelp(label) {
  return STUDIO_HELP[helpKey(label)] || null;
}
