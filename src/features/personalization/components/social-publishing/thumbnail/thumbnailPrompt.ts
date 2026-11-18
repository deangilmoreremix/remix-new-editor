import { isAllowedImageSize } from '@ohb/lib/openaiImageOptions';

/**
 * Pure helpers behind the thumbnail concept panel: the brief model, the concept
 * presets, size validation and the function that turns creative controls into
 * prompt text. Exact colours and gradients are NOT left to the model: they are
 * returned by deriveCanvasAdjustments for the canvas compositor (Phase 2).
 */

export type ConceptPresetId =
  | 'host-headline'
  | 'product-hero'
  | 'before-after'
  | 'comparison'
  | 'tutorial-screenshot'
  | 'cinematic'
  | 'minimal';

export interface ConceptPreset {
  id: ConceptPresetId;
  label: string;
  description: string;
  /** Prompt fragment: focal point, subject placement and headline space. */
  fragment: string;
}

export const CONCEPT_PRESETS: readonly ConceptPreset[] = [
  {
    id: 'host-headline',
    label: 'Host + headline',
    description: 'Expressive presenter beside a big headline area',
    fragment:
      'Concept: host plus headline. Focal point is the presenter\'s face and upper body, large in frame and sharply lit; the opposite side of the frame stays calm and uncluttered as a large area for a short headline.',
  },
  {
    id: 'product-hero',
    label: 'Product hero',
    description: 'One product, big and glossy',
    fragment:
      'Concept: product hero. Focal point is a single product shown large with crisp edges, dramatic key light and a soft shadow; supporting elements are minimal and the frame keeps a clear band of space for a headline.',
  },
  {
    id: 'before-after',
    label: 'Before / after',
    description: 'Split frame showing the change',
    fragment:
      'Concept: before and after. The frame is split down the middle into two halves of equal weight, the left showing the "before" state and the right the clearly improved "after" state, with a strong visual divider and a headline area along the top or bottom edge.',
  },
  {
    id: 'comparison',
    label: 'Side-by-side comparison',
    description: 'Two options facing off',
    fragment:
      'Concept: side-by-side comparison. Two subjects or options face each other on the left and right with matching scale and contrasting colour accents, a small versus cue between them, and headline space along the top.',
  },
  {
    id: 'tutorial-screenshot',
    label: 'Tutorial screenshot',
    description: 'Screen capture with callouts',
    fragment:
      'Concept: tutorial screenshot. Focal point is a clean, legible screen capture on one side with one bold arrow or highlight callout on the key element; a presenter or icon may sit in a corner, and the other side is kept free for a headline.',
  },
  {
    id: 'cinematic',
    label: 'Cinematic still',
    description: 'Movie-poster mood and lighting',
    fragment:
      'Concept: cinematic still. Wide-screen movie-poster composition with a strong focal point on the rule of thirds, dramatic directional lighting, atmospheric depth, and darker negative space reserved for a headline.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'One subject, lots of space',
    fragment:
      'Concept: minimal. One small, clear subject on a plain uncluttered background with generous negative space and no decorative elements; the focal point is obvious at a glance and a large area is left empty for a headline.',
  },
];

export const getConceptPreset = (id: ConceptPresetId): ConceptPreset =>
  CONCEPT_PRESETS.find((p) => p.id === id) ?? CONCEPT_PRESETS[0];

export type ReferenceRole = 'person' | 'product' | 'lighting' | 'style' | 'layout' | 'source';

export const REFERENCE_ROLES: readonly { id: ReferenceRole; label: string; instruction: string }[] = [
  { id: 'person', label: 'Use this person', instruction: 'Use this person exactly: keep the same face, identity, hair and skin tone' },
  { id: 'product', label: 'Use this product', instruction: 'Use this product exactly: keep its shape, colours, logo and details unchanged' },
  { id: 'lighting', label: 'Match this lighting', instruction: 'Match this lighting: copy its light direction, colour temperature and contrast, not its content' },
  { id: 'style', label: 'Style reference', instruction: 'Style reference: borrow its overall look, palette and mood, not its content' },
  { id: 'layout', label: 'Layout sketch', instruction: 'Layout sketch: follow its arrangement of shapes and placement of elements, not its rendering' },
  { id: 'source', label: 'Source image', instruction: 'Source image this thumbnail is for: keep its subject and look recognisable' },
];

export const getReferenceRole = (id: ReferenceRole) => REFERENCE_ROLES.find((r) => r.id === id) ?? REFERENCE_ROLES[0];

