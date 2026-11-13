/**
 * Phase 4 porting batch 3a: catalog entries for upstream Remotion templates.
 * Exports ready-to-register entries; `../../catalog.ts` registers them.
 *
 * All twelve come from repo 1 (`free-remotion-templates`, MIT,
 * © 2026 Trimora Inc. / RenderComp). The upstream files are verbatim copies in
 * `../../_upstream/<id>/`; the adapters in this folder only supply props (and,
 * where a frozen upstream cannot be steered by props, a stylesheet scoped to
 * the one design instance — see `./batch3aShared.tsx`).
 *
 *  - Overlays (transparent canvas, no `endFrame`): neon-sign,
 *    gradient-text-sweep, kinetic-word-stack, scramble-text, wave-text.
 *  - Full-scene intro cards (designed brand background, `endFrame` set):
 *    shatter-reveal, typewriter, eye-reveal, pencil-draw, social-reel,
 *    split-screen, community-chat.
 */
import type { RemotionDesignTemplate } from '../../types'
import { batch3aSource } from './batch3aShared'
import { CommunityChatDesign } from './CommunityChatDesign'
import { EyeRevealDesign } from './EyeRevealDesign'
import { GradientTextSweepDesign } from './GradientTextSweepDesign'
import { KineticWordStackDesign } from './KineticWordStackDesign'
import { NeonSignDesign } from './NeonSignDesign'
import { PencilDrawDesign } from './PencilDrawDesign'
import { ScrambleTextDesign } from './ScrambleTextDesign'
import { ShatterRevealDesign } from './ShatterRevealDesign'
import { SocialReelDesign } from './SocialReelDesign'
import { SplitScreenDesign } from './SplitScreenDesign'
import { TypewriterDesign } from './TypewriterDesign'
import { WaveTextDesign } from './WaveTextDesign'

const ALL_RATIOS: RemotionDesignTemplate['aspectRatios'] = ['16:9', '9:16', '1:1', '4:5']

const SCOPED_CSS_NOTE =
  'A stylesheet scoped to this design instance overrides the frozen upstream (see the adapter); ' +
  'it is plain in-DOM CSS, so it applies in the preview and in the browser export alike.'

