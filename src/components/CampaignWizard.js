// src/components/CampaignWizard.js
// Campaign Studio — goal picker → concept generation → platform-specific assets.
// Follows the exact pattern of existing studios (vanilla DOM + mountStudioChrome).

import { navigate } from '../lib/brandNavigation.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { getBrand, saveBrand, saveCampaign, saveAsset } from '../lib/brandStore.js';
import { CAMPAIGN_GOALS } from '../lib/campaignGenerator.js';
import { PLATFORMS } from '../lib/platforms.js';
import { createSafeImage } from '../lib/security.js';
import { showToast, createLoadingOverlay } from '../lib/loading.js';
import { apiCall } from '../lib/brandApi.js';

const CONCURRENCY = 3;

export function CampaignWizard(params = {}) {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg custom-scrollbar';
  mountStudioChrome(container, { currentRoute: 'campaign', title: 'Campaign Studio' });

  const brandId = params.brandId;
  const brand = getBrand(brandId);

  if (!brand) {
    const empty = document.createElement('div');
    empty.className = 'flex flex-col items-center justify-center h-full text-center px-4';
    empty.innerHTML = `
      <h2 class="text-xl font-bold text-white mb-2">Brand not found</h2>
      <p class="text-secondary text-sm mb-4">Select a brand first to create a campaign.</p>
      <button class="btn-primary-modern" data-nav="brand">Back to Brand Studio</button>
    `;
    empty.querySelector('button[data-nav]').onclick = () => navigate('brand');
    container.appendChild(empty);
    return container;
  }

  // ---- State ----
  const state = {
    step: 'goal',
    goal: '',
    direction: '',
    concepts: [],
    selectedConcept: null,
    selectedPlatforms: [],
    assets: [],
    assetStatus: {},
    loading: false,
    error: null,
  };

  const root = document.createElement('div');
  root.className = 'w-full max-w-3xl mx-auto px-4 py-8 animate-fade-in-up';

  // ---- Header ----
  const header = document.createElement('div');
  header.className = 'flex items-center gap-3 mb-6';
  header.innerHTML = `
    <div class="flex-1">
      <h1 class="text-2xl md:text-3xl font-black text-white tracking-tight">Campaign Studio</h1>
      <p class="text-secondary text-sm mt-1">${brand.brandName || 'Untitled Brand'} · ${brand.industry || 'General'}</p>
    </div>
    <button class="btn-secondary-modern" data-action="back">Back to Brand</button>
  `;
  root.appendChild(header);

  // ---- Step: Goal Picker ----
  const goalSection = document.createElement('div');
  goalSection.className = 'mb-8';

  const goalLabel = document.createElement('label');
  goalLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-3';
  goalLabel.textContent = 'Campaign Goal';
  goalSection.appendChild(goalLabel);

  const goalGrid = document.createElement('div');
  goalGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4';

  CAMPAIGN_GOALS.forEach(g => {
    const card = document.createElement('div');
    card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all';
    card.innerHTML = `
      <div class="text-sm font-bold text-white">${g.label}</div>
    `;
    card.onclick = () => {
      state.goal = g.value;
      state.step = 'concepts';
      render();
    };
    goalGrid.appendChild(card);
  });

  goalSection.appendChild(goalGrid);

  const directionRow = document.createElement('div');
  directionRow.className = 'flex gap-2';
  const directionInput = document.createElement('input');
  directionInput.type = 'text';
  directionInput.placeholder = 'Optional direction or theme...';
  directionInput.className = 'flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
  directionInput.oninput = () => { state.direction = directionInput.value; };
  directionRow.appendChild(directionInput);
  goalSection.appendChild(directionRow);

  root.appendChild(goalSection);

  // ---- Step: Concepts ----
  const conceptSection = document.createElement('div');
  conceptSection.className = 'mb-8';

  const conceptHeader = document.createElement('div');
  conceptHeader.className = 'flex items-center justify-between mb-4';
  conceptHeader.innerHTML = `
    <div>
      <h2 class="text-lg font-bold text-white">Concepts</h2>
      <p class="text-xs text-muted mt-1">4 on-brand concepts generated for your goal.</p>
    </div>
    <button class="btn-primary-modern" data-action="generate-concepts">Generate Concepts</button>
  `;
  conceptSection.appendChild(conceptHeader);

  const conceptList = document.createElement('div');
  conceptList.className = 'flex flex-col gap-3';
  conceptSection.appendChild(conceptList);

  root.appendChild(conceptSection);

  // ---- Step: Assets ----
  const assetSection = document.createElement('div');
  assetSection.className = 'mb-8';

  const assetHeader = document.createElement('div');
  assetHeader.className = 'flex items-center justify-between mb-4';
  assetHeader.innerHTML = `
    <div>
      <h2 class="text-lg font-bold text-white">Assets</h2>
      <p class="text-xs text-muted mt-1">Platform-specific creatives for the selected concept.</p>
    </div>
    <button class="btn-primary-modern" data-action="generate-assets">Generate Assets</button>
  `;
  assetSection.appendChild(assetHeader);

  const platformRow = document.createElement('div');
  platformRow.className = 'flex flex-wrap gap-2 mb-4';
  assetSection.appendChild(platformRow);

  const assetStatusRow = document.createElement('div');
  assetStatusRow.className = 'flex flex-col gap-2 mb-4';
  assetSection.appendChild(assetStatusRow);

  const assetGrid = document.createElement('div');
  assetGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3';
  assetSection.appendChild(assetGrid);

  root.appendChild(assetSection);

  container.appendChild(root);

  // ---- Actions ----
  header.querySelector('button[data-action="back"]').onclick = () => {
    navigate('brand-dna', { id: brand.id });
  };

  conceptHeader.querySelector('button[data-action="generate-concepts"]').onclick = async () => {
    if (!state.goal) return;
    state.loading = true;
    state.error = null;
    conceptHeader.querySelector('button[data-action="generate-concepts"]').disabled = true;
    conceptHeader.querySelector('button[data-action="generate-concepts"]').textContent = 'Generating…';

    const overlay = createLoadingOverlay('Generating campaign concepts...');
    container.appendChild(overlay);

    try {
      const campaign = await apiCall('/api/campaign/create', {
        brandId: brand.id,
        goal: state.goal,
        prompt: state.direction || null,
        brand,
      });
      const concepts = typeof campaign.concepts === 'string' ? JSON.parse(campaign.concepts) : (campaign.concepts || []);
      state.concepts = concepts;
      state.campaignId = campaign.id;
      renderConcepts();
    } catch (err) {
      state.error = String(err);
      showToast(state.error, 'error');
    } finally {
      state.loading = false;
      conceptHeader.querySelector('button[data-action="generate-concepts"]').disabled = false;
      conceptHeader.querySelector('button[data-action="generate-concepts"]').textContent = 'Generate Concepts';
      overlay.remove();
    }
  };

  assetHeader.querySelector('button[data-action="generate-assets"]').onclick = async () => {
    if (!state.selectedConcept || state.selectedPlatforms.length === 0) return;
    state.loading = true;
    state.error = null;
    state.assetStatus = {};
    assetHeader.querySelector('button[data-action="generate-assets"]').disabled = true;
    assetHeader.querySelector('button[data-action="generate-assets"]').textContent = 'Generating…';

    const overlay = createLoadingOverlay('Generating platform assets...');
    container.appendChild(overlay);
    renderAssetStatus();

    try {
      const queue = [...state.selectedPlatforms];
      const results = [];
      const errors = [];

      while (queue.length > 0) {
        const batch = queue.splice(0, CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(async (platform) => {
            const platformMeta = PLATFORMS.find(p => p.id === platform) || PLATFORMS[0];
            state.assetStatus[platform] = { status: 'running', label: platformMeta.label };
            renderAssetStatus();

            try {
              const asset = await apiCall('/api/asset/generate', {
                campaignId: state.campaignId || brand.id,
                conceptIndex: state.selectedConcept.index !== undefined ? state.selectedConcept.index : 0,
                platformId: platform,
                brand,
                concept: state.selectedConcept,
              });
              state.assetStatus[platform] = { status: 'done', label: platformMeta.label };
              renderAssetStatus();
              return asset;
            } catch (err) {
              state.assetStatus[platform] = { status: 'error', label: platformMeta.label, error: String(err) };
              renderAssetStatus();
              throw err;
            }
          })
        );

        for (const r of batchResults) {
          if (r.status === 'fulfilled') {
            results.push(r.value);
          } else {
            errors.push(r.reason);
          }
        }
      }

      state.assets = results;
      renderAssets();

      if (errors.length > 0) {
        showToast(`${errors.length} platform(s) failed`, 'error');
      }
      if (results.length > 0) {
        showToast(`Generated ${results.length} assets`, 'success');
      }
    } catch (err) {
      state.error = String(err);
      showToast(state.error, 'error');
    } finally {
      state.loading = false;
      assetHeader.querySelector('button[data-action="generate-assets"]').disabled = false;
      assetHeader.querySelector('button[data-action="generate-assets"]').textContent = 'Generate Assets';
      overlay.remove();
    }
  };

  function renderConcepts() {
    conceptList.innerHTML = '';
    state.concepts.forEach((concept, idx) => {
      const card = document.createElement('div');
      card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-5 cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all';
      card.innerHTML = `
        <div class="flex items-start justify-between mb-2">
          <div class="text-sm font-bold text-white">${concept.title || `Concept ${idx + 1}`}</div>
          <button class="text-[10px] font-bold text-primary uppercase tracking-wider" data-action="select-concept" data-index="${idx}">Select</button>
        </div>
        <div class="text-xs text-secondary mb-2">${concept.key_message || concept.body || ''}</div>
        <div class="text-[10px] text-muted uppercase tracking-wider mb-2">CTA</div>
        <div class="text-xs text-white mb-3">${concept.cta || ''}</div>
        <div class="text-[10px] text-muted uppercase tracking-wider mb-1">Tone Notes</div>
        <div class="text-xs text-secondary">${concept.tone_notes || concept.rationale || ''}</div>
      `;
      conceptList.appendChild(card);
    });

    conceptList.querySelectorAll('button[data-action="select-concept"]').forEach(btn => {
      btn.onclick = () => {
        const index = parseInt(btn.dataset.index, 10);
        state.selectedConcept = { ...state.concepts[index], index };
        state.step = 'assets';
        renderPlatforms();
      };
    });
  }

  function renderPlatforms() {
    platformRow.innerHTML = '';
    state.selectedPlatforms = [];
    PLATFORMS.forEach(p => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-white/10 transition-colors';
      chip.textContent = p.label;
      chip.onclick = () => {
        const idx = state.selectedPlatforms.indexOf(p.id);
        if (idx >= 0) {
          state.selectedPlatforms.splice(idx, 1);
          chip.classList.remove('bg-primary', 'text-black', 'border-primary');
          chip.classList.add('bg-white/5', 'text-white', 'border-white/10');
        } else {
          state.selectedPlatforms.push(p.id);
          chip.classList.remove('bg-white/5', 'text-white', 'border-white/10');
          chip.classList.add('bg-primary', 'text-black', 'border-primary');
        }
      };
      platformRow.appendChild(chip);
    });
  }

  function renderAssetStatus() {
    assetStatusRow.innerHTML = '';
    Object.entries(state.assetStatus).forEach(([platformId, status]) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 text-xs';
      const statusColors = { running: 'text-yellow-400', done: 'text-green-400', error: 'text-red-400', queued: 'text-muted' };
      const statusIcons = { running: '⏳', done: '✅', error: '❌', queued: '○' };
      row.innerHTML = `
        <span class="font-bold text-white w-32">${status.label}</span>
        <span class="${statusColors[status.status] || 'text-muted'}">${statusIcons[status.status] || '○'} ${status.status}</span>
        ${status.error ? `<span class="text-red-400 truncate">${escapeHtml(status.error)}</span>` : ''}
      `;
      assetStatusRow.appendChild(row);
    });
  }

  function renderAssets() {
    assetGrid.innerHTML = '';
    state.assets.forEach(asset => {
      const card = document.createElement('div');
      card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden';

      if (asset.imageUrl) {
        const img = createSafeImage(asset.imageUrl, asset.format, 'w-full h-40 object-cover');
        card.appendChild(img);
      }

      const body = document.createElement('div');
      body.className = 'p-4';
      body.innerHTML = `
        <div class="text-xs font-bold text-white mb-1">${asset.platform}</div>
        <div class="text-xs text-secondary mb-2">${asset.format}</div>
        ${asset.headline ? `<div class="text-xs text-white font-bold mb-1">${escapeHtml(asset.headline)}</div>` : ''}
        ${asset.body ? `<div class="text-xs text-secondary mb-2">${escapeHtml(asset.body)}</div>` : ''}
        ${asset.cta ? `<div class="text-[10px] text-primary font-bold uppercase tracking-wider">${escapeHtml(asset.cta)}</div>` : ''}
      `;
      card.appendChild(body);
      assetGrid.appendChild(card);
    });
  }

  function render() {
    goalSection.style.display = state.step === 'goal' ? '' : 'none';
    conceptSection.style.display = state.step === 'concepts' || state.step === 'assets' ? '' : 'none';
    assetSection.style.display = state.step === 'assets' ? '' : 'none';
  }

  render();

  return container;
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
