// Typed, interactive representations of the AI Video Ads & UGC templates.
// Each upstream *.md template is converted into a typed data shape plus a
// blank default and a filled example (from the upstream lessons). The Academy
// UI renders these as interactive editors; the Recipe system consumes them.

// ---------------------------------------------------------------------------
// 1. UGC Script Template
// ---------------------------------------------------------------------------

export const BLANK_UGC_SCRIPT: UGCScriptData = {
  product: '',
  targetLength: '25-30 seconds (~75-90 words)',
  hook: { timing: '0-2 sec', line: '' },
  problemPitch: { timing: '2-15 sec', line: '' },
  proofDemo: { timing: '15-25 sec', line: '' },
  cta: { timing: '25-30 sec', line: '' },
  checklist: [
    { id: 'sound-off', label: 'Hook works with sound off (captions alone make sense)', checked: false },
    { id: 'one-cta', label: 'No more than one CTA', checked: false },
    { id: 'speech', label: 'Sounds like speech, not a script, when read aloud', checked: false },
    { id: 'concrete', label: 'At least one concrete number or detail (not just adjectives)', checked: false },
    { id: 'under-30', label: 'Total read-aloud time is under 30 seconds', checked: false },
  ],
};

export const EXAMPLE_UGC_SCRIPT: UGCScriptData = {
  product: "GripMount — magnetic phone car mount ($28)",
  targetLength: '28 seconds (~85 words)',
  hook: {
    timing: '0-2s',
    line: 'Okay, I did not expect this to actually hold my phone through a pothole.',
  },
  problemPitch: {
    timing: '2-15s',
    line: "I used to have one of those suction ones that fell off literally every drive — this one's magnetic, snaps on in like two seconds.",
  },
  proofDemo: {
    timing: '15-25s',
    line: "[demo: slaps phone onto mount] It's held through every drive for the last two weeks, potholes included.",
  },
  cta: {
    timing: '25-28s',
    line: "It's $28, link's below — honestly just get it before your next road trip.",
  },
  checklist: BLANK_UGC_SCRIPT.checklist.map((c) => ({ ...c, checked: true })),
};

// ---------------------------------------------------------------------------
// 2. Ad Brief Checklist
// ---------------------------------------------------------------------------
export const BLANK_AD_BRIEF: AdBriefData = {
  product: '',
  platforms: '',
  variants: '',
  tone: '',
  constraints: '',
  assets: '',
  deadline: '',
};
export const EXAMPLE_AD_BRIEF: AdBriefData = {
  product: 'GripMount — $28 magnetic phone car mount',
  platforms: 'TikTok + Instagram Reels, 9:16',
  variants: '5 (see batch-matrix-template)',
  tone: 'Casual, slightly surprised — not polished/corporate',
  constraints: 'Cannot claim "unbreakable" — say "held up through daily driving" instead',
  assets: 'Product photos yes, no existing avatar/voice — this batch establishes one',
  deadline: '3 business days, 1 revision round included',
};

// ---------------------------------------------------------------------------
// 3. Character Consistency Checklist
// ---------------------------------------------------------------------------
export const CHARACTER_CHECK_ITEMS: CharacterCheckItem[] = [
  { id: 'facial', label: 'Facial structure matches across shots (face shape, eye spacing, nose)' },
  { id: 'age', label: 'Apparent age is consistent' },
  { id: 'features', label: 'Distinguishing features (freckles, scars, specific hairstyle) appear in every shot' },
  { id: 'skin', label: "Skin tone/lighting doesn't shift the apparent identity" },
  { id: 'outfit', label: 'Outfit continuity between cuts (if same scene)' },
];
export const BLANK_CHARACTER_CHECKLIST: CharacterChecklistData = {
  character: '',
  items: CHARACTER_CHECK_ITEMS,
  shots: ['Shot 1', 'Shot 2', 'Shot 3'],
  example: {},
};
export const EXAMPLE_CHARACTER_CHECKLIST: CharacterChecklistData = {
  character: 'Anchor woman, late 20s, brown hair, freckles',
  items: CHARACTER_CHECK_ITEMS,
  shots: ['Car interior', 'Kitchen counter', 'Walking outside'],
  example: {
    'Car interior': { facial: '✅', age: '✅', features: '✅', skin: 'Matches anchor', outfit: 'n/a — different shots' },
    'Kitchen counter': { facial: '✅', age: '✅', features: '✅', skin: 'Matches anchor', outfit: 'n/a' },
    'Walking outside': { facial: '✅', age: '✅', features: '✅', skin: 'Different (outdoor) lighting, identity still holds', outfit: 'n/a' },
  },
};

