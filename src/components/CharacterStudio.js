import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { mountModelSelector, getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle } from '../lib/modelSelectorUI.js';
import { createAdvancedControls } from '../lib/studioControls.js';
import { getExtendedModel } from '../lib/modelInputExtensions.js';
import { getModelById } from '../lib/models.js';
import { getAssetsForStudio } from '../data/exampleGalleryAssets.js';
import ExampleGallery from './studios/ExampleGallery.js';
import { resolveTemplate, loadTemplatePrompt } from '../lib/showcaseTemplateResolver.js';
import { getAcademyCreateTarget } from '../data/academyStudioAdapters.js';

const CHARACTER_MODELS = [
  { id: 'flux-pulid', name: 'Flux PuLID', description: 'Face ID preservation with text prompt', provider: 'blackforest', provider_name: 'Black Forest Labs' },
  { id: 'minimax-image-01-subject-reference', name: 'Subject Reference', description: 'Maintain subject consistency across images', provider: 'minimax', provider_name: 'MiniMax' },
];

export function CharacterStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'character' });

  let uploadedUrl = null;
  let customThumbnailUrl = getCustomThumbnailFromCache('character-studio');
  let selectedModel = CHARACTER_MODELS[0];
const dynamicControls = null;
  const dynamicControlsContainer = null;

  // Read gallery / deep-link params and apply them as studio defaults.
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const templateParam = urlParams.get('template');
    const academyParam = urlParams.get('academy-template');
    const promptParam = urlParams.get('prompt');
    const styleParam = urlParams.get('style');
    const arParam = urlParams.get('aspect_ratio');
    const durationParam = urlParams.get('duration');

    if (templateParam) {
      const tpl = resolveTemplate(templateParam);
      if (tpl) {
        if (tpl.model) { selectedModel = tpl.model; }
        if (tpl.aspectRatio) { /* set aspect ratio */ }
        if (tpl.duration) { /* set duration */ }
        if (tpl.basePrompt) {
          const ta = document.getElementById('character-prompt-input');
          if (ta) ta.value = tpl.basePrompt;
        } else if (tpl.slug) {
          loadTemplatePrompt(templateParam).then((prompt) => {
            if (prompt) {
              const ta = document.getElementById('character-prompt-input');
              if (ta) ta.value = prompt;
            }
          }).catch(() => {});
        }
      }
    }

    if (academyParam || promptParam) {
      const target = academyParam ? getAcademyCreateTarget(academyParam) : null;
      const params = target?.params || {};
      if (params.prompt) {
        const ta = document.getElementById('character-prompt-input');
        if (ta) ta.value = params.prompt;
      }
      if (params.aspect_ratio) { /* set aspect ratio */ }
      if (params.duration) { /* set duration */ }
    }
  } catch { /* ignore */ }

  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full max-w-lg';
  const charBanner = createHeroSection('character', 'h-32 md:h-44 mb-4');
  if (charBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Character Studio</h1><p class="text-white/60 text-sm max-w-md">Generate consistent character images using face ID preservation</p>';
    charBanner.appendChild(bannerText);
    header.appendChild(charBanner);
  }
  container.appendChild(header);

  const formCard = document.createElement('div');
  formCard.className = 'w-full max-w-lg bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.15s';

  const modelLabel = document.createElement('label');
  modelLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  modelLabel.textContent = 'Model';
  formCard.appendChild(modelLabel);

  const modelWrapper = document.createElement('div');
  modelWrapper.className = 'flex flex-col items-center gap-2';

  const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.className = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border bg-white/5 text-secondary border-white/10 hover:bg-white/10';
  const updateTrigger = () => {
    const provider = selectedModel.provider || 'muapi';
    const logoUrl = PROVIDER_LOGOS[provider];
    if (logoUrl) {
      triggerBtn.innerHTML = `<div class="w-4 h-4 rounded flex items-center justify-center overflow-hidden bg-white/5 shrink-0"><img src="${logoUrl}" alt="" class="w-full h-full object-contain ${invertLogos.includes(provider) ? 'invert' : ''}" /></div><span class="truncate">${selectedModel.name}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
    } else {
      const style = getProviderStyle(provider);
      triggerBtn.innerHTML = `<div class="w-4 h-4 bg-primary rounded flex items-center justify-center shadow-lg shadow-primary/20 shrink-0"><span class="text-[8px] font-black text-black">${style.text}</span></div><span class="truncate">${selectedModel.name}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted shrink-0"><polyline points="6 9 12 15 18 9"/></svg>`;
    }
  };
  updateTrigger();

  const dropdown = document.createElement('div');
  dropdown.className = 'fixed z-[100] bg-[#111] border border-white/10 rounded-2xl shadow-3xl p-2 opacity-0 pointer-events-none transition-all duration-200 scale-95 origin-bottom';
  dropdown.style.width = 'calc(100vw - 2rem)';
  dropdown.style.maxWidth = '480px';
  dropdown.style.maxHeight = '70vh';
  dropdown.style.minHeight = '350px';

  const closeDropdown = () => {
    dropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
    dropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
  };

  const openDropdown = () => {
    dropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
    dropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
    if (!dropdown.dataset.populated) {
      dropdown.dataset.populated = 'true';
      mountModelSelector(dropdown, {
        models: CHARACTER_MODELS,
        selectedModelId: selectedModel.id,
        showProviderName: true,
        onSelectModel: (modelId) => {
          selectedModel = CHARACTER_MODELS.find(x => x.id === modelId) || { id: modelId };
          updateTrigger();
          buildDynamicControls();
          closeDropdown();
        },
      });
}
  };

  triggerBtn.onclick = (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('opacity-100')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  modelWrapper.appendChild(triggerBtn);
  modelWrapper.appendChild(dropdown);
  formCard.appendChild(modelWrapper);

  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
        closeDropdown();
      }
    });
  }, 0);

  const uploadLabel = document.createElement('label');
  uploadLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  uploadLabel.textContent = 'Reference Face';
  formCard.appendChild(uploadLabel);

  const uploadRow = document.createElement('div');
  uploadRow.className = 'flex items-center gap-4';
  const picker = createUploadPicker({
    anchorContainer: container,
    onSelect: ({ url }) => { uploadedUrl = url; },
    onClear: () => { uploadedUrl = null; },
  });
  uploadRow.appendChild(picker.trigger);
  const hint = document.createElement('span');
  hint.className = 'text-sm text-muted';
  hint.textContent = 'Upload a clear face photo or video';
  uploadRow.appendChild(hint);
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
      studioName: 'Character Studio',
      onSelect: (asset) => {
        uploadedUrl = asset.src?.large || asset.url || asset.original;
        const attrContainer = document.getElementById('pexels-character-attribution');
        if (attrContainer) {
          attrContainer.innerHTML = '';
          import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, attrContainer));
        }
      }
    });
  };
  uploadRow.appendChild(pexelsBtn);
  const pexelsCharacterAttr = document.createElement('div');
  pexelsCharacterAttr.id = 'pexels-character-attribution';
  pexelsCharacterAttr.className = 'mt-1';
  uploadRow.appendChild(pexelsCharacterAttr);

  const promptLabel = document.createElement('label');
  promptLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  promptLabel.textContent = 'Character Description';
  formCard.appendChild(promptLabel);

  const promptInput = document.createElement('textarea');
  promptInput.id = 'character-prompt-input';
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none';
  promptInput.rows = 3;
  promptInput.placeholder = 'e.g. wearing a leather jacket, standing in a neon-lit alley, cyberpunk style';
  promptInput.setAttribute('aria-label', 'Character description');
  formCard.appendChild(promptInput);

  // Prompt Gallery button
  const promptGalleryBtn = document.createElement('button');
  promptGalleryBtn.type = 'button';
  promptGalleryBtn.textContent = '📚 Prompts';
  promptGalleryBtn.title = 'Browse prompt gallery';
  promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
  promptGalleryBtn.className = 'btn-ghost-modern shrink-0';
  promptGalleryBtn.addEventListener('click', () => {
    openPromptGallery({
      appTheme: 'character-studio',
      onSelect: (prompt) => {
        const ta = document.querySelector('textarea');
        if (ta) {
          ta.value = prompt;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.focus();
        }
      }
    }).catch((err) => console.error('[PromptGallery] open failed:', err));
  });
  formCard.appendChild(promptGalleryBtn);

  // Recipe Engine button
  const recipeBtn = document.createElement('button');
  recipeBtn.type = 'button';
  recipeBtn.textContent = '📋 Recipes';
  recipeBtn.title = 'Browse AI recipes';
  recipeBtn.setAttribute('aria-label', 'Open recipe engine');
  recipeBtn.className = 'btn-ghost-modern shrink-0';
  recipeBtn.addEventListener('click', () => {
    openRecipeModal({
      onRunRecipe: (url) => {
      }
    }).catch((err) => console.error('[Recipe] open failed:', err));
  });
  formCard.appendChild(recipeBtn);

  // Monetization Hub button
  const monetizationBtn = document.createElement('button');
  monetizationBtn.type = 'button';
  monetizationBtn.textContent = "💼 Smart Video AI Monetize";
  monetizationBtn.title = "Open Smart Video AI Monetization Hub";
  monetizationBtn.setAttribute('aria-label', 'Open Smart Video AI Monetization Hub');
  monetizationBtn.className = 'btn-ghost-modern shrink-0';
  monetizationBtn.addEventListener('click', () => {
    openMonetizationHub().catch((err) => console.error('[Monetization] open failed:', err));
  });
  formCard.appendChild(monetizationBtn);

  // GTM Boost entry point — opens the prompt enhancer themed for character
  // creation and loads the result straight into this prompt.
  const gtmBtn = document.createElement('button');
  gtmBtn.type = 'button';
  gtmBtn.textContent = '🎯 GTM Boost';
  gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
  gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
  gtmBtn.className = 'gtm-boost-btn shrink-0';
  gtmBtn.addEventListener('click', () => {
    import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
      openGTMPromptModal('character-studio', (prompt) => {
        promptInput.value = prompt;
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
        promptInput.focus();
      });
    }).catch((err) => console.error('[CharacterStudio] GTM Boost failed:', err));
  });
  formCard.appendChild(gtmBtn);

  // Personalize trigger (opens PersonalizeModal as a pop-up)
  const personalizeControls = document.createElement('div');
  personalizeControls.className = 'flex items-center gap-2';
  mountPersonalizeTrigger({
      controlsContainer: personalizeControls,
      getTextarea: () => promptInput,
      appId: 'character-studio',
  });
  formCard.appendChild(personalizeControls);

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'btn-ghost-modern w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'character-studio',
      layout: 'panel',
      studioId: 'character-studio',
      studioName: 'Character Studio',
      aspectRatio: '1:1',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('character-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('character-studio');
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);

  const genBtn = document.createElement('button');
