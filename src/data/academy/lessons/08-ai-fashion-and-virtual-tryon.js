
export const LESSONS_08 = [
  {
    id: '08-ai-fashion-and-virtual-tryon::01-garment-tryon',
    slug: '08-ai-fashion-and-virtual-tryon::01-garment-tryon',
    order: 1,
    title: 'Garment Try-on for Fashion E-commerce',
    summary:
      'A garment only comes alive when it moves with a human body.',
    time: '~45 minutes',
    prerequisites: [],
    problem:
      'Booking models, hair/makeup, photographers and studios for a single product line can cost $5,000+ and take weeks. Flat-lays and ghost-mannequin shots are cheap but look dead, so shoppers cannot judge drape, fit or fabric — driving low click-through and high returns. Virtual Try-On (VTO) wraps a flat garment onto a real body without a shoot.',
    concept: [
      'A VTO pipeline: Flat Garment → Garment Mask → Model Alignment → Draping Synthesis.',
      'VTO engines use a reference garment image, preserving ~95% of texture, stitching, buttons and prints.',
      'Mannequin-to-model transfer replaces the plastic dummy with a real model while keeping exact fit.',
      'Swap model demographics (ethnicity, age, build) to localize landing pages per region.',
      'Detail control lives in the draping fitting rate — ~0.75 balances cloth detail with natural wrinkles.',
      'Pick the tool by job: IDM-TryOn for PDP catalog sharpness, Kolors for active-pose editorial, Kling for motion loops.',
    ],
    doIt: [
      'Photograph the garment flat-lay or on a mannequin; cut the background to a clean `garment_ref.png`.',
      'Fill the try-on spec sheet: model demographics (e.g. East Asian male, 28, athletic, studio).',
      'Choose a target pose: upload a reference model, or mask the clothing on a mannequin photo and describe the body.',
      'Run the VTO engine with `garment_ref.png` + target body and draping fitting rate 0.75; download output.',
      'Inspect at 200%: collar borders crisp, cuffs sit naturally over hands, prints follow body curves.',
      'Save model pose templates in a master folder to reuse across future garment lines.',
    ],
    launchIt: [
      'Keep one locked model face/body across a single product category page for brand consistency.',
      'Reuse stored high-res pose templates to speed batch rendering of new collections.',
      'Sell the upgrade from plastic mannequin to professional model shot as a premium catalog line item.',
    ],
    exercises: [
      'Easy: photograph a t-shirt flat-lay and use a background cutter to make a clean clothing PNG mask.',
      'Medium: submit the PNG to a VTO tool; generate a male and a female model wearing the same shirt.',
      'Hard: run VTO on a ghost-mannequin jacket; at 200% zoom fix any collar/cuff border bleeding in a photo editor.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '08-ai-fashion-and-virtual-tryon::linen-shirt-motion',
      '08-ai-fashion-and-virtual-tryon::linen-shirt-vto',
    ],
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::02-studio-lookbooks',
    slug: '08-ai-fashion-and-virtual-tryon::02-studio-lookbooks',
    order: 2,
    title: 'High-converting Studio Lookbooks',
    summary:
      "A lookbook doesn't just sell clothes; it sells a lifestyle.",
    time: '~40 minutes',
    prerequisites: [],
    problem:
      'Seasonal lookbooks are usually a logistics nightmare — travel, weather, props, lighting continuity. Office-room shoots look cheap; stock photos look generic and off-brand. You need cohesive, high-end backdrops generated on demand and composited with your VTO models under matching light.',
    concept: [
      'Lookbook pipeline: Theme Archetype → Lighting & Backdrops → Composite VTO Models → Batch Color Grade.',
      'Theming consistency: pick one backdrop palette and texture set before generating any image.',
      'Standardize light direction (diffused side softbox) so shadows stay neutral across the set.',
      'Cohesive color grading (LUT) ties images into one "shot on the same day" story.',
      'FLUX Pro / Midjourney excel at editorial backdrops; Lightroom batch-syncs grading; Photoshop composites.',
      'Preserve natural skin texture and export at 2000px+ vertical for zoom-enabled e-commerce.',
    ],
    doIt: [
      'Lock the moodboard: visual archetype, core palette, lighting setup (e.g. "Nordic Autumn").',
      'Generate the studio backdrop to spec; save as `studio_bg_01.jpg`.',
      'Composite the VTO model layer centered over the backdrop.',
      'Align light: paint a 25%-opacity Multiply shadow where the body blocks the key light; add a contact shadow under the shoes.',
      'Apply a global color grade (shadows toward teal, midtones toward warm beige) across all assets.',
      'Export the completed lookbook as high-quality WebP at 1080x1350px vertical.',
    ],
    launchIt: [
      'Avoid over-smoothing skin — keep pores and hair for editorial credibility.',
      'Deliver lookbooks at 2000px+ vertical so platforms can offer zoom without pixelation.',
      'Bundle a seasonal lookbook as a print+web deliverable priced above single product shots.',
    ],
    exercises: [
      'Easy: customize the moodboard spec sheet for a Summer swimwear collection.',
      'Medium: generate 2 cohesive backdrops with different prompts but identical palette and light angle.',
      'Hard: composite a model onto your backdrop, apply a custom LUT, and add a soft grain layer.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '08-ai-fashion-and-virtual-tryon::fashion-lookbook-loop',
      '08-ai-fashion-and-virtual-tryon::fashion-lookbook-model',
    ],
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::03-sizing-layout-consistency',
    slug: '08-ai-fashion-and-virtual-tryon::03-sizing-layout-consistency',
    order: 3,
    title: 'Sizing & Layout Consistency',
    summary:
      'Proportions build the canvas; alignment builds the brand.',
    time: '~35 minutes',
    prerequisites: ['Garment Try-on Basics'],
    problem:
      'If a model head jumps in size or the shoulder baseline drifts as shoppers click between shirts, the store looks cheap. Eye-aligning each render is error-prone. You need a standardized grid so every model holds the same height, proportions and pose across the catalog.',
    concept: [
      'Layout pipeline: Try-On Render → Grid Canvas → Joint Guide Alignment → Baseline Stabilization → Export.',
      'Shoulder Baseline Rule: align both shoulder joints to the same Y coordinate — the chest/neck stay consistent.',
      'Aspect margins: 4:5 (1080x1350px) wants ~10% bottom and ~12% top head-clearance margins.',
      'Center Seam Rule: the garment zipper/button line matches the canvas X-center to avoid tilt.',
      'Photoshop guides give pixel-perfect QA; a Python/PIL keypoint script scales batch alignment.',
      'Lock camera height (chest level, ~4ft) so perspective never breaks the baseline.',
    ],
    doIt: [
      'Set the canvas to 1080x1350px with guides: center X 540, shoulder Y 400, waist Y 750, hip Y 950.',
      'Import the VTO model layer and position it roughly centered.',
      'Scale proportionally so left/right shoulder seams snap to the Y:400 guide.',
      'Shift left/right until the collar button or zipper aligns to X:540 center.',
      'QA margins: head below the top safety line, hands/sides inside side padding.',
      'Hide guides, export WebP, and repeat identically for every item in the collection.',
    ],
    launchIt: [
      'Document your grid settings in the alignment template and share it with the design team.',
      'Keep camera height constant across all catalog photography to preserve baselines.',
      'Offer "catalog standardization" as a fix for brands whose existing grids are misaligned.',
    ],
    exercises: [
      'Easy: draw guides for a 1:1 layout (shoulders Y:300, waist Y:600).',
      'Medium: import 2 model photos and scale them so shoulders align perfectly; toggle layers to verify.',
      'Hard: write a QA checklist for 10 listing pages covering off-center zipper and head clipping fixes.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '08-ai-fashion-and-virtual-tryon::mannequin-grid-alignment',
      '08-ai-fashion-and-virtual-tryon::mannequin-grid-clip',
    ],
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::04-conversion-cases',
    slug: '08-ai-fashion-and-virtual-tryon::04-conversion-cases',
    order: 4,
    title: 'Before/After Conversion Cases',
    summary:
      'Real models increase clicks; accurate fit reduces returns.',
    time: '~45 minutes',
    prerequisites: [],
    problem:
      'Apparel e-commerce bleeds profit to returns — 20–40% on average, mostly fit errors ("tighter than it looked"). Static mannequin shots also depress conversion because shoppers cannot see the garment on a body. You must lift CVR and cut returns with consistent, accurate model visuals.',
    concept: [
      'Optimization loop: Find Fit Returns → Deploy AI Try-On → Add Fit Callouts → Measure CVR & Returns.',
      'Showing garments on specified body measurements gives a real reference point and cuts sizing errors.',
      'Diverse representation (slim/athletic/curvy) lifts conversion ~40% for matched body types.',
      'Measurement callout cards (height / build / size worn) set honest fit expectations.',
      'Run a 50/50 A/B: ghost mannequin control vs AI model + callouts; track 30 days for return cycles.',
      'Never falsify sizes — wrong overlays cause the very returns you are trying to prevent.',
    ],
    doIt: [
      'Open the CVR tracker; compute return rate and read reason logs (over 50% fit-related = optimize).',
      'Stage your best-seller on three body types via the Module 1 workflow.',
      'Add a low-contrast measurement bar: "Model 5\'9\" athletic, wearing size Small."',
      'Configure the A/B: Variant A ghost mannequin, Variant B AI models + callouts, 50/50 traffic.',
      'Run 30 days; compare return rate, CVR and net margin after return shipping.',
      'If Variant B wins, push it live across the whole product category.',
    ],
    launchIt: [
      'Keep sizing overlays accurate so customers order the right size and returns fall.',
      'Align callout placement to the layout grid from Module 3 for visual consistency.',
      'Sell return-reduction as a margin story: less returns = more net revenue per SKU.',
    ],
    exercises: [
      'Easy: for a listing that sold 500 units with 90 returned, calculate the return rate.',
      'Medium: complete the CVR/return log with mock data for a dress line.',
      'Hard: design a gallery image with model, sizing callout, safe margins, exported mobile WebP.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '08-ai-fashion-and-virtual-tryon::denim-model-clip',
      '08-ai-fashion-and-virtual-tryon::denim-model-measurements',
    ],
  },
];
