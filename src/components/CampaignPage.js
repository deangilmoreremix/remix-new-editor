// src/components/CampaignPage.js
// Campaign detail page — shows concepts and generated assets for a saved campaign.

import { navigate } from '../lib/brandNavigation.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { getCampaign, listAssets, getBrand } from '../lib/brandStore.js';
import { createSafeImage } from '../lib/security.js';

export function CampaignPage(params = {}) {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg custom-scrollbar';
  mountStudioChrome(container, { currentRoute: 'campaign-page', title: 'Campaign Page' });

  const campaignId = params.campaignId;
  const campaign = getCampaign(campaignId);
  const brand = campaign ? getBrand(campaign.brandId) : null;

  if (!campaign) {
    const empty = document.createElement('div');
    empty.className = 'flex flex-col items-center justify-center h-full text-center px-4';
    empty.innerHTML = `
      <h2 class="text-xl font-bold text-white mb-2">Campaign not found</h2>
      <p class="text-secondary text-sm mb-4">The campaign you are looking for does not exist.</p>
      <button class="btn-primary-modern" data-nav="brand">Back to Brand Studio</button>
    `;
    empty.querySelector('button[data-nav]').onclick = () => navigate('brand');
    container.appendChild(empty);
    return container;
  }

  const root = document.createElement('div');
  root.className = 'w-full max-w-3xl mx-auto px-4 py-8 animate-fade-in-up';

  const header = document.createElement('div');
  header.className = 'flex items-center gap-3 mb-6';
  header.innerHTML = `
    <div class="flex-1">
      <h1 class="text-2xl md:text-3xl font-black text-white tracking-tight">Campaign</h1>
      <p class="text-secondary text-sm mt-1">${brand?.brandName || 'Unknown Brand'} · ${campaign.goal || 'No goal set'}</p>
    </div>
    <button class="btn-secondary-modern" data-action="back">Back to Brand</button>
  `;
  root.appendChild(header);

  const infoSection = document.createElement('div');
  infoSection.className = 'mb-8';
  infoSection.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div class="text-xs font-bold text-secondary uppercase tracking-wider mb-1">Goal</div>
        <div class="text-sm text-white">${campaign.goal || '—'}</div>
      </div>
      <div class="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <div class="text-xs font-bold text-secondary uppercase tracking-wider mb-1">Created</div>
        <div class="text-sm text-white">${campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : new Date(campaign.updatedAt).toLocaleDateString()}</div>
      </div>
    </div>
    ${campaign.direction ? `
    <div class="mt-4 bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-4">
      <div class="text-xs font-bold text-secondary uppercase tracking-wider mb-1">Direction</div>
      <div class="text-sm text-white">${campaign.direction}</div>
    </div>
    ` : ''}
  `;
  root.appendChild(infoSection);

  const conceptsSection = document.createElement('div');
  conceptsSection.className = 'mb-8';
  const concepts = Array.isArray(campaign.concepts) ? campaign.concepts : [];

  if (concepts.length > 0) {
    const conceptsHeader = document.createElement('div');
    conceptsHeader.className = 'mb-4';
    conceptsHeader.innerHTML = `
      <h2 class="text-lg font-bold text-white">Concepts</h2>
      <p class="text-xs text-muted mt-1">${concepts.length} on-brand concepts generated for this campaign.</p>
    `;
    conceptsSection.appendChild(conceptsHeader);

    const conceptGrid = document.createElement('div');
    conceptGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4';
    concepts.forEach((concept, idx) => {
      const card = document.createElement('div');
      card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-5';
      card.innerHTML = `
        <div class="text-sm font-bold text-white mb-1">Concept ${idx + 1}</div>
        <div class="text-sm font-bold text-white mb-1">${concept.headline || ''}</div>
        <div class="text-xs text-secondary mb-2">${concept.body || ''}</div>
        ${concept.cta ? `<div class="text-[10px] text-primary font-bold uppercase tracking-wider mb-2">${concept.cta}</div>` : ''}
        <div class="text-[10px] text-muted uppercase tracking-wider mb-1">Rationale</div>
        <div class="text-xs text-secondary">${concept.rationale || ''}</div>
      `;
      conceptGrid.appendChild(card);
    });
    conceptsSection.appendChild(conceptGrid);
  }
  root.appendChild(conceptsSection);

  const assetsSection = document.createElement('div');
  assetsSection.className = 'mb-8';
  const assets = listAssets(campaignId);

  const assetsHeader = document.createElement('div');
  assetsHeader.className = 'flex items-center justify-between mb-4';
  assetsHeader.innerHTML = `
    <div>
      <h2 class="text-lg font-bold text-white">Assets</h2>
      <p class="text-xs text-muted mt-1">${assets.length} generated assets for this campaign.</p>
    </div>
    <button class="btn-primary-modern" data-action="generate-assets">Generate Assets</button>
  `;
  assetsSection.appendChild(assetsHeader);

  const assetGrid = document.createElement('div');
  assetGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4';
  if (assets.length === 0) {
    assetGrid.innerHTML = '<div class="text-sm text-secondary col-span-full">No assets generated yet.</div>';
  } else {
    assets.forEach(asset => {
      const card = document.createElement('div');
      card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden';
      if (asset.imageUrl) {
        const img = createSafeImage(asset.imageUrl, asset.format, 'w-full h-40 object-cover');
        card.appendChild(img);
      }
      const body = document.createElement('div');
      body.className = 'p-4';
      body.innerHTML = `
        <div class="text-xs font-bold text-white mb-1">${asset.platform || 'Asset'}</div>
        <div class="text-xs text-secondary mb-2">${asset.format || ''}</div>
        ${asset.headline ? `<div class="text-xs text-white font-bold mb-1">${asset.headline}</div>` : ''}
        ${asset.body ? `<div class="text-xs text-secondary mb-2">${asset.body}</div>` : ''}
        ${asset.cta ? `<div class="text-[10px] text-primary font-bold uppercase tracking-wider">${asset.cta}</div>` : ''}
      `;
      card.appendChild(body);
      assetGrid.appendChild(card);
    });
  }
  assetsSection.appendChild(assetGrid);
  root.appendChild(assetsSection);

  container.appendChild(root);

  header.querySelector('button[data-action="back"]').onclick = () => {
    navigate('brand-dna', { id: campaign.brandId });
  };

  assetsHeader.querySelector('button[data-action="generate-assets"]').onclick = () => {
    navigate('campaign', { brandId: campaign.brandId });
  };

  return container;
}