export type SubjectKind = 'none' | 'person' | 'product';
export type Placement = 'left' | 'center' | 'right';
export type Crop = 'close-up' | 'medium' | 'wide';
export type Level3 = 'low' | 'normal' | 'high';

export interface SubjectControls {
  kind: SubjectKind;
  placement: Placement;
  crop: Crop;
  /** Where the subject looks; ignored for products. */
  gaze: 'camera' | 'left' | 'right' | 'up' | 'down';
  expression: 'neutral' | 'happy' | 'surprised' | 'serious' | 'excited';
  pose: string;
  /** Share of the frame height the subject fills, 20-100. */
  scale: number;
  outline: 'none' | 'white' | 'glow';
  /** Subject photo is a reference with role "Use this person/product exactly". */
  useOriginal: boolean;
}

export interface BackgroundControls {
  mode: 'scene' | 'solid' | 'gradient';
  scene: string;
  solidColor: string;
  gradientFrom: string;
  gradientTo: string;
  blur: 'none' | 'soft' | 'strong';
  palette: string;
  lighting: 'natural' | 'studio' | 'dramatic' | 'neon' | 'golden-hour' | 'soft';
  contrast: Level3;
  saturation: Level3;
  depth: 'flat' | 'shallow' | 'deep';
  style: 'photoreal' | 'cinematic' | 'illustration' | '3d-render' | 'graphic';
}

export interface BriefReference {
  role: ReferenceRole;
  /** Short label shown to the user, used in the prompt when present. */
  label?: string;
}

export interface ThumbnailBrief {
  title: string;
  topic: string;
  audience: string;
  viewerSees: string;
  presetId: ConceptPresetId;
  subject: SubjectControls;
  background: BackgroundControls;
  /** In the same order as the reference images sent with the request. */
  references: BriefReference[];
}

export interface CanvasAdjustments {
  /** Exact flat background colour (hex), applied in the canvas. */
  backgroundColor?: string;
  gradient?: { from: string; to: string; angle: number };
  /** Gaussian blur radius in px for the background layer. */
  backgroundBlurPx: number;
  /** 1 = unchanged. */
  contrast: number;
  saturation: number;
}

export const DEFAULT_SUBJECT: SubjectControls = {
  kind: 'person',
  placement: 'left',
  crop: 'medium',
  gaze: 'camera',
  expression: 'excited',
  pose: '',
  scale: 70,
  outline: 'none',
  useOriginal: false,
};

export const DEFAULT_BACKGROUND: BackgroundControls = {
  mode: 'scene',
  scene: '',
  solidColor: '#0f172a',
  gradientFrom: '#0f172a',
  gradientTo: '#1d4ed8',
  blur: 'none',
  palette: '',
  lighting: 'studio',
  contrast: 'high',
  saturation: 'high',
  depth: 'shallow',
  style: 'photoreal',
};

export const DEFAULT_BRIEF: ThumbnailBrief = {
  title: '',
  topic: '',
  audience: '',
  viewerSees: '',
  presetId: 'host-headline',
  subject: DEFAULT_SUBJECT,
  background: DEFAULT_BACKGROUND,
  references: [],
};

// ---- sizes ---------------------------------------------------------------

export interface SizePreset {
  id: 'native' | 'square' | 'portrait';
  label: string;
  size: string;
  aspectRatio: string;
}

export const SIZE_PRESETS: readonly SizePreset[] = [
  { id: 'native', label: 'Native 16:9 (1536x864)', size: '1536x864', aspectRatio: '16:9' },
  { id: 'square', label: 'Square (1024x1024)', size: '1024x1024', aspectRatio: '1:1' },
  { id: 'portrait', label: 'Portrait (864x1536)', size: '864x1536', aspectRatio: '9:16' },
];

export interface SizeCheck {
  ok: boolean;
  size?: string;
  error?: string;
}

/**
 * Validate a custom WxH size with the same rules the server enforces
 * (isAllowedImageSize): multiples of 16, edges up to 3840, ratio 1:3 to 3:1,
 * 0.65 to 8.3 megapixels. Returns a human message explaining the first broken rule.
 */
