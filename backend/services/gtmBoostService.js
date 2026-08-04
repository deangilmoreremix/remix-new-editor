/**
 * gtmBoostService.js
 *
 * Express router mounted at /api/gtm-boost.
 *
 * Provides the backend side of the GTM Boost button used by
 * TemplateStudio (and other studios) to create conversion-optimized
 * template prompts.
 *
 * Endpoints:
 *   GET  /options         — returns roles, industries, methodologies,
 *                            tonalities, focus areas for the modal.
 *   POST /generate        — generates a GTM-optimized prompt for a
 *                            given base prompt + selections.
 *   POST /template-context — returns template-aware defaults
 *                            (e.g. pre-selects industry from a template
 *                            category/niche).
 *
 * The service tries to use OpenAI (gpt-4o-mini by default) when an
 * OPENAI_API_KEY is set, and falls back to a deterministic local
 * library that mirrors src/lib/gtmContentLibrary.js so the endpoint
 * always returns a useful prompt.
 */

import express from 'express';

const router = express.Router();

// ============================================================================
// CONTENT LIBRARY
// Mirrors src/lib/gtmContentLibrary.js on the client so the backend
// can return options and a useful fallback prompt without the client
// having to bundle the full library.
// ============================================================================

const ROLES = {
  sdr: {
    id: 'sdr',
    title: 'SDR/BDR Prospecting',
    description: 'Sales Development Representative / Business Development Representative content for cold outreach and lead qualification',
    objectives: ['Generate qualified leads', 'Create pipeline opportunities', 'Establish initial contact and interest'],
    primaryKPI: 'meeting bookings',
  },
  ae: {
    id: 'ae',
    title: 'Account Executive Discovery',
    description: 'Account Executive content for qualified prospects, discovery, and value demonstration',
    objectives: ['Advance qualified opportunities', 'Demonstrate ROI and business value', 'Handle objections and concerns'],
    primaryKPI: 'deal progression',
  },
  'sales-manager': {
    id: 'sales-manager',
    title: 'Sales Management',
    description: 'Sales leadership content for team enablement and pipeline management',
    objectives: ['Accelerate team performance', 'Build management credibility', 'Drive revenue growth'],
    primaryKPI: 'team quota attainment',
  },
  revops: {
    id: 'revops',
    title: 'Revenue Operations',
    description: 'Revenue Operations content for process optimization and data-driven insights',
    objectives: ['Improve operational efficiency', 'Enhance data accuracy and insights', 'Optimize sales processes and automation'],
    primaryKPI: 'operational efficiency gains',
  },
  csm: {
    id: 'csm',
    title: 'Customer Success',
    description: 'Customer Success Management content for retention and expansion',
    objectives: ['Reduce customer churn', 'Identify expansion opportunities', 'Build long-term customer loyalty'],
    primaryKPI: 'customer retention and expansion',
  },
  founder: {
    id: 'founder',
    title: 'Executive Leadership',
    description: 'Founder and executive content for strategic partnerships and vision communication',
    objectives: ['Build strategic relationships', 'Communicate company vision', 'Drive executive-level engagement'],
    primaryKPI: 'strategic partnership development',
  },
};

