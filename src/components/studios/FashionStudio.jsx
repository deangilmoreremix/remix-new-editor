import { muapi } from '../../lib/muapi.js';
import { apiKeyManager } from '../../lib/apiKeyManager.js';
import { mountStudioChrome } from '../../lib/studioChrome.js';
import { showToast } from '../../lib/loading.js';

export function FashionStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'studios/fashion-studio' });

  const header = document.createElement('div');
  header.className = 'mb-8';
  header.innerHTML = `
    <h1 class="text-3xl font-bold text-white mb-2">AI Fashion Studio</h1>
    <p class="text-white/60 max-w-2xl">
      Generate fashion lookbooks, virtual try-ons, and garment collections with AI.
      Perfect for e-commerce stores and fashion brands.
    </p>
  `;
  container.appendChild(header);

  const card = document.createElement('div');
  card.className = 'rounded-2xl border border-white/10 bg-white/[0.03] p-6 w-full max-w-3xl';
  card.innerHTML = `
    <p class="text-sm font-semibold text-white mb-3">About this studio</p>
    <p class="text-sm text-white/70 leading-relaxed">
      This studio is in active development. Coming soon: garment try-on, virtual models,
      lookbook generation, and size consistency optimization.
    </p>
  `;
  container.appendChild(card);

  return container;
}
