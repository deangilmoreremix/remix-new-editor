/**
 * Catalog entries for the full-screen scenes (`role: 'scene'`).
 *
 * Scenes play as the video's opening or closing seconds and keep their own
 * background, so they were rejected as overlays in Phase 1 (see
 * `docs/REMOTION_TEMPLATE_INVENTORY.md` §7.1) but fit here. This module
 * exports ready-to-register entries and registers nothing by itself.
 */

import { BRITO_ATTRIBUTION } from './batch3d/britoShared'
import type { RemotionDesignTemplate } from '../types'
import {
  FireworksSceneDesign,
  GradientSweepSceneDesign,
  KineticWordsSceneDesign,
  NeonSignSceneDesign,
  ShatterSceneDesign,
  TypewriterSceneDesign,
} from './sceneDesigns'
import { KineticTextSceneDesign, LogoIntroSceneDesign, SlideInBarDesign } from './britoDesigns'
import {
  CinematicTitleSceneDesign,
  HighlightWordsSceneDesign,
  LogoTypewriterSceneDesign,
  QuoteCardSceneDesign,
} from './rveSceneDesigns'
import { RVE_ATTRIBUTION } from './rveSharedDesign'

const REPOSITORY = 'free-remotion-templates'
const REPOSITORY_URL = 'https://github.com/deangilmoreremix/free-remotion-templates'
const ATTRIBUTION =
  '© 2026 Trimora Inc. — Remotion templates by RenderComp (free-remotion-templates), MIT License. https://github.com/RenderComp/free-remotion-templates'

function source(sourcePath: string): RemotionDesignTemplate['source'] {
  return { repository: REPOSITORY, repositoryUrl: REPOSITORY_URL, sourcePath, license: 'MIT', attribution: ATTRIBUTION }
}

const SCENE_CAPABILITIES: RemotionDesignTemplate['capabilities'] = {
  preview: true,
  browserExport: true,
  notes: 'Full-screen scene: keeps its own background (the darkened primary brand colour) for its time window.',
}

/** Shared fields every scene entry carries. */
const SCENE_BASE = {
  role: 'scene' as const,
  defaultProps: {},
  media: [],
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'fade' as const },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'] as RemotionDesignTemplate['aspectRatios'],
  requiredMedia: [],
  capabilities: SCENE_CAPABILITIES,
  previewCompatible: true,
}

export const gradientSweepSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-gradient-text-sweep',
  name: 'Gradient Sweep',
  description: 'Your headline in huge letters with a light sweep across it.',
  category: 'animated-headline',
  source: source('src/components/gradient-text-sweep/GradientTextSweep.tsx'),
  component: GradientSweepSceneDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true },
    { key: 'businessName', field: 'businessName', label: 'Small line' },
  ],
  colors: [{ role: 'primary', label: 'Background' }, { role: 'accent', label: 'Sweep' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 60, delayInFrames: 0, easing: 'spring entrance + linear sweep' },
  sceneDurationInFrames: 110,
  posterFrame: 70,
}

export const kineticWordsSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-kinetic-word-stack',
  name: 'Kinetic Words',
  description: 'Your headline stacks up word by word.',
  category: 'animated-headline',
  source: source('src/components/kinetic-word-stack/KineticWordStack.tsx'),
  component: KineticWordsSceneDesign,
  textSlots: [{ key: 'headline', field: 'headline', label: 'Headline (up to 5 words)', primary: true }],
  colors: [{ role: 'primary', label: 'Background' }, { role: 'accent', label: 'Highlight' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 80, delayInFrames: 0, easing: 'staggered springs' },
  sceneDurationInFrames: 120,
  posterFrame: 95,
}

export const neonSignSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-neon-sign',
  name: 'Neon Sign',
  description: 'Your business name flickers on as a glowing neon sign.',
  category: 'logo-reveal',
  source: source('src/components/neon-sign/NeonSign.tsx'),
  component: NeonSignSceneDesign,
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Sign text', primary: true },
    { key: 'headline', field: 'headline', label: 'Line underneath' },
  ],
  colors: [{ role: 'primary', label: 'Wall' }, { role: 'accent', label: 'Glow' }, { role: 'text', label: 'Neon' }],
  animation: { durationInFrames: 70, delayInFrames: 0, easing: 'flicker on' },
  sceneDurationInFrames: 100,
  posterFrame: 85,
}

