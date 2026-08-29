// src/components/BrandStudio.js
// Brand Studio home — entry point for Open-Pomelli features.
// Can run standalone or embedded via iframe.

import { mountStudioChrome } from '../lib/studioChrome.js';
import { listBrands, saveBrand } from '../lib/brandStore.js';
import { createSafeImage } from '../lib/security.js';
import { apiCall } from '../lib/brandApi.js';
import { createLoadingOverlay } from '../lib/loading.js';
import { navigate, isIframeMode } from '../lib/brandNavigation.js';

export function BrandStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg custom-scrollbar';

  if (!isIframeMode()) {
    mountStudioChrome(container, { currentRoute: 'brand', title: 'Brand Studio' });
  }

  const state = {
    url: '',
    loading: false,
    error: null,
    brands: listBrands(),
  };

  const hero = document.createElement('div');
  hero.className = 'flex flex-col items-center text-center px-4 pt-12 pb-8 animate-fade-in-up';
  hero.innerHTML = `
    <h1 class="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">Brand Studio</h1>
    <p class="text-secondary text-sm md:text-base max-w-xl">
      Paste any website URL. We extract the brand DNA and generate on-brand campaigns — locally.
    </p>
  `;
  container.appendChild(hero);

  const form = document.createElement('form');
  form.className = 'w-full max-w-2xl px-4 mb-8 animate-fade-in-up';
  form.style.animationDelay = '0.1s';

  const inputRow = document.createElement('div');
  inputRow.className = 'flex gap-2';

  const input = document.createElement('input');
  input.type = 'url';
  input.required = true;
  input.placeholder = 'https://your-website.com';
  input.value = state.url;
  input.setAttribute('aria-label', 'Website URL');
  input.setAttribute('aria-describedby', 'url-error');
  input.className = 'flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
  input.oninput = () => { state.url = input.value; };

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Analyze';
  submitBtn.setAttribute('aria-label', 'Analyze website');
  submitBtn.className = 'btn-primary-modern';
  submitBtn.disabled = true;

  inputRow.appendChild(input);
  inputRow.appendChild(submitBtn);
  form.appendChild(inputRow);

  const errorEl = document.createElement('div');
  errorEl.className = 'mt-3 hidden';
  container.appendChild(errorEl);

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!state.url) return;

    let parsedUrl;
    try {
      parsedUrl = new URL(state.url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('URL must use http or https protocol');
      }
    } catch (err) {
      state.error = 'Please enter a valid website URL (e.g. https://example.com)';
      errorEl.textContent = state.error;
      errorEl.className = 'mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200';
      errorEl.id = 'url-error';
      return;
    }

    state.loading = true;
    state.error = null;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Extracting…';
    errorEl.classList.add('hidden');

    const overlay = createLoadingOverlay('Extracting brand DNA...');
    container.appendChild(overlay);

    try {
      const dna = await apiCall('/api/brand/extract', { url: state.url });
      const saved = saveBrand(dna);
      overlay.hide();
      navigate('brand-dna', { id: saved.id });
    } catch (err) {
      state.error = String(err);
      errorEl.textContent = state.error;
      errorEl.className = 'mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200';
      errorEl.id = 'url-error';
      overlay.hide();
      if (isIframeMode()) {
        postMessage({ type: 'error', error: String(err) });
      }
    } finally {
      state.loading = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Analyze';
    }
  };

  input.oninput = () => {
    state.url = input.value;
    submitBtn.disabled = !state.url;
  };

  container.appendChild(form);

  const recent = document.createElement('div');
  recent.className = 'w-full max-w-2xl px-4 mb-8';
  if (state.brands.length > 0) {
    const header = document.createElement('div');
    header.className = 'text-xs font-bold text-secondary uppercase tracking-wider mb-3';
    header.textContent = 'Recent Brands';
    recent.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 gap-3';
    state.brands.slice(0, 6).forEach((brand) => {
      const card = document.createElement('div');
      card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all';
      card.innerHTML = `
        <div class="text-sm font-bold text-white truncate">${brand.brandName || 'Untitled Brand'}</div>
        <div class="text-xs text-secondary truncate">${brand.industry || 'No industry'}</div>
      `;
      card.onclick = () => {
        navigate('brand-dna', { id: brand.id });
      };
      grid.appendChild(card);
    });
    recent.appendChild(grid);
  }
  container.appendChild(recent);

  if (isIframeMode()) {
    postMessage({ type: 'brand-studio-ready' });
  }

  return container;
}

function postMessage(data) {
  if (typeof window !== 'undefined' && window.parent !== window) {
    window.parent.postMessage({ source: 'brand-studio-iframe', ...data }, '*');
  }
}
