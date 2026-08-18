import { muapi } from '../lib/muapi.js';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { videoToolsModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { createUploadPicker } from './UploadPicker.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { mountPersonalizeTrigger, replaceTokensInPrompt } from './personalize/personalizePopover.js';
import { StudioThumbnailModal, mountStudioThumbnailModal } from './modals/StudioThumbnailPanel.jsx';

export function VideoToolsStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'videotools' });

  let selectedModel = videoToolsModels[0];
  let uploadedVideoUrl = null;
  let lastOutputUrl = null;
  let prompt = '';
  let customThumbnailUrl = getCustomThumbnailFromCache('videotools-studio');

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

  // Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'gtm-boost-btn w-full';
  thumbBtn.addEventListener('click', () => {
    const modal = new StudioThumbnailModal({
      appTheme: 'video-tools',
      studioId: 'videotools-studio',
      studioName: 'Video Tools Studio',
      aspectRatio: '16:9',
      outputType: 'video',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('videotools-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('videotools-studio');
      },
    });
    mountStudioThumbnailModal(modal);
    modal.open();
  });
  formCard.appendChild(thumbBtn);

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.className = 'w-full bg-primary text-black py-3.5 rounded-xl font-black text-sm hover:shadow-glow transition-all';
  genBtn.textContent = 'Process Video';
  formCard.appendChild(genBtn);
  container.appendChild(formCard);

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

  function updateFormVisibility() {
    // Show/hide prompt based on model
    const supportsPrompt = selectedModel.hasPrompt;
    promptGroup.classList.toggle('hidden', !supportsPrompt);
  }

  // Generate button handler
  genBtn.onclick = async () => {
    if (!uploadedVideoUrl && selectedModel.videoField) {
      alert('Upload a source video first');
      return;
    }
    const apiKey = apiKeyManager.getMuapiKey();
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
        customThumbnailUrl: customThumbnailUrl || undefined,
      };

      const activeProfile = (() => { try { return JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === localStorage.getItem('remix_selected_contact_id')) || null; } catch { return null; } })();
      if (prompt && selectedModel.hasPrompt) {
        params.prompt = replaceTokensInPrompt(prompt, activeProfile);
      }

       const result = await muapi.processVideoTool(params);
       if (result?.url) {
         lastOutputUrl = result.url;
         resultArea.classList.remove('hidden');
         resultArea.innerHTML = `
           <div class="bg-[#111]/80 border border-white/10 rounded-2xl p-4">
             <video controls class="w-full rounded-xl mb-3" src="${result.url}"></video>
             <a href="${result.url}" download class="block w-full bg-primary text-black py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Download Video</a>
             <button type="button" class="publish-social-btn block w-full mt-2 bg-gradient-to-r from-[#6d5efc] to-[#a855f7] text-white py-2.5 rounded-xl font-bold text-sm text-center hover:shadow-glow transition-all">Publish to Social</button>
           </div>
         `;
         const publishBtn = resultArea.querySelector('.publish-social-btn');
         if (publishBtn) publishBtn.onclick = () => openSocialPublish({ mediaUrl: lastOutputUrl, mediaType: 'video' });
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