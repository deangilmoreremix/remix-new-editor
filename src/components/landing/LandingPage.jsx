// AI Video Agency Studio Landing Page
// Optimized with lazy loading for sections

import { openMonetizationHub } from '../../lib/monetizationIntegration.js';

const ALL_APPS = [
  { id: 'image', title: 'Image', description: 'Generate high-quality AI images for ads, thumbnails, product visuals, social media, websites, and client campaigns.', link: '/image' },
  { id: 'video', title: 'Video', description: 'Create text-to-video, image-to-video, video-to-video, and cinematic motion content for social, ads, and branded campaigns.', link: '/video' },
  { id: 'cinema', title: 'Cinema Studio', description: 'Direct AI-generated scenes using cinematic camera language, lenses, moods, lighting, motion, shot types, and visual styles.', link: '/cinema' },
  { id: 'character', title: 'Character', description: 'Create consistent AI characters, branded personas, story characters, spokespersons, creators, and campaign personalities.', link: '/character' },
  { id: 'ai-vfx', title: 'AI-VFX', description: 'Generate advanced AI visual effects such as explosions, lightning, fire, energy effects, disintegration, destruction, and cinematic transformations.', link: '/ai-vfx' },
  { id: 'influencer', title: 'Influencer', description: 'Create AI influencer visuals, social content concepts, creator-style campaigns, fashion shots, lifestyle scenes, and branded posts.', link: '/influencer' },
  { id: 'storyboard', title: 'Storyboard', description: 'Plan campaigns, commercials, short films, social videos, and client projects using AI-assisted scene and shot planning.', link: '/storyboard' },
  { id: 'effects', title: 'Effects', description: 'Apply creative effects, transformations, motion styles, cinematic treatments, and stylized visual looks.', link: '/effects' },
  { id: 'vfx', title: 'VFX', description: 'Create high-impact visual effects for trailers, ads, social videos, fantasy scenes, action sequences, and cinematic content.', link: '/vfx' },
  { id: 'edit', title: 'Edit', description: 'Edit, revise, enhance, repurpose, and improve visual assets so users can move from raw AI output to polished delivery.', link: '/edit' },
  { id: 'upscale', title: 'Upscale', description: 'Improve image and video quality with AI upscaling for sharper, cleaner, more professional-looking assets.', link: '/upscale' },
  { id: 'audio', title: 'Audio', description: 'Generate, enhance, transform, or prepare audio assets for videos, voiceovers, ads, explainers, and AI content.', link: '/audio' },
  { id: 'avatar', title: 'Avatar', description: 'Create AI avatar-based content, virtual presenters, branded spokespersons, personality-driven videos, and talking visuals.', link: '/avatar' },
  { id: 'training', title: 'Training', description: 'Teach users how to use the platform, create sellable assets, package services, and build an AI video agency.', link: '/training' },
  { id: 'videotools', title: 'Video Tools', description: 'Access utility tools for enhancing, converting, modifying, preparing, and improving video assets.', link: '/videotools' },
  { id: 'render', title: 'Render', description: 'Preview, organize, export, and prepare final outputs for download, editing, delivery, or client presentation.', link: '/render' },
  { id: 'director', title: 'Director', description: 'Turn prompts, concepts, scripts, and creative ideas into directed cinematic scenes and structured video plans.', link: '/director' },
  { id: 'timeline', title: 'Timeline', description: 'Arrange scenes, assets, clips, shots, captions, audio, and creative elements inside a structured video timeline.', link: '/timeline' },
  { id: 'runway-motion', title: 'Motion', description: 'Generate camera movement, scene motion, product motion, character motion, and cinematic animation effects.', link: '/runway-motion' },
  { id: 'tiktok-carousel', title: 'TikTok', description: 'Create TikTok-style videos, hooks, short-form content, viral concepts, creator clips, and social-ready vertical assets.', link: '/tiktok-carousel' },
  { id: 'advanced-dubbing', title: 'Dubbing', description: 'Translate, localize, and dub video content for different languages, audiences, campaigns, and global delivery.', link: '/advanced-dubbing' },
  { id: 'chat', title: 'Chat', description: 'Chat with AI to brainstorm creative ideas, refine prompts, plan campaigns, and get instant help with any creative task.', link: '/chat' },
  { id: 'commercial', title: 'Commercial', description: 'Create product commercials, brand ads, local business promos, ecommerce videos, launch videos, and agency-ready ad concepts.', link: '/commercial' },
  { id: 'templates', title: 'Templates', description: 'Start faster with prebuilt creative templates for ads, thumbnails, products, social posts, cinematic shots, VFX, and more.', link: '/templates' },
  { id: 'explore', title: 'Explore', description: 'Browse creative ideas, examples, presets, templates, use cases, visual styles, and production inspiration.', link: '/explore' },
  { id: 'library', title: 'Library', description: 'Store, organize, reuse, and manage generated assets, projects, videos, images, templates, and campaign materials.', link: '/library' },
  { id: 'community', title: 'Community', description: 'Showcase examples, discover creative workflows, highlight user creations, and build a community around AI video creation.', link: '/community' },
  { id: 'assist', title: 'Assist', description: 'Use guided AI help for prompts, workflows, studio selection, creative improvement, and project completion.', link: '/assist' },
  { id: 'lip-sync', title: 'Lip Sync', description: 'Generate accurate lip sync for any video, character, or avatar in any language for natural-looking dubbed content.', link: '/lipsync' },
  { id: 'agents', title: 'Agents', description: 'Use specialized AI agents for creative direction, editing, storyboarding, video creation, pitch improvement, and production planning.', link: '/agents' },
];

