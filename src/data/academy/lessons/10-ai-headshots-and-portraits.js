// Typed lesson data for the AI Headshots & Portraits Academy track (track 10).
// Extracted from src/content/academy/10-ai-headshots-and-portraits/lessons/*.md.
// Powers the LEARN view; AcademyPage matches rich lessons to catalog lessons by `id`.

export const LESSONS_10 = [
  {
    id: '10-ai-headshots-and-portraits::01-consistent-headshot-generation',
    slug: '10-ai-headshots-and-portraits::01-consistent-headshot-generation',
    order: 1,
    title: 'Consistent Headshot Generation',
    summary:
      'Transform casual smartphone selfies into studio-grade corporate portraits without facial distortion or artificial plastic skin.',
    time: '~40 minutes',
    prerequisites: [],
    problem:
      'Studio headshots cost $250–$600 per person and take a week to deliver, and keeping 30 remote hires visually consistent is nearly impossible. Naive AI face swaps make it worse: waxy plastic skin, drifting eye color, and teeth that line up like a mannequin.',
    concept: [
      'Identity locking anchors the face so the render looks unmistakably like the subject, not a random person.',
      'Facial identity vectors (InstantID / FLUX PuLID) extract landmarks from 1–3 reference selfies and feed them into the model.',
      'Studio lighting is a prompt discipline: key, fill, and rim lights build dimension and separate the subject from the background.',
      'Skin realism comes from restraint: img2img denoising of 0.40–0.55 plus frequency separation preserves authentic pores.',
      'The failure mode is over-smoothing — low-end filters destroy wrinkles and freckles and read as obvious AI.',
    ],
    doIt: [
      'Collect 3–5 window-lit selfies: direct eye contact, varying angles, no sunglasses or heavy filters.',
      'Prepend a tier prompt (Executive Navy Blazer, Tech Turtleneck, etc.) plus a negative prompt for plastic skin and extra teeth.',
      'Run identity-locked inference at 1:1 (LinkedIn/Slack) or 4:5 (team pages).',
      'Swap wardrobe with inpainting while keeping the facial identity seed locked.',
      'Inspect at 100% zoom for natural pores and catchlights; save at high resolution.',
    ],
    launchIt: [
      'Individual package: $49–$79 for 5 styled variations (Formal, Business Casual, Creative, Studio Dark, Office Bokeh).',
      'Corporate team pass (10 employees): $399–$599 with matched background and dress code.',
      'Lead with the cost gap — $0.06 of compute vs. a $350 studio quote — to justify your margin.',
    ],
    exercises: [
      'Easy: take a window-daylight selfie and write a studio portrait prompt with a blurred office background.',
      'Medium: perform a clothing swap, turning a casual t-shirt into a navy blazer.',
      'Hard: generate 3 consistent headshots for 3 different people using the same lighting prompt and bokeh.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '10-ai-headshots-and-portraits::corporate-executive-headshot',
      '10-ai-headshots-and-portraits::headshot-lighting-motion',
    ],
  },
  {
    id: '10-ai-headshots-and-portraits::02-standing-out-against-fiverr-competition',
    slug: '10-ai-headshots-and-portraits::02-standing-out-against-fiverr-competition',
    order: 2,
    title: 'Standing Out Against Fiverr Competition',
    summary:
      'Escape the $5 consumer headshot race to the bottom by selling high-ticket B2B team packages to corporate companies.',
    time: '~45 minutes',
    prerequisites: ['10-ai-headshots-and-portraits::01-consistent-headshot-generation'],
    problem:
      'The $5–$10 consumer headshot market is a race to the bottom where acquisition costs eat margins and refund requests kill profit. Meanwhile companies spend $3,000–$10,000/yr on team headshots and refuse $5 apps over privacy and brand-consistency concerns.',
    concept: [
      'Pivot from B2C micro-transactions to B2B team packages — $599/company beats $5/photo.',
      'Brand style-guide matching: one background gradient, lighting ratio, and dress code across every employee.',
      'Enterprise privacy wins deals: GDPR-compliant selfie purging (delete within 7 days) clears security reviews.',
      'High-resolution delivery (300dpi, 4000px+) suits print annual reports and press kits, not just 512px avatars.',
      'Self-serve intake portals let employees upload selfies and pick outfits without you in the loop.',
    ],
    doIt: [
      'Define three tiers: Startup Pass $399, Corporate Standard $799, Enterprise Unlimited $1,499.',
      'Build a white-labeled intake form (Tally/Typeform) for name, title, outfit, and 3 selfies.',
      'Target companies with fresh funding, rebrands, or 5+ recent remote hires (LinkedIn/Apollo).',
      'Pitch the "unified remote team headshot" with a 30-second before/after sample.',
      'Deliver per-employee folders: 1:1 LinkedIn, 4:5 website, 300dpi print PNG.',
    ],
    launchIt: [
      'Offer a GDPR data-purge guarantee with a signed 7-day deletion clause.',
      'Sell a $99/month new-hire retainer for up to 3 headshots as team members join.',
      'Quote per-company, not per-photo; upsell additional seats at $20/person.',
    ],
    exercises: [
      'Easy: create a B2B intake form template (name, title, outfit, selfie upload).',
      'Medium: transform one selfie into 3 corporate styles on a unified grey gradient.',
      'Hard: pitch a 10+ employee company with a custom before/after of their CEO.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['10-ai-headshots-and-portraits::headshot-transformation-before-after'],
  },
  {
    id: '10-ai-headshots-and-portraits::03-batch-headshots-for-remote-teams',
    slug: '10-ai-headshots-and-portraits::03-batch-headshots-for-remote-teams',
    order: 3,
    title: 'Batch Headshots & Bulk Automation for Remote Teams',
    summary:
      'Scale from individual portraits to processing 50+ remote employee headshots in a single automated batch run.',
    time: '~40 minutes',
    prerequisites: [
      '10-ai-headshots-and-portraits::01-consistent-headshot-generation',
      '10-ai-headshots-and-portraits::02-standing-out-against-fiverr-competition',
    ],
    problem:
      'A 50-person remote company sends 150+ raw selfies. Hand-processing each one — typing prompts, running inference, organizing folders — takes 12+ hours of repetitive work and makes enterprise contracts impossible to service.',
    concept: [
      'A batch pipeline turns a roster into renders: CSV + selfies → identity vectors → background sync → auto-zip.',
      'CSV ingestion carries employee_id, name, role, dress_code, selfie_path for systematic processing.',
      'Auto face-detection/cropping (OpenCV/MediaPipe) standardizes every selfie to 1:1 before inference.',
      'A fixed corporate background asset injected across all renders guarantees identical composition.',
    ],
    doIt: [
      'Build a master roster CSV with employee id, name, title, dress code, and selfie path.',
      'Run a pre-processing script to auto-crop each selfie with head margin at 1:1.',
      'Loop the API (muapi /nano-banana-2 or InstantID) per employee, locking the background seed.',
      'Auto-package per-employee subfolders (LinkedIn 1080px, website 2400px) into one client zip.',
    ],
    launchIt: [
      'Charge $20–$25 per seat beyond the base tier (35-person team → $999 on the $799 plan).',
      'Script a pre-zip quality audit checking resolution and file size to catch corrupt renders.',
      'Sell the time savings: 18 min of compute vs. 10+ hours of manual labor.',
    ],
    exercises: [
      'Easy: create a CSV roster for 5 hypothetical employees with names, titles, dress codes.',
      'Medium: write a script to auto-crop 5 selfies to 1:1 centered on face landmarks.',
      'Hard: run a batch generating 5 headshots with a unified studio background.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [],
  },
  {
    id: '10-ai-headshots-and-portraits::04-creative-headshots-and-stylized-portraits',
    slug: '10-ai-headshots-and-portraits::04-creative-headshots-and-stylized-portraits',
    order: 4,
    title: 'Creative Headshots & Stylized Executive Portraits',
    summary:
      'Expand into high-ticket editorial, keynote speaker, author, and creative industry portraits using cinematic mood lighting.',
    time: '~40 minutes',
    prerequisites: [
      '10-ai-headshots-and-portraits::01-consistent-headshot-generation',
      '10-ai-headshots-and-portraits::02-standing-out-against-fiverr-competition',
    ],
    problem:
      'Formal suit-and-grey-background headshots miss creative clients. Keynote speakers, authors, podcasters, and founders pay $150–$350 per custom pack but reject bland corporate photography — they want dramatic, editorial, stylized portraits.',
    concept: [
      'The creative pipeline shifts lighting geometry and environment, not the identity lock.',
      'Keynote Speaker: dark moody background, Rembrandt side light, warm rim, dramatic shadow falloff.',
      'Tech Founder Loft: sunlit brick, soft window light, relaxed turtleneck/denim.',
      'Podcast/Media: dual-tone gel accents (magenta key + cyan rim) on a dark studio.',
      'Identity weight ~0.85 keeps the face exact while the model invents lighting and mood.',
    ],
    doIt: [
      'Pick the aesthetic (Keynote, Loft, Podcast Gel) from your style guide.',
      'Write a cinematic prompt with gel lighting, environment, and lens anchors.',
      'Run identity-locked inference at weight 0.85.',
      'Color-grade (teal/orange or warm amber) and export as creative-studio-headshot.jpg.',
    ],
    launchIt: [
      'Creative portrait pack: $149–$249 for 5 stylized variations.',
      'Bundle pre-sized assets for Spotify covers (3000px), YouTube banners (2560px), press kits.',
      'Target authors, speakers, and podcasters who need book-cover and one-sheet imagery.',
    ],
    exercises: [
      'Easy: generate a portrait with dual gel lighting (blue key + amber rim).',
      'Medium: create an environmental loft headshot with exposed brick.',
      'Hard: produce a 4-portrait editorial press kit (Author, Stage, Loft, Studio Dark).',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['10-ai-headshots-and-portraits::creative-studio-headshot'],
  },
];
