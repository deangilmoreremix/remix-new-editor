import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { audioModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { mountModelSelector } from '../lib/modelSelectorUI.js';
import { showToast } from '../lib/loading.js';
import { formatErrorMessage } from '../lib/errorMessages.js';
import { getAssetsForStudio } from '../data/exampleGalleryAssets.js';
import ExampleGallery from './studios/ExampleGallery.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';

function scopedPersistKey(baseKey, apiKey) {
  if (!apiKey) return baseKey;
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    hash = (hash * 31 + apiKey.charCodeAt(i)) | 0;
  }
  return `${baseKey}:${(hash >>> 0).toString(36)}`;
}

function migrateLegacyPersistKey(baseKey, scopedKey) {
  if (scopedKey === baseKey) return;
  try {
    if (localStorage.getItem(scopedKey)) return;
    const legacy = localStorage.getItem(baseKey);
    if (legacy) {
      localStorage.setItem(scopedKey, legacy);
      localStorage.removeItem(baseKey);
    }
  } catch { /* localStorage unavailable */ }
}

async function uploadAudioFile(file, onProgress, apiKey) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', muapi.proxyUrl);
    xhr.setRequestHeader('x-api-key', apiKey);
    xhr.setRequestHeader('x-endpoint', 'upload_file');

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const url = data.url || data.data?.url;
          if (!url) reject(new Error('No URL returned from upload'));
          else resolve(url);
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

function createAudioFileUploader(label, value, onChange, apiKey) {
  const UPLOAD_STATES = { IDLE: 'idle', UPLOADING: 'uploading', READY: 'ready' };
  let uploadState = value ? UPLOAD_STATES.READY : UPLOAD_STATES.IDLE;
  let progress = 0;
  let fileName = value ? String(value).split('/').pop().slice(-30) : '';

  const container = document.createElement('div');
  container.className = 'space-y-2';

  const headerRow = document.createElement('div');
  headerRow.className = 'flex items-center justify-between';
  const labelEl = document.createElement('label');
  labelEl.className = 'text-xs font-bold text-zinc-200 uppercase tracking-wider';
  labelEl.textContent = label;
  headerRow.appendChild(labelEl);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear';
  clearBtn.className = 'text-xs font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider flex items-center gap-1.5';
  clearBtn.style.display = 'none';
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onChange(null);
    uploadState = UPLOAD_STATES.IDLE;
    fileName = '';
    progress = 0;
    clearBtn.style.display = 'none';
    render();
  });
  headerRow.appendChild(clearBtn);
  container.appendChild(headerRow);

  const dropZone = document.createElement('div');
  container.appendChild(dropZone);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*';
  fileInput.className = 'hidden';
  container.appendChild(fileInput);

  function render() {
    dropZone.className = `relative border rounded p-4 transition-all duration-300 flex items-center gap-3.5 cursor-pointer ${
      uploadState === UPLOAD_STATES.READY
        ? 'border-primary/60 bg-primary/10 shadow-[0_0_15px_rgba(34,211,238,0.05)]'
        : 'border-zinc-700 bg-zinc-900 hover:bg-zinc-850 hover:border-primary/50'
    }`;

    if (uploadState === UPLOAD_STATES.IDLE) {
      clearBtn.style.display = 'none';
      dropZone.innerHTML = `
        <div class="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-zinc-200 border border-zinc-700/50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
        </div>
        <div class="text-left">
          <div class="text-xs font-bold text-white">Upload audio track</div>
          <div class="text-[11px] text-zinc-300 font-medium mt-0.5">MP3, WAV, M4A up to 20MB</div>
        </div>
      `;
      dropZone.onclick = () => fileInput.click();
    } else if (uploadState === UPLOAD_STATES.UPLOADING) {
      clearBtn.style.display = 'none';
      dropZone.innerHTML = `
        <div class="w-full flex items-center gap-4">
          <div class="flex-1">
            <div class="flex justify-between text-xs text-white/95 mb-1.5 font-bold">
              <span>Uploading...</span>
              <span>${progress}%</span>
            </div>
            <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full bg-primary transition-all duration-300" style="width: ${progress}%"></div>
            </div>
          </div>
        </div>
      `;
      dropZone.onclick = null;
    } else if (uploadState === UPLOAD_STATES.READY) {
      clearBtn.style.display = 'flex';
      dropZone.innerHTML = `
        <div class="w-10 h-10 rounded bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="text-xs font-bold text-white truncate">${fileName}</div>
          <div class="text-[11px] text-primary font-bold mt-0.5">Ready to generate</div>
        </div>
      `;
      dropZone.onclick = null;
    }
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast('Audio file exceeds 20MB limit.', 'error');
      fileInput.value = '';
      return;
    }
    uploadState = UPLOAD_STATES.UPLOADING;
    progress = 0;
    render();
    try {
      const url = await uploadAudioFile(file, (pct) => {
        progress = pct;
        render();
      }, apiKey);
      fileName = file.name;
      uploadState = UPLOAD_STATES.READY;
      onChange(url);
    } catch (err) {
      uploadState = UPLOAD_STATES.IDLE;
      fileName = '';
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      progress = 0;
      fileInput.value = '';
      render();
    }
  });

  render();
  return container;
}

function createAudioListUploader(label, value, onChange, apiKey, maxItems = 2) {
  const container = document.createElement('div');
  container.className = 'space-y-4';

  const labelEl = document.createElement('label');
  labelEl.className = 'block text-xs font-bold text-zinc-200 uppercase tracking-wider';
  labelEl.textContent = `${label} (Max ${maxItems})`;
  container.appendChild(labelEl);

  const listContainer = document.createElement('div');
  listContainer.className = 'space-y-3';
  container.appendChild(listContainer);

  function renderList() {
    listContainer.innerHTML = '';
    const items = Array.isArray(value) ? value : [];
    for (let i = 0; i < maxItems; i++) {
      const uploader = createAudioFileUploader(
        `Track #${i + 1}`,
        items[i] || null,
        (url) => {
          const newItems = [...items];
          if (url) {
            newItems[i] = url;
          } else {
            newItems.splice(i, 1);
          }
          onChange(newItems.filter(Boolean));
          renderList();
        },
        apiKey
      );
      listContainer.appendChild(uploader);
    }
  }

  renderList();
  return container;
}

