// Product Demo: the full SmartVideo walkthrough reel, click to play with controls.
// Sits right after the Hook so the pitch is followed straight away by proof.
import { createDemoPlayer, formatDuration } from '../common/demoPlayer.js';

const REEL = '/landing-videos/b-feature-reel';
const REEL_SECONDS = 50;

export function ProductDemoSection() {
  const section = document.createElement('section');
  section.id = 'product-demo';
  section.className = 'relative py-20 px-4 bg-[#020205]';
  section.setAttribute('aria-labelledby', 'product-demo-heading');
  section.setAttribute('data-testid', 'product-demo-section');

  section.innerHTML = `
    <div class="container mx-auto max-w-5xl">
      <div class="text-center mb-10">
        <span class="inline-block text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400 border border-cyan-400/30 bg-cyan-400/[0.08] rounded-full px-4 py-1.5 mb-5">Product demo · ${formatDuration(REEL_SECONDS)}</span>
        <h2 id="product-demo-heading" class="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4">
          See the whole platform <span class="text-cyan-400 italic">in under a minute.</span>
        </h2>
        <p class="text-lg text-gray-300 max-w-3xl mx-auto">
          A fast walk through the real studios: Cinema, Director, Edit, Character, Lip Sync, Effects and Templates, captured from the running app.
        </p>
      </div>
      <div data-demo-slot class="mx-auto"></div>
      <div class="text-center mt-8">
        <a href="#studio-demos" class="inline-flex items-center gap-2 text-cyan-300 font-semibold hover:text-cyan-200 transition-colors">Want a closer look? Watch a studio tour →</a>
      </div>
    </div>`;

  const player = createDemoPlayer({
    label: 'SmartVideo product demo: a walkthrough of the studios',
    poster: `${REEL}.poster.webp`,
    src: `${REEL}.mp4`,
    className: 'rounded-2xl border border-cyan-400/20 shadow-2xl shadow-cyan-400/10',
  });
  section.querySelector('[data-demo-slot]').replaceWith(player);

  section.cleanup = () => player.stop();
  return section;
}

export default ProductDemoSection;
