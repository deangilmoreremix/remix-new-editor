import { muapi } from '../lib/muapi.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { textModels } from '../lib/models.js';
import { AuthModal } from './AuthModal.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import { createHeroSection, getCustomThumbnailFromCache, saveCustomThumbnailToCache, clearCustomThumbnailCache } from '../lib/thumbnails.js';
import { createInlineInstructions } from './InlineInstructions.js';
import { TemplateThumbnailModal, mountThumbnailModal } from './modals/TemplateThumbnailModal.jsx';
import { requireEntitlement } from '../lib/clerkEntitlements.js';
import { getModelLogoHtml, PROVIDER_LOGOS, invertLogos, getProviderStyle, getAvailableProviders, filterModels, renderProviderSidebar, renderSearchBar, renderModelList } from '../lib/modelSelectorUI.js';
import { getVideoIntent, setVideoIntent, resetVideoIntent } from '../lib/videoIntentStore.js';
import { navigate } from '../lib/router.js';

export function ChatStudio() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col items-center bg-app-bg overflow-y-auto p-6 md:p-10 relative';
  mountStudioChrome(container, { currentRoute: 'chat' });

  let selectedModel = textModels[0];
  const messages = []; // Chat history
  let isGenerating = false;
  let customThumbnailUrl = getCustomThumbnailFromCache('chat-studio');

  // Header with hero banner
  const header = document.createElement('div');
  header.className = 'mb-8 animate-fade-in-up text-center w-full max-w-xl';
  const chatBanner = createHeroSection('chat', 'h-32 md:h-44 mb-4');
  if (chatBanner) {
    const bannerText = document.createElement('div');
    bannerText.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    bannerText.innerHTML = '<h1 class="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">Chat Studio</h1><p class="text-white/60 text-sm">AI-powered text generation and conversation</p>';
    chatBanner.appendChild(bannerText);
    header.appendChild(chatBanner);
  }
  container.appendChild(header);

  // Instructions
  const inlineInstructions = createInlineInstructions('chat');
  inlineInstructions.classList.add('max-w-2xl', 'mt-6', 'mb-8');
  container.appendChild(inlineInstructions);

  // Model selector
  const modelWrapper = document.createElement('div');
  modelWrapper.className = 'mb-6 flex flex-col items-center gap-2 animate-fade-in-up';
  modelWrapper.style.animationDelay = '0.1s';

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
  dropdown.className = 'fixed z-[200] bg-[#111] border border-white/10 rounded-2xl shadow-3xl p-2 opacity-0 pointer-events-none transition-all duration-200 scale-95 origin-bottom';
  dropdown.style.width = 'calc(100vw - 2rem)';
  dropdown.style.maxWidth = '480px';
  dropdown.style.maxHeight = '70vh';
  dropdown.style.minHeight = '350px';

  const closeDropdown = () => {
    dropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
    dropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
    if (_modelSelectorOutsideClickHandler) {
      document.removeEventListener('click', _modelSelectorOutsideClickHandler);
      _modelSelectorOutsideClickHandler = null;
    }
  };

  const openDropdown = () => {
    dropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
    dropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
    if (!dropdown.dataset.populated) {
      dropdown.dataset.populated = 'true';
      const availableProviders = getAvailableProviders(textModels);
      dropdown.innerHTML = `
        <div class="flex gap-4 h-full max-h-[70vh] min-h-[350px] overflow-hidden">
          <div data-provider-sidebar></div>
          <div class="flex-1 flex flex-col gap-2 min-w-0">
            ${renderSearchBar()}
            <div class="text-xs font-semibold text-secondary py-1 shrink-0 flex items-center justify-between">
              <span>Available models</span>
              <span data-provider-badge class="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/60 hidden"></span>
            </div>
            <div data-model-list class="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1"></div>
          </div>
        </div>
      `;
      const sidebarEl = dropdown.querySelector('[data-provider-sidebar]');
      const modelListEl = dropdown.querySelector('[data-model-list]');
      const providerBadge = dropdown.querySelector('[data-provider-badge]');
      const searchInput = dropdown.querySelector('[data-provider-search]');
      let selectedProvider = 'all';
      const refresh = () => {
        sidebarEl.innerHTML = renderProviderSidebar(availableProviders, selectedProvider, (provider) => {
          selectedProvider = provider;
          refresh();
        });
        const filtered = filterModels(textModels, searchInput ? searchInput.value : '', selectedProvider);
        const showProviderName = selectedProvider === 'all';
        modelListEl.innerHTML = renderModelList(filtered, selectedModel.id, showProviderName, (m) => {
          selectedModel = textModels.find(x => x.id === m.id) || m;
          updateTrigger();
          closeDropdown();
        });
        if (selectedProvider !== 'all') {
          const pName = availableProviders.find(p => p.id === selectedProvider)?.name || selectedProvider;
          providerBadge.textContent = pName;
          providerBadge.classList.remove('hidden');
        } else {
          providerBadge.classList.add('hidden');
        }
      };
      refresh();
      sidebarEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-provider]');
        if (!btn) return;
        e.stopPropagation();
        const provider = btn.getAttribute('data-provider');
        if (provider) {
          selectedProvider = provider;
          refresh();
        }
      });
      searchInput.onclick = (e) => e.stopPropagation();
      searchInput.oninput = () => refresh();
    }
    if (_modelSelectorOutsideClickHandler) {
      document.removeEventListener('click', _modelSelectorOutsideClickHandler);
      _modelSelectorOutsideClickHandler = null;
    }
    _modelSelectorOutsideClickHandler = (e) => {
      if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
        closeDropdown();
      }
    };
    document.addEventListener('click', _modelSelectorOutsideClickHandler);
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
  container.appendChild(modelWrapper);

  // Chat container
  const chatContainer = document.createElement('div');
  chatContainer.className = 'w-full max-w-2xl flex-1 overflow-y-auto mb-6 space-y-4 animate-fade-in-up';
  chatContainer.style.animationDelay = '0.2s';
  chatContainer.setAttribute('role', 'status');
  chatContainer.setAttribute('aria-live', 'polite');
  container.appendChild(chatContainer);

  // Empty state
  const emptyState = document.createElement('div');
  emptyState.className = 'text-center py-12 text-white/40';
  emptyState.innerHTML = '<svg class="w-16 h-16 mx-auto mb-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><p>Start a conversation</p>';
  chatContainer.appendChild(emptyState);

  // Input area
  const inputArea = document.createElement('div');
  inputArea.className = 'w-full max-w-2xl bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 animate-fade-in-up';
  inputArea.style.animationDelay = '0.3s';

  // System prompt (optional)
  const systemRow = document.createElement('div');
  systemRow.className = 'flex gap-2 items-center';
  const systemLabel = document.createElement('label');
  systemLabel.className = 'text-xs text-white/50 whitespace-nowrap';
  systemLabel.textContent = 'System:';
  systemRow.appendChild(systemLabel);
  const systemInput = document.createElement('input');
  systemInput.type = 'text';
  systemInput.className = 'flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none';
  systemInput.placeholder = 'Optional system prompt...';
  systemRow.appendChild(systemInput);
  inputArea.appendChild(systemRow);

  // Main input row
  const inputRow = document.createElement('div');
  inputRow.className = 'flex gap-3';

  const textarea = document.createElement('textarea');
  textarea.className = 'flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-primary focus:outline-none resize-none min-h-[60px]';
  textarea.placeholder = 'Type your message...';
  textarea.rows = 2;
  textarea.setAttribute('aria-label', 'Message');
  inputRow.appendChild(textarea);

  const sendBtn = document.createElement('button');
