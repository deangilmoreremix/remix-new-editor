/**
 * Template prompt composer.
 *
 * Builds the single prompt sent to the model from EVERYTHING the user set in
 * a template studio, so every visible input changes the output:
 *
 *   1. Main prompt, placed into the template's base prompt ({prompt})
 *   2. The template's own fields (e.g. Restaurant Name, Cuisine)
 *   3. Advanced Controls: Subject, Business Type, Template Type (format),
 *      Setting, Audience, Visual Style, CTA, Extra Instructions, Niche
 *   4. Creative Intelligence cards (as shown / edited): niche, scene
 *      structure, cinematic enrichment, visual style, enhancer keywords
 *   5. AI Enhancer (on: keywords + niche / camera enrichment; off: skipped)
 *
 * Pure: no DOM access, so it is unit-tested directly.
 */
import { NICHE_ENRICHMENT, FILM_FAMILIES } from './templateMatrix.js';
import { getNicheTerms, detectNiche, enrichPromptString } from './templateEngine.js';

/** Fields that are generation settings or media, never prompt text. */
export const NON_PROMPT_FIELDS = new Set([
  'prompt', 'aspect_ratio', 'aspectRatio', 'duration', 'resolution', 'quality', 'seed',
  'name', 'negative_prompt', 'image_url', 'video_url', 'last_image_url', 'referenceImage',
  'model', 'num_images', 'output_format',
]);

const MEDIA_TYPES = new Set(['image', 'frame', 'video', 'audio', 'file']);

/** Card defaults shown in Creative Intelligence (by output type). */
export function defaultCreativeTiles(outputType, specs = {}) {
  const image = outputType === 'image';
  return {
    niche: specs.niche || '',
    scene: specs.sceneBlueprint?.length
      ? specs.sceneBlueprint.join(' → ')
      : (image ? 'Main subject → supporting background → focal contrast → text-safe space' : 'Hook → Subject → Movement → Payoff → CTA'),
    cinematic: specs.cinematography
      || (image ? 'Strong composition, professional lighting, sharp focus on the subject' : 'Dynamic camera movement, shallow depth of field, professional lighting'),
    style: specs.visualStyle || 'Polished, cinematic, high-contrast, premium aesthetic',
    keywords: specs.enhancerKeywords || (image ? 'high quality, sharp, detailed, professional, 4K' : 'cinematic, professional, 4K, high quality, premium'),
  };
}

const clean = (v) => (typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim()));
const humanize = (v) => clean(v).replace(/[-_]+/g, ' ');

/**
 * Detect the niche from what the user typed (business type, subject, prompt,
 * template fields) and the template itself.
 */
export function detectTemplateNiche({ template = {}, advanced = {}, fields = {}, userPrompt = '' } = {}) {
  if (template.niche) return template.niche;
  const detected = detectNiche({
    businessType: [advanced.businessType, advanced.subject].filter(Boolean).join(' '),
    niche: '',
    productService: Object.values(fields).filter(v => typeof v === 'string').join(' '),
    rawIdea: [userPrompt, template.name, template.description, template.category].filter(Boolean).join(' '),
  });
  return detected || 'general-business';
}

/**
 * @param {Object} opts
 * @param {Object} opts.template          Normalized template.
 * @param {Object} [opts.specs]           Enhanced specs (templateSpecs.js).
 * @param {string} [opts.userPrompt]      Main prompt field.
 * @param {Array}  [opts.templateInputs]  The template's own inputs.
 * @param {Object} [opts.fields]          Values of the template's own inputs.
 * @param {Object} [opts.advanced]        Advanced Controls values.
 * @param {Object} [opts.tiles]           Creative Intelligence card values.
 * @param {boolean}[opts.aiEnhancer=true]
 * @param {string} [opts.sceneOverride]   Edited "Scene Beats" tab.
 * @returns {{ prompt: string, niche: string, sections: Object }}
 */
