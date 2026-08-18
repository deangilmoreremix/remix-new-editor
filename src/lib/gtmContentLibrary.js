/**
 * GTM Content Library - Comprehensive GTM methodologies and templates
 * Based on gtm-skills.com repository structure and content
 * Provides role-based playbooks, industry frameworks, and sales methodologies
 */

import { getRelevantGtmSkills, gtmSkillsPromptForContext, gtmSkillsCategories } from './gtmSkillsData.js';

class GTMContentLibrary {
  constructor() {
    this.focusAreas = this.initializeFocusAreas();
    this.roles = this.initializeRoles();
    this.industries = this.initializeIndustries();
    this.methodologies = this.initializeMethodologies();
    this.tonalities = this.initializeTonalities();
    this.workflows = this.initializeWorkflows();
    this.modelOptions = this.initializeModelOptions();
    this.cinematicElements = this.initializeCinematicElements();
  }

  /**
   * Get the canonical list of focus areas available in the GTM Boost UI.
   * Each entry exposes an `id` (used in `focus` param arrays) and a
   * `label` (human-readable name). `description` mirrors the on-screen
   * helper text and the long-form label used by system prompt builders.
   */
  initializeFocusAreas() {
    return [
      { id: 'lead-gen',   label: 'Lead Generation',         description: 'Lead generation with contact capture', bestFor: 'Top-of-funnel campaigns needing contacts', example: '“Book a demo” CTA with lead magnet', difficulty: 'Easy' },
      { id: 'awareness',  label: 'Brand Awareness',         description: 'Brand awareness and market education', bestFor: 'Launch phases and category creation', example: '“Did you know 70% of teams…?” hook', difficulty: 'Easy' },
      { id: 'education',  label: 'Education',                description: 'Educational content and knowledge sharing', bestFor: 'Complex products needing explainers', example: 'Step-by-step breakdown with diagrams', difficulty: 'Medium' },
      { id: 'demo',       label: 'Product Demo',            description: 'Product demonstration and capability showcase', bestFor: 'Bottom-funnel proof and close', example: 'Walkthrough of key workflow in 60s', difficulty: 'Medium' },
    ];
  }

