// Studio Landing Page Component
// Renders SEO-optimized landing pages at /studios/[slug]

import { STUDIO_LANDING_PAGES } from '../../data/studioLandingPages.js';

function getDemoSlugById(id) {
  const map = {
    1: 'modern-warfare-fps-gameplay',
    2: 'luxury-perfume-commercial',
    3: '1980s-open-source-family-comedy',
    4: 'radio-operator-evacuation-bridge',
    5: 'giant-koi-park-incident',
    6: 'greenhouse-tea-isekai-anime',
    7: 'low-angle-fashion-tracking-film',
    8: 'storm-lit-pirate-galleon-battle',
    9: 'stormy-claymation-whale-breach',
    10: 'blue-haired-hero-and-spirit-fox-escape',
    11: 'kintsugi-sword-seamless-loop',
    12: 'ramen-bowl-ugc-taste-test',
    13: 'gourmet-burger-ugc-taste-test',
    14: 'luxury-skincare-storyboard-commercial',
    15: 'surreal-blue-studio-dance-with-a-horse',
    16: 'nighttime-motorcycle-chase-synced-to-music',
    17: 'y2k-k-pop-candy-typography-music-video',
    18: 'yellow-sunglasses-in-a-black-studio',
    19: 'theme-park-memory-montage',
    20: 'cyber-warrior-vs-primordial-fighter',
    21: 'strawberry-drink-transformation-commercial',
    22: 'ice-gunslinger-interactive-web-loop',
    23: 'porto-francesinha-comedy-recipe',
    24: 'macaw-scream-in-extreme-slow-motion',
    25: 'blackberry-vanilla-soda-ugc-vlog',
    26: 'bamboo-forest-wuxia-mystery',
    27: 'golden-guardian-web-hero-loop',
    28: 'emerald-bio-serum-product-film',
    29: 'black-and-gold-perfume-commercial',
    30: 'morning-lip-oil-ugc-testimonial',
  };
  return map[id] || null;
}

function updateMetaTags(studio) {
  if (typeof document === 'undefined') return;
  document.title = `${studio.heroTitle} | SmartVideo`;

  const setMeta = (name, content) => {
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = name;
      document.head.appendChild(tag);
    }
    tag.content = content;
  };

  setMeta('description', studio.heroDescription);
  setMeta('keywords', [...studio.seo.secondaryKeywords, ...studio.seo.longTailKeywords].join(', '));

  // Open Graph
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (!ogTitle) {
    ogTitle = document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    document.head.appendChild(ogTitle);
  }
  ogTitle.content = studio.heroTitle;

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (!ogDesc) {
    ogDesc = document.createElement('meta');
    ogDesc.setAttribute('property', 'og:description');
    document.head.appendChild(ogDesc);
  }
  ogDesc.content = studio.heroDescription;

  let ogImage = document.querySelector('meta[property="og:image"]');
  if (!ogImage) {
    ogImage = document.createElement('meta');
    ogImage.setAttribute('property', 'og:image');
    document.head.appendChild(ogImage);
  }
  ogImage.content = studio.thumbnail;
}