const INDUSTRIES = {
  saas: { id: 'saas', name: 'SaaS', description: 'Software as a Service solutions and subscription-based business models' },
  fintech: { id: 'fintech', name: 'FinTech', description: 'Financial technology and payment processing solutions' },
  healthcare: { id: 'healthcare', name: 'Healthcare', description: 'Healthcare technology and patient care solutions' },
  manufacturing: { id: 'manufacturing', name: 'Manufacturing', description: 'Manufacturing and industrial operations solutions' },
  'professional-services': { id: 'professional-services', name: 'Professional Services', description: 'Consulting, advisory, and professional service firms' },
  ecommerce: { id: 'ecommerce', name: 'E-commerce', description: 'Online retail and DTC brands selling through visual storefronts' },
  'real-estate': { id: 'real-estate', name: 'Real Estate', description: 'Residential, commercial, and proptech selling via property visuals' },
  education: { id: 'education', name: 'Education', description: 'EdTech, universities, and training orgs selling learning outcomes' },
  logistics: { id: 'logistics', name: 'Logistics & Supply Chain', description: 'Freight, warehousing, and supply-chain software and services' },
  retail: { id: 'retail', name: 'Retail & CPG', description: 'Brick-and-mortar and consumer-packaged-goods brand marketing' },
  media: { id: 'media', name: 'Media & Entertainment', description: 'Streaming, publishing, and studios selling audience attention' },
  legal: { id: 'legal', name: 'Legal & Compliance', description: 'Law firms and legal-tech selling trust and expertise' },
  telecom: { id: 'telecom', name: 'Telecom & Connectivity', description: 'Connectivity, broadband, and communications providers' },
  energy: { id: 'energy', name: 'Energy & Clean Tech', description: 'Renewables, utilities, and climate-tech selling transformation' },
  nonprofit: { id: 'nonprofit', name: 'Nonprofit & Mission-Driven', description: 'Charities and mission orgs driving donations and awareness' },
  government: { id: 'government', name: 'Government & Public Sector', description: 'Public agencies and govtech selling programs and services' },
  insurance: { id: 'insurance', name: 'Insurance', description: 'Carriers, brokers, and insurtech selling protection and peace of mind' },
  automotive: { id: 'automotive', name: 'Automotive & Mobility', description: 'Dealers, OEMs, and mobility tech selling vehicles and experiences' },
};

const METHODOLOGIES = {
  meddpicc: {
    id: 'meddpicc',
    name: 'MEDDPICC',
    fullName: 'Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition',
    description: 'Enterprise sales qualification framework for complex B2B sales',
    application: 'Apply systematically to understand and navigate enterprise buying processes',
  },
  spin: {
    id: 'spin',
    name: 'SPIN Selling',
    fullName: 'Situation, Problem, Implication, Need-payoff',
    description: 'Consultative selling framework for complex solutions',
    application: 'Progress conversations from current state to solution value',
  },
  challenger: {
    id: 'challenger',
    name: 'Challenger Sale',
    fullName: 'The Challenger Sale',
    description: 'Insight-driven sales approach that challenges customer assumptions',
    application: 'Teach customers, tailor communications, and take control of sales conversations',
  },
  'gap-selling': {
    id: 'gap-selling',
    name: 'Gap Selling',
    fullName: 'Gap Selling',
    description: 'Framework focusing on the gap between current and desired future state',
    application: 'Identify gaps and position solutions as bridges to desired outcomes',
  },
  'value-selling': {
    id: 'value-selling',
    name: 'Value Selling',
    fullName: 'Value-Based Selling',
    description: 'Sales approach focused on quantifiable business value and ROI',
    application: 'Demonstrate tangible business impact and quantified results',
  },
  sandler: {
    id: 'sandler',
    name: 'Sandler Selling',
    fullName: 'Sandler Selling System',
    description: 'Qualification-focused sales process with pain-based selling',
    application: 'Qualify prospects and focus on pain points throughout sales process',
  },
};

