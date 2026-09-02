import { muapi } from '../../lib/muapi.js';
import { apiKeyManager } from '../../lib/apiKeyManager.js';
import { mountStudioChrome } from '../../lib/studioChrome.js';
import { showToast } from '../../lib/loading.js';

export function ProductPhotoStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'studios/product-photo-studio' });

  const header = document.createElement('div');
  header.className = 'mb-8';
  header.innerHTML = `
    <h1 class="text-3xl font-bold text-white mb-2">AI Product Photography Studio</h1>
    <p class="text-white/60 max-w-2xl">
      Generate professional product photos for e-commerce stores. Upload a reference image,
      select your background, and let AI handle the rest.
    </p>
  `;
  container.appendChild(header);

  const card = document.createElement('div');
  card.className = 'rounded-2xl border border-white/10 bg-white/[0.03] p-6 w-full max-w-3xl';
  card.innerHTML = `
    <p class="text-sm font-semibold text-white mb-3">About this studio</p>
    <p class="text-sm text-white/70 leading-relaxed">
      This studio is in active development. Coming soon: product photo generation,
      background removal, batch processing, and multi-angle shot generation.
    </p>
  `;
  container.appendChild(card);

  return container;
}