export function validateCustomSize(width: string | number, height: string | number): SizeCheck {
  const w = typeof width === 'number' ? width : Number(String(width).trim());
  const h = typeof height === 'number' ? height : Number(String(height).trim());
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) {
    return { ok: false, error: 'Enter a whole-number width and height.' };
  }
  if (w % 16 !== 0 || h % 16 !== 0) return { ok: false, error: 'Width and height must be multiples of 16.' };
  if (w > 3840 || h > 3840) return { ok: false, error: 'Each edge can be at most 3840 px.' };
  const ratio = w / h;
  if (ratio < 1 / 3 || ratio > 3) return { ok: false, error: 'The long edge can be at most 3 times the short edge.' };
  const pixels = w * h;
  if (pixels < 655_360) return { ok: false, error: 'The image must be at least 0.65 megapixels.' };
  if (pixels > 8_294_400) return { ok: false, error: 'The image can be at most 8.3 megapixels.' };
  const size = `${w}x${h}`;
  // Final guard so this helper can never accept something the server would reject.
  if (!isAllowedImageSize(size)) return { ok: false, error: 'Unsupported image size.' };
  return { ok: true, size };
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** 'WxH' to a reduced ratio label such as '16:9'. */
export function aspectRatioForSize(size: string): string {
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m) return '16:9';
  const w = Number(m[1]);
  const h = Number(m[2]);
  const d = gcd(w, h) || 1;
  return `${w / d}:${h / d}`;
}

// ---- prompt --------------------------------------------------------------

const GAZE_TEXT: Record<SubjectControls['gaze'], string> = {
  camera: 'looking straight into the camera',
  left: 'looking to the left of the frame',
  right: 'looking to the right of the frame',
  up: 'looking upward',
  down: 'looking downward',
};

const CROP_TEXT: Record<Crop, string> = {
  'close-up': 'tight close-up crop',
  medium: 'medium crop from the chest up',
  wide: 'wide crop showing the full figure',
};

const LIGHTING_TEXT: Record<BackgroundControls['lighting'], string> = {
  natural: 'natural daylight',
  studio: 'clean studio lighting',
  dramatic: 'dramatic high-contrast lighting with strong rim light',
  neon: 'neon coloured lighting',
  'golden-hour': 'warm golden-hour light',
  soft: 'soft diffused light',
};

const STYLE_TEXT: Record<BackgroundControls['style'], string> = {
  photoreal: 'photorealistic',
  cinematic: 'cinematic film look',
  illustration: 'stylised digital illustration',
  '3d-render': 'polished 3D render',
  graphic: 'bold flat graphic design',
};

const DEPTH_TEXT: Record<BackgroundControls['depth'], string> = {
  flat: 'flat depth with little perspective',
  shallow: 'shallow depth of field',
  deep: 'deep layered depth',
};

const BLUR_TEXT: Record<BackgroundControls['blur'], string> = {
  none: '',
  soft: 'background softly blurred',
  strong: 'background heavily blurred',
};

const OUTLINE_TEXT: Record<SubjectControls['outline'], string> = {
  none: '',
  white: 'a clean white outline around the subject so it pops from the background',
  glow: 'a soft glowing rim around the subject so it pops from the background',
};

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Where the headline space goes, opposite to the subject. */
export function headlineSide(placement: Placement): string {
  if (placement === 'left') return 'right side';
  if (placement === 'right') return 'left side';
  return 'top';
}

function subjectLines(subject: SubjectControls, hasPersonOrProductRef: boolean): string[] {
  if (subject.kind === 'none') return [];
  const noun = subject.kind === 'person' ? 'person' : 'product';
  const bits = [
    `Subject: a ${noun} placed on the ${subject.placement} of the frame`,
    CROP_TEXT[subject.crop],
    `filling about ${Math.round(Math.min(Math.max(subject.scale, 20), 100))}% of the frame height`,
  ];
  if (subject.kind === 'person') {
    bits.push(GAZE_TEXT[subject.gaze]);
    bits.push(`${subject.expression} expression`);
  }
  if (clean(subject.pose)) bits.push(`pose: ${clean(subject.pose)}`);
  const outline = OUTLINE_TEXT[subject.outline];
  if (outline) bits.push(outline);
  const lines = [bits.join(', ') + '.'];
  if (subject.useOriginal) {
    lines.push(
      hasPersonOrProductRef
        ? `Use the supplied ${noun} photo exactly as the ${noun}; do not redesign or restyle them.`
        : `Use the original ${noun} photo exactly.`,
    );
  }
  return lines;
}

function backgroundLines(bg: BackgroundControls): string[] {
  const lines: string[] = [];
  if (bg.mode === 'solid') {
    lines.push(`Background: a plain flat solid backdrop with no scene detail, approximately ${bg.solidColor}.`);
  } else if (bg.mode === 'gradient') {
    lines.push(`Background: a smooth gradient backdrop with no scene detail, from approximately ${bg.gradientFrom} to ${bg.gradientTo}.`);
  } else if (clean(bg.scene)) {
    lines.push(`Background scene: ${clean(bg.scene)}.`);
  }
  const look = [
    bg.mode === 'scene' ? BLUR_TEXT[bg.blur] : '',
    clean(bg.palette) ? `colour palette: ${clean(bg.palette)}` : '',
    LIGHTING_TEXT[bg.lighting],
    `${bg.contrast} contrast`,
    `${bg.saturation} colour saturation`,
    DEPTH_TEXT[bg.depth],
  ].filter(Boolean);
  lines.push(`Look: ${STYLE_TEXT[bg.style]}, ${look.join(', ')}.`);
  return lines;
}