let globalStylesAdded = false;

// MiniMax H3 cinematic showcase.
//
// Set to false to fall back to the original hero-first ordering. Nothing is
// removed either way — the existing HeroSection and all 13 original sections
// always render; the cinematic hero is added above them.
const ENABLE_CINEMATIC_HERO = true;

/**
 * Keeps the document to a single <h1> and a single banner landmark once the
 * cinematic hero is added above the original hero.
 *
 * The original hero keeps 100% of its markup, classes, ids, copy and behaviour
 * (including the typewriter spans) — only the wrapper tag is swapped h1 -> h2
 * and the duplicate role="banner" is dropped, both of which are pure
 * accessibility fixes for having two heroes on one page.
 */
function demoteLegacyHero(heroEl) {
  heroEl.removeAttribute('role');
  heroEl.setAttribute('aria-labelledby', 'hero-headline');

  const legacyHeadline = heroEl.querySelector('h1#hero-headline');
  if (!legacyHeadline) return;

  const replacement = document.createElement('h2');
  for (const attribute of Array.from(legacyHeadline.attributes)) {
    replacement.setAttribute(attribute.name, attribute.value);
  }
  while (legacyHeadline.firstChild) {
    replacement.appendChild(legacyHeadline.firstChild);
  }
  legacyHeadline.replaceWith(replacement);
}


function addGlobalStyles() {
  if (globalStylesAdded) return;
  globalStylesAdded = true;

  const style = document.createElement('style');
  style.textContent = `
    .animate-in {
      opacity: 0;
      transform: translateY(40px);
      transition: opacity 0.8s ease, transform 0.8s ease;
    }
    .animate-in.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .animate-in.stagger-1 { transition-delay: 0.1s; }
    .animate-in.stagger-2 { transition-delay: 0.2s; }
    .animate-in.stagger-3 { transition-delay: 0.3s; }
    .animate-in.stagger-4 { transition-delay: 0.4s; }
    .animate-in.stagger-5 { transition-delay: 0.5s; }
    .animate-in.stagger-6 { transition-delay: 0.6s; }
    .animate-in.stagger-7 { transition-delay: 0.7s; }
    .animate-in.stagger-8 { transition-delay: 0.8s; }
    .animate-in.stagger-9 { transition-delay: 0.9s; }
    .animate-in.stagger-10 { transition-delay: 1.0s; }
    .btn-enhanced {
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    .btn-enhanced::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 60%);
      transform: scale(0);
      transition: transform 0.5s ease;
    }
    .btn-enhanced:hover::after {
      transform: scale(1);
    }
    html {
      scroll-behavior: smooth;
    }
  `;
  document.head.appendChild(style);
}

function createLazySection(importFn, sectionId, props = {}, index = 0) {
  const placeholder = document.createElement('div');
  placeholder.id = 'section-' + sectionId;
  placeholder.className = 'min-h-[200px] flex items-center justify-center';
  placeholder.innerHTML = '<div class="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full"></div>';

  const observer = new IntersectionObserver((entries) => {
    console.log('[LandingPage] IntersectionObserver fired for', sectionId, entries.map(e => ({ isIntersecting: e.isIntersecting, target: e.target.id })));
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        console.log('[LandingPage] Loading section:', sectionId);
        observer.unobserve(placeholder);
        importFn().then((module) => {
          let section;
          try {
            if (module.default) {
              section = props.apps ? module.default({ apps: props.apps }) : module.default(props);
            } else if (module.AppsGridSection) {
              section = module.AppsGridSection({ apps: ALL_APPS });
            } else {
              const fnName = Object.keys(module).find((k) => k.includes('Section') || k.includes('Page'));
              section = fnName ? module[fnName](props) : module[Object.keys(module)[0]](props);
            }
            section.classList.add('animate-in');
            const staggerIndex = Math.min(index, 10);
            if (staggerIndex > 0) section.classList.add('stagger-' + staggerIndex);
            section.querySelectorAll('button').forEach((btn) => btn.classList.add('btn-enhanced'));
            placeholder.replaceWith(section);
            requestAnimationFrame(() => section.classList.add('visible'));
            console.log('[LandingPage] Section loaded:', sectionId);
          } catch (err) {
            console.error('Failed to render section ' + sectionId, err);
            placeholder.innerHTML = '<div class="text-red-400">Failed to render section</div>';
          }
        }).catch((err) => {
          console.error('Failed to load section ' + sectionId, err);
          placeholder.innerHTML = '<div class="text-red-400">Failed to load section</div>';
        });
      }
    });
  }, { rootMargin: '20000px' });
  observer.observe(placeholder);
  console.log('[LandingPage] Observer created for:', sectionId, 'placeholder id:', placeholder.id);
  return placeholder;
}