sendBtn.type = 'button';
  sendBtn.className = 'btn-primary-modern px-[14px] py-2 min-h-[40px] text-[13px] font-bold rounded-2xl inline-flex items-center justify-center gap-1.5 transition-colors self-end';
  sendBtn.innerHTML = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  sendBtn.setAttribute('aria-label', 'Send message');
  inputRow.appendChild(sendBtn);

// Thumbnail studio button — next to creation controls, GTM Boost styling
  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.textContent = '🖼 Thumbnail';
  thumbBtn.title = 'Generate a custom thumbnail';
  thumbBtn.className = 'btn-ghost-modern shrink-0';
  thumbBtn.addEventListener('click', () => {
    const modal = new TemplateThumbnailModal({
      appTheme: 'chat-studio',
      layout: 'panel',
      studioId: 'chat-studio',
      studioName: 'Chat Studio',
      aspectRatio: '16:9',
      outputType: 'image',
      onApply: ({ imageUrl }) => {
        customThumbnailUrl = imageUrl;
        saveCustomThumbnailToCache('chat-studio', imageUrl);
      },
      onClear: () => {
        customThumbnailUrl = null;
        clearCustomThumbnailCache('chat-studio');
      },
    });
    mountThumbnailModal(modal);
    modal.open();
  });
  inputRow.appendChild(thumbBtn);
  inputArea.appendChild(inputRow);

  // Advanced options toggle
  const optionsToggle = document.createElement('button');
  optionsToggle.className = 'text-xs text-white/50 hover:text-white/80 transition-colors text-left';
  optionsToggle.textContent = '▼ Advanced Options';
  inputArea.appendChild(optionsToggle);

  // Advanced options (hidden by default)
  const advancedOptions = document.createElement('div');
  advancedOptions.className = 'hidden flex gap-4 mt-3 pt-3 border-t border-white/10';
  
  const tempGroup = document.createElement('div');
  tempGroup.className = 'flex flex-col gap-1';
  const tempLabel = document.createElement('label');
  tempLabel.className = 'text-xs text-white/50';
  tempLabel.textContent = 'Temperature';
  tempGroup.appendChild(tempLabel);
  const tempInput = document.createElement('input');
  tempInput.type = 'number';
  tempInput.min = '0';
  tempInput.max = '2';
  tempInput.step = '0.1';
  tempInput.value = '0.7';
  tempInput.className = 'w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white';
  tempGroup.appendChild(tempInput);
  advancedOptions.appendChild(tempGroup);

  const tokensGroup = document.createElement('div');
  tokensGroup.className = 'flex flex-col gap-1';
  const tokensLabel = document.createElement('label');
  tokensLabel.className = 'text-xs text-white/50';
  tokensLabel.textContent = 'Max Tokens';
  tokensGroup.appendChild(tokensLabel);
  const tokensInput = document.createElement('input');
  tokensInput.type = 'number';
  tokensInput.min = '1';
  tokensInput.max = '4096';
  tokensInput.value = '1024';
  tokensInput.className = 'w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white';
  tokensGroup.appendChild(tokensInput);
  advancedOptions.appendChild(tokensGroup);

  inputArea.appendChild(advancedOptions);

  // Toggle advanced options
  optionsToggle.onclick = () => {
    advancedOptions.classList.toggle('hidden');
    optionsToggle.textContent = advancedOptions.classList.contains('hidden') ? '▼ Advanced Options' : '▲ Advanced Options';
  };

  container.appendChild(inputArea);

  // Helper: Update model buttons

  // Helper: Add message to chat
  function addMessage(content, isUser) {
    // Remove empty state if present
    if (emptyState && emptyState.parentNode) {
      emptyState.remove();
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`;
    
    const avatar = document.createElement('div');
    avatar.className = `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isUser ? 'bg-primary text-black' : 'bg-white/10 text-white'}`;
    avatar.textContent = isUser ? 'You' : 'AI';
    msgDiv.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = `max-w-[80%] p-4 rounded-2xl ${isUser ? 'bg-primary/20 text-white' : 'bg-white/10 text-white'}`;
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.textContent = content;
    msgDiv.appendChild(bubble);

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Helper: Add loading indicator
  function showLoading() {
    isGenerating = true;
    sendBtn.disabled = true;
    sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-msg';
    loadingDiv.className = 'flex gap-3';
    
    const avatar = document.createElement('div');
    avatar.className = 'w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white';
    avatar.textContent = 'AI';
    loadingDiv.appendChild(avatar);
    
    const bubble = document.createElement('div');
    bubble.className = 'bg-white/10 text-white/60 p-4 rounded-2xl';
    bubble.innerHTML = '<span class="inline-block w-2 h-2 bg-white/60 rounded-full animate-bounce" style="animation-delay: 0ms"></span><span class="inline-block w-2 h-2 bg-white/60 rounded-full animate-bounce mx-1" style="animation-delay: 150ms"></span><span class="inline-block w-2 h-2 bg-white/60 rounded-full animate-bounce" style="animation-delay: 300ms"></span>';
    loadingDiv.appendChild(bubble);
    
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function hideLoading() {
    isGenerating = false;
    sendBtn.disabled = false;
    sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    
    const loading = document.getElementById('loading-msg');
    if (loading) loading.remove();
  }

  // Handle send message
  async function handleSend() {
    if (!(await requireEntitlement())) return;
    const userMessage = textarea.value.trim();
    if (!userMessage || isGenerating) return;

    const apiKey = apiKeyManager.getMuapiKey();
    if (!apiKey) { AuthModal(() => handleSend()); return; }

    textarea.value = '';
    addMessage(userMessage, true);

    showLoading();

    try {
      const response = await muapi.generateText({
        model: selectedModel.id,
        prompt: userMessage,
        system_prompt: systemInput.value.trim() || undefined,
        temperature: parseFloat(tempInput.value),
        max_tokens: parseInt(tokensInput.value)
      });

      hideLoading();
      addMessage(response.text, false);
    } catch (error) {
      hideLoading();
      addMessage(`Error: ${error.message}`, false);
    }
  }

  // ── Video intent helpers (additive) ──────────────────────────────────────
  const VIDEO_KEYWORDS = [
    'commercial', 'trailer', 'social reel', 'testimonial', 'documentary',
    'short film', 'explainer', 'brand film', 'video', 'cinematic', 'storyboard'
  ];

  function extractVideoIntent(text) {
    const lower = (text || '').toLowerCase();
    const intent = { ...getVideoIntent() };

    const typeMap = {
      'commercial': 'commercial',
      'trailer': 'trailer',
      'social reel': 'social reel',
      'testimonial': 'testimonial',
      'documentary': 'documentary',
      'short film': 'short film',
      'explainer': 'explainer',
      'brand film': 'brand film',
    };
    for (const [key, value] of Object.entries(typeMap)) {
      if (lower.includes(key)) {
        intent.videoType = value;
        break;
      }
    }

    const durationMatch = lower.match(/(\d+)\s*(?:second|sec|s)\b/);
    if (durationMatch) intent.duration = Math.max(5, Math.min(300, parseInt(durationMatch[1], 10) || 60));

    const toneMap = {
      dramatic: 'dramatic',
      cinematic: 'cinematic',
      upbeat: 'upbeat',
      luxury: 'luxury',
      gritty: 'gritty',
      minimal: 'minimal',
      emotional: 'emotional',
      humorous: 'humorous',
    };
    for (const [key, value] of Object.entries(toneMap)) {
      if (lower.includes(key)) {
        intent.tone = value;
        break;
      }
    }

    const styleMap = {
      photorealistic: 'Photorealistic',
      cinematic: 'Cinematic',
      noir: 'Noir',
      anime: 'Anime',
      watercolor: 'Watercolor',
      'oil painting': 'Oil Painting',
      cyberpunk: 'Cyberpunk',
      fantasy: 'Fantasy',
      documentary: 'Documentary',
    };
    for (const [key, value] of Object.entries(styleMap)) {
      if (lower.includes(key)) {
        intent.stylePreset = value;
        break;
      }
    }

    const lightingMap = {
      'golden hour': 'Golden Hour',
      neon: 'Neon',
      studio: 'Studio',
      dramatic: 'Dramatic',
      soft: 'Soft',
      volumetric: 'Volumetric',
      'high key': 'High Key',
      'low key': 'Low Key',
    };
    for (const [key, value] of Object.entries(lightingMap)) {
      if (lower.includes(key)) {
        intent.lightingPreset = value;
        break;
      }
    }

    const colorMap = {
      warm: 'Warm',
      cool: 'Cool',
      desaturated: 'Desaturated',
      vibrant: 'Vibrant',
      monochrome: 'Monochrome',
      sepia: 'Sepia',
      'teal & orange': 'Teal & Orange',
    };
    for (const [key, value] of Object.entries(colorMap)) {
      if (lower.includes(key)) {
        intent.colorGrade = value;
        break;
      }
    }

    const aspectMap = {
      '16:9': '16:9',
      '9:16': '9:16',
      '1:1': '1:1',
      '4:5': '4:5',
    };
    for (const [key, value] of Object.entries(aspectMap)) {
      if (lower.includes(key)) {
        intent.aspectRatio = value;
        break;
      }
    }

    const subjectMatch = lower.match(/(?:about|for|of)\s+(.+?)(?:\s+with|\s+in|\s+using|\s*$)/i);
    if (subjectMatch) intent.subject = subjectMatch[1].slice(0, 120);

    return intent;
  }

  function looksLikeVideoRequest(text) {
    const lower = (text || '').toLowerCase();
    return VIDEO_KEYWORDS.some(k => lower.includes(k)) || lower.includes('create') || lower.includes('generate') || lower.includes('make');
  }

  function addVideoActionBubble(messageEl, intent) {
    const action = document.createElement('div');
    action.className = 'mt-2 flex flex-wrap gap-2';
    action.innerHTML = `
      <button class="chat-create-video-btn btn-ghost-modern px-3 py-1.5 text-xs font-bold rounded-lg transition-transform">
        Create Video
      </button>
      <button class="chat-create-storyboard-btn px-3 py-1.5 bg-white/5 text-white text-xs font-bold rounded-lg hover:bg-white/10 transition-colors">
        Storyboard
      </button>
    `;
    messageEl.appendChild(action);

    action.querySelector('.chat-create-video-btn').addEventListener('click', () => {
      setVideoIntent(intent);
      navigate('cinema-template');
    });

    action.querySelector('.chat-create-storyboard-btn').addEventListener('click', () => {
      setVideoIntent(intent);
      navigate('cinema-template', { storyboardMode: '1' });
    });
  }

  // Intercept user messages for slash commands
  const originalHandleSend = handleSend;
  handleSend = async function() {
    const userMessage = textarea.value.trim();
    if (!userMessage || isGenerating) return;

    if (userMessage.startsWith('/create ')) {
      const intent = extractVideoIntent(userMessage.slice('/create '.length));
      setVideoIntent(intent);
      addMessage(`Creating video from intent:\n${JSON.stringify(intent, null, 2)}`, false);
      setTimeout(() => navigate('cinema-template'), 600);
      return;
    }

    if (userMessage.startsWith('/storyboard ')) {
      const intent = extractVideoIntent(userMessage.slice('/storyboard '.length));
      setVideoIntent(intent);
      addMessage(`Opening storyboard with intent:\n${JSON.stringify(intent, null, 2)}`, false);
      setTimeout(() => navigate('cinema-template', { storyboardMode: '1' }), 600);
      return;
    }

    await originalHandleSend();
  };

  sendBtn.onclick = handleSend;
  textarea.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // After AI responses, append action buttons when intent is detected
  const originalAddMessage = addMessage;
  addMessage = function(content, isUser) {
    originalAddMessage(content, isUser);
    if (!isUser && looksLikeVideoRequest(content)) {
      const lastMessage = chatContainer.lastElementChild;
      if (lastMessage) {
        const intent = extractVideoIntent(content);
        addVideoActionBubble(lastMessage, intent);
      }
    }
  };

  // Initialize

  return container;
}