  initializeModelOptions() {
    return [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fast/cheap)', description: 'Fast, cost-effective model for quick prompt generation and high-volume usage', bestFor: 'Drafts, iterations, and bulk prompts', example: 'Quickly generate 10 prompt variants', difficulty: 'Easy' },
      { id: 'gpt-4o',      label: 'GPT-4o (balanced)',       description: 'Balanced performance and quality for most GTM prompt enhancement tasks', bestFor: 'Most GTM workflows and daily use', example: 'Polished prompt with solid methodology framing', difficulty: 'Easy' },
      { id: 'gpt-4.1',     label: 'GPT-4.1 (quality)',       description: 'Highest quality outputs for critical prompts where nuance and precision matter most', bestFor: 'Executive decks and high-stakes video', example: 'Narrative prompt with layered emotional cues', difficulty: 'Medium' },
      { id: 'gpt-5-mini',  label: 'GPT-5 Mini (next-gen fast)', description: 'Next-generation fast model with improved reasoning for rapid iteration', bestFor: 'Fast refinement of good first drafts', example: 'Rapid A/B prompt rewrites', difficulty: 'Easy' },
      { id: 'gpt-5-nano', label: 'GPT-5 Nano (ultra-fast)', description: 'Ultra-fast lightweight model ideal for real-time prompt suggestions and drafts', bestFor: 'In-the-moment suggestions and sketches', example: 'One-line prompt polish on the fly', difficulty: 'Easy' },
    ];
  }

  initializeCinematicElements() {
    return [
      { id: 'openingHook',         label: 'Opening Hooks',          description: 'Grab viewer attention in the first 3 seconds with a compelling hook', bestFor: 'Stopping scroll and reducing drop-off', example: 'Start with a surprising stat or bold claim', difficulty: 'Easy' },
      { id: 'storytellingStructure', label: 'Storytelling Structure', description: 'Apply narrative arcs and story beats for a coherent, memorable video flow', bestFor: 'Case studies and brand films', example: 'Setup → conflict → resolution with CTA', difficulty: 'Medium' },
      { id: 'visualElements',      label: 'Visual Cinematography',  description: 'Enhance shot composition, lighting, and visual storytelling direction', bestFor: 'Premium image and hero video', example: 'Slow dolly, golden hour, shallow DOF', difficulty: 'Hard' },
      { id: 'audioElements',       label: 'Audio Excellence',       description: 'Improve voiceover tone, music selection, and sound design cues', bestFor: 'Emotional and branded audio identity', example: 'Warm narration + rising orchestral score', difficulty: 'Medium' },
      { id: 'pacingEditing',       label: 'Pacing & Editing',       description: 'Control rhythm, cut frequency, and timing to maintain engagement', bestFor: 'Social shorts and promo videos', example: 'Hard cut hook, hold beats, punch CTA', difficulty: 'Medium' },
      { id: 'emotionalEngagement', label: 'Emotional Engagement',   description: 'Amplify emotional resonance and audience connection through storytelling', bestFor: 'Customer stories and retention', example: 'Validation-first copy with calm score', difficulty: 'Hard' },
      { id: 'ctaIntegration',      label: 'CTA Integration',        description: 'Weave in clear, conversion-focused calls to action aligned with GTM goals', bestFor: 'Direct response and pipeline generation', example: 'Arrow pointer + “Book your demo now” card', difficulty: 'Easy' },
    ];
  }

  /**
    * Get role-based content for a specific role
    * @param {string} role - Role identifier (sdr, ae, sales-manager, etc.)
    * @returns {Object} Role content and templates
    */
  getRoleContent(role) {
    return this.roles[role] || this.roles.sdr;
  }

  /**
   * Get industry-specific content and considerations
   * @param {string} industry - Industry identifier
   * @returns {Object} Industry content and frameworks
   */
  getIndustryContent(industry) {
    return this.industries[industry] || this.industries.saas;
  }

  /**
   * Get sales methodology framework
   * @param {string} methodology - Methodology identifier
   * @returns {Object} Methodology framework and application guide
   */
  getMethodology(methodology) {
    return this.methodologies[methodology] || this.methodologies.spin;
  }

  /**
   * Get writing tonality guidelines
   * @param {string} tonality - Tonality identifier
   * @returns {Object} Writing style guidelines
   */
  getTonality(tonality) {
    return this.tonalities[tonality] || this.tonalities.professional;
  }

  /**
   * Get complete workflow templates
   * @param {string} workflow - Workflow identifier
   * @returns {Object} Complete workflow structure
   */
  getWorkflow(workflow) {
    return this.workflows[workflow] || this.workflows['cold-to-close'];
  }

  /**
   * Generate optimized prompt using GTM frameworks
   * @param {Object} params - Generation parameters
   * @returns {string} Optimized prompt
   */
  generateOptimizedPrompt({
    basePrompt,
    role,
    industry,
    methodology,
    tonality,
    focus = []
  }) {
    const roleContent = this.getRoleContent(role);
    const industryContent = this.getIndustryContent(industry);
    const methodologyContent = this.getMethodology(methodology);
    const tonalityContent = this.getTonality(tonality);

    const focusElements = focus.map(area => this.getFocusElement(area)).filter(Boolean);

    const prompt = this.buildOptimizedPrompt({
      basePrompt,
      roleContent,
      industryContent,
      methodologyContent,
      tonalityContent,
      focusElements
    });

    // Enrich the offline fallback with real, retrieved GTM skill prompts so the
    // local library produces grounded, example-driven guidance rather than only
    // the generic framework scaffolding above.
    return this.appendSkillExamples(prompt, { role, industry, methodology });
  }

  /**
   * Append the most relevant real GTM skill prompts to the generated fallback.
   * Falls back gracefully (returns original prompt) if retrieval yields nothing.
   */
  appendSkillExamples(prompt, { role, industry, methodology } = {}) {
    const examples = gtmSkillsPromptForContext({ role, industry, methodology, limit: 4 });
    if (!examples) return prompt;
    return [
      prompt,
      '',
      '════════════════════════════════════════',
      'REAL GTM SKILL EXAMPLES (retrieved from gtm-skills library):',
      '════════════════════════════════════════',
      '',
      examples,
    ].join('\n');
  }

  /**
   * Retrieve the most relevant real GTM skill prompts for the given context.
   * Exposes the underlying retriever from gtmSkillsData for callers (e.g. the
   * GTM Boost modal) that want to show example-driven assistance offline.
   * @returns {Array} Array of { id, title, category, prompt, ... } prompt objects
   */
  getGtmSkillsExamples({ role, industry, methodology, limit = 6 } = {}) {
    return getRelevantGtmSkills({ role, industry, methodology, limit });
  }

  /**
   * Expose category metadata (roles, industries, methodologies, workflows)
   * sourced from the real gtm-skills library.
   */
  getGtmSkillsCategories() {
    return gtmSkillsCategories;
  }

  /**
   * Build the final optimized prompt
   */
  buildOptimizedPrompt({
    basePrompt,
    roleContent,
    industryContent,
    methodologyContent,
    tonalityContent,
    focusElements
  }) {
    const sections = [
      `🎯 ${roleContent.title} Video Prompt`,
      ``,
      `Role Context: ${roleContent.description}`,
      `Objectives: ${roleContent.objectives.join(', ')}`,
      ``,
      `Industry Focus: ${industryContent.description}`,
      `Key Considerations: ${industryContent.considerations.join(', ')}`,
      ``,
      `Sales Framework: ${methodologyContent.name}`,
      `Application: ${methodologyContent.application}`,
      ``,
      `Writing Style: ${tonalityContent.name}`,
      `Guidelines: ${tonalityContent.guidelines}`,
      ``
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

  /**
   * Get focus area elements
   */
  getFocusElement(area) {
    const found = (this.focusAreas || []).find((f) => f.id === area);
    return found ? found.description : undefined;
  }

  /**
   * Look up a focus area by id, returning the full { id, label, description }
   * record (or `undefined` when not found).
   */
  getFocusArea(id) {
    return (this.focusAreas || []).find((f) => f.id === id);
  }

  /**
   * Dropdown options for the GTM Boost modal's focus area checklist.
   */
  getFocusAreaOptions() {
    return (this.focusAreas || []).map((f) => ({ value: f.id, label: f.label, description: f.description, bestFor: f.bestFor, example: f.example, difficulty: f.difficulty }));
  }

  getModelOptions() {
    return this.modelOptions.map((m) => ({ value: m.id, label: m.label, description: m.description, bestFor: m.bestFor, example: m.example, difficulty: m.difficulty }));
  }

  getCinematicElementOptions() {
    return this.cinematicElements.map((c) => ({ value: c.id, label: c.label, description: c.description, bestFor: c.bestFor, example: c.example, difficulty: c.difficulty }));
  }

  getModelDescription(id) {
    return (this.modelOptions || []).find((m) => m.id === id)?.description || '';
  }

  getCinematicElementDescription(id) {
    return (this.cinematicElements || []).find((c) => c.id === id)?.description || '';
  }

  getFocusAreaDescription(id) {
    return (this.focusAreas || []).find((f) => f.id === id)?.description || '';
  }

  getRoleDescription(id) {
    return (this.roles || [])[id]?.description || '';
  }

  getIndustryDescription(id) {
    return (this.industries || [])[id]?.description || '';
  }

  getMethodologyDescription(id) {
    return (this.methodologies || [])[id]?.description || '';
  }

  getTonalityDescription(id) {
    return (this.tonalities || [])[id]?.description || '';
  }

  getRoleOptions() {
    return Object.entries(this.roles).map(([value, role]) => ({
      value,
      label: role.title,
      description: role.description || '',
      bestFor: role.bestFor || '',
      example: role.example || '',
      difficulty: role.difficulty || ''
    }));
  }

  getIndustryOptions() {
    return Object.entries(this.industries).map(([value, i]) => ({
      value,
      label: i.name,
      description: i.description || '',
      bestFor: i.bestFor || '',
      example: i.example || '',
      difficulty: i.difficulty || ''
    }));
  }

  getMethodologyOptions() {
    return Object.entries(this.methodologies).map(([value, m]) => ({
      value,
      label: m.name,
      description: m.description || '',
      bestFor: m.bestFor || '',
      example: m.example || '',
      difficulty: m.difficulty || ''
    }));
  }

  getTonalityOptions() {
    return Object.entries(this.tonalities).map(([value, t]) => ({
      value,
      label: t.name,
      description: t.description || '',
      bestFor: t.bestFor || '',
      example: t.example || '',
      difficulty: t.difficulty || ''
    }));
  }

  // ===== ROLE DEFINITIONS =====

  initializeRoles() {
    return {
      sdr: {
        title: 'SDR/BDR Prospecting',
        description: 'Sales Development Representative / Business Development Representative content for cold outreach and lead qualification',
        bestFor: 'Cold outreach sequences and early pipeline creation',
        example: '"I noticed your team scaled 40%—here’s how we cut ramp time in half."',
        difficulty: 'Easy',
        objectives: [
          'Generate qualified leads',
          'Create pipeline opportunities',
          'Establish initial contact and interest'
        ],
        primaryKPI: 'meeting bookings',
        templates: [
          'Pain-point identification and solution introduction',
          'Value proposition delivery with clear next steps',
          'Social proof and credibility establishment'
        ],
        promptStarters: [
          'Create a prospecting video that identifies common challenges in [industry]',
          'Develop a cold outreach video that demonstrates understanding of [pain points]',
          'Build a lead magnet video that provides immediate value'
        ]
      },

      ae: {
        title: 'Account Executive Discovery',
        description: 'Account Executive content for qualified prospects, discovery, and value demonstration',
        bestFor: 'Qualified opportunity follow-up and discovery calls',
        example: '"Walk me through how your team handles [workflow] today."',
        difficulty: 'Medium',
        objectives: [
          'Advance qualified opportunities',
          'Demonstrate ROI and business value',
          'Handle objections and concerns'
        ],
        primaryKPI: 'deal progression',
        templates: [
          'ROI calculation and business case development',
          'Competitive positioning and differentiation',
          'Risk mitigation and implementation planning'
        ],
        promptStarters: [
          'Create a discovery video that addresses [specific objection]',
          'Develop a value demonstration video showing [quantified benefits]',
          'Build a competitive positioning video against [competitor]'
        ]
      },

      'sales-manager': {
        title: 'Sales Management',
        description: 'Sales leadership content for team enablement and pipeline management',
        bestFor: 'Team coaching, hiring, and forecast reviews',
        example: '"Here’s the exact playbook that took our SDRs from 20 to 60 demos/month."',
        difficulty: 'Medium',
        objectives: [
          'Accelerate team performance',
          'Build management credibility',
          'Drive predictable revenue growth'
        ],
        primaryKPI: 'team productivity',
        templates: [
          'Performance analytics and coaching frameworks',
          'Hiring and onboarding best practices',
          'Revenue forecasting and pipeline management'
        ],
        promptStarters: [
          'Create a coaching video for [specific sales challenge]',
          'Develop a training video on [sales methodology]',
          'Build a pipeline review presentation for [quarter]'
        ]
      },

      'revops': {
        title: 'Revenue Operations',
        description: 'Revenue Operations content for process optimization and data-driven insights',
        bestFor: 'Operations enablement and stack alignment',
        example: '"We reduced lead-to-close time by 32% by fixing these three handoffs."',
        difficulty: 'Hard',
        objectives: [
          'Optimize revenue processes',
          'Improve data accuracy and reporting',
          'Streamline system integrations'
        ],
        primaryKPI: 'process efficiency',
        templates: [
          'Process mapping and optimization',
          'Data analysis and insights reporting',
          'System integration and automation'
        ],
        promptStarters: [
          'Create a process improvement video for [revenue stage]',
          'Develop a data insights presentation for [metric]',
          'Build a system integration guide for [tools]'
        ]
      },

      'customer-success': {
        title: 'Customer Success',
        description: 'Customer Success Management content for retention and expansion',
        bestFor: 'Onboarding, renewal, and expansion campaigns',
        example: '"You’re only getting 60% of the value—let’s fix that in 15 minutes."',
        difficulty: 'Medium',
        objectives: [
          'Reduce churn and increase retention',
          'Drive expansion revenue',
          'Improve customer health scores'
        ],
        primaryKPI: 'net revenue retention',
        templates: [
          'Onboarding and adoption programs',
          'Health scoring and intervention plays',
          'Renewal and expansion strategies'
        ],
        promptStarters: [
          'Create an onboarding video for [feature set]',
          'Develop a renewal campaign for [customer segment]',
          'Build an expansion playbook for [use case]'
        ]
      },

      executive: {
        title: 'Executive Leadership',
        description: 'Founder and executive content for strategic partnerships and vision communication',
        bestFor: 'Board updates, investor decks, and keynote narratives',
        example: '"We’re not building a feature—we’re rewriting the category."',
        difficulty: 'Hard',
        objectives: [
          'Communicate vision and strategy',
          'Build strategic partnerships',
          'Drive organizational alignment'
        ],
        primaryKPI: 'strategic influence',
        templates: [
          'Vision and mission storytelling',
          'Strategic partnership frameworks',
          'Change management and alignment'
        ],
        promptStarters: [
          'Create a vision video for [company direction]',
          'Develop a partnership announcement for [alliance]',
          'Build an all-hands presentation for [initiative]'
        ]
      }
    };
  }

  // ===== INDUSTRY DEFINITIONS =====

  initializeIndustries() {
    return {
      saas: {
        name: 'SaaS',
        description: 'Software as a Service solutions and subscription-based business models',
        considerations: [
          'User adoption and onboarding challenges',
          'Subscription pricing and perceived value',
          'Integration with existing tech stack',
          'Scalability and usage-based pricing',
          'Competitive positioning in crowded market'
        ],
        painPoints: [
          'High implementation costs and complexity',
          'User resistance to change',
          'Integration challenges with legacy systems',
          'Measuring ROI and user engagement'
        ],
        valueDrivers: [
          'Time-to-value and quick implementation',
          'Scalable usage and flexible pricing',
          'Continuous innovation and updates',
          'Lower total cost of ownership'
        ]
      },

      fintech: {
        name: 'FinTech',
        description: 'Financial technology and payment processing solutions',
        considerations: [
          'Regulatory compliance and security requirements',
          'Transaction processing reliability',
          'Integration with financial systems',
          'Risk management and fraud prevention',
          'Industry certifications and auditability'
        ],
        painPoints: [
          'Regulatory complexity and compliance burden',
          'Security vulnerabilities and data breaches',
          'Legacy system integration challenges',
          'Transaction processing bottlenecks'
        ],
        valueDrivers: [
          'Enhanced security and compliance automation',
          'Faster transaction processing',
          'Real-time financial insights',
          'Reduced operational risk'
        ]
      },

      healthcare: {
        name: 'Healthcare',
        description: 'Healthcare technology and patient care solutions',
        considerations: [
          'HIPAA compliance and patient data protection',
          'Clinical workflow integration',
          'Patient outcomes and care quality',
          'Regulatory compliance and certifications',
          'Integration with EHR and medical systems'
        ],
        painPoints: [
          'Regulatory compliance complexity',
          'Patient data security concerns',
          'Clinical workflow disruption',
          'Integration with existing medical systems'
        ],
        valueDrivers: [
          'Improved patient outcomes',
          'Streamlined clinical workflows',
          'Enhanced data security and compliance',
          'Better care coordination'
        ]
      },

      manufacturing: {
        name: 'Manufacturing',
        description: 'Manufacturing and industrial operations solutions',
        considerations: [
          'Operational efficiency and cost reduction',
          'Supply chain optimization',
          'Quality control and compliance',
          'Equipment integration and IoT',
          'Long sales cycles and technical evaluation'
        ],
        painPoints: [
          'Rising operational costs',
          'Supply chain disruptions',
          'Quality control challenges',
          'Legacy equipment integration'
        ],
        valueDrivers: [
          'Reduced operational costs',
          'Improved quality and compliance',
          'Enhanced supply chain visibility',
          'Predictive maintenance capabilities'
        ]
      },

      'professional-services': {
        name: 'Professional Services',
        description: 'Consulting, advisory, and professional service firms',
        considerations: [
          'Expertise demonstration and credibility',
          'ROI measurement and business impact',
          'Relationship building and trust establishment',
          'Service delivery methodology',
          'Competitive differentiation'
        ],
        painPoints: [
          'Measuring service value and ROI',
          'Building trust with new clients',
          'Differentiating from competitors',
          'Managing service delivery expectations'
        ],
        valueDrivers: [
          'Measurable business impact',
          'Proven methodologies and frameworks',
          'Strategic guidance and expertise',
          'Long-term partnership development'
        ]
      },

      // ===== EXPANDED INDUSTRIES (image/video creation context) =====
      'ecommerce': {
        name: 'E-commerce',
        description: 'Online retail and DTC brands selling through visual storefronts',
        considerations: [
          'Scroll-stopping product imagery and UGC',
          'Conversion-focused short-form video',
          'Seasonal campaign pacing and merchandising',
          'Retention via lifecycle creative'
        ],
        painPoints: [
          'Low ad creative ROI and fatigue',
          'Cart abandonment and weak retargeting',
          'Standing out in crowded feeds'
        ],
        valueDrivers: [
          'Higher ROAS from sharper creative',
          'Faster creative testing cycles',
          'Stronger brand recall at thumb-stop'
        ]
      },

      'real-estate': {
        name: 'Real Estate',
        description: 'Residential, commercial, and proptech selling via property visuals',
        considerations: [
          'Virtual tours and cinematic property walkthroughs',
          'Neighborhood and lifestyle b-roll',
          'Agent personal-brand video',
          'Listing differentiation'
        ],
        painPoints: [
          'Generic listings that don\'t convert',
          'Slow time-to-lead on new inventory',
          'Weak agent differentiation'
        ],
        valueDrivers: [
          'More qualified showings per listing',
          'Faster inventory movement',
          'Stronger agent authority'
        ]
      },

      'education': {
        name: 'Education',
        description: 'EdTech, universities, and training orgs selling learning outcomes',
        considerations: [
          'Student-journey explainer video',
          'Outcome and credential proof',
          'Parent/decision-maker reassurance creative',
          'Course launch campaigns'
        ],
        painPoints: [
          'Low enrollment from flat creative',
          'Complex value to communicate',
          'Long consideration cycles'
        ],
        valueDrivers: [
          'Higher inquiry and enrollment rates',
          'Clearer outcome messaging',
          'Trust-building for guardians'
        ]
      },

      'logistics': {
        name: 'Logistics & Supply Chain',
        description: 'Freight, warehousing, and supply-chain software and services',
        considerations: [
          'Operations-footage credibility',
          'Efficiency and cost-savings proof video',
          'Tracking/visibility product demos'
        ],
        painPoints: [
          'Long enterprise cycles',
          'Proving ROI of optimization',
          'Commoditized perception'
        ],
        valueDrivers: [
          'Demonstrated efficiency gains',
          'Shorter sales cycles',
          'Premium positioning'
        ]
      },

      'retail': {
        name: 'Retail & CPG',
        description: 'Brick-and-mortar and consumer-packaged-goods brand marketing',
        considerations: [
          'Shelf and lifestyle product video',
          'Promo and loyalty creative',
          'In-store experience storytelling'
        ],
        painPoints: [
          'Shelf invisibility',
          'Promo fatigue',
          'Thin margin on creative'
        ],
        valueDrivers: [
          'Lift at shelf and online',
          'Stronger brand love',
          'Efficient promo creative'
        ]
      },

      'media': {
        name: 'Media & Entertainment',
        description: 'Streaming, publishing, and studios selling audience attention',
        considerations: [
          'Trailer-style hype video',
          'Talent and creator-led creative',
          'Audience growth campaigns'
        ],
        painPoints: [
          'Subscriber churn',
          'Content discoverability',
          'Ad-block and fatigue'
        ],
        valueDrivers: [
          'Higher watch-through',
          'Stronger subscriber acquisition',
          'Viral reach'
        ]
      },

      'legal': {
        name: 'Legal & Compliance',
        description: 'Law firms and legal-tech selling trust and expertise',
        considerations: [
          'Authority-building thought-leadership video',
          'Case-result explainers',
          'Compliance reassurance creative'
        ],
        painPoints: [
          'Trust barriers',
          'Commoditized SEO',
          'Long client cycles'
        ],
        valueDrivers: [
          'More qualified intakes',
          'Clear expertise signal',
          'Differentiated firm brand'
        ]
      },

      'telecom': {
        name: 'Telecom & Connectivity',
        description: 'Connectivity, broadband, and communications providers',
        considerations: [
          'Coverage and speed proof video',
          'Plan-comparison creative',
          'Reliability and support reassurance'
        ],
        painPoints: [
          'Churn and switching friction',
          'Price-only competition',
          'Trust in uptime claims'
        ],
        valueDrivers: [
          'Lower churn',
          'Higher plan upgrades',
          'Credible reliability story'
        ]
      },

      'energy': {
        name: 'Energy & Clean Tech',
        description: 'Renewables, utilities, and climate-tech selling transformation',
        considerations: [
          'Impact and ESG storytelling video',
          'Infrastructure and scale proof',
          'Investor and community creative'
        ],
        painPoints: [
          'Long approval cycles',
          'Complex value to communicate',
          'Skepticism on claims'
        ],
        valueDrivers: [
          'Investor and buyer confidence',
          'Clearer impact narrative',
          'Faster adoption'
        ]
      },

      'nonprofit': {
        name: 'Nonprofit & Mission-Driven',
        description: 'Charities and mission orgs driving donations and awareness',
        considerations: [
          'Emotional beneficiary-story video',
          'Donor-journey explainers',
          'Campaign and event creative'
        ],
        painPoints: [
          'Donor fatigue',
          'Limited creative budget',
          'Hard-to-show impact'
        ],
        valueDrivers: [
          'Higher donation conversion',
          'Stronger recall',
          'Volunteer recruitment'
        ]
      },

      'government': {
        name: 'Government & Public Sector',
        description: 'Public agencies and govtech selling programs and services',
        considerations: [
          'Civic-trust explainer video',
          'Program awareness campaigns',
          'Accessibility-first creative'
        ],
        painPoints: [
          'Low program awareness',
          'Trust and credibility gaps',
          'Procurement complexity'
        ],
        valueDrivers: [
          'Higher program uptake',
          'Public trust',
          'Clearer service messaging'
        ]
      },

      'insurance': {
        name: 'Insurance',
        description: 'Carriers, brokers, and insurtech selling protection and peace of mind',
        considerations: [
          'Trust and reassurance video',
          'Policy and coverage explainers',
          'Claims-experience storytelling'
        ],
        painPoints: [
          'Low trust in the category',
          'Complex products to explain',
          'Price-led comparison'
        ],
        valueDrivers: [
          'Higher quote conversion',
          'Clearer coverage understanding',
          'Stronger brand trust'
        ]
      },

      'automotive': {
        name: 'Automotive & Mobility',
        description: 'Dealers, OEMs, and mobility tech selling vehicles and experiences',
        considerations: [
          'Cinematic vehicle showcase video',
          'Test-drive and lifestyle b-roll',
          'Feature and safety explainers'
        ],
        painPoints: [
          'Showroom footfall decline',
          'Long consideration cycles',
          'Commoditized listings'
        ],
        valueDrivers: [
          'More qualified leads',
          'Stronger test-drive bookings',
          'Premium brand perception'
        ]
      }
    };
  }

  // ===== METHODOLOGY DEFINITIONS =====

  initializeMethodologies() {
    return {
      meddpicc: {
        name: 'MEDDPICC',
        fullName: 'Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition',
        description: 'Enterprise sales qualification framework for complex B2B sales',
        application: 'Apply systematically to understand and navigate enterprise buying processes',
        elements: {
          metrics: 'Quantify business impact and ROI metrics',
          economicBuyer: 'Identify and engage executive decision makers',
          decisionCriteria: 'Map evaluation criteria and requirements',
          decisionProcess: 'Understand buying committee and timeline',
          paperProcess: 'Navigate procurement and legal processes',
          identifyPain: 'Uncover true business challenges and pain points',
          champion: 'Develop internal advocates and supporters',
          competition: 'Position against alternative solutions'
        }
      },

      spin: {
        name: 'SPIN Selling',
        fullName: 'Situation, Problem, Implication, Need-payoff',
        description: 'Consultative selling framework for complex solutions',
        application: 'Progress conversations from current state to solution value',
        elements: {
          situation: 'Understand current business situation and context',
          problem: 'Identify specific problems and challenges',
          implication: 'Explore impact of unsolved problems',
          'need-payoff': 'Demonstrate value of proposed solutions'
        }
      },

      challenger: {
        name: 'Challenger Sale',
        fullName: 'The Challenger Sale',
        description: 'Insight-driven sales approach that challenges customer assumptions',
        application: 'Teach customers, tailor communications, and take control of sales conversations',
        elements: {
          teach: 'Provide unique insights and industry knowledge',
          tailor: 'Customize messaging to specific customer situation',
          takeControl: 'Guide conversations strategically and assertively',
          buildTension: 'Create constructive tension around unsolved problems'
        }
      },

      'gap-selling': {
        name: 'Gap Selling',
        fullName: 'Gap Selling',
        description: 'Framework focusing on the gap between current and desired future state',
        application: 'Identify gaps and position solutions as bridges to desired outcomes',
        elements: {
          currentState: 'Assess existing capabilities and performance',
          futureState: 'Define desired outcomes and objectives',
          gapAnalysis: 'Identify difference between current and future state',
          fillGap: 'Position solution as bridge to desired future'
        }
      },

      'value-selling': {
        name: 'Value Selling',
        fullName: 'Value-Based Selling',
        description: 'Sales approach focused on quantifiable business value and ROI',
        application: 'Demonstrate tangible business impact and quantified results',
        elements: {
          businessValue: 'Focus on business outcomes and ROI',
          quantifiedValue: 'Include specific metrics and measurements',
          strategicValue: 'Demonstrate competitive advantage',
          personalValue: 'Address individual stakeholder benefits'
        }
      },

      sandler: {
        name: 'Sandler Selling',
        fullName: 'Sandler Selling System',
        description: 'Qualification-focused sales process with pain-based selling',
        application: 'Qualify prospects and focus on pain points throughout sales process',
        elements: {
          bondingRapport: 'Build trust and relationship foundation',
          pain: 'Identify and qualify business pain points',
          budget: 'Establish financial capability and constraints',
          decision: 'Map decision-making process and timeline',
          fulfillment: 'Demonstrate capability to deliver results',
          postSale: 'Address implementation and ongoing support'
        }
      }
    };
  }

  // ===== TONALITY DEFINITIONS =====

  initializeTonalities() {
    // 24 writing tonalities, reframed for GTM teams producing IMAGE + VIDEO
    // creative that sells to other GTM (sales/marketing/revops) buyers. Each
    // entry guides both the on-screen copy and the visual/shot direction.
    return {
      professional: {
        name: 'Professional',
        description: 'Clean, credible, polished tone for B2B image and video creative',
        guidelines: 'Use clear, confident language; steady pacing; neutral, well-lit framing; minimal but premium styling',
        examples: [
          'A clean product walkthrough with confident, measured voiceover',
          'Polished title cards with corporate-safe color grading'
        ]
      },

      executive: {
        name: 'Executive Gravitas',
        description: 'Formal, authoritative tone with strategic insights for boardroom-level video',
        guidelines: 'Sophisticated vocabulary, emphasis on vision/leadership, slow deliberate cuts, cinematic establishing shots',
        examples: [
          'Strategic transformation through innovative solutions',
          'Executive-level decision making captured in a slow aerial reveal'
        ]
      },

      challenger: {
        name: 'Challenger Bold',
        description: 'Confident, assertive tone that challenges assumptions in punchy video hooks',
        guidelines: 'Provocative insight-driven copy, hard cuts, high-contrast visuals, bold typography on screen',
        examples: [
          'The conventional approach is failing - here\'s why',
          'Fast hard-cut hook with bold text overlay and tense music'
        ]
      },

      conversational: {
        name: 'Conversational Peer',
        description: 'Friendly, relatable tone like talking to a trusted colleague on camera',
        guidelines: 'Use "we"/"you", casual framing (selfie/desk setup), natural lighting, relaxed pacing',
        examples: [
          'We\'ve all faced this challenge before',
          'Talking-head selfie style with soft natural light'
        ]
      },

      technical: {
        name: 'Technical Expert',
        description: 'Deep technical credibility for demo-heavy product videos and explainer images',
        guidelines: 'Industry terminology, screen-recorded UI demos, diagram overlays, precise labelling',
        examples: [
          'Leveraging advanced algorithms for optimization',
          'Annotated screen-recording with callout diagrams'
        ]
      },

      inspirational: {
        name: 'Inspirational Vision',
        description: 'Aspirational tone painting a future vision for brand/manifesto video',
        guidelines: 'Aspirational copy, sweeping b-roll, upward camera moves, warm uplifting color grade',
        examples: [
          'Imagine a future where challenges become opportunities',
          'Cinematic montage with rising score and golden-hour grade'
        ]
      },

      urgent: {
        name: 'Urgent Action',
        description: 'Time-sensitive, high-energy tone for limited-offer promo video',
        guidelines: 'Action verbs, countdown graphics, fast pacing, urgent sound design, red/amber accents',
        examples: [
          'The window for competitive advantage is closing',
          'Countdown timer overlay with driving percussion'
        ]
      },

      casual: {
        name: 'Casual Peer-to-Peer',
        description: 'Light, informal tone for social-first Reels/TikToks aimed at GTM peers',
        guidelines: 'Slang-light, punchy one-liners, vertical 9:16 framing, trending audio, quick cuts',
        examples: [
          'No cap - this changed how our SDRs book meetings',
          'Vertical selfie clip with trending sound and text stickers'
        ]
      },

      witty: {
        name: 'Witty & Clever',
        description: 'Humorous, clever copy for scroll-stopping social video and meme images',
        guidelines: 'Wordplay and light joke setups, comedic timing in edits, playful graphics',
        examples: [
          'Our CRM is so organized, even your inbox chills out',
          'Quick cut to a laughing rep with comedic sting'
        ]
      },

      empathetic: {
        name: 'Empathetic & Human',
        description: 'Warm, understanding tone for customer-story and retention video',
        guidelines: 'Validation-first copy, real customer faces, soft focus, gentle pacing, calm score',
        examples: [
          'We hear you - churn is hard, here\'s how teams win it back',
          'Sincere customer interview with shallow depth of field'
        ]
      },

      'data-driven': {
        name: 'Data-Driven',
        description: 'Number-led, proof-oriented tone for ROI/results video and stat graphics',
        guidelines: 'Lead with metrics, animated bar/line charts, clean infographic styling, confident narration',
        examples: [
          'Teams using this saw 3x pipeline in 90 days',
          'Animated stat callouts over a clean product shot'
        ]
      },

      storytelling: {
        name: 'Narrative Storytelling',
        description: 'Three-act story structure for case-study and founding-story video',
        guidelines: 'Setup-conflict-resolution arc, character-led b-roll, emotional music swell',
        examples: [
          'From a cramped garage to a 200-person revenue engine',
          'Character journey cut with rising narrative score'
        ]
      },

      authoritative: {
        name: 'Authoritative Expert',
        description: 'Commanding, credentialed tone for thought-leadership video',
        guidelines: 'Cite frameworks and proof, steady eye-contact framing, library/office settings, serious grade',
        examples: [
          'Three decades of enterprise selling prove this pattern',
          'Direct-to-camera expert with bookshelf backdrop'
        ]
      },

      minimalist: {
        name: 'Minimalist',
        description: 'Restrained, single-message tone for clean product hero images and videos',
        guidelines: 'One idea per frame, lots of negative space, muted palette, slow deliberate motion',
        examples: [
          'One feature. One clear win.',
          'Centered product on white with slow push-in'
        ]
      },

      luxury: {
        name: 'Luxury & Premium',
        description: 'High-end, exclusive tone for enterprise/ABM video and hero imagery',
        guidelines: 'Rich textures, slow motion, gold/black palette, elegant typography, no hard-sell',
        examples: [
          'Crafted for the teams that set the standard',
          'Macro slow-motion of premium material details'
        ]
      },

      playful: {
        name: 'Playful & Fun',
        description: 'Bright, energetic tone for culture and top-of-funnel social video',
        guidelines: 'Bright palette, bouncy edits, emoji-style graphics, upbeat quirky music',
        examples: [
          'Selling doesn\'t have to be boring - promise.',
          'Bouncy cut with confetti transitions'
        ]
      },

      bold: {
        name: 'Bold & Disruptive',
        description: 'Loud, category-breaking tone for brand-launch video',
        guidelines: 'Oversized type, saturated color, fast aggressive cuts, statement voiceover',
        examples: [
          'We\'re not another tool. We\'re the reset.',
          'Saturated flash cuts with heavy bass drop'
        ]
      },

      educational: {
        name: 'Educational',
        description: 'Clear teaching tone for how-to and explainer video/image carousels',
        guidelines: 'Step-by-step structure, pointer/arrow overlays, calm narration, clean whiteboard style',
        examples: [
          'Step 1: Map the buying committee. Step 2: ...',
          'Screen-recorded tutorial with pointer annotations'
        ]
      },

      trustworthy: {
        name: 'Trustworthy & Reassuring',
        description: 'Calm, dependable tone for security/compliance and onboarding video',
        guidelines: 'Plain language, steady pacing, soft blue/green palette, real-environment shots',
        examples: [
          'Your data stays yours - here\'s exactly how',
          'Calm explainer with reassuring ambient score'
        ]
      },

      energetic: {
        name: 'Energetic & Upbeat',
        description: 'High-tempo, motivating tone for event/launch hype video',
        guidelines: 'Fast cuts, rising tempo, bright colors, crowd/confetti energy, driving beat',
        examples: [
          'This is the year your pipeline explodes',
          'Rapid montage with rising EDM build'
        ]
      },

      sophisticated: {
        name: 'Sophisticated & Refined',
        description: 'Understated elegance for premium B2B brand films',
        guidelines: 'Subtle motion, refined palette, elegant serif type, restrained music',
        examples: [
          'Quietly powerful tools for ambitious teams',
          'Slow elegant dolly with refined color grade'
        ]
      },

      direct: {
        name: 'Direct & No-Fluff',
        description: 'Blunt, benefit-first tone for bottom-funnel conversion video',
        guidelines: 'Front-load the offer, plain words, punch-in cuts, clear CTA card',
        examples: [
          'Book more demos. Here\'s the exact play.',
          'Punch-in to CTA card with arrow pointer'
        ]
      },

      friendly: {
        name: 'Friendly & Welcoming',
        description: 'Warm invite tone for webinar and community onboarding video',
        guidelines: 'Inviting copy, open body language, bright airy set, gentle uplifting music',
        examples: [
          'Pull up a chair - let\'s build your funnel together',
          'Welcoming host at a bright desk setup'
        ]
      },

      dramatic: {
        name: 'Dramatic & Cinematic',
        description: 'High-stakes, cinematic tone for hero/brand film',
        guidelines: 'Low-key lighting, orchestral swell, slow-mo hero moment, deep contrast grade',
        examples: [
          'Every deal is a decision that changes everything',
          'Cinematic slow-mo with orchestral climax'
        ]
      },

      'peer-comparison': {
        name: 'Social Proof / Peer Comparison',
        description: 'Comparison-led tone for competitive-displacement video',
        guidelines: 'Show "them vs you" split screens, benchmark charts, confident neutral narration',
        examples: [
          'Their stack vs your stack - here\'s the gap',
          'Split-screen comparison with benchmark bars'
        ]
      }
    };
  }

  // ===== WORKFLOW DEFINITIONS =====

  initializeWorkflows() {
    return {
      'cold-to-close': {
        name: 'Cold to Close',
        description: 'Complete sales cycle from initial outreach to deal closure',
        stages: [
          'Cold Outreach & Lead Generation',
          'Initial Qualification & Discovery',
          'Needs Assessment & Solution Design',
          'Proposal & Negotiation',
          'Implementation & Onboarding',
          'Post-Sale Support & Expansion'
        ]
      },

      discovery: {
        name: 'Discovery Mastery',
        description: 'Advanced discovery and qualification process',
        stages: [
          'Initial Contact & Rapport Building',
          'Situation Analysis & Context Setting',
          'Pain Point Identification & Validation',
          'Implication Exploration & Impact Assessment',
          'Solution Value Demonstration',
          'Next Steps & Commitment'
        ]
      },

      'demo-proposal': {
        name: 'Demo to Proposal',
        description: 'Technical validation to commercial agreement',
        stages: [
          'Demo Preparation & Planning',
          'Technical Demonstration',
          'Objection Handling & Clarification',
          'Business Value Reinforcement',
          'Proposal Development',
          'Terms Negotiation & Close'
        ]
      }
    };
  }
}

// Export singleton instance
export const gtmContentLibrary = new GTMContentLibrary();
export default gtmContentLibrary;