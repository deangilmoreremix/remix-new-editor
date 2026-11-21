import { navigate } from '../lib/router.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { createHeroSection } from '../lib/thumbnails.js';

export function VideoToVideoPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar overflow-x-hidden';
  mountStudioChrome(container, { currentRoute: 'video-to-video' });

  const hero = document.createElement('div');
  hero.className = 'flex flex-col items-center mb-2 md:mb-4 animate-fade-in-up transition-all duration-700 w-full';
  const heroBanner = createHeroSection('video', 'h-32 md:h-44 mb-3');
  if (heroBanner) {
    const heroContent = document.createElement('div');
    heroContent.className = 'absolute bottom-0 left-0 right-0 p-6 z-10';
    heroContent.innerHTML = `
      <h1 class="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-1">Video to Video</h1>
      <p class="text-white/60 text-sm font-medium">Transform and enhance your videos with AI-powered tools</p>
    `;
    heroBanner.appendChild(heroContent);
    hero.appendChild(heroBanner);
  }
  container.appendChild(hero);

  const ctaSection = document.createElement('div');
  ctaSection.className = 'w-full max-w-3xl bg-card-bg/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-6 md:p-8 shadow-3xl text-center animate-fade-in-up';
  ctaSection.innerHTML = `
    <h2 class="text-2xl md:text-3xl font-black text-white mb-2">Transform Your Videos</h2>
    <p class="text-sm text-muted mb-6 max-w-md mx-auto">Start editing your videos with powerful AI tools. Upload a clip in Video Studio to restyle it, extend it or remove a watermark.</p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
      <button type="button" class="cta-btn btn-primary-modern">Get Started Free</button>
      <button type="button" class="gtm-boost-btn border border-primary/40 text-primary px-6 py-2.5 rounded-xl font-black text-sm hover:bg-primary/10 active:scale-95 transition-all" title="Enhance your prompt with GTM conversion frameworks" aria-label="GTM Boost prompt enhancer">🎯 GTM Boost</button>
    </div>
  `;
  container.appendChild(ctaSection);

  ctaSection.querySelector('.cta-btn').addEventListener('click', () => navigate('video'));
  ctaSection.querySelector('.gtm-boost-btn').addEventListener('click', () => {
    import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
      openGTMPromptModal('video-to-video', (prompt) => {
        try { localStorage.setItem('prefill_prompt', prompt); } catch { /* ignore storage failures */ }
        navigate('video');
      });
    }).catch((err) => console.error('[VideoToVideoPage] GTM Boost failed:', err));
  });

  return container;
}