export const shatterSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-shatter-reveal',
  name: 'Shatter Reveal',
  description: 'Pieces fly together to reveal your business name.',
  category: 'logo-reveal',
  source: source('src/components/shatter-reveal/ShatterReveal.tsx'),
  component: ShatterSceneDesign,
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Title', primary: true },
    { key: 'headline', field: 'headline', label: 'Subtitle' },
  ],
  colors: [{ role: 'primary', label: 'Pieces' }, { role: 'accent', label: 'Accent' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 90, delayInFrames: 0, easing: 'converging pieces' },
  sceneDurationInFrames: 120,
  posterFrame: 100,
}

export const fireworksSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-fireworks-burst',
  name: 'Fireworks Finale',
  description: 'Fireworks in your brand colors behind your call to action.',
  category: 'promo-cta',
  source: source('src/components/fireworks-burst/FireworksBurst.tsx'),
  component: FireworksSceneDesign,
  textSlots: [
    { key: 'cta', field: 'cta', label: 'Big message', primary: true },
    { key: 'businessName', field: 'businessName', label: 'Small line' },
  ],
  colors: [{ role: 'primary', label: 'Fireworks' }, { role: 'accent', label: 'Sparks' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 80, delayInFrames: 0, easing: 'bursts' },
  sceneDurationInFrames: 110,
  posterFrame: 80,
}

export const typewriterSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-typewriter',
  name: 'Typewriter',
  description: 'A typewriter types out your headline.',
  category: 'animated-headline',
  source: source('src/components/typewriter/Typewriter.tsx'),
  component: TypewriterSceneDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Typed message', primary: true },
    { key: 'businessName', field: 'businessName', label: 'Small line' },
  ],
  colors: [{ role: 'primary', label: 'Background' }, { role: 'accent', label: 'Ribbon' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 80, delayInFrames: 0, easing: 'typing' },
  sceneDurationInFrames: 100,
  posterFrame: 90,
}

const BRITO_REPOSITORY_URL = 'https://github.com/deangilmoreremix/remotion-video-templates'
function britoSource(sourcePath: string): RemotionDesignTemplate['source'] {
  return {
    repository: 'remotion-video-templates',
    repositoryUrl: BRITO_REPOSITORY_URL,
    sourcePath,
    license: 'MIT',
    attribution: BRITO_ATTRIBUTION,
  }
}

export const logoIntroSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-logo-intro',
  name: 'Logo Burst',
  description: 'Your logo pops in with a burst of brand-colored particles.',
  category: 'logo-reveal',
  source: britoSource('src/templates/LogoIntro/LogoIntro.tsx'),
  component: LogoIntroSceneDesign,
  textSlots: [],
  media: [{ role: 'logo', label: 'Logo', required: true }],
  requiredMedia: ['logo'],
  colors: [{ role: 'primary', label: 'Brand' }, { role: 'accent', label: 'Particles' }],
  animation: { durationInFrames: 60, delayInFrames: 0, easing: 'BOUNCE spring + particle burst' },
  sceneDurationInFrames: 90,
  posterFrame: 70,
}

export const kineticTextSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-kinetic-text',
  name: 'Kinetic Story',
  description: 'Your headline plays out line by line, ending on your business name.',
  category: 'animated-headline',
  source: britoSource('src/templates/KineticText/KineticText.tsx'),
  component: KineticTextSceneDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Headline', primary: true },
    { key: 'businessName', field: 'businessName', label: 'Final line' },
  ],
  colors: [{ role: 'primary', label: 'Background' }, { role: 'accent', label: 'Final line' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 120, delayInFrames: 0, easing: 'SNAPPY springs per word' },
  sceneDurationInFrames: 150,
  posterFrame: 30,
}

/** Overlay: a lower-third card that slides in and stays. */
export const slideInBarTemplate: RemotionDesignTemplate = {
  id: 'rvt-slide-in-bar',
  name: 'Name Card',
  description: 'A clean white name card with an accent bar slides in at the bottom.',
  category: 'lower-third',
  source: britoSource('src/templates/LowerThirds/styles.tsx'),
  component: SlideInBarDesign,
  defaultProps: {},
  textSlots: [
    { key: 'businessName', field: 'businessName', label: 'Name', primary: true },
    { key: 'headline', field: 'headline', label: 'Second line' },
  ],
  colors: [{ role: 'accent', label: 'Accent bar' }],
  media: [],
  animation: { durationInFrames: 14, delayInFrames: 0, easing: 'SNAPPY spring' },
  // Full frame: the card positions itself inside the upstream safe area.
  placement: { x: 0.5, y: 0.5, scale: 1, opacity: 1, animation: 'none' },
  aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
  requiredMedia: [],
  capabilities: { preview: true, browserExport: true, notes: 'Plain CSS card; the exit is held off for the whole video.' },
  previewCompatible: true,
  posterFrame: 30,
}

