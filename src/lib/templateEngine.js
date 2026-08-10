/**
 * CINEMATIC TEMPLATE ENGINE
 * A unified prompt construction system for all 120+ templates
 * Supports film type detection, niche detection, cinematic enrichment, and multi-output prompt generation
 */

// ============================================
// FILM TYPE DETECTION
// ============================================

export const FILM_TYPES = {
  DRAMATIC_TRAILER: 'dramatic-trailer',
  FOUNDER_STORY_FILM: 'founder-story-film',
  TESTIMONIAL_FILM: 'testimonial-film',
  CASE_STUDY_FILM: 'case-study-film',
  PROMO_FILM: 'promo-film',
  CINEMATIC_COMMERCIAL: 'cinematic-commercial',
  DOCUMENTARY_STYLE_FILM: 'documentary-style-film',
  CINEMATIC_SHORT_FILM: 'cinematic-short-film'
};

/**
 * Detect film type from user input
 */
export function detectFilmType(input) {
  const text = [
    input.rawIdea,
    input.templateType,
    input.objective,
    input.tone
  ].join(' ').toLowerCase();

  if (text.includes('trailer') || text.includes('dramatic') || text.includes('teaser')) {
    return FILM_TYPES.DRAMATIC_TRAILER;
  }
  if (text.includes('founder') || text.includes('origin') || text.includes('entrepreneur')) {
    return FILM_TYPES.FOUNDER_STORY_FILM;
  }
  if (text.includes('testimonial') || text.includes('client success') || text.includes('customer success')) {
    return FILM_TYPES.TESTIMONIAL_FILM;
  }
  if (text.includes('case study') || text.includes('results')) {
    return FILM_TYPES.CASE_STUDY_FILM;
  }
  if (text.includes('promo') || text.includes('offer') || text.includes('launch')) {
    return FILM_TYPES.PROMO_FILM;
  }
  if (text.includes('commercial') || text.includes('ad ') || text.includes('advertisement')) {
    return FILM_TYPES.CINEMATIC_COMMERCIAL;
  }
  if (text.includes('documentary') || text.includes('authentic') || text.includes('real story')) {
    return FILM_TYPES.DOCUMENTARY_STYLE_FILM;
  }
  return FILM_TYPES.CINEMATIC_SHORT_FILM;
}

// ============================================
// NICHE DETECTION
// ============================================

export const NICHE_TYPES = {
  RESTAURANT: 'restaurant',
  MED_SPA: 'med-spa',
  SALON: 'salon',
  BARBERSHOP: 'barbershop',
  FITNESS: 'fitness',
  REAL_ESTATE: 'real-estate',
  DENTAL: 'dental',
  CHIROPRACTIC: 'chiropractic',
  LEGAL: 'legal',
  AUTOMOTIVE: 'automotive',
  FASHION: 'fashion',
  EVENT: 'event',
  LUXURY_BRAND: 'luxury-brand',
  LOCAL_BUSINESS: 'local-business',
  SAAS: 'saas',
  AGENCY: 'agency',
  GENERAL: 'general-business'
};

/**
 * Detect niche from user input
 */