function createSection(title, content, className = '') {
  const section = document.createElement('section');
  section.className = `py-16 px-4 ${className}`.trim();
  section.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-8">${title}</h2>
      <div class="text-gray-300 leading-relaxed">${content}</div>
    </div>
  `;
  return section;
}

function createHowItWorksSection(steps) {
  const section = document.createElement('section');
  section.className = 'py-16 px-4 bg-[#0a0d16]';
  section.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-12 text-center">How It Works</h2>
      <div class="grid md:grid-cols-3 gap-8">
        ${steps.map((step, i) => `
          <div class="relative bg-[#111] border border-white/5 rounded-2xl p-8 text-center">
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-6">${i + 1}</div>
            <h3 class="text-xl font-semibold text-white mb-3">${step.title}</h3>
            <p class="text-gray-400 leading-relaxed mb-4">${step.description}</p>
            ${step.video ? `<video src="${step.video}" autoplay muted loop playsinline class="w-full h-40 object-cover rounded-lg border border-white/5" poster="${step.gif || ''}"></video>` : step.gif ? `<img src="${step.gif}" alt="${step.title} demo" class="w-full h-40 object-cover rounded-lg border border-white/5" loading="lazy" />` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  return section;
}

function createFeaturesSection(features) {
  const section = document.createElement('section');
  section.className = 'py-16 px-4';
  section.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-12 text-center">Features</h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${features.map(feature => `
          <div class="bg-[#111] border border-white/5 rounded-xl p-6 flex items-start gap-4">
            <div class="w-6 h-6 rounded-full bg-cyan-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </div>
            <p class="text-gray-300 leading-relaxed">${feature}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  return section;
}

function createMonetizationSection(monetization) {
  const section = document.createElement('section');
  section.className = 'py-16 px-4 bg-[#0a0d16]';
  section.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-4 text-center">Monetization & GTM</h2>
      <p class="text-gray-400 text-center mb-12 max-w-2xl mx-auto">Real revenue models, pricing anchors, and go-to-market motions sourced from the SmartVideo Academy.</p>

      <div class="grid md:grid-cols-2 gap-8 mb-12">
        <div class="bg-[#111] border border-white/5 rounded-2xl p-8">
          <h3 class="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <span class="w-8 h-8 rounded-lg bg-green-400/20 flex items-center justify-center text-green-400 text-sm">💰</span>
            Revenue Models
          </h3>
          <ul class="space-y-3">
            ${monetization.revenueModels.map(model => `
              <li class="flex items-start gap-3 text-gray-300">
                <span class="text-cyan-400 mt-1">›</span>
                <span class="leading-relaxed">${model}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <div class="bg-[#111] border border-white/5 rounded-2xl p-8">
          <h3 class="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <span class="w-8 h-8 rounded-lg bg-blue-400/20 flex items-center justify-center text-blue-400 text-sm">📊</span>
            Pricing Anchors
          </h3>
          <ul class="space-y-3">
            ${monetization.pricingAnchors.map(anchor => `
              <li class="flex items-start gap-3 text-gray-300">
                <span class="text-cyan-400 mt-1">›</span>
                <span class="leading-relaxed">${anchor}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>

      <div class="bg-[#111] border border-white/5 rounded-2xl p-8 mb-12">
        <h3 class="text-xl font-semibold text-white mb-6 flex items-center gap-3">
          <span class="w-8 h-8 rounded-lg bg-purple-400/20 flex items-center justify-center text-purple-400 text-sm">🚀</span>
          Go-To-Market Motion
        </h3>
        <div class="grid md:grid-cols-3 gap-6">
          ${monetization.gtmSteps.map((step, i) => `
            <div class="flex items-start gap-4">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">${i + 1}</div>
              <p class="text-gray-300 leading-relaxed">${step}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-400/20 rounded-2xl p-8">
        <h3 class="text-xl font-semibold text-white mb-4 flex items-center gap-3">
          <span class="w-8 h-8 rounded-lg bg-green-400/20 flex items-center justify-center text-green-400 text-sm">📈</span>
          Profit Math
        </h3>
        <div class="grid md:grid-cols-3 gap-6 text-center">
          <div>
            <div class="text-2xl font-bold text-green-400 mb-1">${monetization.profitMath.apiCost}</div>
            <div class="text-gray-400 text-sm">API Cost</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-white mb-1">${monetization.profitMath.clientFee}</div>
            <div class="text-gray-400 text-sm">Client Fee</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-cyan-400 mb-1">${monetization.profitMath.netMargin}</div>
            <div class="text-gray-400 text-sm">Net Margin</div>
          </div>
        </div>
      </div>
    </div>
  `;
  return section;
}

function createAcademySection(academyTracks) {
  const section = document.createElement('section');
  section.className = 'py-16 px-4';
  section.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-4 text-center">Learn to Monetize</h2>
      <p class="text-gray-400 text-center mb-12 max-w-2xl mx-auto">Master the business side of AI creation with SmartVideo Academy tracks.</p>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${academyTracks.map(track => `
          <a href="/academy/${track.slug}" class="group bg-[#111] border border-white/5 rounded-2xl p-6 hover:border-cyan-400/30 transition-all duration-300">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-400/20 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 4.168 6.253v13C4.168 19.223 5.754 19 7.5 19s3.332.223 4.168 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 3.332 1.253v13C19.832 19.223 18.247 19 16.5 19c-1.746 0-3.332.223-4.168 1.253"/></svg>
              </div>
              <h3 class="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">${track.title}</h3>
            </div>
            <p class="text-gray-400 text-sm">Learn pricing, packaging, and go-to-market strategies for this studio.</p>
          </a>
        `).join('')}
      </div>
    </div>
  `;
  return section;
}

function createGallerySection(studio, demoIds) {
  if (!demoIds || demoIds.length === 0) return null;

  const section = document.createElement('section');
  section.className = 'py-16 px-4 bg-[#0a0d16]';
  section.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-4 text-center">Examples</h2>
      <p class="text-gray-400 text-center mb-12 max-w-2xl mx-auto">Real AI-generated examples from the ${studio.label} community.</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${demoIds.map(id => {
          const demoSlug = id >= 1 && id <= 30 ? getDemoSlugById(id) : null;
          const imgSrc = demoSlug ? `/media/minimax-h3/previews/${demoSlug}.webp` : '';
          return `
            <div class="aspect-video bg-[#111] rounded-xl border border-white/5 overflow-hidden flex items-center justify-center">
              ${imgSrc ? `<img src="${imgSrc}" alt="Demo ${id}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'text-gray-600 text-sm\\'>Demo</div>'" />` : '<div class=\'text-gray-600 text-sm\'>Demo</div>'}
            </div>
          `;
        }).join('')}
      </div>
      <div class="text-center mt-8">
        <a href="/explore" class="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
          View all examples
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  `;
  return section;
}

function createCTASection(studio) {
  const section = document.createElement('section');
  section.className = 'py-16 px-4';
  section.innerHTML = `
    <div class="max-w-4xl mx-auto text-center">
      <div class="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-cyan-400/20 rounded-3xl p-12">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Create?</h2>
        <p class="text-gray-300 mb-8 max-w-xl mx-auto">Start generating professional AI content with ${studio.label}. Open-source, no vendor lock-in, 200+ models included.</p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/#/${studio.slug}" class="inline-flex items-center justify-center gap-2 bg-cyan-400 text-black font-semibold px-8 py-3 rounded-xl hover:bg-cyan-300 transition-colors">
            Open ${studio.label}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </a>
          <a href="/academy" class="inline-flex items-center justify-center gap-2 bg-white/5 text-white border border-white/10 font-semibold px-8 py-3 rounded-xl hover:bg-white/10 transition-colors">
            Learn to Monetize
          </a>
        </div>
      </div>
    </div>
  `;
  return section;
}

function createFooter() {
  const footer = document.createElement('footer');
  footer.className = 'py-12 px-4 border-t border-white/5 bg-[#05080f]';
  footer.innerHTML = `
    <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1.5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="black"/>
            <path d="M2 17L12 22L22 17" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="text-white font-semibold">SmartVideo</span>
      </div>
      <div class="flex gap-6 text-sm text-gray-400">
        <a href="/" class="hover:text-white transition-colors">Home</a>
        <a href="/academy" class="hover:text-white transition-colors">Academy</a>
        <a href="/explore" class="hover:text-white transition-colors">Explore</a>
        <a href="/templates" class="hover:text-white transition-colors">Templates</a>
      </div>
      <p class="text-gray-500 text-sm">© 2024 SmartVideo. Open-source AI studio.</p>
    </div>
  `;
  return footer;
}

export default async function StudioLandingPage(slug) {
  const studio = STUDIO_LANDING_PAGES[slug];
  if (!studio) {
    const notFound = document.createElement('div');
    notFound.className = 'min-h-screen flex items-center justify-center bg-[#020205]';
    notFound.innerHTML = `
      <div class="text-center">
        <h1 class="text-4xl font-bold text-white mb-4">Studio Not Found</h1>
        <p class="text-gray-400 mb-8">The studio you're looking for doesn't exist.</p>
        <a href="/" class="text-cyan-400 hover:text-cyan-300">← Back to Home</a>
      </div>
    `;
    return notFound;
  }

  updateMetaTags(studio);

  const container = document.createElement('div');
  container.className = 'min-h-screen bg-[#020205]';
  container.setAttribute('lang', 'en');

  // Header
  try {
    const mod = await import('../landing/common/Header.jsx');
    const headerEl = mod.LandingHeader();
    container.appendChild(headerEl);
  } catch (e) {
    console.error('[StudioLandingPage] Header failed:', e);
  }

  // Hero
  const hero = document.createElement('section');
  hero.className = 'py-20 px-4';
  hero.innerHTML = `
    <div class="max-w-6xl mx-auto">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-cyan-400/10 border border-cyan-400/20 rounded-full text-cyan-400 text-sm font-medium mb-6">
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            ${studio.label}
          </div>
          <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">${studio.heroTitle}</h1>
          <p class="text-lg text-gray-300 mb-8 leading-relaxed max-w-xl">${studio.heroDescription}</p>
          <div class="flex flex-col sm:flex-row gap-4">
            <a href="/#/${studio.slug}" class="inline-flex items-center justify-center gap-2 bg-cyan-400 text-black font-semibold px-8 py-3 rounded-xl hover:bg-cyan-300 transition-colors">
              Open ${studio.label}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </a>
            <a href="/academy" class="inline-flex items-center justify-center gap-2 bg-white/5 text-white border border-white/10 font-semibold px-8 py-3 rounded-xl hover:bg-white/10 transition-colors">
              Learn to Monetize
            </a>
          </div>
        </div>
        <div class="relative">
          <div class="aspect-video bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
            <img src="${studio.thumbnail}" alt="${studio.label}" class="w-full h-full object-cover" loading="eager" />
          </div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(hero);

  // How It Works
  container.appendChild(createHowItWorksSection(studio.howItWorks));

  // Features
  container.appendChild(createFeaturesSection(studio.features));

  // Gallery
  const gallery = createGallerySection(studio, studio.miniMaxDemoIds);
  if (gallery) container.appendChild(gallery);

  // Value Prop
  container.appendChild(createSection('Why Choose SmartVideo?', `<p class="text-xl text-gray-300 leading-relaxed">${studio.valueProp}</p>`, 'bg-[#0a0d16]'));

  // Monetization & GTM
  container.appendChild(createMonetizationSection(studio.monetization));

  // Academy
  container.appendChild(createAcademySection(studio.academyTracks));

  // CTA
  container.appendChild(createCTASection(studio));

  // Footer
  container.appendChild(createFooter());

  return container;
}