export default async function LandingPage() {
  addGlobalStyles();

  const container = document.createElement('div');
  container.className = 'landing-page min-h-screen bg-[#020205]';
  container.setAttribute('lang', document.documentElement.lang || 'en');
  container.setAttribute('dir', document.documentElement.dir || 'ltr');

  let LandingHeader = null;
  let CinematicVideoHero = null;
  let HeroSection = null;

  try {
    try {
      const mod = await import('./common/Header.jsx');
      LandingHeader = mod.LandingHeader;
      console.log('[LandingPage] Header.jsx loaded');
    } catch (e) {
      console.error('[LandingPage] Header.jsx failed:', e);
      LandingHeader = null;
    }
    if (LandingHeader) {
      const headerEl = LandingHeader();
      container.appendChild(headerEl);
    }

    // NEW: cinematic MiniMax H3 video hero, added above the original hero.
    if (ENABLE_CINEMATIC_HERO) {
      try {
        const mod = await import('./sections/CinematicVideoHero.jsx');
        CinematicVideoHero = mod.CinematicVideoHero;
        console.log('[LandingPage] CinematicVideoHero.jsx loaded');
      } catch (e) {
        console.error('[LandingPage] CinematicVideoHero.jsx failed:', e);
        CinematicVideoHero = null;
      }
    }
    if (CinematicVideoHero) {
      const cinematicHeroEl = CinematicVideoHero();
      container.appendChild(cinematicHeroEl);
    }

    try {
      const mod = await import('./sections/HeroSection.jsx');
      HeroSection = mod.HeroSection;
      console.log('[LandingPage] HeroSection.jsx loaded');
    } catch (e) {
      console.error('[LandingPage] HeroSection.jsx failed:', e);
      HeroSection = null;
    }
    if (HeroSection) {
      const heroEl = HeroSection();
      if (ENABLE_CINEMATIC_HERO) demoteLegacyHero(heroEl);
      heroEl.classList.add('animate-in');
      heroEl.classList.add('stagger-0');
      container.appendChild(heroEl);
      requestAnimationFrame(() => heroEl.classList.add('visible'));
    }

    const monetizeLauncher = document.createElement('div');
    monetizeLauncher.className = 'monetize-launcher animate-in stagger-1';
    monetizeLauncher.innerHTML = `
      <div class="fixed bottom-6 right-6 z-30">
        <button id="open-monetization-hub" class="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl shadow-lg hover:from-purple-400 hover:to-pink-400 transition-all duration-300">
          <span>💼</span>
          <span>Smart Video AI Monetize</span>
        </button>
      </div>
    `;
    monetizeLauncher.querySelector('#open-monetization-hub').addEventListener('click', () => {
      openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
    });
    container.appendChild(monetizeLauncher);

    const scrollingStrip = createLazySection(() => import('./sections/ScrollingAppStrip.jsx'), 'scrolling', {}, 0);
    const hookSection = createLazySection(() => import('./sections/HookSection.jsx'), 'hook', {}, 1);
    const sixEngines = createLazySection(() => import('./sections/SixEnginesSection.jsx'), 'engines', {}, 2);
    const appsGrid = createLazySection(() => import('./sections/AppsGridSection.jsx'), 'apps', { apps: ALL_APPS }, 3);
    const features = createLazySection(() => import('./sections/FeaturesSection.jsx'), 'features', {}, 5);
    const problem = createLazySection(() => import('./sections/ProblemSection.jsx'), 'problem', {}, 6);
    const workflow = createLazySection(() => import('./sections/WorkflowSection.jsx'), 'workflow', {}, 7);
    const comparison = createLazySection(() => import('./sections/ComparisonSection.jsx'), 'comparison', {}, 8);
    const valueStack = createLazySection(() => import('./sections/ValueStackSection.jsx'), 'value', {}, 9);
    const agency = createLazySection(() => import('./sections/AgencySection.jsx'), 'agency', {}, 10);
    const offer = createLazySection(() => import('./sections/OfferSection.jsx'), 'offer', {}, 11);
    const finalCTA = createLazySection(() => import('./sections/FinalCTASection.jsx'), 'cta', {}, 12);

    // NEW: MiniMax H3 showcase sections, lazy-loaded with the same observer
    // pattern as every other section on this page.
    const aiWorkflow = createLazySection(() => import('./sections/MinimaxWorkflowSection.jsx'), 'ai-workflow', {}, 2);
    const madeWith = createLazySection(() => import('./sections/MadeWithSmartVideo.jsx'), 'made-with', {}, 4);
    const ugcShowcase = createLazySection(() => import('./sections/UGCDemoShowcase.jsx'), 'ugc', {}, 5);
    const videoGallery = createLazySection(() => import('./sections/AIVideoGallery.jsx'), 'gallery', {}, 6);
    const academyShowcase = createLazySection(() => import('./sections/AcademyVideoShowcase.jsx'), 'academy', {}, 7);

    // 12 repo showcase sections — one per source × category combination.
    // Each is independently lazy-loaded, following the same pattern as
    // UGCDemoShowcase, MadeWithSmartVideo, and AIVideoGallery.
    const repoShowcaseSections = [
      { key: 'repo-cinema',       section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.MmxCinemaSection })),          stagger: 9 },
      { key: 'repo-commercial',   section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.MmxCommercialSection })),    stagger: 10 },
      { key: 'repo-social-ads',   section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.SdSocialSection })),         stagger: 11 },
      { key: 'repo-narrative',    section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.SdCinemaSection })),        stagger: 12 },
      { key: 'repo-vertical',     section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.MmxSocialSection })),         stagger: 9 },
      { key: 'repo-ecommerce',    section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.SdCommercialSection })),      stagger: 10 },
      { key: 'repo-kinetic',      section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.SdActionSection })),         stagger: 11 },
      { key: 'repo-animated',     section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.SdAnimationSection })),       stagger: 12 },
      { key: 'repo-animation',    section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.MmxAnimationSection })),      stagger: 9 },
      { key: 'repo-reference',    section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.ZlCinemaSection })),          stagger: 10 },
      { key: 'repo-vfx',          section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.MmxActionVfxSection })),      stagger: 11 },
      { key: 'repo-fashion',      section: () => import('./sections/ShowcaseRepoVideo.jsx').then(m => ({ default: m.MmxFashionSection })),       stagger: 12 },
    ];
    const lazyRepoSections = repoShowcaseSections.map((cfg) =>
      createLazySection(cfg.section, cfg.key, {}, cfg.stagger)
    );

    const repoShowcase = createLazySection(() => import('./sections/RepoShowcase.jsx'), 'repos', {}, 13);

    container.appendChild(scrollingStrip);
    container.appendChild(hookSection);
    container.appendChild(aiWorkflow);      // NEW
    container.appendChild(sixEngines);
    container.appendChild(appsGrid);
    container.appendChild(madeWith);        // NEW
    container.appendChild(ugcShowcase);     // NEW
    container.appendChild(features);
    container.appendChild(videoGallery);    // NEW
    container.appendChild(academyShowcase); // NEW
    // Append each of the 12 repo showcase sections
    lazyRepoSections.forEach((section) => container.appendChild(section));
    container.appendChild(repoShowcase);    // NEW

    // NEW: GTM Boost feature section — shows the feature and how it works
    // (replaces the old floating FAB, which is now reachable from here).
    const gtmBoost = createLazySection(() => import('./sections/GTMBoostSection.jsx'), 'gtm-boost', {}, 8);
    container.appendChild(gtmBoost);

    container.appendChild(problem);
    container.appendChild(workflow);
    container.appendChild(comparison);
    container.appendChild(valueStack);
    container.appendChild(agency);
    container.appendChild(offer);
    container.appendChild(finalCTA);
  } catch (error) {
    console.error('Error rendering landing page:', error);
    container.innerHTML = `
      <section class="relative py-32 px-4 text-center bg-[#020205] min-h-screen flex items-center justify-center">
        <div class="container mx-auto max-w-3xl">
          <h1 class="text-4xl md:text-6xl text-white mb-6">AI Video Agency Studio</h1>
          <p class="text-xl text-gray-400 mb-4">Something went wrong loading the page.</p>
          <button onclick="window.location.reload()" class="px-6 py-3 bg-cyan-400 text-black font-semibold rounded hover:bg-cyan-300 transition">Try Again</button>
        </div>
      </section>
    `;
  }
  return container;
}
