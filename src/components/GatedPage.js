import React from 'react';

export function GatedPage(feature, pricePage) {
  const el = document.createElement('div');
  el.className = 'w-full h-full flex items-center justify-center p-8';
  el.innerHTML = `
    <div class="max-w-md w-full text-center space-y-6">
      <div class="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
        <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>
      <h2 class="text-2xl font-bold text-white">Upgrade to Access ${feature}</h2>
      <p class="text-gray-400">This feature requires a one-time purchase. Upgrade now to unlock ${feature} and start creating viral videos.</p>
      <a href="${pricePage}" class="inline-block px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors">
        Upgrade Now
      </a>
    </div>
  `;
  return el;
}
