import{r}from"./index-CgxiKb8A.js";const i=`BYOK — bring your own key — means an AI builder runs on an API key you get directly from a provider like OpenAI or Anthropic. You pay the provider's raw per-token rates; the tool itself adds no markup and needs no subscription. Most popular AI builders (Lovable, Bolt.new, v0) do **not** work this way: they resell AI usage as credits or token packs.

If you specifically want BYOK, the field is small. Here are the options worth knowing in 2026.

## 1. OpenThorn

[OpenThorn](https://www.openthorn.app) is a free, browser-based BYOK website builder. You connect a key from any of 18 providers (OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, and more), describe the site you want, and an agent generates complete React code with a live in-browser preview. One-click Cloudflare Pages deploy, full code export, no platform fee of any kind. Disclosure: this is our product — the rest of this list is genuinely worth a look if it fits you better.

**Best for:** building and deploying complete websites without a subscription.

## 2. bolt.diy

[bolt.diy](https://github.com/stackblitz-labs/bolt.diy) is the open-source sibling of Bolt.new. You run it yourself (locally or self-hosted) and plug in keys for the model of your choice. Powerful and free, but it is a developer tool: expect to clone a repo and manage your own environment, and hosting the result is on you.

**Best for:** developers who want full control and don't mind self-hosting.

## 3. Dyad

[Dyad](https://www.dyad.sh) is a local, open-source AI app builder that runs on your machine with your own keys. Strong for building full-stack apps privately; less streamlined than hosted tools for going from prompt to a live deployed website.

**Best for:** local-first builders who want everything on their own machine.

## What about Lovable, Bolt.new, and v0?

They are capable builders, but none of them supports BYOK as of June 2026: Lovable sells monthly credits (Pro from $25/month), Bolt.new sells token packs (Pro $25/month), and v0 meters credits on its own plans (Premium $20/month). If predictable subscription billing suits you, they work well — see our detailed comparisons: [OpenThorn vs Lovable](/compare/lovable), [OpenThorn vs Bolt.new](/compare/bolt), [OpenThorn vs v0](/compare/v0).

## How to choose

- Want a hosted, zero-setup builder with no subscription → OpenThorn.
- Want open source and full control, comfortable with setup → bolt.diy.
- Want everything local and private → Dyad.

New to BYOK? Start with [what a BYOK AI website builder is](/blog/what-is-a-byok-ai-website-builder) and [how to get an API key](/blog/how-to-get-an-ai-api-key).
`,a=`Building a complete website with AI costs between **$0 and about $3 in API usage** — not the $20–50/month that credit-based builders charge. The exact figure depends on one thing most comparisons skip: how many tokens an agentic build actually consumes, and which model processes them. This post measures that directly.

The number matters because almost every "AI website builder pricing" article quotes subscription tiers, not the underlying cost of the AI work. With a bring-your-own-key (BYOK) tool like [OpenThorn](https://www.openthorn.app), the subscription disappears and you pay only for tokens — so the real question becomes *how many tokens does a build take, and what does a provider charge for them?*

## How a website build spends tokens

An AI website builder is not a single prompt. It runs an **agentic loop**: the model plans the site, writes files, compiles them, reads errors, fixes them, and repeats — often across dozens of turns — before it reports done. Each turn re-sends the conversation so far, so raw token counts look enormous.

The detail that keeps the cost low is **prompt caching**. The large, unchanging prefix of every request — the system prompt, the tool definitions, the skill instructions, the conversation history — is cached and re-read at a fraction of the normal input price (typically 10% of the input rate on most providers). So the *effective* token cost of a build is far below the cumulative count.

Measured across typical builds, a complete multi-page marketing site with a few rounds of revisions settles around:

| Token type | Effective tokens per build | Why |
|---|---|---|
| Input (cached + fresh) | ~250,000 | Replayed context, mostly cache reads |
| Output | ~80,000 | The generated code, edits, and agent reasoning |

These are *effective* figures after caching, for a 4–6 page site. A single landing page costs a fraction of this; a large multi-page app with heavy revision costs more. Use them as a midpoint, not a ceiling.

## What that costs on each provider

Applying those token figures to published June 2026 rates, the cost of one complete build falls into four clear tiers:

| Tier | Examples | Cost per complete site |
|---|---|---|
| **Free** | [Google Gemini](https://www.openthorn.app/build-with/google) free tier, [Groq](https://www.openthorn.app/build-with/groq), [Cerebras](https://www.openthorn.app/build-with/cerebras), [Ollama](https://www.openthorn.app/build-with/ollama) (local) | **$0** within daily limits |
| **Very cheap** | [DeepSeek](https://www.openthorn.app/build-with/deepseek), open models via [Together](https://www.openthorn.app/build-with/together) / [Fireworks](https://www.openthorn.app/build-with/fireworks), Gemini Flash (paid) | **single-digit cents** |
| **Mid-tier** | [Claude Sonnet](https://www.openthorn.app/build-with/anthropic), GPT mid-tier, [Mistral](https://www.openthorn.app/build-with/mistral) | **$0.50 – $2** |
| **Flagship** | GPT flagship, Claude's most capable models, [Grok](https://www.openthorn.app/build-with/xai) | **$1 – $3+** |

### A worked example: Claude Sonnet 4.6

Anthropic's published rate for Claude Sonnet 4.6 is **$3 per million input tokens and $15 per million output tokens**. For the reference build above:

- Input: 250,000 tokens × $3/M = **$0.75**
- Output: 80,000 tokens × $15/M = **$1.20**
- **Total: about $1.95** — and lower in practice, because cached input reads bill at roughly a tenth of that input rate.

That is the entire cost of generating a complete website. There is no platform fee on top: OpenThorn is free, so the API bill *is* the bill.

## How this compares to subscription builders

The credit-based builders price the same AI work very differently — as a recurring subscription, whether you build one site or none:

| Builder | Entry plan | What you get |
|---|---|---|
| Lovable | $25/month | ~100 credits (each edit ≈ 0.5–1.2+ credits) |
| Bolt.new | $25/month | ~10–13M tokens/month |
| v0 | $20/month | Metered credits over tokens |
| **BYOK (OpenThorn)** | **$0 platform fee** | **You pay raw token rates — cents to a few dollars per site** |

*(Competitor pricing verified June 12, 2026 against each vendor's pricing page; it changes often.)*

For someone building a handful of sites a year, the gap is stark: **$240–300 per year in subscriptions versus a few dollars in tokens.** For a team shipping constantly inside one platform, a subscription can still be worth it for the integrated workflow. The point is not that subscriptions are bad — it is that the AI work itself is cheap, and BYOK lets you pay only for that.

## How to make a build cost even less

- **Start on a free tier.** [Gemini](https://www.openthorn.app/build-with/google), [Groq](https://www.openthorn.app/build-with/groq), [Cerebras](https://www.openthorn.app/build-with/cerebras), [Mistral](https://www.openthorn.app/build-with/mistral), and [Cohere](https://www.openthorn.app/build-with/cohere) all issue free API keys with daily limits — enough to build your first sites for **$0**.
- **Match the model to the job.** Use a cheap, fast model (Gemini Flash, DeepSeek, an open model) for simple sites and quick iterations; save a flagship for complex, multi-page builds.
- **Run locally with [Ollama](https://www.openthorn.app/build-with/ollama).** Models run on your own hardware: no key, no token bill, nothing leaves your machine.
- **Set a provider spend limit.** Every provider lets you cap monthly spend or pre-fund a balance, so a build can never cost more than you allow.

## The bottom line

The AI work behind a complete website costs cents to a few dollars in tokens — the rest of what builders charge is subscription margin. If you want to pay only for the work, bring your own key: see [how to build a website with AI using your own API key](https://www.openthorn.app/blog/how-to-build-a-website-with-ai-byok), compare live model rates on the [pricing page](https://www.openthorn.app/pricing), or read the full [Lovable vs Bolt.new vs v0 pricing breakdown](https://www.openthorn.app/blog/lovable-vs-bolt-vs-v0-pricing).`,s=`Building a website with AI no longer requires a subscription. With a BYOK (bring-your-own-key) builder like OpenThorn, you connect an API key from an AI provider you already trust, describe what you want, and pay only for the tokens you use — typically cents to a few dollars per site.

Here is the full process, start to finish.

## Step 1: Choose an AI provider and get an API key

Any of OpenThorn's 18 supported providers works: OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral AI, Groq, Together AI, xAI, Cohere, Perplexity, OpenRouter, Ollama, Fireworks AI, Cerebras, Azure OpenAI, Amazon Bedrock, or NVIDIA NIM. If you are unsure, OpenAI or Anthropic are the easiest starting points. See our guide on [how to get an API key](/blog/how-to-get-an-ai-api-key) for exact steps.

## Step 2: Create a free OpenThorn account

Sign up at [openthorn.app](https://www.openthorn.app). The platform itself is free — there is no trial, no credit card, and no subscription tier to pick.

## Step 3: Connect your API key

Open the Providers page in the app and paste your key. Keys are encrypted server-side with AES-256-GCM and never exposed raw to the browser. You stay in control through your provider's dashboard: set spend limits, watch usage, rotate the key any time.

## Step 4: Describe the website you want

Create a project and write a plain-language description: the kind of site, the pages it needs, the tone, anything you care about. OpenThorn's agent plans the build, generates real React code, and compiles it in your browser as it works.

## Step 5: Preview and iterate

The live preview runs entirely in your browser. Ask for changes the same way you asked for the site — "make the hero darker", "add a contact form" — and the agent edits the code. The agent verifies its own work with compile checks and an interactive smoke test before it reports done.

## Step 6: Deploy or export

One click deploys to Cloudflare Pages on a public URL. Or export the full source as a zip — it is standard React + Vite code that runs anywhere. There is no export paywall and no proprietary format.

## What it costs

OpenThorn charges nothing. Your provider bills you for tokens at their published rates — compare models on the [pricing page](/pricing). A typical site costs between a few cents (budget models like DeepSeek or Gemini Flash) and a few dollars (flagship models like Claude or GPT).
`,l=`Every BYOK tool — including OpenThorn — needs an API key from an AI provider. Getting one takes about five minutes. This guide covers the three most popular providers; the pattern is the same everywhere: create an account, add a payment method, generate a key, and set a spend limit.

## OpenAI

1. Go to [platform.openai.com](https://platform.openai.com) and sign up (this is separate from a ChatGPT subscription).
2. Add a payment method under Settings → Billing. New accounts may need a small prepaid credit.
3. Open **API keys**, click **Create new secret key**, and copy it — it is shown only once.
4. Under **Limits**, set a monthly budget so usage can never surprise you.

## Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account.
2. Add billing under **Plans & billing** — Claude API usage is prepaid or invoiced depending on tier.
3. Open **API keys**, create a key, and copy it.
4. Set a workspace spend limit under the workspace settings.

## Google Gemini

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with a Google account.
2. Click **Get API key** — Google offers a free tier with rate limits, so you can start without billing.
3. For higher limits, enable billing on the associated Google Cloud project.

## Using the key

Paste the key into OpenThorn's Providers page — it is encrypted server-side and never exposed raw. Then describe the website you want and build. Full walkthrough: [how to build a website with AI using your own API key](/blog/how-to-build-a-website-with-ai-byok).

Three safety habits worth keeping: set a spend limit before you build anything, never commit a key to a public repo, and rotate keys occasionally from your provider dashboard.
`,p=`## The problem with AI builders

Every AI website builder follows the same playbook: bundle the AI cost, mark it up, lock you into a subscription, and make exporting your own code an afterthought — or a paid upgrade.

You describe an app. They generate it. Then they charge you monthly to keep accessing it, as if the code belongs to them.

OpenThorn doesn't do that.

## What OpenThorn is

OpenThorn is an AI web builder built around one idea: the code you generate should belong to you, and the AI cost should go directly to the provider — not through us.

Describe what you want in plain language. OpenThorn generates real, production-grade code, ready for you to customize and deploy anywhere. No drag-and-drop approximations. No locked editor. No wall between you and your work.

## Bring your own keys — pay nothing to us

This is the core of how OpenThorn works.

You connect your own API keys — OpenAI, Anthropic, Gemini, or any provider you already use. OpenThorn passes your requests directly through. You pay the provider at their published rates, with zero markup on top.

No platform fee. No per-request cut. No subscription. What the model costs is what you pay — nothing more.

If you already have API credits, you can start building right now.

## Your code lives in your infrastructure

When OpenThorn generates your app, the output is yours from the first line. Push it to your GitHub repo, deploy it to your own Vercel account, or host it anywhere you like. There is no OpenThorn lock-in — no proprietary format, no hosted-only runtime, no export paywall.

Watch the code appear in real time as the model writes it. It's production-grade output, not a template wrapper.

## Start from a template

Not sure where to start? The template gallery has production-quality starting points for the most common project types — portfolios, SaaS apps, e-commerce storefronts. Pick one, preview it across desktop, tablet, and phone, then open it in the builder and take it from there.

These are real codebases you can ship, not demos locked behind a sign-up.

## See what the community is building

The community page surfaces apps shared by other OpenThorn users. Browse by newest or most liked, search by project or author, and fork anything worth building on.

It's a useful way to see what's actually possible before you write your first prompt.

## Try it

Bring your model keys and start building.

[Open the dashboard →](/dashboard)
`,h=`Lovable, Bolt.new, and v0 are the three most popular AI app builders in 2026 — and they all price the same way: you buy AI usage from the platform, marked up, as credits or token packs. This post compares what each actually costs, where each one shines, and what the bring-your-own-key (BYOK) alternative looks like.

All prices below were verified on June 12, 2026 against each vendor's public pricing page. They change often — always check the linked pages for current numbers.

## The short version

- **Lovable** — strongest all-round app builder; Pro from [$25/month](https://lovable.dev/pricing) for ~100 credits, with each edit consuming roughly 0.5–1.2+ credits.
- **Bolt.new** — best in-browser dev environment (by StackBlitz); Pro from [$25/month](https://bolt.new/) for ~10–13M tokens. Free tier caps at 1M tokens/month.
- **v0** — best for Next.js/Vercel teams; free tier includes ~$5/month in credits, Premium at [$20/month](https://v0.app/pricing).
- **BYOK tools (like OpenThorn)** — free platform, you pay your AI provider's raw token rates. A typical complete website costs cents to a few dollars, total.

## What you're actually paying for

All three platforms buy inference from AI providers (OpenAI, Anthropic, Google) at wholesale per-token rates and resell it to you in their own unit — credits or packs. The markup funds the product, which is fair. But it has two structural consequences:

1. **Unused budget expires.** Credits and token packs reset monthly. A quiet month still costs $20–25.
2. **You can't pick the model.** The platform decides which model serves your request. When a better or cheaper model ships, you wait for the platform to adopt it.

For scale: Anthropic's published rate for Claude Sonnet 4.6 is [$3 per million input tokens and $15 per million output tokens](https://www.anthropic.com/pricing). A complete landing page generation typically consumes well under a million tokens end to end — which is why BYOK sites cost cents to single-digit dollars.

## Lovable vs Bolt.new vs v0, head to head

| | Lovable | Bolt.new | v0 |
|---|---|---|---|
| Entry paid plan | $25/mo (Pro, ~100 credits) | $25/mo (Pro, ~10M tokens) | $20/mo (Premium) |
| Free tier | ~5 credits/day | 1M tokens/mo (300K/day cap) | ~$5/mo in credits |
| Bring your own key | No | No (bolt.diy, self-hosted, does) | No |
| Model choice | Platform decides | Platform decides | v0 model tiers |
| Code export | GitHub sync | Download/GitHub | Export + Git |
| Standout strength | Polish, full-stack apps | In-browser dev environment | Next.js UI quality |

**Choose Lovable** if you want the most polished end-to-end app builder and don't mind the credit model. **Choose Bolt.new** if you live in the browser and value the StackBlitz environment. **Choose v0** if your stack is Next.js on Vercel — its UI generation there is best in class.

## The BYOK alternative

If the subscription math bothers you — paying $25/month whether you build two sites or zero — the alternative is bringing your own API key. [OpenThorn](https://www.openthorn.app/) is free: you connect a key from any of 18 providers (OpenAI, Anthropic, Google Gemini, DeepSeek, Groq, and more), the agent generates a complete React site, and you pay your provider's raw token rate. No markup, no monthly reset, no model lock-in. Several providers — [Google Gemini](https://www.openthorn.app/build-with/google), [Groq](https://www.openthorn.app/build-with/groq), [Cerebras](https://www.openthorn.app/build-with/cerebras) — even have free API tiers, making the first site genuinely $0.

The trade-off is honest: you manage an API key (five minutes, [guide here](https://www.openthorn.app/blog/how-to-get-an-ai-api-key)) and you don't get Lovable's polish or Bolt's dev environment. What you get instead is raw pricing, any model, and full ownership of the exported source.

## Bottom line

For most people building a handful of websites a year, the math is stark: $240–300/year in subscriptions versus a few dollars in tokens. For teams shipping constantly inside one of these platforms, the subscription can be worth it for the workflow alone. Know which one you are — then pick accordingly.

See the detailed one-on-one comparisons: [OpenThorn vs Lovable](https://www.openthorn.app/compare/lovable), [OpenThorn vs Bolt.new](https://www.openthorn.app/compare/bolt), [OpenThorn vs v0](https://www.openthorn.app/compare/v0).
`,d=`## What does BYOK mean?

BYOK stands for **bring your own key**. A BYOK AI website builder is a tool that generates websites with AI, but instead of charging you a subscription that bundles (and marks up) the AI cost, you connect your own API key from an AI provider — OpenAI, Anthropic, Google, or others. Your requests go straight to the provider you chose, and you pay that provider directly at their published rates.

That's the whole idea. The rest of this post explains why it matters and how it works in practice.

## How is BYOK different from a normal AI website builder?

Most AI website builders work like this: you pay a monthly subscription, the platform calls an AI model on your behalf, and the AI cost — plus a margin — is baked into your plan. You usually get a credit or message limit, and when you hit it, you upgrade.

A BYOK builder inverts that model:

- **You pay for AI usage at cost.** The provider bills you for exactly the tokens you used. There is no markup, because the platform never touches your billing.
- **There is no subscription wall.** Light month? You pay almost nothing. Heavy month? You pay for what you used — and you can see every request on your provider's dashboard.
- **You choose the model.** Want the highest-quality model for a complex app and a cheap one for small edits? With your own keys, that's your call, not a plan tier.
- **No lock-in through credits.** Your API credits live with the provider, not the platform. If you stop using the builder, you lose nothing.

## How much does a BYOK AI website builder cost?

With OpenThorn specifically: the platform is free. You only pay your AI provider for the tokens your builds consume. Generating a typical website costs cents to a few dollars depending on the model you pick — the [pricing page](/pricing) compares live per-token costs and quality across flagship models so you can choose deliberately.

## What do you need to get started?

Three things:

1. **An account with an AI provider.** For example [platform.openai.com](https://platform.openai.com) or [console.anthropic.com](https://console.anthropic.com). Most providers let you start with a small prepaid amount.
2. **An API key.** Generated in your provider's dashboard in about a minute.
3. **A BYOK builder.** Paste the key, describe what you want to build, and start.

OpenThorn supports 18 providers — including OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, xAI, Amazon Bedrock, Azure OpenAI, and even local models via Ollama — so whichever ecosystem you already have credits with, you can use it.

## Is BYOK safe? What happens to my API key?

A serious BYOK platform never exposes your raw key. In OpenThorn, keys are encrypted server-side before storage and decrypted only at the moment a request is sent to the provider you selected. You stay in control: set spend limits in your provider dashboard, rotate keys whenever you like, and revoke a key instantly if you suspect exposure.

## Who is BYOK for?

BYOK fits anyone who wants AI-generated websites without the platform tax:

- **Developers** who already have API keys and don't want to pay twice for the same tokens.
- **Founders and indie hackers** who ship in bursts and resent paying subscriptions during quiet months.
- **Agencies** that build many sites and need usage costs to scale linearly, not by seat or plan tier.
- **Tinkerers** who want to compare models — or run them locally — instead of accepting whatever model a platform picked.

## Try it

OpenThorn is a BYOK AI website builder: describe what you want, get a complete, deployable website, and pay only your provider. Check the [FAQ](/faq) for common questions or [start building](/dashboard) with the keys you already have.
`,u=[{slug:"how-much-does-it-cost-to-build-a-website-with-ai",title:"How Much Does It Cost to Build a Website with AI? (2026 Data)",date:"2026-06-13",excerpt:"Credit-based builders charge $20–50/month, but the AI work behind a complete website costs cents to a few dollars in tokens. A breakdown of what a build actually consumes, and what each provider charges for it.",coverImage:"/assets/blog_6.png",tldr:"A complete AI website build consumes roughly 250,000 input and 80,000 output tokens after prompt caching. At published June 2026 rates that costs $0 on free tiers (Gemini, Groq, Cerebras, Ollama), single-digit cents on cheap models like DeepSeek, and about $0.50–$3 on mid-tier and flagship models such as Claude Sonnet 4.6 — versus $20–50/month for credit-based builders.",itemList:["Free tier (Gemini, Groq, Cerebras, Ollama)","Very cheap (DeepSeek, open models)","Mid-tier (Claude Sonnet, GPT mid-tier)","Flagship (GPT flagship, Claude Opus, Grok)"]},{slug:"lovable-vs-bolt-vs-v0-pricing",title:"Lovable vs Bolt.new vs v0: AI Website Builder Pricing Compared (2026)",date:"2026-06-12",excerpt:"Lovable, Bolt.new, and v0 all resell AI usage as credits or token packs from $20–25/month. We compare what each actually costs, where each shines, and what the BYOK alternative looks like.",coverImage:"/assets/lovable.png",ogImage:"https://www.openthorn.app/assets/lovable.png",tldr:"Lovable Pro costs $25/month (~100 credits), Bolt.new Pro $25/month (~10M tokens), and v0 Premium $20/month. All three resell AI usage with markup and reset monthly. The BYOK alternative — your own API key in a free tool like OpenThorn — prices a typical website at cents to a few dollars, total.",itemList:["Lovable","Bolt.new","v0","OpenThorn (BYOK alternative)"]},{slug:"how-to-get-an-ai-api-key",title:"How to Get an AI API Key (OpenAI, Anthropic, Google Gemini)",date:"2026-06-12",excerpt:"A five-minute guide to creating an API key with OpenAI, Anthropic, or Google Gemini — including billing setup and the spend limits that keep costs predictable.",coverImage:"/assets/blog_4.png",ogImage:"https://www.openthorn.app/assets/blog_4.png",tldr:"Sign up at platform.openai.com, console.anthropic.com, or aistudio.google.com; add billing (Gemini has a free tier without it); generate a secret key; and set a monthly spend limit. The whole process takes about five minutes, and prepaid credit or budget caps keep costs predictable.",howTo:{name:"Get an AI API key",steps:[{name:"Create a provider account",text:"Sign up at platform.openai.com, console.anthropic.com, or aistudio.google.com."},{name:"Add billing",text:"Add a payment method or prepaid credit (Gemini offers a free tier without billing)."},{name:"Generate the key",text:"Create a new secret key in the provider's API keys section and copy it — it is shown only once."},{name:"Set a spend limit",text:"Configure a monthly budget in the provider dashboard so usage can never surprise you."}]}},{slug:"how-to-build-a-website-with-ai-byok",title:"How to Build a Website with AI Using Your Own API Key",date:"2026-06-12",excerpt:"Build and deploy a complete website with AI for cents, not subscriptions: get an API key, connect it to OpenThorn, describe what you want, and ship — in six steps.",coverImage:"/assets/blog_3.png",ogImage:"https://www.openthorn.app/assets/blog_3.png",tldr:"Get an API key from any of 18 supported providers, connect it to OpenThorn (free, encrypted server-side), describe your website in plain language, and the AI agent generates, previews, and deploys it. Total cost: your provider's token rates — typically cents to a few dollars per complete site.",howTo:{name:"Build a website with AI using your own API key",steps:[{name:"Choose an AI provider and get an API key",text:"Pick any of the 18 supported providers (OpenAI, Anthropic, Google Gemini, and more) and generate an API key in its developer console."},{name:"Create a free OpenThorn account",text:"Sign up at openthorn.app — free, no credit card, no subscription."},{name:"Connect your API key",text:"Paste the key on the Providers page; it is encrypted server-side with AES-256-GCM."},{name:"Describe the website you want",text:"Create a project and describe the site in plain language; the agent generates real React code."},{name:"Preview and iterate",text:"Use the in-browser live preview and ask for changes conversationally until it is right."},{name:"Deploy or export",text:"Deploy to Cloudflare Pages in one click, or export the full source code and host it anywhere."}]}},{slug:"best-byok-ai-website-builders-2026",title:"The Best BYOK AI Website Builders in 2026",date:"2026-06-12",excerpt:"Most AI builders resell AI usage as credits. These tools let you bring your own API key instead — OpenThorn, bolt.diy, and Dyad compared, plus how they differ from Lovable, Bolt.new, and v0.",coverImage:"/assets/blog_5.png",ogImage:"https://www.openthorn.app/assets/blog_5.png",tldr:"Three tools let you bring your own API key instead of buying platform credits: OpenThorn (free, hosted, 18 providers), bolt.diy (open source, self-hosted), and Dyad (local desktop app). All three eliminate the $20–50/month subscriptions charged by Lovable, Bolt.new, and v0 — you pay raw token rates instead.",itemList:["OpenThorn","bolt.diy","Dyad"]},{slug:"what-is-a-byok-ai-website-builder",title:"What Is a BYOK AI Website Builder?",date:"2026-06-11",excerpt:"A BYOK (bring-your-own-key) AI website builder is a tool that generates websites with AI while you connect your own API key from a provider like OpenAI or Anthropic — so you pay the provider directly, with no platform markup or subscription.",dateModified:"2026-06-12",coverImage:"/assets/blog_2.jpg",ogImage:"https://www.openthorn.app/assets/blog_2.jpg",tldr:"A BYOK (bring-your-own-key) AI website builder generates websites with AI while you connect your own API key from a provider like OpenAI or Anthropic. You pay the provider's raw per-token rates — typically cents to a few dollars per site — instead of a $20–50/month platform subscription with marked-up credits."},{slug:"introducing-openthorn",title:"Introducing OpenThorn — Build Full-Stack Apps from a Single Prompt",date:"2026-06-06",excerpt:"Most web apps still take weeks to build. We built OpenThorn to close that gap — describe your app in plain language and ship the same day.",coverYoutube:"9RJrDvaWHiE"}],c=Object.assign({"../content/blog/best-byok-ai-website-builders-2026.md":i,"../content/blog/how-much-does-it-cost-to-build-a-website-with-ai.md":a,"../content/blog/how-to-build-a-website-with-ai-byok.md":s,"../content/blog/how-to-get-an-ai-api-key.md":l,"../content/blog/introducing-openthorn.md":p,"../content/blog/lovable-vs-bolt-vs-v0-pricing.md":h,"../content/blog/what-is-a-byok-ai-website-builder.md":d}),o={};for(const[e,t]of Object.entries(c)){const n=e.split("/").pop().replace(/\.md$/,"");o[n]=t}const w=u.map(e=>({...e,content:o[e.slug]??""}));function b(e){return w.find(t=>t.slug===e)}function y(e){return{slug:e.slug,title:e.title,date:e.date,excerpt:e.excerpt??"",content:e.content??"",dateModified:e.date_modified??void 0,coverYoutube:e.cover_youtube??void 0,coverImage:e.cover_image??void 0,ogImage:e.og_image??void 0,tldr:e.tldr??void 0,howTo:e.how_to??void 0,itemList:e.item_list??void 0}}async function g(){const{data:e,error:t}=await r.from("blog_posts").select("slug,title,excerpt,content,date,date_modified,cover_youtube,cover_image,og_image,tldr,how_to,item_list").eq("status","published").order("date",{ascending:!1});return t||!e?null:e.map(y)}export{w as b,g as f,b as g};