export function detectNiche(input) {
  const text = [
    input.businessType,
    input.niche,
    input.productService,
    input.rawIdea
  ].join(' ').toLowerCase();

  if (text.includes('restaurant') || text.includes('cafe') || text.includes('food') || text.includes('chef') || text.includes('steakhouse')) {
    return NICHE_TYPES.RESTAURANT;
  }
  if (text.includes('med spa') || text.includes('skincare') || text.includes('beauty clinic') || text.includes('aesthetic')) {
    return NICHE_TYPES.MED_SPA;
  }
  if (text.includes('salon') || text.includes('hair salon') || text.includes('stylist')) {
    return NICHE_TYPES.SALON;
  }
  if (text.includes('barber') || text.includes('barbershop')) {
    return NICHE_TYPES.BARBERSHOP;
  }
  if (text.includes('gym') || text.includes('fitness') || text.includes('trainer') || text.includes('workout')) {
    return NICHE_TYPES.FITNESS;
  }
  if (text.includes('property') || text.includes('listing') || text.includes('realtor') || text.includes('real estate') || text.includes('home')) {
    return NICHE_TYPES.REAL_ESTATE;
  }
  if (text.includes('dental') || text.includes('dentist') || text.includes('smile')) {
    return NICHE_TYPES.DENTAL;
  }
  if (text.includes('chiro') || text.includes('wellness clinic') || text.includes('adjustment')) {
    return NICHE_TYPES.CHIROPRACTIC;
  }
  if (text.includes('law') || text.includes('attorney') || text.includes('lawyer') || text.includes('legal')) {
    return NICHE_TYPES.LEGAL;
  }
  if (text.includes('auto') || text.includes('car') || text.includes('vehicle') || text.includes('dealership')) {
    return NICHE_TYPES.AUTOMOTIVE;
  }
  if (text.includes('fashion') || text.includes('clothing') || text.includes('apparel') || text.includes('designer')) {
    return NICHE_TYPES.FASHION;
  }
  if (text.includes('event') || text.includes('conference') || text.includes('launch')) {
    return NICHE_TYPES.EVENT;
  }
  if (text.includes('luxury') || text.includes('premium') || text.includes('heritage')) {
    return NICHE_TYPES.LUXURY_BRAND;
  }
  if (text.includes('saas') || text.includes('software') || text.includes('tech')) {
    return NICHE_TYPES.SAAS;
  }
  if (text.includes('agency') || text.includes('marketing')) {
    return NICHE_TYPES.AGENCY;
  }
  return NICHE_TYPES.GENERAL;
}

// ============================================
// CINEMATIC STYLE ENGINES
// ============================================

export const CINEMATIC_STYLES = {
  LUXURY: 'luxury',
  DRAMATIC: 'dramatic',
  DOCUMENTARY: 'documentary',
  COMMERCIAL: 'commercial',
  BOLD: 'bold',
  MINIMAL: 'minimal',
  WARM: 'warm',
  COOL: 'cool'
};

export const CINEMATIC_STYLE_BUCKETS = {
  [CINEMATIC_STYLES.LUXURY]: [
    'luxury cinematic style',
    'premium visual atmosphere',
    'elegant production design',
    'refined composition',
    'high-end commercial aesthetic'
  ],
  [CINEMATIC_STYLES.DRAMATIC]: [
    'dramatic cinematic tension',
    'moody contrast lighting',
    'intense visual storytelling',
    'high-impact composition',
    'emotionally charged atmosphere'
  ],
  [CINEMATIC_STYLES.DOCUMENTARY]: [
    'documentary realism',
    'natural light feel',
    'authentic environment',
    'human-centered storytelling',
    'observational visual style'
  ],
  [CINEMATIC_STYLES.COMMERCIAL]: [
    'polished commercial look',
    'brand-forward composition',
    'clean product framing',
    'premium advertising aesthetic',
    'high-conversion visual direction'
  ],
  [CINEMATIC_STYLES.BOLD]: [
    'bold visual statement',
    'high-contrast color grading',
    'confident color palette',
    'striking visual impact',
    'unapologetic aesthetic'
  ],
  [CINEMATIC_STYLES.MINIMAL]: [
    'minimalist composition',
    'clean negative space',
    'refined simplicity',
    'sophisticated restraint',
    'elegant minimal aesthetic'
  ],
  [CINEMATIC_STYLES.WARM]: [
    'warm color temperature',
    'golden-hour glow',
    'inviting atmosphere',
    'cozy ambient lighting',
    'sun-drenched warmth'
  ],
  [CINEMATIC_STYLES.COOL]: [
    'cool color palette',
    'crisp visual clarity',
    'modern atmosphere',
    'fresh visual tone',
    'serene color temperature'
  ]
};

// ============================================
// CINEMATOGRAPHY ENGINE
// ============================================

