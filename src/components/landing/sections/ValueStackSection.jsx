// Value Stack Section - Studio Screenshot Showcase

const SHOWCASE_CONFIG = { getStudioThumbnail: () => '/thumbnails/studios/video.webp', getToolThumbnail: () => null, getTemplateThumbnail: () => null, getEffectPreview: () => null };

const FULL_SCENE_SCREENSHOTS = [
  { src: '/screenshots/full-desktop.png', alt: 'Full desktop studio view' },
  { src: '/screenshots/hero-desktop.png', alt: 'Hero desktop view' },
  { src: '/screenshots/workflow-desktop.png', alt: 'Workflow desktop view' },
  { src: '/screenshots/gallery-desktop.png', alt: 'Gallery desktop view' },
];

const SMALL_SCREENSHOTS = [
  { src: '/screenshots/image.png', alt: 'Image studio' },
  { src: '/screenshots/video.png', alt: 'Video studio' },
  { src: '/screenshots/cinema.png', alt: 'Cinema studio' },
  { src: '/screenshots/edit.png', alt: 'Edit studio' },
  { src: '/screenshots/effects.png', alt: 'Effects studio' },
  { src: '/screenshots/audio.png', alt: 'Audio studio' },
  { src: '/screenshots/director.png', alt: 'Director studio' },
  { src: '/screenshots/storyboard.png', alt: 'Storyboard studio' },
  { src: '/screenshots/render.png', alt: 'Render studio' },
  { src: '/screenshots/timeline.png', alt: 'Timeline editor' },
  { src: '/screenshots/templates.png', alt: 'Templates library' },
  { src: '/screenshots/explore.png', alt: 'Explore page' },
];

const LONG_SCREENSHOTS = [
  { src: '/screenshots/full-mobile.png', alt: 'Full mobile view' },
  { src: '/screenshots/hero-mobile.png', alt: 'Hero mobile view' },
  { src: '/screenshots/workflow-mobile.png', alt: 'Workflow mobile view' },
  { src: '/screenshots/gallery-mobile.png', alt: 'Gallery mobile view' },
  { src: '/screenshots/reel-mobile.png', alt: 'Reel mobile view' },
  { src: '/screenshots/ugc-mobile.png', alt: 'UGC mobile view' },
];

function screenshotCard(item) {
  return `
    <div class="screenshot-card group relative aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400/50 transition-all duration-300 cursor-pointer">
      <img 
        src="${item.src}" 
        alt="${item.alt}"
        class="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-3">
        <span class="text-sm font-medium text-white">${item.alt}</span>
      </div>
    </div>
  `;
}

export function ValueStackSection() {
  const section = document.createElement('section');
  section.className = 'py-20 px-4 bg-gradient-to-b from-[#05070b] to-[#020205]';
  section.setAttribute('aria-labelledby', 'value-heading');

  section.innerHTML = `
    <div class="container mx-auto max-w-7xl">
      <div class="text-center mb-16">
        <h2 id="value-heading" class="value-headline text-3xl md:text-4xl lg:text-5xl font-black text-white mb-6 opacity-0">
          You're Not Getting One AI Tool — You're Getting A <span class="text-cyan-400 italic">Full AI Creative Personalization Production Suite</span>
        </h2>
        <p class="text-xl text-gray-300 max-w-4xl mx-auto">
          Here's exactly what you unlock when you start building with Smart Video AI Studio:
        </p>
      </div>

      <!-- Full Scene Screenshots -->
      <div class="mb-10">
        <h3 class="mb-6 text-center text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Studio Interfaces</h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5 screenshot-grid">
          ${FULL_SCENE_SCREENSHOTS.map(screenshotCard).join('')}
        </div>
      </div>

      <!-- Small Screenshots -->
      <div class="mb-10">
        <h3 class="mb-6 text-center text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Features & Templates</h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5 screenshot-grid">
          ${SMALL_SCREENSHOTS.map(screenshotCard).join('')}
        </div>
      </div>

      <!-- Long Screenshots -->
      <div>
        <h3 class="mb-6 text-center text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Studio Showcase</h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5 screenshot-grid">
          ${LONG_SCREENSHOTS.map(screenshotCard).join('')}
        </div>
      </div>
    </div>

    <style>
      .screenshot-card {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease-out-quart, transform 0.6s ease-out-quart, border-color 0.3s ease, box-shadow 0.3s ease;
      }
      .screenshot-card.animate-in {
        opacity: 1;
        transform: translateY(0);
      }
      .screenshot-card:hover {
        transform: translateY(-4px);
      }
      @media (prefers-reduced-motion: reduce) {
        .screenshot-card {
          transition: none;
          opacity: 1;
          transform: none;
        }
        .screenshot-card:hover {
          transform: none;
        }
      }
    </style>
  `;

  setTimeout(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          entry.target.style.transitionDelay = `${index * 25}ms`;
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

    section.querySelectorAll('.screenshot-card').forEach((card) => {
      observer.observe(card);
    });
  }, 100);

  return section;
}
