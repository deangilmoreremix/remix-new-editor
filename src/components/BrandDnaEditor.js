// src/components/BrandDnaEditor.js
// Editable Brand DNA review — port of Open-Pomelli's DnaEditor.
// Follows the existing studio pattern with mountStudioChrome + vanilla DOM.
// Uses repo's shared button classes: .btn-primary-modern, .btn-secondary-modern.

import { navigate } from '../lib/brandNavigation.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { getBrand, saveBrand } from '../lib/brandStore.js';
import { createSafeImage } from '../lib/security.js';

export function BrandDnaEditor(params = {}) {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg custom-scrollbar';
  mountStudioChrome(container, { currentRoute: 'brand-dna', title: 'Brand DNA' });

  const brandId = params.id;
  const brand = getBrand(brandId);

  if (!brand) {
    const empty = document.createElement('div');
    empty.className = 'flex flex-col items-center justify-center h-full text-center px-4';
    empty.innerHTML = `
      <h2 class="text-xl font-bold text-white mb-2">Brand not found</h2>
      <p class="text-secondary text-sm mb-4">The brand you are looking for does not exist.</p>
      <button class="btn-primary-modern" data-nav="brand">Back to Brand Studio</button>
    `;
    empty.querySelector('button[data-nav]').onclick = () => navigate('brand');
    container.appendChild(empty);
    return container;
  }

  // ---- State ----
  const state = {
    brandName: brand.brandName || '',
    industry: brand.industry || '',
    tagline: brand.tagline || '',
    valueProposition: brand.valueProposition || '',
    targetAudience: brand.targetAudience || '',
    imageryStyle: brand.imageryStyle || 'modern',
    layoutStyle: brand.layoutStyle || 'modern',
    toneOfVoice: Array.isArray(brand.toneOfVoice) ? [...brand.toneOfVoice] : [],
    brandPersonality: Array.isArray(brand.brandPersonality) ? [...brand.brandPersonality] : [],
    keyMessages: Array.isArray(brand.keyMessages) ? [...brand.keyMessages] : [],
    fonts: Array.isArray(brand.fonts) ? [...brand.fonts] : [],
    primaryColors: Array.isArray(brand.primaryColors) ? [...brand.primaryColors] : [],
    secondaryColors: Array.isArray(brand.secondaryColors) ? [...brand.secondaryColors] : [],
    logoUrl: brand.logoUrl,
    screenshotUrl: brand.screenshotUrl,
  };

  const root = document.createElement('div');
  root.className = 'w-full max-w-3xl mx-auto px-4 py-8 animate-fade-in-up';

  // ---- Header ----
  const header = document.createElement('div');
  header.className = 'flex items-start gap-4 mb-8';
  header.innerHTML = `
    <div class="flex-1">
      <h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">${state.brandName || 'Untitled Brand'}</h1>
      <p class="text-secondary text-sm">${state.industry || 'No industry set'}</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn-secondary-modern" data-action="campaigns">Campaigns</button>
      <button class="btn-secondary-modern" data-action="asset-edit">Asset Editor</button>
      <button class="btn-secondary-modern" data-action="photo-studio">Photo Studio</button>
      <button class="btn-secondary-modern" data-action="brand-photo-studio">Photo Studio</button>
      <button class="btn-secondary-modern" data-action="animate">Animate</button>
      <button class="btn-primary-modern" data-action="save">Save</button>
    </div>
  `;
  root.appendChild(header);

  // ---- Screenshot / Logo ----
  const media = document.createElement('div');
  media.className = 'flex gap-4 mb-8';
  if (state.screenshotUrl) {
    const img = createSafeImage(state.screenshotUrl, 'Website screenshot', 'w-full max-w-md rounded-2xl border border-white/10');
    media.appendChild(img);
  }
  if (state.logoUrl) {
    const logo = createSafeImage(state.logoUrl, 'Brand logo', 'w-24 h-24 rounded-xl border border-white/10 object-contain bg-white/5');
    media.appendChild(logo);
  }
  root.appendChild(media);

  // ---- Editable Fields ----
  const fields = [
    { key: 'brandName', label: 'Brand Name', type: 'text' },
    { key: 'industry', label: 'Industry', type: 'text' },
    { key: 'tagline', label: 'Tagline', type: 'text' },
    { key: 'valueProposition', label: 'Value Proposition', type: 'textarea' },
    { key: 'targetAudience', label: 'Target Audience', type: 'textarea' },
    { key: 'imageryStyle', label: 'Imagery Style', type: 'text' },
    { key: 'layoutStyle', label: 'Layout Style', type: 'text' },
  ];

  const form = document.createElement('div');
  form.className = 'flex flex-col gap-4 mb-8';

  fields.forEach(({ key, label, type }) => {
    const wrapper = document.createElement('div');
    const lbl = document.createElement('label');
    lbl.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-1';
    lbl.textContent = label;
    wrapper.appendChild(lbl);

    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }
    input.value = state[key] || '';
    // Exact input pattern used across studios
    input.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
    input.oninput = () => { state[key] = input.value; };
    wrapper.appendChild(input);
    form.appendChild(wrapper);
  });

  root.appendChild(form);

  // ---- Chips (tone, personality, messages) ----
  const chipSection = document.createElement('div');
  chipSection.className = 'mb-8';

  const createChipEditor = (label, items, onUpdate) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-4';
    const lbl = document.createElement('label');
    lbl.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-2';
    lbl.textContent = label;
    wrapper.appendChild(lbl);

    const list = document.createElement('div');
    list.className = 'flex flex-wrap gap-2 mb-2';
    const render = () => {
      list.innerHTML = '';
      items.forEach((item, idx) => {
        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center gap-1 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white';
        chip.textContent = item;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.className = 'text-white/50 hover:text-white';
        remove.onclick = () => {
          items.splice(idx, 1);
          render();
          onUpdate(items);
        };
        chip.appendChild(remove);
        list.appendChild(chip);
      });
    };
    render();
    wrapper.appendChild(list);

    const addRow = document.createElement('div');
    addRow.className = 'flex gap-2';
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = `Add ${label.toLowerCase()}...`;
    addInput.className = 'flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add';
    // Secondary action button
    addBtn.className = 'btn-secondary-modern';
    addBtn.onclick = () => {
      const val = addInput.value.trim();
      if (val) {
        items.push(val);
        addInput.value = '';
        render();
        onUpdate(items);
      }
    };
    addInput.onkeydown = (e) => { if (e.key === 'Enter') addBtn.click(); };
    addRow.appendChild(addInput);
    addRow.appendChild(addBtn);
    wrapper.appendChild(addRow);

    return wrapper;
  };

  chipSection.appendChild(createChipEditor('Tone of Voice', state.toneOfVoice, (v) => { state.toneOfVoice = v; }));
  chipSection.appendChild(createChipEditor('Brand Personality', state.brandPersonality, (v) => { state.brandPersonality = v; }));
  chipSection.appendChild(createChipEditor('Key Messages', state.keyMessages, (v) => { state.keyMessages = v; }));
  root.appendChild(chipSection);

  // ---- Color Pickers ----
  const colorSection = document.createElement('div');
  colorSection.className = 'mb-8';
  const colorLabel = document.createElement('label');
  colorLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-2';
  colorLabel.textContent = 'Colors';
  colorSection.appendChild(colorLabel);

  const colorRow = document.createElement('div');
  colorRow.className = 'flex flex-wrap gap-4';

  const createColorPicker = (label, colors, onUpdate) => {
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-col gap-1';
    const lbl = document.createElement('span');
    lbl.className = 'text-[10px] text-muted uppercase';
    lbl.textContent = label;
    wrap.appendChild(lbl);
    const input = document.createElement('input');
    input.type = 'color';
    input.value = colors[0] || '#000000';
    input.className = 'w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent';
    input.oninput = () => {
      colors[0] = input.value;
      onUpdate(colors);
    };
    wrap.appendChild(input);
    return wrap;
  };

  colorRow.appendChild(createColorPicker('Primary', state.primaryColors, (v) => { state.primaryColors = v; }));
  colorRow.appendChild(createColorPicker('Secondary', state.secondaryColors, (v) => { state.secondaryColors = v; }));
  colorSection.appendChild(colorRow);
  root.appendChild(colorSection);

  container.appendChild(root);

  // ---- Actions ----
  header.querySelector('button[data-action="save"]').onclick = () => {
    const updated = saveBrand({
      ...brand,
      brandName: state.brandName,
      industry: state.industry,
      tagline: state.tagline,
      valueProposition: state.valueProposition,
      targetAudience: state.targetAudience,
      imageryStyle: state.imageryStyle,
      layoutStyle: state.layoutStyle,
      toneOfVoice: state.toneOfVoice,
      brandPersonality: state.brandPersonality,
      keyMessages: state.keyMessages,
      primaryColors: state.primaryColors,
      secondaryColors: state.secondaryColors,
      fonts: state.fonts,
      logoUrl: state.logoUrl,
      screenshotUrl: state.screenshotUrl,
    });
    const btn = header.querySelector('button[data-action="save"]');
    const original = btn.textContent;
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  };

  header.querySelector('button[data-action="campaigns"]').onclick = () => {
    navigate('campaign', { brandId: state.id || brand.id });
  };

  header.querySelector('button[data-action="asset-edit"]').onclick = () => {
    navigate('asset-edit', { brandId: state.id || brand.id });
  };

  header.querySelector('button[data-action="photo-studio"]').onclick = () => {
    navigate('photo-studio', { brandId: state.id || brand.id });
  };

  header.querySelector('button[data-action="animate"]').onclick = () => {
    navigate('animate', { brandId: state.id || brand.id });
  };

  header.querySelector('button[data-action="brand-photo-studio"]').onclick = () => {
    navigate('brand-photo-studio', { brandId: state.id || brand.id });
  };

  return container;
}
