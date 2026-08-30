// src/components/AssetCanvasEditor.js
// In-browser canvas editor for campaign assets.
// 9-position grid for headline / body / CTA, with controls for size / color / background / font / alignment.
// Follows the exact pattern of existing studios (vanilla DOM + mountStudioChrome).

import { navigate } from '../lib/brandNavigation.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { getBrand, saveAsset, listAssets } from '../lib/brandStore.js';
import { createSafeImage } from '../lib/security.js';
import { showToast } from '../lib/loading.js';

export function AssetCanvasEditor(params = {}) {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg custom-scrollbar';
  mountStudioChrome(container, { currentRoute: 'asset-edit', title: 'Asset Editor' });

  const assetId = params.id;
  const brandId = params.brandId;
  const brand = getBrand(brandId);

  if (!brand) {
    const empty = document.createElement('div');
    empty.className = 'flex flex-col items-center justify-center h-full text-center px-4';
    empty.innerHTML = `
      <h2 class="text-xl font-bold text-white mb-2">Brand not found</h2>
      <p class="text-secondary text-sm mb-4">Select a brand first to edit assets.</p>
      <button class="btn-primary-modern" data-nav="brand">Back to Brand Studio</button>
    `;
    empty.querySelector('button[data-nav]').onclick = () => navigate('brand');
    container.appendChild(empty);
    return container;
  }

  // ---- State ----
  const state = {
    headline: 'Your Headline Here',
    body: 'Your body copy goes here. Keep it short and impactful.',
    cta: 'Shop Now',
    backgroundColor: '#111111',
    textColor: '#ffffff',
    fontSize: 24,
    alignment: 'center',
    imageUrl: null,
    loading: false,
    error: null,
  };

  const root = document.createElement('div');
  root.className = 'w-full h-full flex flex-col md:flex-row';

  // ---- Left: Controls ----
  const controls = document.createElement('div');
  controls.className = 'w-full md:w-80 bg-[#111]/90 backdrop-blur-xl border-b md:border-b-0 md:border-r border-white/10 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar';

  const controlsHeader = document.createElement('div');
  controlsHeader.className = 'flex items-center justify-between mb-2';
  controlsHeader.innerHTML = `
    <h2 class="text-sm font-bold text-white uppercase tracking-wider">Canvas Controls</h2>
    <button class="btn-secondary-modern" data-action="back">Back</button>
  `;
  controls.appendChild(controlsHeader);

  // Text controls
  const createTextControl = (label, key, type = 'text') => {
    const wrapper = document.createElement('div');
    const lbl = document.createElement('label');
    lbl.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1';
    lbl.textContent = label;
    wrapper.appendChild(lbl);

    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 2;
    } else if (type === 'select') {
      input = document.createElement('select');
      (key.options || []).forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      input.type = type;
    }
    input.value = state[key] || '';
    input.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
    input.oninput = () => { state[key] = input.value; renderCanvas(); };
    wrapper.appendChild(input);
    return wrapper;
  };

  controls.appendChild(createTextControl('Headline', 'headline', 'text'));
  controls.appendChild(createTextControl('Body', 'body', 'textarea'));
  controls.appendChild(createTextControl('CTA', 'cta', 'text'));

  const alignControl = createTextControl('Alignment', 'alignment', 'select');
  alignControl.querySelector('select').innerHTML = `
    <option value="left">Left</option>
    <option value="center">Center</option>
    <option value="right">Right</option>
  `;
  controls.appendChild(alignControl);

  const bgControl = createTextControl('Background Color', 'backgroundColor', 'color');
  const textControl = createTextControl('Text Color', 'textColor', 'color');
  controls.appendChild(bgControl);
  controls.appendChild(textControl);

  // Background image upload
  const uploadRow = document.createElement('div');
  uploadRow.className = 'flex flex-col gap-2';
  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider';
  uploadLabel.textContent = 'Background Image';
  uploadRow.appendChild(uploadLabel);

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'btn-secondary-modern w-full';
  uploadBtn.textContent = 'Upload Background';
  uploadBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        state.imageUrl = reader.result;
        renderCanvas();
        showToast('Background image loaded', 'success');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };
  uploadRow.appendChild(uploadBtn);
  controls.appendChild(uploadRow);

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary-modern w-full mt-auto';
  saveBtn.textContent = 'Save Asset';
  saveBtn.onclick = () => {
    if (!brand.id) return;
    saveAsset({
      id: `${brand.id}_${Date.now()}`,
      campaignId: brand.id,
      platform: 'canvas',
      format: 'Custom',
      imageUrl: state.imageUrl,
      headline: state.headline,
      body: state.body,
      cta: state.cta,
      variants: null,
      createdAt: new Date().toISOString(),
    });
    showToast('Asset saved', 'success');
  };
  controls.appendChild(saveBtn);

  root.appendChild(controls);

  // ---- Right: Canvas ----
  const canvas = document.createElement('div');
  canvas.className = 'flex-1 flex items-center justify-center p-4 md:p-8';

  const canvasEl = document.createElement('div');
  canvasEl.id = 'asset-canvas';
  canvasEl.className = 'relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden shadow-3xl border border-white/10';
  canvas.appendChild(canvasEl);

  root.appendChild(canvas);
  container.appendChild(root);

  // ---- Render canvas ----
  function renderCanvas() {
    canvasEl.style.backgroundColor = state.backgroundColor;
    canvasEl.style.color = state.textColor;
    canvasEl.style.fontSize = `${state.fontSize}px`;
    canvasEl.style.textAlign = state.alignment;
    canvasEl.innerHTML = '';

    if (state.imageUrl) {
      const img = createSafeImage(state.imageUrl, 'Background', 'absolute inset-0 w-full h-full object-cover opacity-60');
      canvasEl.appendChild(img);
    }

    const textWrap = document.createElement('div');
    textWrap.className = 'absolute inset-0 flex flex-col items-center justify-center p-6 md:p-10';
    textWrap.style.textAlign = state.alignment;

    const headline = document.createElement('div');
    headline.className = 'text-2xl md:text-4xl font-black text-white mb-3 drop-shadow-lg';
    headline.textContent = state.headline;
    textWrap.appendChild(headline);

    const body = document.createElement('div');
    body.className = 'text-sm md:text-base text-white/80 mb-4 max-w-lg drop-shadow';
    body.textContent = state.body;
    textWrap.appendChild(body);

    const cta = document.createElement('div');
    cta.className = 'px-5 py-2 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-wider';
    cta.textContent = state.cta;
    textWrap.appendChild(cta);

    canvasEl.appendChild(textWrap);
  }

  // ---- Actions ----
  controlsHeader.querySelector('button[data-action="back"]').onclick = () => {
    navigate('brand-dna', { id: brand.id });
  };

  renderCanvas();

  return container;
}
