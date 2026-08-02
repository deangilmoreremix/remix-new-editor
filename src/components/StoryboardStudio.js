import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { openaiService } from '../lib/openaiService.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { showToast } from '../lib/loading.js';
import { t2iModels, getAspectRatiosForModel } from '../lib/models.js';
import { ENHANCE_TAGS, QUICK_PROMPTS } from '../lib/promptUtils.js';
import { createUploadPicker } from './UploadPicker.js';
import { createFullscreenPreview } from '../components/MediaPreview.js';
import Store from '../stores/base/Store.js';

const SHOT_TYPES = ['Wide Shot', 'Medium Shot', 'Close-Up', 'Extreme Close-Up', 'POV', 'Overhead', 'Low Angle'];

const SHOT_PRESETS = [
  { shot: 'Wide Shot', prompt: 'Cinematic establishing shot, wide angle, epic landscape, professional cinematography' },
  { shot: 'Medium Shot', prompt: 'Medium shot, character focused, natural lighting, professional composition' },
  { shot: 'Close-Up', prompt: 'Intimate close-up, detailed expression, shallow depth of field, dramatic lighting' },
  { shot: 'Extreme Close-Up', prompt: 'Extreme close-up detail shot, macro detail, shallow depth of field, cinematic' },
  { shot: 'POV', prompt: 'Point of view shot, first person perspective, immersive, cinematic' },
  { shot: 'Overhead', prompt: 'Overhead drone shot, bird\'s eye view, epic scale, cinematic' },
  { shot: 'Low Angle', prompt: 'Low angle shot, dramatic perspective, heroic composition, cinematic' },
];

const STYLE_OPTIONS = ['None', 'Photorealistic', 'Cinematic', 'Noir', 'Anime', 'Watercolor', 'Oil Painting', 'Cyberpunk', 'Fantasy', 'Documentary'];
const LIGHTING_OPTIONS = ['None', 'Golden Hour', 'Neon', 'Studio', 'Dramatic', 'Soft', 'Volumetric', 'High Key', 'Low Key'];
const COLOR_OPTIONS = ['None', 'Warm', 'Cool', 'Desaturated', 'Vibrant', 'Monochrome', 'Sepia', 'Teal & Orange'];

const LAYOUTS = [
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'grid', label: 'Grid' },
  { id: 'story', label: 'Story' },
];

// Image generation model/AR state (mirrors ImageStudio pattern)
const defaultModel = t2iModels[0];
let selectedModel = defaultModel.id;
let selectedModelName = defaultModel.name;
let selectedAr = defaultModel.inputs?.aspect_ratio?.default || '1:1';

// Enhancement state
let selectedStyle = 'None';
let selectedLighting = 'None';
let selectedColor = 'None';
let selectedPreset = null;
let frameNotes = '';
let revisedPrompt = '';
let referenceImages = [];
let generationProgress = { current: 0, total: 0, failed: [] };
let batchRetryCount = 0;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveOpenAISize(value) {
  if (!value || value === 'auto') return 'auto';
  const ratios = {
    '16:9': '1536x1024',
    '9:16': '1024x1536',
    '1:1': '1024x1024',
    '4:3': '1536x1024',
    '3:4': '1024x1536',
    '21:9': '2048x1152',
  };
  return ratios[value] || 'auto';
}