export function composeTemplatePrompt({
  template = {},
  specs = {},
  userPrompt = '',
  templateInputs = [],
  fields = {},
  advanced = {},
  tiles = {},
  aiEnhancer = true,
  sceneOverride = '',
} = {}) {
  const isVideo = template.outputType !== 'image';
  const main = clean(userPrompt);
  const sections = {};
  const parts = [];
  const push = (key, text) => {
    const t = clean(text);
    if (!t) return;
    sections[key] = t;
    parts.push(t);
  };

  // 1. Core: main prompt inside the template base prompt.
  const subject = clean(advanced.subject);
  const core = main || subject || clean(template.name);
  if (template.basePrompt && template.basePrompt.includes('{prompt}')) {
    push('core', template.basePrompt.split('{prompt}').join(core).replace(/^[\s,]+/, ''));
  } else {
    push('core', [main, clean(template.basePrompt)].filter(Boolean).join('. ') || core);
  }

  // 2. The template's own fields (Restaurant Name, Cuisine, …).
  const details = (templateInputs || [])
    .filter(i => i && i.name && !NON_PROMPT_FIELDS.has(i.name) && !MEDIA_TYPES.has(i.type))
    .map(i => {
      const v = fields[i.name];
      if (v === true) return clean(i.label || i.name);
      if (v === false || v == null) return '';
      const text = Array.isArray(v) ? v.filter(Boolean).join(', ') : clean(v);
      return text ? `${clean(i.label || humanize(i.name))}: ${text}` : '';
    })
    .filter(Boolean);
  if (details.length) push('details', details.join('; '));

  // 3. Advanced Controls.
  if (subject && main) push('subject', `Subject: ${subject}`);
  if (clean(advanced.businessType)) push('business', `Business: ${clean(advanced.businessType)}`);
  if (isVideo && clean(advanced.templateType)) push('format', `Format: ${humanize(advanced.templateType)}`);
  if (clean(advanced.setting)) push('setting', `Setting: ${clean(advanced.setting)}`);
  if (clean(advanced.audience)) push('audience', `Target audience: ${clean(advanced.audience)}`);

  // Niche: explicit choice > edited card > detection.
  const chosenNiche = clean(advanced.niche) && advanced.niche !== 'auto-detect' ? clean(advanced.niche) : '';
  const niche = chosenNiche || clean(tiles.niche) || detectTemplateNiche({ template, advanced, fields, userPrompt: main });
  const nicheTerms = NICHE_ENRICHMENT[niche] || getNicheTerms(niche) || [];
  // A niche the user typed that has no enrichment terms of its own (the
  // lookup falls back to generic terms) is added as written.
  const userNiche = chosenNiche || clean(tiles.niche);
  const fallbackTerms = getNicheTerms('__unknown-niche__') || [];
  const knownNiche = !!NICHE_ENRICHMENT[niche]
    || (nicheTerms.length > 0 && JSON.stringify(nicheTerms) !== JSON.stringify(fallbackTerms));
  if (userNiche && !knownNiche) push('nicheText', `Niche: ${humanize(userNiche)}`);
  if (nicheTerms.length) push('niche', nicheTerms.slice(0, 5).join(', '));

  // 4. Creative direction (cards win over template defaults).
  const scene = clean(sceneOverride)
    || clean(tiles.scene)
    || ((template.storyBlueprint && template.storyBlueprint.length) ? template.storyBlueprint.join(' → ') : (specs.sceneBlueprint || []).join(' → '));
  if (scene) push('scene', `${isVideo ? 'Scene structure' : 'Composition'}: ${scene}`);
  const cinematic = clean(tiles.cinematic) || clean(specs.cinematography);
  if (cinematic) push('cinematic', cinematic);
  const styleChoice = clean(advanced.visualStyle);
  const styleText = clean(tiles.style) || clean(specs.visualStyle);
  if (styleChoice || styleText) push('style', `Visual style: ${[styleChoice, styleText].filter(Boolean).join(' — ')}`);
  if (template.filmFamily && FILM_FAMILIES[template.filmFamily]?.direction) push('family', FILM_FAMILIES[template.filmFamily].direction);
  if (template.promptDirection) push('direction', template.promptDirection);

  if (clean(advanced.cta)) push('cta', isVideo ? `Call to action: ${clean(advanced.cta)}` : `Text overlay / call to action: ${clean(advanced.cta)}`);
  if (clean(advanced.extraInstructions)) push('extra', clean(advanced.extraInstructions));

  // 5. AI Enhancer.
  if (aiEnhancer) {
    const keywords = clean(tiles.keywords) || clean(specs.enhancerKeywords);
    if (keywords) push('keywords', keywords);
    if (isVideo) {
      const enrichment = enrichPromptString('', {
        niche,
        visualStyle: styleChoice || 'commercial',
        platform: (template.aspectRatio && String(template.aspectRatio).includes('9:16')) ? 'TikTok Reel' : 'general',
        filmType: template.filmFamily || '',
      });
      if (enrichment) push('enrichment', enrichment.replace(/^Cinematic enrichment:\s*/i, 'Cinematic enrichment: '));
    }
  }

  // Join, then drop exact-duplicate sentences.
  const seen = new Set();
  let prompt = parts
    .join('. ')
    // Only sentence-ending periods (keeps 2.5, example.com, v2.6 intact).
    .replace(/\s*\.(?:\s+|$)/g, '. ')
    .replace(/\.{2,}/g, '.')
    .split('. ')
    .filter((s) => {
      const k = s.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join('. ')
    .trim();
  if (prompt && !prompt.endsWith('.')) prompt += '.';
  return { prompt, niche, sections };
}

/**
 * The template's own inputs as `{ label, value }` entries (no media or
 * generation settings), for engines that only know some field names.
 */
export function templateInputEntries(inputs = [], values = {}) {
  return (inputs || [])
    .filter(i => i && i.name && !NON_PROMPT_FIELDS.has(i.name) && !MEDIA_TYPES.has(i.type))
    .map(i => {
      const v = values[i.name];
      if (v === true) return { label: '', value: clean(i.label || humanize(i.name)) };
      if (v === false || v == null) return null;
      return { label: clean(i.label || humanize(i.name)), value: Array.isArray(v) ? v.filter(Boolean).join(', ') : clean(v) };
    })
    .filter(e => e && e.value);
}

/**
 * Append every entry whose value is not already in the prompt, so no input
 * the user set is dropped by an assembly engine. Entries already present
 * (case-insensitive) are skipped, so this never duplicates.
 * @param {string} prompt
 * @param {Array<{label?: string, value: any}>} entries
 */
export function appendMissingInputs(prompt, entries = []) {
  const base = clean(prompt);
  const lower = base.toLowerCase();
  const added = [];
  const seen = new Set();
  for (const e of entries) {
    if (!e) continue;
    const v = clean(Array.isArray(e.value) ? e.value.filter(Boolean).join(', ') : e.value);
    if (!v) continue;
    const key = v.toLowerCase();
    // Whole-value match ("Ana" is not present in "Anamorphic").
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const present = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(lower);
    if (present || seen.has(key)) continue;
    seen.add(key);
    added.push(e.label ? `${clean(e.label)}: ${v}` : v);
  }
  if (!added.length) return base;
  const head = base.replace(/[\s,.]+$/, '');
  return `${head ? `${head}. ` : ''}${added.join('. ')}.`;
}
