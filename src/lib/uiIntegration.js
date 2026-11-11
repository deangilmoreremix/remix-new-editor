/**
 * UI Integration Extensions for Timeline Editor Enhancements
 * Adds new menu options, context menus, and modal support
 */

import { isFeatureEnabled } from '../lib/featureFlags.js';
import { loadAdaptedComponent } from '../lib/componentAdapter.js';
import { GTMPromptModal } from '../components/modals/GTMPromptModal.jsx';
import { AIVideoCreator } from '../components/modals/AIVideoCreator.jsx';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { RecorderModal } from '../components/modals/RecorderModal.jsx';
import VoiceModal from '../components/modals/VoiceModal.js';
import { TimelineFeatureApi } from '../lib/editor/timelineFeatureApi.js';

/**
 * Default GTM → Thumbnail bridge.
 *
 * Opens the shared Thumbnail Studio drawer for the studio that launched GTM
 * Boost, pre-filled with the boosted prompt and the studio's aspect ratio.
 * When the user applies a thumbnail it is saved as that studio's custom
 * thumbnail and broadcast as `gtm:thumbnail-generated` (with `studioId`) so
 * the studio picks it up immediately (see gtmThumbnailBridge.js).
 *
 * Previously this generated one 16:9 image in the background with no
 * preview, and only 3 studios listened for the result.
 */
async function defaultGenerateThumbnail(prompt, { profile } = {}) {
  const [{ TemplateThumbnailModal, mountThumbnailModal }, { saveCustomThumbnailToCache, clearCustomThumbnailCache }] = await Promise.all([
    import('../components/modals/TemplateThumbnailModal.jsx'),
    import('./thumbnails.js'),
  ]);
  const thumb = profile?.thumbnail || {};
  const studioId = thumb.studioId || profile?.theme || 'gtm-generated';
  const modal = new TemplateThumbnailModal({
    appTheme: profile?.theme || 'timeline-editor',
    layout: 'panel',
    studioId,
    studioName: profile?.studioName || 'GTM Boost',
    aspectRatio: thumb.aspectRatio || '16:9',
    outputType: thumb.outputType || 'video',
    brief: prompt,
    onApply: ({ imageUrl }) => {
      if (thumb.studioId) saveCustomThumbnailToCache(thumb.studioId, imageUrl);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gtm:thumbnail-generated', {
          detail: { prompt, studioId, candidate: { imageUrl } },
        }));
      }
    },
    onClear: () => {
      if (thumb.studioId) clearCustomThumbnailCache(thumb.studioId);
    },
  });
  mountThumbnailModal(modal);
  modal.open();
  return modal;
}

/**
 * Fetch GTM (Google -> Template -> Modal) template context for a given template.
 * Enriches the template with GTM-specific fields like basePrompt, industry, role,
 * methodology, and tonality so the GTM Prompt Enhancer modal can be pre-filled.
 * @param {object} template - The template object from the studio
 * @returns {Promise<object>} Enriched GTM context object
 */
export async function fetchGTMTemplateContext(template) {
  if (!template || typeof template !== 'object') return {};

  return {
    basePrompt: template.description || template.prompt_seed || template.long_description || '',
    industry: template.category || template.niche || '',
    role: template.coreUseCase || template.targetAudience || template.role || '',
    methodology: template.templateType || template.filmType || template.storyStructure || '',
    tonality: template.tone || template.visualStyle || '',
    templateId: template.id || '',
    category: template.category || '',
    niche: template.niche || '',
    outputType: template.outputType || 'video',
    aspectRatio: template.aspectRatio || template.aspectRatios?.[0] || '16:9',
    duration: template.duration?.default || template.duration || 30,
  };
}

