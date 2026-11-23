// Hover-help copy for the creation studios. One flat map: normalized control label -> { name, summary, what?, shortcut? }.
// `summary` shows on hover; `what` appears after the card has been open ~1s. Keys are lower-case with no shortcut suffix or trailing
// punctuation; look entries up through resolveStudioHelp() so labels like "Generate (Ctrl+Enter)" or "Advanced…" still match.
// Controls can also opt in explicitly with data-help="<key>".

import { STUDIO_DESCRIPTIONS } from './../studioDescriptions.js';

const h = (name, summary, what, shortcut) => ({ name, summary, what, shortcut });

/**
 * Studio-level help for a sidebar item or Apps hub card (data-sidebar-item / data-studio = route id): the studio's name and the one-line
 * description the owner wrote for it (lib/studioDescriptions.js, copied from the Apps hub cards). Null when a route has no description.
 */
export function studioEntry(id) {
  const d = STUDIO_DESCRIPTIONS[id];
  return d ? { name: d.name, summary: d.text } : null;
}

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

  // ── Composer and studio chrome (shared by most studios) ─────────────────────
  'pexels': h('Stock photos', 'Browse free stock photos from Pexels.', 'Pick one to use as a reference image.'),
  'thumbnail': h('Thumbnail', 'Generate a custom thumbnail.', 'Creates a thumbnail from your prompt for this result.'),
  'tools': h('Quick starters', 'Starter ideas and the prompt enhancer.', 'Pick a starter prompt, or let AI expand a short one into a detailed prompt.'),
  'more tools': h('More tools', 'Shortcuts to other studios.', 'Send this to Edit, Upscale and other studios.'),
  'prompt gallery': h('Prompt gallery', 'Browse ready-made prompts.'),
  'quick tips': h('Quick tips', 'Show or hide short how-to tips.'),
  'regenerate': h('Regenerate', 'Run it again for a new result.', 'Uses the same prompt and settings.'),
  'new': h('New', 'Start a fresh generation.'),
  'new shot': h('New shot', 'Start a fresh shot.'),
  'publish to social': h('Publish to Social', 'Share the result to your social accounts.'),
  'open in render': h('Open in Render', 'Send this video to the Render studio for final export.'),
  'copy image': h('Copy image', 'Copy the image to your clipboard.'),
  'ask smartvideo': h('Ask SmartVideo', 'Chat with the assistant about this studio.'),
  'start frame': h('Start frame', 'The first frame of the video.'),
  'end frame': h('End frame', 'The last frame of the video.', 'Needs a start frame.'),
  'builder': h('Prompt builder', 'Build a cinematic prompt step by step.'),
  'character lock': h('Character lock', 'Keep the same character across shots.'),
  'character description': h('Character description', 'Describe who the character is.', 'Look, outfit, age and style all help.'),

  'reference media': h('Reference media', 'Upload a reference image or clip.', 'It guides the look, subject or motion of the result.'),
  'reference videos': h('Reference videos', 'Add reference clips.'),
  'reference audios': h('Reference audio', 'Add reference audio.'),
  'upload portrait image': h('Portrait image', 'Upload the photo to make talk.'),
  'image mode': h('Image mode', 'Make a still image.'),
  'video mode': h('Video mode', 'Make a moving shot.'),

  // ── Studio actions ──────────────────────────────────────────────────────────
  'generate character': h('Generate Character', 'Create the character.'),
  'upscale image': h('Upscale Image', 'Enlarge the image and sharpen detail.'),
  'generate product shot': h('Generate Product Shot', 'Create the product photo.'),
  'ad video': h('Ad video', 'Animate the shot into a short ad.'),
  'generate storyboard': h('Generate storyboard', 'Plan the video shot by shot from your idea.'),
  'analyze': h('Analyze', 'Read the website and extract its brand.'),
  'website url': h('Website URL', 'The site to read your brand from.'),

  // ── Effects Studio ──────────────────────────────────────────────────────────
  'effects': h('Effects', 'Browse every effect.'),
  'image effects': h('Image effects', 'One-click effects for still images.'),
  'nano banana': h('Nano Banana', 'Fast image effects.'),
  'kontext effects': h('Kontext effects', 'Context-aware image edits.'),
  'video effects': h('Video effects', 'One-click effects for video clips.'),
  'motion controls': h('Motion controls', 'Camera and subject motion presets.'),
  'video fx v2': h('Video FX v2', 'The second-generation video effects.'),
  'motion graphics': h('Motion graphics', 'Animated titles, shapes and overlays.'),
  'search effects': h('Search effects', 'Filter the effects by name.'),
  'compare': h('Compare', 'View before and after side by side.'),
  'add to library': h('Add to Library', 'Save this to your library.'),
  'insert into timeline': h('Insert into Timeline', 'Add this to the Timeline Editor.'),
  'add layer': h('Add layer', 'Stack another effect on top.'),

  // ── Cinema Templates ────────────────────────────────────────────────────────
  'favorites': h('Favorites', 'Templates you have starred.'),
  'recent': h('Recent', 'Templates you used lately.'),
  'my templates': h('My Templates', 'Templates you created or saved.'),
  'back': h('Back', 'Return to the previous screen.'),

  // ── Option lists and card grids (data-help on the list container or on each option) ──
  'option': h('Option', 'Choose this setting.'),
  'example prompt': h('Example prompt', 'Click to fill the prompt with this example.'),
  'trait option': h('Trait', 'Click to choose this trait.', 'Click again to clear it. Chosen traits feed the generated character.'),
  'trait tag': h('Trait tag', 'A trait you picked.', 'Hover for a preview.'),
  'show more tags': h('Show more', 'Show or hide the rest of the tags.'),
  'builder tab': h('Builder tab', 'Group traits by area.', 'Face, body or style traits.'),
  'content format': h('Content format', 'Size and shape for the platform.', 'Picks the aspect ratio for Instagram, Stories, YouTube or Pinterest.'),
  'scene preset': h('Scene preset', 'The setting for the product shot.', 'Click one to place your product in that scene.'),
  'ad format': h('Ad format', 'Size and shape for the placement.', 'Banner, social post, story or billboard.'),
  'motion idea': h('Motion idea', 'Click to use this motion prompt.'),
  'video source': h('Video source', 'Use a video as the lip sync source.'),
  'shuffle': h('Shuffle', 'Randomize the traits for ideas.'),
  'reset': h('Reset', 'Clear every choice and start over.'),
  'brand tool brand-dna': h('Brand DNA', 'Review and edit your brand identity.', 'Colors, fonts, voice and imagery style the AI follows.'),
  'brand tool campaign': h('Campaigns', 'Create on-brand campaigns.', 'Group assets for one launch.'),
  'brand tool asset-edit': h('Asset Editor', 'Edit campaign assets.'),
  'brand tool photo-studio': h('Photo Studio', 'Create branded photos.'),
  'brand tool animate': h('Animate', 'Animate branded creative assets.'),

  // ── AI VFX ──────────────────────────────────────────────────────────────────
  'vfx effect': h('Effect', 'One-click transformation for your image.', 'Pick an effect, add an image, then press Generate.'),
  'vfx effect group': h('Effect group', 'Switch between AI effects, motion controls and VFX.'),
  'vfx add image': h('Add image', 'Upload the image to transform.', 'Or paste an image URL below.'),

  // ── Plain-text actions found in the studios ─────────────────────────────────
  'process video': h('Process Video', 'Run the selected video tool.'),
  'generate avatar video': h('Generate Avatar Video', 'Create the talking avatar video.'),
  'generate content': h('Generate Content', 'Create the content with this character.'),
  'generate audio': h('Generate Audio', 'Create the audio.'),
  'upload audio': h('Upload audio', 'Use your own audio file.'),
  'find businesses': h('Find businesses', 'Search for prospects to send videos to.'),
  'find my brand': h('Find My Brand', 'Detect your brand from your website.'),
  'refresh': h('Refresh', 'Reload the latest results.'),
  'recast': h('Recast', 'Replace the person in a video with your character.'),
  'motion control': h('Motion control', 'Copy movement from a reference video onto your character.'),
  'upload image': h('Upload image', 'Use your own image.'),
  'from photo studio': h('From Photo Studio', 'Pick an image you made in Photo Studio.'),
  'from campaign asset': h('From campaign asset', 'Pick an asset from one of your campaigns.'),
  'connect personalization': h('Connect Personalization', 'Use your saved brand and contact details.'),
  'animate': h('Animate', 'Bring the image to life.'),

  // ── Viral prompt browser and Storyboard intake (labelled by their control ids) ──
  'viral search': h('Search', 'Find prompts by text, tag or author.', undefined, '/'),
  'viral category': h('Category', 'Filter prompts by category.'),
  'viral model': h('Model', 'Filter prompts by the model they were made with.'),
  'viral sort': h('Sort', 'Order by newest, most popular or most liked.'),
  'viral lang toggle': h('Exclude Chinese', 'Hide prompts written in Chinese.'),
  'viral mobile filters': h('Filters', 'Open the filter panel.'),
  'viral refresh': h('Refresh', 'Reload the prompt list.'),
  'viral export': h('Export', 'Download the prompts you are viewing.'),
  'sheet lang toggle': h('Exclude Chinese', 'Hide prompts written in Chinese.'),
  'sheet apply': h('Apply filters', 'Show the prompts that match.'),
  'personalize this demo': h('Personalize This Demo', 'Make a personalized version of this example.'),
  'create this style': h('Create This Style', 'Open the studio with this prompt and style loaded.'),
  'premise': h('Premise', 'Describe the video idea.', 'The storyboard is planned from this.'),
  'with images': h('With images', 'Also generate a picture for each frame.'),
  'video intent': h('Customize', 'Set type, tone, length and frames.'),
  'start blank': h('Build by hand', 'Skip the plan and add the frames yourself.'),
  'close overlay': h('Close', 'Close this panel.'),
  'sheet model': h('Model', 'Filter prompts by the model they were made with.'),

  // ── One-offs ────────────────────────────────────────────────────────────────
  'quick camera builder': h('Camera builder', 'Pick the camera, lens, focal length and aperture.'),
  'set custom thumbnail': h('Custom thumbnail', 'Upload your own cover image.'),
  'toggle favorite': h('Favorite', 'Star or unstar this template.'),
  'character & reference': h('Character & Reference', 'Keep a character consistent using reference images.'),
  'ai video upscaler': h('AI Video Upscaler', 'Increase video resolution and detail.'),
  'ltltx lipsync': h('Lip sync model', 'The model that syncs the avatar\'s lips to the audio.'),
  'motion prompt': h('Motion prompt', 'Describe the motion or effect.', 'Optional. Leave it blank for automatic motion.'),
  'vfx subject': h('Subject', 'Describe the subject in the image.', 'Optional. It helps the effect target the right thing.'),
  'vfx image url': h('Image URL', 'Paste a link to the image instead of uploading.'),
  'use last frame of a video as i2v source': h('Last frame as source', 'Use the final frame of a video as the starting image.'),
  'upload end frame image for i2v': h('End frame image', 'Upload the image the video should end on.', 'Needs a start frame.'),
  'voice': h('Voice', 'Choose the voice.'),
  'scroll left': h('Scroll left', 'Show earlier items.'),
  'scroll right': h('Scroll right', 'Show more items.'),

  // ── Photo Studio (6 categories x 5 styles; see the page's own header comment) ──
  'photo generation mode': h('Generation mode', 'Switch between Brand API and Direct MuAPI.', 'Direct MuAPI lets you pick a model yourself.'),
  'photo select all': h('Select all', 'Select or clear every style in this category.'),
  'photo brand': h('Brand', 'Choose a saved brand to use its logo.', 'Generation and saved photoshoots follow your choice.'),
  'photo direction': h('Direction', 'Describe the look, mood or specific details you want.'),
  // ── Library ──
  'library filter': h('Filter', 'Show only this kind of item.'),
  'library uploads': h('Uploads', 'Your permanently saved uploaded files.'),
  'library sort': h('Sort', 'Show the newest or the oldest items first.'),
  'search': h('Search', 'Filter the list by what you type.'),
  // ── Motion graphics modes (Edit needs a motion graphic you already generated, per the studio's own message) ──
  'motion graphics generate': h('Generate', 'Create a new motion graphic.'),
  'motion graphics edit': h('Edit', 'Edit a motion graphic you already generated.'),
  // ── Director ──
  'clear chat': h('Clear Chat', 'Clear the conversation.'),
  'send command': h('Send', 'Send your command to the Director.'),
  'command input': h('Command', 'Type what you want the Director to do.'),
  'category filter': h('Category', 'Show only this category.'),
  // ── Render ──
  'render preset': h('Preset', 'A ready-made look for the render.', 'It sets the colour profile, pacing, music mood and caption style.'),
  'trailer cut': h('Trailer Cut', 'Build a teaser or fast-paced trailer version.'),
  'save draft': h('Save Draft', 'Save this render as a draft.'),
  'start render': h('Start Render', 'Start rendering the video.'),
  'export video': h('Export Video', 'Export the finished video.'),
  'download frame': h('Download Frame', 'Download a single frame.'),
  'queue render': h('Queue Render', 'Add this render to the queue.'),
  'duplicate render': h('Duplicate Render', 'Make a copy of this render.'),
  'save as template': h('Save as Template', 'Save this setup as a template.'),
  'send to storyboard': h('Send to Storyboard', 'Send this to the Storyboard studio.'),
  // ── Commercial / Marketing, Brand pages, Academy, Workbench, Zack D ──
  'ad script': h('Ad script', 'Write what the presenter says.', 'Use @image1 for the product and @image2 for the avatar.'),
  'generate ad video': h('Generate Ad Video', 'Create the ad video.'),
  'select avatar': h('Select Avatar', 'Pick the presenter.'),
  'back to brand studio': h('Back to Brand Studio', 'Return to Brand Studio.'),
  'reset progress': h('Reset progress', 'Clear your course progress.'),
  'add your generations': h('Add your generations', 'Bring your generations into the Workbench.'),
  'topic': h('Topic', 'What the video is about.'),
  'high bitrate': h('High bitrate', 'Switch between normal and high bitrate.'),
  'character orientation': h('Character orientation', 'Choose whether the character follows the video or the image.'),
  'motion video': h('Motion video', 'Upload the video whose motion is used.'),
  'character image': h('Character image', 'Upload the character image.'),
  'character images': h('Character images', 'Upload the character images.'),
  'video tools motion transfer': h('Motion transfer', 'Copy the motion from your video onto the character.'),
  'try this prompt': h('Try this prompt', 'Open Image Studio with this prompt filled in.'),
  'update api key': h('Update API Key', 'Update your API key.'),
  'attach image / video / audio': h('Attach', 'Add an image, video or audio file.'),
  'performance direction': h('Performance', 'Describe the performance you want.', 'Optional.'),
  'scene tweaks': h('Scene tweaks', 'Describe any changes to the rebuilt scene.', 'Optional.'),
  'look': h('Look', 'Pick the visual style of the video.'),
};