function referenceLines(references: BriefReference[]): string[] {
  return references.map((ref, i) => {
    const role = getReferenceRole(ref.role);
    const label = clean(ref.label ?? '');
    return `Reference image ${i + 1}${label ? ` (${label})` : ''} - ${role.instruction}.`;
  });
}

/**
 * Turn the brief and its creative controls into one prompt. Pure and
 * deterministic so it can be tested and so "3 distinct concepts" can vary the
 * brief and get genuinely different prompts.
 */
export function buildThumbnailPrompt(brief: ThumbnailBrief): string {
  const preset = getConceptPreset(brief.presetId);
  const parts: string[] = ['Design an eye-catching, high-click-through video thumbnail.'];

  const context: string[] = [];
  if (clean(brief.title)) context.push(`Video title: "${clean(brief.title)}".`);
  if (clean(brief.topic)) context.push(`Topic: ${clean(brief.topic)}.`);
  if (clean(brief.audience)) context.push(`Audience: ${clean(brief.audience)}.`);
  if (clean(brief.viewerSees)) context.push(`What the viewer sees: ${clean(brief.viewerSees)}.`);
  parts.push(...context);

  parts.push(preset.fragment);

  const hasSubjectRef = brief.references.some((r) => r.role === 'person' || r.role === 'product');
  const subject = subjectLines(brief.subject, hasSubjectRef);
  parts.push(...subject);
  if (brief.subject.kind !== 'none') {
    parts.push(`Keep the ${headlineSide(brief.subject.placement)} of the frame free for a headline.`);
  }

  parts.push(...backgroundLines(brief.background));
  parts.push(...referenceLines(brief.references));
  parts.push('Do not render any text, letters, logos or watermarks unless a reference image already contains them.');

  return parts.join(' ');
}

const ALTERNATE_PRESETS: Record<ConceptPresetId, ConceptPresetId[]> = {
  'host-headline': ['cinematic', 'minimal'],
  'product-hero': ['cinematic', 'minimal'],
  'before-after': ['comparison', 'host-headline'],
  comparison: ['before-after', 'host-headline'],
  'tutorial-screenshot': ['host-headline', 'minimal'],
  cinematic: ['host-headline', 'minimal'],
  minimal: ['host-headline', 'cinematic'],
};

const PLACEMENT_ROTATION: Placement[] = ['left', 'right', 'center'];

/**
 * Three briefs for "3 distinct concepts": the chosen preset plus two others,
 * each with a different subject placement, so the three prompts differ in both
 * concept and composition.
 */
export function distinctConceptBriefs(brief: ThumbnailBrief, count = 3): ThumbnailBrief[] {
  const presets = [brief.presetId, ...ALTERNATE_PRESETS[brief.presetId]].slice(0, count);
  const start = PLACEMENT_ROTATION.indexOf(brief.subject.placement);
  return presets.map((presetId, i) => ({
    ...brief,
    presetId,
    subject: { ...brief.subject, placement: PLACEMENT_ROTATION[(start + i) % PLACEMENT_ROTATION.length] },
  }));
}

const CONTRAST_VALUE: Record<Level3, number> = { low: 0.85, normal: 1, high: 1.2 };
const SATURATION_VALUE: Record<Level3, number> = { low: 0.8, normal: 1, high: 1.25 };
const BLUR_PX: Record<BackgroundControls['blur'], number> = { none: 0, soft: 6, strong: 18 };

/** Exact values the canvas applies in Phase 2; never left to the model. */
export function deriveCanvasAdjustments(brief: ThumbnailBrief): CanvasAdjustments {
  const bg = brief.background;
  return {
    ...(bg.mode === 'solid' ? { backgroundColor: bg.solidColor } : {}),
    ...(bg.mode === 'gradient' ? { gradient: { from: bg.gradientFrom, to: bg.gradientTo, angle: 135 } } : {}),
    backgroundBlurPx: BLUR_PX[bg.blur],
    contrast: CONTRAST_VALUE[bg.contrast],
    saturation: SATURATION_VALUE[bg.saturation],
  };
}
