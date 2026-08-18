// Typed lesson data for the AI Avatars & Influencers Academy track (track 05).
// Extracted from tracks/05-ai-avatars-and-influencers lessons (see src/content/
// academy for the verbatim upstream markdown). Powers the LEARN view; id/slug/
// order/title/summary/time/prerequisites/relatedTemplateIds/relatedAssetIds are
// copied verbatim from the catalog (src/data/academy/catalog.ts).

export const LESSONS_05 = [
  {
    id: '05-ai-avatars-and-influencers::01-consistent-character',
    slug: '05-ai-avatars-and-influencers::01-consistent-character',
    order: 1,
    title: 'Building a Consistent AI Character',
    summary: 'A virtual influencer needs a locked face, not a random prompt.',
    time: '~45 minutes',
    prerequisites: [],
    problem:
      'The biggest hurdle in a virtual influencer is face drift: the same prompt in a bedroom vs an office yields two different people (hair length, symmetry, clothing shift). If the character changes each post, the audience never bonds, the illusion breaks, and brand sponsorships become impossible.',
    concept: [
      'Description Anchor: rigid, detailed face/hair/styling tokens repeated in every prompt lock a visual anchor.',
      'Wardrobe Anchor: keep clothing constant (1–2 signature tags) so the character is recognizable across renders.',
      'Face-Swapping / Reference Conditioning (InsightFace, cref): project a master face onto new scenes to fix drift from lighting/angle.',
      'Pipeline: Master Face Portrait → New Scene Generation → Face Swap Layer → Consistent Render.',
    ],
    doIt: [
      'Define the character profile (features, clothing, signature colors) in the style guide.',
      'Generate a clean 1:1 master portrait in neutral lighting with nano-banana-2; save it as the Master Reference Face.',
      'Write new-scene prompts keeping the face/hair/wardrobe tokens 100% identical to the master prompt.',
      'Run the face-swap endpoint (z-image-p / InsightFace) with the master as source and the new scene as target.',
    ],
    launchIt: [
      'Set up a dedicated Instagram/TikTok profile with a normal humanized bio — do not flag "AI Generated" in the header.',
      'Launch Batch: generate at least 9 consistent posts before publishing so the grid looks cohesive.',
      'Treat the master portrait + face-swap pipeline as a productized service for brands wanting a spokes-character.',
    ],
    exercises: [
      'Easy: write a detailed character description, generate 3 headshots, and pick the best master.',
      'Medium: from your master, generate 2 scene variations with identical anchors (city walk, park sit).',
      'Hard: project your master face onto a third-party stock scene via face-swap; verify consistent features and lighting.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '05-ai-avatars-and-influencers::emma-cafe-consistent',
      '05-ai-avatars-and-influencers::emma-cafe-motion',
      '05-ai-avatars-and-influencers::emma-master',
    ],
  },
  {
    id: '05-ai-avatars-and-influencers::02-character-content-pipeline',
    slug: '05-ai-avatars-and-influencers::02-character-content-pipeline',
    order: 2,
    title: 'Character to Content Pipeline',
    summary: 'The character is the face, but the motion makes them real.',
    time: '~45 minutes',
    prerequisites: ['Building a Consistent AI Character'],
    problem:
      'A static avatar only serves photo feeds, but the highest reach and advertiser pay is on video feeds. Standard image-to-video warps the face on head movement and slides hair/clothing around — an uncanny-valley effect that drives viewers away.',
    concept: [
      'Lip-Sync Video Rendering: Static Avatar Portrait + Clean Voice Audio → Lip-Sync Engine → Talking Head Video.',
      'Static Anchor: use the consistent Master Portrait as the visual base, not a from-scratch video.',
      'Audio-Driven Lip Sync: the engine morphs only mouth/jaw/eyes to the waveform, keeping head/hair/clothing 100% consistent.',
      'Compositing & Overlay: cut away to b-roll every 4–5s while the voice continues for a dynamic feel.',
    ],
    doIt: [
      'Prep assets per the lipsync spec sheet: a locked Master Portrait plus a clean voiceover (e.g. 01_intro.mp3).',
      'Call /sync-lipsync (or volcengine lip-sync) with the audio URL and image URL; set 9:16 or 1:1.',
      'Audit the render: check mouth warping and lip/syllable drift; nudge the audio -50ms to -100ms if needed.',
      'In editing, keep the avatar 0–3s (hook), cut to b-roll 3–15s, return to the face 15–18s.',
    ],
    launchIt: [
      'Use green-screen Master Portraits so the talking head composites over any background.',
      'Add a 5%-opacity amber/teal adjustment layer to blend the avatar into the background lighting.',
      'Package a "talking-head explainer" as a per-video deliverable built on this pipeline.',
    ],
    exercises: [
      'Easy: gather one clean face image and a 5s audio clip; verify they meet the spec checklist.',
      'Medium: submit assets to a lip-sync engine, download the video, and correct minor sync delays on the timeline.',
      'Hard: produce a 30s vertical where the avatar speaks 3s, green-screen b-roll 20s, and the avatar returns for a 7s CTA.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['05-ai-avatars-and-influencers::emma-clip'],
  },
  {
    id: '05-ai-avatars-and-influencers::03-voice-cloning-dialogue',
    slug: '05-ai-avatars-and-influencers::03-voice-cloning-dialogue',
    order: 3,
    title: 'Voice Cloning & Dialogue',
    summary: 'A face creates the identity, but the voice builds the relationship.',
    time: '~35 minutes',
    prerequisites: ['Building a Consistent AI Character', 'Character to Content Pipeline'],
    problem:
      'A photorealistic avatar with a generic mechanical TTS voice ruins the illusion — no breath, pauses, or inflection. Viewers detect "fake," lose interest, and swipe away. You need a custom high-fidelity cloned voice built from real human samples.',
    concept: [
      'Training Sample Quality: output is limited by input — you need dry, clean, isolated mono recordings (no noise/echo).',
      'Phonetic Adjustment: build a phonetic dictionary (e.g. "moo-ah-pee" for muapi) to fix brand/acronym mispronunciation.',
      'Pacing with Punctuation: commas = short pause, ellipsis = long reflective pause, dash = sudden shift.',
      'Pipeline: Clean Audio Samples → Cloning Engine (ElevenLabs) → High-Fidelity Vocal Profile.',
    ],
    doIt: [
      'Record clean samples in a conversational tone, apply a Noise Gate in Audacity, and export a mono .wav.',
      'Upload to ElevenLabs (Add Cloned Voice), write a clear tone description, and compile the profile.',
      'Run pronunciation audits and rewrite mispronounced terms phonetically in the script.',
      'Insert punctuation pacing cues to break run-on sentences into a conversational rhythm.',
    ],
    launchIt: [
      'Lock Clarity/Stability sliders (Stability 40%, Clarity 75%) and document them for consistency.',
      'Batch all monthly script lines in one session so volume/tone/pacing stay uniform across the batch.',
      'Offer a "custom brand voice" clone as a one-time setup upsell per client avatar.',
    ],
    exercises: [
      'Easy: record 2 min of audio and clean it in Audacity to remove gaps and hum.',
      'Medium: upload a 2-min sample to an Instant Voice Cloning tool and analyze a 15s test\'s clarity.',
      'Hard: write a script with 3 brand/acronym terms, fix mispronunciations phonetically, and export clean audio.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '05-ai-avatars-and-influencers::avatar-recording-studio',
      '05-ai-avatars-and-influencers::avatar-studio-clip',
    ],
  },
  {
    id: '05-ai-avatars-and-influencers::04-monetization-tiers',
    slug: '05-ai-avatars-and-influencers::04-monetization-tiers',
    order: 4,
    title: 'Monetization Tiers by Follower Count',
    summary: "A virtual influencer's reach is digital, but the sponsor money is real.",
    time: '~30 minutes',
    prerequisites: [
      'Building a Consistent AI Character',
      'Character to Content Pipeline',
      'Voice Cloning & Dialogue',
    ],
    problem:
      'People wait to hit 100k followers like Lil Miquela ($8k/post) and quit when income never comes. Reality: B2B virtual influencers monetize under 10k followers because high-value business buyers justify premium rates that general entertainment channels need 100k to match.',
    concept: [
      'Three tiers: Tier 1 Affiliate/SaaS (0–5k) → recurring commissions; Tier 2 Integrations (5–25k) → $300–$800 sponsored batches; Tier 3 Ambassador (25k+) → $1k–$3k/mo retainers.',
      'Media Kit Spine: brands buy access to demographics, not views — prove your audience is their buyers.',
      'Avatar Advantage: AI influencers carry zero PR risk, follow briefs precisely, and revise visuals in minutes.',
    ],
    doIt: [
      'Draft a Virtual Media Kit (profile, niche, follower metrics, target demographics).',
      'Research niche keywords in the Meta Ad Library to find brands with active paid budgets.',
      'Bundle placements (e.g. Integration Pack: 3 reels + pinned link for 30 days at $400–$600).',
      'Send a concise cold pitch to the Partnership Manager (LinkedIn/Apollo).',
      'Deliver per brand guidelines and set a tracking link (Bitly/Rewardful) to prove conversions.',
    ],
    launchIt: [
      'Over-deliver on the first deal (3 paid → deliver 4) to earn a monthly retainer.',
      'Report metrics proactively 7 days post-campaign (views, likes, link-clicks) to secure renewals.',
      'Build one reusable media-kit template per niche to pitch at volume.',
    ],
    exercises: [
      'Easy: fill the Media Kit template with mock follower counts.',
      'Medium: find 3 SaaS running Meta ads in your niche and locate their marketing manager\'s email.',
      'Hard: draft a 3-video integration campaign (hooks, script topics, b-roll concepts) for a specific tool.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '05-ai-avatars-and-influencers::avatar-brand-sponsor',
      '05-ai-avatars-and-influencers::avatar-sponsor-clip',
    ],
  },
  {
    id: '05-ai-avatars-and-influencers::05-agency-economics',
    slug: '05-ai-avatars-and-influencers::05-agency-economics',
    order: 5,
    title: 'Agency Case Study: Small-Team Economics',
    summary: "Don't build an audience for yourself; build and manage audiences for paying clients.",
    time: '~30 minutes',
    prerequisites: [
      'Building a Consistent AI Character',
      'Character to Content Pipeline',
      'Voice Cloning & Dialogue',
      'Monetization Tiers by Follower Count',
    ],
    problem:
      'Building your own influencer is slow — a 6-month ramp with zero cash flow while subscriptions and API bills keep arriving. The faster, predictable income is a Virtual Influencer Agency (VIA) that builds and manages spokespeople for corporate clients too busy or camera-shy to record themselves.',
    concept: [
      'VIA economics: Management Retainer — Client Retainer ($2,000/mo) → Upfront Invoice → 15 Videos/mo.',
      'Spokesperson Retention Agreement: contract defines scope, monthly volume, and payment schedule.',
      'IP Separation: agency owns engine files (prompts, seeds, voice credentials); client owns distribution rights to exports — ensuring lock-in.',
      'Vocal & Visual Sync: a premium because you run the whole pipeline (consistency + lip-sync + voice) under one service.',
    ],
    doIt: [
      'Customize the agency agreement: $1,500–$2,500/mo, ~15 vertical clips per month.',
      'Pitch B2B professional services (bookkeeping, recruiting, real estate) — no face needed from the client.',
      'Run a character briefing: agree age/look/style/voice and create seed guidelines.',
      'Run weekly batch stations: approve scripts, batch-clone voice, lip-sync via API, trim/subtitle/grade.',
      'Deliver to shared folders with a short "Batch N ready" notification.',
    ],
    launchIt: [
      'Establish a Lock-In Milestone: approved scripts cannot be modified, preventing costly re-renders.',
      'Charge a flat $50 re-render fee per video for post-approval script changes.',
      'One editor can manage up to 4 clients (~$8k/mo gross) at roughly 5 hours per month each.',
    ],
    exercises: [
      'Easy: fill the Agency Agreement template with a mock client and specify character ownership rules.',
      'Medium: research 3 local niches and write a 1-paragraph virtual-spokesperson pitch for one.',
      'Hard: project a P&L for an agency running 3 client avatars (software subs + API credits, 15 videos/mo each).',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '05-ai-avatars-and-influencers::avatar-agency-suite-clip',
      '05-ai-avatars-and-influencers::avatar-agency-suite',
    ],
  },
];