const SHORTCUT = /\s*\((?:ctrl|cmd|alt|shift|⌘|⌥|⇧)[^)]*\)\s*$/i;

/**
 * Normalize a control label into a STUDIO_HELP key: shortcut suffix "(Ctrl+S)", count badge "(18)", and any leading / trailing
 * icon, emoji or punctuation ("↻ Regenerate", "Generate ✨", "Advanced…") are dropped; case is folded.
 */
export function helpKey(label) {
  return String(label || '')
    .replace(/\s+/g, ' ').trim()
    .replace(SHORTCUT, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .toLowerCase();
}

/**
 * Candidate labels derived from a control id. Studios name their pill buttons consistently ("v-duration-btn", "advanced-btn"), and
 * those buttons show their current value ("5s", "Seedance Lite"), so the id is the only stable name they carry.
 * "v-duration-btn" -> ["v duration", "duration"].
 */
export function idLabels(id) {
  const raw = String(id || '').toLowerCase();
  const base = raw.replace(/-(btn|button|toggle|trigger|pill)$/, '');
  if (!base) return [];
  const full = base.replace(/-/g, ' ');
  const bare = base.replace(/^[a-z]{1,3}-/, '').replace(/-/g, ' ');
  // Also the id with its suffix kept ("viral-lang-toggle"), for entries that name the control exactly.
  return [...new Set([bare, full, raw.replace(/-/g, ' ')])];
}

// Placeholder text is the only label some inputs have. Matched by prefix, since the text is long and sometimes truncated.
const PLACEHOLDERS = [
  [/^describe the motion graphic/, 'prompt'], // must stay ahead of the broader "describe the motion" rule below
  [/^describe the motion/, 'motion prompt'],
  [/^optional: describe the subject/, 'vfx subject'],
  [/^…?or paste an image url/, 'vfx image url'],
  [/^influencer prompt/, 'prompt'],
  [/^search prompts/, 'viral search'],
  [/^show all \d+/, 'prompt gallery'], // "Show all 272 image prompts"
  [/^type your command/, 'command input'],
  [/^describe your ad script/, 'ad script'],
  [/^describe the look, mood/, 'photo direction'],
  [/^describe your motion video/, 'prompt'],
  [/^bitrate: /, 'high bitrate'],
  [/^orientation: /, 'character orientation'],
  [/^optional: describe the performance/, 'performance direction'],
  [/^optional: describe tweaks to the rebuilt scene/, 'scene tweaks'],
  [/^search /, 'search'], // last: the specific "search prompts" rule above wins
];

// Descriptive tooltip sentences the studios already use, mapped to the entry they describe.
export const ALIASES = {
  'select ai generation model': 'model',
  'select model': 'model',
  'generate ai image from prompt': 'generate',
  'generate a custom thumbnail': 'thumbnail',
  'sketch a reference for the model to follow': 'draw',
  'quick starters & prompt enhancer': 'tools',
  'personalize with a discovered contact': 'personalize',
  'more enhancement tools': 'more tools',
  'browse stock photos from pexels': 'pexels',
  'browse stock photos for i2v reference': 'pexels',
  'browse stock videos for v2v input': 'pexels',
  'browse reference scene from pexels': 'pexels',
  'browse prompt gallery': 'prompt gallery',
  'browse ai recipes': 'recipes',
  'image prompt': 'prompt',
  'video prompt': 'prompt',
  'cinema prompt': 'prompt',
  'effect prompt': 'prompt',
  'start f': 'start frame',
  'end f': 'end frame',
  'ar': 'aspect ratio',
  'aspect': 'aspect ratio',
  'aspect_ratio': 'aspect ratio',
  'lip sync prompt': 'prompt',
  'audio prompt': 'prompt',
  'upload audio file': 'upload audio',
};

// "Select / Change / Show ..." prefixes and a trailing "options" are dropped, so "Show advanced options" finds "Advanced".
const VERB = /^(?:select|change|choose|pick|show|hide|open|toggle|set)\s+(?:the\s+|a\s+|an\s+|your\s+)?/;

const lookup = (key) => STUDIO_HELP[key] || STUDIO_HELP[ALIASES[key]] || null;

/** Help entry for a control label, or null. */
export function resolveStudioHelp(label) {
  const key = helpKey(label);
  const direct = lookup(key);
  if (direct) return direct;
  if (/\bpexels\b/.test(key)) return STUDIO_HELP.pexels; // "Browse stock photos / videos / reference scene from Pexels"
  const ph = PLACEHOLDERS.find(([re]) => re.test(key));
  if (ph) return STUDIO_HELP[ph[1]] || null;
  const stripped = key.replace(VERB, '').replace(/\s+options?$/, '');
  return stripped !== key ? lookup(stripped) : null;
}
