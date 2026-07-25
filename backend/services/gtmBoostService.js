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
  retail: { id: 'retail', name: 'Retail & eCommerce', description: 'Retail and e-commerce solutions' },
  education: { id: 'education', name: 'Education', description: 'Education technology and learning solutions' },
  'real-estate': { id: 'real-estate', name: 'Real Estate', description: 'Real estate and property technology' },
  restaurant: { id: 'restaurant', name: 'Restaurant & Food Service', description: 'Restaurant, food service, and hospitality' },
  'fitness-wellness': { id: 'fitness-wellness', name: 'Fitness & Wellness', description: 'Gyms, studios, and wellness services' },
  'legal-services': { id: 'legal-services', name: 'Legal Services', description: 'Law firms and legal technology' },
  automotive: { id: 'automotive', name: 'Automotive', description: 'Automotive dealers and car services' },
  fashion: { id: 'fashion', name: 'Fashion & Lifestyle', description: 'Fashion, beauty, and lifestyle brands' },
  events: { id: 'events', name: 'Events & Entertainment', description: 'Events, venues, and entertainment' },
  luxury: { id: 'luxury', name: 'Luxury & Premium', description: 'Luxury and premium brands' },
  travel: { id: 'travel', name: 'Travel & Hospitality', description: 'Travel, hotels, and hospitality services' },
  nonprofit: { id: 'nonprofit', name: 'Nonprofit & Social Impact', description: 'Nonprofit and social impact organizations' },
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
  executive: { id: 'executive', name: 'Executive Gravitas', description: 'Formal, authoritative language with strategic insights', guidelines: 'Use sophisticated vocabulary, focus on strategic implications, emphasize vision and leadership' },
  challenger: { id: 'challenger', name: 'Challenger Bold', description: 'Confident, assertive messaging that challenges assumptions', guidelines: 'Be provocative and insight-driven, challenge conventional thinking, provide unique perspectives' },
  conversational: { id: 'conversational', name: 'Conversational Peer', description: 'Friendly, relatable tone like speaking to a trusted colleague', guidelines: 'Use "we" and "you", include relatable examples, build rapport through shared understanding' },
  technical: { id: 'technical', name: 'Technical Expert', description: 'Demonstrate deep technical knowledge and expertise', guidelines: 'Use industry terminology, focus on specifications and capabilities, show technical credibility' },
  inspirational: { id: 'inspirational', name: 'Inspirational Vision', description: 'Paint compelling vision of future possibilities', guidelines: 'Use aspirational language, focus on transformation, create emotional connection to goals' },
  urgent: { id: 'urgent', name: 'Urgent Action', description: 'Create sense of urgency and time-sensitive opportunities', guidelines: 'Use action-oriented language, emphasize immediate benefits, highlight risk of inaction' },
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
  const tonalityContent = TONALITIES[tonality] || TONALITIES.executive;
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
  const tonalityContent = TONALITIES[tonality] || TONALITIES.executive;
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

  if (!role || !industry || !methodology || !tonality) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'role, industry, methodology, and tonality are required',
    });
  }

  // 1. Try OpenAI if a key is configured.
  const aiPrompt = await callOpenAI({ basePrompt, role, industry, methodology, tonality, focus, templateContext });

  if (aiPrompt) {
    return res.json({
      success: true,
      source: 'openai',
      prompt: aiPrompt,
      selections: { role, industry, methodology, tonality, focus },
      templateContext,
    });
  }

  // 2. Fallback to the local library.
  const prompt = buildFallbackPrompt({ basePrompt, role, industry, methodology, tonality, focus, templateContext });

  res.json({
    success: true,
    source: 'local-library',
    prompt,
    selections: { role, industry, methodology, tonality, focus },
    templateContext,
  });
});

export default router;