const TONALITIES = {
  professional: { id: 'professional', name: 'Professional', description: 'Clean, credible, polished tone for B2B image and video creative', guidelines: 'Use clear, confident language; steady pacing; neutral, well-lit framing; minimal but premium styling' },
  executive: { id: 'executive', name: 'Executive Gravitas', description: 'Formal, authoritative tone with strategic insights for boardroom-level video', guidelines: 'Sophisticated vocabulary, emphasis on vision/leadership, slow deliberate cuts, cinematic establishing shots' },
  challenger: { id: 'challenger', name: 'Challenger Bold', description: 'Confident, assertive tone that challenges assumptions in punchy video hooks', guidelines: 'Provocative insight-driven copy, hard cuts, high-contrast visuals, bold typography on screen' },
  conversational: { id: 'conversational', name: 'Conversational Peer', description: 'Friendly, relatable tone like talking to a trusted colleague on camera', guidelines: 'Use "we"/"you", casual framing (selfie/desk setup), natural lighting, relaxed pacing' },
  technical: { id: 'technical', name: 'Technical Expert', description: 'Deep technical credibility for demo-heavy product videos and explainer images', guidelines: 'Industry terminology, screen-recorded UI demos, diagram overlays, precise labelling' },
  inspirational: { id: 'inspirational', name: 'Inspirational Vision', description: 'Aspirational tone painting a future vision for brand/manifesto video', guidelines: 'Aspirational copy, sweeping b-roll, upward camera moves, warm uplifting color grade' },
  urgent: { id: 'urgent', name: 'Urgent Action', description: 'Time-sensitive, high-energy tone for limited-offer promo video', guidelines: 'Action verbs, countdown graphics, fast pacing, urgent sound design, red/amber accents' },
  casual: { id: 'casual', name: 'Casual Peer-to-Peer', description: 'Light, informal tone for social-first Reels/TikToks aimed at GTM peers', guidelines: 'Slang-light, punchy one-liners, vertical 9:16 framing, trending audio, quick cuts' },
  witty: { id: 'witty', name: 'Witty & Clever', description: 'Humorous, clever copy for scroll-stopping social video and meme images', guidelines: 'Wordplay and light joke setups, comedic timing in edits, playful graphics' },
  empathetic: { id: 'empathetic', name: 'Empathetic & Human', description: 'Warm, understanding tone for customer-story and retention video', guidelines: 'Validation-first copy, real customer faces, soft focus, gentle pacing, calm score' },
  'data-driven': { id: 'data-driven', name: 'Data-Driven', description: 'Number-led, proof-oriented tone for ROI/results video and stat graphics', guidelines: 'Lead with metrics, animated bar/line charts, clean infographic styling, confident narration' },
  storytelling: { id: 'storytelling', name: 'Narrative Storytelling', description: 'Three-act story structure for case-study and founding-story video', guidelines: 'Setup-conflict-resolution arc, character-led b-roll, emotional music swell' },
  authoritative: { id: 'authoritative', name: 'Authoritative Expert', description: 'Commanding, credentialed tone for thought-leadership video', guidelines: 'Cite frameworks and proof, steady eye-contact framing, library/office settings, serious grade' },
  minimalist: { id: 'minimalist', name: 'Minimalist', description: 'Restrained, single-message tone for clean product hero images and videos', guidelines: 'One idea per frame, lots of negative space, muted palette, slow deliberate motion' },
  luxury: { id: 'luxury', name: 'Luxury & Premium', description: 'High-end, exclusive tone for enterprise/ABM video and hero imagery', guidelines: 'Rich textures, slow motion, gold/black palette, elegant typography, no hard-sell' },
  playful: { id: 'playful', name: 'Playful & Fun', description: 'Bright, energetic tone for culture and top-of-funnel social video', guidelines: 'Bright palette, bouncy edits, emoji-style graphics, upbeat quirky music' },
  bold: { id: 'bold', name: 'Bold & Disruptive', description: 'Loud, category-breaking tone for brand-launch video', guidelines: 'Oversized type, saturated color, fast aggressive cuts, statement voiceover' },
  educational: { id: 'educational', name: 'Educational', description: 'Clear teaching tone for how-to and explainer video/image carousels', guidelines: 'Step-by-step structure, pointer/arrow overlays, calm narration, clean whiteboard style' },
  trustworthy: { id: 'trustworthy', name: 'Trustworthy & Reassuring', description: 'Calm, dependable tone for security/compliance and onboarding video', guidelines: 'Plain language, steady pacing, soft blue/green palette, real-environment shots' },
  energetic: { id: 'energetic', name: 'Energetic & Upbeat', description: 'High-tempo, motivating tone for event/launch hype video', guidelines: 'Fast cuts, rising tempo, bright colors, crowd/confetti energy, driving beat' },
  sophisticated: { id: 'sophisticated', name: 'Sophisticated & Refined', description: 'Understated elegance for premium B2B brand films', guidelines: 'Subtle motion, refined palette, elegant serif type, restrained music' },
  direct: { id: 'direct', name: 'Direct & No-Fluff', description: 'Blunt, benefit-first tone for bottom-funnel conversion video', guidelines: 'Front-load the offer, plain words, punch-in cuts, clear CTA card' },
  friendly: { id: 'friendly', name: 'Friendly & Welcoming', description: 'Warm invite tone for webinar and community onboarding video', guidelines: 'Inviting copy, open body language, bright airy set, gentle uplifting music' },
  dramatic: { id: 'dramatic', name: 'Dramatic & Cinematic', description: 'High-stakes, cinematic tone for hero/brand film', guidelines: 'Low-key lighting, orchestral swell, slow-mo hero moment, deep contrast grade' },
  'peer-comparison': { id: 'peer-comparison', name: 'Social Proof / Peer Comparison', description: 'Comparison-led tone for competitive-displacement video', guidelines: 'Show "them vs you" split screens, benchmark charts, confident neutral narration' },
};

