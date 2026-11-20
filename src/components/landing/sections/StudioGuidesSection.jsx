// Studio Guides Section: crawlable links to every /studios/<slug> feature guide.
// Data is the small generated index (scripts/build-studio-guides.mjs --index-only),
// not the full guide content, so this stays light on the landing page.
import GUIDE_INDEX from '../../../data/studioGuideIndex.json';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function StudioGuidesSection() {
  const total = GUIDE_INDEX.reduce((n, c) => n + c.guides.length, 0);
  const features = GUIDE_INDEX.reduce((n, c) => n + c.guides.reduce((m, g) => m + g.features, 0), 0);

  const section = document.createElement('section');
  section.className = 'py-20 px-4 bg-app-bg';
  section.id = 'studio-guides';
  section.setAttribute('aria-labelledby', 'studio-guides-heading');
  section.setAttribute('data-testid', 'studio-guides-section');

  section.innerHTML = `
    <div class="container mx-auto max-w-7xl">
      <div class="text-center mb-12">
        <span class="inline-block text-xs font-semibold uppercase tracking-[0.16em] text-primary border border-primary/30 bg-primary/[0.08] rounded-full px-4 py-1.5 mb-5">Feature guides</span>
        <h2 id="studio-guides-heading" class="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4">
          Explore every studio. <span class="text-primary italic">${features} features, explained.</span>
        </h2>
        <p class="text-lg text-gray-300 max-w-3xl mx-auto">
          A complete guide for each of our ${total} studios: what every feature does, screenshots, how to use it, inputs, outputs, limits and FAQs.
        </p>
      </div>
      <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        ${GUIDE_INDEX.map((c) => `
          <div class="rounded-2xl border border-white/10 bg-card-bg p-6">
            <h3 class="text-lg font-bold text-white mb-1">${esc(c.title)}</h3>
            <p class="text-sm text-gray-400 mb-4">${esc(c.blurb)}</p>
            <ul class="space-y-1.5">
              ${c.guides.map((g) => `
                <li><a href="/studios/${esc(g.slug)}/" class="group flex items-baseline justify-between gap-3 text-gray-200 hover:text-primary transition-colors">
                  <span class="font-medium">${esc(g.name)}</span>
                  <span class="text-xs text-gray-500 group-hover:text-primary/80 whitespace-nowrap">${g.features} features</span>
                </a></li>`).join('')}
            </ul>
          </div>`).join('')}
      </div>
      <div class="text-center mt-10">
        <a href="/studios/" class="inline-flex items-center gap-2 px-8 py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary-hover hover:shadow-glow transition-all">Browse all studio guides →</a>
      </div>
    </div>`;
  return section;
}

export default StudioGuidesSection;