export const CINEMATOGRAPHY = {
  CAMERA_MOVEMENTS: [
    'slow dolly in',
    'cinematic push-in',
    'subtle handheld realism',
    'smooth tracking shot',
    'crane-like reveal',
    'slow pan across the environment',
    'steady cam glide',
    'aerial drone perspective',
    'static wide shot',
    'rack focus transition'
  ],
  FRAMING: [
    'wide establishing shots',
    'medium character framing',
    'tight emotional close-ups',
    'shallow depth of field portraits',
    'symmetrical compositions',
    'foreground-background depth',
    'rule of third composition',
    'center-weighted framing',
    'over-the-shoulder setup',
    'Dutch angle for tension'
  ],
  LIGHTING: [
    'soft cinematic lighting',
    'moody directional light',
    'golden-hour warmth',
    'high-contrast dramatic light',
    'luxury interior glow',
    'natural documentary lighting',
    'practical light sources',
    'rim lighting for separation',
    'diffused ambient light',
    'chiaroscuro shadow play'
  ],
  LENS_LOOK: [
    'anamorphic feel',
    'film-like depth',
    'creamy background separation',
    'cinematic bokeh',
    'wide-angle environmental perspective',
    'telephoto compression for emotional intensity',
    '35mm documentary feel',
    '50mm cinematic standard',
    '85mm portrait compression',
    'hyperfocal landscape sharpness'
  ],
  PACING: [
    'fast-cut pacing',
    'rising tension rhythm',
    'impactful transitions',
    'slow refined pacing',
    'lingering premium detail shots',
    'hook-first pacing',
    'scroll-stopping opening',
    'measured natural pacing',
    'authentic observational rhythm',
    'dynamic action pacing'
  ]
};

/**
 * Get cinematography terms based on film type and platform
 */
export function getCinematographyTerms(filmType, platform = 'general') {
  const isVertical = platform.includes('TikTok') || platform.includes('Instagram') || platform.includes('Reel');
  const isTrailer = filmType === FILM_TYPES.DRAMATIC_TRAILER;

  return {
    movement: isTrailer
      ? ['cinematic push-in', 'crane-like reveal', 'fast-cut pacing']
      : ['slow dolly in', 'smooth tracking shot', 'measured natural pacing'],
    framing: isVertical
      ? ['tight emotional close-ups', 'foreground-background depth', 'center-weighted framing']
      : ['wide establishing shots', 'medium character framing', 'shallow depth of field portraits'],
    lighting: ['soft cinematic lighting', 'luxury interior glow', 'moody directional light'],
    lens: ['anamorphic feel', 'cinematic bokeh', 'film-like depth'],
    pacing: isTrailer
      ? ['fast-cut pacing', 'rising tension rhythm', 'hook-first pacing']
      : ['slow refined pacing', 'lingering premium detail shots']
  };
}

// ============================================
// STORY BEAT ENGINE
// ============================================

export const STORY_BLUESPRINTS = {
  [FILM_TYPES.CINEMATIC_SHORT_FILM]: [
    'hook',
    'subject introduction',
    'emotional movement',
    'visual payoff',
    'ending reveal'
  ],
  [FILM_TYPES.DRAMATIC_TRAILER]: [
    'tension hook',
    'escalation',
    'partial reveal',
    'climax',
    'title card / CTA'
  ],
  [FILM_TYPES.FOUNDER_STORY_FILM]: [
    'origin',
    'struggle',
    'mission',
    'breakthrough',
    'future / CTA'
  ],
  [FILM_TYPES.TESTIMONIAL_FILM]: [
    'problem',
    'frustration',
    'solution',
    'transformation',
    'trust-building close'
  ],
  [FILM_TYPES.CASE_STUDY_FILM]: [
    'challenge',
    'strategy',
    'execution',
    'result',
    'proof / CTA'
  ],
  [FILM_TYPES.PROMO_FILM]: [
    'opening atmosphere shot',
    'service introduction',
    'value demonstration',
    'offer reveal',
    'CTA'
  ],
  [FILM_TYPES.CINEMATIC_COMMERCIAL]: [
    'attention hook',
    'product hero shot',
    'benefit showcase',
    'lifestyle integration',
    'brand close'
  ],
  [FILM_TYPES.DOCUMENTARY_STYLE_FILM]: [
    'environment establishing',
    'subject introduction',
    'process documentation',
    'human element',
    'authentic conclusion'
  ]
};

/**
 * Get story beats for a film type
 */
export function getStoryBeats(filmType) {
  return STORY_BLUESPRINTS[filmType] || STORY_BLUESPRINTS[FILM_TYPES.CINEMATIC_SHORT_FILM];
}

// ============================================
// NICHE ENRICHMENT ENGINE
// ============================================

