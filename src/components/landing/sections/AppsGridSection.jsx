// Apps Grid Section - 33 AI Creative Apps Showcase

import SHOWCASE_CONFIG from '../../content/showcaseConfig.js';

export function AppsGridSection({ apps }) {
  const section = document.createElement('section');
  section.className = 'py-20 px-4 bg-gradient-to-b from-[#05070b] to-[#020205]';
  section.setAttribute('aria-labelledby', 'apps-heading');
  section.setAttribute('data-testid', 'apps-grid-section');

  // Get unique categories from apps
  const categories = ['All', 'Create', 'Enhance', 'Produce', 'Localize', 'Automate', 'Scale'];
  const categoryMap = {
    'All': ['image', 'video', 'cinema', 'character', 'ai-vfx', 'influencer', 'storyboard', 'effects', 'vfx', 'edit', 'upscale', 'audio', 'avatar', 'training', 'videotools', 'render', 'video-agent', 'director', 'timeline', 'motion', 'tiktok', 'dubbing', 'chat', 'commercial', 'templates', 'explore', 'library', 'community', 'assist', 'lip-sync', 'workflows', 'agents', 'mcp-cli'],
    'Create': ['image', 'video', 'cinema', 'character', 'influencer', 'commercial'],
    'Enhance': ['effects', 'vfx', 'ai-vfx', 'motion', 'upscale', 'edit'],
    'Produce': ['storyboard', 'director', 'timeline', 'render', 'videotools', 'audio'],
    'Localize': ['dubbing', 'lip-sync', 'avatar', 'tiktok'],
    'Automate': ['video-agent', 'agents', 'workflows', 'assist', 'chat', 'mcp-cli'],
    'Scale': ['templates', 'explore', 'library', 'community', 'training']
  };

  section.innerHTML = `
    <div class="container mx-auto max-w-7xl">
      <!-- Section Header -->
      <div class="text-center mb-12">
        <h2 id="apps-heading" class="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4">
          One Platform. <span class="text-cyan-400 italic">33 AI Creative Apps.</span> 60+ Ways To Create, Edit, Sell & Deliver AI Content.
        </h2>
        <p class="text-lg text-gray-300 max-w-3xl mx-auto">
          Most AI tools give you one feature. AI Video Agency Studio gives you a full creative production ecosystem. You can generate images, create videos, direct cinematic scenes, build characters, add VFX, edit assets, upscale outputs, create avatars, dub videos, sync lips, build workflows, use AI agents, organize assets, explore templates, and deliver client-ready creative packages from one powerful dashboard.
        </p>
      </div>

      <!-- Search and Filter -->
      <div class="mb-8">
        <div class="flex flex-col md:flex-row gap-4 items-center justify-center">
          <div class="relative w-full max-w-md">
            <input 
              type="text" 
              id="app-search" 
              placeholder="Search apps..."
              class="w-full px-4 py-3 pl-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
            />
            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
        </div>
        
        <!-- Category Tabs -->
        <div class="flex flex-wrap justify-center gap-2 mt-6" id="category-tabs">
          ${categories.map((cat, index) => `
            <button 
              class="category-tab px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${cat === 'All' ? 'bg-cyan-400 text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'}"
              data-category="${cat}"
            >
              ${cat}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Apps Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12" id="apps-grid">
        ${apps.map((app, index) => {
          const thumbnailPath = SHOWCASE_CONFIG.getStudioThumbnail(app.id);
          return `
          <a href="${app.link}" class="app-card group block p-6 bg-gradient-to-br from-white/5 to-white/2 border border-white/10 rounded-xl hover:border-cyan-400/50 hover:bg-cyan-400/5 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-400/20 opacity-0 translate-y-4" data-app-id="${app.id}" data-index="${index}" data-testid="app-card">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 bg-cyan-400/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-400/30 transition-colors">
                <span class="text-2xl">${getAppIcon(app.id)}</span>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">${app.title}</h3>
                <p class="text-sm text-gray-400 leading-relaxed">${app.description}</p>
              </div>
            </div>
            <!-- Historical studio thumbnail added as visual enhancement -->
            <div class="mt-4 rounded-lg overflow-hidden border border-white/10 group-hover:border-cyan-400/30 transition-colors">
              <img 
                src="${thumbnailPath}" 
                alt="${app.title} studio preview"
                class="w-full h-32 object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                loading="lazy"
              />
            </div>
            <div class="mt-4 flex items-center text-xs text-cyan-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open ${app.title}</span>
              <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </a>
          `;
        }).join('')}
      </div>

      <!-- No Results Message -->
      <div id="no-results" class="hidden text-center py-12">
        <div class="text-4xl mb-4">🔍</div>
        <p class="text-gray-400 text-lg">No apps found matching your search.</p>
      </div>

      <!-- Before/After Tool Previews - Historical tool examples added as visual enhancement -->
      <div class="mt-16 mb-12">
        <div class="text-center mb-8">
          <h3 class="text-2xl md:text-3xl font-bold text-white mb-3">Edit Studio — See It In Action</h3>
          <p class="text-gray-400 max-w-2xl mx-auto">Powerful AI editing tools that transform your visuals. Remove backgrounds, swap faces, enhance skin, upscale resolution, and more.</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          ${[
            { id: 'remove-bg', name: 'Remove Background', thumb: SHOWCASE_CONFIG.getToolThumbnail('removeBg') },
            { id: 'remove-object', name: 'Remove Object', thumb: SHOWCASE_CONFIG.getToolThumbnail('removeObject') },
            { id: 'face-swap', name: 'Face Swap', thumb: SHOWCASE_CONFIG.getToolThumbnail('faceSwap') },
            { id: 'product-shot', name: 'Product Shot', thumb: SHOWCASE_CONFIG.getToolThumbnail('productShot') },
            { id: 'upscale', name: 'Upscale', thumb: SHOWCASE_CONFIG.getToolThumbnail('upscale') },
            { id: 'skin-enhance', name: 'Skin Enhance', thumb: SHOWCASE_CONFIG.getToolThumbnail('skinEnhance') },
            { id: 'colorize', name: 'Colorize', thumb: SHOWCASE_CONFIG.getToolThumbnail('colorize') },
            { id: 'reframe', name: 'Reframe', thumb: SHOWCASE_CONFIG.getToolThumbnail('reframe') },
            { id: 'ai-edit', name: 'AI Edit', thumb: SHOWCASE_CONFIG.getToolThumbnail('aiEdit') },
            { id: 'extend', name: 'Extend', thumb: SHOWCASE_CONFIG.getToolThumbnail('extend') },
            { id: 'ghibli-style', name: 'Ghibli Style', thumb: SHOWCASE_CONFIG.getToolThumbnail('ghibliStyle') },
            { id: 'watermark', name: 'Watermark', thumb: SHOWCASE_CONFIG.getToolThumbnail('watermark') }
          ].map((tool, i) => `
            <div class="tool-preview-card group relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400/50 transition-all duration-300 cursor-pointer" style="transition-delay: ${i * 40}ms;">
              <img 
                src="${tool.thumb}" 
                alt="${tool.name} tool preview"
                class="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                loading="lazy"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
              <div class="absolute bottom-0 left-0 right-0 p-3">
                <span class="text-sm font-medium text-white">${tool.name}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- CTA Button -->
      <div class="text-center">
        <a href="/apps" class="inline-block px-8 py-4 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold text-lg rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-300 shadow-2xl shadow-cyan-400/30 hover:shadow-cyan-300/50 transform hover:scale-105">
          Explore All 33 AI Creative Apps →
        </a>
      </div>
    </div>

    <style>
      .app-card {
        transition: opacity 0.5s ease-out-quart, transform 0.5s ease-out-quart, border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
      }
      .app-card.animate-in {
        opacity: 1;
        transform: translateY(0);
      }
      .app-card:hover {
        transform: translateY(-4px);
      }
      .category-tab {
        transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
      }
      .category-tab:hover {
        transform: translateY(-1px);
      }
      .category-tab.active {
        background-color: #22d3ee;
        color: #020205;
      }
      @media (prefers-reduced-motion: reduce) {
        .app-card { transition: none; opacity: 1; transform: none; }
        .app-card:hover { transform: none; }
        .category-tab { transition: none; }
        .category-tab:hover { transform: none; }
        .tool-preview-card { transition: none; opacity: 1; transform: none; }
        .tool-preview-card:hover { transform: none; }
      }

      /* Tool preview cards */
      .tool-preview-card {
        transition: opacity 0.5s ease-out-quart, transform 0.5s ease-out-quart, border-color 0.3s ease, box-shadow 0.3s ease;
      }
      .tool-preview-card.animate-in {
        opacity: 1;
        transform: translateY(0);
      }
      .tool-preview-card:hover {
        transform: translateY(-4px);
      }
    </style>
  `;

  // Initialize search and filter functionality
  setTimeout(() => {
    const searchInput = section.querySelector('#app-search');
    const categoryTabs = section.querySelectorAll('.category-tab');
    const appCards = section.querySelectorAll('.app-card');
    const noResults = section.querySelector('#no-results');
    let activeCategory = 'All';

    function filterApps() {
      const searchTerm = searchInput.value.toLowerCase();
      let visibleCount = 0;

      appCards.forEach((card, index) => {
        const appId = card.dataset.appId;
        const title = card.querySelector('h3').textContent.toLowerCase();
        const description = card.querySelector('p').textContent.toLowerCase();
        
        const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
        const matchesCategory = activeCategory === 'All' || categoryMap[activeCategory].includes(appId);

        if (matchesSearch && matchesCategory) {
          card.style.display = 'block';
          card.style.animationDelay = `${visibleCount * 30}ms`;
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      noResults.classList.toggle('hidden', visibleCount > 0);
    }

    searchInput.addEventListener('input', filterApps);

    categoryTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        categoryTabs.forEach(t => {
          t.classList.remove('bg-cyan-400', 'text-black');
          t.classList.add('bg-white/5', 'text-gray-300');
        });
        tab.classList.remove('bg-white/5', 'text-gray-300');
        tab.classList.add('bg-cyan-400', 'text-black');
        activeCategory = tab.dataset.category;
        filterApps();
      });
    });

    // Initialize scroll animation observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    appCards.forEach((card, index) => {
      card.style.animationDelay = `${index * 30}ms`;
      observer.observe(card);
    });

    // Animate tool preview cards
    const toolCards = section.querySelectorAll('.tool-preview-card');
    const toolObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          toolObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    toolCards.forEach((card, index) => {
      card.style.animationDelay = `${index * 40}ms`;
      toolObserver.observe(card);
    });
  }, 0);

  return section;
}

// Helper function to get appropriate icons for apps
function getAppIcon(appId) {
  const icons = {
    'image': '🖼️',
    'video': '🎬',
    'cinema': '🎥',
    'character': '🧑',
    'ai-vfx': '✨',
    'influencer': '🌟',
    'storyboard': '📋',
    'effects': '🎭',
    'vfx': '💥',
    'edit': '✂️',
    'upscale': '🔍',
    'audio': '🎵',
    'avatar': '👤',
    'training': '🏋️',
    'videotools': '🔧',
    'render': '🚀',
    'video-agent': '🤖',
    'director': '🎬',
    'timeline': '⏱️',
    'motion': '🎪',
    'tiktok': '📱',
    'dubbing': '🎙️',
    'chat': '💬',
    'commercial': '💼',
    'templates': '📁',
    'explore': '🔍',
    'library': '📚',
    'community': '👥',
    'assist': '🧠',
    'lip-sync': '🎭',
    'workflows': '⚙️',
    'agents': '🤖',
    'mcp-cli': '💻'
  };
  
  return icons[appId] || '🔧';
}