genBtn.type = 'button';
  genBtn.className = 'btn-primary-modern w-full px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-all mt-2';
  genBtn.textContent = 'Generate Character';
  genBtn.setAttribute('aria-label', 'Generate character');
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

  const inlineInstructions = createInlineInstructions('character');
  inlineInstructions.classList.add('max-w-lg', 'mt-6');
  container.appendChild(inlineInstructions);

  // ==========================================
  // EXPRESSION PRESETS
  // ==========================================
  const expressionSection = document.createElement('div');
  expressionSection.className = 'w-full max-w-lg mt-6';
  expressionSection.innerHTML = `
    <h3 class="text-sm font-bold text-white mb-3">Expression Presets</h3>
    <div class="flex gap-2 flex-wrap">
      <button class="expr-btn px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all" data-expr="happy">😊 Happy</button>
      <button class="expr-btn px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all" data-expr="sad">😢 Sad</button>
      <button class="expr-btn px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all" data-expr="angry">😠 Angry</button>
      <button class="expr-btn px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all" data-expr="surprised">😲 Surprised</button>
      <button class="expr-btn px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all" data-expr="neutral">😐 Neutral</button>
    </div>
  `;
  container.appendChild(expressionSection);

  // Expression click handlers
  expressionSection.querySelectorAll('.expr-btn').forEach(btn => {
    btn.onclick = () => {
      const expr = btn.dataset.expr;
      const exprMap = {
        'happy': 'smiling, happy expression, cheerful',
        'sad': 'sad expression, melancholy, tearful eyes',
        'angry': 'angry expression, furious, glaring',
        'surprised': 'surprised expression, shocked, wide eyes',
        'neutral': 'neutral expression, calm, poker face'
      };
      promptInput.value = promptInput.value.trim() 
        ? promptInput.value + ', ' + exprMap[expr] 
        : exprMap[expr];
    };
  });

  // ==========================================
  // CHARACTER LIBRARY (from localStorage)
  // ==========================================
  const librarySection = document.createElement('div');
  librarySection.className = 'w-full max-w-lg mt-6';
  const savedCharacters = JSON.parse(localStorage.getItem('character_library') || '[]');
  
  librarySection.innerHTML = `
    <h3 class="text-sm font-bold text-white mb-3 flex items-center justify-between">
      Saved Characters 
      <span class="text-xs font-normal text-muted">${savedCharacters.length} saved</span>
    </h3>
    ${savedCharacters.length > 0 ? `
      <div class="grid grid-cols-2 gap-2">
        ${savedCharacters.map(c => `
          <div class="bg-white/[0.03] border border-white/5 rounded-xl p-2 flex items-center gap-2 cursor-pointer hover:bg-white/[0.06] character-item" data-id="${c.id}">
            <img src="${c.thumbnail}" class="w-12 h-12 rounded-lg object-cover">
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold text-white truncate">${c.name}</div>
              <div class="text-[10px] text-muted truncate">${c.description || 'No description'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `
      <div class="text-center py-6 text-muted text-xs">
        No saved characters yet. Generate a character and save it!
      </div>
    `}
  `;
  container.appendChild(librarySection);

  // Character item click handlers
  librarySection.querySelectorAll('.character-item').forEach(item => {
    item.onclick = () => {
      const char = savedCharacters.find(c => c.id === item.dataset.id);
      if (char) {
        uploadedUrl = char.imageUrl;
        promptInput.value = char.description || '';
        alert(`Loaded character: ${char.name}`);
      }
    };
  });

  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-lg mt-6 hidden';
  resultArea.setAttribute('role', 'status');
  resultArea.setAttribute('aria-live', 'polite');
  container.appendChild(resultArea);

  genBtn.onclick = async () => {
    if (!(await requireEntitlement())) return;
    if (!uploadedUrl) { alert('Upload a reference face first'); return; }
    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { AuthModal(() => genBtn.click()); return; }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    try {
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      const params = {
        model: selectedModel.id,
        image_url: uploadedUrl,
        prompt: replaceTokensInPrompt(promptInput.value.trim(), activeProfile) || 'professional portrait photo',
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
               <a href="${result.url}" download class="flex-1 btn-secondary-modern py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a>
               <button class="flex-1 bg-white/10 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-white/20 transition-all" onclick="this.closest('.bg-\\\\[\\\\#111\\\\]').remove()">Generate Again</button>
               <button type="button" class="publish-social-btn flex-1 bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Publish to Social</button>
             </div>
           </div>
         `;
         const publishBtn = resultArea.querySelector('.publish-social-btn');
         if (publishBtn) publishBtn.onclick = () => openSocialPublish({ mediaUrl: result.url, mediaType: 'image' });
         resultArea.querySelector('button').onclick = () => genBtn.click();
       }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Character';
    }
  };


    const galleryAssets = getAssetsForStudio('character');
    if (galleryAssets.length > 0) {
      const gallery = ExampleGallery({ studioId: 'character', assets: galleryAssets, maxCards: 20 });
      container.appendChild(gallery);
    }

    return container;
}