export const NICHE_TERMS = {
  [NICHE_TYPES.RESTAURANT]: [
    'cinematic food close-ups',
    'steam rising from plates',
    'texture and plating details',
    'warm hospitality atmosphere',
    'kitchen action shots',
    'guest experience moments',
    'ambient restaurant lighting',
    'signature dish presentation',
    'cocktail and wine visuals',
    'chef at work'
  ],
  [NICHE_TYPES.MED_SPA]: [
    'luxury treatment rooms',
    'clean premium interiors',
    'close-up skincare details',
    'client glow-up moments',
    'elegant beauty-commercial tone',
    'spa-like relaxation atmosphere',
    'clinical precision meets comfort',
    'transformation visual journey',
    'serene treatment environment',
    'wellness and self-care aesthetics'
  ],
  [NICHE_TYPES.SALON]: [
    'styling station atmosphere',
    'hair transformation reveal',
    'client chair moment',
    'before and after visual',
    'salon creative process',
    'professional stylist at work',
    'fresh look confidence boost',
    'mirrors and lighting setup',
    'product showcase styling',
    'client satisfaction moment'
  ],
  [NICHE_TYPES.BARBERSHOP]: [
    'classic barbershop atmosphere',
    'precise cutting technique',
    'straight razor detail',
    'traditional barber chair',
    'client transformation',
    'shop environment establishing',
    'craftsman at work',
    'fresh cut reveal',
    'barber tools close-up',
    'masculine grooming aesthetic'
  ],
  [NICHE_TYPES.FITNESS]: [
    'high-energy training visuals',
    'sweat and movement intensity',
    'strength and power moments',
    'motivational transformation beats',
    'dynamic gym atmosphere',
    'powerful physical storytelling',
    'dedication and discipline visuals',
    'workout intensity close-ups',
    'gym equipment aesthetics',
    'results and progress documentation'
  ],
  [NICHE_TYPES.REAL_ESTATE]: [
    'sweeping property reveals',
    'luxury interior details',
    'lifestyle-driven location shots',
    'architectural wide shots',
    'elevated listing presentation',
    'home features showcase',
    'neighborhood atmosphere',
    'natural light streaming in',
    'space and openness visuals',
    'premium property aesthetics'
  ],
  [NICHE_TYPES.DENTAL]: [
    'clean modern dental office',
    'smile transformation',
    'patient comfort and care',
    'state-of-the-art equipment',
    'dental team professionalism',
    'confident smile visuals',
    'pain-free comfortable experience',
    'trust-building clinical environment',
    'family-friendly atmosphere',
    'oral health awareness'
  ],
  [NICHE_TYPES.CHIROPRACTIC]: [
    'wellness-focused clinic environment',
    'patient care and comfort',
    'adjustment technique precision',
    'holistic health approach',
    'relief and mobility visuals',
    'professional wellness team',
    'calm therapeutic atmosphere',
    'natural healing environment',
    'patient education moments',
    'balance and alignment themes'
  ],
  [NICHE_TYPES.LEGAL]: [
    'professional law office environment',
    'attorney authority and expertise',
    'case preparation atmosphere',
    'client consultation setting',
    'trust and credibility visuals',
    'justice and fairness themes',
    'successful case outcomes',
    'compassionate legal counsel',
    'results-driven practice',
    'community standing and reputation'
  ],
  [NICHE_TYPES.AUTOMOTIVE]: [
    'premium vehicle showcase',
    'sleek automotive design',
    'performance and power visuals',
    'luxury car interior details',
    'driving experience excitement',
    'dealership professional environment',
    'vehicle feature close-ups',
    'style and status aesthetics',
    'automotive lifestyle integration',
    'trust in transportation'
  ],
  [NICHE_TYPES.FASHION]: [
    'runway or studio setting',
    'garment detail and texture',
    'model movement and styling',
    'collection presentation',
    'fashion editorial aesthetic',
    'designer vision showcase',
    'trend and style visuals',
    'wardrobe transformation',
    'style inspiration moments',
    'luxury fashion atmosphere'
  ],
  [NICHE_TYPES.EVENT]: [
    'event atmosphere and energy',
    'crowd and audience moments',
    'speaker or performer highlight',
    'networking and connection',
    'memorable event highlights',
    'production value showcase',
    'excitement and anticipation',
    'professional event execution',
    'exclusive access moments',
    'event legacy and impact'
  ],
  [NICHE_TYPES.LUXURY_BRAND]: [
    'premium brand environment',
    'heritage and craftsmanship',
    'exclusive product details',
    'luxury lifestyle aspiration',
    'sophisticated brand aesthetic',
    'status and prestige visuals',
    'premium materials close-up',
    'luxury experience storytelling',
    'aspirational brand identity',
    'refined luxury atmosphere'
  ],
  [NICHE_TYPES.GENERAL]: [
    'professional business environment',
    'quality service delivery',
    'client satisfaction moments',
    'expertise and authority',
    'trust-building visuals',
    'business success atmosphere',
    'team and leadership presence',
    'value proposition showcase',
    'professional brand identity',
    'results and impact documentation'
  ]
};

