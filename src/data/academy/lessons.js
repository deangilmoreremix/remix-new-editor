// Typed lesson data for the AI Video Ads & UGC Academy track (track 01).
// Extracted from tracks/01-ai-video-ads-ugc lessons (see src/content/academy/ugc/lessons
// for the verbatim upstream markdown). This structured form powers the LEARN view
// and is decoupled from the upstream repo at runtime.
//
// Track 01's rich lessons live inline below. Tracks 02–15 each live in their own
// file under src/data/academy/lessons/*.ts and are aggregated in ACADEMY_LESSONS
// via the import block near the bottom of this file.

import type { Lesson } from './lesson-types';
export type { Lesson } from './lesson-types';

export const ACADEMY_LESSONS_TRACK01: Lesson[] = [
  {
    id: 'how-ugc-works',
    slug: 'how-ugc-works',
    order: 1,
    title: 'How AI UGC Actually Works',
    summary:
      'A UGC ad is five pieces stitched together. Learn the pipeline so you can make any of them.',
    time: '~45 min',
    prerequisites: [],
    problem:
      'Brands pay real creators $200–$1,500 per UGC ad, but sourcing, briefing and filming humans does not scale. AI UGC solves scaling — yet most first attempts fail on inconsistent faces or fake lip-sync.',
    concept: [
      'A UGC ad is 5 stages: Script → Avatar/Voice → Video → Captions → Export.',
      'Script — conversational hook + pitch + CTA, written like a person talks.',
      'Avatar/Voice — generated talking-head, or a reference image animated with lip-sync.',
      'Video — the performance plus b-roll (product shots, screen recordings).',
      'Captions — burned-in, because most viewers watch muted.',
      'Export — aspect ratio matched to platform (9:16 for Reels/TikTok/Shorts).',
      'The weak link is usually avatar face/voice sync, not the script.',
    ],
    doIt: [
      'Write a script under 30s (~75–90 words): hook (0–2s), problem/pitch (2–15s), proof/demo (15–25s), CTA (25–28s).',
      'Generate the voice with TTS/voice-clone; make 2–3 takes varying pacing and emphasis.',
      'Generate or animate the avatar (text-to-video, or lip-sync an image to the audio).',
      'Cut in b-roll during the pitch/proof section to hide imperfect stretches.',
      'Caption and export at 9:16 for short-form.',
      'Ship check: watch once muted (does the hook work from captions?) and once at normal volume.',
    ],
    launchIt: [
      'Price by deliverable ($150 for 5 ad variants), not by hour.',
      'Position on the business outcome (more variants to test, faster) — not the AI process.',
      'First clients: DTC brands visibly running paid social ads; send a sample ad for their actual product.',
    ],
    exercises: [
      'Easy: write three 30s UGC scripts for a product you use (hook/pitch/proof/CTA).',
      'Medium: produce one full ad end-to-end (script → voice → avatar → captions → export).',
      'Hard: produce 5 variants of the same ad and compare which hook you expect to win.',
    ],
    relatedTemplateIds: ['ugc-script', 'ad-brief'],
    relatedAssetIds: ['character-anchor', 'gripmount-hook-clip'],
  },
  {
    id: 'character-consistency',
    slug: 'character-consistency',
    order: 2,
    title: 'Character & Face Consistency',
    summary:
      'If your AI creator looks like a different person every shot, nobody pays for the ad.',
    time: '~40 min',
    prerequisites: ['how-ugc-works'],
    problem:
      'The same "character" comes out as a slightly different person each generation. For a UGC campaign, influencer or faceless host this is disqualifying — viewers notice immediately and clients reject the work.',
    concept: [
      'Consistency comes from giving the model an "anchor" it cannot drift from.',
      'Prompt-only consistency is weakest — text is ambiguous, the model fills gaps differently.',
      'Reference-image consistency is much stronger — feed a photo alongside the prompt.',
      'Fine-tuned/locked identity (LoRA) is strongest and most portable, but needs setup.',
      'A fixed seed helps within a session but does not survive across prompts/sessions.',
    ],
    doIt: [
      'Pick or generate a high-res, front-facing, neutral-light anchor character.',
      'Use reference-image conditioning for every subsequent generation (pass the anchor, not a text description).',
      'Drift-check: generate 3–5 variations and compare face shape, age, freckles/hairstyle.',
      'For heavy reuse (influencer, host), train a dedicated identity (LoRA) once.',
    ],
    launchIt: [
      'Consistency is baked into ad/content pricing, not billed separately.',
      'Upsell a "branded AI character" package: one-time setup ($200–$500) + per-piece production.',
      'Frame it as "your reusable AI spokesperson," not "an AI photo."',
    ],
    exercises: [
      'Easy: generate the same character in 3 outfits via reference-image conditioning; check drift.',
      'Medium: 5 scenes/backgrounds; identify which detail drifts first.',
      'Hard: set up a local ComfyUI workflow with a trained identity; compare to API conditioning.',
    ],
    relatedTemplateIds: ['character-consistency-checklist'],
    relatedAssetIds: [
      'character-anchor',
      'character-drift-car',
      'character-drift-kitchen',
      'character-drift-outside',
      'gripmount-hook-clip',
    ],
  },
  {
    id: 'building-an-ad-batch',
    slug: 'building-ad-batch',
    order: 3,
    title: 'Building a 10-Ad Batch',
    summary:
      'Clients do not buy one ad — they buy variants to test. Batching is the actual product.',
    time: '~50 min',
    prerequisites: ['how-ugc-works', 'character-consistency'],
    problem:
      'A single ad is a gamble on one hook and one angle. Real value is "make me 10 ad variants I can test" — produced efficiently, not one at a time.',
    concept: [
      'A batch is one product varied along a few axes: hook, angle, format.',
      'Hook variation — same product, different opening 2 seconds.',
      'Angle variation — price, convenience, social proof, novelty.',
      'Format variation — different avatar/voice or b-roll style.',
      'Vary one or two axes at a time and hold the rest constant — otherwise results are unreadable.',
    ],
    doIt: [
      'Lock the constants: product, core proof point, CTA.',
      'Write 3–4 hook variants from the script template.',
      'Pair hooks with 2–3 angle variants → pick the best 8–10 combinations, not every permutation.',
      'Reuse your consistent character across the batch.',
      'Batch-produce voice/avatar — mostly repetition with different script text.',
      'Deliver with a test plan: label each ad by the axis it varies.',
    ],
    launchIt: [
      'Price per batch ($150–$300 for a 5–8 ad test batch), not per ad.',
      'Sell the testing capability ("8 variants to find your winner"), not the ad count.',
      'Outreach: you can turn around a full test batch faster than sourcing creators.',
    ],
    exercises: [
      'Easy: plan a 6-ad matrix (3 hooks × 2 angles) without producing.',
      'Medium: produce a 5-ad batch, holding character + CTA constant.',
      'Hard: produce a 10-ad batch and write a one-page test plan.',
    ],
    relatedTemplateIds: ['batch-matrix', 'ad-brief'],
    relatedAssetIds: ['gripmount-ad2-problem-first', 'gripmount-ad3-pov'],
  },
  {
    id: 'pricing-and-selling-ugc',
    slug: 'pricing-selling',
    order: 4,
    title: 'Pricing & Selling UGC Ads as a Service',
    summary:
      'The production is the easy part now. Getting paid for it is a different skill.',
    time: '~35 min',
    prerequisites: ['how-ugc-works', 'building-ad-batch'],
    problem:
      'People who produce good UGC ads still earn far less than they could — they price by guessing, undersell from fear, or pitch the technology instead of the result.',
    concept: [
      'One-off gig work (Fiverr-style) — lowest ceiling, fastest to start.',
      'Project-based client work (direct outreach, a batch per project) — mid ceiling.',
      'Retainer/agency work (ongoing monthly batches) — highest ceiling, needs trust.',
      'Natural progression: gig → project → retainer, each stage\'s output proving the next.',
    ],
    doIt: [
      'Set gig pricing anchored to market ($10–$55/ad); higher once you have 2–3 portfolio pieces.',
      'Package project work as batches ($150–$300/test batch), not per ad.',
      'Build a portfolio from your best 3–5 ads.',
      'Write outreach that leads with a finished, product-specific sample.',
      'After 2–3 projects, pitch a retainer ($1,500–$3,000/month).',
    ],
    launchIt: [
      'Anchor to real ranges; price toward the top once you have proof.',
      'Always lead with the finished ad and the business outcome — never "I use AI to…".',
      'State revision rounds before you quote (1 free round is standard).',
    ],
    exercises: [
      'Easy: write a gig listing within the documented range.',
      'Medium: write cold outreach to a real DTC brand with a sample ad.',
      'Hard: draft a retainer proposal (scope, monthly count, price, revisions).',
    ],
    relatedTemplateIds: ['outreach', 'retainer', 'ad-brief'],
    relatedAssetIds: ['character-anchor', 'gripmount-hook-clip'],
  },
  {
    id: 'case-study-teardown',
    slug: 'case-study-teardown',
    order: 5,
    title: 'Case Study Teardown',
    summary:
      'Learn to reverse-engineer a winning ad instead of guessing what worked.',
    time: '~30 min',
    prerequisites: ['how-ugc-works', 'pricing-selling'],
    problem:
      'It is easy to produce ads; harder to know which elements drove performance. Without a teardown method you copy surface style, not the structural reasons an ad worked.',
    concept: [
      'Separate an ad into the same five layers: script, avatar/voice, video, captions, export.',
      'For each layer ask: what choice was made, and why might it matter?',
      'Turn "that ad performed well" into a checklist of reusable decisions.',
      'Longevity in an ad library is a signal the brand found a winner.',
    ],
    doIt: [
      'Pick a real, currently-running ad in your category (public ad library).',
      'Transcribe the script and map it to hook/pitch/proof/CTA.',
      'Note the avatar/voice choice (tone, demographic match, energy).',
      'Note video structure (talking-head vs b-roll ratio, cut points).',
      'Note captioning style (timing, emphasis, sync).',
      'Write 2–3 structural takeaways you could apply to a different product.',
    ],
    launchIt: [
      'A free teardown of a running ad in a prospect\'s category is a strong opener.',
      'Offer "structural analysis + sample ad" as a low-cost first deliverable.',
      'Describe competitor ads by category and structure, not by naming the brand.',
    ],
    exercises: [
      'Easy: tear down one running ad with the five-layer structure.',
      'Medium: tear down 3 ads in one category; find the shared pattern.',
      'Hard: apply a teardown takeaway to a new ad for a different product.',
    ],
    relatedTemplateIds: ['teardown', 'ad-brief'],
    relatedAssetIds: ['gripmount-ad3-pov'],
  },
];

