import { mountStudioChrome } from '../lib/studioChrome.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { v2vModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { showInlineError, hideInlineError, startGenerationProgress, createAbortAwareGenerate, categorizeGenerationError } from '../lib/studioHelpers.js';
import { createLoadingOverlay, createProgressBar } from '../lib/loading.js';
import { mountModelSelector } from '../lib/modelSelectorUI.js';

export function VideoToVideoPage() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col items-center bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar overflow-x-hidden';
    mountStudioChrome(container, { currentRoute: 'video-to-video' });

    // ==========================================
    // State
    // ==========================================
    let selectedModel = v2vModels[0]?.id || '';
    let uploadedVideoUrl = null;
    let isLoading = false;
    let loadingOverlay = null;
    let progressHandle = null;
    let abortController = null;
    let generationError = null;

    // ==========================================
    // 1. HERO SECTION
    // ==========================================
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

    // ==========================================
    // 2. PROMPT BAR / STUDIO CONTROLS
    // ==========================================
    const promptWrapper = document.createElement('div');
    promptWrapper.className = 'w-full relative z-40 animate-fade-in-up';
    promptWrapper.style.animationDelay = '0.2s';

    const bar = document.createElement('div');
    bar.className = 'w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 flex flex-col gap-3 md:gap-5 shadow-3xl';

    const topRow = document.createElement('div');
    topRow.className = 'flex items-start gap-5 px-2';

    <!-- CTA Section -->
    <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-6 md:p-8 shadow-3xl text-center">
      <h2 class="text-2xl md:text-3xl font-black text-white mb-2">Transform Your Videos</h2>
      <p class="text-sm text-muted mb-6 max-w-md mx-auto">Start editing your videos with powerful AI tools</p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button class="cta-btn bg-primary text-black px-6 py-2.5 rounded-xl font-black text-sm hover:shadow-glow hover:scale-105 active:scale-95 transition-all">Get Started Free</button>
        <button type="button" class="gtm-boost-btn border border-primary/40 text-primary px-6 py-2.5 rounded-xl font-black text-sm hover:bg-primary/10 active:scale-95 transition-all" title="Enhance your prompt with GTM conversion frameworks" aria-label="GTM Boost prompt enhancer">🎯 GTM Boost</button>
      </div>
    </div>
  `;

    const videoPickerBtn = document.createElement('button');
    videoPickerBtn.type = 'button';
    videoPickerBtn.title = 'Upload video for transformation';
    videoPickerBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden mt-1.5 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group';

    const videoIconEl = document.createElement('div');
    videoIconEl.className = 'flex items-center justify-center w-full h-full';
    videoIconEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted group-hover:text-primary transition-colors"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;

  const gtmBoostBtn = contentWrapper.querySelector('.gtm-boost-btn');
  if (gtmBoostBtn) {
    gtmBoostBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('video-to-video', (prompt) => {
          try { localStorage.setItem('prefill_prompt', prompt); } catch { /* ignore storage failures */ }
          navigate('video');
        });
      }).catch((err) => console.error('[VideoToVideoPage] GTM Boost failed:', err));
    });
  }

  container.querySelectorAll('.model-card').forEach(card => {
    card.addEventListener('click', () => {
      const modelName = card.dataset.model;
      localStorage.setItem('prefill_model', modelName);
      navigate('video');
    });

    return container;
}