/**
 * Get niche-specific terms
 */
export function getNicheTerms(niche) {
  return NICHE_TERMS[niche] || NICHE_TERMS[NICHE_TYPES.GENERAL];
}

// ============================================
// PROMPT COMPOSITION ENGINE
// ============================================

/**
 * Build the master prompt from template and user inputs
 */
export function buildTemplatePrompt(input) {
  const filmType = detectFilmType(input);
  const niche = detectNiche(input);
  const styleTerms = CINEMATIC_STYLE_BUCKETS[input.visualStyle] || CINEMATIC_STYLE_BUCKETS[CINEMATIC_STYLES.COMMERCIAL];
  const cinematographyTerms = getCinematographyTerms(filmType, input.platform);
  const storyBeats = getStoryBeats(filmType);
  const nicheTerms = getNicheTerms(niche);

  const masterPrompt = composeMasterPrompt({
    subject: input.subject,
    intent: input.objective,
    styleTerms,
    cinematographyTerms,
    nicheTerms,
    storyBeats,
    constraints: {
      duration: input.duration,
      aspectRatio: input.aspectRatio,
      platform: input.platform,
      cta: input.cta
    }
  });

  const masterClean = cleanPrompt(masterPrompt);

  return {
    filmType,
    niche,
    storyBeats,
    masterPrompt: masterClean,
    shotPrompt: composeShotEnhancedPrompt(masterPrompt, cinematographyTerms),
    scenePrompts: composeScenePrompts(storyBeats, nicheTerms),
    voiceover: composeVoiceoverConcept(input, storyBeats),
    negativePrompt: composeNegativePrompt(filmType, niche, input.visualStyle),
    enrichedPrompt: enrichPromptString(masterClean, {
      niche,
      visualStyle: input.visualStyle,
      platform: input.platform,
      filmType
    }),
    nicheTerms
  };
}

/**
 * Compose the master prompt
 */
function composeMasterPrompt({ subject, intent, styleTerms, cinematographyTerms, nicheTerms, storyBeats, constraints }) {
  const styleTermsArr = (styleTerms || []).filter(Boolean);
  const movementArr = (cinematographyTerms.movement || []).filter(Boolean);
  const framingArr = (cinematographyTerms.framing || []).filter(Boolean);
  const lightingArr = (cinematographyTerms.lighting || []).filter(Boolean);
  const nicheArr = (nicheTerms || []).filter(Boolean);
  const beatsArr = (storyBeats || []).filter(Boolean);

  return `A ${intent || 'cinematic visual'} featuring ${subject || 'the subject'}. Visual approach: ${styleTermsArr.join(', ') || 'refined cinematic styling'}. Cinematography: ${movementArr.join(', ') || 'smooth camera movement'}; ${framingArr.join(', ') || 'balanced framing'}; ${lightingArr.join(', ') || 'soft cinematic lighting'}. Setting: ${nicheArr.slice(0, 3).join(', ') || 'a polished environment'}. Structure: ${beatsArr.join(' → ') || 'established narrative flow'}. Format: ${constraints.aspectRatio || '16:9'}, ${constraints.duration || 5}s, optimized for ${constraints.platform || 'general'}.${constraints.cta ? ' Call to action: ' + constraints.cta + '.' : ''}`;
}

