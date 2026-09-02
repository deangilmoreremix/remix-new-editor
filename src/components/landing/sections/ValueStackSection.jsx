// Value Stack Section - Studio Screenshot Showcase

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