// ---------------------------------------------------------------------------
// 4. Batch Matrix Template
// ---------------------------------------------------------------------------
export const BLANK_BATCH_MATRIX: BatchMatrixData = {
  product: '',
  constants: 'product, core proof point, CTA',
  rows: [
    { id: 'ad-1', hook: '', angle: '', notes: '' },
    { id: 'ad-2', hook: '', angle: '', notes: '' },
    { id: 'ad-3', hook: '', angle: '', notes: '' },
    { id: 'ad-4', hook: '', angle: '', notes: '' },
    { id: 'ad-5', hook: '', angle: '', notes: '' },
  ],
};
export const EXAMPLE_BATCH_MATRIX: BatchMatrixData = {
  product: 'GripMount — $28 magnetic phone car mount',
  constants: 'product demo, proof ("two weeks, potholes included"), CTA ("$28, link\'s below")',
  rows: [
    { id: 'ad-1', hook: 'I did not expect this to hold through a pothole.', angle: 'Durability/surprise', notes: 'Baseline ad — from the script template' },
    { id: 'ad-2', hook: 'My old mount fell off literally every drive.', angle: 'Problem-first (names the pain point)', notes: 'Tests whether naming the competitor\'s failure outperforms a surprise hook' },
    { id: 'ad-3', hook: "POV: you're driving and your phone doesn't fall for once.", angle: 'Relatable/POV format', notes: 'Different format, not just different words — tests if POV changes hook rate' },
    { id: 'ad-4', hook: 'This $28 thing fixed a problem I didn\'t know had a fix.', angle: 'Price/value framing', notes: 'Leads with price as a hook, not just in the CTA' },
    { id: 'ad-5', hook: 'Two weeks, every pothole, still holding.', angle: 'Proof-first (leads with the result)', notes: 'Tests whether opening with proof beats opening with a question' },
  ],
};

// ---------------------------------------------------------------------------
// 5. Teardown Worksheet
// ---------------------------------------------------------------------------
const TEARDOWN_LAYER_DEFS = [
  { id: 'hook', label: 'Hook' },
  { id: 'pitch', label: 'Pitch/Problem' },
  { id: 'proof', label: 'Proof/Demo' },
  { id: 'cta', label: 'CTA' },
  { id: 'avatarTone', label: 'Avatar/Voice tone' },
  { id: 'videoStructure', label: 'Video structure (talking-head vs b-roll ratio)' },
  { id: 'captions', label: 'Captions style' },
];
export function blankTeardownLayers(): TeardownLayer[] {
  return TEARDOWN_LAYER_DEFS.map((d) => ({ id: d.id, label: d.label, whatDone: '', why: '' }));
}
export const BLANK_TEARDOWN: TeardownData = {
  category: '',
  longevity: '',
  layers: blankTeardownLayers(),
  takeaway: '',
};
export const EXAMPLE_TEARDOWN: TeardownData = {
  category: 'Skincare serum',
  longevity: '47 days, 6 near-identical variants — strong signal it\'s a kept winner',
  layers: [
    { id: 'hook', label: 'Hook', whatDone: 'I stopped using retinol after this happened to my skin.', why: 'Scare/curiosity hook that withholds the product name — earns a watch-through before pitching' },
    { id: 'pitch', label: 'Pitch/Problem', whatDone: 'Names the specific complaint (retinol irritation) before introducing the product', why: 'Sounds like a real complaint, not ad copy' },
    { id: 'proof', label: 'Proof/Demo', whatDone: 'Before/after skin close-up, timestamped "day 1 / day 14"', why: 'A dated, specific claim reads as checkable, not vague' },
    { id: 'cta', label: 'CTA', whatDone: 'Link in bio, 20% off first order', why: 'Discount-anchored, not just "shop now"' },
    { id: 'avatarTone', label: 'Avatar/Voice tone', whatDone: 'Calm, first-person, slightly vulnerable', why: 'Matches a skincare-complaint narrative, not a hype tone' },
    { id: 'videoStructure', label: 'Video structure (talking-head vs b-roll ratio)', whatDone: 'Mostly talking-head, one b-roll cut for the before/after', why: 'Keeps focus on the face/proof, not overly produced' },
    { id: 'captions', label: 'Captions style', whatDone: 'Bold-highlighted keywords, tightly synced', why: 'Standard for sound-off viewing' },
  ],
  takeaway:
    'A pain-first hook that withholds the product name for the first few seconds, paired with a dated before/after, works well for skincare-category ads — the curiosity gap is what earns the watch-through.',
};