/**
 * Compose shot-enhanced prompt
 */
function composeShotEnhancedPrompt(basePrompt, cinematographyTerms) {
  return `${basePrompt}

Shot Composition:
- Camera: ${cinematographyTerms.movement.join(' | ')}
- Framing: ${cinematographyTerms.framing.join(' | ')}
- Lens: ${cinematographyTerms.lens.join(' | ')}
- Pacing: ${cinematographyTerms.pacing.join(' | ')}`;
}

/**
 * Compose scene prompts
 */
function composeScenePrompts(storyBeats, nicheTerms) {
  const terms = nicheTerms || [];
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  return (storyBeats || []).filter(Boolean).map((beat, index) => {
    const nicheTerm = terms.length ? terms[index % terms.length] : '';
    return {
      scene: index + 1,
      beat,
      prompt: `Scene ${index + 1} — ${cap(beat)}: ${nicheTerm}`,
      nicheTerm
    };
  });
}

/**
 * Compose voiceover concept
 */
function composeVoiceoverConcept(input, storyBeats) {
  return {
    tone: input.tone || 'professional',
    pacing: 'measured and intentional',
    structure: storyBeats,
    suggestion: `Voiceover should guide through: ${storyBeats.join(' → ')}`
  };
}

/**
 * Compose negative prompt
 */
export function composeNegativePrompt(filmType, niche, visualStyle) {
  const base = 'blurry, low-quality, amateur, poorly lit, generic stock photo';
  const styleNegatives = {
    luxury: 'cheap, tacky, low-budget, garish',
    dramatic: 'flat, boring, static, lifeless',
    documentary: 'over-produced, artificial, staged',
    commercial: 'under-produced, unprofessional'
  };
  const nicheNegatives = {
    [NICHE_TYPES.RESTAURANT]: 'fast food, chain restaurant',
    [NICHE_TYPES.MED_SPA]: 'clinic gore, medical sterility, harsh fluorescent',
    [NICHE_TYPES.SALON]: 'messy salon, dull hair, unflattering lighting',
    [NICHE_TYPES.BARBERSHOP]: 'unkempt grooming, dirty shop, careless cut',
    [NICHE_TYPES.FITNESS]: 'out of shape, lazy energy, cluttered gym',
    [NICHE_TYPES.REAL_ESTATE]: 'cluttered home, poor staging, dull interior',
    [NICHE_TYPES.DENTAL]: 'dental fear, gore, clinical coldness',
    [NICHE_TYPES.CHIROPRACTIC]: 'painful adjustment, chaotic clinic, stiffness',
    [NICHE_TYPES.LEGAL]: 'shady lawyer, courtroom drama, unprofessional',
    [NICHE_TYPES.AUTOMOTIVE]: 'rusty vehicle, dirty car, cheap dealership',
    [NICHE_TYPES.FASHION]: 'wrinkled clothing, off-trend, poor styling',
    [NICHE_TYPES.EVENT]: 'empty venue, dull crowd, poorly produced',
    [NICHE_TYPES.LUXURY_BRAND]: 'cheap, mass market, low-budget',
    [NICHE_TYPES.LOCAL_BUSINESS]: 'corporate coldness, impersonal chain, generic',
    [NICHE_TYPES.SAAS]: 'outdated UI, cluttered screen, amateur software',
    [NICHE_TYPES.AGENCY]: 'amateur pitch, messy workflow, off-brand'
  };
  const nicheNegative = nicheNegatives[niche] || '';
  return `${base}, ${styleNegatives[visualStyle] || base}${nicheNegative ? ', ' + nicheNegative : ''}`.trim();
}

/**
 * Clean and dedupe prompt
 */
function cleanPrompt(prompt) {
  return prompt
    .replace(/\bcinematic\b(?:,\s*\bcinematic\b)+/gi, 'cinematic')
    .replace(/\bbeautiful\b|\bamazing\b|\bcool\b|\bepic\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/(\b\w+\b)(,\s*\1\b)+/gi, '$1')
    .replace(/^[\s,.\-]+|[\s,.\-]+$/g, '')
    .trim();
}

// ============================================
// TEMPLATE OUTPUT MODES
// ============================================

