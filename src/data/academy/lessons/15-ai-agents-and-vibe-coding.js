// Typed lesson data for the AI Agents & Vibe-Coding track (track 15).
// Structured form of the upstream markdown in
// src/content/academy/15-ai-agents-and-vibe-coding/lessons/*.md,
// powering the LEARN view. Matched to catalog lessons by `id`.

export const LESSONS_15 = [
  {
    id: '15-ai-agents-and-vibe-coding::01-what-coding-agents-actually-do',
    slug: '15-ai-agents-and-vibe-coding::01-what-coding-agents-actually-do',
    order: 1,
    title: 'What Coding Agents Actually Do',
    summary:
      'Understand exactly how AI coding agents work — and why you don\'t need a CS degree to use them profitably.',
    time: '~35 minutes',
    prerequisites: [],
    problem:
      'Most creators hear "build your own tools" and disengage, assuming it needs years of computer science. That was true before 2023. Coding agents have inverted it: you can now build anything you can clearly describe — the agent writes, edits, runs, and debugs the code while you direct.',
    concept: [
      'A coding agent reads, writes, runs, and debugs code files autonomously inside your project folder.',
      'Chatbots (ChatGPT web) only reply in chat — no file access, no execution; slow for building.',
      'Agents (Claude Code, Cursor, Copilot) operate inside your filesystem and self-correct from errors.',
      'Traditional scripts are fast but need you to write and debug them yourself.',
      'Agents can build batch API runners, metadata generators, prompt expanders, intake automations, calculators.',
      'You direct in plain English; you do not need to read or understand the generated code.',
    ],
    doIt: [
      'Install an agent: Claude Code via `npm install -g @anthropic-ai/claude-code` or download Cursor.',
      'Open a project folder and give one clear instruction (e.g. create a numbered prompt printer).',
      'Run the file the agent produced to confirm it works.',
      'Iterate by describing the change in plain English ("save output to results.txt").',
      'Open the vibe-coding session brief template to plan your first real session.',
      'Compare agents on interface and cost before committing to one.',
    ],
    launchIt: [
      'Sell an Agent Setup Service: $99–$199 to install and configure Claude Code/Cursor for non-technical creators.',
      'Many creators will pay to skip the terminal setup entirely — that is your first product.',
      'Bundle setup with a first micro-tool as a paid onboarding offer.',
    ],
    exercises: [
      'Easy: install an agent, open a blank folder, and have it create `hello.txt` with a short message.',
      'Medium: ask the agent for a script that reads product names from a file and writes them uppercased.',
      'Hard: build a script that generates 5 prompt variations from a subject/style/angle, reading a CSV and writing a CSV.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['15-ai-agents-and-vibe-coding::micro-tool-app-interface'],
  },
  {
    id: '15-ai-agents-and-vibe-coding::02-building-your-first-sellable-micro-tool',
    slug: '15-ai-agents-and-vibe-coding::02-building-your-first-sellable-micro-tool',
    order: 2,
    title: 'Building Your First Sellable Micro-Tool',
    summary:
      'Scope, build, and wrap a single-function creator tool in one vibe-coding session — then turn it into a product.',
    time: '~50 minutes',
    prerequisites: ['15-ai-agents-and-vibe-coding::01-what-coding-agents-actually-do'],
    problem:
      'Beginners try to build a full SaaS and stall within 48 hours: the scope is too big to describe in one instruction, errors are impossible to locate, and weeks pass with nothing sellable. The Micro-Tool Method builds one tool that does exactly one thing well — shippable in a single 60-minute session.',
    concept: [
      'A micro-tool does exactly one thing extremely well: small, specific, maintainable by a non-developer.',
      'Scope it before opening the agent: exact input, exact output, one transformation, named buyer.',
      'High-value categories: batch prompt runner, Etsy SEO generator, stock metadata writer, pricing widget, script formatter.',
      'Sell price tracks time saved: $15–$59 one-time depending on the buyer\'s hourly rate.',
      'Lifetime license is the easiest sell — buyers resist subscriptions for a weekly script.',
      'Gumroad handles payment, delivery, and VAT so you can list in 10 minutes.',
    ],
    doIt: [
      'Fill the tool scope definition: input, output, transformation, buyer.',
      'Write one agent instruction that specifies file names, API call, output columns, and the API key source.',
      'Create a real `products.txt` with 5 actual names and run the script.',
      'Verify CSV quality; if weak, tell the agent to improve the system prompt.',
      'Ask the agent to add a plain-English README with exact install/run commands.',
      'Zip script + README + sample input so a non-technical buyer can run it from scratch.',
    ],
    launchIt: [
      'Price $19–$59 as a lifetime license based on time saved per use.',
      'Upload the zip to Gumroad as a downloadable product in under 10 minutes.',
      'Lead the listing with the outcome ("30 keywords in 4 minutes"), not the script name.',
    ],
    exercises: [
      'Easy: complete a tool scope definition for a "YouTube Script Formatter" (input/output/transformation/buyer).',
      'Medium: build a script that reads `designs.txt` and writes `titles.csv` with 3 Etsy titles each via gpt-4o-mini.',
      'Hard: package your tool with README, sample input, and `requirements.txt`; have a peer run it cold.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['15-ai-agents-and-vibe-coding::micro-tool-app-motion'],
  },
  {
    id: '15-ai-agents-and-vibe-coding::03-vibe-coding-workflow',
    slug: '15-ai-agents-and-vibe-coding::03-vibe-coding-workflow',
    order: 3,
    title: 'The Vibe-Coding Workflow: Prompt → Build → Test → Ship',
    summary:
      'A repeatable 4-phase development loop that lets you build and ship working creator tools without reading a single line of code.',
    time: '~50 minutes',
    prerequisites: [
      '15-ai-agents-and-vibe-coding::01-what-coding-agents-actually-do',
      '15-ai-agents-and-vibe-coding::02-building-your-first-sellable-micro-tool',
    ],
    problem:
      'After the second or third tool, creators hit the same wall: the agent\'s file crashes, a fix breaks something else, and the session collapses into confusion. Vibe-coding without a structured workflow is just random prompting. A 4-phase loop gives you and the agent a clear contract per phase.',
    concept: [
      'The loop: PROMPT (scope) → BUILD (generate) → TEST (verify) → SHIP (package).',
      'Phase 1 Prompt: write a Tool Spec Brief before opening the agent — never improvise.',
      'Phase 2 Build: paste the full brief once, let it generate, then correct with one targeted sentence.',
      'Phase 3 Test: run on real data, check format/edge cases/speed, paste exact error messages back.',
      'Phase 4 Ship: have the agent write README + requirements.txt, then zip and upload.',
      'Golden rule: never open the agent without a written brief.',
    ],
    doIt: [
      'Complete a session brief: tool name, one-line description, input, output, API, error handling, packages.',
      'Paste the full brief into the agent and wait for the complete first draft — do not interrupt.',
      'Create a real `prompts.txt` and verify the output file has correct rows with working results.',
      'On bugs, paste the exact error text (not a paraphrase) and let the agent fix it.',
      'Ask the agent for README.md and requirements.txt, then zip as `[tool]-v1.0.zip`.',
      'Upload the zip to Gumroad or LemonSqueezy to ship.',
    ],
    launchIt: [
      'Sell a v2.0 upgrade (e.g. add a GUI) to existing buyers for $9–$15.',
      'Bundle 3 related micro-tools at a 25% discount — bundles beat singles 2.5–4x.',
      'Treat each shipped tool as one entry in a compounding monthly portfolio.',
    ],
    exercises: [
      'Easy: write a full session brief for a "YouTube Script Section Formatter" without opening an agent.',
      'Medium: run a full 4-phase session building a script that generates niche product keywords per store.',
      'Hard: complete Prompt→Build→Test→Ship for a tool of your choice and write its Gumroad product copy.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['15-ai-agents-and-vibe-coding::vibe-coding-workspace-motion'],
  },
  {
    id: '15-ai-agents-and-vibe-coding::04-pricing-and-selling-tools',
    slug: '15-ai-agents-and-vibe-coding::04-pricing-and-selling-tools',
    order: 4,
    title: 'Pricing & Selling Tools You Build With Agents',
    summary:
      'Turn micro-tools into a recurring passive income stream using Gumroad, LemonSqueezy, and creator affiliate networks.',
    time: '~40 minutes',
    prerequisites: [
      '15-ai-agents-and-vibe-coding::02-building-your-first-sellable-micro-tool',
      '15-ai-agents-and-vibe-coding::03-vibe-coding-workflow',
    ],
    problem:
      'Most creators undercharge or give tools away free on GitHub and make $0. Buyers pay for time saved, not code complexity — a script saving 10 hours/week is worth far more than $5. Priced right and listed on the right platforms, one tool can earn $500–$3,000 in 30 days.',
    concept: [
      'Monetization stack: micro-tool → Gumroad/LemonSqueezy page → community launch → affiliates → passive revenue.',
      'Price ≈ 10% of monthly value saved (hours saved × buyer hourly rate × 0.10).',
      'One-time lifetime license converts 3–5x better than subscriptions for sub-10k audiences.',
      'Subscriptions fit tools with per-run API costs ($9–$29/mo via LemonSqueezy).',
      'Pay-what-you-want with a $9 floor and $25 suggest often beats a fixed price.',
      'Affiliates at 30–40% turn other creators into your sales force.',
    ],
    doIt: [
      'Write the product page: outcome headline, the pain, what\'s included, exact buyer, price anchor.',
      'Set up Gumroad (one-time) or LemonSqueezy (subscriptions); upload zip and publish in 10 minutes.',
      'Launch in communities where the buyer lives (Etsy/FB groups, r/StableDiffusion, newsletters).',
      'Post a 60-second Loom showing the tool on real data — video demos convert 20–35% vs 5–10% text.',
      'Enable Gumroad/LemonSqueezy affiliates at 30–40% commission.',
      'Pitch affiliates: one mention earns them $12 per sale, no ongoing work.',
    ],
    launchIt: [
      'Build 1 new micro-tool per month; 6 tools at $300–$500/mo compounds to $1,800–$3,000/mo.',
      'Ship a v2.0 every 90 days to keep listings fresh and prompt re-shares.',
      'Stack Gumroad + community + affiliates so revenue keeps arriving after launch week.',
    ],
    exercises: [
      'Easy: write 5 outcome-focused headline variations for a tool you built or plan to build.',
      'Medium: price a tool that saves a stock photographer 6 hrs/batch at $20/hr using the 10% formula.',
      'Hard: list a real tool on Gumroad at a price, post in one community, and report week-1 results.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: ['15-ai-agents-and-vibe-coding::vibe-coding-workspace'],
  },
];
