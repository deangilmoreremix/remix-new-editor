import type { Lesson } from '../lesson-types';

export const LESSONS_09: Lesson[] = [
  {
    id: '09-ai-real-estate-staging::01-empty-room-to-staged-room',
    slug: '09-ai-real-estate-staging::01-empty-room-to-staged-room',
    order: 1,
    title: 'Empty Room → Staged Room Pipeline',
    summary:
      'Transform vacant properties into high-converting luxury homes in minutes using depth-aware AI inpainting.',
    time: '~40 minutes',
    prerequisites: ['Basic understanding of image generation prompts'],
    problem:
      'Vacant listings feel smaller and colder than furnished ones — NAR says 81% of buyers visualize a staged home better, and staged homes sell for up to 20% more. Physical staging costs $2,500–$5,000+/month and takes 3–7 days. Low-end 3D edits look flat and float above the floor. You need fast, photorealistic staging that respects room geometry.',
    concept: [
      'Staging pipeline: Empty Room → Depth Mask → Perspective Alignment → Inpaint Furniture → Shadow & Reflection Match.',
      'Perspective-lock to the photo\'s vanishing point so furniture is not skewed or distorted.',
      'Depth preserving keeps floor planes, baseboards and window light intact under the new furniture.',
      'Style presets target buyers: Modern Scandinavian, Contemporary Luxury, Coastal Modern.',
      'ControlNet Depth (~0.75) enforces floor geometry while the model generates 3D furniture volumes.',
      'Realism is sold at the contact shadow: legs touch the floor with tight ambient-occlusion shadows.',
    ],
    doIt: [
      'Capture a straight, well-lit high-res wide-angle photo of the vacant room; save `empty-room-source.jpg`.',
      'Mask 60–70% of the open floor, leaving windows, fireplaces and structural walls untouched.',
      'Write a depth-aware prompt anchored to the room (style, furniture, light) plus a negative list (warped floor, floating objects).',
      'Inpaint with FLUX/muapi at ControlNet Depth weight 0.75 and matching aspect ratio.',
      'Verify at 100%: legs contact the floor, highlights match the window light direction.',
      'Export `staged-living-room.jpg` at 3000px+ wide for MLS/Zillow/Redfin.',
    ],
    launchIt: [
      'Price per photo $35–$50; full 5-room listing package $149–$199.',
      'Deliver high-res JPEGs within 24 hours for MLS and Zillow/Redfin uploads.',
      'Lead with the math: ~$0.06 AI cost vs a $3,200 traditional staging quote.',
    ],
    exercises: [
      'Easy: photograph or download an empty room; identify the vanishing point and window light source.',
      'Medium: inpaint a modern sofa and coffee table while preserving original flooring and walls.',
      'Hard: stage the same room in Modern Scandinavian and Industrial Loft with matched perspective.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '09-ai-real-estate-staging::living-room-staging-motion',
      '09-ai-real-estate-staging::staged-living-room',
    ],
  },
  {
    id: '09-ai-real-estate-staging::02-pricing-against-traditional-staging',
    slug: '09-ai-real-estate-staging::02-pricing-against-traditional-staging',
    order: 2,
    title: 'Pricing Against Traditional Staging',
    summary:
      'Frame AI virtual staging not as a cheap compromise, but as a high-ROI velocity engine for real estate agents.',
    time: '~35 minutes',
    prerequisites: ['01: Empty Room → Staged Room Pipeline'],
    problem:
      'Creators underprice at $5–$10/photo against low-quality 3D clip-art, while agents spend $2,500–$6,000 on physical staging and assume $10 AI output is junk. Without articulating the economic trade-off, you lose high-ticket, high-volume clients.',
    concept: [
      'Shift the sale from cost-per-image to speed, market velocity and listing ROI.',
      'DOM reduction: every vacant day costs ~$100–$250 in carrying costs; AI staging goes live in 24h.',
      'Anchor against the $3,000 physical quote — a $199 full-home package is a 93% saving at 95% of the impact.',
      'High-margin add-ons: decluttering (+$25/photo), virtual twilight (+$30), motion clips (+$40/clip).',
      'Unit economics: ~$0.06/room render; a $199 package leaves ~99% gross margin.',
      'Tiered packaging (Essential $99 / Full House $199 / Luxury Pass $399) removes buyer hesitation.',
    ],
    doIt: [
      'Benchmark local physical staging (setup $1.5–2.5k, rental $1–2k/mo) into the pricing sheet.',
      'Define three tiered packages with room counts, revisions and turnaround.',
      'Compute gross margin per package (revenue minus ~$0.41 production cost).',
      'Build a 1-page comparison deck: physical ($3,500, 5 days) vs your AI ($199, 24h, 3 styles).',
      'Quote agents against the physical number, never against $10 freelancers.',
      'Require 100% upfront payment and limit to 1 free style revision per photo.',
    ],
    launchIt: [
      'Collect full payment via Stripe before releasing unwatermarked MLS files.',
      'Charge $15/photo for style changes beyond the first free revision.',
      'Pitch the velocity: 24-hour live listing versus a 5-day physical wait.',
    ],
    exercises: [
      'Easy: fill the pricing sheet with prices tailored to your local market.',
      'Medium: calculate margin on a $299 package (8 photos + 1 twilight + 2 clips).',
      'Hard: build a 1-page before/after PDF pitching a luxury realtor vs empty listing photos.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '09-ai-real-estate-staging::bedroom-staging-motion',
      '09-ai-real-estate-staging::staged-bedroom-luxury',
    ],
  },
  {
    id: '09-ai-real-estate-staging::03-selling-to-realtors-and-agencies',
    slug: '09-ai-real-estate-staging::03-selling-to-realtors-and-agencies',
    order: 3,
    title: 'Selling to Realtors & Agencies',
    summary:
      'Turn active vacant property listings into recurring monthly agency retainers through targeted before/after audits.',
    time: '~45 minutes',
    prerequisites: [
      '01: Empty Room Pipeline',
      '02: Pricing & Packaging',
    ],
    problem:
      'Most creators fail at acquisition — spamming "I do AI staging for $10" to agents who delete it. Agents are drowning in generic pitches, but those with vacant listings sitting 20+ days on market are actively losing money and will listen to a relevant, proof-led message.',
    concept: [
      'The "Active Vacant Listing" audit: Find Listing → Sample Staging → Personalized Audit → Close Retainer.',
      'Precision prospecting: filter Zillow/Redfin for vacant, 14–20+ DOM listings in your area.',
      'Free transformation hook: stage one of their rooms, show the striking before/after.',
      'Hyper-personalized outreach: send their exact room transformed before asking for anything.',
      'Brokerage retainer lock: convert a happy 24h delivery into a $499–$1,299/month pass.',
      'Partner photographers (20–50 homes/mo) on a 30% white-label split to scale reach.',
    ],
    doIt: [
      'Scan Zillow/Redfin for active vacant listings 14+ days on market; log 10 agent names/emails/brokerages.',
      'Download the hero empty living room of listing #1 and stage it in Modern Scandinavian.',
      'Send the personalized cold email with their before/after embedded, offering the master bedroom next.',
      'For $1M+ listings, record a 60s Loom: their empty photo, your staging, 3 style options.',
      'After the first delivery, present the Brokerage Pass ($699/mo, up to 5 properties/30 photos).',
      'Add a subtle "Virtually Staged for Visualization" mark if the local MLS board requires it.',
    ],
    launchIt: [
      'Offer photographers a 30% white-label commission ($50/house) to sell into their agent base.',
      'Check MLS compliance for virtual-staging disclosure watermarks per board.',
      'Convert wins into monthly retainers, not one-off $199 sales, for recurring revenue.',
    ],
    exercises: [
      'Easy: find 3 active vacant listings in your zip code and download one empty room each.',
      'Medium: stage the 3 rooms and assemble 3 before/after comparison graphics.',
      'Hard: write 3 personalized cold emails with before/after graphics and send to the agents.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '09-ai-real-estate-staging::empty-to-staged-before-after',
    ],
  },
];