function rveSceneSource(file: string): RemotionDesignTemplate['source'] {
  return {
    repository: 'remotion-templates',
    repositoryUrl: 'https://github.com/deangilmoreremix/remotion-templates',
    sourcePath: `templates/${file}`,
    license: 'MIT',
    attribution: RVE_ATTRIBUTION,
  }
}

export const cinematicTitleSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-rve-cinematic-title',
  name: 'Cinematic Title',
  description: 'Your headline rises in like a film title, with a brand-colored underline.',
  category: 'animated-headline',
  source: rveSceneSource('cinematic-title-intro.tsx'),
  component: CinematicTitleSceneDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Title', primary: true },
    { key: 'businessName', field: 'businessName', label: 'Subtitle' },
  ],
  colors: [{ role: 'primary', label: 'Background' }, { role: 'accent', label: 'Underline' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 60, delayInFrames: 0, easing: 'spring rise + underline draw' },
  sceneDurationInFrames: 100,
  posterFrame: 70,
}

export const logoTypewriterSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-rve-logo-typewriter',
  name: 'Logo Typewriter',
  description: 'Your logo pops in and your business name types out beside it.',
  category: 'logo-reveal',
  source: rveSceneSource('logo-typewriter.tsx'),
  component: LogoTypewriterSceneDesign,
  textSlots: [{ key: 'businessName', field: 'businessName', label: 'Typed name', primary: true }],
  media: [{ role: 'logo', label: 'Logo' }],
  colors: [{ role: 'primary', label: 'Background' }, { role: 'accent', label: 'Cursor' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 90, delayInFrames: 0, easing: 'typing at 0.15 chars/frame' },
  sceneDurationInFrames: 120,
  posterFrame: 110,
}

export const highlightWordsSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-rve-text-highlight',
  name: 'Highlight Words',
  description: 'Each word of your headline gets a brand-colored highlight in turn.',
  category: 'animated-headline',
  source: rveSceneSource('text-highlight.tsx'),
  component: HighlightWordsSceneDesign,
  textSlots: [{ key: 'headline', field: 'headline', label: 'Headline (up to 7 words)', primary: true }],
  colors: [{ role: 'primary', label: 'Background' }, { role: 'accent', label: 'Highlight' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 90, delayInFrames: 0, easing: 'one word every 0.6s' },
  sceneDurationInFrames: 120,
  posterFrame: 110,
}

export const quoteCardSceneTemplate: RemotionDesignTemplate = {
  ...SCENE_BASE,
  id: 'scene-rve-quote-card',
  name: 'Quote Card',
  description: 'Your headline as a big quote, signed with your business name.',
  category: 'promo-cta',
  source: rveSceneSource('quote-card.tsx'),
  component: QuoteCardSceneDesign,
  textSlots: [
    { key: 'headline', field: 'headline', label: 'Quote', primary: true },
    { key: 'businessName', field: 'businessName', label: 'Signed by' },
  ],
  colors: [{ role: 'primary', label: 'Background' }, { role: 'accent', label: 'Quote mark' }, { role: 'text', label: 'Text' }],
  animation: { durationInFrames: 45, delayInFrames: 0, easing: 'fades' },
  sceneDurationInFrames: 105,
  posterFrame: 80,
}

/** The Phase 3 entries: the full-screen scenes, then the Name Card overlay. */
export const SCENE_CATALOG_ENTRIES: RemotionDesignTemplate[] = [
  logoIntroSceneTemplate,
  kineticTextSceneTemplate,
  gradientSweepSceneTemplate,
  kineticWordsSceneTemplate,
  neonSignSceneTemplate,
  shatterSceneTemplate,
  fireworksSceneTemplate,
  typewriterSceneTemplate,
  cinematicTitleSceneTemplate,
  logoTypewriterSceneTemplate,
  highlightWordsSceneTemplate,
  quoteCardSceneTemplate,
  slideInBarTemplate,
]