const FOCUS_AREAS = [
  { id: 'lead-gen', label: 'Lead Generation', description: 'Lead generation with contact capture' },
  { id: 'awareness', label: 'Brand Awareness', description: 'Brand awareness and market education' },
  { id: 'education', label: 'Education', description: 'Educational content and knowledge sharing' },
  { id: 'demo', label: 'Product Demo', description: 'Product demonstration and capability showcase' },
];

// ============================================================================
// TEMPLATE CATEGORY → INDUSTRY MAPPING
// Maps template categories/niches (from src/lib/templates.js and
// src/lib/nicheTemplates.js) to GTM industries so the frontend can
// pre-select the right industry when a user opens GTM Boost from a
// template.
// ============================================================================

const TEMPLATE_CATEGORY_TO_INDUSTRY = {
  // Standard categories
  'Social Media': 'saas',
  'Style Transfer': 'saas',
  'Entertainment': 'events',
  'Commercial': 'retail',
  'VFX & Action': 'entertainment',
  'Portrait & Creator': 'fashion',
  'Decade & Era': 'fashion',
  'Camera & Cinematic': 'entertainment',
  'Industry Specific': 'saas',
  'Personal Story': 'nonprofit',
  // Niche labels
  'Restaurant & Cafe': 'restaurant',
  'Med Spa & Beauty': 'fashion',
  'Salon & Barbershop': 'fashion',
  'Gym & Fitness': 'fitness-wellness',
  'Real Estate': 'real-estate',
  'Dental Office': 'healthcare',
  'Chiropractic & Wellness': 'fitness-wellness',
  'Legal & Attorney': 'legal-services',
  'Automotive & Car': 'automotive',
  'Fashion & Style': 'fashion',
  'Events & Celebrations': 'events',
  'Luxury & Premium': 'luxury',
  // Industry keys (raw)
  'restaurant': 'restaurant',
  'med-spa': 'fashion',
  'salon': 'fashion',
  'fitness': 'fitness-wellness',
  'real-estate': 'real-estate',
  'dental': 'healthcare',
  'chiropractic': 'fitness-wellness',
  'legal': 'legal-services',
  'automotive': 'automotive',
  'fashion': 'fashion',
  'events': 'events',
  'luxury': 'luxury',
  'general-business': 'saas',
  'local-business': 'retail',
  'saas': 'saas',
  'agency': 'professional-services',
};

// ============================================================================
// FALLBACK PROMPT BUILDER
// Deterministic local generation that mirrors the client-side
// gtmContentLibrary.buildOptimizedPrompt. Used when no OpenAI key
// is configured or when the OpenAI call fails.
// ============================================================================

