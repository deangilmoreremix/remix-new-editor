// Rich lesson data for the AI Stock Content & Licensing track (track 12).
// Catalog ids/order/title/summary/time/prerequisites/related* are copied VERBATIM
// from src/data/academy/catalog.ts; problem/concept/doIt/launchIt/exercises are
// distilled from the upstream markdown in src/content/academy/12-ai-stock-content-and-licensing/lessons.

export const LESSONS_12 = [
  {
    id: '12-ai-stock-content-and-licensing::01-what-actually-sells-on-stock-marketplaces',
    slug: '12-ai-stock-content-and-licensing::01-what-actually-sells-on-stock-marketplaces',
    order: 1,
    title: 'What Actually Sells on Stock Marketplaces',
    summary:
      'Identify high-demand commercial stock niches and generate licensable visual assets that buyers actually download.',
    time: '~40 minutes',
    prerequisites: [],
    problem:
      'The stock market is flooded with generic AI art — fantasy landscapes, cyber cities, aesthetic portraits — that earn $0.00 because marketplace buyers (ad agencies, news desks, corporate design teams) want commercial concepts illustrating specific business problems, not decoration. Without a commercial use-case, your images sink to the bottom of search forever.',
    concept: [
      'Stock demand is commercial, not artistic: buyers want concepts that illustrate business problems (handshakes, solar farms, healthcare, cyber security).',
      'The pipeline is: Demand Search → Concept Prompting → Quality Audit/Upscale → IPTC Keywording → Marketplace Submission.',
      'Copy space is king — images with clean negative space for text overlays sell ~4x more than busy compositions.',
      'No trademark/brand artifacts — agencies reject recognizable logos, trademarked architecture, or copyrighted artwork.',
      'IPTC metadata (title, 30+ keywords, copyright) is the schema that makes an asset findable in marketplace search.',
      'Always tag AI origin on Adobe Stock; hiding it risks account suspension.',
    ],
    doIt: [
      'Pull the monthly Demand Trends Brief from the Adobe Stock Contributor Portal for missing/high-conversion commercial terms.',
      'Draft a commercial prompt with explicit copy space (e.g., "two diverse executives shaking hands, copy space left for text overlay, 35mm lens, neutral palette").',
      'Add a negative prompt: brand logos, watermarks, text, cartoon, 3d render, extra fingers, distorted hands, blurry.',
      'Inspect the render at 100% zoom: exactly 5 fingers per hand, round clear pupils, no warping.',
      'Embed 30+ targeted IPTC keywords (agreement, partnership, deal, handshake, corporate, executive, teamwork, trust).',
      'Tag the "Created using Generative AI tools" box and submit to Adobe Stock / Freepik.',
    ],
    launchIt: [
      'Tag AI origin honestly on every upload to protect your contributor account.',
      'Target the four demand pillars (business, tech/cyber, healthcare, green energy) where buyers actually pay.',
      'One licensable image can earn recurring royalties for years — treat each upload as a long-lived asset, not a one-off.',
    ],
    exercises: [
      'Easy: research 3 trending commercial search terms on Adobe Stock.',
      'Medium: generate a commercial stock photo with copy space for headlines.',
      'Hard: tag your image with 30+ IPTC keywords and submit it to a contributor portal.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '12-ai-stock-content-and-licensing::corporate-handshake-stock',
      '12-ai-stock-content-and-licensing::stock-catalog-motion',
    ],
  },
  {
    id: '12-ai-stock-content-and-licensing::02-batch-generating-a-licensable-catalog',
    slug: '12-ai-stock-content-and-licensing::02-batch-generating-a-licensable-catalog',
    order: 2,
    title: 'Batch-Generating a Licensable Catalog',
    summary:
      'Build a 500+ asset stock catalog using automated prompt batching, AI upscaling, and CSV metadata tagging.',
    time: '~40 minutes',
    prerequisites: ['12-ai-stock-content-and-licensing::01-what-actually-sells-on-stock-marketplaces'],
    problem:
      'Stock licensing is a volume numbers game — $500–$2,000+/month in passive royalties needs 500–2,000+ quality assets. Hand-generating, upscaling, keywording and uploading images one at a time (15 min each) is 125+ hours of toil for 500 assets, so most creators quit before reaching catalog scale.',
    concept: [
      'The Automated Stock Factory: Batch Prompt Matrix → Automated Generation → 4x Upscale → Auto-CSV Metadata → FTP Upload.',
      'Batch API generation (e.g., /nano-banana-2 via script) produces 50 images per run instead of one.',
      'Agencies require 4000px+ (12+ MP); raw 1024px renders must be bulk-upscaled before submission.',
      'CSV metadata ingestion (filename, title, keywords, category) removes manual text entry on Adobe/Freepik.',
      'Volume compounds: acceptance rate and catalog size together drive download velocity.',
      'Keep approval rate above 80% — bad glitch/hand renders drag down the whole account.',
    ],
    doIt: [
      'Define a prompt matrix with a [TECH_CONCEPT] token (AI cloud server, biometric scanner, cyber firewall, quantum processor) on a clean 16:9 background with copy space.',
      'Run your generation script to output 20+ high-res images into output_raw/.',
      'Batch-upscale everything to 4000px+ and filter out glitch/hand-distortion renders.',
      'Auto-generate a metadata.csv mapping 30 keywords + title to each filename.',
      'FTP-upload the batch to the Adobe Stock Contributor Portal.',
      'Track acceptance rate; aim for 88%+ like the worked cyber-security collection (215 downloads / $236.50 mo).',
    ],
    launchIt: [
      'Maintain an 80%+ acceptance rate by 100% zoom-crop QC before every upload.',
      'Reinvest early royalties into API compute to scale 100 → 1,000+ assets over months.',
      'Use local ComfyUI for unlimited offline volume once API costs outpace hardware.',
    ],
    exercises: [
      'Easy: create a CSV metadata template mapping titles and keywords for 5 stock photos.',
      'Medium: batch-generate 10 commercial stock photos targeting the renewable energy niche.',
      'Hard: set up FTP auto-upload to batch-submit 25 stock assets to a contributor portal.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['12-ai-stock-content-and-licensing::future-technology-stock'],
  },
  {
    id: '12-ai-stock-content-and-licensing::03-licensing-models-and-passive-income',
    slug: '12-ai-stock-content-and-licensing::03-licensing-models-and-passive-income',
    order: 3,
    title: 'Licensing Models & Realistic Passive-Income Expectations',
    summary:
      'Understand royalty tiers, extended licensing, and long-term passive income projections for stock catalogs.',
    time: '~35 minutes',
    prerequisites: [
      '12-ai-stock-content-and-licensing::01-what-actually-sells-on-stock-marketplaces',
      '12-ai-stock-content-and-licensing::02-batch-generating-a-licensable-catalog',
    ],
    problem:
      'New contributors expect 10 images to earn $1,000/month, quit when payouts start at $0.33, and miss high-value $80–$250+ extended-license payouts because they never enable extended licensing. Understanding the royalty math and license tiers is what separates a growing catalog from an abandoned one.',
    concept: [
      'Two license models: Standard Royalty-Free ($0.33–$1.20/download) vs Extended Commercial ($25–$250+/download).',
      'Standard RF covers digital use (web, social, blogs, slides) — small, high-frequency recurring payouts.',
      'Extended licenses cover physical resale (book covers, billboards, TV, packaging) — large, high-margin payouts.',
      'Non-exclusive syndication (Adobe + Freepik + Wirestock) multiplies earnings from one asset pool.',
      'RPA benchmark ~$0.50–$1.50 per image per year; 500 images ≈ $150–$350/mo, 2,000 ≈ $600–$1,400/mo.',
      'Wirestock takes a 15% split to one-click syndicate across 6+ sites.',
    ],
    doIt: [
      'Register non-exclusive contributor accounts on Adobe Stock and Freepik to syndicate the same portfolio.',
      'Enable "Allow Extended / Commercial Licensing" in contributor settings so assets qualify for high-ticket downloads.',
      'Model earnings: 500 images → 50–100 downloads/mo → $150–$350; 2,000 → $600–$1,400 (true passive).',
      'Run the stock-licensing-calculator on a 500-asset portfolio to set realistic month-1 vs month-12 expectations.',
      'Syndicate a 20-image commercial batch across two portals as a first multi-platform test.',
    ],
    launchIt: [
      'Reinvest early royalties into API compute to grow 100 → 1,000+ assets over 6 months.',
      'Always leave extended licensing on — a single billboard/book license can out-earn 100 standard downloads.',
      'Syndicate non-exclusively; one catalog, multiple payouts, near-zero extra effort.',
    ],
    exercises: [
      'Easy: open stock-licensing-calculator.md and model passive earnings for a 500-asset portfolio.',
      'Medium: calculate revenue difference between 100 Standard RF downloads vs 5 Extended Commercial downloads.',
      'Hard: set up non-exclusive accounts on 2 portals and syndicate a 20-image commercial batch across both.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [],
  },
];
