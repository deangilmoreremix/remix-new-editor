// Typed lesson data for the AI Content Factories Academy track (track 04).
// Extracted from tracks/04-ai-content-factories lessons (see src/content/academy
// for the verbatim upstream markdown). Powers the LEARN view; id/slug/order/title/
// summary/time/prerequisites/relatedTemplateIds/relatedAssetIds are copied verbatim
// from the catalog (src/data/academy/catalog.ts).

export const LESSONS_04 = [
  {
    id: '04-ai-content-factories::01-production-pipeline',
    slug: '04-ai-content-factories::01-production-pipeline',
    order: 1,
    title: 'The Multi-Step Production Pipeline',
    summary: 'A factory is built on stations, not tasks.',
    time: '~40 minutes',
    prerequisites: [],
    problem:
      'Most creators make video as an ad-hoc craft — writing a line, testing an image, recording a clip, editing, tweaking — which causes decision fatigue and burns hours (a 60s video can eat an afternoon). If you charge $50/video and spend 4 hours, you are earning $12.50/hour. Selling content as a service demands an assembly line: discrete stations where assets flow one direction from idea to schedule.',
    concept: [
      'Core principle: the Linear Production Pipeline — Idea → Script → Voiceover → Visuals → Assembly → Polish → Schedule.',
      'Unidirectional Flow: work never moves backward; you do not rewrite a script after voiceover or generate visuals after editing.',
      'Station Specialization: each stage has strict input/output criteria so unfinished work never clogs downstream editors.',
      'Standardized Deliverables: exports are checked against specs (resolution, codecs, audio thresholds) before delivery to kill revision loops.',
    ],
    doIt: [
      'Create a factory folder template mirroring the stations: 01_scripts, 02_audio, 03_assets, 04_edit, 05_exports.',
      'Stations 1 & 2: draft and lock the batch scripts under the word limit, then lock them (no later edits).',
      'Stations 3 & 4: batch-generate voiceovers, cut start/trailing silence, and log each duration in a narration log.',
      'Station 5: generate or source background visuals to match the logged audio timeline — do not open the editor yet.',
      'Stations 6 & 7: cut visuals to the audio spine, apply caption templates and a LUT color profile.',
      'Station 8: run the asset-specs checklist (9:16 or 16:9, peak audio -3dB to -1dB, keyword-in-filename) before export.',
    ],
    launchIt: [
      'Pipeline Audit Service: audit a local business workflow and design a custom production flowchart for $500–$1,000.',
      'Content Sourcing Outsourcing: hire cheap VAs to run specific stations (visuals, audio) while you keep scripting and editing.',
      'Sell the documented pipeline itself as a one-time deliverable so clients can own the system without you.',
    ],
    exercises: [
      'Easy: set up a clean factory folder structure on your drive and organize a mock set of audio and visual files inside.',
      'Medium: document your current workflow step-by-step; flag where you move backward and rewrite it as a strict unidirectional flow.',
      'Hard: build a full 60s video with a stopwatch; track time per station and write a plan to optimize the slowest one.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['04-ai-content-factories::content-factory-studio'],
  },
  {
    id: '04-ai-content-factories::02-tiktok-reels-factory',
    slug: '04-ai-content-factories::02-tiktok-reels-factory',
    order: 2,
    title: 'Building a TikTok/Reels Factory',
    summary: 'Attention is won in the first half-second, and kept with kinetic movement.',
    time: '~45 minutes',
    prerequisites: ['The Multi-Step Production Pipeline'],
    problem:
      'Vertical feeds are swiped in under 0.5 seconds, so a slow fade-in, a logo, or a "hello guys" loses the viewer instantly. Creators also edit vertical like widescreen: static images, tiny bottom captions, and text hidden under platform UI overlays. You need custom editor presets tuned for mobile-first swiping.',
    concept: [
      'Vertical retention rests on three elements: kinetic cut, micro-word captions, and safe-zone compliance.',
      'Kinetic Cut: never leave a still image static — apply a slow 100%→108% scale-up over 3s to register as active video.',
      'Micro-Word Captions: output 1–3 words at a time in bold, high-contrast, center-aligned text for muted scrollers.',
      'Safe Zone: keep the subject and captions in the central safe zone, away from the right/bottom UI overlays.',
    ],
    doIt: [
      'Set the project to 9:16 (1080x1920); ensure backgrounds cover full height with no black bars.',
      'Auto-caption, then style all captions Montserrat Bold/Impact, white with an 8px black stroke.',
      'Recolor action verbs/keywords (e.g. WIN, DANGER) to yellow or green for emphasis.',
      'Position captions at Y ≈ -120 to -150px — slightly below center, above the username.',
      'Cut the first visual at exactly 1.5s, then every 2.5–3.0s per the editor preset.',
      'Add a pattern interrupt at 15s/30s: a sudden 120% zoom plus a subtle whoosh/swish to reset attention.',
    ],
    launchIt: [
      'Batch UGC Packs: pitch gyms, cafes, or beauty brands; offer 15 vertical reels for $500–$800.',
      'Creator Captain Services: cut a client\'s long-form into 10 clips with your presets and schedule them for a $1,000/month retainer.',
      'Keep a reusable CapCut preset so every new client batch starts from the same tuned settings.',
    ],
    exercises: [
      'Easy: import a widescreen image into a 9:16 project, scale/crop to fit, and save.',
      'Medium: auto-caption a 30s track with Montserrat Bold, 2 words per screen, and highlight 3 keywords.',
      'Hard: produce a 30s vertical with cuts every 2s, 100%→108% background animation, and text strictly inside safe zones.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '04-ai-content-factories::fitness-reel-clip',
      '04-ai-content-factories::fitness-reel-preview',
    ],
  },
  {
    id: '04-ai-content-factories::03-youtube-shorts-factory',
    slug: '04-ai-content-factories::03-youtube-shorts-factory',
    order: 3,
    title: 'Building a YouTube Shorts Factory',
    summary: 'A video that never ends is watched forever.',
    time: '~45 minutes',
    prerequisites: ['The Multi-Step Production Pipeline', 'Building a TikTok/Reels Factory'],
    problem:
      'The Shorts algorithm rewards retention percentage, and because Shorts loop, a viewer who stays past the restart registers 105% — which pushes the video into the shelf. But most creators kill retention at the end with "thanks for watching," a subscribe button, or a 2s fade-to-blank, signaling the video is over and triggering a swipe.',
    concept: [
      'Core mechanism: the Seamless Script & Audio Loop — [final word] → (0-frame gap) → [first word].',
      'Loop Sentence: the last sentence stays unfinished; the opening sentence completes it.',
      'Audio Continuity: background music holds constant volume/tempo — never apply a fade-out to the tail.',
      'Visual Continuity: the final clip\'s framing and color must match the opening clip so the transition does not flash.',
    ],
    doIt: [
      'Draft the loop boundary first using the shorts looping blueprint (ending text + starting text).',
      'Generate TTS with the ending and starting phrases in separate files to avoid end-of-sentence pitch drops.',
      'Zoom to frame level and slice/delete all trailing silent frames — leave no 0.1s gap.',
      'Lock background music volume (e.g. -18dB) start to finish; no fade-in or fade-out at the edges.',
      'Match the first and last frames (dark→dark) and apply a constant pan-right or slow zoom-out to both edges.',
    ],
    launchIt: [
      'Looping Comments: pin a comment that completes the loop or asks about it to drive engagement.',
      'Keep titles under 40 characters so they do not cover on-screen text.',
      'Use the loop as a resellable hook template across a client\'s whole catalog of shorts.',
    ],
    exercises: [
      'Easy: write a 3-sentence script where the final sentence connects back to the first; read it aloud.',
      'Medium: import a VO clip, zoom the timeline, and crop all tail silence down to the millisecond.',
      'Hard: produce a 15s loop and verify audio + visual loop seamlessly with no stutter or pop.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '04-ai-content-factories::focus-anchor',
      '04-ai-content-factories::focus-loop-clip',
    ],
  },
  {
    id: '04-ai-content-factories::04-thumbnail-design',
    slug: '04-ai-content-factories::04-thumbnail-design',
    order: 4,
    title: 'AI Thumbnail Design',
    summary: 'The title gets them to think; the thumbnail gets them to click.',
    time: '~40 minutes',
    prerequisites: ['The Multi-Step Production Pipeline'],
    problem:
      'You can spend 20 hours on a video, but if the thumbnail fails to attract clicks it is dead on arrival — platforms measure CTR, and under 3% they stop showing it. Beginners clutter thumbnails with 10 words of text, low-contrast images, and multiple logos, which reads as an unreadable blur on a phone.',
    concept: [
      '3-Second Rule: the viewer must grasp topic + emotional hook in under 3s — one clear subject, max 3 words of text; do not repeat the title.',
      'High Visual Contrast: use opposing palettes (neon blue/gold/green on dark minimalist backgrounds) to pop in feeds.',
      'Focal Subject Placement: subject on the left/right third, bold text on the opposite third; keep the bottom-right clear of the duration timestamp.',
    ],
    doIt: [
      'Generate the 16:9 (or 1:1) background from the thumbnail prompt library via nano-banana-2.',
      'Open your editor at 1280x720 and drop in the generated image.',
      'Boost contrast +15%, saturation +12%, and apply a slight Gaussian blur (size 5) to the background to separate the subject.',
      'Add a ≤3-word ultra-bold phrase (Archivo Black), white/yellow with a thick black stroke (width 12).',
      'Mobile preview audit: zoom to ~10% scale; if text/subject are unreadable, enlarge the subject and strip detail.',
    ],
    launchIt: [
      '24-Hour Swap: if CTR is under 3% after 24h, generate a new-color thumbnail and swap it — do not delete the video.',
      'Keep a Canva folder of "high-CTR text layouts" to drag generated images behind pre-styled boxes in under 3 minutes.',
      'A/B two thumbnails per video and log which color scheme wins to build a reusable palette.',
    ],
    exercises: [
      'Easy: generate a conceptual image and boost its contrast 15% and saturation 10%.',
      'Medium: design a 1280x720 thumb with the subject on the right third and a 2-word text on the left third, thick black drop shadow.',
      'Hard: mobile-audit three competitors\' thumbnails; map their text sizes/focal subjects and list two readability fixes each.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '04-ai-content-factories::get-rich-automated-thumbnail',
      '04-ai-content-factories::thumbnail-motion-clip',
    ],
  },
  {
    id: '04-ai-content-factories::05-batching-and-scheduling',
    slug: '04-ai-content-factories::05-batching-and-scheduling',
    order: 5,
    title: 'Batching & Scheduling at Volume',
    summary: 'Consistency is scheduled; chaos is manual.',
    time: '~35 minutes',
    prerequisites: ['The Multi-Step Production Pipeline'],
    problem:
      'Channels run in panic — a gap, a rushed low-quality upload, then silence when life gets busy. Algorithms reward consistency (one post a day at the same hour beats five in a day then two weeks off). You must separate production from publishing with a 30-day queue that runs on autopilot.',
    concept: [
      '30-Day Queue System: Batch Production Week → 30 Scheduled Videos → Daily Auto-Release.',
      'Temporal Batching: run one station at a time across the whole batch before moving to the next.',
      'Syndicated Schedulers: upload batches into native platform schedulers for automatic release.',
      'Repurposing Pipelines: feed long-form into clipping tools to extract multiple vertical shorts.',
    ],
    doIt: [
      'Mark upload frequency on the 30-day production calendar (e.g. 1 post/day at 12:00 PM).',
      'Days 1–5: draft 30 scripts grouped by sub-topic to keep writing focused.',
      'Days 6–8: generate all 30 narrations in one session; name 01.mp3–30.mp3 and trim silences.',
      'Days 9–12: bulk-generate visuals with uniform prompt formats for a consistent style.',
      'Days 13–17: edit and bulk-export the 30 files from one master project.',
      'Days 18–20: upload to YT/TikTok/Reels Studios and schedule each release date/time.',
    ],
    launchIt: [
      'Identify Peak Hours: schedule release ~2h before the "when your viewers are online" peak so metadata indexes.',
      'Stagger cross-posts (YT 12:00, TikTok 12:30, Reels 1:00) to capture audiences across feeds.',
      'Sell the 30-day calendar management as an add-on so clients never touch scheduling.',
    ],
    exercises: [
      'Easy: fill out a 7-day schedule using the 30-Day Production Calendar.',
      'Medium: write 5 scripts, generate the 5 audio files, trim silences in one session, and log your time.',
      'Hard: feed a 10-min video into a clipping tool, extract 5 shorts, and schedule them daily on a test channel.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '04-ai-content-factories::batch-production-suite',
      '04-ai-content-factories::batch-suite-clip',
    ],
  },
  {
    id: '04-ai-content-factories::06-selling-content-services',
    slug: '04-ai-content-factories::06-selling-content-services',
    order: 6,
    title: 'Selling Content-Factory Output as a Service',
    summary: "Businesses don't want views; they want the consistency that builds views.",
    time: '~30 minutes',
    prerequisites: ['The Multi-Step Production Pipeline', 'Batching & Scheduling at Volume'],
    problem:
      'Per-video or per-hour pricing forces a constant pitch cycle — income drops to zero between projects. Unreliable clients (3 videos, a month pause, a late revision) break the pipeline. To scale income you must stop selling one-off edits and package output as a monthly recurring retainer.',
    concept: [
      'Business model: the Subscription Content Retainer — Client Retainer → Upfront Payment → Weekly Batch Delivery.',
      'Predictable Income: you know next month\'s revenue, so you can hire assistants or buy software.',
      'Pipeline Planning: deliver in predictable weekly batches (e.g. 7 videos every Friday), killing emergencies.',
      'High Margins: AI generation costs under $1/video, so a $1,500 retainer is roughly a 98% net margin.',
    ],
    doIt: [
      'Define tiers from the bulk pricing sheet: Growth Factory ($1,500/mo, 30 videos + thumbnails + SEO) and Syndication Network ($2,800/mo, 60 videos across platforms).',
      'Set up recurring invoicing (Stripe/PayPal/Whop) and always bill upfront before producing.',
      'Target high-budget, no-time businesses: professional services, coaches/consultants, e-commerce owners.',
      'Send a simple retainer proposal: deliverables, weekly batch schedule, and upfront price.',
      'Onboard with a shared folder split into [Raw_Assets_From_Client] and [Weekly_Deliveries].',
    ],
    launchIt: [
      'Limit Revisions: contract requires batch revision requests within 48h of delivery to stop drawn-out feedback.',
      'Upload Add-on: manage posting/scheduling for +$300/month for a friction-free client service.',
      'Lead with the margin math (e.g. ~8h/month, ~$22 API cost, ~$1,479 profit) to close professional clients.',
    ],
    exercises: [
      'Easy: draft your own customized agency package pricing sheet.',
      'Medium: fill the Retainer Proposal template with a mock client and its weekly batch deliverables.',
      'Hard: find 3 local professional-service sites with blank social feeds; draft a cold email offering a 10-video test batch.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '04-ai-content-factories::agency-client-pitch',
      '04-ai-content-factories::agency-pitch-clip',
    ],
  },
];