export const OUTPUT_MODES = {
  MASTER_PROMPT: 'master_prompt',
  SHOT_ENHANCED: 'shot_enhanced_prompt',
  SCENE_PACK: 'scene_prompt_pack',
  VOICEOVER: 'voiceover_direction',
  NEGATIVE: 'negative_prompt'
};

export const OUTPUT_MODE_LABELS = {
  [OUTPUT_MODES.MASTER_PROMPT]: 'Master Prompt',
  [OUTPUT_MODES.SHOT_ENHANCED]: 'Shot-Enhanced',
  [OUTPUT_MODES.SCENE_PACK]: 'Scene Pack',
  [OUTPUT_MODES.VOICEOVER]: 'Voiceover',
  [OUTPUT_MODES.NEGATIVE]: 'Negative Prompt'
};

// ============================================
// TEMPLATE BUILDER CLASS
// ============================================

export class CinematicTemplateBuilder {
  constructor() {
    this.filmType = FILM_TYPES.CINEMATIC_SHORT_FILM;
    this.niche = NICHE_TYPES.GENERAL;
    this.style = CINEMATIC_STYLES.COMMERCIAL;
    this.inputs = {};
  }

  setFilmType(filmType) {
    this.filmType = filmType;
    return this;
  }

  setNiche(niche) {
    this.niche = niche;
    return this;
  }

  setStyle(style) {
    this.style = style;
    return this;
  }

  setInputs(inputs) {
    this.inputs = inputs;
    return this;
  }

  build() {
    return buildTemplatePrompt({
      ...this.inputs,
      visualStyle: this.style,
      templateType: this.filmType,
      niche: this.niche
    });
  }

  getStoryBeats() {
    return getStoryBeats(this.filmType);
  }

  getNicheTerms() {
    return getNicheTerms(this.niche);
  }

  getCinematography() {
    return getCinematographyTerms(this.filmType, this.inputs.platform);
  }
}

// ============================================
// ENGINE INPUT BRIDGE
// ============================================

/**
 * Infer a film type from a story blueprint string or sceneStructure array
 */
export function inferFilmTypeFromBlueprint(blueprint) {
  let b = '';
  if (Array.isArray(blueprint)) {
    b = blueprint.join(' ').toLowerCase();
  } else if (blueprint && typeof blueprint === 'object') {
    if (Array.isArray(blueprint.acts)) {
      b = blueprint.acts.flatMap(act => act.beats || []).join(' ').toLowerCase();
    } else if (blueprint.id) {
      b = String(blueprint.id).toLowerCase();
    }
  } else if (typeof blueprint === 'string') {
    b = blueprint.toLowerCase();
  }
  if (b.includes('cta') || b.includes('offer')) return FILM_TYPES.PROMO_FILM;
  if (b.includes('origin') || b.includes('struggle')) return FILM_TYPES.FOUNDER_STORY_FILM;
  if (b.includes('problem') || b.includes('transformation')) return FILM_TYPES.TESTIMONIAL_FILM;
  if (b.includes('challenge') || b.includes('result')) return FILM_TYPES.CASE_STUDY_FILM;
  if (b.includes('tension') || b.includes('climax')) return FILM_TYPES.DRAMATIC_TRAILER;
  if (b.includes('context') || b.includes('process')) return FILM_TYPES.DOCUMENTARY_STYLE_FILM;
  return FILM_TYPES.CINEMATIC_SHORT_FILM;
}

const OUTPUT_STYLE_TO_FILM_TYPE = {
  'luxury_brand_promo': 'cinematic-commercial',
  'documentary': 'documentary-style-film',
  'emotional_brand_story': 'cinematic-short-film',
  'bold_direct_response': 'promo-film',
  'cinematic_commercial': 'cinematic-commercial',
  'dramatic_trailer': 'dramatic-trailer',
  'inspirational_founder': 'founder-story-film',
  'customer_transformation': 'testimonial-film',
  'cinematic_social_short': 'promo-film'
};

/**
 * Derive a canonical engine input object from a matrix/niche/standard template + form state.
 * Consumable by detectFilmType / detectNiche / buildTemplatePrompt.
 */