// Tracks 02–15 are authored in their own files (one per track) so the work can
// be parallelized without concurrent edits to this file. Each exports a
// `Lesson[]` named LESSONS_<NN> following the shared Lesson type in
// ./lesson-types. Track 01 lives inline above as ACADEMY_LESSONS_TRACK01.
import { LESSONS_02 } from './lessons/02-ai-filmmaking';
import { LESSONS_03 } from './lessons/03-faceless-ai-channels';
import { LESSONS_04 } from './lessons/04-ai-content-factories';
import { LESSONS_05 } from './lessons/05-ai-avatars-and-influencers';
import { LESSONS_06 } from './lessons/06-ai-audio-and-music';
import { LESSONS_07 } from './lessons/07-ai-product-photography';
import { LESSONS_08 } from './lessons/08-ai-fashion-and-virtual-tryon';
import { LESSONS_09 } from './lessons/09-ai-real-estate-staging';
import { LESSONS_10 } from './lessons/10-ai-headshots-and-portraits';
import { LESSONS_11 } from './lessons/11-ai-print-on-demand-and-merch';
import { LESSONS_12 } from './lessons/12-ai-stock-content-and-licensing';
import { LESSONS_13 } from './lessons/13-ai-tools-mastery';
import { LESSONS_14 } from './lessons/14-ai-freelancing-and-agency-business';
import { LESSONS_15 } from './lessons/15-ai-agents-and-vibe-coding';

export const ACADEMY_LESSONS: Lesson[] = [
  ...ACADEMY_LESSONS_TRACK01,
  ...LESSONS_02,
  ...LESSONS_03,
  ...LESSONS_04,
  ...LESSONS_05,
  ...LESSONS_06,
  ...LESSONS_07,
  ...LESSONS_08,
  ...LESSONS_09,
  ...LESSONS_10,
  ...LESSONS_11,
  ...LESSONS_12,
  ...LESSONS_13,
  ...LESSONS_14,
  ...LESSONS_15,
];

export function getLessonById(id): Lesson | undefined {
  return ACADEMY_LESSONS.find((l) => l.id === id);
}
