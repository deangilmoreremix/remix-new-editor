/**
 * GTM Content Library - Comprehensive GTM methodologies and templates
 * Based on gtm-skills.com repository structure and content
 * Provides role-based playbooks, industry frameworks, and sales methodologies
 */

import { getRelevantGtmSkills, gtmSkillsPromptForContext, gtmSkillsCategories } from './gtmSkillsData.js';

class GTMContentLibrary {
  constructor() {
    this.roles = this.initializeRoles();
    this.industries = this.initializeIndustries();
    this.methodologies = this.initializeMethodologies();
    this.tonalities = this.initializeTonalities();
    this.workflows = this.initializeWorkflows();
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
   * Ordered dropdown data for the GTM Boost modal. Each entry is
   * { value, label }. Order is preserved from the underlying maps so the
   * UI stays in sync with the library's canonical content.
   */
  getRoleOptions() {
    return Object.entries(this.roles).map(([value, r]) => ({ value, label: r.name }));
  }

  getIndustryOptions() {
    return Object.entries(this.industries).map(([value, i]) => ({ value, label: i.name }));
  }

  getMethodologyOptions() {
    return Object.entries(this.methodologies).map(([value, m]) => ({ value, label: m.name }));
  }

  getTonalityOptions() {
    return Object.entries(this.tonalities).map(([value, t]) => ({ value, label: t.name }));
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
    const elements = {
      'lead-gen': 'Lead generation with contact capture',
      awareness: 'Brand awareness and market education',
      education: 'Educational content and knowledge sharing',
      demo: 'Product demonstration and capability showcase'
    };
    return elements[area];
  }

  // ===== ROLE DEFINITIONS =====

  initializeRoles() {
    return {
      sdr: {
        title: 'SDR/BDR Prospecting',
        description: 'Sales Development Representative / Business Development Representative content for cold outreach and lead qualification',
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
        objectives: [
          'Accelerate team performance',
          'Build management credibility',
          'Drive revenue growth'
        ],
        primaryKPI: 'team quota attainment',
        templates: [
          'Team capability showcase and success stories',
          'Market intelligence and competitive insights',
          'Strategic planning and market expansion'
        ],
        promptStarters: [
          'Create a leadership video demonstrating [team capability]',
          'Develop a market intelligence video sharing [industry insight]',
          'Build a strategic planning video for [market opportunity]'
        ]
      },

      revops: {
        title: 'Revenue Operations',
        description: 'Revenue Operations content for process optimization and data-driven insights',
        objectives: [
          'Improve operational efficiency',
          'Enhance data accuracy and insights',
          'Optimize sales processes and automation'
        ],
        primaryKPI: 'operational efficiency gains',
        templates: [
          'Process optimization and automation benefits',
          'Data-driven decision making frameworks',
          'Performance analytics and forecasting'
        ],
        promptStarters: [
          'Create a process optimization video showing [efficiency gains]',
          'Develop an analytics video demonstrating [data insights]',
          'Build an automation video highlighting [time savings]'
        ]
      },

      csm: {
        title: 'Customer Success',
        description: 'Customer Success Management content for retention and expansion',
        objectives: [
          'Reduce customer churn',
          'Identify expansion opportunities',
          'Build long-term customer loyalty'
        ],
        primaryKPI: 'customer retention and expansion',
        templates: [
          'Customer onboarding and adoption acceleration',
          'Value realization and ROI demonstration',
          'Relationship building and proactive support'
        ],
        promptStarters: [
          'Create an onboarding video that accelerates [customer time-to-value]',
          'Develop a success story video showcasing [customer results]',
          'Build an expansion video identifying [growth opportunities]'
        ]
      },

      founder: {
        title: 'Executive Leadership',
        description: 'Founder and executive content for strategic partnerships and vision communication',
        objectives: [
          'Build strategic relationships',
          'Communicate company vision',
          'Drive executive-level engagement'
        ],
        primaryKPI: 'strategic partnership development',
        templates: [
          'Vision communication and market positioning',
          'Strategic partnership development',
          'Executive decision-making frameworks'
        ],
        promptStarters: [
          'Create a vision video communicating [strategic direction]',
          'Develop a partnership video for [target executive audience]',
          'Build a positioning video establishing [market leadership]'
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