/**
 * Open GTM Boost for a studio.
 *
 *   openGTMPromptModal('image-studio', (prompt) => { ... })
 *   openGTMPromptModal('image-studio', {
 *     onPromptGenerated, basePrompt, templateContext, onGenerateThumbnail, studioName,
 *   })
 *
 * The theme key selects the studio profile, so the result is shaped for that
 * studio (image prompt, video prompt, avatar script, audio brief…).
 * `basePrompt` pre-fills the idea box — pass the studio's current prompt.
 *
 * Legacy forms still work: a function as the 2nd argument with an optional
 * thumbnail callback (or an options object) as the 3rd argument.
 *
 * @returns {GTMPromptModal|null} The modal instance or null on error
 */
export function openGTMPromptModal(appTheme = 'timeline-editor', onPromptGeneratedOrCtx = null, maybeCtx = null) {
  let options = {};
  if (typeof onPromptGeneratedOrCtx === 'function') {
    options.onPromptGenerated = onPromptGeneratedOrCtx;
    if (typeof maybeCtx === 'function') options.onGenerateThumbnail = maybeCtx;
    else if (maybeCtx && typeof maybeCtx === 'object') options = { ...maybeCtx, ...options };
  } else if (onPromptGeneratedOrCtx && typeof onPromptGeneratedOrCtx === 'object') {
    const ctx = onPromptGeneratedOrCtx;
    // Accept both the options shape and a bare template context object.
    const isOptions = 'templateContext' in ctx || 'onPromptGenerated' in ctx || 'onGenerateThumbnail' in ctx;
    options = isOptions ? { ...ctx } : { templateContext: ctx };
    if (typeof maybeCtx === 'function') options.onGenerateThumbnail = maybeCtx;
  }

  try {
    const defaultPromptCallback = (generatedPrompt) => {
      const promptInput = document.querySelector(
        '#generation-prompt, [data-studio-prompt], [data-prompt-input], .studio-prompt-textarea, textarea[placeholder*="Describe"], input[placeholder*="Describe"], textarea[placeholder*="prompt"], textarea[placeholder*="Prompt"]'
      );
      if (promptInput) {
        promptInput.value = generatedPrompt;
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
        promptInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gtm:prompt-generated', {
          detail: { prompt: generatedPrompt, appTheme }
        }));
      }
    };

    const modal = new GTMPromptModal({
      appTheme,
      templateContext: options.templateContext || null,
      basePrompt: options.basePrompt,
      studioName: options.studioName,
      onPromptGenerated: options.onPromptGenerated || defaultPromptCallback,
      onGenerateThumbnail: options.onGenerateThumbnail || defaultGenerateThumbnail,
    });
    modal.open();
    return modal;
  } catch (error) {
    console.error('GTM Prompt Modal error:', error);
    return null;
  }
}



/**
 * Extend generation panel with new creation options
 */
export function extendGenerationPanel(generationContainer, state, showToast) {
  if (!generationContainer) return;

  // Add AI Video Creator button
  if (isFeatureEnabled('VIDEO_CREATION_PERSONALIZATION')) {
    const videoCreatorBtn = document.createElement('button');
    videoCreatorBtn.className = 'generate-type';
    videoCreatorBtn.innerHTML = '<div class="emoji">🎬</div><div>AI Video</div>';
    videoCreatorBtn.title = 'Create AI-powered videos';
    videoCreatorBtn.addEventListener('click', () => openAIVideoCreator(state, showToast));
    generationContainer.appendChild(videoCreatorBtn);
  }

  // Add Template Browser button
  if (isFeatureEnabled('TEMPLATE_SYSTEM')) {
    const templateBtn = document.createElement('button');
    templateBtn.className = 'generate-type';
    templateBtn.innerHTML = '<div class="emoji">📋</div><div>Templates</div>';
    templateBtn.title = 'Browse and apply templates';
    templateBtn.addEventListener('click', () => openTemplateBrowser(null, state, showToast));
    generationContainer.appendChild(templateBtn);
  }

  // Add Recording button
  if (isFeatureEnabled('VIDEO_RECORDING')) {
    const recordBtn = document.createElement('button');
    recordBtn.className = 'generate-type';
    recordBtn.innerHTML = '<div class="emoji">🎥</div><div>Record</div>';
    recordBtn.title = 'Record screen or video';
    recordBtn.addEventListener('click', () => openVideoRecorder(state, showToast));
    generationContainer.appendChild(recordBtn);
  }

  // Add Giphy integration button
  const giphyBtn = document.createElement('button');
  giphyBtn.className = 'generate-type';
  giphyBtn.innerHTML = '<div class="emoji">🎞️</div><div>GIFs</div>';
  giphyBtn.title = 'Search and add GIFs';
  giphyBtn.addEventListener('click', () => openGiphyIntegration(state, showToast));
  generationContainer.appendChild(giphyBtn);

  // Add TTS button
  if (isFeatureEnabled('TEXT_TO_SPEECH')) {
    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'generate-type';
    ttsBtn.innerHTML = '<div class="emoji">🎤</div><div>TTS</div>';
    ttsBtn.title = 'Generate speech from text';
    ttsBtn.addEventListener('click', () => openTextToSpeechFromSelection(state, showToast));
    generationContainer.appendChild(ttsBtn);
  }
}