// ---------------------------------------------------------------------------
// 6. Outreach Template
// ---------------------------------------------------------------------------
export const BLANK_OUTREACH: OutreachData = {
  brand: '',
  name: '',
  product: '',
  link: '',
  days: '3',
  yourName: '',
};
export const EXAMPLE_OUTREACH: OutreachData = {
  brand: 'TrailGear Co.',
  name: 'Sam',
  product: 'GripMount phone mount',
  link: 'https://…/sample-ad',
  days: '3',
  yourName: 'Jess',
};

// ---------------------------------------------------------------------------
// 7. Retainer Proposal Template
// ---------------------------------------------------------------------------
export const BLANK_RETAINER: RetainerData = {
  client: '',
  scope: '',
  price: '',
  includes: '',
  turnaround: '',
  term: 'month-to-month',
  why: '',
};
export const EXAMPLE_RETAINER: RetainerData = {
  client: 'TrailGear Co.',
  scope: '8 ad variants/month, across 2 batches',
  price: '$2,000/month',
  includes: 'scripting, production, 2 revision rounds per batch, delivery in 9:16 + 1:1, one-page test-plan write-up per batch',
  turnaround: '5 business days per batch',
  term: 'month-to-month, no minimum',
  why: 'The GripMount test batch we ran last month (Ad #2, problem-first hook) outperformed the original creative on hook rate — this keeps that same testing cadence going.',
};

// ---------------------------------------------------------------------------
// Template registry (metadata + default/example data wired to a recipe)
// ---------------------------------------------------------------------------

export const ACADEMY_TEMPLATES = [
  {
    id: 'ugc-script',
    kind: 'ugc-script',
    title: 'UGC Script Template',
    description: 'Hook / Problem-Pitch / Proof-Demo / CTA script builder with a pre-ship checklist.',
    lessonId: 'how-ugc-works',
    recipeId: 'create-ugc-ad',
    assetIds: ['gripmount-hook-clip'],
    ctaLabel: 'Create With Smart Video',
  },
  {
    id: 'ad-brief',
    kind: 'ad-brief',
    title: 'Ad Brief Checklist',
    description: 'Fill this out before producing a batch — for yourself or a client.',
    lessonId: 'how-ugc-works',
    recipeId: 'ai-campaign-planner',
    assetIds: [],
    ctaLabel: 'Create With Smart Video',
  },
  {
    id: 'character-consistency-checklist',
    kind: 'character-checklist',
    title: 'Character Consistency Checklist',
    description: 'Compare every generated shot of a character against drift before delivery.',
    lessonId: 'character-consistency',
    recipeId: 'create-consistent-character',
    assetIds: ['character-anchor', 'character-drift-car', 'character-drift-kitchen', 'character-drift-outside'],
    ctaLabel: 'Use Template',
  },
  {
    id: 'batch-matrix',
    kind: 'batch-matrix',
    title: '10-Ad Batch Matrix',
    description: 'Plan hook × angle combinations before production — one product, varied axes.',
    lessonId: 'building-an-ad-batch',
    recipeId: 'create-ugc-campaign',
    assetIds: ['gripmount-ad2-problem-first', 'gripmount-ad3-pov'],
    ctaLabel: 'Create With Smart Video',
  },
  {
    id: 'teardown',
    kind: 'teardown',
    title: 'Ad Teardown Worksheet',
    description: 'Reverse-engineer a winning ad across five layers into reusable takeaways.',
    lessonId: 'case-study-teardown',
    recipeId: 'ai-campaign-planner',
    assetIds: ['gripmount-ad3-pov'],
    ctaLabel: 'Use Template',
  },
  {
    id: 'outreach',
    kind: 'outreach',
    title: 'Client Outreach Template',
    description: 'Cold outreach that leads with a finished, product-specific sample.',
    lessonId: 'pricing-and-selling-ugc',
    recipeId: 'ai-campaign-planner',
    assetIds: [],
    ctaLabel: 'Use Template',
  },
  {
    id: 'retainer',
    kind: 'retainer',
    title: 'Retainer Proposal Template',
    description: 'Pitch ongoing monthly batch production after 2-3 completed projects.',
    lessonId: 'pricing-and-selling-ugc',
    recipeId: 'ai-campaign-planner',
    assetIds: [],
    ctaLabel: 'Use Template',
  },
];

export function getTemplateMeta(id) {
  return ACADEMY_TEMPLATES.find((t) => t.id === id);
}
