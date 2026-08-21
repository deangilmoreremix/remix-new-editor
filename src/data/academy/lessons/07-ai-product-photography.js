// Typed lesson data for the AI Product Photography Academy track (track 07).
// Structured form powering the LEARN view, derived from the upstream
// markdown in src/content/academy/07-ai-product-photography/lessons/*.md.
// Catalog metadata (id, order, title, summary, time, prerequisites,
// relatedTemplateIds, relatedAssetIds) is copied verbatim from catalog.ts.

export const LESSONS_07 = [
  {
    id: '07-ai-product-photography::01-product-photography',
    slug: '07-ai-product-photography::01-product-photography',
    order: 1,
    title: 'Product Shots Without a Photographer',
    summary: 'A premium backdrop shifts your product from cheap to premium.',
    time: '~45 minutes',
    prerequisites: [],
    problem:
      'Studio photography costs thousands per product and takes weeks of coordination, while a phone shot on a bad background reads as low quality and craters conversion. You need studio-grade product photos in minutes with zero physical setup.',
    concept: [
      'Label preservation: generate the environment around a real product PNG, never the product itself — generators mangle logos and labels.',
      'Ambient lighting sync: shift the product’s color curves to match the backdrop’s light temperature.',
      'Contact shadow: a thin, soft, dark shadow right where the product touches the surface.',
      'Directional shadow: a larger, lighter shadow stretching away, matching the backdrop’s light angle.',
      'Composite order: isolate product → generate backdrop → layer composite → cast shadows → color-match.',
      'Never warp the product PNG; always scale proportionally (hold Shift).',
    ],
    doIt: [
      'Photograph the product cleanly on a phone; remove the background (Photoroom/Clipdrop/API) and save a transparent product_mask.png.',
      'Generate a studio backdrop from a structured prompt (surface, light, mood, lens, DoF); save backdrop.jpg.',
      'Composite: backdrop bottom layer, product_mask top layer, scaled naturally onto the surface.',
      'Paint a 40%-opacity black, 0%-hardness contact shadow at the base and a soft directional shadow; blend Multiply.',
      'Add a color-balance layer clipped to the product to warm or cool its highlights toward the backdrop light.',
    ],
    launchIt: [
      'Shoot raw product photos in diffused daylight; never mix warm and cool light sources.',
      'Sell per-image and per-scene packages to DTC brands with weak listings.',
      'Upsell hero-shot and lifestyle variations once the base composite is approved.',
    ],
    exercises: [
      'Easy: photograph a household object and isolate it as a transparent PNG with a free remover.',
      'Medium: generate a wooden-surface sunset backdrop and composite your object onto it.',
      'Hard: paint a two-part shadow and apply a color-balance shift so highlights match the light source.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '07-ai-product-photography::perfume-before-after',
      '07-ai-product-photography::perfume-bottle-studio',
      '07-ai-product-photography::perfume-motion',
    ],
  },
  {
    id: '07-ai-product-photography::02-conversion-case-studies',
    slug: '07-ai-product-photography::02-conversion-case-studies',
    order: 2,
    title: 'Before/After Conversion Case Studies',
    summary: 'Clean images get clicks; contextual images get sales.',
    time: '~40 minutes',
    prerequisites: [],
    problem:
      'Brands redecorate listings blindly, assuming "pretty" sells, with no CRO proof of what drives revenue. High traffic but low sales means gallery images fail; low clicks means the search image lacks contrast. You need A/B frameworks and visual psychology tied to the buy button.',
    concept: [
      'CTR hook (main search image): high-contrast lighting and angles make you pop in a grid of 20 competitors.',
      'CVR closer (lifestyle gallery): show the product in the customer’s life to build trust and desire.',
      'CRO loop: find bottleneck → hypothesize → generate Variant B → split run → audit CVR.',
      'Split rigor: run A vs B at 50/50 until 95% statistical significance before pushing live.',
      'Test one variable at a time or you cannot attribute the lift.',
      'Optimize for mobile first — 70%+ of e-commerce traffic is on phones.',
    ],
    doIt: [
      'Audit the listing: <2% CVR with traffic means weak gallery; low traffic means fix the hero image.',
      'Write a visual hypothesis (e.g. "marble backdrop lifts CVR 20% via increased trust").',
      'Generate Variant B lifestyle graphics with clean, high-contrast benefit callouts.',
      'Configure a 50/50 A/B split in your testing tool (VWO, AB Tasty, Shopify native).',
      'Run ≥14 days; if B wins at >95% significance, push to 100% and log the case study.',
    ],
    launchIt: [
      'Package "conversion audits" that pair new visuals with a documented CVR lift.',
      'Use before/after case studies as the core of outbound pitches to weak listings.',
      'Charge for the outcome (lift), not the image count.',
    ],
    exercises: [
      'Easy: pick a brand with weak gallery photos and list 3 visual improvements.',
      'Medium: run a full visual audit on a mock listing and write a split-test hypothesis.',
      'Hard: design Variant A (white bg) and Variant B (premium composite) for a kitchen product with mobile crops for both.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '07-ai-product-photography::coffee-before-after',
      '07-ai-product-photography::coffee-motion',
    ],
  },
  {
    id: '07-ai-product-photography::03-productized-service',
    slug: '07-ai-product-photography::03-productized-service',
    order: 3,
    title: 'Selling as a Productized Service',
    summary: 'Don\'t sell "AI images"; sell conversion rate uplifts.',
    time: '~35 minutes',
    prerequisites: [],
    problem:
      'Hourly custom agencies stall on proposals, scope creep, and price haggling, and "we make AI backgrounds" frames you as cheap labor. Brands buy business metrics, not tools. You need a productized service: fixed scope, fixed price, fast turnaround, pitched on conversion.',
    concept: [
      'Value-based pricing: compare against a $3,000 studio shoot, not against cheap freelancers.',
      'Scope locking: state exact deliverables, revision rounds, and output formats up front.',
      'Frictionless onboarding: no sales calls — checkout then an automated intake form.',
      'Free sample loop: send a before/after of the prospect’s own product to earn the reply.',
      'Delivery board: Intake → Backdrop → Composite Audit → Final, tracked per client.',
      'Charge upfront; productized work is a transaction, not a retainer negotiation.',
    ],
    doIt: [
      'Define tiers from the offer template (e.g. Pack A $499 one-time, Pack B $999/mo).',
      'Build an intake form (Typeform/Google Forms) linked to a shared drive collecting PNGs, brand colors, vibe, and aspect rules.',
      'Run the free sample loop: find a weak listing, composite one product onto a premium slab, email the before/after.',
      'Automate a Trello/Asana board that creates staged task cards on checkout.',
      'Deliver WebP assets on time with a conversion-audit checklist to prompt a retainer upgrade.',
    ],
    launchIt: [
      'Lock client IP in the agreement — they own final composites, which builds trust for paid ads.',
      'Always collect payment before starting design work.',
      'Push monthly retainers ($999/mo) for seasonal catalog refreshes after the first win.',
    ],
    exercises: [
      'Easy: customize the offer template pricing for a niche (luxury watches, pet supplies).',
      'Medium: build a before/after email pitch for a live weak listing.',
      'Hard: set up a mock Stripe checkout wired to an intake form that auto-creates upload folders.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '07-ai-product-photography::product-agency-studio-clip',
      '07-ai-product-photography::product-agency-studio',
    ],
  },
  {
    id: '07-ai-product-photography::04-batch-workflows',
    slug: '07-ai-product-photography::04-batch-workflows',
    order: 4,
    title: 'Batch Workflows for Catalogs',
    summary: 'Consistency is what turns separate photos into a brand catalog.',
    time: '~45 minutes',
    prerequisites: ['Product Shots Basics'],
    problem:
      'Catalogs hold 20–200 variations; hand-prompting each backdrop yields mismatched lighting, shadows, and camera angles that look chaotic in a grid. One-by-one editing eats a week of labor and destroys margins. You need a batch workflow that locks layout and renders in minutes.',
    concept: [
      'Prompt pinning: generate one master backdrop and place every product on that same image.',
      'Layout standardization: fix the baseline (Y) and relative height so all products align in the grid.',
      'Batch masking: remove backgrounds folder-wide via API or recorded actions.',
      'Reusable shadows: identical lighting means one contact + directional shadow layer serves all files.',
      'SKU naming lets devs map images to listings via CSV automatically.',
      'Uniform canvas size (e.g. 2000x2000) keeps the e-commerce grid from breaking.',
    ],
    doIt: [
      'Set up folders: 01_raw_assets/, 02_isolated_masks/, 03_ai_backgrounds/, 04_composite_drafts/, 05_final_deliver/; name files by SKU.',
      'Batch-remove backgrounds (Photoshop Image Processor action or /remove-background API) into 02_isolated_masks/.',
      'Generate and lock one master_background.jpg; center the pedestal surface.',
      'Build catalog_template.psd with baseline and padding guides.',
      'Composite each mask to the baseline at a fixed height, reuse the shadow layer, and export WebP into 05_final_deliver/.',
    ],
    launchIt: [
      'Price catalogs by SKU count and turnaround, not by hour.',
      'Sell "full collection refurbish" packages that refresh an entire grid at once.',
      'Hand off via SKU-named WebPs so clients’ devs import without manual uploads.',
    ],
    exercises: [
      'Easy: create the standard batch directory structure on your machine.',
      'Medium: record a Photoshop action (or Python script) to scale to 1080x1080 with a 10% border.',
      'Hard: batch 3 colored cans onto one ledge at the same baseline with one shared shadow, export 3 matching WebPs.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '07-ai-product-photography::batch-skincare-grid-clip',
      '07-ai-product-photography::batch-skincare-grid',
    ],
  },
];