/**
 * Extend media library with enhanced features
 */


/**
 * Modal management for enhancements
 */
export class EnhancementModalManager {
  constructor(modalContainer) {
    this.modalContainer = modalContainer;
    this.activeModals = new Map();
  }

  async openModal(componentName, props = {}) {
    try {
      const { Component, adaptedProps } = await loadAdaptedComponent(componentName, props);

      // For now, create a basic modal structure
      // In a full React implementation, this would render the Component
      const modal = document.createElement('div');
      modal.className = 'enhancement-modal';
      modal.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h3>${componentName.replace(/([A-Z])/g, ' $1').trim()}</h3>
              <button class="modal-close" data-action="close">✕</button>
            </div>
            <div class="modal-body">
              <div class="loading">Loading ${componentName}...</div>
            </div>
          </div>
        </div>
      `;

      modal.querySelector('[data-action="close"]').addEventListener('click', () => {
        this.closeModal(componentName);
      });

      this.modalContainer.appendChild(modal);
      this.activeModals.set(componentName, modal);

      return modal;
    } catch (error) {
      console.error(`Failed to open ${componentName} modal:`, error);
      throw error;
    }
  }

  closeModal(componentName) {
    const modal = this.activeModals.get(componentName);
    if (modal) {
      modal.remove();
      this.activeModals.delete(componentName);
    }
  }

  closeAllModals() {
    this.activeModals.forEach(modal => modal.remove());
    this.activeModals.clear();
  }
}

// Modal action handlers
async function openAIVideoCreator(state, showToast) {
  try {
    const modal = new AIVideoCreator({
      onComplete: (result) => {
        addVideoToTimeline(result, state);
      }
    });
    modal.open();
  } catch (error) {
  }
}







async function openTemplateBrowser(clip, state, showToast) {
  try {
    // Create TimelineFeatureApi from the live TimelineState
    // state may be a TimelineState instance or a legacy state object
    let timelineApi = null;
    if (state && state.getRawState) {
      // It's a TimelineState (or compatible) instance
      timelineApi = new TimelineFeatureApi(state);
    }

    const modal = new TemplateGeneratorModal({
      timelineApi,
      onConfirm: (result) => {
        if (result.success) {
          if (showToast) {
            showToast(`Template added to timeline (${result.clipIds?.length || 0} clips)`, 'success');
          }
        } else {
          // Fallback path (no timelineApi)
          const templateData = result.composition || result.data;
          if (clip) {
            applyTemplateToClip(clip, templateData, state);
          }
        }
      },
      onCancel: () => {
        // User cancelled or error — no action needed
      },
      onError: (errorData) => {
        if (showToast) {
          showToast(`Template insertion failed: ${errorData.error || 'Unknown error'}`, 'error');
        }
      }
    });
    modal.open();
  } catch (error) {
    console.error('[openTemplateBrowser] Failed:', error);
    if (showToast) {
      showToast(`Failed to open Template Generator: ${error.message}`, 'error');
    }
  }
}

async function openVideoRecorder(state, showToast) {
  try {
    const modal = new RecorderModal({
      onComplete: (videoUrl) => {
        addVideoToTimeline({ src: videoUrl, name: 'Recorded Video' }, state);
      }
    });
    modal.open();
  } catch (error) {
  }
}





















// Helper functions
function getModalManager() {
  if (!window.enhancementModalManager) {
    const modalContainer = document.getElementById('modalOverlay') || document.body;
    window.enhancementModalManager = new EnhancementModalManager(modalContainer);
  }
  return window.enhancementModalManager;
}

function addVideoToTimeline(videoData, state) {
  const videoTrack = state.tracks.find(t => t.name === 'Video');
  if (videoTrack) {
    const newClip = {
      id: Date.now(),
      name: videoData.name || 'AI Generated Video',
      left: 50,
      width: 20,
      type: 'video',
      src: videoData.src,
      poster: videoData.poster
    };
    videoTrack.clips.push(newClip);
  }
}

function addAudioToTimeline(audioUrl, textClip, state) {
  const audioTrack = state.tracks.find(t => t.name === 'Audio');
  if (audioTrack) {
    const newClip = {
      id: Date.now(),
      name: 'Generated Voice',
      left: textClip.left,
      width: textClip.width,
      type: 'audio',
      src: audioUrl
    };
    audioTrack.clips.push(newClip);
  }
}

function updateClipInTimeline(clipId, updates, state) {
  state.tracks.forEach(track => {
    const clip = track.clips.find(c => c.id === clipId);
    if (clip) {
      Object.assign(clip, updates);
    }
  });
}

function applyTemplateToClip(clip, template, state) {
  if (clip) {
    Object.assign(clip, template);
  }
}

function addMediaToTimeline(media, state) {
  const track = state.tracks.find(t => t.name.toLowerCase() === media.type + 's' || t.name === 'Video');
  if (track) {
    const newClip = {
      id: Date.now(),
      name: media.name,
      left: 25,
      width: 15,
      type: media.type,
      src: media.src
    };
    track.clips.push(newClip);
  }
}

// Giphy integration handler
async function openGiphyIntegration(state, showToast) {
  try {
    // For now, show a simple integration - in full implementation this would open a modal

    // Add Giphy search to generation panel
    const generationPanel = document.querySelector('.generate-panel');
    if (generationPanel && !generationPanel.querySelector('.giphy-search')) {
      const giphySearch = document.createElement('div');
      giphySearch.className = 'giphy-search';
      giphySearch.innerHTML = `
        <input type="text" placeholder="Search GIFs..." class="giphy-input" />
        <button class="giphy-search-btn">🔍</button>
      `;
      generationPanel.appendChild(giphySearch);

      // Add search functionality
      const input = giphySearch.querySelector('.giphy-input');
      const btn = giphySearch.querySelector('.giphy-search-btn');

      const performSearch = () => {
        const query = input.value.trim();
        if (query) {
          window.dispatchEvent(new CustomEvent('giphySearch', { detail: { query } }));
        }
      };

      btn.addEventListener('click', performSearch);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
      });
    }
  } catch (error) {
  }
}

// Text-to-speech handler
async function openTextToSpeechFromSelection(state, showToast) {
  try {
    const selectedClip = state.tracks.flatMap(t => t.clips).find(c => c.id === state.selectedClipId && c.type === 'text');
    if (selectedClip) {
      const modal = new VoiceModal({
        text: selectedClip.body || selectedClip.text || ''
      });
      modal.open();
    }
  } catch (error) {
  }
}