function renderSchemaControls(selectedModel, schemaParams, setSchemaParams, container, apiKey) {
  if (!selectedModel || !selectedModel.inputs) return;

  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'space-y-5';

  Object.entries(selectedModel.inputs).forEach(([key, schema]) => {
    if (key === 'model') return;
    const hardcodedKeys = ['prompt', 'style', 'duration', 'voice', 'tone', 'emotion', 'speed', 'pitch'];
    if (hardcodedKeys.includes(key)) return;

    if (schema.type === 'string' && schema.field === 'audio') {
      const uploader = createAudioFileUploader(schema.title || key, schemaParams[key] || '', (url) => {
        setSchemaParams(prev => ({ ...prev, [key]: url }));
      }, apiKey);
      controlsContainer.appendChild(uploader);
      return;
    }

    if (schema.type === 'array' && schema.field === 'audios_list') {
      const uploader = createAudioListUploader(schema.title || key, schemaParams[key] || [], (urls) => {
        setSchemaParams(prev => ({ ...prev, [key]: urls }));
      }, apiKey, schema.maxItems || 2);
      controlsContainer.appendChild(uploader);
      return;
    }

    if (schema.type === 'boolean') {
      const wrapper = document.createElement('div');
      wrapper.className = 'flex items-center justify-between bg-zinc-900 border border-zinc-700/80 rounded p-4 transition-all hover:border-zinc-600';
      const info = document.createElement('div');
      info.className = 'flex-1 pr-4';
      const title = document.createElement('span');
      title.className = 'block text-xs font-bold text-white tracking-tight';
      title.textContent = schema.title || key;
      info.appendChild(title);
      if (schema.description) {
        const desc = document.createElement('span');
        desc.className = 'block text-[11px] text-zinc-300 leading-normal mt-1';
        desc.textContent = schema.description;
        info.appendChild(desc);
      }
      wrapper.appendChild(info);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      const isOn = schemaParams[key] !== undefined ? schemaParams[key] : (schema.default || false);
      toggle.className = `w-11 h-6 rounded-full p-1 transition-all duration-300 relative shrink-0 ${isOn ? 'bg-primary' : 'bg-zinc-800'}`;
      toggle.innerHTML = `<div class="w-4 h-4 rounded-full bg-black shadow-md transform transition-all duration-300 ${isOn ? 'translate-x-5 bg-white' : 'translate-x-0'}"></div>`;
      toggle.addEventListener('click', () => {
        setSchemaParams(prev => ({ ...prev, [key]: !prev[key] }));
      });
      wrapper.appendChild(toggle);
      controlsContainer.appendChild(wrapper);
      return;
    }

    if (schema.enum) {
      const wrapper = document.createElement('div');
      wrapper.className = 'space-y-2 relative';
      const labelEl = document.createElement('label');
      labelEl.className = 'block text-xs font-bold text-zinc-300 uppercase tracking-wider';
      labelEl.textContent = schema.title || key;
      wrapper.appendChild(labelEl);

      const dropdownBtn = document.createElement('button');
      dropdownBtn.type = 'button';
      dropdownBtn.className = 'w-full bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded px-4 py-3.5 text-xs text-left font-bold text-white flex items-center justify-between transition-all cursor-pointer';
      const selectedLabel = (() => {
        const val = schemaParams[key];
        if (!val) return 'Select option';
        const opt = schema.enum.find(o => (typeof o === 'object' ? o.value : o) === val);
        return opt ? (typeof opt === 'object' ? (opt.label || opt.value) : opt) : val;
      })();
      dropdownBtn.innerHTML = `<span>${selectedLabel}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;

      const optionsList = document.createElement('div');
      optionsList.className = 'absolute left-0 right-0 mt-1 z-50 bg-[#161618] border border-zinc-700 rounded shadow-3xl max-h-60 overflow-y-auto p-1 hidden';

      schema.enum.forEach(opt => {
        const optionValue = typeof opt === 'object' ? opt.value : opt;
        const optionLabel = typeof opt === 'object' ? (opt.label || opt.value) : opt;
        const optionBtn = document.createElement('button');
        optionBtn.type = 'button';
        optionBtn.className = `w-full text-left px-4 py-2.5 rounded text-xs font-bold transition-all border ${schemaParams[key] === optionValue ? 'text-primary bg-primary/10 border-primary/20' : 'text-zinc-200 border-transparent hover:bg-zinc-900 hover:text-white'}`;
        optionBtn.textContent = optionLabel;
        optionBtn.addEventListener('click', () => {
          setSchemaParams(prev => ({ ...prev, [key]: optionValue }));
          optionsList.classList.add('hidden');
          const newLabel = (() => {
            const o = schema.enum.find(x => (typeof x === 'object' ? x.value : x) === optionValue);
            return o ? (typeof o === 'object' ? (o.label || o.value) : o) : optionValue;
          })();
          dropdownBtn.querySelector('span').textContent = newLabel;
          Array.from(optionsList.children).forEach(b => {
            const isSelected = b.textContent === newLabel;
            b.className = `w-full text-left px-4 py-2.5 rounded text-xs font-bold transition-all border ${isSelected ? 'text-primary bg-primary/10 border-primary/20' : 'text-zinc-200 border-transparent hover:bg-zinc-900 hover:text-white'}`;
          });
        });
        optionsList.appendChild(optionBtn);
      });

      dropdownBtn.addEventListener('click', () => {
        optionsList.classList.toggle('hidden');
      });

      wrapper.appendChild(dropdownBtn);
      wrapper.appendChild(optionsList);

      if (schema.description) {
        const desc = document.createElement('span');
        desc.className = 'block text-[11px] text-zinc-300 leading-normal';
        desc.textContent = schema.description;
        wrapper.appendChild(desc);
      }

      controlsContainer.appendChild(wrapper);
      return;
    }

    const isNumber = ['int', 'integer', 'float', 'number'].includes(schema.type);
    const hasMinMax = schema.minValue !== undefined && schema.maxValue !== undefined;
    if (isNumber && hasMinMax) {
      const step = schema.step || (schema.type === 'float' ? 0.05 : 1);
      const wrapper = document.createElement('div');
      wrapper.className = 'space-y-3 bg-zinc-900 border border-zinc-700/80 rounded p-4 transition-all hover:border-zinc-600';
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between text-xs font-bold';
      const title = document.createElement('span');
      title.className = 'text-white tracking-tight';
      title.textContent = schema.title || key;
      header.appendChild(title);
      const valueBadge = document.createElement('span');
      valueBadge.className = 'text-primary font-mono bg-primary/10 px-2 py-0.5 rounded border border-primary/20';
      const currentVal = schemaParams[key] !== undefined ? schemaParams[key] : (schema.default ?? 0);
      valueBadge.textContent = currentVal;
      header.appendChild(valueBadge);
      wrapper.appendChild(header);

      const sliderRow = document.createElement('div');
      sliderRow.className = 'flex items-center gap-2';
      const minLabel = document.createElement('span');
      minLabel.className = 'text-[10px] text-zinc-300 font-medium w-6 text-right';
      minLabel.textContent = schema.minValue;
      sliderRow.appendChild(minLabel);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(schema.minValue);
      slider.max = String(schema.maxValue);
      slider.step = String(step);
      slider.value = String(currentVal);
      slider.className = 'flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-primary hover:bg-zinc-700 transition-all';
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        setSchemaParams(prev => ({ ...prev, [key]: val }));
        valueBadge.textContent = val;
      });
      sliderRow.appendChild(slider);

      const maxLabel = document.createElement('span');
      maxLabel.className = 'text-[10px] text-zinc-300 font-medium w-6 text-left';
      maxLabel.textContent = schema.maxValue;
      sliderRow.appendChild(maxLabel);
      wrapper.appendChild(sliderRow);

      if (schema.description) {
        const desc = document.createElement('span');
        desc.className = 'block text-[11px] text-zinc-300 leading-normal';
        desc.textContent = schema.description;
        wrapper.appendChild(desc);
      }

      controlsContainer.appendChild(wrapper);
      return;
    }

    if (key === 'prompt') {
      const wrapper = document.createElement('div');
      wrapper.className = 'space-y-2';
      const labelEl = document.createElement('label');
      labelEl.className = 'block text-xs font-bold text-zinc-200 uppercase tracking-wider';
      labelEl.textContent = schema.title || 'Lyrics / Prompt';
      wrapper.appendChild(labelEl);

      const textarea = document.createElement('textarea');
      textarea.value = schemaParams[key] || '';
      textarea.placeholder = schema.description || 'Enter what you want generated...';
      textarea.className = 'w-full bg-zinc-900 border border-zinc-700 focus:border-primary/85 rounded p-3 text-xs text-white placeholder:text-zinc-400 focus:outline-none transition-all min-h-[100px] resize-none leading-relaxed shadow-inner';
      textarea.addEventListener('input', (e) => {
        setSchemaParams(prev => ({ ...prev, [key]: e.target.value }));
      });
      wrapper.appendChild(textarea);

      if (schema.examples && Array.isArray(schema.examples)) {
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'flex flex-wrap gap-1.5 mt-2';
        schema.examples.forEach((ex) => {
          if (!ex) return;
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'text-[11px] px-3 py-1 bg-zinc-800/80 border border-zinc-700 hover:bg-primary/20 hover:border-primary/45 hover:text-white rounded-full transition-all font-semibold text-zinc-100';
          chip.textContent = `"${ex.slice(0, 35)}${ex.length > 35 ? '...' : ''}"`;
          chip.addEventListener('click', () => {
            setSchemaParams(prev => ({ ...prev, [key]: ex }));
            textarea.value = ex;
          });
          chipsContainer.appendChild(chip);
        });
        wrapper.appendChild(chipsContainer);
      }

      controlsContainer.appendChild(wrapper);
      return;
    }

    const isNum = ['int', 'integer', 'float', 'number'].includes(schema.type);
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-2';
    const labelEl = document.createElement('label');
    labelEl.className = 'block text-xs font-bold text-zinc-200 uppercase tracking-wider';
    labelEl.textContent = schema.title || key;
    wrapper.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = isNum ? 'number' : 'text';
    input.value = schemaParams[key] !== undefined ? schemaParams[key] : '';
    input.placeholder = schema.placeholder || schema.description || `Enter ${key}...`;
    input.className = 'w-full bg-zinc-900 border border-zinc-700 hover:border-zinc-600 focus:border-primary/80 rounded px-4 py-3.5 text-xs text-white placeholder:text-zinc-400 focus:outline-none transition-all shadow-inner';
    input.addEventListener('input', (e) => {
      const val = isNum ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value;
      setSchemaParams(prev => ({ ...prev, [key]: val }));
    });
    wrapper.appendChild(input);

    if (schema.description) {
      const desc = document.createElement('span');
      desc.className = 'block text-[11px] text-zinc-300 leading-normal';
      desc.textContent = schema.description;
      wrapper.appendChild(desc);
    }

    controlsContainer.appendChild(wrapper);
  });

  container.appendChild(controlsContainer);
}

function createHistoryGrid(history, activeResultUrl, view, onSelect) {
  if (!history || history.length === 0) return null;

  const section = document.createElement('div');
  section.className = 'border-t border-zinc-900 pt-6 w-full animate-fade-in-up';

  const title = document.createElement('h4');
  title.className = 'text-xs font-bold text-zinc-300 uppercase tracking-wider mb-4 px-1';
  title.textContent = `Generation History (${history.length})`;
  section.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';

  history.forEach((entry, idx) => {
    const card = document.createElement('div');
    const isActive = activeResultUrl === entry.url && view === 'result';
    card.className = `p-3.5 bg-zinc-900 border rounded cursor-pointer transition-all flex flex-col justify-between h-28 border-zinc-700/80 hover:bg-zinc-850 hover:border-zinc-500 ${isActive ? 'border-primary bg-primary/5 shadow-glow' : ''}`;

    const header = document.createElement('div');
    header.className = 'flex items-center gap-2';
    const iconBox = document.createElement('div');
    iconBox.className = `w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary/20 text-primary' : 'bg-zinc-800 text-zinc-200'}`;
    iconBox.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>`;
    header.appendChild(iconBox);

    const badge = document.createElement('span');
    badge.className = 'text-[10px] font-bold text-primary uppercase tracking-wider truncate';
    badge.textContent = entry.model ? entry.model.split('-').slice(0, 2).join(' ') : 'Audio';
    header.appendChild(badge);
    card.appendChild(header);

    const titleEl = document.createElement('p');
    titleEl.className = 'text-[11px] font-semibold text-white line-clamp-2 leading-tight';
    titleEl.textContent = entry.title || entry.prompt || 'Untitled Audio';
    card.appendChild(titleEl);

    card.addEventListener('click', () => onSelect(entry, idx));
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

export function AudioStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'audio' });

  let selectedModel = audioModels[0];
  let selectedModelId = selectedModel.id;
  let prompt = '';
  let style = '';
  let duration = '30';
  let selectedVoice = 'female-1';
  let speed = 1.0;
  let pitch = 1.0;
  let toneValue = 'neutral';
  let emotionValue = 'none';
  let customThumbnailUrl = getCustomThumbnailFromCache('audio-studio');
  let schemaParams = {};
  let internalHistory = [];
  let activeResultUrl = null;
  let activeResultTitle = '';
  let view = 'input';

  const apiKey = apiKeyManager.getMuapiKey();
  const PERSIST_KEY = scopedPersistKey('hg_audio_studio_persistent', apiKey);

  try {
    migrateLegacyPersistKey('hg_audio_studio_persistent', PERSIST_KEY);
  } catch { /* ignore migrate error */ }

  try {
    const stored = localStorage.getItem(PERSIST_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.selectedModelId) {
        const found = audioModels.find(m => m.id === data.selectedModelId);
        if (found) {
          selectedModel = found;
          selectedModelId = found.id;
        }
      }
      if (data.params) schemaParams = data.params;
      if (data.internalHistory) internalHistory = data.internalHistory;
      if (data.activeResultUrl) activeResultUrl = data.activeResultUrl;
      if (data.activeResultTitle) activeResultTitle = data.activeResultTitle;
      if (data.view) view = data.view;
    }
  } catch (err) {
    console.warn('Failed to load AudioStudio persistence:', err);
  }

  let persistTimer = null;
  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        const state = {
          selectedModelId,
          params: schemaParams,
          internalHistory,
          activeResultUrl,
          activeResultTitle,
          view,
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn('Failed to save AudioStudio persistence:', err);
      }
    }, 500);
  }

  // Header with hero banner
  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full';
  const audioBanner = createHeroSection('audio', 'h-32 md:h-44 mb-4');
  if (audioBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Audio Studio</h1><p class="text-white/60 text-sm">Generate music and speech with AI</p>';
    audioBanner.appendChild(bannerText);
    header.appendChild(audioBanner);
  }
  container.appendChild(header);

  // Model selector
  const modelWrapper = document.createElement('div');
  modelWrapper.className = 'w-full max-w-xl mb-6 animate-fade-in-up';
  modelWrapper.style.animationDelay = '0.1s';
  container.appendChild(modelWrapper);

  let modelSelectorEl = null;
  let selectedProvider = 'all';
  let searchQuery = '';

  const refreshModelSelector = () => {
    if (modelSelectorEl) {
      modelSelectorEl.remove();
    }
    modelSelectorEl = mountModelSelector(modelWrapper, {
      models: audioModels,
      selectedModelId: selectedModel.id,
      selectedProvider,
      search: searchQuery,
      showProviderName: true,
      onSelectModel: (modelId) => {
        selectedModel = audioModels.find(m => m.id === modelId) || audioModels[0];
        selectedModelId = selectedModel.id;
        schemaParams = {};
        updateFormVisibility();
        schedulePersist();
      },
      onSelectProvider: (provider) => {
        selectedProvider = provider;
        refreshModelSelector();
      },
      onSearch: (query) => {
        searchQuery = query;
        refreshModelSelector();
      },
    });
  };
  refreshModelSelector();

  // Form card
  const formCard = document.createElement('div');
  formCard.className = 'w-full max-w-xl bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.2s';

  // Prompt input
  const promptGroup = document.createElement('div');
  promptGroup.className = 'flex flex-col gap-2';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'text-sm font-bold text-secondary';
  promptLabel.textContent = 'Prompt';
  promptGroup.appendChild(promptLabel);
  const promptInput = document.createElement('textarea');
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:border-primary focus:outline-none resize-none';
  promptInput.rows = 3;
  promptInput.placeholder = 'Describe the music or speech you want to generate...';
  promptInput.setAttribute('aria-label', 'Audio prompt');
  promptInput.value = prompt;
  promptInput.oninput = (e) => { prompt = e.target.value; schedulePersist(); };
  promptGroup.appendChild(promptInput);
  const gtmBtn = document.createElement('button');
  gtmBtn.type = 'button';
  gtmBtn.textContent = 'GTM Boost';
  gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
  gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
  gtmBtn.className = 'gtm-boost-btn shrink-0';
  gtmBtn.addEventListener('click', () => {
    import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
      openGTMPromptModal('audio-studio', (p) => {
        promptInput.value = p;
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
        promptInput.focus();
      });
    }).catch((err) => console.error('[AudioStudio] GTM Boost failed:', err));
  });
  promptGroup.appendChild(gtmBtn);
  mountPersonalizeTrigger({ controlsContainer: formCard, getTextarea: () => promptInput, appId: 'audio-studio' });
  formCard.appendChild(promptGroup);

  // Schema-driven controls (rendered dynamically from model.inputs)
  const schemaControlsContainer = document.createElement('div');
  schemaControlsContainer.id = 'schema-controls';
  formCard.appendChild(schemaControlsContainer);

  // Style selector (for music models)
  const styleGroup = document.createElement('div');
  styleGroup.className = 'flex flex-col gap-2 hidden';
  const styleLabel = document.createElement('label');
  styleLabel.className = 'text-sm font-bold text-secondary';
  styleLabel.textContent = 'Style';
  styleGroup.appendChild(styleLabel);
  const styleSelect = document.createElement('select');
  styleSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none';
  styleSelect.innerHTML = `
    <option value="">Select a style</option>
    <option value="pop">Pop</option>
    <option value="rock">Rock</option>
    <option value="electronic">Electronic</option>
    <option value="classical">Classical</option>
    <option value="jazz">Jazz</option>
    <option value="hip-hop">Hip Hop</option>
    <option value="ambient">Ambient</option>
  `;
  styleSelect.value = style;
  styleSelect.onchange = (e) => { style = e.target.value; schedulePersist(); };
  styleGroup.appendChild(styleSelect);
  formCard.appendChild(styleGroup);

  // Duration selector
  const durationGroup = document.createElement('div');
  durationGroup.className = 'flex flex-col gap-2';
  const durationLabel = document.createElement('label');
  durationLabel.className = 'text-sm font-bold text-secondary';
  durationLabel.textContent = 'Duration';
  durationGroup.appendChild(durationLabel);
  const durationRow = document.createElement('div');
  durationRow.className = 'flex gap-2';
  ['15', '30', '60', '120'].forEach(d => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = d === duration
      ? 'px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black'
      : 'px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10';
    btn.textContent = `${d}s`;
    btn.onclick = () => {
      duration = d;
      updateDurationBtns();
      schedulePersist();
    };
    durationRow.appendChild(btn);
  });
  durationGroup.appendChild(durationRow);
  formCard.appendChild(durationGroup);

  // Voice selector (for TTS models)
  const voiceGroup = document.createElement('div');
  voiceGroup.className = 'flex flex-col gap-2 hidden';
  const voiceLabel = document.createElement('label');
  voiceLabel.className = 'text-sm font-bold text-secondary';
  voiceLabel.textContent = 'Voice';
  voiceGroup.appendChild(voiceLabel);
  const voiceSelect = document.createElement('select');
  voiceSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none';
  voiceSelect.innerHTML = `
    <option value="female-1">Female 1</option>
    <option value="male-qn-qingse">Male Qingse</option>
  `;
  voiceSelect.value = selectedVoice;
  voiceSelect.onchange = (e) => { selectedVoice = e.target.value; schedulePersist(); };
  voiceGroup.appendChild(voiceSelect);
  formCard.appendChild(voiceGroup);

  const toneOptions = ['Neutral', 'Cheerful', 'Serious', 'Excited', 'Calm', 'Empathetic', 'Warm', 'Authoritative'];
  const toneGroup = document.createElement('div');
  toneGroup.className = 'flex flex-col gap-2';
  const toneLabel = document.createElement('label');
  toneLabel.className = 'text-sm font-bold text-secondary';
  toneLabel.textContent = 'Tone';
  toneGroup.appendChild(toneLabel);
  const toneSelect = document.createElement('select');
  toneSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none';
  toneOptions.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.toLowerCase();
    opt.textContent = t;
    toneSelect.appendChild(opt);
  });
  toneSelect.value = toneValue;
  toneSelect.onchange = (e) => { toneValue = e.target.value; schedulePersist(); };
  toneGroup.appendChild(toneSelect);
  formCard.appendChild(toneGroup);

  const emotionOptions = ['None', 'Happy', 'Sad', 'Angry', 'Surprised', 'Fearful', 'Disgusted', 'Neutral'];
  const emotionGroup = document.createElement('div');
  emotionGroup.className = 'flex flex-col gap-2';
  const emotionLabel = document.createElement('label');
  emotionLabel.className = 'text-sm font-bold text-secondary';
  emotionLabel.textContent = 'Emotion';
  emotionGroup.appendChild(emotionLabel);
  const emotionSelect = document.createElement('select');
  emotionSelect.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none';
  emotionOptions.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.toLowerCase();
    opt.textContent = e;
    emotionSelect.appendChild(opt);
  });
  emotionSelect.value = emotionValue;
  emotionSelect.onchange = (e) => { emotionValue = e.target.value; schedulePersist(); };
  emotionGroup.appendChild(emotionSelect);
  formCard.appendChild(emotionGroup);

  // Speed control (for TTS models)
  const speedGroup = document.createElement('div');
  speedGroup.className = 'flex flex-col gap-2 hidden';
  const speedLabel = document.createElement('label');
  speedLabel.className = 'text-sm font-bold text-secondary';
  speedLabel.textContent = 'Speed';
  speedGroup.appendChild(speedLabel);
  const speedRow = document.createElement('div');
  speedRow.className = 'flex items-center gap-3';
  const speedInput = document.createElement('input');
  speedInput.type = 'range';
  speedInput.min = '0.5';
  speedInput.max = '2.0';
  speedInput.step = '0.1';
  speedInput.value = String(speed);
  speedInput.className = 'flex-1 accent-primary';
  speedInput.oninput = (e) => { speed = parseFloat(e.target.value); schedulePersist(); };
  const speedVal = document.createElement('span');
  speedVal.className = 'text-xs font-bold text-secondary w-10 text-right';
  speedVal.textContent = `${speed.toFixed(1)}x`;
  speedInput.addEventListener('input', () => {
    speedVal.textContent = `${parseFloat(speedInput.value).toFixed(1)}x`;
  });
  speedRow.appendChild(speedInput);
  speedRow.appendChild(speedVal);
  speedGroup.appendChild(speedRow);
  formCard.appendChild(speedGroup);

  // Pitch control (for TTS models)
  const pitchGroup = document.createElement('div');
  pitchGroup.className = 'flex flex-col gap-2 hidden';
  const pitchLabel = document.createElement('label');
  pitchLabel.className = 'text-sm font-bold text-secondary';
  pitchLabel.textContent = 'Pitch';
  pitchGroup.appendChild(pitchLabel);
  const pitchRow = document.createElement('div');
  pitchRow.className = 'flex items-center gap-3';
  const pitchInput = document.createElement('input');
  pitchInput.type = 'range';
  pitchInput.min = '0.5';
  pitchInput.max = '2.0';
  pitchInput.step = '0.1';
  pitchInput.value = String(pitch);
  pitchInput.className = 'flex-1 accent-primary';
  pitchInput.oninput = (e) => { pitch = parseFloat(e.target.value); schedulePersist(); };
  const pitchVal = document.createElement('span');
  pitchVal.className = 'text-xs font-bold text-secondary w-10 text-right';
  pitchVal.textContent = `${pitch.toFixed(1)}x`;
  pitchInput.addEventListener('input', () => {
    pitchVal.textContent = `${parseFloat(pitchInput.value).toFixed(1)}x`;
  });
  pitchRow.appendChild(pitchInput);
  pitchRow.appendChild(pitchVal);
  pitchGroup.appendChild(pitchRow);
  formCard.appendChild(pitchGroup);

  // Thumbnail studio button
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = 'Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'gtm-boost-btn w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new StudioThumbnailModal({
      appTheme: 'audio-studio',
      studioId: 'audio-studio',
      studioName: 'Audio Studio',
      aspectRatio: '16:9',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('audio-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('audio-studio');
      },
    });
    mountStudioThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  genBtn.textContent = 'Generate Audio';
  genBtn.setAttribute('aria-label', 'Generate audio');
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

  // Instructions
  const inlineInstructions = createInlineInstructions('audio');
  inlineInstructions.classList.add('max-w-md', 'mt-6');
  container.appendChild(inlineInstructions);

  // Result area
  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-xl mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  // Audio editor controls (trim + fade)
  const editorControls = document.createElement('div');
  editorControls.className = 'w-full max-w-xl mt-4 hidden';
  editorControls.id = 'audio-editor-controls';
  editorControls.innerHTML = `
    <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
      <div class="text-xs font-bold text-secondary uppercase tracking-wider">Audio Editor</div>
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <label class="text-[10px] font-bold text-muted uppercase tracking-wider w-12">Trim</label>
          <input type="range" id="trim-start" min="0" max="100" step="0.5" value="0" class="flex-1 accent-primary h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" aria-label="Trim start">
          <span id="trim-start-val" class="text-[10px] font-mono text-muted w-10 text-right">0%</span>
        </div>
        <div class="flex items-center gap-3">
          <label class="text-[10px] font-bold text-muted uppercase tracking-wider w-12">End</label>
          <input type="range" id="trim-end" min="0" max="100" step="0.5" value="100" class="flex-1 accent-primary h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" aria-label="Trim end">
          <span id="trim-end-val" class="text-[10px] font-mono text-muted w-10 text-right">100%</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <label class="text-[10px] font-bold text-muted uppercase tracking-wider">Fade</label>
        <button id="fade-in-btn" class="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-secondary hover:bg-white/10 transition-all">Fade In</button>
        <button id="fade-out-btn" class="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-secondary hover:bg-white/10 transition-all">Fade Out</button>
        <span id="fade-status" class="text-[10px] text-muted"></span>
      </div>
      <div class="flex items-center gap-2">
        <button id="apply-edits-btn" class="px-4 py-2 bg-primary text-black rounded-xl text-xs font-bold hover:shadow-glow transition-all">Apply Edits</button>
        <button id="reset-edits-btn" class="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition-all">Reset</button>
      </div>
    </div>
  `;
  container.appendChild(editorControls);

  // History grid
  const historyGridContainer = document.createElement('div');
  historyGridContainer.id = 'audio-history-grid';
  container.appendChild(historyGridContainer);

  // Loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/70 backdrop-blur-sm';
  loadingOverlay.innerHTML = `
    <div class="flex flex-col items-center gap-4 p-8 rounded-2xl border border-white/10 bg-card-bg shadow-3xl">
      <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p class="text-sm font-medium text-secondary text-center max-w-xs">Generating audio...</p>
    </div>
  `;
  container.appendChild(loadingOverlay);

  function showLoading() {
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
    loadingOverlay.classList.remove('flex');
  }

  function updateDurationBtns() {
    const durationRow = durationGroup.querySelector('.flex.gap-2');
    Array.from(durationRow.children).forEach((btn, i) => {
      const d = ['15', '30', '60', '120'][i];
      btn.className = d === duration
        ? 'px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black'
        : 'px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10';
    });
  }

  function updateFormVisibility() {
    const modelType = selectedModel.type;
    const supportsPrompt = selectedModel.hasPrompt !== false;
    promptGroup.classList.toggle('hidden', !supportsPrompt);

    const supportsStyles = selectedModel.supportsStyles || modelType === 'music';
    styleGroup.classList.toggle('hidden', !supportsStyles);

    const supportsVoice = modelType === 'tts';
    voiceGroup.classList.toggle('hidden', !supportsVoice);

    const supportsSpeedPitch = modelType === 'tts';
    speedGroup.classList.toggle('hidden', !supportsSpeedPitch);
    pitchGroup.classList.toggle('hidden', !supportsSpeedPitch);

    renderSchemaControlsSection();
  }

  function renderSchemaControlsSection() {
    schemaControlsContainer.innerHTML = '';
    renderSchemaControls(selectedModel, schemaParams, (updater) => {
      schemaParams = typeof updater === 'function' ? updater(schemaParams) : updater;
      schedulePersist();
    }, schemaControlsContainer, apiKey);
  }

  function cleanupResult() {
    if (resultArea._wavesurfer) {
      try { resultArea._wavesurfer.destroy(); } catch { /* ignore destroy error */ }
      resultArea._wavesurfer = null;
    }
  }

  async function renderResultPlayer(url) {
    cleanupResult();
    resultArea.classList.remove('hidden');
    resultArea.innerHTML = `
      <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
        <div id="waveform-container" class="w-full h-24 mb-3 rounded-xl overflow-hidden bg-white/5"></div>
        <div class="flex items-center gap-3 mb-3">
          <button id="waveform-play-btn" class="w-10 h-10 bg-primary hover:bg-primary/80 text-black rounded-xl flex items-center justify-center transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <span id="waveform-time" class="text-xs font-bold text-secondary tabular-nums">0:00 / 0:00</span>
        </div>
        <audio id="waveform-audio" class="hidden" src="${url}" type="audio/mpeg"></audio>
        <a href="${url}" download class="block w-full bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download Audio</a>
      </div>
      <div id="audio-editor-controls" class="mt-4 bg-[#111]/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
        <div class="text-xs font-bold text-secondary uppercase tracking-wider">Audio Editor</div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <label class="text-[10px] font-bold text-muted uppercase tracking-wider w-12">Trim</label>
            <input type="range" id="trim-start" min="0" max="100" step="0.5" value="0" class="flex-1 accent-primary h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" aria-label="Trim start">
            <span id="trim-start-val" class="text-[10px] font-mono text-muted w-10 text-right">0%</span>
          </div>
          <div class="flex items-center gap-3">
            <label class="text-[10px] font-bold text-muted uppercase tracking-wider w-12">End</label>
            <input type="range" id="trim-end" min="0" max="100" step="0.5" value="100" class="flex-1 accent-primary h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer" aria-label="Trim end">
            <span id="trim-end-val" class="text-[10px] font-mono text-muted w-10 text-right">100%</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <label class="text-[10px] font-bold text-muted uppercase tracking-wider">Fade</label>
          <button id="fade-in-btn" class="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-secondary hover:bg-white/10 transition-all">Fade In</button>
          <button id="fade-out-btn" class="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-secondary hover:bg-white/10 transition-all">Fade Out</button>
          <span id="fade-status" class="text-[10px] text-muted"></span>
        </div>
        <div class="flex items-center gap-2">
          <button id="apply-edits-btn" class="px-4 py-2 bg-primary text-black rounded-xl text-xs font-bold hover:shadow-glow transition-all">Apply Edits</button>
          <button id="reset-edits-btn" class="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition-all">Reset</button>
        </div>
      </div>
    `;

    try {
      const WaveSurfer = (await import('wavesurfer.js')).default;
      const waveformContainer = resultArea.querySelector('#waveform-container');
      const audioEl = resultArea.querySelector('#waveform-audio');
      const playBtn = resultArea.querySelector('#waveform-play-btn');
      const timeDisplay = resultArea.querySelector('#waveform-time');

      if (waveformContainer && audioEl) {
        const wavesurfer = WaveSurfer.create({
          container: waveformContainer,
          waveColor: 'rgba(255, 255, 255, 0.2)',
          progressColor: '#d9ff00',
          cursorColor: '#d9ff00',
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 80,
          normalize: true,
          url: url,
        });

        wavesurfer.on('timeupdate', (currentTime) => {
          const duration = wavesurfer.getDuration() || 0;
          const format = (t) => {
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
          };
          if (timeDisplay) timeDisplay.textContent = `${format(currentTime)} / ${format(duration)}`;
        });

        wavesurfer.on('play', () => {
          if (playBtn) {
            playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
          }
        });

        wavesurfer.on('pause', () => {
          if (playBtn) {
            playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
          }
        });

        wavesurfer.on('finish', () => {
          if (playBtn) {
            playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
          }
        });

        if (playBtn) {
          playBtn.onclick = () => {
            wavesurfer.playPause();
          };
        }

        waveformContainer.onclick = (e) => {
          const rect = waveformContainer.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pct = x / rect.width;
          const duration = wavesurfer.getDuration();
          if (duration) wavesurfer.seekTo(pct);
        };

        resultArea._wavesurfer = wavesurfer;

        // Wire up audio editor controls
        const trimStart = resultArea.querySelector('#trim-start');
        const trimEnd = resultArea.querySelector('#trim-end');
        const trimStartVal = resultArea.querySelector('#trim-start-val');
        const trimEndVal = resultArea.querySelector('#trim-end-val');
        const fadeInBtn = resultArea.querySelector('#fade-in-btn');
        const fadeOutBtn = resultArea.querySelector('#fade-out-btn');
        const fadeStatus = resultArea.querySelector('#fade-status');
        const applyEditsBtn = resultArea.querySelector('#apply-edits-btn');
        const resetEditsBtn = resultArea.querySelector('#reset-edits-btn');

        let fadeInEnabled = false;
        let fadeOutEnabled = false;

        function updateFadeStatus() {
          if (!fadeStatus) return;
          const parts = [];
          if (fadeInEnabled) parts.push('Fade In');
          if (fadeOutEnabled) parts.push('Fade Out');
          fadeStatus.textContent = parts.length > 0 ? parts.join(' + ') : '';
        }

        if (trimStart && trimStartVal) {
          trimStart.oninput = () => {
            trimStartVal.textContent = trimStart.value + '%';
            const pct = parseFloat(trimStart.value) / 100;
            const duration = wavesurfer.getDuration();
            if (duration) wavesurfer.setTime(pct * duration);
          };
        }

        if (trimEnd && trimEndVal) {
          trimEnd.oninput = () => {
            trimEndVal.textContent = trimEnd.value + '%';
          };
        }

        if (fadeInBtn) {
          fadeInBtn.onclick = () => {
            fadeInEnabled = !fadeInEnabled;
            fadeInBtn.classList.toggle('bg-primary/20', fadeInEnabled);
            fadeInBtn.classList.toggle('text-primary', fadeInEnabled);
            fadeInBtn.classList.toggle('border-primary/30', fadeInEnabled);
            updateFadeStatus();
          };
        }

        if (fadeOutBtn) {
          fadeOutBtn.onclick = () => {
            fadeOutEnabled = !fadeOutEnabled;
            fadeOutBtn.classList.toggle('bg-primary/20', fadeOutEnabled);
            fadeOutBtn.classList.toggle('text-primary', fadeOutEnabled);
            fadeOutBtn.classList.toggle('border-primary/30', fadeOutEnabled);
            updateFadeStatus();
          };
        }

        if (applyEditsBtn) {
          applyEditsBtn.onclick = () => {
            showToast('Audio edits applied (trim/fade simulation)', 'success');
          };
        }

        if (resetEditsBtn) {
          resetEditsBtn.onclick = () => {
            fadeInEnabled = false;
            fadeOutEnabled = false;
            if (trimStart) { trimStart.value = '0'; trimStartVal.textContent = '0%'; }
            if (trimEnd) { trimEnd.value = '100'; trimEndVal.textContent = '100%'; }
            if (fadeInBtn) { fadeInBtn.classList.remove('bg-primary/20', 'text-primary', 'border-primary/30'); }
            if (fadeOutBtn) { fadeOutBtn.classList.remove('bg-primary/20', 'text-primary', 'border-primary/30'); }
            updateFadeStatus();
            wavesurfer.setTime(0);
          };
        }
      }
    } catch (err) {
      console.error('[AudioStudio] WaveSurfer init failed:', err);
      const waveformContainer = resultArea.querySelector('#waveform-container');
      if (waveformContainer) {
        waveformContainer.innerHTML = `
          <audio controls class="w-full" src="${url}" type="audio/mpeg" style="accent-color: #d9ff00;">
            Your browser does not support the audio element.
          </audio>
        `;
      }
    }
  }

  function renderHistoryGrid() {
    const existing = document.getElementById('audio-history-grid');
    if (existing) existing.remove();

    const grid = createHistoryGrid(internalHistory, activeResultUrl, view, (entry, _idx) => {
      activeResultUrl = entry.url;
      activeResultTitle = entry.title || entry.prompt || 'Generated Track';
      view = 'result';
      renderResultPlayer(entry.url);
      renderHistoryGrid();
      schedulePersist();
    });

    if (grid) {
      container.appendChild(grid);
    }
  }

  function addToHistory(entry) {
    internalHistory = [entry, ...internalHistory].slice(0, 30);
    renderHistoryGrid();
    schedulePersist();
  }

  // Generate button handler
  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (selectedModel.hasPrompt !== false && !prompt.trim()) {
      showToast('Please enter a prompt for this model.', 'error');
      return;
    }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) {
      AuthModal(() => genBtn.click());
      return;
    }

    genBtn.disabled = true;
    genBtn.textContent = 'Generating...';
    showLoading();

    cleanupResult();

    try {
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      const processedPrompt = replaceTokensInPrompt(prompt, activeProfile);
      let result;
      const modelType = selectedModel.type;

      if (modelType === 'music') {
        result = await muapi.generateMusic({
          model: selectedModel.id,
          prompt: processedPrompt,
          style: style || undefined,
          duration: parseInt(duration),
          ...schemaParams,
        });
      } else if (modelType === 'tts') {
        result = await muapi.generateAudio({
          model: selectedModel.id,
          text: processedPrompt,
          speed: speed,
          voice: selectedVoice,
          ...schemaParams,
        });
      } else {
        const params = {
          model: selectedModel.id,
          prompt: processedPrompt,
          duration: parseInt(duration),
          ...schemaParams,
        };
        if (style) params.style = style;
        result = await muapi.generateAudio(params);
      }

      if (result?.url) {
        const title = schemaParams.title || prompt || `Generated ${selectedModel.name}`;
        const entry = {
          id: result.id || Date.now().toString(),
          url: result.url,
          title,
          prompt: processedPrompt,
          model: selectedModelId,
          timestamp: new Date().toISOString(),
        };
        addToHistory(entry);
        activeResultUrl = result.url;
        activeResultTitle = title;
        view = 'result';
        renderResultPlayer(result.url);
        schedulePersist();
        showToast('Audio generated successfully!', 'success');
      }
    } catch (err) {
      console.error('[AudioStudio]', err);
      const errMsg = formatErrorMessage(err, 'Failed to generate audio');
      showToast(errMsg, 'error');
    } finally {
      hideLoading();
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Audio';
    }
  };

  updateFormVisibility();

  if (activeResultUrl && view === 'result') {
    renderResultPlayer(activeResultUrl);
  }

  renderHistoryGrid();

  // MiniMax H3 example styles — demos that align with this studio, shown as
  // examples at the bottom of the controls. Each card opens a detail modal;
  // "Create This Style" opens this studio pre-filled with the selected style.
  Promise.all([
    import('./demos/DemoRail.jsx'),
    import('../data/minimax/presets.js'),
  ]).then(([{ createDemoRail }, { minimaxPresets }]) => {
    const items = minimaxPresets.filter((p) => p.targetStudio === 'AudioStudio');
    if (!items.length) return;
    const rail = createDemoRail({
      items,
      source: 'minimax',
      variant: 'rail',
      title: 'MiniMax H3 Example Styles',
      subtitle: 'Examples for this studio — click any clip, or create in this style',
      className: 'mt-10 max-w-6xl mx-auto',
    });
    container.appendChild(rail);
  }).catch((e) => {
    console.error('[AudioStudio] demo rail failed', e);
  });

  return container;
}