/** Full-scene placement: fills the frame, plays as an intro, then reveals the video. */
function introPlacement(endFrame: number): RemotionDesignTemplate['placement'] {
  return { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none', endFrame }
}

export const neonSignTemplate: RemotionDesignTemplate = {
  id: 'neon-sign',
  name: 'Neon Sign',
  description: 'Your business name flickers on like a glowing neon sign.',
  category: 'animated-headline',
  source: batch3aSource('src/components/neon-sign/NeonSign.tsx'),
  component: NeonSignDesign,
  defaultProps: { backgroundColor: 'transparent' },
  textSlots: [
    { key: 'signText', field: 'businessName', label: 'Sign text', primary: true, maxLength: 16 },
    { key: 'subText', field: 'offer', label: 'Sub line', maxLength: 40 },
  ],
  colors: [
    { role: 'accent', label: 'Neon glow' },
    { role: 'primary', label: 'Sign frame' },
    { role: 'text', label: 'Sub line' },
  ],
  media: [],
  animation: { durationInFrames: 100, delayInFrames: 0, easing: 'sin-gated flicker, then linear fade' },
  placement: { x: 0.5, y: 0.5, scale: 0.8, opacity: 1, animation: 'fade' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path. CONDITIONAL: the neon glow is two copies of the SVG text ' +
      'under filter: blur(), which must be verified in an exported frame. The sign text is shrunk to ' +
      'fit the sign frame. ' + SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const gradientTextSweepTemplate: RemotionDesignTemplate = {
  id: 'gradient-text-sweep',
  name: 'Gradient Sweep Headline',
  description: 'A bold headline with a shimmering colour sweep and underline.',
  category: 'animated-headline',
  source: batch3aSource('src/components/gradient-text-sweep/GradientTextSweep.tsx'),
  component: GradientTextSweepDesign,
  defaultProps: { backgroundColor: 'transparent' },
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true, maxLength: 32 },
    { key: 'subline', field: 'businessName', label: 'Sub line', maxLength: 28 },
  ],
  colors: [
    { role: 'accent', label: 'Sweep colour' },
    { role: 'text', label: 'Headline colour' },
  ],
  media: [],
  animation: { durationInFrames: 110, delayInFrames: 0, easing: 'spring(damping: 18, stiffness: 90) + looping sheen' },
  placement: { x: 0.5, y: 0.5, scale: 0.8, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path. CONDITIONAL: the sheen uses background-clip: text, which ' +
      'must be verified in an exported frame (if dropped, the headline renders in the plain text ' +
      'colour). A faint accent glow washes the canvas. ' + SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const kineticWordStackTemplate: RemotionDesignTemplate = {
  id: 'kinetic-word-stack',
  name: 'Kinetic Word Stack',
  description: 'Your headline drops in word by word into a punchy stack.',
  category: 'animated-headline',
  source: batch3aSource('src/components/kinetic-word-stack/KineticWordStack.tsx'),
  component: KineticWordStackDesign,
  defaultProps: { backgroundColor: 'transparent' },
  textSlots: [{ key: 'headline', field: 'headline', label: 'Headline', primary: true, maxLength: 40 }],
  colors: [
    { role: 'accent', label: 'Last word' },
    { role: 'text', label: 'Words' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'spring(damping: 13, stiffness: 170) per word' },
  placement: { x: 0.5, y: 0.5, scale: 0.8, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: spring(), transform and text-shadow only. Headlines of ' +
      'more than five words are grouped into five lines. ' + SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const scrambleTextTemplate: RemotionDesignTemplate = {
  id: 'scramble-text',
  name: 'Decrypt Headline',
  description: 'Your headline unscrambles letter by letter, hacker style.',
  category: 'animated-headline',
  source: batch3aSource('src/components/scramble-text/ScrambleText.tsx'),
  component: ScrambleTextDesign,
  defaultProps: { background: 'transparent' },
  textSlots: [
    { key: 'text', field: 'headline', label: 'Headline', primary: true, maxLength: 32 },
    { key: 'label', field: 'businessName', label: 'Label', maxLength: 24 },
  ],
  colors: [
    { role: 'text', label: 'Headline colour' },
    { role: 'accent', label: 'Label colour' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'Easing.out(Easing.ease) left-to-right resolve' },
  placement: { x: 0.5, y: 0.5, scale: 0.8, opacity: 1, animation: 'fade' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: the scramble is seeded and deterministic. The upstream ' +
      'paints an opaque gradient + scanlines even with a transparent background; the adapter clears ' +
      'it so the video shows through. ' + SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const waveTextTemplate: RemotionDesignTemplate = {
  id: 'wave-text',
  name: 'Wave Headline',
  description: 'Each letter of your headline rides a smooth wave.',
  category: 'animated-headline',
  source: batch3aSource('src/components/wave-text/WaveText.tsx'),
  component: WaveTextDesign,
  defaultProps: { background: 'transparent' },
  textSlots: [
    { key: 'text', field: 'headline', label: 'Headline', primary: true, maxLength: 28 },
    { key: 'subText', field: 'businessName', label: 'Sub line', maxLength: 40 },
  ],
  colors: [
    { role: 'text', label: 'Headline colour' },
    { role: 'accent', label: 'Sub line' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'continuous sine wave per character' },
  placement: { x: 0.5, y: 0.5, scale: 0.8, opacity: 1, animation: 'none' },
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: transform only. The upstream fades its canvas to opaque ' +
      'black even with a transparent background; the adapter clears it so the video shows through. ' +
      SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const shatterRevealTemplate: RemotionDesignTemplate = {
  id: 'shatter-reveal',
  name: 'Shatter Reveal',
  description: 'Shards fly together into a bold brand card with your headline.',
  category: 'full-scene',
  source: batch3aSource('src/components/shatter-reveal/ShatterReveal.tsx'),
  component: ShatterRevealDesign,
  textSlots: [
    { key: 'title', field: 'headline', label: 'Headline', primary: true, maxLength: 28 },
    { key: 'subtitle', field: 'businessName', label: 'Sub line', maxLength: 48 },
  ],
  colors: [
    { role: 'primary', label: 'Background & tile' },
    { role: 'accent', label: 'Tile & accent bar' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'Easing.out(Easing.ease) converge + cubic wipe' },
  placement: introPlacement(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: 36 transformed, overflow-clipped fragments, no filters. ' +
      'Plays as a 4-second intro card, then the video plays. ' + SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const typewriterTemplate: RemotionDesignTemplate = {
  id: 'typewriter',
  name: 'Typewriter Intro',
  description: 'A vintage typewriter types out an intro card for your business.',
  category: 'full-scene',
  source: batch3aSource('src/components/typewriter/Typewriter.tsx'),
  component: TypewriterDesign,
  textSlots: [
    { key: 'message', field: 'businessName', label: 'Title', primary: true, maxLength: 28 },
    { key: 'sub', field: 'headline', label: 'Sub line', maxLength: 48 },
  ],
  colors: [
    { role: 'primary', label: 'Background' },
    { role: 'accent', label: 'Ribbon & sub line' },
    { role: 'text', label: 'Title colour' },
  ],
  media: [],
  animation: { durationInFrames: 100, delayInFrames: 0, easing: 'spring(damping: 11, stiffness: 80) + linear carriage' },
  placement: introPlacement(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG rects and spring() only. Plays as a 4-second ' +
      'intro card, then the video plays. ' + SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const eyeRevealTemplate: RemotionDesignTemplate = {
  id: 'eye-reveal',
  name: 'Eye Opener',
  description: 'An eye blinks open to reveal your headline.',
  category: 'full-scene',
  source: batch3aSource('src/components/eye-reveal/EyeReveal.tsx'),
  component: EyeRevealDesign,
  textSlots: [
    { key: 'message', field: 'headline', label: 'Headline', primary: true, maxLength: 28 },
    { key: 'sub', field: 'businessName', label: 'Sub line', maxLength: 48 },
  ],
  colors: [
    { role: 'primary', label: 'Background & lids' },
    { role: 'accent', label: 'Iris' },
    { role: 'text', label: 'Headline colour' },
  ],
  media: [],
  animation: { durationInFrames: 90, delayInFrames: 0, easing: 'Easing.out(Easing.cubic) + spring(damping: 11)' },
  placement: introPlacement(100),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG paths with a clipPath. The clip uses the FIXED ' +
      'SVG id "eyeClip", so only one instance per composition. Plays as a ~3-second intro card, then ' +
      'the video plays. ' + SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const pencilDrawTemplate: RemotionDesignTemplate = {
  id: 'pencil-draw',
  name: 'Pencil Sketch Intro',
  description: 'A pencil sketches a star, then your business name appears.',
  category: 'full-scene',
  source: batch3aSource('src/components/pencil-draw/PencilDraw.tsx'),
  component: PencilDrawDesign,
  textSlots: [
    { key: 'message', field: 'businessName', label: 'Title', primary: true, maxLength: 28 },
    { key: 'sub', field: 'headline', label: 'Sub line', maxLength: 48 },
  ],
  colors: [
    { role: 'primary', label: 'Paper & ink' },
    { role: 'accent', label: 'Pencil' },
  ],
  media: [],
  animation: { durationInFrames: 100, delayInFrames: 0, easing: 'Easing.inOut(Easing.quad) stroke + spring text' },
  placement: introPlacement(110),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: inline SVG path and polygons only. The paper is a light ' +
      'brand tint, so the white credit line is faint on it. Plays as a ~3.5-second intro card, then ' +
      'the video plays. ' + SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const socialReelTemplate: RemotionDesignTemplate = {
  id: 'social-reel',
  name: 'Social Reel Promo',
  description: 'A short-form social video player mock-up that pitches your offer.',
  category: 'full-scene',
  source: batch3aSource('src/components/social-reel/SocialReel.tsx'),
  component: SocialReelDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true, maxLength: 28 },
    { key: 'businessName', field: 'businessName', label: 'Account name', maxLength: 18 },
    { key: 'offer', field: 'offer', label: 'Second line', maxLength: 36 },
    { key: 'cta', field: 'cta', label: 'Button', maxLength: 22 },
    { key: 'phone', field: 'phone', label: 'Phone' },
    { key: 'website', field: 'website', label: 'Website' },
  ],
  colors: [
    { role: 'primary', label: 'Player background' },
    { role: 'accent', label: 'Accent & button' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'Easing.out fades + spring(damping: 20, stiffness: 300) CTA pulse' },
  placement: introPlacement(150),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: gradients, transforms and inline SVG glyphs. The upstream ' +
      'is a fixed 1920x1080 stage; the adapter scales it so the player fills the frame height (it ' +
      'fills the whole frame on 9:16). The upstream\'s hard-coded comment count "318" is hidden by a ' +
      'scoped style rule and the like counter is replaced by "Like"; the "Follow"/"Share" labels stay. Plays as a 5-second intro card.',
  },
  previewCompatible: true,
}

export const splitScreenTemplate: RemotionDesignTemplate = {
  id: 'split-screen',
  name: 'Split Screen Card',
  description: 'Two brand panels wipe in side by side with your name and offer.',
  category: 'full-scene',
  source: batch3aSource('src/components/split-screen/SplitScreen.tsx'),
  component: SplitScreenDesign,
  textSlots: [
    { key: 'headingA', field: 'businessName', label: 'Left heading', primary: true, maxLength: 22 },
    { key: 'subA', field: 'headline', label: 'Left sub line', maxLength: 40 },
    { key: 'headingB', field: 'offer', label: 'Right heading', maxLength: 22 },
    { key: 'subB', field: 'cta', label: 'Right sub line', maxLength: 40 },
  ],
  colors: [
    { role: 'primary', label: 'Left panel' },
    { role: 'accent', label: 'Right panel' },
    { role: 'text', label: 'Text colour' },
  ],
  media: [],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'Easing.out(Easing.ease) clip-path wipes' },
  placement: introPlacement(120),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path: clip-path inset() wipes and transforms. Panels sit side by ' +
      'side on 16:9 and stack on 1:1, 4:5 and 9:16. Plays as a 4-second intro card. ' + SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

export const communityChatTemplate: RemotionDesignTemplate = {
  id: 'community-chat',
  name: 'Community Chat Announcement',
  description: 'Your announcement pops into a 3D team-chat window, message by message.',
  category: 'full-scene',
  source: batch3aSource('src/components/community-chat/CommunityChat.tsx'),
  component: CommunityChatDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'First message', primary: true, maxLength: 90 },
    { key: 'businessName', field: 'businessName', label: 'Workspace & author', maxLength: 24 },
    { key: 'offer', field: 'offer', label: 'Second message', maxLength: 90 },
    { key: 'cta', field: 'cta', label: 'Last message' },
    { key: 'website', field: 'website', label: 'Website' },
    { key: 'phone', field: 'phone', label: 'Phone' },
  ],
  colors: [
    { role: 'primary', label: 'Background' },
    { role: 'accent', label: 'Avatar' },
  ],
  media: [],
  animation: { durationInFrames: 150, delayInFrames: 0, easing: 'spring(damping: 18, stiffness: 110) per message + rotateY drift' },
  placement: introPlacement(150),
  aspectRatios: ALL_RATIOS,
  requiredMedia: [],
  capabilities: {
    preview: true,
    browserExport: true,
    notes:
      'Renders in the browser export path, CONDITIONAL: the window tilts with a CSS perspective + ' +
      'rotateX/rotateY 3D transform, which must be verified in an exported frame. Messages come only ' +
      "from the business's own copy (no invented replies or reaction counts). The window palette and " +
      'placeholder workspace icons are hard-coded upstream. Plays as a 5-second intro card. ' +
      SCOPED_CSS_NOTE,
  },
  previewCompatible: true,
}

/** Batch 3a designs, in registration order. */
export const BATCH_3A_TEMPLATES: RemotionDesignTemplate[] = [
  neonSignTemplate,
  shatterRevealTemplate,
  gradientTextSweepTemplate,
  kineticWordStackTemplate,
  scrambleTextTemplate,
  typewriterTemplate,
  waveTextTemplate,
  eyeRevealTemplate,
  socialReelTemplate,
  splitScreenTemplate,
  communityChatTemplate,
  pencilDrawTemplate,
]

/** Batch 3a designs that hardcode SVG ids (one instance per composition). */
export const BATCH_3A_FIXED_SVG_IDS: Record<string, string[]> = {
  'eye-reveal': ['eyeClip'],
}