function buildFallbackPrompt({ basePrompt, role, industry, methodology, tonality, focus = [], templateContext = {} }) {
  const roleContent = ROLES[role] || ROLES.sdr;
  const industryContent = INDUSTRIES[industry] || INDUSTRIES.saas;
  const methodologyContent = METHODOLOGIES[methodology] || METHODOLOGIES.spin;
  const tonalityContent = TONALITIES[tonality] || TONALITIES.professional;
  const focusElements = focus
    .map((id) => FOCUS_AREAS.find((f) => f.id === id))
    .filter(Boolean)
    .map((f) => f.description);

  const templateTag = templateContext.templateId
    ? ` [Template: ${templateContext.templateId}]`
    : '';

  const sections = [
    `🎯 ${roleContent.title} Video Prompt${templateTag}`,
    ``,
    `Role Context: ${roleContent.description}`,
    `Objectives: ${roleContent.objectives.join(', ')}`,
    ``,
    `Industry Focus: ${industryContent.description}`,
    ``,
    `Sales Framework: ${methodologyContent.name}`,
    `Application: ${methodologyContent.application}`,
    ``,
    `Writing Style: ${tonalityContent.name}`,
    `Guidelines: ${tonalityContent.guidelines}`,
    ``,
  ];

  if (focusElements.length > 0) {
    sections.push(`Focus Areas: ${focusElements.join(', ')}`);
    sections.push(``);
  }

  sections.push(`Core Concept: ${basePrompt}`);
  sections.push(``);
  sections.push(`Create a compelling video that leverages these GTM frameworks to drive ${roleContent.primaryKPI} and achieve ${roleContent.objectives[0].toLowerCase()}.`);

  return sections.join('\n');
}

// ============================================================================
// OPENAI INTEGRATION
// Uses the official OpenAI Chat Completions API. Returns null on any
// error so the caller can fall back to the local library.
// ============================================================================

async function callOpenAI({ basePrompt, role, industry, methodology, tonality, focus = [], templateContext = {} }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const roleContent = ROLES[role] || ROLES.sdr;
  const industryContent = INDUSTRIES[industry] || INDUSTRIES.saas;
  const methodologyContent = METHODOLOGIES[methodology] || METHODOLOGIES.spin;
  const tonalityContent = TONALITIES[tonality] || TONALITIES.professional;
  const focusLabels = focus
    .map((id) => (FOCUS_AREAS.find((f) => f.id === id) || {}).label)
    .filter(Boolean)
    .join(', ');

  const systemPrompt = `You are a master cinematic video director and senior sales enablement expert specializing in GTM (Go-To-Market) methodologies and conversion-optimized content creation.

Your task: take a base prompt and transform it into a comprehensive, conversion-optimized cinematic video prompt that:
- Applies the ${methodologyContent.name} (${methodologyContent.fullName}) framework: ${methodologyContent.application}
- Speaks in the ${tonalityContent.name} writing style: ${tonalityContent.guidelines}
- Targets the ${roleContent.title} audience: ${roleContent.description}
- Reflects the ${industryContent.name} industry context: ${industryContent.description}
${focusLabels ? `- Focuses on: ${focusLabels}` : ''}
${templateContext.category ? `- Template category: ${templateContext.category}` : ''}
${templateContext.niche ? `- Template niche: ${templateContext.niche}` : ''}
${templateContext.outputType ? `- Output type: ${templateContext.outputType}` : ''}

Return ONLY the optimized cinematic prompt — no preamble, no explanation, no labels. The prompt should be ready to paste into a video generation model.`;

  const userPrompt = `Base Prompt: ${basePrompt || '(no base prompt provided — generate a cinematic template-driven prompt for the selections above)'}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GTM_BOOST_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      console.warn(`[gtm-boost] OpenAI returned ${res.status}: ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    console.warn('[gtm-boost] OpenAI call failed:', err.message);
    return null;
  }
}

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/gtm-boost/options
// Returns the full library so the modal can render its selectors.
router.get('/options', (_req, res) => {
  res.json({
    roles: Object.values(ROLES),
    industries: Object.values(INDUSTRIES),
    methodologies: Object.values(METHODOLOGIES),
    tonalities: Object.values(TONALITIES),
    focusAreas: FOCUS_AREAS,
  });
});

