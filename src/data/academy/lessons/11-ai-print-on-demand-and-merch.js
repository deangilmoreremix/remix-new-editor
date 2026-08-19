// Typed lesson data for the AI Print-on-Demand & Merch Academy track (track 11).
// Extracted from src/content/academy/11-ai-print-on-demand-and-merch/lessons/*.md.
// Powers the LEARN view; AcademyPage matches rich lessons to catalog lessons by `id`.

export const LESSONS_11 = [
  {
    id: '11-ai-print-on-demand-and-merch::01-designing-sellable-ai-art-for-merch',
    slug: '11-ai-print-on-demand-and-merch::01-designing-sellable-ai-art-for-merch',
    order: 1,
    title: 'Designing Sellable AI Art for Merch',
    summary:
      'Transform AI art generations into high-resolution, vector-crisp graphics ready for direct-to-garment (DTG) printing.',
    time: '~40 minutes',
    prerequisites: [],
    problem:
      'Creators upload raw 1024px AI images straight to POD platforms, where they pixelate at 4500×5400px, print as ugly background boxes on shirts, and wash out under DTG ink. Without isolation, vector-upscale, and apparel formatting, products look cheap and earn bad reviews.',
    concept: [
      'Merch-grade output needs isolated vector prompting, transparent background removal, and 300 DPI upscaling.',
      'Isolated vector prompts ("clean lines, bold graphic, isolated on white, 300 DPI") birth print-ready linework.',
      'Background masking leaves only artwork on the fabric — no rectangular box.',
      '300 DPI scaling (4500×5400px via Real-ESRGAN/vectorizer) hits standard POD specs.',
      'Contrast and color must be boosted ~15% because DTG ink absorbs into fabric.',
    ],
    doIt: [
      'Write a merch vector prompt with subject, style, and a negative list (photo, gradient box, blurry lines).',
      'Generate via muapi /nano-banana-2 and run through an AI background remover to a transparent PNG.',
      'Upscale 4x and verify ≥4500px width with crisp edges.',
      'Place the PNG on a t-shirt mockup ~2 inches below the collar.',
    ],
    launchIt: [
      'Make white-line variants for black tees and dark-line variants for white/heather greys.',
      'Boost color vibrancy +15% before export to survive DTG ink absorption.',
      'Price the design capability, not the render — a $0.06 graphic vs. a $250 illustrator quote.',
    ],
    exercises: [
      'Easy: generate a minimalist retro sunset vector isolated on white.',
      'Medium: remove the background and upscale to 4500×5400px at 300 DPI.',
      'Hard: build a 3-item collection (tee, mug, tote) from one unified design style.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '11-ai-print-on-demand-and-merch::cyberpunk-cat-merch-tshirt',
      '11-ai-print-on-demand-and-merch::merch-design-motion',
    ],
  },
  {
    id: '11-ai-print-on-demand-and-merch::02-print-on-demand-platform-basics',
    slug: '11-ai-print-on-demand-and-merch::02-print-on-demand-platform-basics',
    order: 2,
    title: 'Print-on-Demand Platform Basics',
    summary:
      'Automate production, fulfillment, and store sync across Etsy, Shopify, and POD suppliers.',
    time: '~35 minutes',
    prerequisites: ['11-ai-print-on-demand-and-merch::01-designing-sellable-ai-art-for-merch'],
    problem:
      'Great artwork is half the battle. Traditional inventory means buying 100+ shirts in sizes you might not sell and storing boxes at home. POD removes inventory risk by printing on order — but wiring storefronts (Etsy/Shopify) to suppliers (Printify/Printful) takes real configuration.',
    concept: [
      'The POD loop: order placed → auto-sync to supplier → DTG print & ship → tracking auto-sent.',
      'Front-end storefronts: Etsy (search traffic), Shopify (brand control), Redbubble (zero-setup catalog).',
      'Back-end suppliers (Printify/Printful/Gelato) handle DTG printing, QC, packing, shipping.',
      'Lifestyle mockups are what convert — buyers need to see the product in a real setting.',
    ],
    doIt: [
      'Create a Printify/Printful account and OAuth-link it to your Etsy or Shopify store.',
      'Pick a garment (Bella+Canvas 3001), upload your 300 DPI transparent PNG, center it.',
      'Publish lifestyle mockups from your AI photo pipeline or the supplier tools.',
      'Enable Automatic Fulfillment so incoming orders process with no manual step.',
    ],
    launchIt: [
      'Set up backup supplier routing so a sold-out black L auto-routes to a secondary print shop.',
      'Lead with automated fulfillment as a "set-and-forget" passive income story.',
      'Start on Etsy for built-in search traffic before investing in a Shopify storefront.',
    ],
    exercises: [
      'Easy: create a free Printify account and upload an isolated graphic to a tee mockup.',
      'Medium: connect your supplier to an Etsy or Shopify dev store.',
      'Hard: enable automated fulfillment and test a real sample order end-to-end.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['11-ai-print-on-demand-and-merch::vintage-botanical-mug-mockup'],
  },
  {
    id: '11-ai-print-on-demand-and-merch::03-building-a-catalog-without-repeating',
    slug: '11-ai-print-on-demand-and-merch::03-building-a-catalog-without-repeating',
    order: 3,
    title: 'Building a Catalog Without Repeating Yourself',
    summary:
      'Scale from 1 to 100+ unique merch listings using prompt matrix variations and niche sub-segmentation.',
    time: '~40 minutes',
    prerequisites: [
      '11-ai-print-on-demand-and-merch::01-designing-sellable-ai-art-for-merch',
      '11-ai-print-on-demand-and-merch::02-print-on-demand-platform-basics',
    ],
    problem:
      'Real POD revenue needs 50–200+ listings. Creators either spam identical designs with minor color tweaks (flagged as listing spam) or burn out hand-prompting one shirt at a time — neither scales.',
    concept: [
      'A niche prompt matrix expands one theme across subjects × styles × customer niches.',
      'Axis A = subject, Axis B = aesthetic style, Axis C = target customer niche.',
      'One 3×3 matrix yields 9 distinct graphics; cross-publishing to 3 product types triples listings.',
      'Repetition risk drops because each cell targets a genuinely different buyer.',
    ],
    doIt: [
      'Choose a passion niche (e.g., Outdoor Camping & Coffee).',
      'Build a variable prompt template with [SUBJECT] and [STYLE] placeholders.',
      'Batch-generate 12 distinct graphics, isolating backgrounds and upscaling in bulk.',
      'Cross-publish each graphic to 3 high-margin products (tee, mug, tote) → 36 listings.',
    ],
    launchIt: [
      'Avoid trademarks: never use Disney/Marvel/Nike or celebrity likeness; check USPTO TESS first.',
      'One core concept (e.g., 5 animals × 3 products) can become 45 active listings in 2.5 hours.',
      'Keep every matrix cell a distinct buyer audience so marketplaces never flag repetition.',
    ],
    exercises: [
      'Easy: build a 3×3 prompt matrix for a niche of your choice (Coffee, Gaming, Cats).',
      'Medium: batch-generate 6 distinct graphics from your matrix and isolate them.',
      'Hard: publish a 15-item collection across 3 product types in your dev store.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['11-ai-print-on-demand-and-merch::merch-design-vector-art'],
  },
  {
    id: '11-ai-print-on-demand-and-merch::04-pricing-and-passive-income-math',
    slug: '11-ai-print-on-demand-and-merch::04-pricing-and-passive-income-math',
    order: 4,
    title: 'Pricing & Passive-Income Math for POD',
    summary:
      'Master unit economics, marketplace listing fees, and conversion math to build a profitable POD catalog.',
    time: '~35 minutes',
    prerequisites: [
      '11-ai-print-on-demand-and-merch::01-designing-sellable-ai-art-for-merch',
      '11-ai-print-on-demand-and-merch::02-print-on-demand-platform-basics',
      '11-ai-print-on-demand-and-merch::03-building-a-catalog-without-repeating',
    ],
    problem:
      'Sellers post $19.99 shirts, make sales, then lose money monthly. They ignored Etsy listing fees ($0.20), ~10% transaction + payment fees, base garment + shipping, and ad spend — so the net margin went negative.',
    concept: [
      'Net Profit = Retail − (Supplier + Shipping) − Marketplace Fees − Ad Spend.',
      'Etsy fees total ~9.5–10% of retail (6.5% transaction + ~3% + $0.25 payment).',
      'Benchmark bases: tee $14.00, mug $9.50, hoodie $26.00 all-in print + ship.',
      'Price for 35%+ net margins: tee $24.99, mug $17.99, hoodie $44.99.',
      'Catalog math: 100 listings × 10k views × 2% conversion ≈ 200 sales/month passive.',
    ],
    doIt: [
      'Open the pricing calculator and enter base print + shipping per product.',
      'Set retail prices targeting 35%+ net: tee $24.99, mug $17.99, hoodie $44.99.',
      'Project revenue from catalog size and a 1.5–2.5% store conversion rate.',
      'Subtract fees and ad spend to confirm a healthy $7–$12 net profit per sale.',
    ],
    launchIt: [
      'Bundle "FREE SHIPPING" into the retail price ($28.99 shirt) to lift Etsy rank and conversion.',
      'Model ad spend explicitly so a 10% Etsy Ads cut never breaks your $8 minimum profit.',
      'Treat catalog size as the lever: more compliant listings → more views → more passive sales.',
    ],
    exercises: [
      'Easy: compute net profit for a mug at $18.99 (base $4.50, ship $5.00).',
      'Medium: model a 50-product catalog doing 50 sales/month in your pricing sheet.',
      'Hard: build a dynamic matrix holding $8.00 min profit with 10% ad spend included.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [],
  },
];
