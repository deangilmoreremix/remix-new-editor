import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { audioModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openModelPicker } from '../lib/modelPickerIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';

export function AudioStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'audio' });

  let selectedModel = audioModels[0];
  let nativeAudio = false;
  let prompt = '';
  let style = '';
  let duration = '30';

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
  const modelRow = document.createElement('div');
  modelRow.className = 'flex gap-3 mb-6 flex-wrap justify-center animate-fade-in-up';
  modelRow.style.animationDelay = '0.1s';

  const modelBtns = {};
  audioModels.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'px-5 py-3 rounded-xl text-sm font-bold transition-all border bg-white/5 text-secondary border-white/10 hover:bg-white/10';
    btn.textContent = m.name;
    btn.onclick = () => {
      selectedModel = m;
      updateModelBtns();
      updateFormVisibility();
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
      const m = audioModels.find(x => x.id === id);
      if (m) {
        selectedModel = m;
        updateModelBtns();
        updateFormVisibility();
      }
      }
    }).catch((err) => console.error('[ModelPicker] open failed:', err));
  });
  modelRow.appendChild(modelPickerBtn);
  container.appendChild(modelRow);

  // Form card
  const formCard = document.createElement('div');
  formCard.className = 'w-full bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.2s';

  // Prompt input (for music generation)
  const promptGroup = document.createElement('div');
  promptGroup.className = 'flex flex-col gap-2';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'text-sm font-bold text-secondary';
  promptLabel.textContent = 'Prompt';
  promptGroup.appendChild(promptLabel);
  const promptInput = document.createElement('textarea');
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:border-primary focus:outline-none resize-none';
  promptInput.rows = 3;
  promptInput.placeholder = 'Describe the music you want to generate...';
  promptInput.oninput = (e) => { prompt = e.target.value; };
  promptGroup.appendChild(promptInput);
    // GTM Boost entry point — opens the prompt enhancer themed for audio
    // generation and loads the result straight into this prompt.
    const gtmBtn = document.createElement('button');
    gtmBtn.type = 'button';
    gtmBtn.textContent = '🎯 GTM Boost';
    gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBtn.className = 'gtm-boost-btn shrink-0';
    gtmBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('audio-studio', (prompt) => {
          promptInput.value = prompt;
          promptInput.dispatchEvent(new Event('input', { bubbles: true }));
          promptInput.focus();
        });
      }).catch((err) => console.error('[AudioStudio] GTM Boost failed:', err));
    });
    promptGroup.appendChild(gtmBtn);
  mountPersonalizeTrigger({ controlsContainer: formCard, getTextarea: () => promptInput, appId: 'audio-studio' });
  formCard.appendChild(promptGroup);

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
  styleSelect.onchange = (e) => { style = e.target.value; };
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
    btn.className = d === duration 
      ? 'px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black' 
      : 'px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-secondary hover:bg-white/10';
    btn.textContent = `${d}s`;
    btn.onclick = () => {
      duration = d;
      updateDurationBtns();
    };
    durationRow.appendChild(btn);
  });
  durationGroup.appendChild(durationRow);
   formCard.appendChild(durationGroup);

   // Native audio toggle
   const nativeAudioRow = document.createElement('div');
   nativeAudioRow.className = 'flex items-center justify-between';
   nativeAudioRow.innerHTML = `
     <label class="text-xs font-bold text-secondary uppercase tracking-wider">Native Audio</label>
     <button id="a-native-audio-btn" class="relative h-7 w-12 rounded-full transition bg-white/10 border border-white/10" data-native-audio="false">
       <span class="absolute top-1 h-5 w-5 rounded-full bg-white transition left-1" id="a-native-audio-knob"></span>
     </button>
   `;
   formCard.appendChild(nativeAudioRow);

   const nativeAudioBtn = nativeAudioRow.querySelector('#a-native-audio-btn');
   const nativeAudioKnob = nativeAudioRow.querySelector('#a-native-audio-knob');
   if (nativeAudioBtn && nativeAudioKnob) {
     nativeAudioBtn.onclick = () => {
       nativeAudio = !nativeAudio;
       nativeAudioBtn.setAttribute('data-native-audio', String(nativeAudio));
       nativeAudioBtn.style.background = nativeAudio ? 'var(--cyan)' : '';
       nativeAudioBtn.style.borderColor = nativeAudio ? 'var(--cyan)' : '';
       nativeAudioKnob.style.left = nativeAudio ? 'calc(100% - 22px)' : '4px';
     };
   }

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  genBtn.textContent = 'Generate Audio';
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

  // Instructions
  const inlineInstructions = createInlineInstructions('audio');
  inlineInstructions.classList.add('max-w-md', 'mt-6');
  container.appendChild(inlineInstructions);

  // Result area
  const resultArea = document.createElement('div');
  resultArea.className = 'w-full max-w-md mt-6 hidden';
  container.appendChild(resultArea);

  // Helper functions
  function updateModelBtns() {
    Object.entries(modelBtns).forEach(([id, btn]) => {
      if (id === selectedModel.id) {
        btn.className = 'px-5 py-3 rounded-xl text-sm font-bold transition-all border bg-primary text-black border-primary';
      } else {
        btn.className = 'px-5 py-3 rounded-xl text-sm font-bold transition-all border bg-white/5 text-secondary border-white/10 hover:bg-white/10';
      }
    });
  }


    // Prompt Gallery button
    const promptGalleryBtn = document.createElement('button');
    promptGalleryBtn.type = 'button';
    promptGalleryBtn.textContent = '📚 Prompts';
    promptGalleryBtn.title = 'Browse prompt gallery';
    promptGalleryBtn.setAttribute('aria-label', 'Open prompt gallery');
    promptGalleryBtn.className = 'gtm-boost-btn shrink-0';
    promptGalleryBtn.addEventListener('click', () => {
      openPromptGallery({
        appTheme: 'audio-studio',
        onSelect: (prompt) => {
          // Default: try to find a textarea in the studio
          const ta = document.querySelector('textarea') || document.querySelector('[data-prompt]');
          if (ta) {
            ta.value = prompt;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.focus();
          }
        }
      }).catch((err) => console.error('[PromptGallery] open failed:', err));
    });

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
          // Recipe completed; result URL is handled by the modal
        }
      }).catch((err) => console.error('[Recipe] open failed:', err));
    });


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
    promptGroup.appendChild(recipeBtn);
    promptGroup.appendChild(monetizationBtn);

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
    // Show/hide prompt based on model
    const supportsPrompt = selectedModel.hasPrompt;
    promptGroup.classList.toggle('hidden', !supportsPrompt);
    
    // Show/hide style selector for music models
    const supportsStyles = selectedModel.supportsStyles;
    styleGroup.classList.toggle('hidden', !supportsStyles);

    // Show/hide native audio toggle based on model
    const supportsNativeAudio = selectedModel.inputs?.native_audio;
    nativeAudioRow.classList.toggle('hidden', !supportsNativeAudio);
    if (!supportsNativeAudio) nativeAudio = false;
  }

  // Generate button handler
  genBtn.onclick = async () => {
    if (selectedModel.hasPrompt) {
      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      prompt = replaceTokensInPrompt(prompt, activeProfile);
      if (!prompt) { alert('Enter a prompt'); return; }
    }
    const apiKey = localStorage.getItem('muapi_key');
    if (!apiKey) { 
      AuthModal(() => genBtn.click()); 
      return; 
    }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Generating...';

    try {
      const params = { 
        model: selectedModel.id,
        prompt: prompt,
        duration: parseInt(duration)
      }
    if (nativeAudio) params.native_audio = nativeAudio;
      
      if (style) params.style = style;
      
      const result = await muapi.generateAudio(params);
      if (result?.url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
            <audio controls class="w-full mb-3">
              <source src="${result.url}" type="audio/mpeg">
              Your browser does not support the audio element.
            </audio>
            <a href="${result.url}" download class="block w-full bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download Audio</a>
          </div>
        `;
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Audio';
    }
  };

  updateModelBtns();
  updateFormVisibility();
  return container;
}