// POST /api/gtm-boost/template-context
// Maps template metadata (category, niche) to GTM defaults so the
// modal can pre-select the right industry and tonality.
router.post('/template-context', (req, res) => {
  const { category, niche, name, description } = req.body || {};

  // Resolve industry: niche first (more specific), then category.
  const industry =
    (niche && TEMPLATE_CATEGORY_TO_INDUSTRY[niche]) ||
    (category && TEMPLATE_CATEGORY_TO_INDUSTRY[category]) ||
    'saas';

  // Pick a sensible tonality based on industry.
  const tonality = (() => {
    if (industry === 'luxury' || industry === 'real-estate') return 'executive';
    if (industry === 'fashion' || industry === 'events') return 'inspirational';
    if (industry === 'healthcare' || industry === 'fintech') return 'technical';
    return 'conversational';
  })();

  // Pick a default role based on industry.
  const role = (() => {
    if (['saas', 'fintech', 'manufacturing', 'professional-services'].includes(industry)) return 'ae';
    if (['fashion', 'events', 'luxury', 'automotive', 'restaurant'].includes(industry)) return 'founder';
    if (['healthcare', 'fitness-wellness', 'education', 'real-estate', 'legal-services'].includes(industry)) return 'csm';
    return 'sdr';
  })();

  // Pick a default methodology.
  const methodology = (() => {
    if (['saas', 'fintech', 'manufacturing', 'healthcare'].includes(industry)) return 'meddpicc';
    if (['professional-services', 'legal-services', 'real-estate'].includes(industry)) return 'spin';
    if (['fashion', 'luxury', 'events'].includes(industry)) return 'challenger';
    return 'value-selling';
  })();

  res.json({
    industry,
    tonality,
    role,
    methodology,
    basePrompt: description || name || '',
  });
});

// POST /api/gtm-boost/generate
// Generates a GTM-optimized prompt. Tries OpenAI first, falls back to
// the local library.
router.post('/generate', async (req, res) => {
  const {
    basePrompt,
    role,
    industry,
    methodology,
    tonality,
    focus = [],
    templateContext = {},
  } = req.body || {};

  // Apply defaults so the endpoint never 400s on missing/empty selections.
  // Each of these also has a fallback inside the build/AI paths, but
  // resolving them here means the response's `selections` always reflects
  // what was actually used.
  const resolvedRole = role || 'sdr';
  const resolvedIndustry = industry || 'saas';
  const resolvedMethodology = methodology || 'spin';
  const resolvedTonality = tonality || 'professional';

  // 1. Try OpenAI if a key is configured.
  const aiPrompt = await callOpenAI({
    basePrompt,
    role: resolvedRole,
    industry: resolvedIndustry,
    methodology: resolvedMethodology,
    tonality: resolvedTonality,
    focus,
    templateContext,
  });

  if (aiPrompt) {
    return res.json({
      success: true,
      source: 'openai',
      prompt: aiPrompt,
      selections: {
        role: resolvedRole,
        industry: resolvedIndustry,
        methodology: resolvedMethodology,
        tonality: resolvedTonality,
        focus,
      },
      templateContext,
    });
  }

  // 2. Fallback to the local library.
  const prompt = buildFallbackPrompt({
    basePrompt,
    role: resolvedRole,
    industry: resolvedIndustry,
    methodology: resolvedMethodology,
    tonality: resolvedTonality,
    focus,
    templateContext,
  });

  res.json({
    success: true,
    source: 'local-library',
    prompt,
    selections: {
      role: resolvedRole,
      industry: resolvedIndustry,
      methodology: resolvedMethodology,
      tonality: resolvedTonality,
      focus,
    },
    templateContext,
  });
});

export default router;
