import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { videoToolsModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createHeroSection } from '../lib/thumbnails.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { openPromptGallery } from '../lib/promptGalleryIntegration.js';
import { openModelPicker } from '../lib/modelPickerIntegration.js';
import { openRecipeModal } from '../lib/recipeIntegration.js';
import { openMonetizationHub } from '../lib/monetizationIntegration.js';

export function VideoToolsStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'videotools' });

  let selectedModel = videoToolsModels[0];
  let nativeAudio = false;
  let uploadedVideoUrl = null;
  let prompt = '';

  // Header with hero banner
  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full';
  const videoToolsBanner = createHeroSection('videotools', 'h-32 md:h-44 mb-4');
  if (videoToolsBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Video Tools Studio</h1><p class="text-white/60 text-sm">Enhance, edit, and transform your videos with AI</p>';
    videoToolsBanner.appendChild(bannerText);
    header.appendChild(videoToolsBanner);
  }
  container.appendChild(header);

  // Model selector
  const modelRow = document.createElement('div');
  modelRow.className = 'flex gap-3 mb-6 flex-wrap justify-center animate-fade-in-up';
  modelRow.style.animationDelay = '0.1s';

  const modelBtns = {};
  videoToolsModels.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all border bg-white/5 text-secondary border-white/10 hover:bg-white/10';
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
      const m = videoToolsModels.find(x => x.id === id);
      if (m) {
        selectedModel = m;
        updateModelBtns();
        updateFormVisibility();
      }
      }
    }).catch((err) => console.error('[ModelPicker] open failed:', err));
  });
  modelRow.appendChild(modelPickerBtn);

  // Native audio toggle
  const nativeAudioRow = document.createElement('div');
  nativeAudioRow.className = 'flex items-center justify-between mt-3 hidden';
  nativeAudioRow.innerHTML = `
    <label class="text-xs font-bold text-secondary uppercase tracking-wider">Native Audio</label>
    <button id="vt-native-audio-btn" class="relative h-7 w-12 rounded-full transition bg-white/10 border border-white/10" data-native-audio="false">
      <span class="absolute top-1 h-5 w-5 rounded-full bg-white transition left-1" id="vt-native-audio-knob"></span>
    </button>
  `;
  container.appendChild(nativeAudioRow);
  container.appendChild(modelRow);

  // Form card
  const formCard = document.createElement('div');
  formCard.className = 'w-full max-w-md bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up';
  formCard.style.animationDelay = '0.2s';

  // Video upload
  const videoUploadGroup = document.createElement('div');
  videoUploadGroup.className = 'flex flex-col gap-2';
  const videoLabel = document.createElement('label');
  videoLabel.className = 'text-sm font-bold text-secondary';
  videoLabel.textContent = 'Source Video';
  videoUploadGroup.appendChild(videoLabel);

  const videoPicker = createUploadPicker({
    anchorContainer: container,
    accept: 'video/*',
    onSelect: ({ url }) => { 
      uploadedVideoUrl = url; 
    },
    onClear: () => { uploadedVideoUrl = null; },
  });
  videoUploadGroup.appendChild(videoPicker.trigger);
  formCard.appendChild(videoUploadGroup);
  container.appendChild(videoPicker.panel);

  // Prompt input (for models that support it)
  const promptGroup = document.createElement('div');
  promptGroup.className = 'flex flex-col gap-2 hidden';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'text-sm font-bold text-secondary';
  promptLabel.textContent = 'Prompt (optional)';
  promptGroup.appendChild(promptLabel);
  const promptInput = document.createElement('textarea');
  promptInput.className = 'w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:border-primary focus:outline-none resize-none';
  promptInput.rows = 3;
  promptInput.placeholder = 'Describe the transformation you want...';
  promptInput.oninput = (e) => { prompt = e.target.value; };
   promptGroup.appendChild(promptInput);
    // GTM Boost entry point — opens the prompt enhancer themed for video tools
    // and loads the result straight into this prompt.
    const gtmBtn = document.createElement('button');
    gtmBtn.type = 'button';
    gtmBtn.textContent = '🎯 GTM Boost';
    gtmBtn.title = 'Enhance your prompt with GTM conversion frameworks';
    gtmBtn.setAttribute('aria-label', 'GTM Boost prompt enhancer');
    gtmBtn.className = 'gtm-boost-btn shrink-0';
    gtmBtn.addEventListener('click', () => {
      import('../lib/uiIntegration.js').then(({ openGTMPromptModal }) => {
        openGTMPromptModal('video-tools-studio', (prompt) => {
          promptInput.value = prompt;
          promptInput.dispatchEvent(new Event('input', { bubbles: true }));
          promptInput.focus();
        });
      }).catch((err) => console.error('[VideoToolsStudio] GTM Boost failed:', err));
    });
    promptGroup.appendChild(gtmBtn);
   formCard.appendChild(promptGroup);
  mountPersonalizeTrigger({ controlsContainer: formCard, getTextarea: () => promptInput, appId: 'video-tools' });

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  genBtn.textContent = 'Process Video';
  formCard.appendChild(genBtn);
  container.appendChild(formCard);
    // Native audio toggle
    const vtNativeAudioBtn = nativeAudioRow.querySelector('#vt-native-audio-btn');
    const vtNativeAudioKnob = nativeAudioRow.querySelector('#vt-native-audio-knob');
    if (vtNativeAudioBtn && vtNativeAudioKnob) {
      vtNativeAudioBtn.onclick = () => {
        nativeAudio = !nativeAudio;
        vtNativeAudioBtn.setAttribute('data-native-audio', String(nativeAudio));
        vtNativeAudioBtn.style.background = nativeAudio ? 'var(--cyan)' : '';
        vtNativeAudioBtn.style.borderColor = nativeAudio ? 'var(--cyan)' : '';
        vtNativeAudioKnob.style.left = nativeAudio ? 'calc(100% - 22px)' : '4px';
      };
    }

  // Instructions
  const inlineInstructions = createInlineInstructions('videotools');
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
        btn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all border bg-primary text-black border-primary';
      } else {
        btn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition-all border bg-white/5 text-secondary border-white/10 hover:bg-white/10';
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
        appTheme: 'video-tools',
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

  function updateFormVisibility() {
    // Show/hide prompt based on model
    const supportsPrompt = selectedModel.hasPrompt;
    promptGroup.classList.toggle('hidden', !supportsPrompt);

    // Show/hide native audio toggle based on model
    const supportsNativeAudio = selectedModel.inputs?.native_audio;
    nativeAudioRow.classList.toggle('hidden', !supportsNativeAudio);
    if (!supportsNativeAudio) nativeAudio = false;
  }

  // Generate button handler
  genBtn.onclick = async () => {
    if (!uploadedVideoUrl && selectedModel.videoField) {
      alert('Upload a source video first');
      return;
    }
    const apiKey = localStorage.getItem('muapi_key');
    if (!apiKey) { 
      AuthModal(() => genBtn.click()); 
      return; 
    }

    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="animate-spin inline-block mr-2">&#9711;</span> Processing...';

    try {
      const params = { 
        model: selectedModel.id,
        [selectedModel.videoField]: uploadedVideoUrl,
      }
    if (nativeAudio) params.native_audio = nativeAudio;

      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      if (prompt && selectedModel.hasPrompt) {
        params.prompt = replaceTokensInPrompt(prompt, activeProfile);
      }

       const result = await muapi.processVideoTool(params);
      if (result?.url) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
          <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
            <video controls class="w-full rounded-xl mb-3" src="${result.url}"></video>
            <a href="${result.url}" download class="block w-full bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download Video</a>
          </div>
        `;
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Process Video';
    }
  };

  updateModelBtns();
  updateFormVisibility();
  return container;
}