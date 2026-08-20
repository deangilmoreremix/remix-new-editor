import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openModelPicker } from '../lib/modelPickerIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';
import { saveCharacterReference, getCharacterReference, listCharacterReferences } from '../lib/characterConsistency.js';

const CHARACTER_MODELS = [
  { id: 'flux-pulid', name: 'Flux PuLID', description: 'Face ID preservation with text prompt' },
  { id: 'minimax-image-01-subject-reference', name: 'Subject Reference', description: 'Maintain subject consistency across images' },
];

export function CharacterStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'character' });

  let uploadedUrl = null;
  let selectedModel = CHARACTER_MODELS[0];
  let omniUrl = null;
  let firstFrameUrl = '';
  let lastFrameUrl = '';
  let characterConsistency = false;

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

  const modelRow = document.createElement('div');
  modelRow.className = 'flex gap-2';
  const modelBtns = {};
  CHARACTER_MODELS.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all border text-left';
    btn.innerHTML = `<div class="text-white">${m.name}</div><div class="text-muted text-[10px] mt-0.5">${m.description}</div>`;
    btn.onclick = () => {
      selectedModel = m;
      Object.entries(modelBtns).forEach(([id, b]) => {
        b.className = id === m.id
          ? 'flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all border bg-primary/10 border-primary/30'
          : 'flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all border bg-white/[0.03] border-white/10 hover:border-white/20';
      });
    };
    modelBtns[m.id] = btn;
    modelRow.appendChild(btn);
  });
  // Model Picker button
  const modelPickerBtn = document.createElement('button');
  modelPickerBtn.type = 'button';
  modelPickerBtn.textContent = 'AI Pick';
  modelPickerBtn.title = 'Open intelligent model picker';
  modelPickerBtn.setAttribute('aria-label', 'Open model picker');
  modelPickerBtn.className = 'text-[11px] font-bold text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 rounded-lg hover:bg-cyan-400/20 transition-colors ml-2 whitespace-nowrap';
  modelPickerBtn.addEventListener('click', () => {
    openModelPicker({
      currentModelId: selectedModel.id,
      onSelectModel: (id) => {
        const m = CHARACTER_MODELS.find(x => x.id === id);
        if (m) {
          selectedModel = m;
          Object.entries(modelBtns).forEach(([mid, b]) => {
            b.className = mid === m.id
              ? 'flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all border bg-primary/10 border-primary/30'
              : 'flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all border bg-white/[0.03] border-white/10 hover:border-white/20';
          });
        }
      }
    }).catch((err) => console.error('[ModelPicker] open failed:', err));
  });
  modelRow.appendChild(modelPickerBtn);
  formCard.appendChild(modelRow);

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

  // Character consistency: omni-reference + first/last frame
  const consistencySection = document.createElement('div');
  consistencySection.className = 'flex flex-col gap-3';
  const consistencyLabel = document.createElement('label');
  consistencyLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  consistencyLabel.textContent = 'Character Consistency';
  consistencySection.appendChild(consistencyLabel);

  const omniRow = document.createElement('div');
  omniRow.className = 'flex items-center gap-3';
  const omniPicker = createUploadPicker({
    anchorContainer: container,
    acceptImage: true,
    onSelect: ({ url }) => {
      omniUrl = url;
      saveCharacterReference({ id: 'character-omni', imageUrl: url, modelId: selectedModel.id });
    },
    onClear: () => { omniUrl = null; }
  });
  omniRow.appendChild(omniPicker.trigger);
  const omniHint = document.createElement('span');
  omniHint.className = 'text-sm text-muted';
  omniHint.textContent = 'Omni-reference image (optional)';
  omniRow.appendChild(omniHint);
  consistencySection.appendChild(omniRow);
  container.appendChild(omniPicker.panel);

  const frameRow = document.createElement('div');
  frameRow.className = 'flex gap-3';
  const firstFrameInput = document.createElement('input');
  firstFrameInput.type = 'text';
  firstFrameInput.placeholder = 'First frame URL (optional)';
  firstFrameInput.className = 'flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50';
  const lastFrameInput = document.createElement('input');
  lastFrameInput.type = 'text';
  lastFrameInput.placeholder = 'Last frame URL (optional)';
  lastFrameInput.className = 'flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-muted focus:outline-none focus:border-primary/50';
  frameRow.appendChild(firstFrameInput);
  frameRow.appendChild(lastFrameInput);
  firstFrameInput.addEventListener('input', () => { firstFrameUrl = firstFrameInput.value.trim(); });
  firstFrameInput.addEventListener('change', () => { firstFrameUrl = firstFrameInput.value.trim(); });
  lastFrameInput.addEventListener('input', () => { lastFrameUrl = lastFrameInput.value.trim(); });
  lastFrameInput.addEventListener('change', () => { lastFrameUrl = lastFrameInput.value.trim(); });
  consistencySection.appendChild(frameRow);
  formCard.appendChild(consistencySection);

  const consistencyToggleRow = document.createElement('div');
  consistencyToggleRow.className = 'flex items-center justify-between';
  const consistencyToggleLabel = document.createElement('span');
  consistencyToggleLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  consistencyToggleLabel.textContent = 'Seedance 2.5 Consistency';
  const consistencyToggle = document.createElement('button');
  consistencyToggle.type = 'button';
  consistencyToggle.className = 'relative h-7 w-12 rounded-full transition bg-white/10 border border-white/10';
  consistencyToggle.setAttribute('data-consistency', 'false');
  const consistencyKnob = document.createElement('span');
  consistencyKnob.className = 'absolute top-1 h-5 w-5 rounded-full bg-white transition left-1';
  consistencyToggle.appendChild(consistencyKnob);
  consistencyToggle.onclick = () => {
    characterConsistency = !characterConsistency;
    consistencyToggle.setAttribute('data-consistency', String(characterConsistency));
    consistencyToggle.style.background = characterConsistency ? 'var(--cyan)' : '';
    consistencyToggle.style.borderColor = characterConsistency ? 'var(--cyan)' : '';
    consistencyKnob.style.left = characterConsistency ? 'calc(100% - 22px)' : '4px';
  };
  consistencyToggleRow.appendChild(consistencyToggleLabel);
  consistencyToggleRow.appendChild(consistencyToggle);
  formCard.appendChild(consistencyToggleRow);

  const promptLabel = document.createElement('label');
  promptLabel.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  promptLabel.textContent = 'Character Description';
  formCard.appendChild(promptLabel);

  const promptInput = document.createElement('textarea');
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors resize-none';
  promptInput.rows = 3;
  promptInput.placeholder = 'e.g. wearing a leather jacket, standing in a neon-lit alley, cyberpunk style';
  formCard.appendChild(promptInput);

  // Prompt Gallery button
  const promptGalleryBtn = document.createElement('button');
  promptGalleryBtn.type = 'button';
  promptGalleryBtn.textContent = '📚 Prompts';
  promptGalleryBtn.title = 'Browse prompt gallery';
  promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
  promptGalleryBtn.className = 'gtm-boost-btn shrink-0';
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
  recipeBtn.className = 'gtm-boost-btn shrink-0';
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
  monetizationBtn.className = 'gtm-boost-btn shrink-0';
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

  const genBtn = document.createElement('button');
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all mt-2';
  genBtn.textContent = 'Generate Character';
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
  container.appendChild(resultArea);

  genBtn.onclick = async () => {
    if (!uploadedUrl) { alert('Upload a reference face first'); return; }
    const apiKey = localStorage.getItem('muapi_key');
    if (!apiKey) { AuthModal(() => genBtn.click()); return; }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    try {
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      const params = {
        model: selectedModel.id,
        image_url: uploadedUrl,
        prompt: replaceTokensInPrompt(promptInput.value.trim(), activeProfile) || 'professional portrait photo',
        reference_images: omniUrl ? [omniUrl] : undefined,
        first_frame_url: firstFrameUrl || undefined,
        last_frame_url: lastFrameUrl || undefined,
        character_consistency: characterConsistency,
      };
      const result = await muapi.generateI2I(params);
      if (result?.url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4 animate-fade-in-up">
            <img src="${result.url}" class="w-full rounded-xl mb-3">
            <div class="flex gap-3">
              <a href="${result.url}" download class="flex-1 bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download</a>
              <button class="flex-1 bg-white/10 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-white/20 transition-all" onclick="this.closest('.bg-\\\\[\\\\#111\\\\]').remove()">Generate Again</button>
            </div>
          </div>
        `;
        resultArea.querySelector('button').onclick = () => genBtn.click();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Character';
    }
  };

  Object.entries(modelBtns).forEach(([id, btn]) => {
    btn.className = id === selectedModel.id
      ? 'flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all border bg-primary/10 border-primary/30'
      : 'flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all border bg-white/[0.03] border-white/10 hover:border-white/20';
  });

  return container;
}
