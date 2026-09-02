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
 * Lazily imports ThumbnailService, generates a single candidate from the
 * GTM-enhanced prompt, and dispatches a `gtm:thumbnail-generated` window event
 * with the first candidate so any studio can display/save it.
 * Studios can pass their own `onGenerateThumbnail` to override this default.
 */
async function defaultGenerateThumbnail(prompt) {
  const mod = await import('../lib/thumbnailService.js');
  const { ThumbnailService } = mod;
  const service = new ThumbnailService({
    templateId: 'gtm-generated',
    templateName: 'GTM Generated',
    aspectRatio: '16:9',
  });
  const { candidates } = await service.generateCandidates(prompt, { n: 1 });
  const first = Array.isArray(candidates) && candidates.length > 0 ? candidates[0] : null;
  if (!first) throw new Error('No thumbnail candidates returned');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gtm:thumbnail-generated', {
      detail: { prompt, candidate: first }
    }));
  }
  return first;
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
 * Open the GTM Prompt Enhancer modal
 * Shared utility used by all apps (timeline-editor, image-studio, video-studio, etc.)
 * @param {string} appTheme - The app theme identifier for color customization
 * @param {Function} onPromptGenerated - Callback when a prompt is generated
 * @param {Function} [onGenerateThumbnail] - Optional override for thumbnail generation;
 *        defaults to defaultGenerateThumbnail which calls the ai-thumbnail-generator
 *        edge function and dispatches a `gtm:thumbnail-generated` window event.
 * @returns {GTMPromptModal|null} The modal instance or null on error
 */
export function openGTMPromptModal(appTheme = 'timeline-editor', onPromptGeneratedOrCtx = null, maybeCtx = null) {
  let onPromptGenerated;
  let templateContext = null;
  let onGenerateThumbnail;

  if (typeof onPromptGeneratedOrCtx === 'function') {
    onPromptGenerated = onPromptGeneratedOrCtx;
    onGenerateThumbnail = maybeCtx;
  } else {
    onPromptGenerated = onPromptGeneratedOrCtx?.onPromptGenerated;
    templateContext = onPromptGeneratedOrCtx || null;
    onGenerateThumbnail = maybeCtx;
  }

  try {
    const defaultPromptCallback = (generatedPrompt) => {
      const promptInput = document.querySelector(
        '#generation-prompt, textarea[placeholder*="Describe"], input[placeholder*="Describe"], textarea[placeholder*="prompt"], textarea[placeholder*="Prompt"], .studio-prompt-textarea, [data-prompt-input]'
      );
      if (promptInput) {
        promptInput.value = generatedPrompt;
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
        promptInput.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        navigator.clipboard.writeText(generatedPrompt).catch(() => {});
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gtm:prompt-generated', {
          detail: { prompt: generatedPrompt, appTheme }
        }));
      }
    };

    const modal = new GTMPromptModal({
      appTheme,
      templateContext,
      onPromptGenerated: onPromptGenerated || defaultPromptCallback,
      onGenerateThumbnail: onGenerateThumbnail || defaultGenerateThumbnail,
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