function withRetry(fn, retries = MAX_RETRIES, delay = RETRY_BASE_DELAY) {
  return (async () => {
    let lastErr;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const isTransient = err?.status === 429 || (err?.status >= 500 && err?.status < 600);
        if (!isTransient || i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
    throw lastErr;
  })();
}

const storyboardStore = new Store({
  frames: [],
  layout: 'horizontal',
  selectedModel: t2iModels[0]?.id,
  selectedModelName: t2iModels[0]?.name,
  selectedAr: t2iModels[0]?.inputs?.aspect_ratio?.default || '1:1',
  selectedStyle: 'None',
  selectedLighting: 'None',
  selectedColor: 'None',
  selectedPreset: null,
  generationProgress: { current: 0, total: 0, failed: [] },
});

export function StoryboardStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col bg-app-bg overflow-y-auto relative storyboard-studio';
  mountStudioChrome(container, { currentRoute: 'storyboard' });
  container.setAttribute('data-app', 'storyboard');

  const fullscreen = createFullscreenPreview();
  container.appendChild(fullscreen.element);

  const topBar = document.createElement('div');
  topBar.className = 'px-4 md:px-8 pt-6 pb-4 shrink-0';
  const storyBanner = createHeroSection('storyboard', 'h-32 md:h-44 mb-4');
  if (storyBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-4 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Storyboard Studio</h1><p class="text-white/60 text-xs">Plan your scenes with AI-generated storyboard frames</p>';
    storyBanner.appendChild(bannerText);
    topBar.appendChild(storyBanner);
  } else {
    topBar.innerHTML = '<h1 class="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Storyboard Studio</h1><p class="text-secondary text-xs mb-4">Plan your scenes with AI-generated storyboard frames</p>';
  }
  const inlineInstructions = createInlineInstructions('storyboard');
  inlineInstructions.classList.add('px-4', 'md:px-8', 'mt-2');
  topBar.appendChild(inlineInstructions);

  container.appendChild(topBar);

  const frames = [
    { prompt: '', narration: '', shot: 'Wide Shot', imageUrl: null, notes: '', referenceImages: [] },
    { prompt: '', narration: '', shot: 'Medium Shot', imageUrl: null, notes: '', referenceImages: [] },
    { prompt: '', narration: '', shot: 'Close-Up', imageUrl: null, notes: '', referenceImages: [] },
  ];

  const controlBar = document.createElement('div');
  controlBar.className = 'px-4 md:px-8 mb-4 flex items-center gap-3 flex-wrap';

  const LAYOUTS = [
    { id: 'horizontal', label: 'Horizontal' },
    { id: 'grid', label: 'Grid' },
    { id: 'story', label: 'Story' },
  ];
  let layout = 'horizontal';

  const layoutLabel = document.createElement('span');
  layoutLabel.className = 'text-xs font-bold text-secondary';
  layoutLabel.textContent = 'Layout:';
  controlBar.appendChild(layoutLabel);

  const layoutSelect = document.createElement('select');
  layoutSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
  LAYOUTS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.label;
    opt.style.background = '#111';
    if (l.id === layout) opt.selected = true;
    layoutSelect.appendChild(opt);
  });
  layoutSelect.onchange = () => {
    layout = layoutSelect.value;
    renderFrames();
  };
  controlBar.appendChild(layoutSelect);

  const presetLabel = document.createElement('span');
  presetLabel.className = 'text-xs font-bold text-secondary';
  presetLabel.textContent = 'Preset:';
  controlBar.appendChild(presetLabel);

  const presetSelect = document.createElement('select');
  presetSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
  presetSelect.innerHTML = '<option value="">None</option>';
  SHOT_PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.shot;
    opt.textContent = p.shot;
    opt.style.background = '#111';
    presetSelect.appendChild(opt);
  });
  presetSelect.onchange = () => {
    const preset = SHOT_PRESETS.find(p => p.shot === presetSelect.value);
    if (!preset) return;
    selectedPreset = preset;
    frames.forEach((frame, idx) => {
      frame.shot = preset.shot;
      frame.prompt = idx === 0 ? preset.prompt : `${preset.prompt} (part ${idx + 1})`;
    });
    renderFrames();
    scheduleDraftSave();
  };
  controlBar.appendChild(presetSelect);

  const projectIdInput = document.createElement('input');
  projectIdInput.type = 'text';
  projectIdInput.placeholder = 'Project ID';
  projectIdInput.value = 'storyboard-' + Date.now();
  projectIdInput.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none w-40';
  controlBar.appendChild(projectIdInput);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    const id = projectIdInput.value.trim() || ('storyboard-' + Date.now());
    try {
      const r = await fetch('/api/storyboard/' + encodeURIComponent(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, frames, preset: selectedPreset }),
      });
      if (!r.ok) throw new Error('Save failed');
      showToast('Storyboard saved', 'success');
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
  };
  controlBar.appendChild(saveBtn);

  const loadBtn = document.createElement('button');
  loadBtn.type = 'button';
  loadBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
  loadBtn.textContent = 'Load';
  loadBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    const id = projectIdInput.value.trim();
    if (!id) { showToast('Enter a project ID', 'warning'); return; }
    try {
      const r = await fetch('/api/storyboard/' + encodeURIComponent(id));
      if (!r.ok) throw new Error('Load failed');
      const data = await r.json();
      if (data.frames && Array.isArray(data.frames)) {
        frames.length = 0;
        frames.push(...data.frames);
        renderFrames();
        showToast('Storyboard loaded', 'success');
      }
    } catch (e) {
      showToast('Load failed: ' + e.message, 'error');
    }
  };
  controlBar.appendChild(loadBtn);

  const addFrameBtn = document.createElement('button');
  addFrameBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
  addFrameBtn.textContent = '+ Add Frame';
  addFrameBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    frames.push({ prompt: '', narration: '', shot: 'Wide Shot', imageUrl: null, notes: '', referenceImages: [] });
    renderFrames();
    scheduleDraftSave();
  };
  controlBar.appendChild(addFrameBtn);

  const genAllBtn = document.createElement('button');
  genAllBtn.type = 'button';
  genAllBtn.className = 'px-4 py-2 bg-primary text-black rounded-xl text-xs font-bold hover:shadow-glow transition-all';
  genAllBtn.textContent = 'Generate All Frames';
  genAllBtn.setAttribute('aria-label', 'Generate all frames');
  controlBar.appendChild(genAllBtn);

  const progressLabel = document.createElement('span');
  progressLabel.className = 'text-[10px] text-muted tabular-nums';
  progressLabel.textContent = '';
  controlBar.appendChild(progressLabel);

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all hidden';
  retryBtn.textContent = 'Retry failed';
  retryBtn.onclick = async () => {
    if (!generationProgress.failed.length) return;
    const failedIndices = [...generationProgress.failed];
    generationProgress.failed = [];
    retryBtn.classList.add('hidden');
    for (const idx of failedIndices) {
      if (idx >= frames.length) continue;
      const card = framesArea.children[idx];
      const btn = card?.querySelector('button:last-child');
      const imageArea = card?.querySelector('.aspect-video');
      if (!btn || !imageArea) continue;
      try {
        await generateFrame(idx, btn, imageArea);
        generationProgress.current++;
        updateProgressLabel();
      } catch (err) {
        showToast(`Frame ${idx + 1} failed: ${err.message}`, 'error');
        generationProgress.failed.push(idx);
      }
    }
    if (generationProgress.failed.length === 0) {
      showToast('All retries completed', 'success');
    }
    retryBtn.classList.toggle('hidden', generationProgress.failed.length === 0);
  };
  controlBar.appendChild(retryBtn);

  const styleLabel = document.createElement('span');
  styleLabel.className = 'text-xs font-bold text-secondary';
  styleLabel.textContent = 'Style:';
  controlBar.appendChild(styleLabel);

  const styleSelect = document.createElement('select');
  styleSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
  STYLE_OPTIONS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    opt.style.background = '#111';
    if (s === selectedStyle) opt.selected = true;
    styleSelect.appendChild(opt);
  });
  styleSelect.onchange = () => { selectedStyle = styleSelect.value; };
  controlBar.appendChild(styleSelect);

  const lightingLabel = document.createElement('span');
  lightingLabel.className = 'text-xs font-bold text-secondary';
  lightingLabel.textContent = 'Lighting:';
  controlBar.appendChild(lightingLabel);

  const lightingSelect = document.createElement('select');
  lightingSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
  LIGHTING_OPTIONS.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l;
    opt.textContent = l;
    opt.style.background = '#111';
    if (l === selectedLighting) opt.selected = true;
    lightingSelect.appendChild(opt);
  });
  lightingSelect.onchange = () => { selectedLighting = lightingSelect.value; };
  controlBar.appendChild(lightingSelect);

  const colorLabel = document.createElement('span');
  colorLabel.className = 'text-xs font-bold text-secondary';
  colorLabel.textContent = 'Color:';
  controlBar.appendChild(colorLabel);

  const colorSelect = document.createElement('select');
  colorSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
  COLOR_OPTIONS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    opt.style.background = '#111';
    if (c === selectedColor) opt.selected = true;
    colorSelect.appendChild(opt);
  });
  colorSelect.onchange = () => { selectedColor = colorSelect.value; };
  controlBar.appendChild(colorSelect);

  let enhancedConcept = '';
  let customThumbnailUrl = getCustomThumbnailFromCache('storyboard-studio');
  const gtmBtn = document.createElement('button');
  gtmBtn.type = 'button';
  gtmBtn.textContent = '🎯 GTM Boost';
  gtmBtn.title = 'Enhance your storyboard with GTM conversion frameworks';
  gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
  gtmBtn.className = 'gtm-boost-btn shrink-0';
  gtmBtn.addEventListener('click', () => {
    import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
      openGTMPromptModal('storyboard', (prompt) => {
        enhancedConcept = prompt;
        gtmBtn.classList.add('active');
        renderFrames();
      });
    }).catch((err) => console.error('[StoryboardStudio] GTM Boost failed:', err));
  });
  controlBar.appendChild(gtmBtn);

  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'gtm-boost-btn shrink-0';
  thumbBtn.addEventListener('click', () => {
    const modal = new StudioThumbnailModal({
      appTheme: 'storyboard-studio',
      studioId: 'storyboard-studio',
      studioName: 'Storyboard Studio',
      aspectRatio: selectedAr,
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('storyboard-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('storyboard-studio');
      },
    });
    mountStudioThumbnailModal(modal);
    modal.open();
  });
  controlBar.appendChild(thumbBtn);

  const personalizeTrigger = mountPersonalizeTrigger({ controlsContainer: controlBar, appId: 'storyboard', getTextarea: () => null });
  const activeProfileRef = { value: null };
  const syncProfile = () => { activeProfileRef.value = personalizeTrigger?.getActiveProfile?.() || null; };
  syncProfile();
  window.addEventListener('remix:contact-changed', syncProfile);

  const exportBtn = document.createElement('button');
  exportBtn.className = 'px-4 py-2 bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition-all ml-auto';
  exportBtn.innerHTML = 'Export PDF';
  exportBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      showToast('Popup blocked. Please allow popups to export PDF.', 'error');
      return;
    }
    const rows = frames
      .map((frame, idx) => `
        <tr>
          <td style="width:60px;text-align:center;font-weight:bold;color:#fff;">${idx + 1}</td>
          <td style="width:120px;padding:8px;">
            <img src="${frame.imageUrl || ''}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#0f172a;" />
          </td>
          <td style="color:#fff;padding:8px 12px;">${escapeHtml(frame.shot || '')}</td>
          <td style="color:#fff;padding:8px 12px;">${escapeHtml(frame.prompt || '')}</td>
          <td style="color:#fff;padding:8px 12px;">${escapeHtml(frame.narration || '')}</td>
        </tr>
      `)
      .join('');
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Storyboard Export</title>
  <style>
    body { background:#020617; color:#e5e7eb; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding:24px; }
    h1 { font-size:20px; margin-bottom:4px; }
    p { color:#9ca3af; margin-top:0; margin-bottom:16px; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; padding:8px 12px; color:#9ca3af; border-bottom:1px solid #27272a; font-size:12px; }
    td { border-bottom:1px solid #27272a; font-size:13px; vertical-align:top; }
    @media print {
      body { padding:0; }
      table { page-break-inside:auto; }
      tr { page-break-inside:avoid; }
    }
  </style>
</head>
<body>
  <h1>Storyboard Studio Export</h1>
  <p>${new Date().toLocaleString()} · ${frames.length} frames</p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Frame</th>
        <th>Shot</th>
        <th>Prompt</th>
        <th>Narration</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>setTimeout(() => { window.print(); }, 300);</script>
</body>
</html>`);
    printWindow.document.close();
  };
  controlBar.appendChild(exportBtn);

  // Model / aspect-ratio dropdowns
  const dropdown = document.createElement('div');
  dropdown.className = 'absolute bottom-[102%] left-2 z-50 transition-all opacity-0 pointer-events-none scale-95 origin-bottom-left glass rounded-3xl p-3 translate-y-2 w-[calc(100vw-3rem)] max-w-xs shadow-4xl border border-white/10 flex flex-col';

  function closeDropdown() {
    dropdown.classList.add('opacity-0', 'pointer-events-none');
    dropdown.classList.remove('opacity-100', 'pointer-events-auto');
  }

  function showDropdown(type, anchorBtn) {
    dropdown.innerHTML = '';
    dropdown.classList.remove('opacity-0', 'pointer-events-none');
    dropdown.classList.add('opacity-100', 'pointer-events-auto');

    if (type === 'model') {
      dropdown.classList.add('w-[calc(100vw-3rem)]', 'max-w-xs');
      dropdown.classList.remove('max-w-[240px]', 'max-w-[200px]');
      dropdown.innerHTML = `
        <div class="flex flex-col h-full max-h-[70vh]">
          <div class="px-2 pb-3 mb-2 border-b border-white/5 shrink-0">
            <div class="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/5 focus-within:border-primary/50 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-muted"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" id="model-search" placeholder="Search models..." class="bg-transparent border-none text-xs text-white focus:ring-0 w-full p-0">
            </div>
          </div>
          <div class="text-[10px] font-bold text-secondary uppercase tracking-widest px-3 py-2 shrink-0">Available models</div>
          <div id="model-list-container" class="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 pb-2"></div>
        </div>
      `;
      const list = dropdown.querySelector('#model-list-container');

      const renderModels = (filter = '') => {
        list.innerHTML = '';
        const filtered = t2iModels.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()) || m.id.toLowerCase().includes(filter.toLowerCase()));
        filtered.forEach(m => {
          const item = document.createElement('div');
          item.className = `flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-white/5 ${selectedModel === m.id ? 'bg-white/5 border-white/5' : ''}`;
          item.innerHTML = `
            <div class="flex items-center gap-3.5">
              <div class="w-10 h-10 bg-primary/10 text-primary border border-white/5 rounded-xl flex items-center justify-center font-black text-sm shadow-inner uppercase">${m.name.charAt(0)}</div>
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-bold text-white tracking-tight">${m.name}</span>
              </div>
            </div>
            ${selectedModel === m.id ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          `;
          item.onclick = (e) => {
            e.stopPropagation();
            selectedModel = m.id;
            selectedModelName = m.name;
            const availableArs = getAspectRatiosForModel(selectedModel);
            selectedAr = availableArs[0];
            document.getElementById('model-btn-label').textContent = selectedModelName;
            document.getElementById('ar-btn-label').textContent = selectedAr;
            closeDropdown();
          };
          list.appendChild(item);
        });
      };

      renderModels();

      const searchInput = dropdown.querySelector('#model-search');
      searchInput.onclick = (e) => e.stopPropagation();
      searchInput.oninput = (e) => renderModels(e.target.value);

    } else if (type === 'ar') {
      dropdown.classList.add('max-w-[240px]');
      dropdown.classList.remove('w-[calc(100vw-3rem)]', 'max-w-xs', 'max-w-[200px]');
      dropdown.innerHTML = `<div class="text-[10px] font-bold text-muted uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Aspect Ratio</div>`;
      const list = document.createElement('div');
      list.className = 'flex flex-col gap-1';

      const availableArs = getAspectRatiosForModel(selectedModel);
      availableArs.forEach(r => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group';
        item.innerHTML = `
          <div class="flex items-center gap-4">
            <div class="w-6 h-6 border-2 border-white/20 rounded-md shadow-inner flex items-center justify-center group-hover:border-primary/50 transition-colors">
              <div class="w-3 h-3 bg-white/10 rounded-sm"></div>
            </div>
            <span class="text-xs font-bold text-white opacity-80 group-hover:opacity-100 transition-opacity">${r}</span>
          </div>
          ${selectedAr === r ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        `;
        item.onclick = (e) => {
          e.stopPropagation();
          selectedAr = r;
          document.getElementById('ar-btn-label').textContent = r;
          closeDropdown();
        };
        list.appendChild(item);
      });
      dropdown.appendChild(list);
    }
  }

  const createControlBtn = (icon, label, id, tooltip) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap';
    if (tooltip) btn.setAttribute('data-tooltip', tooltip);
    btn.innerHTML = `
      ${icon}
      <span id="${id}-label" class="text-xs font-bold text-white group-hover:text-primary transition-colors">${label}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="opacity-20 group-hover:opacity-100 transition-opacity"><path d="M6 9l6 6 6-6"/></svg>
    `;
    return btn;
  };

  const modelBtn = createControlBtn(`
    <div class="w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20">
      <span class="text-[10px] font-black text-black">G</span>
    </div>
  `, selectedModelName, 'model-btn', 'Select AI generation model');

  const arBtn = createControlBtn(`
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
  `, selectedAr, 'ar-btn', 'Change aspect ratio');

  controlBar.appendChild(modelBtn);
  controlBar.appendChild(arBtn);

  modelBtn.onclick = (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('opacity-100')) {
      closeDropdown();
    } else {
      showDropdown('model', modelBtn);
    }
  };

  arBtn.onclick = (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('opacity-100')) {
      closeDropdown();
    } else {
      showDropdown('ar', arBtn);
    }
  };

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== modelBtn && e.target !== arBtn) {
      closeDropdown();
    }
  });

  container.appendChild(controlBar);

  const framesArea = document.createElement('div');
  framesArea.className = 'px-4 md:px-8 pb-8 flex gap-4 overflow-x-auto no-scrollbar';
  container.appendChild(framesArea);

  function getLayoutClasses() {
    if (layout === 'grid') return 'px-4 md:px-8 pb-8 grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto';
    if (layout === 'story') return 'px-4 md:px-8 pb-8 flex flex-col gap-6 overflow-y-auto';
    return 'px-4 md:px-8 pb-8 flex gap-4 overflow-x-auto no-scrollbar';
  }

  function updateProgressLabel() {
    const failedCount = generationProgress.failed.length;
    progressLabel.textContent = `${generationProgress.current}/${generationProgress.total}${failedCount ? ` · ${failedCount} failed` : ''}`;
  }

  function renderFrames() {
    framesArea.className = getLayoutClasses();
    framesArea.innerHTML = '';
    frames.forEach((frame, idx) => {
      const card = document.createElement('div');
      const isGrid = layout === 'grid';
      const isStory = layout === 'story';
      card.className = `${isGrid || isStory ? 'w-full' : 'shrink-0 w-72'} bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-3 cursor-move`;
      card.draggable = true;
      card.dataset.frameIndex = idx;

      card.ondragstart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        card.classList.add('opacity-50');
      };

      card.ondragend = () => {
        card.classList.remove('opacity-50');
      };

      card.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      };

      card.ondrop = (e) => {
        e.preventDefault();
        const fromIdx = Number(e.dataTransfer.getData('text/plain'));
        const toIdx = idx;
        if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= frames.length || toIdx >= frames.length) return;
        const [moved] = frames.splice(fromIdx, 1);
        frames.splice(toIdx, 0, moved);
        renderFrames();
        scheduleDraftSave();
      };

      const frameNum = document.createElement('div');
      frameNum.className = 'flex items-center justify-between';
      frameNum.innerHTML = `
        <span class="text-xs font-bold text-primary">Frame ${idx + 1}</span>
        <button class="text-muted hover:text-red-400 transition-colors text-xs remove-frame">&times;</button>
      `;
      card.appendChild(frameNum);

      const imageArea = document.createElement('div');
      imageArea.className = 'w-full aspect-video bg-white/[0.02] rounded-lg border border-white/5 flex items-center justify-center overflow-hidden';
      imageArea.setAttribute('role', 'status');
      imageArea.setAttribute('aria-live', 'polite');
      if (frame.imageUrl) {
        const img = document.createElement('img');
        img.src = frame.imageUrl;
        img.className = 'w-full h-full object-cover cursor-pointer';
        img.alt = `Storyboard frame ${idx + 1}`;
        img.onclick = () => {
          fullscreen.show(frame.imageUrl, {
            type: 'image',
            prompt: frame.prompt,
            model: selectedModelName,
            shot: frame.shot,
          });
        };
        imageArea.appendChild(img);
      } else {
        imageArea.innerHTML = '<span class="text-muted text-xs">No image</span>';
      }
      card.appendChild(imageArea);

      const shotSelect = document.createElement('select');
      shotSelect.className = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none appearance-none cursor-pointer';
      SHOT_TYPES.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        opt.style.background = '#111';
        if (s === frame.shot) opt.selected = true;
        shotSelect.appendChild(opt);
      });
      shotSelect.onchange = () => { frame.shot = shotSelect.value; scheduleDraftSave(); };
      card.appendChild(shotSelect);

      const promptInput = document.createElement('textarea');
      promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50 resize-none';
      promptInput.rows = 2;
      promptInput.placeholder = 'Describe this scene...';
      promptInput.value = frame.prompt;
      promptInput.setAttribute('aria-label', 'Frame description');
      promptInput.oninput = () => { frame.prompt = promptInput.value; scheduleDraftSave(); };
      card.appendChild(promptInput);

      const frameEnhanceBtn = document.createElement('button');
      frameEnhanceBtn.type = 'button';
      frameEnhanceBtn.className = 'self-start text-xs font-bold text-primary hover:text-white transition-colors frame-enhance-btn';
      frameEnhanceBtn.textContent = '🎯 Enhance';
      frameEnhanceBtn.title = 'Enhance this frame with GTM conversion frameworks';
      frameEnhanceBtn.addEventListener('click', () => {
        import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
          openGTMPromptModal('storyboard', (prompt) => {
            frame.enhancedPrompt = prompt;
            frameEnhanceBtn.textContent = '🎯 Enhanced';
            frameEnhanceBtn.classList.add('active');
          });
        }).catch((err) => console.error('[StoryboardStudio] Frame GTM Boost failed:', err));
      });
      const enhanceRow = document.createElement('div');
      enhanceRow.className = 'flex items-center justify-between -mt-1';
      const enhanceHint = document.createElement('span');
      enhanceHint.className = 'text-[10px] text-muted';
      enhanceHint.textContent = 'GTM-conversion boost';
      enhanceRow.appendChild(enhanceHint);
      enhanceRow.appendChild(frameEnhanceBtn);
      card.appendChild(enhanceRow);

      const narrationInput = document.createElement('input');
      narrationInput.type = 'text';
      narrationInput.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50';
      narrationInput.placeholder = 'Narration text (optional)...';
      narrationInput.value = frame.narration || '';
      narrationInput.oninput = () => { frame.narration = narrationInput.value; scheduleDraftSave(); };
      card.appendChild(narrationInput);

      const notesInput = document.createElement('input');
      notesInput.type = 'text';
      notesInput.className = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50';
      notesInput.placeholder = 'Director notes (optional)...';
      notesInput.value = frame.notes || '';
      notesInput.oninput = () => { frame.notes = notesInput.value; scheduleDraftSave(); };
      card.appendChild(notesInput);

      const refBtn = document.createElement('button');
      refBtn.type = 'button';
      refBtn.className = 'text-xs text-muted hover:text-white transition-colors';
      refBtn.textContent = '📎 Reference';
      refBtn.title = 'Attach reference image';
      card.appendChild(refBtn);

      const genFrameBtn = document.createElement('button');
      genFrameBtn.type = 'button';
      genFrameBtn.className = 'w-full bg-white/10 text-white py-2 rounded-lg text-xs font-bold hover:bg-white/20 transition-all';
      genFrameBtn.textContent = 'Generate Frame';
      genFrameBtn.setAttribute('aria-label', 'Generate frame');
      genFrameBtn.onclick = async () => {
        if (!(await requireEntitlement())) return;
        generateFrame(idx, genFrameBtn, imageArea);
      };
      card.appendChild(genFrameBtn);

      card.querySelector('.remove-frame').onclick = () => {
        if (frames.length > 1) { frames.splice(idx, 1); renderFrames(); scheduleDraftSave(); }
      };

      framesArea.appendChild(card);
    });
  }

  async function generateFrame(idx, btn, imageArea) {
    const frame = frames[idx];
    if (!frame.prompt.trim()) { showToast('Enter a scene description', 'warning'); return; }
    const hasKey = apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey();
    if (!hasKey) { AuthModal(() => generateFrame(idx, btn, imageArea)); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span>';

    try {
      let rawPrompt = frame.prompt;
      if (frame.enhancedPrompt) {
        rawPrompt = `${frame.enhancedPrompt} — ${frame.shot} composition`;
      } else if (enhancedConcept) {
        rawPrompt = `${enhancedConcept} Scene: ${frame.prompt} (${frame.shot})`;
      }
      const profile = activeProfileRef.value;
      const resolvedPrompt = profile ? replaceTokensInPrompt(rawPrompt, profile) : rawPrompt;

      let cinematicPrompt = `${frame.shot} cinematic storyboard frame: ${resolvedPrompt}, professional cinematography, 4K quality`;
      if (selectedStyle !== 'None') cinematicPrompt += `, ${selectedStyle.toLowerCase()} style`;
      if (selectedLighting !== 'None') cinematicPrompt += `, ${selectedLighting.toLowerCase()} lighting`;
      if (selectedColor !== 'None') cinematicPrompt += `, ${selectedColor.toLowerCase()} color grade`;

      const url = await generateFrameImage(cinematicPrompt);
      if (url) {
        frame.imageUrl = url;
        imageArea.innerHTML = '';
        const img = document.createElement('img');
        img.src = url;
        img.className = 'w-full h-full object-cover cursor-pointer';
        img.alt = `Storyboard frame ${idx + 1}`;
        img.onclick = () => {
          fullscreen.show(url, {
            type: 'image',
            prompt: frame.prompt,
            model: selectedModelName,
            shot: frame.shot,
          });
        };
        imageArea.appendChild(img);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      throw err;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Frame';
    }
  }

  async function generateFrameImage(prompt) {
    if (apiKeyManager.hasOpenAIKey()) {
      try {
        const { images } = await openaiService.generateImageResponses({
          input: prompt,
          size: resolveOpenAISize(selectedAr),
          quality: 'auto',
          outputFormat: 'png',
          customThumbnailUrl: customThumbnailUrl || undefined,
        });
        const img = images?.[0];
        if (!img) return null;
        return img.base64 ? `data:image/png;base64,${img.base64}` : img.url || null;
      } catch (err) {
        if (!apiKeyManager.hasMuapiKey()) throw err;
        console.warn('[StoryboardStudio] OpenAI Responses generation failed, falling back to MuAPI:', err.message);
      }
    }
    const result = await muapi.generateImage({ model: selectedModel, prompt, aspect_ratio: selectedAr, customThumbnailUrl: customThumbnailUrl || undefined });
    return result?.url || null;
  }

  genAllBtn.onclick = async () => {
    const hasKey = apiKeyManager.hasOpenAIKey() || apiKeyManager.hasMuapiKey();
    if (!hasKey) { AuthModal(() => genAllBtn.click()); return; }

    generationProgress = { current: 0, total: frames.filter(f => f.prompt.trim()).length, failed: [] };
    batchRetryCount = 0;
    updateProgressLabel();
    retryBtn.classList.add('hidden');

    genAllBtn.disabled = true;
    genAllBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    for (let i = 0; i < frames.length; i++) {
      if (!frames[i].prompt.trim()) continue;
      try {
        const card = framesArea.children[i];
        const btn = card?.querySelector('button:last-child');
        const imageArea = card?.querySelector('.aspect-video');
        if (!btn || !imageArea) continue;
        await withRetry(() => generateFrame(i, btn, imageArea));
        generationProgress.current++;
        updateProgressLabel();
      } catch (err) {
        showToast(`Frame ${i + 1} failed: ${err.message}`, 'error');
        generationProgress.failed.push(i);
        updateProgressLabel();
      }
    }

    genAllBtn.disabled = false;
    genAllBtn.textContent = 'Generate All Frames';
    retryBtn.classList.toggle('hidden', generationProgress.failed.length === 0);
    if (generationProgress.failed.length === 0) {
      showToast('All frames generated', 'success');
    }
  };

  renderFrames();
  return container;
}
