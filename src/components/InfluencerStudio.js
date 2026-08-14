import { muapi } from '../lib/muapi.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';
import { getModelById } from '../lib/models.js';

const STYLE_PRESETS = [
  'Realistic', 'DigitalCam', 'Quiet luxury', 'FashionShow', '90s Grain', 'Sunset beach',
  'Amalfi Summer', 'Bimbocore', 'Vintage PhotoBooth', 'Gorpcore', 'Indie sleaze',
  'Fairycore', 'Avant-garde', 'Y2K Posters', 'Grunge', 'Coquette core', 'Tokyo Streetstyle',
  '2049', 'Night rider', 'Glazed doll skin makeup',
];

const FORMAT_PRESETS = [
  { name: 'Instagram Post', ar: '1:1' },
  { name: 'Story / Reel', ar: '9:16' },
  { name: 'YouTube Thumb', ar: '16:9' },
  { name: 'Pinterest Pin', ar: '2:3' },
];

export function InfluencerStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10';
  mountStudioChrome(container, { currentRoute: 'influencer' });

  let uploadedUrl = null;
  let selectedStyle = STYLE_PRESETS[0];
  let selectedFormat = FORMAT_PRESETS[0];
  let customThumbnailUrl = getCustomThumbnailFromCache('influencer-studio');
  let dynamicControls = null;
  let dynamicControlsContainer = null;

  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full max-w-xl';
  const influBanner = createHeroSection('influencer', 'h-32 md:h-44 mb-4');
  if (influBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">AI Influencer Studio</h1><p class="text-white/60 text-sm max-w-md">Generate social content with 20+ fashion presets and format templates</p>';
    influBanner.appendChild(bannerText);
    header.appendChild(influBanner);
  }
  container.appendChild(header);

  const formCard = document.createElement('div');
  formCard.className = 'w-full max-w-xl bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.15s';

  const uploadRow = document.createElement('div');
  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider block mb-2';
  uploadLabel.textContent = 'Your Photo';
  uploadRow.appendChild(uploadLabel);
  const uploadInner = document.createElement('div');
  uploadInner.className = 'flex items-center gap-4';
  const picker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => { uploadedUrl = url; },
    onClear: () => { uploadedUrl = null; },
  });
  uploadInner.appendChild(picker.trigger);
  const uploadHint = document.createElement('span');
  uploadHint.className = 'text-sm text-muted';
  uploadHint.textContent = 'Upload reference photo or video';
  uploadInner.appendChild(uploadHint);
  uploadRow.appendChild(uploadInner);
  formCard.appendChild(uploadRow);
  container.appendChild(picker.panel);

  const pexelsBtn = document.createElement('button');
  pexelsBtn.type = 'button';
  pexelsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
  pexelsBtn.title = 'Browse stock photos from Pexels';
  pexelsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
  pexelsBtn.onclick = async () => {
    const { browsePexelsImages } = await import('../lib/studioPexels.js');
    browsePexelsImages({
      title: 'Select Reference Photo',
      studioName: 'AI Influencer Studio',
      onSelect: (asset) => {
        uploadedUrl = asset.src?.large || asset.url || asset.original;
        const attrContainer = document.getElementById('pexels-influencer-attribution');
        if (attrContainer) {
          attrContainer.innerHTML = '';
          import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
        }
      }
    });
  };
  uploadInner.appendChild(pexelsBtn);
  const pexelsInfluencerAttr = document.createElement('div');
  pexelsInfluencerAttr.id = 'pexels-influencer-attribution';
  pexelsInfluencerAttr.className = 'mt-1';
  uploadInner.appendChild(pexelsInfluencerAttr);

  const styleLabel = document.createElement('label');
  styleLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  styleLabel.textContent = 'Style Preset';
  formCard.appendChild(styleLabel);

  const styleGrid = document.createElement('div');
  styleGrid.className = 'flex flex-wrap gap-2 max-h-32 overflow-y-auto';
  STYLE_PRESETS.forEach(s => {
    const chip = document.createElement('button');
    chip.className = s === selectedStyle
      ? 'px-3 py-1.5 rounded-full text-xs font-bold bg-primary text-black transition-all'
      : 'px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all';
    chip.textContent = s;
    chip.onclick = () => {
      selectedStyle = s;
      styleGrid.querySelectorAll('button').forEach(b => {
        b.className = b.textContent === s
          ? 'px-3 py-1.5 rounded-full text-xs font-bold bg-primary text-black transition-all'
          : 'px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all';
      });
    };
    styleGrid.appendChild(chip);
  });
  formCard.appendChild(styleGrid);

  const formatLabel = document.createElement('label');
  formatLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  formatLabel.textContent = 'Output Format';
  formCard.appendChild(formatLabel);

  const formatRow = document.createElement('div');
  formatRow.className = 'flex gap-2 flex-wrap';
  FORMAT_PRESETS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = f.name === selectedFormat.name
      ? 'px-4 py-2 rounded-xl text-xs font-bold bg-primary text-black transition-all'
      : 'px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all border border-white/10';
    btn.textContent = `${f.name} (${f.ar})`;
    btn.onclick = () => {
      selectedFormat = f;
      formatRow.querySelectorAll('button').forEach(b => {
        const isActive = b.textContent.includes(f.name);
        b.className = isActive
          ? 'px-4 py-2 rounded-xl text-xs font-bold bg-primary text-black transition-all'
          : 'px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-secondary hover:bg-white/10 transition-all border border-white/10';
      });
    };
    formatRow.appendChild(btn);
  });
  formCard.appendChild(formatRow);

  const promptInput = document.createElement('textarea');
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none';
  promptInput.rows = 2;
  promptInput.placeholder = 'Additional instructions (optional)';
  promptInput.setAttribute('aria-label', 'Influencer prompt');
  formCard.appendChild(promptInput);
    // GTM Boost entry point — opens the prompt enhancer themed for influencer
    // content and loads the result straight into this prompt.
    const gtmBtn = document.createElement('button');
    gtmBtn.type = 'button';
    gtmBtn.textContent = '🎯 GTM Boost';
    gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBtn.className = 'gtm-boost-btn shrink-0';
    gtmBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('influencer-studio', (prompt) => {
          promptInput.value = prompt;
          promptInput.dispatchEvent(new Event('input', { bubbles: true }));
          promptInput.focus();
        });
      }).catch((err) => console.error('[InfluencerStudio] GTM Boost failed:', err));
    });
    formCard.appendChild(gtmBtn);
  mountPersonalizeTrigger({ controlsContainer: formCard, getTextarea: () => promptInput, appId: 'influencer-studio' });

  // Dynamic model-specific advanced controls
  dynamicControlsContainer = document.createElement('div');
  dynamicControlsContainer.className = 'flex flex-col gap-3';
  formCard.appendChild(dynamicControlsContainer);

  function buildDynamicControls() {
    if (!dynamicControlsContainer) return;
    if (dynamicControls) dynamicControls.destroy();
    const model = getExtendedModel(getModelById('higgsfield-soul-image-to-image'));
    if (!model || !model.inputs || Object.keys(model.inputs).length === 0) {
      dynamicControlsContainer.classList.add('hidden');
      return;
    }
    dynamicControlsContainer.classList.remove('hidden');
    dynamicControls = createAdvancedControls({
      model,
      container: dynamicControlsContainer,
      exclude: new Set(['image_url', 'prompt', 'aspect_ratio', 'style']),
    });
  }
  buildDynamicControls();

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'gtm-boost-btn w-full mt-2';
  thumbBtn.addEventListener('click', () => {
    const modal = new StudioThumbnailModal({
      appTheme: 'influencer-studio',
      studioId: 'influencer-studio',
      studioName: 'AI Influencer Studio',
      aspectRatio: selectedFormat.ar || '1:1',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('influencer-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('influencer-studio');
      },
    });
    mountStudioThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);

  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all mt-2';
  genBtn.textContent = 'Generate Content';
  genBtn.setAttribute('aria-label', 'Generate content');
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-xl mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!uploadedUrl) { alert('Upload a photo first'); return; }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { AuthModal(() => genBtn.click()); return; }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    try {
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      const prompt = `Style preset: ${selectedStyle}. ${replaceTokensInPrompt(promptInput.value.trim(), activeProfile) || 'Fashion editorial photo, professional quality'}`;
      const params = {
        model: 'flux-kontext-pro-i2i',
        image_url: uploadedUrl,
        prompt,
        style: selectedStyle,
        aspect_ratio: selectedFormat.ar,
        customThumbnailUrl: customThumbnailUrl || undefined,
      };
      if (dynamicControls) {
        Object.assign(params, dynamicControls.getPayload({}));
      }
      const result = await muapi.generateI2I(params);
      if (result?.url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4 animate-fade-in-up">
            <img src="${result.url}" class="w-full rounded-xl mb-3">
            <div class="flex gap-3">
              <a href="${result.url}" download class="flex-1 bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a>
              <button class="flex-1 bg-white/10 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-white/20 transition-all regen-btn">Generate Again</button>
            </div>
          </div>
        `;
        resultArea.querySelector('.regen-btn').onclick = () => genBtn.click();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Content';
    }
  };

  return container;
}