export function deriveEngineInputFromTemplate(template = {}, formState = {}) {
  const isVertical = (template.aspectRatio && template.aspectRatio.includes('9:16')) ||
    (template.aspectRatios && template.aspectRatios.some((r) => r.includes('9:16')));

  const isMatrix = !!template.filmFamily;
  const isNiche = !isMatrix && (template.quickInputs || template.advancedInputs);

  let rawIdea, templateType, objective, subject, niche, storyBlueprint;

  if (isMatrix) {
    rawIdea = formState.prompt || template.promptDirection || template.description || '';
    templateType = template.filmFamily || formState.templateType ||
      (template.storyBlueprint ? inferFilmTypeFromBlueprint(template.storyBlueprint) : '');
    objective = formState.businessType || template.coreUseCase || '';
    subject = formState.subject || template.name || '';
    niche = formState.niche && formState.niche !== 'auto-detect' ? formState.niche : (template.niche || '');
    storyBlueprint = template.storyBlueprint || '';
  } else if (isNiche) {
    const outputStyleId = template.outputStyle?.id;
    rawIdea = formState.prompt || template.description || '';
    templateType = OUTPUT_STYLE_TO_FILM_TYPE[outputStyleId] || formState.templateType || '';
    objective = formState.businessType || template.description || '';
    subject = formState.prompt || template.name || '';
    niche = formState.niche && formState.niche !== 'auto-detect' ? formState.niche : (template.niche || '');
    storyBlueprint = template.sceneStructure || '';
  } else {
    rawIdea = formState.prompt || template.promptDirection || template.description || '';
    templateType = template.filmFamily || formState.templateType ||
      (template.storyBlueprint ? inferFilmTypeFromBlueprint(template.storyBlueprint) : '');
    objective = formState.businessType || template.coreUseCase || '';
    subject = formState.subject || template.name || '';
    niche = formState.niche && formState.niche !== 'auto-detect' ? formState.niche : (template.niche || '');
    storyBlueprint = template.storyBlueprint || '';
  }

  return {
    rawIdea,
    templateType: templateType || (storyBlueprint ? inferFilmTypeFromBlueprint(storyBlueprint) : ''),
    objective,
    tone: formState.tone || 'professional',
    businessType: formState.businessType || '',
    niche,
    productService: formState.subject || '',
    platform: formState.platform || (isVertical ? 'TikTok Reel' : 'general'),
    visualStyle: formState.visualStyle || 'commercial',
    subject,
    duration: formState.duration ||
      (typeof template.duration === 'object' ? template.duration.default : template.duration) || 5,
    aspectRatio: template.aspectRatio || (template.aspectRatios && template.aspectRatios[0]) || '16:9',
    cta: formState.cta || ''
  };
}

/**
 * Enrich a plain prompt string with niche + cinematography terms.
 * This is what the UI calls to upgrade a user's plain prompt.
 */
export function enrichPromptString(basePrompt, { niche, visualStyle, platform, filmType } = {}) {
  const nicheTerms = getNicheTerms(niche);
  const cine = getCinematographyTerms(filmType, platform);
  const movement = (cine.movement || []).filter(Boolean);
  const suffix = ` Cinematic enrichment: ${nicheTerms.slice(0, 3).join(', ')}; ${movement.slice(0, 2).join(', ')}.`;
  return cleanPrompt(`${basePrompt || ''}${suffix}`);
}

/**
 * Combined output modes for UI rendering
 */
export function getEngineOutputModes() {
  return Object.keys(OUTPUT_MODES).map((key) => ({
    mode: OUTPUT_MODES[key],
    label: OUTPUT_MODE_LABELS[OUTPUT_MODES[key]]
  }));
}

export default {
  FILM_TYPES,
  NICHE_TYPES,
  CINEMATIC_STYLES,
  CINEMATIC_STYLE_BUCKETS,
  CINEMATOGRAPHY,
  STORY_BLUESPRINTS,
  NICHE_TERMS,
  OUTPUT_MODES,
  OUTPUT_MODE_LABELS,
  detectFilmType,
  detectNiche,
  getCinematographyTerms,
  getStoryBeats,
  getNicheTerms,
  buildTemplatePrompt,
  CinematicTemplateBuilder,
  inferFilmTypeFromBlueprint,
  deriveEngineInputFromTemplate,
  enrichPromptString,
  getEngineOutputModes
};
