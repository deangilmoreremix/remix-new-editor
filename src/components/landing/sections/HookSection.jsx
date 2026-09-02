// Hook Section - Stop buying scattered AI tools, start building an AI video agency

import SHOWCASE_CONFIG from '../../content/showcaseConfig.js';

export function HookSection() {
  const section = document.createElement('section');
  section.className = 'py-16 px-4 bg-gradient-to-b from-[#020205] to-[#05070b] border-y border-cyan-400/20';
  section.setAttribute('aria-labelledby', 'hook-heading');

  section.innerHTML = `
    <div class="container mx-auto max-w-5xl">
      <div class="text-center">
        <div class="inline-block mb-6">
          <div class="flex items-center gap-3 px-5 py-2 bg-gradient-to-r from-cyan-400/10 to-emerald-400/10 border border-cyan-400/30 rounded-full">
            <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span class="text-cyan-400 font-semibold">The Smarter Way To Create AI Content</span>
          </div>
        </div>

        <h2 id="hook-heading" class="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">
          Stop buying scattered AI tools.<br/>
          <span class="text-cyan-400">Start building a complete AI video agency</span><br/>
          with one platform that helps you create images, videos, VFX, commercials, characters, avatars, storyboards, edits, workflows, agents, and client-ready creative packages.
        </h2>

        <p class="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
          AI Video Agency Studio is the all-in-one creative command center that replaces 10+ subscriptions and puts everything you need to create, edit, and deliver professional AI content in one place.
        </p>

        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button class="px-8 py-4 bg-gradient-to-r from-cyan-400 to-cyan-300 text-[#020205] font-bold text-lg rounded-lg hover:from-cyan-300 hover:to-cyan-200 transition-all duration-300 shadow-2xl shadow-cyan-400/30 hover:shadow-cyan-300/50 transform hover:scale-105">
            Start Building My AI Video Agency →
          </button>
          <button class="px-8 py-4 border-2 border-white/30 text-white font-bold text-lg rounded-lg hover:border-cyan-400 hover:text-cyan-400 transition-all duration-300">
            See It In Action
          </button>
        </div>

        <!-- Studio visual gallery - historical thumbnails added as enhancement -->
        <div class="mt-12 flex flex-wrap justify-center gap-3 md:gap-4 max-w-5xl mx-auto">
          ${['image', 'video', 'cinema', 'character', 'edit', 'audio', 'avatar', 'effects', 'commercial', 'storyboard'].map((studioId, i) => {
            const thumb = SHOWCASE_CONFIG.getStudioThumbnail(studioId);
            return `
            <div class="w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden border border-white/10 hover:border-cyan-400/50 hover:scale-110 transition-all duration-300 opacity-0 translate-y-4" style="transition-delay: ${i * 60}ms;">
              <img src="${thumb}" alt="${studioId}" class="w-full h-full object-cover" loading="lazy" />
            </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <style>
      @keyframes hookFadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .hook-thumb-animate {
        animation: hookFadeIn 0.6s ease-out forwards;
      }
      @media (prefers-reduced-motion: reduce) {
        .hook-animate { animation: none; }
        .hook-thumb-animate { animation: none; opacity: 1; transform: none; }
      }
    </style>
  `;

  // Animate studio thumbnails
  setTimeout(() => {
    const thumbObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('hook-thumb-animate');
          thumbObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

    section.querySelectorAll('[style*="transition-delay"]').forEach(el => {
      thumbObserver.observe(el);
    });
  }, 100);

  return section;
}
