// Typed lesson data for the AI Freelancing & Agency Business track (track 14).
// Structured form of the upstream markdown in
// src/content/academy/14-ai-freelancing-and-agency-business/lessons/*.md,
// powering the LEARN view. Matched to catalog lessons by `id`.

export const LESSONS_14 = [
  {
    id: '14-ai-freelancing-and-agency-business::01-pricing-your-services',
    slug: '14-ai-freelancing-and-agency-business::01-pricing-your-services',
    order: 1,
    title: 'Module 1: Pricing Your Services',
    summary:
      'Moving from hourly billing trap to value-based pricing, high-margin package tiers, retainer math, and contract anchoring for AI creation services.',
    time: '',
    prerequisites: [],
    problem:
      'AI workflows make you 10x–50x faster than manual production. If you bill by the hour, getting faster makes you poorer — a 20-hour headshot job becomes a $75 invoice instead of $1,000. The fix is to charge for the business value delivered, not the minutes your GPU ran.',
    concept: [
      'Never charge for time. Charge for the commercial value the deliverable creates for the client.',
      'Value-based fee ≈ 25–40% of the traditional replacement cost (e.g. $7,500 vs a $28k photography quote).',
      'Always present 3 tiers; the middle "recommended" tier anchors the decision away from price haggling.',
      'Retainers ($3,000–$10,000/mo) smooth the revenue rollercoaster of one-off projects.',
      'When a client asks for a discount, trade price for scope — never cut price alone.',
      'Net margin on AI delivery is often 98%+ because COGS (API + compute + QA) is tiny.',
    ],
    doIt: [
      'Set your project floor at $1,500; never quote under $1,000.',
      'Benchmark local traditional production rates (shoot days, retouching) to anchor your value-based number.',
      'Use the agency pricing calculator to compute exact gross margin before sending any proposal.',
      'Write 3 tiers (Essentials / Professional / Enterprise) with Tier 2 flagged "Recommended".',
      'Convert repeat clients into a monthly retainer with a defined deliverable count.',
      'On discount asks, reply with a scope-reduced version at the lower budget — never a bare price cut.',
    ],
    launchIt: [
      'Anchor every quote to the traditional replacement cost you are saving the client.',
      'Lead with a 3-tier menu so the buyer picks a package, not whether to hire you.',
      'Package recurring delivery as a retainer to build predictable $20k+/mo revenue.',
    ],
    exercises: [
      'Easy: write a 3-tier price menu for one AI service you could sell (name, price, deliverables each).',
      'Medium: take a real $28k traditional quote and compute your 30% value-based fee and net margin.',
      'Hard: draft a retainer proposal (scope, monthly count, price, revision rounds) for one client type.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '14-ai-freelancing-and-agency-business::agency-pricing-deck-mockup',
      '14-ai-freelancing-and-agency-business::agency-pricing-deck-motion',
    ],
  },
  {
    id: '14-ai-freelancing-and-agency-business::02-contracts-and-scope-basics',
    slug: '14-ai-freelancing-and-agency-business::02-contracts-and-scope-basics',
    order: 2,
    title: 'Module 2: Contracts & Scope Basics',
    summary:
      'Structuring bulletproof Master Services Agreements (MSA), Statements of Work (SOW), revision caps, milestone payment schedules, and AI copyright/IP assignment clauses.',
    time: '',
    prerequisites: [],
    problem:
      'Traditional creative contracts assume human labor and linear timelines. Clients who think "AI makes images in seconds" will demand infinite free revisions, claim ownership of your prompt libraries and LoRAs, and push back on AI copyright — unless every relationship is governed by airtight clauses.',
    concept: [
      'Two agreements: an MSA governs the whole relationship; an SOW defines one project\'s deliverables and fees.',
      'Revision caps (e.g. 2 rounds) stop scope creep; anything structural becomes a paid change order.',
      'Milestone billing: 50% non-refundable deposit, 25% on watermarked draft, 25% on final handover.',
      'Final commercial license transfers to the client; your internal prompt graphs and LoRA weights stay yours.',
      'Client input warranty makes the client liable for any trademarked/copyrighted reference material they supply.',
      'Never release un-watermarked masters before 100% payment — it kills your leverage.',
    ],
    doIt: [
      'Adopt a master services agreement and customize it per client.',
      'Write explicit revision limits (count + what counts as a revision) into every SOW.',
      'Require a 50% non-refundable deposit before any render or prompt run starts.',
      'Deliver low-res watermarked proofs for the draft milestone, masters only at final payment.',
      'Add a clause reserving your background IP (prompts, node graphs, LoRA weights).',
      'Add a client input warranty + indemnification clause for supplied brand assets.',
    ],
    launchIt: [
      'Bill a paid change-order rate ($150/hr) for out-of-scope revisions — protect your margin.',
      'Use watermarked proofing as standard delivery so late-payment clients can\'t hold you hostage.',
      'Sell "enterprise IP transfer" as a premium tier differentiator in your 3-tier menu.',
    ],
    exercises: [
      'Easy: list the 5 mandatory clauses and write one-sentence plain-English versions of each.',
      'Medium: draft a 2-round revision cap clause for a 25-render project.',
      'Hard: write a milestone payment schedule (deposit/draft/final) with exact percentages and release conditions.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '14-ai-freelancing-and-agency-business::client-dashboard-metrics',
      '14-ai-freelancing-and-agency-business::client-dashboard-motion',
    ],
  },
  {
    id: '14-ai-freelancing-and-agency-business::03-finding-and-closing-clients',
    slug: '14-ai-freelancing-and-agency-business::03-finding-and-closing-clients',
    order: 3,
    title: 'Module 3: Finding & Closing Clients',
    summary:
      'High-converting outbound cold email frameworks, LinkedIn B2B social selling, discovery call structure, and objection-handling playbooks for commercial AI agencies.',
    time: '',
    prerequisites: [],
    problem:
      'Most new AI creators pitch local consumer businesses (restaurants, salons) with $200–$500 budgets. To build a $20k+/mo agency you must target high-LTV B2B buyers who already spend $20k+/quarter on production and can feel a 30% cost cut immediately.',
    concept: [
      'Target B2B buyers with existing production budgets: brokerages, remote SaaS/HR, e-commerce apparel brands.',
      'Cold email under 100 words: trigger hook + value prop + social proof + low-friction CTA.',
      'Lead with a finished, product-specific sample, not a capabilities pitch.',
      'Discovery call = 20 min: frame, uncover pain, show live demo, present 3 tiers and take deposit.',
      'Objection handling frames AI as enterprise pipeline engineering, not prompt typing.',
      'Loom video prototypes of the prospect\'s actual asset out-convert text by a wide margin.',
    ],
    doIt: [
      'Build a 100-lead B2B prospect list (LinkedIn Sales Navigator or Apollo.io).',
      'Write a 4-sentence cold email: recent trigger, replacement-cost value, similar result, 30-sec demo ask.',
      'Record a 60-second Loom prototype built for the specific prospect\'s product.',
      'Run the discovery call: quantify their past 12-month production spend, then show a before/after demo.',
      'Present 3 tiers and secure a deposit commitment before ending the call.',
      'Prep 3 objection scripts (AI looks cheap, intern uses Midjourney, no budget).',
    ],
    launchIt: [
      'Outreach to brands already running paid production; lead with a sample for their actual product.',
      'Position as enterprise pipeline + commercial IP indemnification, not "I use AI".',
      'Convert a won discovery call into a deposit-backed SOW using the contract module.',
    ],
    exercises: [
      'Easy: write one 4-sentence cold email to a real SaaS or brokerage with a trigger hook.',
      'Medium: build a 100-lead target list in a spreadsheet with budget column.',
      'Hard: script a 20-minute discovery call including 3 pain questions and 3 objection responses.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [],
  },
  {
    id: '14-ai-freelancing-and-agency-business::04-scaling-from-freelancer-to-small-agency',
    slug: '14-ai-freelancing-and-agency-business::04-scaling-from-freelancer-to-small-agency',
    order: 4,
    title: 'Module 4: Scaling from Freelancer to Small Agency',
    summary:
      'Operational Standard Operating Procedures (SOPs), hiring offshore AI operators, protecting profit margins, and delegation frameworks for $20k+/month agencies.',
    time: '',
    prerequisites: [],
    problem:
      'Around $8k–$10k/mo you hit the solo bottleneck: every hour goes to prompt runs and editing, outbound stops, and revenue flatlines because you cannot take client #6 without working 80-hour weeks. Scaling means shifting from operator to creative director.',
    concept: [
      'The bottleneck is you; escape it by moving from Prompt Operator to Creative Director + Account Executive.',
      'SOPs must be written and screen-recorded — verbal Slack instructions do not delegate.',
      'Offshore operators ($12–$25/hr) handle prompt runs and post-production while you keep 80%+ net margin.',
      'A 2-tier QC gate (operator → internal audit → director sign-off → client) protects reputation.',
      'Each delegated role should add far more revenue than its monthly cost.',
      'Structured comms (#sales-leads, #active-production, #qc-audit, #client-delivery) keep chaos out.',
    ],
    doIt: [
      'Record your next project with Loom, then transcribe it into 3 written SOPs.',
      'Post an "AI Media Production Operator" role on Upwork or OnlineJobs.ph.',
      'Set up agency Slack + ClickUp with production-stage channels.',
      'Define a 2-tier QC checklist (symmetry, 300 DPI, no artifacts, brand color match).',
      'Hand off prompt execution and editing; keep client strategy and final sign-off.',
      'Track net margin per role to confirm each hire returns more than it costs.',
    ],
    launchIt: [
      'Sell retainers you can fulfill via a small offshore team, not just solo capacity.',
      'Package SOPs as an asset you own — they make each new hire productive in days.',
      'Protect an 80%+ net margin floor as the headline proof your agency model works.',
    ],
    exercises: [
      'Easy: write one SOP (objective, tools, steps, time) for a task you do repeatedly.',
      'Medium: model a 3-person offshore team cost vs revenue and compute net margin.',
      'Hard: design a 2-tier QC gate with a pass/fail checklist for a real deliverable.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [],
  },
  {
    id: '14-ai-freelancing-and-agency-business::05-building-a-portfolio-that-sells',
    slug: '14-ai-freelancing-and-agency-business::05-building-a-portfolio-that-sells',
    order: 5,
    title: 'Module 5: Building a Portfolio That Sells',
    summary:
      'Designing ROI-driven client case studies, before/after metrics, interactive demo portals, and social proof frameworks that close high-ticket retainers.',
    time: '',
    prerequisites: [],
    problem:
      'Most creators build art-gallery portfolios — grids of cool renders with no client names or metrics. High-ticket buyers (CMOs, VPs, e-commerce directors) do not buy art; they buy solutions to expensive problems. Your portfolio must read like ROI, not a gallery.',
    concept: [
      'Replace the art gallery with commercial case studies built on hard business outcomes.',
      '4-part case study: client & challenge → AI pipeline → quantifiable ROI → testimonial.',
      'Show exact dollars saved, speedup factor, and employee-hours reclaimed in a table.',
      'Interactive before/after sliders beat static PNGs at proving 8k render quality live.',
      'Video motion loops and downloadable sample bundles let buyers inspect quality themselves.',
      'Video testimonials from real clients close far better than written quotes alone.',
    ],
    doIt: [
      'Convert your 3 best past projects into 4-part commercial case studies.',
      'Calculate exact cost savings and turnaround speedup for each project.',
      'Build an interactive demo portal (Notion/Webflow/Framer/HTML) with before/after sliders.',
      'Add a metrics table: traditional cost vs AI cost, days vs hours, downtime saved.',
      'Request a 30-second smartphone video testimonial from a satisfied client.',
      'Lead every case-study headline with the saved amount, not the tool used.',
    ],
    launchIt: [
      'Use a live case study on sales calls as the proof that you save buyers real money.',
      'Gate a downloadable 8k sample bundle behind a lead-capture email.',
      'Refresh case studies quarterly so retainers see ongoing momentum.',
    ],
    exercises: [
      'Easy: rewrite one portfolio headline from "cool render" to "$ saved" format.',
      'Medium: build a 4-part case study with a real metrics table for one past project.',
      'Hard: stand up an interactive before/after demo portal and embed a client video testimonial.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [],
  },
];
