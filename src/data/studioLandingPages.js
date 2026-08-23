// Studio landing page data — single source of truth for /studios/[slug] pages.
// Content is also mirrored in docs/seo-studio-landing-pages.md.

export const STUDIO_LANDING_PAGES = {
  image: {
    slug: 'image',
    label: 'Image Studio',
    heroTitle: 'AI Image Generation Studio — Create Stunning Visuals with 200+ Models',
    heroDescription: 'Generate professional AI images at scale. Open-source image studio with Flux, SDXL, Ideogram, and 20+ models. The free Sendspark alternative for creators and teams.',
    thumbnail: '/thumbnails/studios/image.webp',
    miniMaxDemoIds: [7, 15, 18, 28],
    academyTracks: [
      { slug: '07-ai-product-photography', title: 'AI Product Photography' },
      { slug: '08-ai-fashion-and-virtual-tryon', title: 'AI Fashion & Virtual Try-On' },
      { slug: '09-ai-real-estate-staging', title: 'AI Real Estate Staging' },
      { slug: '10-ai-headshots-and-portraits', title: 'AI Headshots & Portraits' },
      { slug: '11-ai-print-on-demand-and-merch', title: 'AI Print on Demand & Merch' },
      { slug: '14-ai-freelancing-and-agency-business', title: 'AI Freelancing & Agency Business' },
    ],
    seo: {
      primaryKeyword: 'AI image generation studio',
      secondaryKeywords: ['AI image generator', 'open source AI image generation', 'Flux AI image studio'],
      longTailKeywords: [
        'free AI image generation studio for creators',
        'open source alternative to Sendspark image tools',
        'batch AI image generation with 200+ models',
      ],
    },
    valueProp: 'SmartVideo Image Studio delivers professional AI image generation with 20+ models, open-source flexibility, and enterprise-grade features — no locked subscriptions, no vendor lock-in.',
    howItWorks: [
      { title: 'Describe Your Vision', description: 'Enter a text prompt or upload a reference image to guide the AI generation.', gif: '/academy/07-ai-product-photography/gifs/perfume-motion.gif', video: '/academy/07-ai-product-photography/videos/perfume-motion.mp4' },
      { title: 'Choose Your Model', description: 'Select from 20+ AI image models including Flux, SDXL, and Ideogram for your style and quality needs.', gif: '/academy/07-ai-product-photography/gifs/batch-skincare-grid-clip.gif', video: '/academy/07-ai-product-photography/videos/batch-skincare-grid-clip.mp4' },
      { title: 'Generate & Export', description: 'Produce high-resolution images in seconds, then download or batch-export for campaigns.', gif: '/academy/07-ai-product-photography/gifs/product-agency-studio-clip.gif', video: '/academy/07-ai-product-photography/videos/product-agency-studio-clip.mp4' },
    ],
    features: [
      '20+ AI image models including Flux, SDXL, and Ideogram in one interface',
      'Text-to-image and image-to-image generation modes',
      'Batch generation for consistent campaign visuals',
      'Open-source architecture with full API access',
      '100% Sendspark parity with zero vendor lock-in',
    ],
    monetization: {
      revenueModels: [
        'Product Photography Packages — $150-$300 per batch for e-commerce catalogs; $500-$1,500 for full brand shoots',
        'Headshot Packages — $200-$500 per session for corporate teams; $50-$150 per individual',
        'Real Estate Staging — $25-$75 per render; $2,000-$5,500/month retainer for brokerages',
        'Print-on-Demand Designs — $10-$49 digital product sales; passive revenue from template packs',
      ],
      pricingAnchors: [
        'Traditional product photographer: $1,500-$5,000 per shoot day',
        'AI replacement: $150-$300 per batch with 24-hour turnaround',
        'Headshot retouching: $120/head traditionally → $0.04/image AI cost basis',
      ],
      gtmSteps: [
        'Lead with finished samples — create 3-5 polished product/portrait samples for actual products',
        'Cold outreach to DTC brands — pitch "24-hour turnaround, 10x cheaper than a shoot"',
        'Template marketplace — sell prompt packs and style presets ($19-$49) on Gumroad',
      ],
      profitMath: {
        apiCost: '$4.00 for 100 images',
        clientFee: '$500/batch',
        netMargin: '~99%',
      },
    },
  },
  video: {
    slug: 'video',
    label: 'Video Studio',
    heroTitle: 'AI Video Generation Studio — Create Personalized Videos at Scale',
    heroDescription: 'Generate AI videos with avatars, neural TTS, and lip-sync. Open-source video studio as a Sendspark alternative. 200+ models, 40+ languages, 10K+ contacts per batch.',
    thumbnail: '/thumbnails/studios/video.webp',
    miniMaxDemoIds: [1, 2, 3, 4, 5, 6, 16, 19, 20, 22, 23, 24, 25, 26, 27, 29, 30],
    academyTracks: [
      { slug: '01-ai-video-ads-ugc', title: 'AI Video Ads & UGC' },
      { slug: '03-faceless-ai-channels', title: 'Faceless AI Channels' },
      { slug: '04-ai-content-factories', title: 'AI Content Factories' },
      { slug: '14-ai-freelancing-and-agency-business', title: 'AI Freelancing & Agency Business' },
    ],
    seo: {
      primaryKeyword: 'AI video generation studio',
      secondaryKeywords: ['AI video generator', 'personalized video at scale', 'neural text-to-speech video'],
      longTailKeywords: [
        'open source AI video generation platform for business',
        'AI avatar video generator with lip-sync technology',
        'bulk personalized video creation for sales outreach',
      ],
    },
    valueProp: 'SmartVideo Video Studio combines AI avatars, neural text-to-speech, and perfect lip-sync to create personalized videos at scale — the complete open-source Sendspark alternative.',
    howItWorks: [
      { title: 'Import Contacts', description: 'Upload a CSV with names, companies, and custom fields for personalization tokens.', gif: '/academy/04-ai-content-factories/gifs/batch-suite-clip.gif', video: '/academy/04-ai-content-factories/videos/batch-suite-clip.mp4' },
      { title: 'Configure Content', description: 'Write your script with tokens like {{firstName}} or upload a base video template.', gif: '/academy/01-ai-video-ads-ugc/gifs/gripmount-hook-clip.gif', video: '/academy/01-ai-video-ads-ugc/videos/gripmount-hook-clip.mp4' },
      { title: 'Generate & Share', description: 'AI creates personalized videos for each contact; download or share via email and social.', gif: '/academy/01-ai-video-ads-ugc/gifs/gripmount-ad3-pov.gif', video: '/academy/01-ai-video-ads-ugc/videos/gripmount-ad3-pov.mp4' },
    ],
    features: [
      'AI avatar generation with lip-sync technology',
      'Neural text-to-speech in 40+ languages',
      'Script-to-video creation from plain text',
      'Overlay personalization on existing video templates',
      'Batch processing for 10K+ contacts per run',
    ],
    monetization: {
      revenueModels: [
        'UGC Ad Production — $10-$55 per ad on freelance marketplaces; $150-$300 per batch',
        'Faceless Channel Services — $1,500-$3,000/month retainers for batch production',
        'Personalized Video at Scale — $2,000-$7,500/month for sales outreach campaigns',
        'Content Factory Retainers — $3,000-$10,000/month for ongoing social content',
      ],
      pricingAnchors: [
        'UGC ad gig: $35 mid-range, $10 floor, $55 ceiling',
        'Project batch: $150-$300 for 8-12 variant ads',
        'Monthly retainer: $1,500-$3,000 for ongoing batches',
      ],
      gtmSteps: [
        'Gig-first strategy — build portfolio with 3-5 Fiverr/Upwork gigs',
        'Cold outreach with samples — send actual personalized video for prospect\'s product',
        'Retainer ladder — gig → project → $2K/mo retainer within 60-90 days',
      ],
      profitMath: {
        apiCost: '$8.40 for 12 videos',
        clientFee: '$2,000/month retainer',
        netMargin: '~99.6%',
      },
    },
  },
  storyboard: {
    slug: 'storyboard',
    label: 'Storyboard Studio',
    heroTitle: 'AI Storyboard Studio — Plan Cinematic Shots Before You Generate',
    heroDescription: 'Create professional video storyboards with AI-assisted shot planning. Open-source storyboard studio for filmmakers, marketers, and content creators.',
    thumbnail: '/thumbnails/studios/storyboard.webp',
    miniMaxDemoIds: [],
    academyTracks: [
      { slug: '02-ai-filmmaking', title: 'AI Filmmaking' },
    ],
    seo: {
      primaryKeyword: 'AI storyboard studio',
      secondaryKeywords: ['AI storyboard generator', 'video shot planning tool', 'cinematic storyboard creator'],
      longTailKeywords: [
        'AI-powered storyboard for short films and commercials',
        'open source storyboard studio for video production',
        'shot list and storyboard in one AI tool',
      ],
    },
    valueProp: 'SmartVideo Storyboard Studio transforms scripts into visual shot sequences with AI-assisted framing, camera movement, and pacing — built for filmmakers who want to reduce production waste.',
    howItWorks: [
      { title: 'Import Your Script', description: 'Paste a screenplay or shot list; AI parses scenes, actions, and dialogue beats.', gif: '/academy/02-ai-filmmaking/gifs/storyboard-anim-clip.gif', video: '/academy/02-ai-filmmaking/videos/storyboard-anim-clip.mp4' },
      { title: 'Generate Shot Frames', description: 'AI produces frame-level storyboards with aspect-ratio-accurate previews and camera-move suggestions.', gif: '/academy/02-ai-filmmaking/gifs/astronaut-clip.gif', video: '/academy/02-ai-filmmaking/videos/astronaut-clip.mp4' },
      { title: 'Refine & Export', description: 'Adjust framing, timing, and transitions, then export a production-ready storyboard package.', gif: '/academy/02-ai-filmmaking/gifs/astronaut-intro-clip.gif', video: '/academy/02-ai-filmmaking/videos/astronaut-intro-clip.mp4' },
    ],
    features: [
      'Script-to-storyboard automation with scene parsing',
      '16:9, 9:16, and custom aspect-ratio support',
      'Camera-movement prompts and cinematography suggestions',
      'Export to PDF, PNG, or editable project files',
      'Integration with Cinema Studio for seamless handoff',
    ],
    monetization: {
      revenueModels: [
        'Pre-Production Packages — $500-$2,000 per project for script-to-storyboard',
        'Cinema Add-On — bundled with Cinema Studio at $1,500-$5,000 per short film',
        'Template Sales — storyboard template packs ($29-$99) for filmmakers',
      ],
      pricingAnchors: [
        'Traditional storyboard artist: $1,000-$3,000 per project',
        'AI-assisted: $500-$1,500 with 80% time savings',
        'Template marketplace: $29-$99 per pack',
      ],
      gtmSteps: [
        'Filmmaker outreach — pitch to indie directors and commercial producers',
        'Template marketplace — sell prompt libraries and shot templates',
        'Cinema Studio bundle — storyboard + cinema generation as one offer',
      ],
      profitMath: {
        apiCost: '~$2.00 per storyboard project',
        clientFee: '$1,500',
        netMargin: '~99.9%',
      },
    },
  },
  edit: {
    slug: 'edit',
    label: 'Edit Studio',
    heroTitle: 'AI Video Editing Studio — Edit, Cut, and Polish Videos with AI',
    heroDescription: 'Edit videos with AI-assisted cutting, color grading, and audio cleanup. Open-source edit studio as a Sendspark alternative for creators and agencies.',
    thumbnail: '/thumbnails/studios/edit.webp',
    miniMaxDemoIds: [],
    academyTracks: [
      { slug: '14-ai-freelancing-and-agency-business', title: 'AI Freelancing & Agency Business' },
    ],
    seo: {
      primaryKeyword: 'AI video editing studio',
      secondaryKeywords: ['AI video editor', 'open source video editing tool', 'AI-assisted video post-production'],
      longTailKeywords: [
        'AI video editing studio with automatic color grading',
        'open source alternative to Sendspark video editor',
        'batch video editing and export for social media',
      ],
    },
    valueProp: 'SmartVideo Edit Studio delivers AI-assisted video editing with automatic cuts, color grading, noise reduction, and stabilization — all in an open-source platform built for speed.',
    howItWorks: [
      { title: 'Import Media', description: 'Drag in raw footage, AI-generated clips, or screen recordings from your SmartVideo library.', gif: '/academy/14-ai-freelancing-and-agency-business/gifs/client-dashboard-motion.gif', video: '/academy/14-ai-freelancing-and-agency-business/videos/client-dashboard-motion.mp4' },
      { title: 'AI-Assisted Edit', description: 'Let AI suggest cuts, remove silence, apply color grades, and sync audio automatically.', gif: '/academy/04-ai-content-factories/gifs/agency-pitch-clip.gif', video: '/academy/04-ai-content-factories/videos/agency-pitch-clip.mp4' },
      { title: 'Export & Share', description: 'Render final video in target resolution and format, then publish directly to social or download.', gif: '/academy/04-ai-content-factories/gifs/focus-loop-clip.gif', video: '/academy/04-ai-content-factories/videos/focus-loop-clip.mp4' },
    ],
    features: [
      'AI-assisted cut detection and silence removal',
      'Professional color grading and LUT support',
      'Noise reduction and video stabilization',
      'Multi-track timeline with drag-and-drop clips',
      'Direct export to MP4, WebM, and vertical social formats',
    ],
    monetization: {
      revenueModels: [
        'Post-Production Services — $500-$2,000 per video; $3,000-$10,000/month retainers',
        'Batch Editing — $150-$300 per video for social content packages',
        'Template/Automation Sales — editing preset packs ($19-$49)',
      ],
      pricingAnchors: [
        'Traditional editor: $1,500-$5,000 per project',
        'AI-assisted: $500-$1,500 with 10x faster turnaround',
        'Value-based: 25-40% of traditional cost',
      ],
      gtmSteps: [
        'Agency partnerships — white-label for video agencies at 30% discount',
        'Direct client outreach — pitch to DTC brands running paid social',
        'Template marketplace — sell LUT packs and edit presets',
      ],
      profitMath: {
        apiCost: '~$1.50/video',
        clientFee: '$1,000/video',
        netMargin: '~99.9%',
      },
    },
  },
  character: {
    slug: 'character',
    label: 'Character Studio',
    heroTitle: 'AI Character Studio — Design Consistent Characters for Video and Film',
    heroDescription: 'Create consistent AI characters with locked identity across shots. Open-source character studio for virtual influencers, avatars, and cinematic productions.',
    thumbnail: '/thumbnails/studios/character.webp',
    miniMaxDemoIds: [10, 20],
    academyTracks: [
      { slug: '05-ai-avatars-and-influencers', title: 'AI Avatars & Influencers' },
    ],
    seo: {
      primaryKeyword: 'AI character studio',
      secondaryKeywords: ['AI character generator', 'consistent AI character design', 'virtual avatar creation tool'],
      longTailKeywords: [
        'AI character studio with face identity locking',
        'open source tool for consistent virtual influencers',
        'generate AI characters for short films and ads',
      ],
    },
    valueProp: 'SmartVideo Character Studio locks facial identity, style, and voice across every shot so your AI characters feel real — not random from prompt to prompt.',
    howItWorks: [
      { title: 'Define Your Character', description: 'Upload reference images or write a detailed prompt to establish identity, style, and key features.', gif: '/academy/05-ai-avatars-and-influencers/gifs/avatar-studio-clip.gif', video: '/academy/05-ai-avatars-and-influencers/videos/avatar-studio-clip.mp4' },
      { title: 'Lock Consistency', description: 'AI builds a reusable character anchor that preserves face, outfit, and proportions across generations.', gif: '/academy/05-ai-avatars-and-influencers/gifs/emma-cafe-motion.gif', video: '/academy/05-ai-avatars-and-influencers/videos/emma-cafe-motion.mp4' },
      { title: 'Generate Across Scenes', description: 'Place your locked character in new shots, poses, and expressions while maintaining full consistency.', gif: '/academy/05-ai-avatars-and-influencers/gifs/avatar-agency-suite-clip.gif', video: '/academy/05-ai-avatars-and-influencers/videos/avatar-agency-suite-clip.mp4' },
    ],
    features: [
      'Identity-locked AI character generation',
      'Reusable character anchors for cross-scene consistency',
      'Face, outfit, and proportion preservation controls',
      'Integration with Video Studio and Cinema Studio',
      'Export character sheets and style guides',
    ],
    monetization: {
      revenueModels: [
        'Avatar Design Packages — $500-$2,000 per character with identity lock',
        'Virtual Influencer Management — $400-$800 per sponsored video batch',
        'Character Licensing — $1,000-$3,000/month for brand ambassador retainers',
        'Media Kit & Pitch Services — $200-$500 per media kit creation',
      ],
      pricingAnchors: [
        'Traditional 3D character artist: $3,000-$10,000 per character',
        'AI character design: $500-$1,500 with instant iteration',
        'Virtual influencer sponsorship: $400-$600 per integration pack',
      ],
      gtmSteps: [
        'Build a demo character — create 1-2 polished characters in niche markets (tech, gaming, beauty)',
        'Media kit first — create a professional media kit before pitching brands',
        'SaaS/tech affiliate bundle — pair with high-ticket software sponsorships',
      ],
      profitMath: {
        apiCost: '$2.40 for 3-video integration pack',
        clientFee: '$400',
        netMargin: '99.4%',
      },
    },
  },
  effects: {
    slug: 'effects',
    label: 'Vibe Motion',
    heroTitle: 'AI Effects Studio — Add VFX, Transitions, and Motion to Your Videos',
    heroDescription: 'Apply AI-powered visual effects, transitions, and motion graphics. Open-source VFX studio for creators who want cinematic quality without complex software.',
    thumbnail: '/thumbnails/studios/effects.webp',
    miniMaxDemoIds: [5, 11, 22],
    academyTracks: [
      { slug: '15-ai-agents-and-vibe-coding', title: 'AI Agents & Vibe Coding' },
    ],
    seo: {
      primaryKeyword: 'AI effects studio',
      secondaryKeywords: ['AI VFX generator', 'AI motion graphics studio', 'video transitions AI tool'],
      longTailKeywords: [
        'AI-powered VFX studio for short-form video',
        'open source effects studio with cinematic presets',
        'AI motion graphics and transitions for social content',
      ],
    },
    valueProp: 'SmartVideo Effects Studio adds cinematic VFX, seamless transitions, and motion graphics to your footage using AI — no compositing expertise or expensive plugins required.',
    howItWorks: [
      { title: 'Upload Base Footage', description: 'Import your video clip or image sequence as the foundation for effects work.', gif: '/academy/04-ai-content-factories/gifs/fitness-reel-clip.gif', video: '/academy/04-ai-content-factories/videos/fitness-reel-clip.mp4' },
      { title: 'Apply AI Effects', description: 'Choose from VFX presets, motion trails, particle systems, or style-transfer filters powered by AI.', gif: '/academy/04-ai-content-factories/gifs/thumbnail-motion-clip.gif', video: '/academy/04-ai-content-factories/videos/thumbnail-motion-clip.mp4' },
      { title: 'Fine-Tune & Export', description: 'Adjust intensity, timing, and blend modes, then render the finished clip at full resolution.', gif: '/academy/15-ai-agents-and-vibe-coding/gifs/vibe-coding-workspace-motion.gif', video: '/academy/15-ai-agents-and-vibe-coding/videos/vibe-coding-workspace-motion.mp4' },
    ],
    features: [
      'AI VFX presets for particles, trails, and style transfer',
      'Seamless transition generators for cuts and montages',
      'Motion-speed controls and time-remapping',
      'Real-time preview with GPU-accelerated rendering',
      'Integration with Edit Studio and Cinema Studio pipelines',
    ],
    monetization: {
      revenueModels: [
        'VFX Add-On Services — $300-$1,000 per video for effects enhancement',
        'Motion Graphics Packages — $500-$2,000 per project for social/brand content',
        'Template Sales — VFX preset packs ($29-$99) and motion templates',
        'Agency White-Label — $5,000-$15,000/month for unlimited effects',
      ],
      pricingAnchors: [
        'Traditional VFX: $5,000-$50,000 per minute',
        'AI VFX: $300-$1,000 per video with 90% cost reduction',
        'Template marketplace: $29-$99 per preset pack',
      ],
      gtmSteps: [
        'Showcase reel — create 10-15 VFX samples across categories',
        'Agency partnerships — white-label for video production agencies',
        'Template marketplace — sell motion presets and transition packs',
      ],
      profitMath: {
        apiCost: '~$3.00/video',
        clientFee: '$800/video',
        netMargin: '~99.6%',
      },
    },
  },
  cinema: {
    slug: 'cinema',
    label: 'Cinema Studio',
    heroTitle: 'AI Cinema Studio — Generate Cinematic Scenes and Short Films with AI',
    heroDescription: 'Create cinematic AI video scenes with professional camera movement and lighting. Open-source cinema studio for filmmakers, advertisers, and storytellers.',
    thumbnail: '/thumbnails/studios/cinema.webp',
    miniMaxDemoIds: [4, 8, 16, 24, 26],
    academyTracks: [
      { slug: '02-ai-filmmaking', title: 'AI Filmmaking' },
    ],
    seo: {
      primaryKeyword: 'AI cinema studio',
      secondaryKeywords: ['cinematic AI video generator', 'AI filmmaking tool', 'AI scene generation for video'],
      longTailKeywords: [
        'open source AI cinema studio for short films',
        'cinematic AI video with camera movement and lighting',
        'generate film scenes and trailers with AI video models',
      ],
    },
    valueProp: 'SmartVideo Cinema Studio produces cinematic AI video scenes with professional camera movement, lighting, and narrative pacing — empowering independent filmmakers to tell stories without a full crew.',
    howItWorks: [
      { title: 'Write or Import a Scene', description: 'Paste a screenplay beat, storyboard panel, or shot description as your generation prompt.', gif: '/academy/02-ai-filmmaking/gifs/astronaut-intro-clip.gif', video: '/academy/02-ai-filmmaking/videos/astronaut-intro-clip.mp4' },
      { title: 'Configure Cinematic Settings', description: 'Choose camera movement, lens style, lighting mood, and aspect ratio for a true film look.', gif: '/academy/02-ai-filmmaking/gifs/astronaut-clip.gif', video: '/academy/02-ai-filmmaking/videos/astronaut-clip.mp4' },
      { title: 'Generate & Assemble', description: 'Produce individual cinematic clips, then stitch them into a complete sequence inside the studio.', gif: '/academy/04-ai-content-factories/gifs/agency-pitch-clip.gif', video: '/academy/04-ai-content-factories/videos/agency-pitch-clip.mp4' },
    ],
    features: [
      'Cinematic camera-movement prompts (dolly, crane, tracking, handheld)',
      'Professional lighting and mood controls',
      'Aspect ratios for theatrical, streaming, and social delivery',
      'Seamless integration with Storyboard Studio for shot planning',
      'Export-ready sequences for post-production workflows',
    ],
    monetization: {
      revenueModels: [
        'Short Film Production — $5,000-$25,000 per short film; festival licensing',
        'Commercial Cinema Ads — $2,000-$10,000 per 15-30s cinematic ad',
        'Trailer/Promo Packages — $1,500-$5,000 per trailer',
        'Licensing & Distribution — royalty deals for film festivals and streaming',
      ],
      pricingAnchors: [
        'Traditional short film: $50,000-$200,000 production budget',
        'AI cinema: $5,000-$15,000 with comparable visual quality',
        'Commercial cinematic ad: $2,000-$8,000 per deliverable',
      ],
      gtmSteps: [
        'Festival strategy — produce 1-2 short films for festival submission with $0 marketing',
        'Brand partnerships — pitch cinematic ads to DTC brands wanting premium feel',
        'Licensing — license B-roll and sequences to stock platforms and other creators',
      ],
      profitMath: {
        apiCost: '~$15.00/short film scene',
        clientFee: '$8,000',
        netMargin: '~99.8%',
      },
    },
  },
  'cinema-template': {
    slug: 'cinema-template',
    label: 'Cinema Template Studio',
    heroTitle: 'Cinema Template Studio — Generate Cinematic Videos from Ready-Made Templates',
    heroDescription: 'Create cinematic videos fast with AI-powered templates. Open-source cinema template studio for ads, trailers, and social films. 200+ models included.',
    thumbnail: '/thumbnails/studios/cinema.webp',
    miniMaxDemoIds: [],
    academyTracks: [
      { slug: '02-ai-filmmaking', title: 'AI Filmmaking' },
      { slug: '04-ai-content-factories', title: 'AI Content Factories' },
    ],
    seo: {
      primaryKeyword: 'cinema template studio',
      secondaryKeywords: ['AI video template generator', 'cinematic video templates AI', 'ready-made AI film templates'],
      longTailKeywords: [
        'AI cinema template studio for commercial video ads',
        'open source cinematic templates with Sendspark parity',
        'generate trailer and promo videos from AI templates',
      ],
    },
    valueProp: 'SmartVideo Cinema Template Studio combines the structure of professional cinematic templates with the power of AI generation so teams can ship polished films in minutes, not days.',
    howItWorks: [
      { title: 'Choose a Template', description: 'Browse cinematic templates for ads, trailers, product films, and social content.', gif: '/academy/04-ai-content-factories/gifs/batch-suite-clip.gif', video: '/academy/04-ai-content-factories/videos/batch-suite-clip.mp4' },
      { title: 'Customize with AI', description: 'Swap prompts, assets, pacing, and branding while the template preserves structure and timing.', gif: '/academy/14-ai-freelancing-and-agency-business/gifs/agency-pricing-deck-motion.gif', video: '/academy/14-ai-freelancing-and-agency-business/videos/agency-pricing-deck-motion.mp4' },
      { title: 'Generate Final Video', description: 'Render a complete cinematic video with consistent style, transitions, and audio.', gif: '/academy/15-ai-agents-and-vibe-coding/gifs/micro-tool-app-motion.gif', video: '/academy/15-ai-agents-and-vibe-coding/videos/micro-tool-app-motion.mp4' },
    ],
    features: [
      'Curated cinematic templates for ads, trailers, and promos',
      'AI-driven prompt and asset replacement inside locked templates',
      'Consistent style, pacing, and color grade across all outputs',
      'Brand kit integration for logos, colors, and typefaces',
      'One-click export to MP4, WebM, and vertical formats',
    ],
    monetization: {
      revenueModels: [
        'Template Licensing — $49-$199 per cinematic template; $299-$999 for template packs',
        'White-Label Platform — $5,000-$20,000/month for agencies using templates at scale',
        'Done-For-You Campaigns — $3,000-$10,000 per campaign using templates',
        'Subscription Access — $29-$99/month for template library access',
      ],
      pricingAnchors: [
        'Traditional template: $500-$2,000 per custom template',
        'AI template: $49-$199 with infinite variations',
        'Template pack: $299-$999 for 20-50 templates',
      ],
      gtmSteps: [
        'Template marketplace launch — release 5-10 free/paid templates to build audience',
        'Agency partnerships — white-label for marketing agencies',
        'Course/Template bundle — sell "Cinematic Ads Masterclass" with template access',
      ],
      profitMath: {
        apiCost: '~$0.50/variation',
        clientFee: '$99/template',
        netMargin: '~99.5%',
      },
    },
  },
  influencer: {
    slug: 'influencer',
    label: 'AI Influencer',
    heroTitle: 'AI Influencer Studio — Create Consistent Virtual Influencers with AI',
    heroDescription: 'Build AI virtual influencers with locked faces, cloned voices, and consistent content. Open-source AI influencer studio for creators and brands.',
    thumbnail: '/thumbnails/studios/character.webp',
    miniMaxDemoIds: [7, 15, 18],
    academyTracks: [
      { slug: '05-ai-avatars-and-influencers', title: 'AI Avatars & Influencers' },
    ],
    seo: {
      primaryKeyword: 'AI influencer studio',
      secondaryKeywords: ['AI virtual influencer creator', 'AI avatar influencer tool', 'virtual influencer content generator'],
      longTailKeywords: [
        'open source AI influencer studio for brands and creators',
        'AI virtual influencer with consistent face and voice',
        'generate influencer content at scale with AI avatars',
      ],
    },
    valueProp: 'SmartVideo AI Influencer Studio builds consistent virtual influencers with locked identity, cloned voice, and platform-ready content pipelines — giving creators and brands a scalable content engine.',
    howItWorks: [
      { title: 'Design Your Influencer', description: 'Define appearance, voice, and personality; AI locks identity across all future content.', gif: '/academy/05-ai-avatars-and-influencers/gifs/avatar-sponsor-clip.gif', video: '/academy/05-ai-avatars-and-influencers/videos/avatar-sponsor-clip.mp4' },
      { title: 'Clone Voice & Dialect', description: 'Upload voice samples or choose a neural voice; AI trains a consistent vocal identity.', gif: '/academy/05-ai-avatars-and-influencers/gifs/emma-clip.gif', video: '/academy/05-ai-avatars-and-influencers/videos/emma-clip.mp4' },
      { title: 'Generate Content', description: 'Produce talking-head videos, reaction clips, and social posts at scale while keeping character identity intact.', gif: '/academy/06-ai-audio-and-music/gifs/voice-studio-clip.gif', video: '/academy/06-ai-audio-and-music/videos/voice-studio-clip.mp4' },
    ],
    features: [
      'Identity-locked AI avatar and virtual influencer generation',
      'Voice cloning with neural text-to-speech and lip-sync',
      'Batch content generation for social media pipelines',
      'Style and brand consistency across every post and video',
      'Full integration with Video Studio, Character Studio, and Audio Studio',
    ],
    monetization: {
      revenueModels: [
        'Virtual Influencer Sponsorships — $400-$3,000 per sponsored post/batch',
        'Brand Ambassador Retainers — $1,000-$3,000/month ongoing',
        'Influencer Management Services — 20% commission on deals closed',
        'Merch & Digital Products — $19-$49 digital products; $10K-$50K brand deals',
      ],
      pricingAnchors: [
        'Micro-influencer (5K-25K): $300-$800 per dedicated video',
        'Brand ambassador (25K+): $1,000-$3,000/month retainer',
        'Virtual influencer advantage: zero PR risk, instant revisions, 99% profit margin',
      ],
      gtmSteps: [
        'Build 1 demo avatar — create consistent character in profitable niche (tech, finance, SaaS)',
        'Media kit outreach — pitch to 50+ SaaS brands with media kit and sample clips',
        'Over-deliver for renewals — send proactive performance reports after campaigns',
      ],
       profitMath: {
         apiCost: '$2.40 for 3-video integration pack',
         clientFee: '$400',
         netMargin: '99.4%',
       },
     },
   },
  viral: {
    slug: 'viral',
    label: 'Smart Video Viral',
    heroTitle: 'Smart Video Viral — Viral AI Prompt Feed from X',
    heroDescription: 'A continuously refreshed feed of the best AI image and video prompts trending on X, with source attribution, preview media, and machine-readable datasets. Discover what\'s trending, copy prompts into any studio, and stay ahead of the curve.',
    thumbnail: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22640%22%20height%3D%22360%22%20viewBox%3D%220%200%20640%20360%22%3E%3Crect%20width%3D%22640%22%20height%3D%22360%22%20fill%3D%22%230a0a0a%22%2F%3E%3Cg%20stroke%3D%22%2327272a%22%20stroke-width%3D%221%22%3E%3Crect%20x%3D%2240%22%20y%3D%2240%22%20width%3D%2290%22%20height%3D%2260%22%20fill%3D%22%23141414%22%20rx%3D%224%22%2F%3E%3Crect%20x%3D%22140%22%20y%3D%2240%22%20width%3D%2290%22%20height%3D%2260%22%20fill%3D%22%23141414%22%20rx%3D%224%22%2F%3E%3Crect%20x%3D%22240%22%20y%3D%2240%22%20width%3D%2290%22%20height%3D%2260%22%20fill%3D%22%23141414%22%20rx%3D%224%22%2F%3E%3Crect%20x%3D%2240%22%20y%3D%22110%22%20width%3D%2290%22%20height%3D%2260%22%20fill%3D%22%23141414%22%20rx%3D%224%22%2F%3E%3Crect%20x%3D%22140%22%20y%3D%22110%22%20width%3D%2290%22%20height%3D%2260%22%20fill%3D%22%23141414%22%20rx%3D%224%22%2F%3E%3Crect%20x%3D%22240%22%20y%3D%22110%22%20width%3D%2290%22%20height%3D%2260%22%20fill%3D%22%23141414%22%20rx%3D%224%22%2F%3E%3Crect%20x%3D%2240%22%20y%3D%22180%22%20width%3D%2290%22%20height%3D%2260%22%20fill%3D%22%23141414%22%20rx%3D%224%22%2F%3E%3Crect%20x%3D%22140%22%20y%3D%22180%22%20width%3D%2290%22%20height%3D%2260%22%20fill%3D%22%23141414%22%20rx%3D%224%22%2F%3E%3Crect%20x%3D%22240%22%20y%3D%22180%22%20width%3D%2290%22%20height%3D%2260%22%20fill%3D%22%23141414%22%20rx%3D%224%22%2F%3E%3C%2Fg%3E%3Cpath%20d%3D%22M370%2050%20L410%2030%20L450%2050%20L450%20100%20L410%20120%20L370%20100%20Z%22%20fill%3D%22%23d9ff00%22%20opacity%3D%220.9%22%2F%3E%3Ctext%20x%3D%22410%22%20y%3D%22105%22%20text-anchor%3D%22middle%22%20fill%3D%22%230a0a0a%22%20font-size%3D%2212%22%20font-family%3D%22system-ui%22%20font-weight%3D%22700%22%3ETRENDING%3C%2Ftext%3E%3Ccircle%20cx%3D%22390%22%20cy%3D%22200%22%20r%3D%2218%22%20fill%3D%22none%22%20stroke%3D%22%23d9ff00%22%20stroke-width%3D%222%22%2F%3E%3Cpolygon%20points%3D%22385%2C195%20385%2C205%20395%2C200%22%20fill%3D%22%23d9ff00%22%2F%3E%3Ccircle%20cx%3D%22430%22%20cy%3D%22240%22%20r%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%23d9ff00%22%20stroke-width%3D%221.5%22%2F%3E%3Cpolygon%20points%3D%22427%2C237%20427%2C243%20433%2C240%22%20fill%3D%22%23d9ff00%22%2F%3E%3Cg%20transform%3D%22translate(475%2C262)%22%3E%3Cpath%20d%3D%22M4%207%20L12%2015%20L20%207%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%20fill%3D%22none%22%2F%3E%3Cpath%20d%3D%22M12%2015%20L12%2028%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222%22%2F%3E%3C%2Fg%3E%3Ctext%20x%3D%22505%22%20y%3D%22275%22%20fill%3D%22%23fff%22%20font-size%3D%2212%22%20font-family%3D%22system-ui%22%20font-weight%3D%22700%22%3Ex.com%3C%2Ftext%3E%3Ctext%20x%3D%22320%22%20y%3D%22330%22%20text-anchor%3D%22middle%22%20fill%3D%22%23d9ff00%22%20font-size%3D%2216%22%20font-family%3D%22system-ui%22%20font-weight%3D%22700%22%3ESmart%20Video%20Viral%3C%2Ftext%3E%3C%2Fsvg%3E',
    miniMaxDemoIds: [],
    academyTracks: [
      { slug: '12-ai-stock-content-and-licensing', title: 'AI Stock Content & Licensing' },
    ],
    seo: {
      primaryKeyword: 'AI prompt feed',
      secondaryKeywords: ['viral AI prompts', 'AI video prompts', 'AI image prompts', 'prompt inspiration'],
      longTailKeywords: [
        'viral AI prompts from Twitter X',
        'AI image and video prompt feed with source links',
        'trending AI prompt library with attribution',
      ],
    },
    valueProp: 'Smart Video Viral curates the hottest AI prompts from across X, verified and structured with full source attribution. Every prompt is production-ready — just copy into any studio and generate.',
    howItWorks: [
      { title: 'Browse the Feed', description: 'Scroll a continuously refreshed grid of trending AI image and video prompts, each with preview media, model recommendations, and source links.', gif: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22320%22%20height%3D%22140%22%20viewBox%3D%220%200%20320%20140%22%3E%3Crect%20width%3D%22320%22%20height%3D%22140%22%20fill%3D%22%230a0a0a%22%2F%3E%3Cg%20stroke%3D%22%2327272a%22%20stroke-width%3D%221%22%3E%3Crect%20x%3D%2230%22%20y%3D%2225%22%20width%3D%2270%22%20height%3D%2245%22%20fill%3D%22%231a1a1a%22%20rx%3D%223%22%2F%3E%3Crect%20x%3D%22110%22%20y%3D%2225%22%20width%3D%2270%22%20height%3D%2245%22%20fill%3D%22%231a1a1a%22%20rx%3D%223%22%2F%3E%3Crect%20x%3D%22190%22%20y%3D%2225%22%20width%3D%2270%22%20height%3D%2245%22%20fill%3D%22%231a1a1a%22%20rx%3D%223%22%2F%3E%3Crect%20x%3D%2230%22%20y%3D%2280%22%20width%3D%22260%22%20height%3D%2212%22%20fill%3D%22%2327272a%22%20rx%3D%222%22%2F%3E%3Crect%20x%3D%2230%22%20y%3D%22100%22%20width%3D%22180%22%20height%3D%2210%22%20fill%3D%22%2327272a%22%20rx%3D%222%22%2F%3E%3Crect%20x%3D%2230%22%20y%3D%22120%22%20width%3D%22120%22%20height%3D%228%22%20fill%3D%22%2327272a%22%20rx%3D%222%22%2F%3E%3C%2Fg%3E%3Ccircle%20cx%3D%22280%22%20cy%3D%2257%22%20r%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%23d9ff00%22%20stroke-width%3D%222%22%2F%3E%3Cpolygon%20points%3D%22276%2C52%20276%2C62%20284%2C57%22%20fill%3D%22%23d9ff00%22%2F%3E%3Ctext%20x%3D%22160%22%20y%3D%22130%22%20text-anchor%3D%22middle%22%20fill%3D%22%23fff%22%20font-size%3D%2211%22%20font-family%3D%22system-ui%22%20font-weight%3D%22700%22%3EBrowse%20the%20Feed%3C%2Ftext%3E%3C%2Fsvg%3E', video: '' },
      { title: 'Filter & Search', description: 'Narrow by media type (image vs video), category (cinematic, character, product ads, etc.), or search by tags and prompt text.', gif: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22320%22%20height%3D%22140%22%20viewBox%3D%220%200%20320%20140%22%3E%3Crect%20width%3D%22320%22%20height%3D%22140%22%20fill%3D%22%230a0a0a%22%2F%3E%3Cg%20stroke%3D%22%2327272a%22%20stroke-width%3D%221%22%3E%3Crect%20x%3D%2280%22%20y%3D%2230%22%20width%3D%2270%22%20height%3D%2245%22%20fill%3D%22%231a1a1a%22%20rx%3D%223%22%2F%3E%3Crect%20x%3D%22170%22%20y%3D%2230%22%20width%3D%2270%22%20height%3D%2245%22%20fill%3D%22%231a1a1a%22%20rx%3D%223%22%2F%3E%3C%2Fg%3E%3Ccircle%20cx%3D%22130%22%20cy%3D%2285%22%20r%3D%2222%22%20fill%3D%22none%22%20stroke%3D%22%23d9ff00%22%20stroke-width%3D%222%22%2F%3E%3Ccircle%20cx%3D%22130%22%20cy%3D%2285%22%20r%3D%2214%22%20fill%3D%22none%22%20stroke%3D%22%23d9ff00%22%20stroke-width%3D%221.5%22%2F%3E%3Cpath%20d%3D%22M110%2085%20L130%20105%20L150%2065%22%20stroke%3D%22%23d9ff00%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3Ctext%20x%3D%22160%22%20y%3D%22130%22%20text-anchor%3D%22middle%22%20fill%3D%22%23fff%22%20font-size%3D%2211%22%20font-family%3D%22system-ui%22%20font-weight%3D%22700%22%3EFilter%20%26amp%3B%20Search%3C%2Ftext%3E%3C%2Fsvg%3E', video: '' },
      { title: 'Copy & Create', description: 'Click any prompt to copy it into your clipboard, then paste directly into Image Studio, Video Studio, or any other studio to generate.', gif: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22320%22%20height%3D%22140%22%20viewBox%3D%220%200%20320%20140%22%3E%3Crect%20width%3D%22320%22%20height%3D%22140%22%20fill%3D%22%230a0a0a%22%2F%3E%3Cg%20stroke%3D%22%2327272a%22%20stroke-width%3D%221%22%3E%3Crect%20x%3D%2290%22%20y%3D%2230%22%20width%3D%2270%22%20height%3D%2245%22%20fill%3D%22%231a1a1a%22%20rx%3D%223%22%2F%3E%3Crect%20x%3D%22180%22%20y%3D%2230%22%20width%3D%2250%22%20height%3D%2245%22%20fill%3D%22%231a1a1a%22%20rx%3D%223%22%2F%3E%3C%2Fg%3E%3Crect%20x%3D%22100%22%20y%3D%2290%22%20width%3D%2290%22%20height%3D%2230%22%20fill%3D%22%23d9ff00%22%20rx%3D%223%22%2F%3E%3Ctext%20x%3D%22145%22%20y%3D%22110%22%20text-anchor%3D%22middle%22%20fill%3D%22%230a0a0a%22%20font-size%3D%2211%22%20font-family%3D%22system-ui%22%20font-weight%3D%22700%22%3EC%3C%2Ftext%3E%3Cpath%20d%3D%22M200%2090%20L250%2090%20L250%20120%20L200%20120%20Z%22%20fill%3D%22none%22%20stroke%3D%22%23d9ff00%22%20stroke-width%3D%221.5%22%2F%3E%3Cpath%20d%3D%22M225%2095%20L225%20115%20M210%20105%20L240%20105%22%20stroke%3D%22%23d9ff00%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2F%3E%3Ctext%20x%3D%22160%22%20y%3D%22130%22%20text-anchor%3D%22middle%22%20fill%3D%22%23fff%22%20font-size%3D%2211%22%20font-family%3D%22system-ui%22%20font-weight%3D%22700%22%3ECopy%20%26amp%3B%20Create%3C%2Ftext%3E%3C%2Fsvg%3E', video: '' },
    ],
    features: [
      'Continuously refreshed feed of trending AI prompts from X',
      'Full source attribution — author handle, post URL, and engagement metrics',
      'Preview media for every prompt (images and videos)',
      'Filter by media type, category, and recommended model',
      'One-click copy prompts into any studio',
      'Machine-readable dataset export (JSON, JSONL, CSV)',
    ],
    monetization: {
      revenueModels: [
        'Prompt Curator Subscriptions — $10-$30/month for ad-free feed access and advanced filtering',
        'Dataset Licensing — $500-$2,500/month for structured prompt datasets (enterprise research, model training)',
        'Creator Affiliate Program — 15% revenue share on API credit referrals from prompt creators',
      ],
      pricingAnchors: [
        'Prompt engineering consultants: $100-$500/hour',
        'AI stock prompt libraries: $19-$99/month',
        'Structured datasets: $500-$2,500/month for commercial use',
      ],
      gtmSteps: [
        'Seed the feed — publish 50-100 high-quality prompts to establish authority',
        'Creator outreach — invite prolific X prompt authors to join the affiliate program',
        'Dataset upsell — offer CSV/JSON exports for researchers and prompt engineers',
      ],
      profitMath: {
        apiCost: 'Free (open data from public X posts)',
        clientFee: '$29/month Pro subscription',
        netMargin: '~99%',
      },
    },
  },
};
