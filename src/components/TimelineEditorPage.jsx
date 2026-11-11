import { supabase, uploadFileToStorage } from '../lib/hybrid-supabase.js';
import { setupEnhancedTooltips } from '../lib/editor/dragDrop.js';
import { processFileUpload } from '../lib/editor/uploadPipeline.js';
import { setupUploadSources } from '../lib/editor/uploadSources.js';
import { saveProjectToStorage } from '../lib/editor/persistence.js';
import { renderMediaGrid, addMediaToTimeline } from '../lib/editor/mediaLibrary.js';
import { assetStore } from '../lib/assets/assetStore.js';
import { extendClipContextMenu, extendGenerationPanel, extendMediaLibrary, openGTMPromptModal } from '../lib/uiIntegration.js';
import { integrateMediaIngest, GiphyIntegration, StickersLibrary, LowerThirds, VideoGallery, AnimationList } from '../lib/mediaIngest.js';
import { renderMultiCamPanel } from '../lib/editor/panels/multiCamPanel.js';
import { createTimelineState } from '../lib/editor/timelineEditorState.js';
import { legacyToTimeline, getPreviewClipFromTimeline, syncTimelineFromState } from '../lib/editor/timeline-bridge.js';
import { KeyframeSystem } from '../lib/editor/keyframeSystem.jsx';
import { TransitionEditor } from '../lib/editor/transitionEditor.js';
import { TimelineTransitions } from '../lib/editor/timelineTransitions.js';
import { SceneDetector } from './timeline/SceneDetector.js';
import { CameraEffects } from './timeline/CameraEffects.js';
import AIChatPanel from './timeline/AIChatPanel.js';
import TIMELINE_DESIGN_SYSTEM, { enforceDesignSystem } from '../lib/designSystemEnforcer.js';
import { createVideoPreview, addVideoErrorRecovery } from '../lib/videoPlayer.js';
import { replaceTokensInPrompt } from './personalize/personalizePopover.js';
import {
  getAddon, isAddonType, createAddonClip, addonOptions, clipTimeRange, AddonRuntime,
  INTERACTIVE_ADDONS, PROJECT_FORMS, renderAddonEditor,
  ensureOverlayLayer, clearOverlay, showPauseOverlay, showListBuilderOverlay, formBackground,
  defaultListBuilder, listBuilderFields, listBuilderWebhookConfig, switchListBuilderKind, savePersonalizerProfile,
  submitLead, fetchLeads, postWebhooksDirect, leadsToCsv, mergeLeads, webhookUrlsFor, leadFieldTokens,
  OVERLAY_ADDONS, STICKER_LIBRARY, ANIMATED_EMOJI, OVERLAY_TAG, buildOverlayElement, finishOverlayElement, destroyOverlayElement,
  setOverlayPlaying, syncOverlayTime, playInAnimation,
  createStockSearch, STOCK_SOURCES, renderStockBrowser, capturePreset, presetToClips, loadPresets, savePresets, playOutAndRemove, activeOverlays, attachDragResize,
  OVERLAY_FONTS, CTA_ANIMATIONS, buildCtaLottie, CTA_ASPECT, CTA_COLOR_THEMES, ctaColorParts,
  BLEND_CATEGORIES, blendItemToAddon, getBlendItem, blendThumbStyle,
  openTemplateWindow, templateToPreset, templateStart, TEMPLATE_LIBRARIES, resolveOverlayText,
} from '../lib/editor/addons/index.js';
import { TOKEN_DEFS, resolveToken } from './personalize/tokenSchema.js';
import { openSmartSpeechModal } from '../lib/editor/agent/smartSpeechModal.js';
import { apiKeyManager } from '../lib/apiKeyManager.js';
import * as contactStore from '../lib/contactStore.js';
import { PERSONALIZED_LAYOUTS, assetForImageToken, buildLayoutPlan, imageTokenChoices, imageTokenOf, listTimelineImageAssets } from '../lib/personalization/timelineAssets.js';
import { measureImageLuminance } from '../lib/personalization/imageStyle.js';
import { AI_FILLABLE, describeUnreviewed, markAiGenerated, planAiImages, unreviewedAiImages } from '../lib/personalization/aiContactImages.js';
import { AI_CLIP_MODELS, CLIP_IMAGE_SLOTS, aiClipConfig, clipSrcFor, describeClipGaps, planClipJobs } from '../lib/personalization/aiContactClips.js';
import { generateImage as generateAiImage } from '../lib/editor/aiImageService.js';
import { makePersonalizationAssetVideoReady } from '../lib/personalization/videoReady.js';
import { persistPersonalizationAssetVersion } from '../lib/personalization/assetDiscoveryService.js';
import { browserImageProbe, contactImageGaps, describeBrokenImages, describeImageGaps, findBrokenImages } from '../lib/personalization/imageReadiness.js';
import { importDiscoveredAsset } from '../lib/personalization/assetDiscoveryService.js';
import { addPersonalizationAsset, createPersonalizationAsset, removePersonalizationAsset, setDiscoveredPersonalizationAssets, updatePersonalizationAsset } from '../lib/personalization/personalizationProfile.js';
import { createContactSync } from '../lib/editor/personalize/clientSync.js';
import { renderPersonalizationPanel, renderPersonalizationEditor, renderTokenEditor, renderBatchHub } from '../lib/editor/panels/personalPanels.js';
import { profileWithAnswers, listContactProfiles, contactName, contactEmail, personalLink, personalLinkIssues, projectTokens, linksCsv } from '../lib/editor/personalize/perContact.js';
import { searchPixabayImages, searchPixabayVideos } from '../lib/pixabayApi.js';
import { timelineToComposition } from '../lib/editor/remotion/timelineToComposition.js';
import { setKeyframe } from '../lib/editor/remotion/keyframes.js';
import { searchPhotos as searchPexelsPhotos, searchVideos as searchPexelsVideos } from '../lib/pexelsApi.js';
// Design-system styles are imported statically so Vite bundles and emits them
// into dist/ (with subpath-safe URLs). Injecting them via a runtime <link> to a
// project-root path 404s in production because Vite never copies unreferenced
// files into the build output.
import '../../styles/timeline-tokens.css';
import '../../styles/timeline-editor-page.css';
import '../../styles/personalize-ui.css';
import '../../styles/timeline-addons.css';
// Import rendiv animation primitives
import { interpolate, spring, blendColors, noise2D, useSequence, useSeries } from '../lib/editor/animationControls.jsx';
// Agent system integration
import { initTimelineAgentIntegration } from '../timelineAgentIntegration.js';
import { ColorCorrectionSystem } from '../lib/editor/colorCorrectionSystem.jsx';
import { runTimelineAITool, AI_TOOL_INFO } from '../lib/editor/aiToolsClient.js';
import { openAiToolsWindow, summarizeResult } from '../lib/editor/panels/aiTools.js';
import { captureVideoFrame, sourceTimeFor } from '../lib/editor/panels/frameCapture.js';
import { requireEntitlement } from '../lib/clerkEntitlements.js';

// CutAI integration loaded dynamically to avoid syntax issues in AIStoryboardStudio.jsx
// import { AIStoryboardStudio } from './ai-storyboard/AIStoryboardStudio.jsx';
// CineGen integration ready
// import { CineGenWorkspace } from '../modules/CineGen/src/layout/CineGenLayout.tsx';
// import { cutai } from '../lib/cutai-api.js';

// Subtitle system integration
import { SubtitleTimeline } from '../lib/editor/subtitleTimeline.js';
import { whisperService } from '../services/whisper-client.js';

// Modal imports - these are vanilla JS modal implementations
import { EndScreenModal } from './modals/EndScreenModal.jsx';
import { SaveProjectModal } from './modals/SaveProjectModal.jsx';
import { SettingsModal } from './modals/SettingsModal.jsx';
import { ConnectModal } from './modals/ConnectModal.jsx';
import { PreviewMediaModal } from './modals/PreviewMediaModal.jsx';
import { VideoPlayerModal } from './modals/VideoPlayerModal.jsx';
import { RecorderModal } from './modals/RecorderModal.jsx';
import { EnhancedRecorderModal } from './modals/EnhancedRecorderModal.jsx';
import { TemplateGeneratorModal } from './modals/TemplateGeneratorModal.jsx';
import { TemplatePreviewModal } from './modals/TemplatePreviewModal.jsx';
import { openSocialPublish } from '../lib/socialPublishHelpers.js';
import { EmailCampaignModal } from './modals/EmailCampaignModal.jsx';
import { UrlVideoModal } from './modals/UrlVideoModal.jsx';
import { PageShotModal } from './modals/PageShotModal.jsx';
import { ContactImporterModal } from './modals/ContactImporterModal.jsx';
import { AIVideoCreator } from './modals/AIVideoCreator.jsx';
import { VideoPersonalizationHub } from './modals/VideoPersonalizationHub.jsx';
import { LandingPageBuilder } from './modals/LandingPageBuilder.jsx';
import { LeadGeneratorModal } from './modals/LeadGeneratorModal.jsx';
import { RetakePanel } from './RetakePanel.jsx';
import { ImportTimelineModal } from './ImportTimelineModal.jsx';
import { ICLoraPanel } from './ICLoraPanel.jsx';
// Category C Editor Surface imports removed - not implemented
import { createEditorBanner } from '../lib/thumbnails.js';

export function TimelineEditorPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg relative';

  const TLEditor = (window.TimelineEditor = window.TimelineEditor || {});

  // Feature flags — single source of truth for gating optional behaviour.
  // Routines that are not yet wired end their bodies with a `// DISABLED:`
  // marker (intentional placeholder, never an accidental comment). Gate new
  // optional behaviour behind these flags rather than commenting it out.
  const FEATURE_FLAGS = {
    colorCorrection: false,   // ColorCorrectionSystem import is currently unavailable
    cutaiStoryboard: true,    // CutAI storyboard drag-and-drop to timeline
    cineGenTools: true,       // CineGen AI tool suite
    agentIntegration: true,   // Timeline agent hooks
    subtitleGeneration: true, // Whisper-based subtitle generation
  };
  TLEditor.featureFlags = FEATURE_FLAGS;


  // Initialize design system enforcement
  enforceDesignSystem();

  // CutAI integration - popup storyboard UX with timeline communication
  // Uses dynamic import to avoid syntax issues in AIStoryboardStudio.jsx
  // Styled consistently with timeline editor design system
  const showCutAI = async () => {
    const cutaiContainer = document.createElement('div');
    cutaiContainer.className = 'fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4';
    
    // Create surface-styled modal matching timeline editor aesthetics
    const modal = document.createElement('div');
    modal.className = 'w-full max-w-[1400px] h-[90vh] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.028))] shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl overflow-hidden flex flex-col';
    
    try {
      // Dynamic import of CutAI module
      const { AIStoryboardStudio } = await import('./ai-storyboard/AIStoryboardStudio.jsx');
      
      const studio = AIStoryboardStudio();
      modal.appendChild(studio);
      
      // Make CutAI scene/shot cards draggable for direct timeline drop (production-ready)
      setTimeout(() => {
        const sceneCards = modal.querySelectorAll('.scene-card, [data-scene-id], .shot-card, [data-shot-id]');
        sceneCards.forEach(card => {
          card.setAttribute('draggable', 'true');
          card.style.cursor = 'grab';
          
          card.addEventListener('dragstart', (e) => {
            const sceneId = card.dataset.sceneId || card.getAttribute('data-scene-id');
            const shotId = card.dataset.shotId || card.getAttribute('data-shot-id');
            
            // Extract shot/scene data from DOM or CutAI internal state
            const label = card.querySelector('.shot-label, h3, .title')?.textContent || 
                         card.getAttribute('data-label') || 'CutAI Shot';
            const duration = parseFloat(card.dataset.duration) || 
                            parseFloat(card.getAttribute('data-duration')) || 5;
            
            const dragData = {
              type: shotId ? 'cutai-shot' : 'cutai-scene',
              label,
              duration,
              clipType: 'video',
              metadata: {
                sceneId,
                shotId,
                source: 'cutai-drag-drop'
              }
            };
            
            e.dataTransfer.setData('application/json', JSON.stringify(dragData));
            e.dataTransfer.effectAllowed = 'copy';
            card.style.opacity = '0.6';
          });
          
          card.addEventListener('dragend', () => {
            card.style.opacity = '1';
          });
        });
      }, 800);
      
      // Add "Send to Timeline" button styled like timeline editor mini-btns
      setTimeout(() => {
        const headerActions = modal.querySelector('#headerActions');
        if (headerActions) {
          const sendBtn = document.createElement('button');
          sendBtn.className = 'flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-xl text-sm font-semibold hover:shadow-glow transition-all ml-2 border border-primary/50';
          sendBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Send to Timeline
          `;
          sendBtn.onclick = () => {
            const stored = localStorage.getItem('ai-storyboard-project');
            if (stored) {
              try {
                const data = JSON.parse(stored);
                // Convert CutAI storyboard to timeline clips with full video editing support
                const clips = (data.scenes || []).flatMap((scene, sceneIdx) => 
                  (scene.shots || []).map((shot, shotIdx) => {
                    const duration = shot.duration || shot.shot_duration || 5;
                    const startTime = sceneIdx * 12 + shotIdx * duration;
                    const clipType = shot.shot_type?.toLowerCase().includes('text') ? 'text' : 
                                     shot.shot_type?.toLowerCase().includes('audio') ? 'audio' : 'video';
                    
                    return {
                      id: `cutai-${Date.now()}-${sceneIdx}-${shotIdx}`,
                      name: shot.description || shot.title || scene.title || `Shot ${shot.shotNumber || shotIdx + 1}`,
                      type: clipType,
                      start: startTime,
                      end: startTime + duration,
                      sourceStart: 0,
                      sourceEnd: duration,
                      duration: duration,
                      assetId: shot.asset_id || shot.sd_prompt ? `cutai-asset-${sceneIdx}-${shotIdx}` : null,
                      volume: 1,
                      opacity: 1,
                      playbackRate: 1,
                      effects: shot.effects || [],
                      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
                      lane: 0,
                      source: 'cutai',
                      metadata: {
                        ...shot,
                        sceneNumber: scene.scene_number || sceneIdx + 1,
                        shotNumber: shot.shot_number || shotIdx + 1,
                        shotType: shot.shot_type,
                        cameraAngle: shot.camera_angle,
                        cameraMovement: shot.camera_movement,
                        mood: {
                          tension: scene.mood_tension || scene.mood?.tension,
                          energy: scene.mood_energy || scene.mood?.energy,
                          emotion: scene.mood_emotion || scene.mood?.emotion
                        },
                        prompt: shot.sd_prompt || shot.prompt,
                        timeOfDay: scene.time_of_day,
                        location: scene.location,
                        soundtrack: scene.soundtrack_genre ? {
                          genre: scene.soundtrack_genre,
                          tempo: scene.soundtrack_tempo
                        } : null
                      }
                    };
                  })
                );
                
                let addedCount = 0;
                clips.forEach(clip => {
                  // Determine appropriate track based on clip type and shot characteristics
                  let targetTrack = null;
                  const isInsertShot = clip.metadata?.shotType?.toLowerCase().includes('insert');
                  const isBroll = clip.metadata?.shotType?.toLowerCase().includes('b-roll') || 
                                  clip.metadata?.shotType?.toLowerCase().includes('cutaway');
                  
                  if (isBroll || isInsertShot) {
                    // B-roll and insert shots go to B-Roll track
                    targetTrack = state.project?.tracks?.find(t => 
                      t.type === 'b-roll' || t.type === 'B-Roll' || t.type === 'overlay'
                    );
                    if (!targetTrack && state.addTrack) {
                      state.addTrack('B-Roll');
                      targetTrack = state.project?.tracks?.find(t => 
                        t.type === 'b-roll' || t.type === 'B-Roll' || t.type === 'overlay'
                      );
                    }
                  } else if (clip.type === 'video' || clip.type === 'image') {
                    targetTrack = state.project?.tracks?.find(t => t.type === 'video' || t.type === 'Video');
                  } else if (clip.type === 'audio') {
                    targetTrack = state.project?.tracks?.find(t => t.type === 'audio' || t.type === 'Audio');
                  } else if (clip.type === 'text') {
                    targetTrack = state.project?.tracks?.find(t => t.type === 'text' || t.type === 'Text' || t.type === 'subtitle');
                  }
                  
                  // Fallback to first available track or create appropriate track
                  if (!targetTrack) {
                    targetTrack = state.project?.tracks?.[0];
                  }
                  
                  if (!targetTrack && state.addTrack) {
                    state.addTrack(clip.type === 'audio' ? 'Audio' : clip.type === 'text' ? 'Text' : 'Video');
                    targetTrack = state.project?.tracks?.find(t => 
                      t.type === (clip.type === 'audio' ? 'audio' : clip.type === 'text' ? 'text' : 'video')
                    ) || state.project?.tracks?.[0];
                  }
                  
                  if (targetTrack && state.addClip) {
                    const clipData = {
                      ...clip,
                      trackId: targetTrack.id,
                      name: clip.name || clip.label
                    };
                    state.addClip(targetTrack.id, clipData);
                    addedCount++;
                    
                    // Apply mood-based color correction if mood data exists
                    if (clip.metadata?.mood && state.addColorCorrection) {
                      const mood = clip.metadata.mood;
                      const colorGrade = {
                        brightness: mood.tension > 0.7 ? -0.1 : mood.energy > 0.7 ? 0.05 : 0,
                        contrast: mood.tension > 0.6 ? 1.1 : 1.0,
                        saturation: mood.emotion === 'dark' || mood.darkness > 0.5 ? 0.85 : 1.0,
                        temperature: mood.emotion === 'warm' ? 200 : mood.emotion === 'cold' ? -200 : 0
                      };
                      state.addColorCorrection(targetTrack.id, clip.id, colorGrade);
                    }
                    
                    // Add camera movement as keyframe effect if present
                    if (clip.metadata?.cameraMovement && state.addEffect) {
                      const movementMap = {
                        'Pan Left': { type: 'pan', direction: -1 },
                        'Pan Right': { type: 'pan', direction: 1 },
                        'Tilt Up': { type: 'tilt', direction: 1 },
                        'Tilt Down': { type: 'tilt', direction: -1 },
                        'Dolly In': { type: 'dolly', direction: 1 },
                        'Dolly Out': { type: 'dolly', direction: -1 },
                        'Tracking Shot': { type: 'tracking', direction: 1 }
                      };
                      const movement = movementMap[clip.metadata.cameraMovement];
                      if (movement) {
                        state.addEffect(targetTrack.id, clip.id, {
                          type: 'camera-move',
                          ...movement,
                          duration: clip.duration
                        });
                      }
                    }
                  }
                });
                
                
                cutaiContainer.remove();
              } catch (e) {
                console.error('CutAI import error:', e);
                
              }
            } else {
              
            }
          };
          headerActions.appendChild(sendBtn);
        }
      }, 150);

      cutaiContainer.appendChild(modal);
      document.body.appendChild(cutaiContainer);
      
      // Close on backdrop click (but not on modal content)
      cutaiContainer.onclick = (e) => {
        if (e.target === cutaiContainer) {
          cutaiContainer.remove();
          document.removeEventListener('keydown', escHandler);
        }
      };

      // Close on Escape key
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          cutaiContainer.remove();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);

      // Safety net: if the container is removed by any other means
      // (e.g., parent cleanup), also remove the keydown listener
      const removeObserver = new MutationObserver(() => {
        if (!document.body.contains(cutaiContainer)) {
          document.removeEventListener('keydown', escHandler);
          removeObserver.disconnect();
        }
      });
      removeObserver.observe(document.body, { childList: true, subtree: true });
      
    } catch (err) {
      console.error('Failed to load CutAI module:', err);
      
      cutaiContainer.remove();
    }
  };
  window.showCutAIFromTimeline = showCutAI;

  // Central namespace for timeline-editor global hooks. Prevents collisions with
  // other modules while keeping all feature bridges intact. Each bridge function
  // is exposed both on this namespace and (where used elsewhere) on window directly.
  window.TimelineEditor = window.TimelineEditor || {};

  const template = `
<div class="app-shell">
  <header class="header">
    <div class="brand">
      <div class="brand-mark">🎬</div>
      <div>
        <div class="brand-title">SmartVideo AI</div>
        <div class="brand-sub">Timeline Editor</div>
      </div>
    </div>
    <div class="project-head">
      <div class="title" id="projectTitle">Untitled Sequence</div>
      <div class="sub" id="projectSub">1080 × 1920 · 30 fps</div>
    </div>
    <div class="top-actions" id="topActions">
      <button class="top-icon" aria-label="Undo">↶</button>
      <button class="top-icon" aria-label="Redo">↷</button>
      <button class="top-icon active" aria-label="Timeline view" aria-pressed="true">▦</button>
      <button class="top-icon" id="openSettings" aria-label="Settings" title="Settings">⚙</button>
      <button class="top-icon" id="openConnect" aria-label="Connections" title="Connections">🔗</button>
      <button class="top-icon" id="openAgents" aria-label="AI Agents" title="AI Agents">🤖</button>
      <button class="top-icon" id="openSave" aria-label="Save project" title="Save">💾</button>
      <span class="ready-pill"><span class="ready-dot"></span>Render Ready</span>
    </div>
  </header>

  <!-- Feature index bar (prototype parity) -->
  <nav class="feature-index" aria-label="All editor features">
    <span class="fi-label">All features:</span>
    <button class="fi-chip" data-modal="previewMedia">Media Preview</button>
    <button class="fi-chip" data-modal="videoPlayer">Video Player</button>
    <button class="fi-chip" data-modal="recorder">Recorder</button>
    <button class="fi-chip" data-modal="urlVideo">URL Video</button>
    <button class="fi-chip" data-modal="templates">Templates</button>
    <button class="fi-chip" data-modal="aiVideo">AI Video</button>
    <button class="fi-chip" data-modal="personalization">Personalization</button>
    <button class="fi-chip" data-modal="landing">Landing Builder</button>
    <button class="fi-chip" data-modal="social">Social Publish</button>
    <button class="fi-chip" data-modal="email">Email Campaign</button>
    <button class="fi-chip" data-modal="leads">Lead Gen</button>
    <button class="fi-chip" data-modal="contacts">Contacts</button>
    <button class="fi-chip" data-modal="endScreen">End Screen</button>
    <button class="fi-chip" data-modal="import">Import Timeline</button>
    <button class="fi-chip" data-modal="storyboard">CutAI Storyboard</button>
    <button class="fi-chip" data-modal="subtitleEditor">Subtitle Editor</button>
    <button class="fi-chip" data-modal="imageCrop">Image Cropper</button>
    <button class="fi-chip" data-modal="imageEdit">Image Editor</button>
    <button class="fi-chip" data-modal="voice">Voice</button>
  </nav>

  <div class="main-grid">
    <div class="left-col">
      <section class="preview-card preview-large">
        <div class="preview-glow"></div>
        <div class="preview-inner">
          <div class="viewer">
            <div class="viewer-stage" id="viewerStage">
              <div class="viewer-frame" id="viewerFrame">
                <div class="remotion-stage" id="remotionStage" aria-label="Video preview"></div>
                <div class="preview-stage" id="previewStage"></div>
                <div class="mask-overlay" id="maskOverlay" hidden></div>
                <div class="vf-gradient"></div>
                <div class="preview-empty" id="previewEmpty">
                  <div class="vf-subtitle" id="vfSubtitle">Your story starts here.</div>
                </div>
              </div>
               <div class="viewer-controls">
                 <button class="circle-btn" id="rewindBtn" data-tooltip="Rewind - Move the playhead back by 10% (←)" aria-label="Rewind the playhead by 10%">⏮</button>
                 <button class="circle-btn primary" id="playBtn" data-tooltip="Play or pause timeline preview (Spacebar)" aria-label="Play or pause timeline preview">▶</button>
                 <button class="circle-btn" id="stopBtn" data-tooltip="Stop - Stop playback and return to beginning" aria-label="Stop playback and return to the beginning">⏹</button>
                 <div class="vf-progress"><div class="vf-fill" id="progressFill" style="width:28%"></div></div>
                 <span class="vf-time"><span id="currentTime">00:00.0</span> / <span id="totalTime">00:00.0</span></span>
                 <div class="viewer-mode-btns" role="group" aria-label="Viewer mode" style="margin-left:8px;display:flex;gap:4px;">
                   <button class="viewer-mode-btn active" data-viewer="timeline" title="Timeline view">Timeline</button>
                   <button class="viewer-mode-btn" data-viewer="source" title="Source viewer">Source</button>
                   <button class="viewer-mode-btn" data-viewer="split" title="Split view">Split</button>
                 </div>
                 <label class="pz-ui pz-switcher" title="Preview the video as each contact sees it"><select id="previewContactSelect" class="pz-select" aria-label="Preview as contact"></select></label>
               </div>
            </div>
            <div class="filmstrip" id="filmstrip" aria-label="Clip thumbnails"></div>
          </div>
        </div>
        <input type="file" id="uploadInput" accept="video/*,image/*,audio/*,.txt" hidden data-testid="file-input" />
      </section>
      <section class="timeline-card" data-testid="timeline-container">
        <div class="timeline-top">
          <div class="toolbar-left">
            <div class="tool-group" role="group" aria-label="Playback">
              <button class="tool-btn" id="tbRewind" data-tooltip="Jump to start" aria-label="Jump to start">⏮</button>
              <button class="tool-btn active" id="tbPlay" data-tooltip="Play or pause timeline preview (Spacebar)" aria-label="Play or pause timeline preview" aria-pressed="true">▶</button>
              <button class="tool-btn" id="tbStop" data-tooltip="Jump to end" aria-label="Jump to end">⏭</button>
            </div>
            <div class="time-readout" aria-live="off">
              <span class="time-now">00:00.0</span>
              <span class="time-total">/ 00:00.0</span>
            </div>
            <div class="tool-group" role="group" aria-label="Edit tools">
              <button class="tool-btn" id="tbSplit" data-tooltip="Split selected clip at playhead" aria-label="Split clip at playhead">✂</button>
              <button class="tool-btn" id="tbDelete" data-tooltip="Delete selected clip" aria-label="Delete selected clip">⌫</button>
              <button class="tool-btn" id="tbAddTrack" data-tooltip="Add a video track" aria-label="Add a video track">＋</button>
              <button class="tool-btn" id="tbMerge" data-tooltip="Merge selected clip with its touching neighbor" aria-label="Merge clips">⤡</button>
              <button class="tool-btn active" id="tbInsertMode" data-tooltip="Insert mode: push downstream when dropping" aria-label="Insert mode" aria-pressed="true">Insert</button>
              <button class="tool-btn" id="tbOverwriteMode" data-tooltip="Overwrite mode: replace existing media" aria-label="Overwrite mode">Overwrite</button>
              <button class="tool-btn active" id="tbSnap" data-tooltip="Snap clips to grid / edges / playhead" aria-label="Snap toggled">Snap</button>
              <button class="tool-btn" id="tbMask" data-tooltip="Mask tool - AI object isolation (X)" aria-label="Mask tool">🎭</button>
            </div>
          </div>
          <div class="zoom" role="group" aria-label="Zoom">
            <button class="zoom-btn" data-action="zoom-out" data-tooltip="Zoom out - See more of the timeline (Mouse wheel)" aria-label="Zoom out on the timeline">−</button>
            <div class="zoom-track" aria-hidden="true"><div class="zoom-fill"></div><div class="zoom-knob"></div></div>
            <button class="zoom-btn" data-action="zoom-in" data-tooltip="Zoom in - See timeline in more detail (Mouse wheel)" aria-label="Zoom in on the timeline">＋</button>
            <button class="zoom-btn" data-action="zoom-fit" aria-label="Fit to window" title="Fit" data-tooltip="Fit timeline to window">⤢</button>
          </div>
          <div class="tool-group" id="toolGroup" hidden></div>
          <div class="pill-row" id="pillRow" hidden></div>
        </div>
        <div class="timeline-shell">
          <div class="timeline-header">
            <div class="corner">
              <span>Tracks</span>
              <span class="hint">drag • snap</span>
            </div>
            <div class="ruler" id="timelineRuler">
              <canvas id="rulerCanvas"></canvas>
            </div>
            <div id="miniMapContainer" style="position:relative;">
              <div id="miniMap"></div>
            </div>
              <div class="ruler-ticks" id="rulerTicks"></div>
            </div>
          </div>
          <div class="timeline-tabs-bar" id="timelineTabsBar" style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:rgba(255,255,255,0.03);border-bottom:1px solid var(--border);">
            <span style="font-size:11px;color:var(--text-dim);margin-right:4px;">Timelines:</span>
            <button class="mini-btn" id="addTimelineTabBtn" title="Add new timeline tab">+ New Tab</button>
            <span id="timelineTabsContainer" style="display:flex;gap:4px;flex:1;overflow-x:auto;"></span>
          </div>
          <div class="timeline-body" id="timelineBody">
            <div class="compositing-overlay" id="compositingOverlay"></div>
            <div class="playhead-layer"><div class="playhead-line" id="playheadLine"></div><div class="playhead-knob" id="playheadKnob" role="slider" tabindex="0" aria-label="Playhead position" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="00:00.0"></div></div>
            <div id="trackRows"></div>
          </div>
        </div>
      </section>
    </div>
    <div class="side-col">
      <!-- AI Assistant (prototype parity) -->
      <aside class="side-card" id="agentPanel">
        <h3 class="card-title cyan">AI Assistant</h3>
        <div class="chat-stack" id="aiChatStack">
          <div class="chat-bubble ai" style="opacity:0.7;">Select a clip or ask the AI assistant to edit your timeline.</div>
        </div>
        <div class="chat-input">
          <input class="text-input" placeholder="Ask the editor to do anything…" aria-label="Message AI assistant" />
          <button class="primary-btn" aria-label="Send" data-modal="aiVideo">↑</button>
        </div>
      </aside>

      <aside class="side-card">
        <h3 class="card-title">Media Library</h3>
        <div class="media-grid" id="mediaGrid">
          <button class="media-item" draggable="true" data-type="video" data-label="Clip 01"><span class="media-icon">🎥</span><span class="media-copy"><span class="media-label">Clip 01</span><span class="media-desc">0:14 · 1080p</span></span></button>
          <button class="media-item" draggable="true" data-type="audio" data-label="VO Raw"><span class="media-icon">🎙️</span><span class="media-copy"><span class="media-label">VO Raw</span><span class="media-desc">0:48 · WAV</span></span></button>
          <button class="media-item" draggable="true" data-type="image" data-label="Logo"><span class="media-icon">🖼️</span><span class="media-copy"><span class="media-label">Logo</span><span class="media-desc">PNG · 512</span></span></button>
          <button class="media-item" draggable="true" data-type="audio" data-label="Track"><span class="media-icon">🎵</span><span class="media-copy"><span class="media-label">Track</span><span class="media-desc">2:10 · MP3</span></span></button>
        </div>
        <button class="upload-btn" id="uploadBtn" style="margin-top:10px;">Upload media…</button>
        <button class="upload-btn" id="pexelsMediaBtn" style="margin-top:10px; background: rgba(217,255,0,0.1); border-color: rgba(217,255,0,0.3); color: #d9ff00;">🎬 Browse Stock Media</button>
      </aside>

      <aside class="side-card">
        <h3 class="card-title">Generate</h3>
        <div class="media-grid">
          <button class="media-item" data-modal="templates"><span class="media-icon">✂️</span><span class="media-copy"><span class="media-label">Auto Cut</span><span class="media-desc">Silence detect</span></span></button>
          <button class="media-item" data-modal="subtitleEditor"><span class="media-icon">🌐</span><span class="media-copy"><span class="media-label">Subtitles</span><span class="media-desc">Transcribe</span></span></button>
          <button class="media-item" data-modal="aiVideo"><span class="media-icon">🤖</span><span class="media-copy"><span class="media-label">AI Video</span><span class="media-desc">Generate</span></span></button>
          <button class="media-item" data-modal="storyboard"><span class="media-icon">🎞️</span><span class="media-copy"><span class="media-label">CutAI Board</span><span class="media-desc">Storyboard</span></span></button>
        </div>
      </aside>

      <!-- Hidden editor panels (accessible from floating rail) -->
      <aside class="side-card" id="sceneDetectorPanel" hidden><div id="sceneDetectorContainer"></div></aside>
      <aside class="side-card" id="interactivePanel" hidden data-tooltip="Interactive - Video controls and lead generation">
        <div class="card-title">⚡ Interactive</div>
        <div id="interactiveAddonList"></div>
        <div id="listBuilderSettings" class="addon-panel__optin" hidden></div>
      </aside>
      <aside class="side-card" id="overlaysPanel" hidden data-tooltip="Overlays - Text, images and stickers over the video">
        <div class="card-title">🧩 Overlays</div>
        <div id="overlayAddonList"></div>
        <div class="addon-panel__section" id="overlayPresets"></div>
      </aside>
      <aside class="side-card" id="blendPanel" hidden data-tooltip="Blend Modes - light leaks, bokeh, textures and colour washes blended over the video">
        <div class="card-title">🌈 Blend Modes</div>
        <div id="blendLibrary"></div>
      </aside>
      <aside class="side-card" id="stockPanel" hidden data-tooltip="Stock media - Pixabay and Pexels videos and images">
        <div class="card-title">🎬 Stock Media</div>
        <div id="stockBrowser"></div>
      </aside>
      <aside class="side-card" id="sharePanel" hidden data-tooltip="Share - publish an interactive video link and embed code">
        <div class="card-title">🔗 Share</div>
        <div id="shareBody"></div>
      </aside>
      <aside class="side-card" id="aiAgentPanel" hidden data-tooltip="AI Agent - describe a video or animation and the agent builds it">
        <div class="card-title">🤖 AI Agent</div>
        <div id="aiAgentChat"></div>
      </aside>
      <aside class="side-card" id="cameraEffectsPanel" hidden>
        <div class="card-title">🎥 Camera FX</div>
        <div id="cameraEffectsContainer"></div>
        <div class="camera-effects-quick">
          <button class="mini-btn" data-camera-effect="shake">Shake</button>
          <button class="mini-btn" data-camera-effect="orbit">Orbit</button>
          <button class="mini-btn" data-camera-effect="hitchcock">Hitchcock</button>
          <button class="mini-btn" data-camera-effect="pan-left">Pan L</button>
          <button class="mini-btn" data-camera-effect="pan-right">Pan R</button>
          <button class="mini-btn" data-camera-effect="tilt-up">Tilt U</button>
          <button class="mini-btn" data-camera-effect="tilt-down">Tilt D</button>
        </div>
      </aside>
      <aside class="side-card" id="cinegenResultsPanel" hidden data-tooltip="AI Tools - Fill Gap, Extend, Element and Shot Board on your own MuAPI key">
        <div class="card-title">🎨 AI Tools</div>
        <div class="pz-ui rp">
          <p class="pz-hint">Make footage and images with your own MuAPI key: bridge a gap, extend a clip, create an element or storyboard a scene.</p>
          <button type="button" class="pz-btn pz-btn-primary" id="openAiTools">Open AI Tools</button>
          <span class="pz-label">History</span>
        </div>
        <div id="cinegenResults" class="pz-ui aitool-history"><p class="pz-hint">Nothing made yet.</p></div>
        <button class="mini-btn" id="clearCineGenResults" style="margin-top: 8px; width: 100%;">Clear history</button>
      </aside>
      <aside class="side-card" id="clipSettingsPanel" hidden data-tooltip="Clip editor - Edit selected clip properties">
        <div class="card-title">🎬 Clip Editor</div><div id="clipEditorContainer"></div>
      </aside>
      <aside class="side-card" id="transitionSettingsPanel" hidden data-tooltip="Transitions - Add effects between clips">
        <div class="card-title">🔄 Transitions</div><div id="transitionEditorContainer"></div>
      </aside>
      <aside class="side-card" id="multiCameraPanel" hidden data-tooltip="Multi-camera editing, PIP, and split screen">
        <div class="card-title">📺 Multi-Camera</div>
        <div id="multiCameraToolbar"></div>
        <div id="pipControls" class="pip-controls-container" hidden></div>
        <div id="splitControls" class="split-controls-container" hidden></div>
      </aside>
      <aside class="side-card" id="colorCorrectionPanel" hidden data-tooltip="Color correction">
        <div class="card-title">🎨 Color Correction</div><div id="colorCorrectionContainer"></div>
      </aside>
      <aside class="side-card" id="colorScopesPanel" hidden data-tooltip="Color scopes">
        <div class="card-title">📊 Color Scopes</div><div id="colorScopesContainer"></div>
      </aside>
      <aside class="side-card" id="tokenEditorPanel" hidden data-tooltip="Token editor"><div class="card-title">🏷️ Token Editor</div><div id="tokenEditorContainer"></div></aside>
      <aside class="side-card" id="batchGeneratorPanel" hidden data-tooltip="Batch generator"><div class="card-title">📦 Batch Generator</div><div id="batchGeneratorContainer"></div></aside>
      <aside class="side-card" id="personalizationPanel" hidden data-tooltip="Personalization"><div class="card-title">👤 Personalization</div><div id="personalizationContainer"></div></aside>
      <aside class="side-card" id="personalizationEditorPanel" hidden data-tooltip="Personalization editor"><div class="card-title">✏️ Personalization Editor</div><div id="personalizationEditorContainer"></div></aside>
    </div>
  </div>
</div>
<div class="floating-rail" id="floatingRail"></div>
<div class="status-toast" id="toast"></div>
<!-- Screen-reader live region for playhead announcements (prototype parity) -->
<div class="sr-only" id="srStatus" aria-live="polite"></div>
<div class="modal-overlay" id="modalOverlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
  <div class="modal-content" id="modalContent">
    <div class="modal-header">
      <h3 id="modalTitle">Advanced Editing</h3>
      <button class="modal-close" id="modalClose" data-tooltip="Close modal" aria-label="Close modal">✕</button>
    </div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>
`;

  function injectStyles() {
    // No-op: the timeline design-system styles (timeline-tokens.css and
    // timeline-editor-page.css) are now imported statically at the top of this
    // module, so Vite bundles and emits them into the production build with
    // correct (subpath-safe) URLs. Injecting them via a runtime <link> to a
    // project-root path 404s in production because Vite never copies
    // unreferenced files into dist/. Kept as a guard so existing call sites
    // remain valid.
    if (document.getElementById('timeline-editor-styles')) return;
    const marker = document.createElement('meta');
    marker.id = 'timeline-editor-styles';
    marker.name = 'timeline-editor-styles-loaded';
    document.head.appendChild(marker);
  }

  // Memoize SVG data-URI generation so identical posters are created once and
  // reused. Bounds the cache to avoid unbounded growth across long sessions.
  const _svgPosterCache = new Map();
  function svgDataUri(markup) {
    const cached = _svgPosterCache.get(markup);
    if (cached) return cached;
    const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    if (_svgPosterCache.size > 200) {
      _svgPosterCache.clear();
    }
    _svgPosterCache.set(markup, uri);
    return uri;
  }

  function createState() {
    const baseState = createTimelineState();

    // Initialize keyframe system
    baseState.keyframeSystem = new KeyframeSystem();

    // Page-level legacy defaults (restored from pre-regression shape).
    // Canonical TimelineState provides project.tracks + timelines MAP +
    // activeTimelineId; the page below also reads top-level tracks, pills,
    // media, generateTypes, railActions, tools, undo/redo stacks, etc.
    // These defaults carry NO demo media overlay semantics — tracks are
    // the prototype seed the page has always shipped with.
    const demoState = {
      projectTitle: 'Untitled Sequence',
      selectedTool: 'Select',
      selectedClipId: 'clip-hero',
      generateType: 'Text',
      playing: false,
      playheadPercent: 34,
      viewerMode: 'timeline',
      proxyEnabled: false,
      timelineTabs: [],
      selectedTimelineId: null,
      activeTimelineId: null,
      zoom: 1,
      timelineSeconds: 45,
      tracks: [
        { id: 'track-video', type: 'video', name: 'Main Video', muted: false, solo: false, locked: false,
          clips: [
            { id: 'clip-hero', name: 'Hero Wide', left: 2, width: 22, type: 'video' },
            { id: 'clip-product', name: 'Product Spin', left: 25, width: 16, type: 'video' },
            { id: 'clip-lifestyle', name: 'Lifestyle B', left: 46, width: 20, type: 'video' }
          ],
          transitions: [{ left: 40, width: 5, duration: 0.5, name: 'Crossfade' }] },
        { id: 'track-audio', type: 'audio', name: 'Voiceover', muted: false, solo: false, locked: true,
          clips: [
            { id: 'clip-vo1', name: 'VO Take 1', left: 2, width: 40, type: 'audio' },
            { id: 'clip-vo2', name: 'VO Take 2', left: 44, width: 30, type: 'audio' }
          ] },
        { id: 'track-text', type: 'text', name: 'Titles', muted: false, solo: false, locked: false,
          clips: [
            { id: 'clip-lower', name: 'Lower Third', left: 8, width: 14, type: 'text' },
            { id: 'clip-title', name: 'Title Card', left: 30, width: 20, type: 'text' },
            { id: 'clip-end', name: 'End Card', left: 54, width: 12, type: 'text' }
          ],
          markers: [52] },
        { id: 'track-fx', type: 'effects', name: 'Effects', muted: false, solo: false, locked: false,
          clips: [
            { id: 'clip-grade', name: 'Color Grade', left: 2, width: 60, type: 'effects' }
          ] }
      ],
      tools: baseState.tools,
      pills: ['Text to Video', 'Image to Video', 'Retake', 'Extend', 'B-Roll', 'Music Gen', 'Audio Sync', 'Fill Gap AI', 'Elements', 'Import Timeline', 'IC-LoRA'],
      topIcons: ['↶','↷','▦','⚙','🔗','🤖','💾'],
      media: [
        { icon: '🎬', label: 'Clip 01', type: 'video', desc: '0:14 · 1080p', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
        { icon: '🎙️', label: 'VO Raw', type: 'audio', desc: '0:48 · WAV', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3' },
        { icon: '🖼️', label: 'Logo', type: 'image', desc: 'PNG · 512', src: 'https://picsum.photos/seed/smartvideo/640/360' },
        { icon: '🎵', label: 'Track', type: 'audio', desc: '2:10 · MP3', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' }
      ],
      generateTypes: [['✍️', 'Text'], ['🖼️', 'Image'], ['🔄', 'Retake'], ['➡️', 'Extend'], ['🎞️', 'B-Roll']],
      quickCommands: ['⚡Generate','Retake','Extend','B-Roll','🎬 Detect Scenes'],
      railActions: [
        ['＋', 'Media'],
        ['✨', 'Generate', true],
        ['⬆', 'Export'],
        ['⚡', 'Interactive'],
        ['🧩', 'Overlays'],
        ['🌈', 'Blend Modes'],
        ['🏁', 'End Screens'],
        ['📇', 'Connect Form'],
        ['🗣️', 'Smart Speech'],
        ['🎞️', 'Stock Media'],
        ['🤖', 'AI Agent'],
        ['🔗', 'Share'],
        ['🎬', 'Scene Detector'],
        ['🎥', 'Camera FX'],
        ['📊', 'Color Scopes'],
        ['🎞️', 'Multi-Cam'],
        ['✂️', 'Clip Editor'],
        ['🔄', 'Transitions Panel'],
        ['🎨', 'AI Tools'],
        ['🎭', 'AI Animation'],
        ['🎨', 'Canvas'],
        ['🏷️', 'Token Editor'],
        ['📦', 'Batch Generator'],
        ['👤', 'Personalization'],
        ['✏️', 'Personalization Editor']
      ],
      projectId: null,
      undoStack: [],
      redoStack: [],
      mediaLibrary: [],
      generationQueue: [],
      isProcessing: false,
      insertMode: true,
      overwriteMode: false,
      rippleMode: false,
      snapToGap: true,
      clipGroups: [],
      selectedClipIds: new Set(),
      clipboard: null,
      timelines: {}
    };

    const state = { ...baseState, ...demoState };

    // Unify track.clips and track.items on the merged state.
    // track.items is the canonical model; track.clips is a compatibility
    // alias for the 58+ legacy call sites. They reference the SAME array
    // so writes via either name are visible through both.
    (state.tracks || []).forEach(track => {
      if (!track || typeof track !== 'object') return;
      if (Array.isArray(track.items)) {
        track.clips = track.items;
      } else if (Array.isArray(track.clips)) {
        track.items = track.clips;
      } else {
        track.items = [];
        track.clips = track.items;
      }
    });

    // Mirror the legacy store into the new Timeline model. This is the
    // single source of truth going forward; legacy code still reads
    // state.tracks and is kept in sync via the bridge.
    state.timeline = legacyToTimeline(state);

    return state;
  }

  // Canonical TimelineState shape: state.timelines is a MAP {id: timeline}
  // keyed by id, with state.activeTimelineId as the pointer.
  // These helpers present a stable ordered-array view over the map so the
  // legacy multi-tab UI below keeps working without changing architecture.
  function timelineList(state) {
    if (Array.isArray(state.timelines)) return state.timelines;
    if (state.timelines && typeof state.timelines === 'object') return Object.values(state.timelines);
    return [];
  }

  function timelineCount(state) {
    if (Array.isArray(state.timelines)) return state.timelines.length;
    if (state.timelines && typeof state.timelines === 'object') return Object.keys(state.timelines).length;
    return 0;
  }

  function getTimelineById(state, id) {
    if (!id) return null;
    if (Array.isArray(state.timelines)) return state.timelines.find(t => t && t.id === id) || null;
    if (state.timelines && typeof state.timelines === 'object') return state.timelines[id] || null;
    return null;
  }

  function currentTimelineId(state) {
    return state.activeTimelineId || state.selectedTimelineId || null;
  }

  function setCurrentTimelineId(state, id) {
    state.activeTimelineId = id;
    state.selectedTimelineId = id;
  }

  function putTimeline(state, tl) {
    if (Array.isArray(state.timelines)) {
      const idx = state.timelines.findIndex(t => t && t.id === tl.id);
      if (idx > -1) state.timelines[idx] = tl; else state.timelines.push(tl);
    } else {
      state.timelines = { ...(state.timelines || {}), [tl.id]: tl };
    }
  }

  function removeTimelineById(state, id) {
    if (Array.isArray(state.timelines)) {
      const idx = state.timelines.findIndex(t => t && t.id === id);
      if (idx > -1) state.timelines.splice(idx, 1);
      return idx;
    }
    if (state.timelines && typeof state.timelines === 'object' && id in state.timelines) {
      const next = { ...state.timelines };
      delete next[id];
      state.timelines = next;
      return 0;
    }
    return -1;
  }

  function getCurrentTimeline(state) {
    if (!state.timelines || timelineCount(state) === 0) {
      return null;
    }
    return getTimelineById(state, currentTimelineId(state)) || timelineList(state)[0];
  }

  function ensureCurrentTimeline(state) {
    if (!state.timelines || timelineCount(state) === 0) {
      const firstTimeline = {
        id: 'timeline-' + Date.now(),
        projectTitle: state.projectTitle || 'Untitled Sequence',
        tracks: state.tracks || createState().tracks,
        playheadPercent: state.playheadPercent || 34,
        timelineSeconds: state.timelineSeconds || 45,
        zoom: state.zoom || 1
      };
      putTimeline(state, firstTimeline);
      setCurrentTimelineId(state, firstTimeline.id);
    }
    return getCurrentTimeline(state);
  }

  function syncCurrentTimelineFromState(state) {
    const current = getCurrentTimeline(state);
    if (current) {
      current.projectTitle = state.projectTitle;
      current.tracks = state.tracks;
      current.playheadPercent = state.playheadPercent;
      current.timelineSeconds = state.timelineSeconds;
      current.zoom = state.zoom;
    }
  }

  function switchToTimeline(state, timelineId) {
    syncCurrentTimelineFromState(state);
    const target = getTimelineById(state, timelineId);
    if (!target) return;
    setCurrentTimelineId(state, timelineId);
    state.projectTitle = target.projectTitle;
    state.tracks = target.tracks;
    state.playheadPercent = target.playheadPercent;
    state.timelineSeconds = target.timelineSeconds;
    state.zoom = target.zoom;
    state.selectedClipId = null;
  }

  function addNewTimeline(state) {
    syncCurrentTimelineFromState(state);
    const newTimeline = {
      id: 'timeline-' + Date.now(),
      projectTitle: 'Timeline ' + (timelineCount(state) + 1),
      tracks: createState().tracks,
      playheadPercent: 0,
      timelineSeconds: 45,
      zoom: 1
    };
    putTimeline(state, newTimeline);
    setCurrentTimelineId(state, newTimeline.id);
    state.projectTitle = newTimeline.projectTitle;
    state.tracks = newTimeline.tracks;
    state.playheadPercent = newTimeline.playheadPercent;
    state.timelineSeconds = newTimeline.timelineSeconds;
    state.zoom = newTimeline.zoom;
    state.selectedClipId = null;
  }

  // Ensure every track carries a `type` so the type-dot renderer can color
  // it correctly. Legacy/persisted projects may omit `type`; infer it from
  // the track's clips (or its name) and never leave it undefined.
  function normalizeTrackTypes(tracks) {
    if (!Array.isArray(tracks)) return tracks;
    const KNOWN = ['video', 'audio', 'text', 'effects', 'fx', 'b-roll', 'image'];
    return tracks.map(track => {
      if (track && KNOWN.includes(track.type)) return track;
      const inferred =
        (track && track.clips && track.clips[0] && track.clips[0].type) ||
        (track && /audio/i.test(track.name || '') ? 'audio'
          : /text|title|caption/i.test(track.name || '') ? 'text'
          : /b-?roll|overlay/i.test(track.name || '') ? 'b-roll'
          : /effect|fx/i.test(track.name || '') ? 'effects'
          : 'video');
      return { ...track, type: inferred };
    });
  }

  // Mask tool state for click/box capture on preview stage
  let maskClickPoint = null;
  let maskSelectionBox = null;
  let normStartX = 0;
  let normStartY = 0;

  // Enhanced state management with local storage persistence
  function loadProjectFromStorage() {
    try {
      const saved = localStorage.getItem('timeline-editor-project');
      if (saved) {
        const projectData = JSON.parse(saved);

        const state = { ...createState(), ...projectData };
        // The floating rail is UI configuration, not project data: a saved
        // project must not pin an old button list (it would hide rail
        // entries added since, such as Interactive).
        state.railActions = createState().railActions;
        // Ensure tracks is always an array
        if (!Array.isArray(state.tracks)) {
          state.tracks = createState().tracks;
        }
        state.tracks = normalizeTrackTypes(state.tracks);
        
        // Ensure timelines map exists (canonical TimelineState shape).
        const migratedList = Array.isArray(state.timelines)
          ? state.timelines
          : (state.timelines && typeof state.timelines === 'object' ? Object.values(state.timelines) : null);
        if (!migratedList || migratedList.length === 0) {
          const firstTimeline = {
            id: 'timeline-' + Date.now(),
            projectTitle: state.projectTitle || 'Untitled Sequence',
            tracks: state.tracks,
            playheadPercent: state.playheadPercent || 34,
            timelineSeconds: state.timelineSeconds || 45,
            zoom: state.zoom || 1
          };
          state.timelines = { [firstTimeline.id]: firstTimeline };
          setCurrentTimelineId(state, firstTimeline.id);
        } else if (Array.isArray(state.timelines)) {
          // Normalize legacy array shape to canonical map shape.
          const map = {};
          for (const t of state.timelines) { if (t && t.id) map[t.id] = t; }
          state.timelines = map;
          const preservedId = currentTimelineId(state);
          if (preservedId && Object.prototype.hasOwnProperty.call(map, preservedId)) {
            setCurrentTimelineId(state, preservedId);
          } else {
            setCurrentTimelineId(state, migratedList[0].id);
          }
        } else if (!currentTimelineId(state) || !state.timelines[currentTimelineId(state)]) {
          setCurrentTimelineId(state, migratedList[0].id);
        }
        
        // Mirror the legacy store into the new Timeline model so the
        // editor can start reading from it without waiting for every
        // mutation site to be migrated.
        state.timeline = syncTimelineFromState(state);
        return state;
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    }
    return createState();
  }

  function saveStateSnapshot(state) {
    state.undoStack.push(JSON.parse(JSON.stringify({
      projectTitle: state.projectTitle,
      tracks: state.tracks,
      selectedClipId: state.selectedClipId,
      playheadPercent: state.playheadPercent
    })));
    // Limit undo stack to 50 entries
    if (state.undoStack.length > 50) {
      state.undoStack.shift();
    }
    state.redoStack = [];
  }

  function undo(state) {
    if (state.undoStack.length === 0) {
      return false;
    }
    const snapshot = state.undoStack.pop();
    state.redoStack.push(JSON.parse(JSON.stringify({
      projectTitle: state.projectTitle,
      tracks: state.tracks,
      selectedClipId: state.selectedClipId,
      playheadPercent: state.playheadPercent
    })));
    Object.assign(state, snapshot);
    return true;
  }

  function redo(state) {
    if (state.redoStack.length === 0) {
      return false;
    }
    const snapshot = state.redoStack.pop();
    state.undoStack.push(JSON.parse(JSON.stringify({
      projectTitle: state.projectTitle,
      tracks: state.tracks,
      selectedClipId: state.selectedClipId,
      playheadPercent: state.playheadPercent
    })));
    Object.assign(state, snapshot);
    return true;
  }

  function formatTimeFromPercent(percent, totalSeconds) {
    const current = (percent / 100) * totalSeconds;
    const minutes = Math.floor(current / 60);
    const seconds = Math.floor(current % 60);
    // Prototype time format: MM:SS.t (tenths)
    const tenths = Math.floor((current % 1) * 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }

  function createTimelineEditorApp(root) {
    const state = loadProjectFromStorage();
    ensureCurrentTimeline(state);
    let playbackTimer = null;
    let transitionEditor = null;
    let timelineTransitions = null;
    let sceneDetector = null;
    let cameraEffects = null;
    let aiChatPanel = null;
    let colorCorrectionSystem = null;
    let cinegenHistory = [];

    // Cleanup registry to prevent memory leaks on destroy/unmount
    // Tracks all dynamic document listeners and timers so they can be released
    const cleanup = {
      documentListeners: [], // {type, handler, options}
      timers: [],            // setTimeout ids
      intervals: [],         // setInterval ids
      addDocumentListener(type, handler, options) {
        document.addEventListener(type, handler, options);
        this.documentListeners.push({ type, handler, options });
      },
      removeDocumentListener(type, handler, options) {
        document.removeEventListener(type, handler, options);
        const idx = this.documentListeners.findIndex(
          l => l.type === type && l.handler === handler
        );
        if (idx !== -1) this.documentListeners.splice(idx, 1);
      },
      windowListeners: [],
      addWindowListener(type, handler) {
        window.addEventListener(type, handler);
        this.windowListeners.push({ type, handler });
      },
      addTimer(id) { this.timers.push(id); },
      addInterval(id) { this.intervals.push(id); },
      run() {
        this.documentListeners.forEach(({ type, handler, options }) => {
          document.removeEventListener(type, handler, options);
        });
        this.documentListeners.length = 0;
        this.windowListeners.forEach(({ type, handler }) => window.removeEventListener(type, handler));
        this.windowListeners.length = 0;
        this.timers.forEach(id => clearTimeout(id));
        this.timers.length = 0;
        this.intervals.forEach(id => clearInterval(id));
        this.intervals.length = 0;
      }
    };

    // Keyboard shortcuts for undo/redo
    function handleKeyboardShortcuts(event) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedClip();
        return;
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelectedClip();
        return;
      }

      // AI Tools keyboard shortcuts (Alt+G fill gap, Alt+E extend, Alt+M music)
      if (event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'g':
            event.preventDefault();
            openAiTools('fill_gap');
            break;
          case 'e':
            event.preventDefault();
            openAiTools('extend');
            break;
          case 'm':
            event.preventDefault();
            openAgentWithPrompt('Add background music that fits the mood of this video, at a low volume under any voiceover.');
            break;
        }
      }

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'z':
            if (event.shiftKey) {
              event.preventDefault();
              if (redo(state)) renderAll();
            } else {
              event.preventDefault();
              if (undo(state)) renderAll();
            }
            break;
          case 'y':
            event.preventDefault();
            if (redo(state)) renderAll();
            break;
          case 's':
            event.preventDefault();
            debouncedSave(0); // Immediate save on user request
            showToast('Project saved', 'success');
            break;
        }
      }
    }

    // Add keyboard event listeners
    cleanup.addDocumentListener('keydown', handleKeyboardShortcuts);
    // The Personalize window (OpenHiggsBolt) keeps its clients and saved Lead
    // Finder leads in its own storage. Copy them into the contact store the
    // editor reads, on load, on focus, and whenever the studio saves something.
    const contactSync = createContactSync({ store: contactStore, onChange: () => { try { renderContactSwitcher(); } catch { /* not mounted yet */ } } });
    contactSync.run({ leads: true }).catch(() => {});
    cleanup.addInterval(setInterval(() => contactSync.check(), 2000));
    cleanup.addWindowListener('focus', () => { contactSync.run({ leads: true }).catch(() => {}); });
    cleanup.addWindowListener('storage', () => contactSync.check());
    // Picking another contact (Personalize window) re-renders the preview with
    // their details and their own personalized voice line.
    cleanup.addWindowListener('remix:contact-changed', () => {
      previewAnswers = null;
      try { scheduleEngineUpdate(); } catch { /* engine not ready */ }
      // Overlays drawn in the page (no engine) and the open Personalized
      // Image settings show the new contact's images too.
      try { renderOverlayLayer(); } catch { /* not mounted yet */ }
      try { renderContactSwitcher(); } catch { /* not mounted yet */ }
      try {
        const selected = state.selectedClipId != null ? state.tracks.flatMap((t) => t.items || []).find((c) => c.id === state.selectedClipId) : null;
        if (selected?.type === 'overlay-personalized-image') renderClipEditor(selected.id);
      } catch { /* editor not ready */ }
    });
    root.innerHTML = template;

    // Debounced project save: avoids blocking the main thread on every keystroke
    // or drag. Coalesces rapid changes into a single write at most every 400ms.
    let saveTimer = null;
    function debouncedSave(delay = 400) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          syncCurrentTimelineFromState(state);
          saveProjectToStorage(state);
        } catch (err) {
          // QuotaExceededError or serialization failure: surface to user
          if (err && err.name === 'QuotaExceededError') {
            showToast('Storage limit reached — project not auto-saved', 'error');
          } else {
            console.error('Auto-save failed:', err);
          }
        }
        saveTimer = null;
      }, delay);
      cleanup.addTimer(saveTimer);
    }

    const els = {
      topActions: root.querySelector('#topActions'),
      toolGroup: root.querySelector('#toolGroup'),
      pillRow: root.querySelector('#pillRow'),
      trackRows: root.querySelector('#trackRows'),
      timelineBody: root.querySelector('#timelineBody'),
      mediaGrid: root.querySelector('#mediaGrid'),
      generateTypes: root.querySelector('#generateTypes'),
      aiChatContainer: root.querySelector('#aiChatContainer'),
      floatingRail: root.querySelector('#floatingRail'),
      playBtn: root.querySelector('#playBtn'),
      stopBtn: root.querySelector('#stopBtn'),
      rewindBtn: root.querySelector('#rewindBtn'),
      currentTime: root.querySelector('#currentTime'),
      totalTime: root.querySelector('#totalTime'),
      progressFill: root.querySelector('#progressFill'),
      vfSubtitle: root.querySelector('#vfSubtitle'),
      previewStage: root.querySelector('#previewStage'),
      viewerFrame: root.querySelector('#viewerFrame'),
      remotionStage: root.querySelector('#remotionStage'),
      interactivePanel: root.querySelector('#interactivePanel'),
      interactiveAddonList: root.querySelector('#interactiveAddonList'),
      overlaysPanel: root.querySelector('#overlaysPanel'),
      blendPanel: root.querySelector('#blendPanel'),
      blendLibrary: root.querySelector('#blendLibrary'),

      overlayAddonList: root.querySelector('#overlayAddonList'),
      overlayPresets: root.querySelector('#overlayPresets'),
      stockPanel: root.querySelector('#stockPanel'),
      stockBrowser: root.querySelector('#stockBrowser'),
      listBuilderSettings: root.querySelector('#listBuilderSettings'),
      previewEmpty: root.querySelector('#previewEmpty'),
      playheadLine: root.querySelector('#playheadLine'),
      playheadKnob: root.querySelector('#playheadKnob'),
      rulerCanvas: root.querySelector('#rulerCanvas'),
      rulerTicks: root.querySelector('#rulerTicks'),
      timelineTabsBar: root.querySelector('#timelineTabsBar'),
      timelineTabsContainer: root.querySelector('#timelineTabsContainer'),
      addTimelineTabBtn: root.querySelector('#addTimelineTabBtn'),
      projectTitle: root.querySelector('#projectTitle'),
      promptInput: root.querySelector('#promptInput'),
      durationSelect: root.querySelector('#durationSelect'),
      aspectSelect: root.querySelector('#aspectSelect'),
      styleSelect: root.querySelector('#styleSelect'),
      generateBtn: root.querySelector('#generateBtn'),
      chatInput: root.querySelector('#chatInput'),
      toast: root.querySelector('#toast'),
      uploadBtn: root.querySelector('#uploadBtn'),
      pexelsMediaBtn: root.querySelector('#pexelsMediaBtn'),
      videoDbBtn: root.querySelector('#videoDbBtn'),
      backBtn: root.querySelector('#backBtn'),
      uploadInput: root.querySelector('#uploadInput'),
      clipSettingsPanel: root.querySelector('#clipSettingsPanel'),
      transitionSettingsPanel: root.querySelector('#transitionSettingsPanel'),
      clipEditorContainer: root.querySelector('#clipEditorContainer'),
      transitionEditorContainer: root.querySelector('#transitionEditorContainer'),
      sceneDetectorPanel: root.querySelector('#sceneDetectorPanel'),
      sceneDetectorContainer: root.querySelector('#sceneDetectorContainer'),
      cameraEffectsPanel: root.querySelector('#cameraEffectsPanel'),
      cameraEffectsContainer: root.querySelector('#cameraEffectsContainer'),
      multiCameraPanel: root.querySelector('#multiCameraPanel'),
      multiCameraToolbar: root.querySelector('#multiCameraToolbar'),
      pipControls: root.querySelector('#pipControls'),
      splitControls: root.querySelector('#splitControls'),
      colorCorrectionPanel: root.querySelector('#colorCorrectionPanel'),
      colorCorrectionContainer: root.querySelector('#colorCorrectionContainer'),
      colorScopesPanel: root.querySelector('#colorScopesPanel'),
      colorScopesContainer: root.querySelector('#colorScopesContainer'),
      compositingOverlay: root.querySelector('#compositingOverlay'),
      // Category C Editor Surfaces
      tokenEditorPanel: root.querySelector('#tokenEditorPanel'),
      tokenEditorContainer: root.querySelector('#tokenEditorContainer'),
      batchGeneratorPanel: root.querySelector('#batchGeneratorPanel'),
      batchGeneratorContainer: root.querySelector('#batchGeneratorContainer'),
      personalizationPanel: root.querySelector('#personalizationPanel'),
      personalizationContainer: root.querySelector('#personalizationContainer'),
      personalizationEditorPanel: root.querySelector('#personalizationEditorPanel'),
      personalizationEditorContainer: root.querySelector('#personalizationEditorContainer'),
      modalOverlay: root.querySelector('#modalOverlay'),
      modalContent: root.querySelector('#modalContent'),
      modalTitle: root.querySelector('#modalTitle'),
      modalBody: root.querySelector('#modalBody'),
      modalClose: root.querySelector('#modalClose')
    };

    function showToast(message, type = 'info') {
      if (!els.toast) return;
      els.toast.textContent = message;
      els.toast.className = `toast toast-${type}`;
      els.toast.style.display = 'block';
      clearTimeout(showToast._timer);
      showToast._timer = setTimeout(() => {
        if (els.toast) els.toast.style.display = 'none';
      }, 3000);
    }

    function findSelectedClip() {
      return state.tracks.flatMap((track) => track.clips).find((item) => item.id === state.selectedClipId);
    }

    // AI Tools (CineGen-derived): Fill Gap, Extend, Element and Shot Board on the
    // user's own MuAPI key. The window is src/lib/editor/panels/aiTools.js.
    function recordAiTool(result) {
      if (!result) return;
      cinegenHistory.unshift({ at: new Date(), result });
      renderAiToolHistory();
    }
    function renderAiToolHistory() {
      const box = document.getElementById('cinegenResults');
      if (!box) return;
      if (!cinegenHistory.length) { box.innerHTML = '<p class="pz-hint">Nothing made yet.</p>'; return; }
      box.innerHTML = cinegenHistory.slice(0, 30).map(({ at, result }) => {
        const ok = result.success !== false;
        const label = AI_TOOL_INFO[result.tool]?.label || 'AI Tool';
        const media = ok ? (result.urls?.[0] || result.url) : '';
        const thumb = media ? (result.tool === 'fill_gap' || result.tool === 'extend'
          ? `<video class="aitool-mini" src="${escapeHtml(media)}" muted playsinline></video>`
          : `<img class="aitool-mini" src="${escapeHtml(media)}" alt=""/>`) : '';
        return `<div class="pz-card aitool-entry">${thumb}<div><strong>${escapeHtml(label)}</strong><span class="${ok ? '' : 'pz-warning'}">${escapeHtml(summarizeResult(result))}</span><small>${at.toLocaleTimeString()}</small></div></div>`;
      }).join('');
    }
    function growTimelineTo(endSec) {
      const T = state.timelineSeconds || 60;
      if (endSec <= T) return;
      const next = Math.ceil(endSec + 1);
      state.tracks.forEach((t) => (t.items || t.clips || []).forEach((c) => {
        if (typeof c.left === 'number') { c.left = (c.left * T) / next; c.width = (c.width * T) / next; }
      }));
      state.playheadPercent = ((state.playheadPercent || 0) * T) / next;
      state.timelineSeconds = next;
      drawRuler();
    }
    function aiClipInfo(clip) {
      if (!clip) return null;
      const T = state.timelineSeconds || 60;
      const { start, end } = clipTimeRange(clip, T);
      return { id: clip.id, src: clip.src, type: clip.type, name: clip.name, durationSec: Math.max(0, end - start), trimIn: Number(clip.trimIn ?? clip.sourceStart ?? 0), startSec: start, endSec: end };
    }
    let aiToolsCursor = null;
    function openAiTools(tool) {
      const items = () => state.tracks.flatMap((t) => (t.items || t.clips || []).map((c) => ({ c, t })));
      const selectedEntry = () => (state.selectedClipId != null ? items().find(({ c }) => c.id === state.selectedClipId) : null);
      return openAiToolsWindow({
        hasKey: () => { const k = apiKeyManager.getMuapiKey?.(); return !!k && k !== 'dev'; },
        getSelected: () => {
          const e = selectedEntry();
          return e && (e.c.type === 'video' || e.c.type === 'image') && e.c.src ? aiClipInfo(e.c) : null;
        },
        getNext: (info) => {
          const e = items().find(({ c }) => c.id === info.id);
          if (!e) return null;
          const later = (e.t.items || e.t.clips || []).filter((c) => c.src && (c.type === 'video' || c.type === 'image') && (c.left ?? 0) > (e.c.left ?? 0)).sort((a, b) => a.left - b.left)[0];
          return aiClipInfo(later);
        },
        captureFrame: (info, which) => (info.type === 'image' ? Promise.resolve(info.src) : captureVideoFrame(info.src, sourceTimeFor(info, which), { upload: uploadFileToStorage })),
        upload: async (file) => { const out = await uploadFileToStorage(file); const url = typeof out === 'string' ? out : out?.url; if (!url || url.startsWith('blob:')) throw new Error('Upload failed. Sign in and try again.'); return url; },
        run: (toolName, params, o) => runTimelineAITool(toolName, params, o),
        record: recordAiTool,
        toast: showToast,
        addToLibrary: ({ src, label, type }) => {
          state.mediaLibrary = state.mediaLibrary || [];
          state.mediaLibrary.push({ id: `element-${Date.now()}`, icon: '🖼️', label, type, desc: 'AI Tools', src });
          renderMedia();
          debouncedSave();
        },
        addToTimeline: ({ kind, src, name, durationSec, after }) => {
          const T = state.timelineSeconds || 60;
          const sel = selectedEntry();
          let startSec = (state.playheadPercent / 100) * T;
          if (after === 'selected' && sel) startSec = aiClipInfo(sel.c).endSec;
          else if (after === 'previous' && aiToolsCursor != null) startSec = aiToolsCursor;
          growTimelineTo(startSec + durationSec);
          saveStateSnapshot(state);
          const clip = { id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, type: kind, name, src, start: startSec, end: startSec + durationSec, aiGenerated: true };
          insertClipIntoTrack(clip, 'video');
          aiToolsCursor = startSec + durationSec;
          scheduleEngineUpdate();
          debouncedSave();
          return clip;
        },
      }, { tool });
    }

    function clearPreviewStage() {
      const nodes = els.previewStage.querySelectorAll('*');
      nodes.forEach((node) => {
        if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') node.pause();
        node.remove();
      });
    }

    function buildAudioBars() {
      return Array.from({ length: 24 }, (_, index) => {
        const heights = [22,38,56,32,66,40,72,28,60,44,68,34,76,42,58,30,70,36,62,26,74,48,52,40];
        return `<span style="height:${heights[index]}px"></span>`;
      }).join('');
    }

    function renderPreviewAsset(selected) {
      // Remotion engine: the Player shows the whole composition, so media,
      // text and overlay clips need no separate single-clip preview.
      // Interactive cards (Lead Generator, CTA, Pause/Loop/Skip) still render
      // on top, since they are live UI rather than video pixels.
      if (remotionEngine && (!selected || isComposited(selected))) {
        clearPreviewStage();
        els.previewEmpty.style.display = engineHasContent() ? 'none' : 'flex';
        renderOverlayLayer();
        return;
      }
      if (!selected) {
        clearPreviewStage();
        els.previewEmpty.style.display = 'flex';
        if (els.vfSubtitle) els.vfSubtitle.textContent = 'Your story starts here.';
        return;
      }

      // Overlays (Smart Text, Image, Stickers, ...) are drawn by the overlay
      // compositor on top of the video, so selecting one shows the video
      // clip under the playhead rather than replacing it.
      if (getAddon(selected.type)?.category === 'overlay') {
        const base = findBaseClipAtPlayhead();
        if (base) renderPreviewAsset(base);
        else if (!els.previewStage.firstElementChild) els.previewEmpty.style.display = 'none';
        renderOverlayLayer();
        return;
      }

      // togglePlayback's interval calls this on every tick (every 120ms) so
      // keyframes stay in sync during playback. Rebuilding the media element
      // every tick would tear down and restart it from 0 continuously,
      // making video/audio preview unable to play past its first frame — so
      // skip the rebuild when the same clip is already showing. Scoped to
      // video/audio only: non-media types (lead-form, click-to-call, text)
      // have no playback state to lose, and their settings panels need
      // every field edit to reach the preview immediately.
      const existing = els.previewStage.firstElementChild;
      const isMediaType = selected.type === 'video' || selected.type === 'audio';
      // AI video clip per contact: the previewed contact's own version.
      const stateClip = selected.type === 'video' ? state.tracks.flatMap((t) => t.items || t.clips || []).find((c) => String(c.id) === String(selected.id)) : null;
      const videoSrc = selected.type === 'video' ? (stateClip?.aiPerContact ? clipSrcFor(stateClip, getActivePersonalizationProfile()) : selected.src) : '';
      const alreadyShowingThisClip = isMediaType && existing?.dataset?.clipId === String(selected.id)
        && (selected.type !== 'video' || existing?.dataset?.src === String(videoSrc || ''));

      els.previewEmpty.style.display = 'none';

      // Apply active keyframes to preview (if KeyframeSystem exists)
      if (state.keyframeSystem && state.keyframeSystem.getActiveValues) {
        const active = state.keyframeSystem.getActiveValues(selected.id, state.playheadPercent / 100 * (state.timelineSeconds || 60));
        if (active && Object.keys(active).length > 0) {
          const stage = els.previewStage;
          if (active.scale) stage.style.transform = `scale(${active.scale})`;
          if (active.opacity !== undefined) stage.style.opacity = active.opacity;
          if (active.rotation) stage.style.transform = `rotate(${active.rotation}deg)`;
          if (active['position-x'] || active['position-y']) {
            const x = active['position-x'] || 0;
            const y = active['position-y'] || 0;
            stage.style.transform = `translate(${x}%, ${y}%)`;
          }
        }
      }

      if (alreadyShowingThisClip) return;
      clearPreviewStage();

      if (selected.type === 'video' && videoSrc) {
        const video = createVideoPreview(videoSrc, 'preview-media', {
          poster: selected.poster
        });
        video.dataset.clipId = selected.id;
        video.dataset.src = String(videoSrc);
        addVideoErrorRecovery(video, {
          onError: (message) => showToast(`Preview playback error: ${message}`, 'error'),
        });
        els.previewStage.appendChild(video);
        return;
      }

      if (selected.type === 'image' && selected.src) {
        const image = document.createElement('img');
        image.className = `preview-media ${selected.fit === 'cover' ? '' : 'contain'}`;
        image.src = selected.src;
        image.alt = selected.name;
        image.dataset.clipId = selected.id;
        els.previewStage.appendChild(image);
        return;
      }

      if (selected.type === 'audio') {
        const wrap = document.createElement('div');
        wrap.className = 'preview-audio-card';
        wrap.dataset.clipId = selected.id;
        wrap.innerHTML = `
          <div class="preview-audio-top">
            <div class="preview-audio-icon">🎵</div>
            <div class="preview-audio-meta">
              <div class="preview-audio-name">${selected.name}</div>
              <div class="preview-audio-desc">Audio preview with transport and waveform styling</div>
            </div>
          </div>
          <div class="preview-audio-bars">${buildAudioBars()}</div>
        `;
        const audio = document.createElement('audio');
        audio.controls = true;
        if (selected.src) audio.src = selected.src;
        audio.style.width = '100%';
        addVideoErrorRecovery(audio, {
          onError: (message) => showToast(`Preview playback error: ${message}`, 'error'),
        });
        wrap.appendChild(audio);
        els.previewStage.appendChild(wrap);
        return;
      }

      if (selected.type === 'text') {
        const textCard = document.createElement('div');
        textCard.className = 'preview-text-card';
        textCard.dataset.clipId = selected.id;
        textCard.innerHTML = `
          <div class="preview-text-kicker">Text Overlay Preview</div>
          <div class="preview-text-heading">${selected.heading || selected.name}</div>
          <div class="preview-text-body">${selected.body || 'This clip shows how text overlays, captions, or title cards can render in the preview stage.'}</div>
        `;
        els.previewStage.appendChild(textCard);
        return;
      }

      // Behaviour-only addons (Skip / Pause / Loop) have nothing to draw on
      // the video; in the editor they show a card naming what they do, like
      // upstream's track-event label ("Pause forever", "Loop: 2", "Skip").
      const schemaAddon = getAddon(selected.type);
      if (schemaAddon && !schemaAddon.flatOptions) {
        const opts = addonOptions(selected);
        const card = document.createElement('div');
        card.className = 'preview-addon-card';
        card.dataset.clipId = selected.id;
        card.innerHTML = `
          ${schemaAddon.iconSrc ? `<img src="${escapeHtml(schemaAddon.iconSrc)}" alt="" />` : `<span aria-hidden="true">${schemaAddon.icon}</span>`}
          <strong>${escapeHtml(schemaAddon.summary ? schemaAddon.summary(opts) : schemaAddon.label)}</strong>
          <span>${escapeHtml(schemaAddon.description || '')}</span>
        `;
        els.previewStage.appendChild(card);
        return;
      }

      if (selected.type === 'lead-form') {
        const card = document.createElement('div');
        const fields = Array.isArray(selected.fields) && selected.fields.length
          ? selected.fields
          : [{ id: 'email', type: 'email', label: 'Email' }];
        // Adaptive layout: field count changes the arrangement, matching
        // upstream's per-count flex rules (2/3/4/5 fields laid out
        // differently rather than always stacking one-per-row).
        const isMobilePreview = els.previewStage.clientWidth < 640;
        card.className = `preview-form-card preview-form-card--fields-${Math.min(fields.length, 5)}${isMobilePreview ? ' preview-form-card--mobile' : ''}`;
        card.dataset.clipId = selected.id;
        const inputType = (type) => (
          type === 'phone' ? 'tel'
            : type === 'email' ? 'email'
            : type === 'number' ? 'number'
            : type === 'date' ? 'date'
            : 'text'
        );

        // Personalization pre-fill: reuse the fork's existing profile/token
        // mechanism (same one every Studio page uses for prompts) rather
        // than inventing a parallel one. {{token}} placeholders in
        // heading/CTA/privacy text resolve via replaceTokensInPrompt, and
        // fields whose id maps to a known profile variable (first_name,
        // email, company, ...) get pre-filled directly, matching upstream
        // form.js's personalizedTokens[declaration.token] behavior.
        const activeProfile = getActivePersonalizationProfile();
        const heading = activeProfile ? replaceTokensInPrompt(selected.heading || '', activeProfile) : selected.heading;
        const ctaText = activeProfile ? replaceTokensInPrompt(selected.ctaText || 'Submit', activeProfile) : (selected.ctaText || 'Submit');
        const privacyText = activeProfile ? replaceTokensInPrompt(selected.privacyText || '', activeProfile) : selected.privacyText;

        const style = selected.style || {};
        const captionAlign = style.captionAlignment || 'center';
        const fieldTokens = leadFieldTokens(fields);

        card.innerHTML = `
          <form class="preview-lead-form">
            ${selected.brandLogoUrl ? `<img class="preview-form-logo" src="${escapeHtml(selected.brandLogoUrl)}" alt="" />` : ''}
            ${heading ? `<h3 class="preview-form-heading" style="text-align:${captionAlign};${style.captionFontSize ? `font-size:${style.captionFontSize}%;` : ''}">${escapeHtml(heading)}</h3>` : ''}
            <div class="preview-form-fields">
            ${fields.map((f, i) => {
              const varKey = FIELD_TOKEN_ALIASES[f.id] || f.id;
              const prefill = activeProfile?.variables?.[varKey];
              const prefillStr = prefill ? escapeHtml(String(prefill)) : '';
              // Upstream form.js parity: answers are keyed by the field's
              // token (upper-cased label), single-line inputs cap at 80
              // chars and multiline at 250, Number is digits-only text, and
              // fields are optional unless marked required.
              const token = escapeHtml(fieldTokens[i]);
              const req = f.required ? ' required' : '';
              const fieldInput = f.type === 'multiline'
                ? `<textarea name="${token}" placeholder="${escapeHtml(f.label || '')}" rows="3" maxlength="250"${req}>${prefillStr}</textarea>`
                : f.type === 'number'
                  ? `<input type="text" inputmode="numeric" pattern="\\d*" maxlength="80" data-digits-only name="${token}" placeholder="${escapeHtml(f.label || '')}"${prefillStr ? ` value="${prefillStr}"` : ''}${req} />`
                  : `<input type="${inputType(f.type)}" name="${token}" placeholder="${escapeHtml(f.label || '')}"${f.type === 'email' || f.type === 'date' ? '' : ' maxlength="80"'}${prefillStr ? ` value="${prefillStr}"` : ''}${req} />`;
              return `
              <div class="preview-form-field">
                <label>${escapeHtml(f.label || f.type)}</label>
                ${fieldInput}
              </div>
            `;
            }).join('')}
            </div>
            ${privacyText ? `<p class="preview-form-privacy">${escapeHtml(privacyText)}</p>` : ''}
            ${selected.privacyPolicyCaption && selected.privacyPolicyLink
              ? `<a class="preview-form-privacy-link" href="${escapeHtml(selected.privacyPolicyLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(selected.privacyPolicyCaption)}</a>`
              : ''}
            <button type="submit" class="preview-form-submit" style="${style.buttonColor ? `background:${style.buttonColor};` : ''}${style.buttonFontColor ? `color:${style.buttonFontColor};` : ''}${style.buttonBorderRadius !== undefined ? `border-radius:${style.buttonBorderRadius}px;` : ''}${style.buttonBottomBorder ? `border-bottom:3px solid ${style.buttonBottomBorder};` : ''}">${escapeHtml(ctaText)}</button>
            ${selected.skipButtonEnabled ? `<button type="button" class="preview-form-skip">Skip</button>` : ''}
          </form>
        `;
        if (style.backgroundImage) {
          card.style.backgroundImage = `url(${style.backgroundImage})`;
          card.style.backgroundSize = 'cover';
          card.style.backgroundPosition = 'center';
        } else if (style.backgroundColor) {
          // Upstream form background: radial gradient of the chosen colour.
          card.style.background = formBackground({ backgroundColor: style.backgroundColor });
        }
        if (style.fontFamily) {
          ensureGoogleFontLoaded(style.fontFamily);
          card.style.fontFamily = `"${style.fontFamily}"`;
        }
        if (style.fontSize) {
          card.querySelectorAll('input, textarea, button, label').forEach((el) => {
            el.style.fontSize = `${style.fontSize}%`;
          });
        }
        // Configurable size/position as a % of the frame, replacing the
        // fixed min(82%, 480px) CSS default when the user sets one.
        if (style.widthPercent) card.style.width = `${style.widthPercent}%`;
        if (style.heightPercent) {
          card.style.maxHeight = `${style.heightPercent}%`;
          card.style.overflowY = 'auto';
        }
        card.style.alignSelf = style.position === 'top' ? 'flex-start' : style.position === 'bottom' ? 'flex-end' : 'center';
        // Entrance transition: mirrors upstream's animation.in classes
        // (formAnimationStart applying a CSS class to the transition
        // container) via a plain CSS animation instead of a JS timeline.
        if (style.transition && style.transition !== 'none') {
          card.classList.add(`preview-form-card--enter-${style.transition}`);
        }
        els.previewStage.appendChild(card);

        card.querySelectorAll('[data-digits-only]').forEach((input) => {
          input.addEventListener('input', () => {
            input.value = input.value.replace(/[^0-9]/g, '');
          });
        });

        const skipBtn = card.querySelector('.preview-form-skip');
        if (skipBtn) {
          skipBtn.addEventListener('click', () => {
            card.classList.add('preview-form-card--exit');
            card.addEventListener('animationend', () => {
              card.style.display = 'none';
            }, { once: true });
            selected._gating = false;
            if (!state.playing) togglePlayback();
          });
        }

        card.querySelector('form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.target).entries());

          selected._submittedLeads = selected._submittedLeads || [];
          selected._submittedLeads.push({ ...data, submittedAt: new Date().toISOString() });
          // Keep the Download-leads button's count in sync if its settings
          // panel is currently open for this clip.
          if (state.selectedClipId === selected.id) {
            const downloadBtn = els.clipEditorContainer.querySelector('#lf-download-leads');
            if (downloadBtn) {
              downloadBtn.disabled = false;
              downloadBtn.textContent = `Download leads (${selected._submittedLeads.length} this session)`;
            }
          }

          // Stored via the lead-capture edge function (which forwards the
          // webhooks server-side); falls back to browser-side webhook POSTs
          // when the backend is unreachable.
          const res = await captureLead({
            clipId: selected.id,
            kind: 'lead-form',
            data,
            config: selected,
            notificationEmail: selected.emailNotificationEnabled ? selected.notificationEmail : '',
          });
          const lastLead = selected._submittedLeads[selected._submittedLeads.length - 1];
          if (lastLead) lastLead._stored = !!res.stored;
          showToast(
            leadResultMessage(res, selected.emailNotificationEnabled && selected.notificationEmail),
            res.failed ? 'error' : 'success',
          );

          applyPreviewAnswers(data);

          // Upstream form: once submitted it never shows again, and a form
          // that paused the video resumes it.
          selected._submitted = true;
          addonRuntime.markSubmitted(selected.id);
          if (selected._gating) {
            selected._gating = false;
            card.classList.add('preview-form-card--exit');
            if (!state.playing) togglePlayback();
          }

          if (selected.fbPixelId) {
            if (typeof window.fbq === 'function') {
              window.fbq('trackSingle', selected.fbPixelId, 'Lead', data);
            } else {
              showToast(`Facebook Pixel ${selected.fbPixelId} configured, but the Pixel script isn't loaded on this page`, 'info');
            }
          }
        });
        return;
      }

      if (selected.type === 'click-to-call') {
        // A real <a href="tel:…"> / https link. The button itself is either
        // the plain CSS pill or an animated Lottie (upstream json-button):
        // generated styles from ctaLottie.js, or the user's own Lottie file.
        const ctcStyle = selected.style || {};
        const wrap = document.createElement('div');
        wrap.className = 'preview-click-to-call';
        wrap.dataset.clipId = selected.id;
        // Upstream json-button's single "URL (Call-to-action)" accepted a
        // phone number or a web link; here a valid phone number wins, else
        // an http(s) link opens in a new tab.
        const phoneValid = isValidPhoneNumber(selected.phoneNumber);
        const linkValid = !phoneValid && isValidCtaLink(selected.linkUrl);
        const valid = phoneValid || linkValid;
        const telHref = phoneValid
          ? `tel:${(selected.phoneNumber || '').replace(/[^0-9+]/g, '')}`
          : linkValid ? escapeHtml(selected.linkUrl.trim()) : '#';
        wrap.innerHTML = `
          <a class="preview-call-btn ${valid ? '' : 'preview-call-btn--invalid'}" href="${telHref}"${linkValid ? ' target="_blank" rel="noopener noreferrer"' : ''}${valid ? '' : ' aria-disabled="true" title="Enter a valid phone number or link in the clip settings"'}${ctcStyle.buttonColor ? ` style="background:${escapeHtml(ctcStyle.buttonColor)}"` : ''}>
            ${linkValid ? '🔗' : '📞'} ${escapeHtml(selected.buttonText || 'Call Now')}
          </a>
        `;
        if (!valid) {
          wrap.querySelector('a').addEventListener('click', (e) => e.preventDefault());
        }
        const ctaAnim = selected.animation || 'none';
        if (ctaAnim !== 'none') {
          const a = wrap.querySelector('a');
          a.classList.add('preview-call-btn--lottie');
          a.innerHTML = `<span class="cta-lottie" aria-label="${escapeHtml(selected.buttonText || 'Call Now')}"></span>`;
          wrap.style.aspectRatio = String(CTA_ASPECT);
          const host = a.firstElementChild;
          (async () => {
            const lottie = (await import('lottie-web')).default;
            let data = ctaAnim === 'custom' ? null : buildCtaLottie({ ...selected, buttonColor: ctcStyle.buttonColor });
            if (ctaAnim === 'custom' && selected.lottieSrc) {
              try { data = await (await fetch(selected.lottieSrc)).json(); } catch { data = null; }
            }
            if (data && host.isConnected) lottie.loadAnimation({ container: host, renderer: 'svg', loop: true, autoplay: true, animationData: data });
          })();
        }

        // Positioning within the frame (% of the preview stage), matching
        // upstream json-button's left/top/width/height model. Anchored by
        // center point so drag math and CSS translate stay in sync.
        const posLeft = ctcStyle.posLeft ?? 50;
        const posTop = ctcStyle.posTop ?? 50;
        const posWidth = ctcStyle.posWidth ?? 40;
        wrap.style.position = 'absolute';
        wrap.style.left = `${posLeft}%`;
        wrap.style.top = `${posTop}%`;
        wrap.style.width = `${posWidth}%`;
        wrap.style.transform = 'translate(-50%, -50%)';
        wrap.style.mixBlendMode = ctcStyle.blendMode || 'normal';
        wrap.style.opacity = (ctcStyle.opacity ?? 100) / 100;

        els.previewStage.appendChild(wrap);

        // Drag-to-move + resize, only when this clip is the current
        // timeline selection — otherwise every click-to-call preview would
        // intercept clicks meant for the tel: link.
        if (state.selectedClipId === selected.id) {
          wrap.classList.add('preview-click-to-call--selected');
          const dragHandle = document.createElement('div');
          dragHandle.className = 'ctc-drag-handle';
          dragHandle.title = 'Drag to reposition';
          dragHandle.textContent = '✥';
          const resizeHandle = document.createElement('div');
          resizeHandle.className = 'ctc-resize-handle';
          resizeHandle.title = 'Drag to resize';
          wrap.appendChild(dragHandle);
          wrap.appendChild(resizeHandle);

          const stageRect = () => els.previewStage.getBoundingClientRect();

          dragHandle.addEventListener('mousedown', (downEvent) => {
            downEvent.preventDefault();
            const rect = stageRect();
            const onMove = (moveEvent) => {
              const newLeft = ((moveEvent.clientX - rect.left) / rect.width) * 100;
              const newTop = ((moveEvent.clientY - rect.top) / rect.height) * 100;
              selected.style.posLeft = Math.max(0, Math.min(100, newLeft));
              selected.style.posTop = Math.max(0, Math.min(100, newTop));
              wrap.style.left = `${selected.style.posLeft}%`;
              wrap.style.top = `${selected.style.posTop}%`;
            };
            const onUp = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
              renderClipEditor(selected.id);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          });

          resizeHandle.addEventListener('mousedown', (downEvent) => {
            downEvent.preventDefault();
            downEvent.stopPropagation();
            const rect = stageRect();
            const onMove = (moveEvent) => {
              const wrapRect = wrap.getBoundingClientRect();
              const newWidthPx = (moveEvent.clientX - wrapRect.left) * 2;
              const newWidthPct = (newWidthPx / rect.width) * 100;
              selected.style.posWidth = Math.max(10, Math.min(90, newWidthPct));
              wrap.style.width = `${selected.style.posWidth}%`;
            };
            const onUp = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
              renderClipEditor(selected.id);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          });
        }
        return;
      }

      els.previewEmpty.style.display = 'flex';
    }

    // Shared with the click-to-call settings panel for live validation
    // feedback. Pattern matches upstream json-button.js's phoneRegex
    // (country-code prefix, optional parenthesized area code, 10-14 digits).
    function isValidCtaLink(value) {
      if (!value) return false;
      try {
        const url = new URL(String(value).trim());
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    }

    function isValidPhoneNumber(value) {
      if (!value) return false;
      return /^(\+[0-9\s]*-?)?(\([0-9\s]*\))?[0-9-.\s]{10,14}$/.test(value.trim());
    }

    // Same localStorage read every other Studio page (AudioStudio,
    // ImageStudio, VideoStudio, ...) uses to get the active contact profile
    // before calling replaceTokensInPrompt — see personalizePopover.js's
    // module comment: "intentionally tiny so they can be inlined without
    // pulling in src/lib/contactStore.js."
    // What a viewer typed into the List Builder / Lead Generator preview: it
    // fills {{tokens}} in the preview until another contact is picked.
    let previewAnswers = null;
    function applyPreviewAnswers(data) {
      previewAnswers = profileWithAnswers(getActivePersonalizationProfile() || { id: 'preview-viewer', variables: {} }, data).variables;
      scheduleEngineUpdate();
      renderOverlayLayer();
    }
    function getActivePersonalizationProfile() {
      try {
        const id = localStorage.getItem('remix_selected_contact_id');
        const found = id ? JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]').find((p) => p.id === id) || null : null;
        if (!previewAnswers) return found;
        return { ...(found || { id: 'preview-viewer' }), variables: { ...(found?.variables || {}), ...previewAnswers } };
      } catch {
        return null;
      }
    }

    // Maps common lead-form field ids to the profile.variables keys set by
    // PersonalizeModal (firstName/lastName/fullName/company/email/...), so
    // a field can be pre-filled without the user having to type a matching
    // {{token}} manually. Mirrors upstream form.js's
    // personalizedTokens[declaration.token] pre-fill, adapted to this
    // fork's camelCase variable names.
    const FIELD_TOKEN_ALIASES = {
      first_name: 'firstName',
      last_name: 'lastName',
      name: 'fullName',
      full_name: 'fullName',
      company: 'company',
      email: 'email',
      industry: 'industry',
    };

    function escapeHtml(str) {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function updatePreview(clip) {
      // Read from the new Timeline model. The `clip` parameter is kept
      // for backward compatibility with legacy callers that pass a
      // pre-shaped preview object; when present, it's used as-is. When
      // absent, we resolve the currently-selected clip from the new
      // model via the bridge, which is the path Phase 2+ will use.
      let selected;
      if (clip) {
        selected = clip;
      } else {
        // Sync the new model from the legacy store before reading.
        // state.tracks is still the source of truth for mutations;
        // the bridge mirrors it on demand.
        state.timeline = syncTimelineFromState(state);
        selected = getPreviewClipFromTimeline(
          state.timeline,
          state.selectedClipId,
          state,
        );
      }
      els.projectTitle.textContent = state.projectTitle;
      renderPreviewAsset(selected);
    }

    function syncMediaPlayState() {
      const media = els.previewStage.querySelector('video, audio');
      if (!media) return;
      if (state.playing) {
        media.play().catch(() => {});
      } else {
        media.pause();
      }
    }

    // Phase 2 — zoom-aware ruler rendering
    function drawRuler() {
      const canvas = els.rulerCanvas;
      const ticks = els.rulerTicks;
      if (!canvas || !ticks) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || canvas.parentElement.clientWidth;
      const h = canvas.clientHeight || 40;
      canvas.width = w * dpr; canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pxPerSec = (state.timelinePxPerSec) || 18;
      const totalSec = w / pxPerSec;
      let major = 10;
      if (pxPerSec > 14) major = 5;
      if (pxPerSec > 28) major = 2;
      if (pxPerSec > 60) major = 1;
      const minor = major / 5;

      ticks.innerHTML = '';
      for (let s = 0; s <= totalSec + 0.001; s += minor) {
        const x = s * pxPerSec;
        const isMajor = Math.abs(s / major - Math.round(s / major)) < 1e-6;
        ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.moveTo(x, isMajor ? 0 : h - 10);
        ctx.lineTo(x, h);
        ctx.stroke();
        if (isMajor) {
          const t = document.createElement('div');
          t.className = 'tick';
          t.style.left = x + 'px';
          const lab = document.createElement('span');
          lab.className = 't-label';
          const mm = String(Math.floor(s / 60)).padStart(2, '0');
          const ss = String(Math.floor(s % 60)).padStart(2, '0');
          lab.textContent = mm + ':' + ss;
          t.appendChild(lab);
          ticks.appendChild(t);
        }
      }
    }

    // Phase 2 — draggable + keyboard-scrubbable playhead
    function wirePlayhead() {
      const line = els.playheadLine;
      const knob = els.playheadKnob;
      const layer = els.timelineBody ? els.timelineBody.querySelector('.playhead-layer') : null;
      if (!line || !knob || !layer) return;
      let dragging = false;
      const TOTAL = state.timelineSeconds || 45;

      function setFromClientX(clientX) {
        const rect = layer.getBoundingClientRect();
        const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        state.playheadPercent = pct;
        updatePlaybackUI();
      }
      knob.addEventListener('pointerdown', function (e) { dragging = true; knob.setPointerCapture(e.pointerId); e.preventDefault(); });
      window.addEventListener('pointermove', function (e) { if (dragging) setFromClientX(e.clientX); });
      window.addEventListener('pointerup', function () { dragging = false; });
      knob.addEventListener('keydown', function (e) {
        const cur = state.playheadPercent || 0;
        // Prototype: arrows scrub in 1-second steps (Shift = 5s)
        const step = ((e.shiftKey ? 5 : 1) / TOTAL) * 100;
        if (e.key === 'ArrowLeft') { state.playheadPercent = Math.max(0, cur - step); updatePlaybackUI(); e.preventDefault(); }
        if (e.key === 'ArrowRight') { state.playheadPercent = Math.min(100, cur + step); updatePlaybackUI(); e.preventDefault(); }
        if (e.key === 'Home') { state.playheadPercent = 0; updatePlaybackUI(); e.preventDefault(); }
        if (e.key === 'End') { state.playheadPercent = 100; updatePlaybackUI(); e.preventDefault(); }
      });
    }

    // Initialise ruler + playhead interactions once the DOM is mounted
    wirePlayhead();
    window.addEventListener('resize', drawRuler);
    // Defer first ruler draw until layout has dimensions
    requestAnimationFrame(drawRuler);

    function updatePlaybackUI() {
      els.progressFill.style.width = `${state.playheadPercent}%`;
      els.playheadLine.style.left = `${state.playheadPercent}%`;
      els.playheadKnob.style.left = `calc(${state.playheadPercent}% - 7px)`;
      els.currentTime.textContent = formatTimeFromPercent(state.playheadPercent, state.timelineSeconds);
      els.totalTime.textContent = formatTimeFromPercent(100, state.timelineSeconds);
      els.playBtn.textContent = state.playing ? '⏸' : '▶';
      const tbPlayBtn = root.querySelector('#tbPlay');
      if (tbPlayBtn) tbPlayBtn.textContent = state.playing ? '⏸' : '▶';
      // Prototype parity: knob ARIA + screen-reader announcements + toolbar readout
      const sec = (state.playheadPercent / 100) * (state.timelineSeconds || 45);
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = (sec % 60).toFixed(1).padStart(4, '0');
      els.playheadKnob.setAttribute('aria-valuenow', sec.toFixed(1));
      els.playheadKnob.setAttribute('aria-valuetext', mm + ':' + ss);
      const sr = root.querySelector('#srStatus');
      if (sr) sr.textContent = 'Playhead at ' + mm + ':' + ss;
      const tbNow = root.querySelector('.time-readout .time-now');
      if (tbNow) tbNow.textContent = mm + ':' + ss;
      syncMediaPlayState();
      // Scrubbing / stepping while paused moves the Player too.
      if (remotionEngine && !state.playing) remotionEngine.seekToFrame(percentToFrame(state.playheadPercent));
      if (!state.playing) codePreview?.frame(percentToFrame(state.playheadPercent));
      renderOverlayLayer();
      if (!state.playing) activeKeyframesPanel?.refresh();
    }

    // Top action bar functionality
    function togglePreviewVisibility() {
      const previewCard = els.previewStage.closest('.preview-card');
      if (previewCard) {
        previewCard.style.display = previewCard.style.display === 'none' ? 'block' : 'none';
      }
    }

    function openMonitorSettings() {
      // Could open a modal with monitor/display settings
    }

    function openMediaLibrary() {
      // Focus on media grid section
      const mediaGrid = els.mediaGrid;
      if (mediaGrid) {
        mediaGrid.scrollIntoView({ behavior: 'smooth' });
      }
    }

    function toggleQuickAIActions() {
      // Toggle visibility of quick commands
      const quickCommands = els.quickCommands;
      if (quickCommands) {
        quickCommands.style.display = quickCommands.style.display === 'none' ? 'flex' : 'none';
      }
    }

    function openMusicTools() {
      // Focus on audio track or open music tools
      const audioTrack = state.tracks.find(t => t.name === 'Audio');
      if (audioTrack) {
      } else {
      }
    }

    function openAudioControls() {
      // Open audio mixer or controls
    }

    function openVideoTools() {
      // Open video editing tools
    }

    function openProfileTools() {
      // Open user profile or project settings
    }

    function openEditorSettings() {
      // Open editor preferences/settings
    }

    function focusChatInput() {
      // Focus the chat input field
      if (els.chatInput) {
        els.chatInput.focus();
      }
    }

    function openProjectNotes() {
      // Open project notes or clipboard
    }

    // Modal functions for timeline-specific triggers
    function openEndScreenModal(state, showToast) {
      try {
        const modal = new EndScreenModal({
          timelineData: state,
          onComplete: (result) => {
            // Add end screen elements to timeline
            addEndScreenToTimeline(result, state);
          },
          onError: (error) => console.log(`End screen creation failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('End screen creation failed:', error);
        showToast(`End screen creation failed: ${error.message || error}`, 'error');
      }
    }

    function openSaveProjectModal(state, showToast) {
      try {
        const modal = new SaveProjectModal({
          projectData: state,
          onComplete: (result) => {
            state.projectId = result.projectId;
          },
          onError: (error) => console.log(`Project save failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Project save failed:', error);
        showToast(`Project save failed: ${error.message || error}`, 'error');
      }
    }

    function openSettingsModal(state, showToast) {
      try {
        const modal = new SettingsModal({
          settings: state.settings || {},
          onComplete: (result) => {
            state.settings = result;
          },
          onError: (error) => console.log(`Settings update failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Settings update failed:', error);
        showToast(`Settings update failed: ${error.message || error}`, 'error');
      }
    }

    function openConnectModal(state, showToast) {
      try {
        const modal = new ConnectModal({
          onComplete: (result) => {
            state.connections = result.connections;
          },
          onError: (error) => console.log(`Connection setup failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Connection setup failed:', error);
        showToast(`Connection setup failed: ${error.message || error}`, 'error');
      }
    }

    function openPreviewMediaModal(state, showToast) {
      try {
        const modal = new PreviewMediaModal({
          mediaData: state.tracks.flatMap(t => t.clips),
          onComplete: (result) => {
          },
          onError: (error) => console.log(`Media preview failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Media preview failed:', error);
        showToast(`Media preview failed: ${error.message || error}`, 'error');
      }
    }

    function openVideoPlayerModal(state, showToast) {
      try {
        // VideoPlayerModal reads options.url/options.title — it previously
        // got timelineData instead, so it always rendered "No video URL
        // provided" no matter what was selected.
        const selected = findSelectedClip();
        if (!selected || (selected.type !== 'video' && selected.type !== 'audio') || !selected.src) {
          showToast('Select a video or audio clip first', 'info');
          return;
        }
        const modal = new VideoPlayerModal({
          url: selected.src,
          title: selected.name || 'Video Player',
          onComplete: (result) => {
          },
          onError: (error) => console.log(`Video player error: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Video player error:', error);
        showToast(`Video player error: ${error.message || error}`, 'error');
      }
    }

    function addEndScreenToTimeline(endScreenData, state) {
      // Classic End Screen modal result: its elements go on the Titles
      // track, timed to finish at the end of the video.
      const T = state.timelineSeconds || 60;
      (endScreenData?.buttons || []).forEach((button, i) => {
        const dur = Math.min(T, Math.max(1, Number(button.duration) || 5));
        insertClipIntoTrack({
          ...button,
          id: Date.now() + i,
          name: button.text || 'End Screen Element',
          type: button.type || 'text',
          start: T - dur,
          end: T,
        }, 'text');
      });
      debouncedSave();
    }

    // End Screens / Connect Form libraries (upstream toolbar windows):
    // pick a template, preview it live, insert it as editable clips.
    function openTemplateLibrary(library) {
      openTemplateWindow({
        library,
        buildModel: (project) => timelineToComposition(project, { fps: ENGINE_FPS, quality: '720p', profile: getActivePersonalizationProfile() }),
        onUse: (tpl, lib) => insertTemplate(tpl, lib),
      });
    }

    function insertTemplate(tpl, lib) {
      const T = state.timelineSeconds || 60;
      const startSec = templateStart(tpl, lib.anchor, { playheadSec: (state.playheadPercent / 100) * T, timelineSeconds: T });
      const trackName = lib.anchor === 'end' ? 'End Screen' : 'Connect';
      if (!state.tracks.some((t) => t.name === trackName)) {
        state.tracks.push({ id: `track-${lib.id}-${Date.now().toString(36)}`, type: 'text', name: trackName, muted: false, solo: false, locked: false, items: [] });
      }
      saveStateSnapshot(state);
      const clips = presetToClips(templateToPreset(tpl), startSec, T);
      clips.forEach(({ trackName: _ignored, ...clip }) => insertClipIntoTrack(clip, trackName));
      scheduleEngineUpdate();
      debouncedSave();
      showToast(`Added "${tpl.name}" — click any part to edit it`, 'success');
      return clips;
    }
    TLEditor.openTemplateLibrary = openTemplateLibrary;
    TLEditor.openSmartSpeech = () => openSmartSpeech();
    TLEditor.insertTemplate = (id, library = 'endScreens') => {
      const lib = TEMPLATE_LIBRARIES[library];
      const tpl = lib?.templates.find((t) => t.id === id);
      return tpl ? insertTemplate(tpl, lib) : null;
    };
    TLEditor.openClassicEndScreen = () => openEndScreenModal(state, showToast);

    // Header top actions: the template IS the single source of truth
    // (prototype markup: ↶ ↷ ▦[active] ⚙ 🔗 🤖 💾 + Render Ready pill).
    // This binder only attaches listeners — it never rewrites the DOM,
    // so the header can never drift from the prototype skeleton.
    function bindTopActions() {
      if (!els.topActions) return;
      const byLabel = (label) => els.topActions.querySelector(`.top-icon[aria-label="${label}"]`);
      const undoBtn = byLabel('Undo');
      const redoBtn = byLabel('Redo');
      if (undoBtn) undoBtn.addEventListener('click', () => { if (undo(state)) renderAll(); });
      if (redoBtn) redoBtn.addEventListener('click', () => { if (redo(state)) renderAll(); });
      // ▦ Timeline view is the default active view — no action needed
      const settingsBtn = root.querySelector('#openSettings');
      const connectBtn = root.querySelector('#openConnect');
      const saveBtn = root.querySelector('#openSave');
      if (settingsBtn) settingsBtn.addEventListener('click', () => openEditorSettings());
      if (connectBtn) connectBtn.addEventListener('click', () => openConnectModal(state, showToast));
      if (saveBtn) saveBtn.addEventListener('click', () => openSaveProjectModal(state, showToast));
    }

    const TOOL_DEFS = [
      { id: 'select', icon: '🔍', label: 'Select', hint: 'V' },
      { id: 'blade', icon: '✂️', label: 'Blade', hint: 'B' },
      { id: 'ripple', icon: '↗️', label: 'Ripple', hint: 'R' },
      { id: 'roll', icon: '↔️', label: 'Roll', hint: 'N' },
      { id: 'slip', icon: '↕️', label: 'Slip', hint: 'Y' },
      { id: 'slide', icon: '↔️', label: 'Slide', hint: 'U' },
      { id: 'music', icon: '🎵', label: 'Music', hint: 'M' },
      { id: 'fillGap', icon: '✨', label: 'Fill Gap', hint: '' },
      { id: 'extend', icon: '➡️', label: 'Extend', hint: 'E' },
      { id: 'mask', icon: '🎭', label: 'Mask', hint: 'X' },
    ];

    const toolMap = {
      'v': 'select',
      'b': 'blade',
      'r': 'ripple',
      'n': 'roll',
      'y': 'slip',
      'u': 'slide',
      'm': 'music',
      'e': 'extend',
      'x': 'mask',
    };

    function selectTool(id) {
      const def = TOOL_DEFS.find(t => t.id === id);
      state.selectedTool = def ? def.label : id;
      renderTools();
      updatePreview();
      if (id === 'mask') {
        showToast('Mask tool active — select a clip and open AI Tools to segment');
      }
    }

    /**
     * Canonical tool token for the current selection.
     *
     * `state.selectedTool` is written from two places: `selectTool()` stores the
     * tool's DISPLAY LABEL (what the toolbar highlight and the mask overlay
     * compare against), while the keyboard shortcut stores the lowercase tool
     * ID from `toolMap`. Both spell the same tool, so resolve either one back
     * to the canonical label before comparing.
     */
    function selectedToolLabel() {
      const selected = state.selectedTool;
      if (!selected) return null;
      const def = TOOL_DEFS.find(t => t.id === selected || t.label === selected);
      return def ? def.label : selected;
    }

    function renderTools() {
      els.toolGroup.innerHTML = '';
      const toolTooltips = {
        Select: 'Select tool - Click to select and inspect clips on the timeline (V)',
        Blade: 'Blade tool - Cut clips at the playhead position (B)',
        Ripple: 'Ripple tool - Trim clips and automatically close gaps (R)',
        Roll: 'Roll tool - Adjust the edit point between two adjacent clips',
        Slip: 'Slip tool - Change clip contents without moving its position',
        Slide: 'Slide tool - Move a clip while adjusting nearby clips to compensate',
        Zoom: 'Zoom tool - Click to zoom in, Alt+click to zoom out (Z)',
        Hand: 'Hand tool - Click and drag to pan across the timeline (H)'
      };
      const tools = TOOL_DEFS;
      const activeTool = selectedToolLabel();
      tools.forEach((def) => {
        const button = document.createElement('button');
        button.className = `tool-btn ${activeTool === def.label ? 'active' : ''}`;
        button.textContent = def.icon;
        button.setAttribute('data-tooltip', def.hint ? `${def.label} (${def.hint})` : def.label);
        button.title = def.label;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', () => selectTool(def.id));
        els.toolGroup.appendChild(button);
      });
    }

    function renderPills() {
      els.pillRow.innerHTML = '';
      const pillTooltips = {
        'Text to Video': 'Generate video from text descriptions using AI',
        'Image to Video': 'Animate still images into video clips',
        'Retake': 'Regenerate with different parameters',
        'Extend': 'Extend clip duration by generating additional footage',
        'B-Roll': 'Add supplementary footage and cutaway shots',
        'Music Gen': 'Generate background music from video context',
        'Audio Sync': 'Automatically sync audio with video timing',
        'Fill Gap AI': 'AI generates footage to bridge gaps between clips',
        'Elements': 'Browse reusable media elements library',
        'Import Timeline': 'Import an existing timeline from JSON or EDL',
        'IC-LoRA': 'Apply character consistency across clips'
      };
      state.pills.forEach((pill) => {
        const span = document.createElement('span');
        span.className = 'pill';
        span.textContent = pill;
        span.setAttribute('data-tooltip', pillTooltips[pill] || `${pill} quick mode`);
        span.title = pillTooltips[pill] || `${pill} quick mode`;
        span.setAttribute('aria-label', span.title);
        span.addEventListener('click', () => handlePillClick(pill));
        els.pillRow.appendChild(span);
      });
    }

    function handlePillClick(pill) {
      if (pill === 'Retake') {
        const selectedClip = state.tracks.flatMap(t => t.clips).find(c => c.selected);
        if (selectedClip) {
          showRetakePanel(selectedClip);
        }
      } else if (pill === 'Import Timeline') {
        showImportTimelineModal();
      } else if (pill === 'IC-LoRA') {
        showICLoraPanel();
      } else if (pill === 'Audio Sync') {
        syncSelectedAudio();
      } else if (pill === 'Fill Gap AI') {
        openAiTools('fill_gap');
      } else if (pill === 'Extend') {
        openAiTools('extend');
      } else if (pill === 'Music Gen') {
        openAgentWithPrompt('Add background music that fits the mood of this video, at a low volume under any voiceover.');
      } else if (pill === 'Elements') {
        openAiTools('element_create');
      }
    }

    async function syncSelectedAudio() {
      const selectedClip = findSelectedClip();
      if (!selectedClip || selectedClip.type !== 'video') {
        showToast('Select a video clip to sync audio', 'info');
        return;
      }
      const audioClip = state.tracks.find(t => t.type === 'audio')?.clips?.find(c => c.type === 'audio');
      if (!audioClip) {
        showToast('No audio clip found on audio track', 'info');
        return;
      }
      try {
        const { computeAudioOffset } = await import('../lib/editor/audioSync.js');
        showToast('Analyzing audio sync...', 'info');
        const result = await computeAudioOffset(selectedClip.src, audioClip.src);
        if (result && result.confidence > 0) {
          showToast(`Audio sync offset: ${result.offsetSeconds.toFixed(2)}s (confidence: ${Math.round(result.confidence * 100)}%)`, 'success');
          audioClip.start = (selectedClip.start || 0) + result.offsetSeconds;
          renderAll();
          debouncedSave(0);
        } else {
          showToast('Could not determine audio sync offset', 'error');
        }
      } catch (err) {
        showToast(`Audio sync failed: ${err.message}`, 'error');
      }
    }

    function renderTracksBasic(state, els, showToast) {
      els.trackRows.innerHTML = '';
      state.tracks.forEach(track => {
        const row = document.createElement('div');
        row.className = 'track-row';

        const meta = document.createElement('div');
        meta.className = 'track-meta';
        const dotClass = track.type === 'audio' ? 'audio' : track.type === 'text' ? 'text' : (track.type === 'effects' || track.type === 'fx') ? 'fx' : 'video';
        meta.innerHTML = `
          <div class="track-head-top"><span class="track-type-dot ${dotClass}"></span><span class="track-name">${track.name}</span></div>
          <div class="track-actions">
            <button class="track-toggle ${track.muted ? 'locked' : ''}" data-toggle="mute" data-tooltip="${track.muted ? 'Unmute track' : 'Mute track'} - ${track.muted ? 'Track is currently muted' : 'Silence this track'}" aria-label="${track.muted ? 'Unmute' : 'Mute'} track">M</button>
            <button class="track-toggle ${track.solo ? 'locked' : ''}" data-toggle="solo" data-tooltip="${track.solo ? 'Unsolo track' : 'Solo track'} - ${track.solo ? 'Only this track plays' : 'Play only this track'}" aria-label="${track.solo ? 'Unsolo' : 'Solo'} track">S</button>
            <button class="track-toggle ${track.locked ? 'locked' : ''}" data-toggle="lock" data-tooltip="${track.locked ? 'Unlock track' : 'Lock track'} - ${track.locked ? 'Track is protected from edits' : 'Prevent accidental changes'}" aria-label="${track.locked ? 'Unlock' : 'Lock'} track">L</button>
          </div>
          <div class="track-count">${track.clips.length} clips</div>
        `;

        meta.querySelectorAll('.track-toggle').forEach(btn => {
          btn.addEventListener('click', () => {
            const key = btn.dataset.toggle;
            if (key === 'mute') track.muted = !track.muted;
            if (key === 'solo') track.solo = !track.solo;
            if (key === 'lock') track.locked = !track.locked;
            renderTracksBasic(state, els, showToast);
          });
        });

        const lane = document.createElement('div');
        lane.className = 'track-lane';
        lane.dataset.trackId = track.id;

        track.clips.forEach(clip => {
          const clipEl = document.createElement('button');
          clipEl.type = 'button';
          clipEl.className = `clip ${state.selectedClipId === clip.id ? 'active' : ''}`;
          clipEl.setAttribute('aria-label', `${clip.text || clip.name} — ${clip.type || 'clip'} clip on the ${track.name} track. Press Enter to select.`);
          const leftPercent = (clip.start / state.timelineSeconds) * 100;
          const widthPercent = ((clip.end - clip.start) / state.timelineSeconds) * 100;
          clipEl.style.left = `${leftPercent}%`;
          clipEl.style.width = `${widthPercent}%`;
          clipEl.innerHTML = `
            <span class="clip-label">${clip.text || clip.name}</span>
            <div class="clip-handle l" data-handle="left"></div>
            <div class="clip-handle r" data-handle="right"></div>
            ${clip.metadata?.cinegenProcessed ? '<div class="cinegen-indicator" title="Processed with CineGen"></div>' : ''}
          `;

          // Visual keyframe markers with edit/delete
          if (state.keyframeSystem && state.keyframeSystem.getKeyframes) {
            const kfs = state.keyframeSystem.getKeyframes(clip.id) || [];
            kfs.forEach((kf, idx) => {
              const kfEl = document.createElement('div');
              kfEl.className = 'keyframe-marker';
              const kfLeft = ((kf.time - (clip.start || 0)) / (clip.duration || 5)) * 100;
              kfEl.style.left = `${Math.max(2, Math.min(98, kfLeft))}%`;
              kfEl.title = `${kf.property}: ${kf.value} (click to edit)`;

              kfEl.onclick = (e) => {
                e.stopPropagation();
                const newValue = prompt(`Edit ${kf.property}`, kf.value);
                if (newValue !== null) {
                  state.keyframeSystem.updateKeyframe(clip.id, idx, { value: parseFloat(newValue) });
                  renderTracks();
                }
              };

              kfEl.oncontextmenu = (e) => {
                e.preventDefault();
                if (confirm('Delete this keyframe?')) {
                  state.keyframeSystem.removeKeyframe(clip.id, idx);
                  renderTracks();
                }
              };

              // Drag to change keyframe time
              kfEl.onmousedown = (e) => {
                e.stopPropagation();
                const startX = e.clientX;
                const startLeft = parseFloat(kfEl.style.left);
                const clipRect = clipEl.getBoundingClientRect();

                const onMove = (moveEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const newLeft = Math.max(0, Math.min(100, startLeft + (deltaX / clipRect.width) * 100));
                  kfEl.style.left = `${newLeft}%`;

                  // Update keyframe time
                  const newTime = (clip.start || 0) + (newLeft / 100) * (clip.duration || 5);
                  if (state.keyframeSystem.updateKeyframe) {
                    state.keyframeSystem.updateKeyframe(clip.id, idx, { time: newTime });
                  }
                };

                const onUp = () => {
                  cleanup.removeDocumentListener('mousemove', onMove);
                  cleanup.removeDocumentListener('mouseup', onUp);
                  renderTracks();
                };

                cleanup.addDocumentListener('mousemove', onMove);
                cleanup.addDocumentListener('mouseup', onUp);
              };

              clipEl.appendChild(kfEl);
            });
          }
          renderKeyframeDiamonds(clipEl, clip, (leftPercent / 100) * (state.timelineSeconds || 60), (widthPercent / 100) * (state.timelineSeconds || 60));
          clipEl.addEventListener('click', (event) => {
            if (event.target.classList.contains('clip-handle')) return;
            event.stopPropagation();
            window.timelineState.selectedClipId = clip.id;
            renderTracksBasic(state, els, showToast);
            updatePreview({ id: clip.id, name: clip.name, type: clip.type, src: clip.src });
            // Update camera effects with selected clip
            if (cameraEffects) {
              cameraEffects.setSelectedClip(clip.id);
            }
          });

          // Basic trim handle logic
          clipEl.querySelectorAll('.clip-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              const isLeft = handle.dataset.handle === 'left';
              const startX = e.clientX;
              const originalStart = clip.start;
              const originalEnd = clip.end;

              const onMove = (moveEvent) => {
                const delta = ((moveEvent.clientX - startX) / lane.getBoundingClientRect().width) * (state.timelineSeconds || 60);
                if (isLeft) {
                  clip.start = Math.max(0, Math.min(originalStart + delta, originalEnd - 0.1));
                } else {
                  clip.end = Math.max(originalStart + 0.1, originalEnd + delta);
                }
                renderTracksBasic(state, els, showToast);
              };

              const onUp = () => {
                cleanup.removeDocumentListener('mousemove', onMove);
                cleanup.removeDocumentListener('mouseup', onUp);
                saveStateSnapshot(state);
              };

              cleanup.addDocumentListener('mousemove', onMove);
              cleanup.addDocumentListener('mouseup', onUp);
            });
          });
           lane.appendChild(clipEl);
         });

         // Render transitions between clips that have transition data
         const sortedItems = [...(track.items || [])].sort((a, b) => (a.start || 0) - (b.start || 0));
         for (let i = 0; i < sortedItems.length - 1; i++) {
           const current = sortedItems[i];
           const next = sortedItems[i + 1];
           if (current.transition && current.transition.type) {
             const transEl = document.createElement('div');
             transEl.className = 'timeline-transition';
             const transLeft = ((current.end || current.start + (current.duration || 5)) / (state.timelineSeconds || 60)) * 100;
             const transWidth = ((current.transition.duration || 0.5) / (state.timelineSeconds || 60)) * 100;
             transEl.style.left = `${transLeft}%`;
             transEl.style.width = `${Math.max(transWidth, 1.5)}%`;
             transEl.innerHTML = `
               <div class="transition-visual">
                 <div class="transition-icon">⟷</div>
                 <div class="transition-name">${current.transition.type}</div>
               </div>
             `;
             transEl.onclick = () => {
               window.timelineState.selectedClipId = current.id;
               if (transitionEditor) transitionEditor.show(current.transition);
             };
             lane.appendChild(transEl);
           }
         }

         row.appendChild(meta);
         row.appendChild(lane);
         els.trackRows.appendChild(row);
       });
     }

    // Incremental track/clip renderer. Maintains a DOM cache keyed by track and
    // clip IDs so that only changed or new elements are rebuilt. Falls back to a
    // full rebuild when the track list shape changes (add/remove track).
    const trackDomCache = new Map(); // trackId -> { row, meta, lane, clipEls: Map<clipId, el> }
    // Decorative audio waveform bars (prototype fillWave)
    function fillClipWave(el) {
      if (!el) return;
      let html = '';
      for (let i = 0; i < 60; i++) {
        const hgt = 30 + Math.round(Math.abs(Math.sin(i * 0.5) * 50) + Math.random() * 20);
        html += '<span style="height:' + hgt + '%"></span>';
      }
      el.innerHTML = html;
    }

    /** Keyframes stored on the clip (Remotion engine): diamonds, click to jump. */
    function renderKeyframeDiamonds(clipEl, clip, startSec, durSec) {
      clipEl.querySelectorAll('.kf-diamond').forEach((d) => d.remove());
      if (!clip.keyframes || typeof clip.keyframes !== 'object' || !(durSec > 0)) return;
      const times = new Set();
      Object.values(clip.keyframes).forEach((l) => (Array.isArray(l) ? l : []).forEach((k) => times.add(Number(k.t))));
      [...times].filter(Number.isFinite).forEach((t) => {
        const d = document.createElement('span');
        d.className = 'keyframe-marker kf-diamond';
        d.style.left = `${Math.max(0, Math.min(100, (t / durSec) * 100))}%`;
        d.title = `Keyframe at ${t.toFixed(2)}s — click to jump`;
        d.addEventListener('click', (e) => {
          e.stopPropagation();
          state.playheadPercent = Math.max(0, Math.min(100, ((startSec + t) / (state.timelineSeconds || 60)) * 100));
          updatePlaybackUI();
        });
        clipEl.appendChild(d);
      });
    }

    function renderTracksIncremental(viewState, els, showToast) {
      const seenTrackIds = new Set();
      const trackRows = els.trackRows;

      viewState.tracks.forEach((track, trackIndex) => {
        seenTrackIds.add(track.id);
        let cached = trackDomCache.get(track.id);

        if (!cached) {
          // Build a new track row
          const row = document.createElement('div');
          row.className = 'track-row';
          row.dataset.trackId = track.id;

          const meta = document.createElement('div');
          meta.className = 'track-meta';
          const dotClass = track.type === 'audio' ? 'audio' : track.type === 'text' ? 'text' : (track.type === 'effects' || track.type === 'fx') ? 'fx' : 'video';
          // Prototype count semantics: clips + transitions, singular "clip"
          const seedCount = track.clips.length + (track.transitions || []).length;
          const seedCountText = seedCount === 1 ? '1 clip' : `${seedCount} clips`;
          // Prototype toggle semantics: 🔊 .on = sound on, S .on = solo active,
          // 🔓/🔒 .locked = track locked
          meta.innerHTML = `
            <div class="track-head-top"><span class="track-type-dot ${dotClass}"></span><span class="track-name">${track.name}</span></div>
            <div class="track-actions">
              <button class="track-toggle ${track.muted ? '' : 'on'}" data-toggle="mute" aria-label="${track.muted ? 'Unmute' : 'Mute'} ${track.name}" aria-pressed="${!track.muted}" title="${track.muted ? 'Unmute' : 'Mute'}">${track.muted ? '🔇' : '🔊'}</button>
              <button class="track-toggle ${track.solo ? 'on' : ''}" data-toggle="solo" aria-label="Solo ${track.name}" aria-pressed="${!!track.solo}" title="Solo">S</button>
              <button class="track-toggle ${track.locked ? 'locked' : ''}" data-toggle="lock" aria-label="${track.locked ? 'Unlock' : 'Lock'} ${track.name}" aria-pressed="${!!track.locked}" title="${track.locked ? 'Unlock' : 'Lock'}">${track.locked ? '🔒' : '🔓'}</button>
            </div>
            <span class="track-count">${seedCountText}</span>
          `;

          meta.querySelectorAll('.track-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
              const key = btn.dataset.toggle;
              // Mutate the REAL state track (viewState tracks are copies),
              // then force a meta rebuild through the full pipeline.
              const real = (state.tracks || []).find(t => t.id === track.id);
              if (real) {
                if (key === 'mute') real.muted = !real.muted;
                if (key === 'solo') real.solo = !real.solo;
                if (key === 'lock') real.locked = !real.locked;
              }
              // Remove the stale row before invalidating, or the incremental
              // renderer appends a duplicate and queries hit the old row.
              const stale = trackDomCache.get(track.id);
              if (stale) stale.row.remove();
              trackDomCache.delete(track.id);
              renderTracks();
            });
          });

          const lane = document.createElement('div');
          lane.className = 'track-lane';
          lane.dataset.trackId = track.id;

          row.appendChild(meta);
          row.appendChild(lane);
          trackRows.appendChild(row);

          cached = { row, meta, lane, clipEls: new Map(), clipData: new Map() };
          trackDomCache.set(track.id, cached);
        }

        // Update track meta text in-place if it changed
        const liveCount = track.clips.length + (track.transitions || []).length;
        const liveCountText = liveCount === 1 ? '1 clip' : `${liveCount} clips`;
        const countEl = cached.meta.querySelector('.track-count');
        if (countEl && countEl.textContent !== liveCountText) {
          countEl.textContent = liveCountText;
        }
        const nameEl = cached.meta.querySelector('.track-name');
        if (nameEl && nameEl.textContent !== track.name) {
          nameEl.textContent = track.name;
        }

        // Diff clips
        const seenClipIds = new Set();
        (track.clips || []).forEach((clip) => {
          seenClipIds.add(clip.id);
          let clipEl = cached.clipEls.get(clip.id);
          const prevData = cached.clipData.get(clip.id);
          const leftPercent = (clip.start / viewState.timelineSeconds) * 100;
          const widthPercent = ((clip.end - clip.start) / viewState.timelineSeconds) * 100;

          const trackType = track.type || clip.type || 'video';
          const label = clip.text || clip.name;

          if (!clipEl) {
            clipEl = document.createElement('button');
            clipEl.type = 'button';
            clipEl.tabIndex = 0;
            // HTML5 native drag-and-drop so clips can be moved between tracks /
            // positions on the timeline. The lane drop zone (see renderTracks,
            // ~line 2032) handles the data.type === 'clip' branch and re-renders.
            // (The older mousedown-based clip drag in dragDrop.js is dead — its
            // initializeClipDragDrop has no callers — so this is the only
            // clip-drag path.)
            clipEl.draggable = true;
            clipEl.dataset.itemId = clip.id;
            clipEl.dataset.trackId = track.id;
            cached.lane.appendChild(clipEl);
            cached.clipEls.set(clip.id, clipEl);

            clipEl.addEventListener('click', (event) => {
              if (event.target.classList.contains('clip-handle')) return;
              event.stopPropagation();
              state.selectedClipId = clip.id;
              // Resolve the real clip object rather than passing this
              // stripped view-model copy straight through: renderPreviewAsset
              // binds its submit/click handlers to whatever object it's
              // given, and mutations those handlers make (e.g. lead-form's
              // _submittedLeads) must land on the same object the settings
              // panel reads from, or they're silently lost on the next
              // render's fresh copy.
              const realClip = state.tracks.flatMap((t) => t.items || t.clips || []).find((c) => c.id === clip.id) || clip;
              updatePreview(realClip);
              // Full pipeline rebuild: re-rendering with the viewState closure
              // would keep the stale selectedClipId and .active would never move.
              renderTracks();
              showClipEditor(clip.id);
            });

            clipEl.addEventListener('dragstart', (e) => {
              // Trim handles initiate a separate drag for trimming — never
              // start a move-drag from one. data-handle is set on .l/.r in
              // the structure template below.
              if (e.target.dataset && e.target.dataset.handle) return;
              const payload = { type: 'clip', clipId: clip.id };
              try {
                e.dataTransfer.setData('application/json', JSON.stringify(payload));
                e.dataTransfer.effectAllowed = 'move';
                // Suppress the default translucent-clone drag image; the
                // drop-highlight on the lane is enough visual feedback.
                const ghost = document.createElement('div');
                ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 0, 0);
                requestAnimationFrame(() => ghost.remove());
              } catch (err) {
                console.warn('[Timeline] clip dragstart failed', err);
              }
            });
          }

          clipEl.style.left = `${leftPercent}%`;
          clipEl.style.width = `${widthPercent}%`;
          clipEl.className = `clip ${viewState.selectedClipId === clip.id ? 'active' : ''}`;

          // Prototype clip internals: thumb+grad (video/fx), wave (audio),
          // icon label, duration chip, l/r handles (not on text clips)
          const needsStructure = !prevData || prevData.label !== label || prevData.type !== trackType;
          if (needsStructure) {
            const isAudio = trackType === 'audio';
            const isText = trackType === 'text' || isAddonType(clip.type);
            const isFx = trackType === 'effects' || trackType === 'fx';
            const icon = isAddonType(clip.type) ? getAddon(clip.type).icon
              : isAudio ? '🎙️' : (trackType === 'text') ? '🅣' : isFx ? '✨' : '🎥';
            const durSec = Math.max(0, (clip.end || 0) - (clip.start || 0)).toFixed(1);
            clipEl.setAttribute('aria-label', `Clip: ${label}, ${durSec}s`);
            clipEl.innerHTML = `
              ${isAudio ? '<div class="clip-wave"></div>' : ''}
              ${!isAudio && !isText ? '<div class="clip-thumb"><div class="grad"></div></div>' : ''}
              <span class="clip-label"><span class="ic">${icon}</span>${label}</span>
              <span class="clip-dur">${durSec}s</span>
              ${!isText ? '<span class="clip-handle l" data-handle="left"></span><span class="clip-handle r" data-handle="right"></span>' : ''}
            `;
            if (isAudio) fillClipWave(clipEl.querySelector('.clip-wave'));
          }

          renderKeyframeDiamonds(clipEl, clip, clip.start || 0, Math.max(0, (clip.end || 0) - (clip.start || 0)));

          cached.clipData.set(clip.id, {
            leftPercent, widthPercent,
            selectedClipId: viewState.selectedClipId,
            label,
            type: trackType
          });
        });

        // Remove clips that no longer exist
        cached.clipEls.forEach((el, clipId) => {
          if (!seenClipIds.has(clipId)) {
            el.remove();
            cached.clipEls.delete(clipId);
            cached.clipData.delete(clipId);
          }
        });

        // Prototype ornaments: transitions + scene markers (cheap rebuild per pass)
        cached.lane.querySelectorAll('.timeline-transition, .scene-marker').forEach(el => el.remove());
        (track.transitions || []).forEach(tr => {
          const el = document.createElement('div');
          el.className = 'timeline-transition';
          el.style.left = `${tr.left}%`;
          el.style.width = `${tr.width}%`;
          el.tabIndex = 0;
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', `${tr.name || 'Crossfade'} transition, ${tr.duration}s`);
          el.innerHTML = `<span class="ti">⮂</span><span class="tn">${tr.duration}s</span>`;
          cached.lane.appendChild(el);
        });
        (track.markers || []).forEach(mLeft => {
          const el = document.createElement('div');
          el.className = 'scene-marker';
          el.style.left = `${mLeft}%`;
          el.title = 'Scene marker';
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', `Scene marker at ${((mLeft / 100) * viewState.timelineSeconds).toFixed(1)}s`);
          cached.lane.appendChild(el);
        });
      });

      // Remove tracks that no longer exist
      trackDomCache.forEach((cached, trackId) => {
        if (!seenTrackIds.has(trackId)) {
          cached.row.remove();
          trackDomCache.delete(trackId);
        }
      });
    }

    // Invalidate the incremental cache (call before a full rebuild)
    function invalidateTrackCache() {
      trackDomCache.clear();
    }

     function renderTracks() {
      function createBasicClipElement(clip, trackMeta, options) {
        const clipEl = document.createElement('button');
        clipEl.className = `clip ${options.selectedClipId === clip.id ? 'active' : ''}`;
        const leftPercent = (clip.start / (options.timelineSeconds || 60)) * 100;
        const widthPercent = ((clip.end - clip.start) / (options.timelineSeconds || 60)) * 100;
        clipEl.style.left = `${leftPercent}%`;
        clipEl.style.width = `${widthPercent}%`;
        clipEl.innerHTML = `
          <span class="clip-label">${clip.text || clip.name}</span>
          <div class="clip-handle l" data-handle="left"></div>
          <div class="clip-handle r" data-handle="right"></div>
        `;
        return clipEl;
      }

      // Convert tracks to enhanced format
      const enhancedState = {
        tracks: (state.tracks || []).map(track => ({
          id: track.id,
          name: track.name,
          type: track.type,
          locked: track.locked,
          muted: track.muted,
          solo: track.solo,
          opacity: track.opacity || 1,
          blendMode: track.blendMode || 'normal',
          transitions: track.transitions || [],
          markers: track.markers || [],
          items: (track.items || []).map(clip => ({
            id: clip.id,
            name: clip.name,
            text: clip.heading || clip.name,
            start: (clip.left / 100) * state.timelineSeconds,
            end: ((clip.left + clip.width) / 100) * state.timelineSeconds,
            type: clip.type,
            src: clip.src,
            fit: clip.fit,
            heading: clip.heading,
            body: clip.body,
            waveformData: clip.waveformData,
            opacity: clip.opacity || 1,
            blendMode: clip.blendMode || 'normal'
          })),
          clips: (track.items || track.clips || []).map(clip => ({
            id: clip.id,
            name: clip.name,
            text: clip.heading || clip.name || '',
            start: clip.start || (clip.left / 100) * state.timelineSeconds,
            end: clip.end || ((clip.left + (clip.width || 0)) / 100) * state.timelineSeconds,
            type: clip.type,
            src: clip.src,
            metadata: clip.metadata || {},
            // Type-specific fields the preview/settings panels need for
            // 'lead-form' and 'click-to-call' clips. These clips are
            // reselected through this stripped-down view model (see the
            // click handler in renderTracksIncremental), so any field
            // renderPreviewAsset/renderClipEditor reads for these types
            // must be forwarded here or it silently reverts to defaults
            // on every re-selection.
            heading: clip.heading,
            fields: clip.fields,
            ctaText: clip.ctaText,
            privacyText: clip.privacyText,
            privacyPolicyCaption: clip.privacyPolicyCaption,
            privacyPolicyLink: clip.privacyPolicyLink,
            skipButtonEnabled: clip.skipButtonEnabled,
            brandLogoUrl: clip.brandLogoUrl,
            webhookEnabled: clip.webhookEnabled,
            webhookUrl: clip.webhookUrl,
            webhookUrl2: clip.webhookUrl2,
            webhookUrl3: clip.webhookUrl3,
            emailNotificationEnabled: clip.emailNotificationEnabled,
            notificationEmail: clip.notificationEmail,
            fbPixelId: clip.fbPixelId,
            _submittedLeads: clip._submittedLeads,
            style: clip.style,
            phoneNumber: clip.phoneNumber,
            linkUrl: clip.linkUrl,
            buttonText: clip.buttonText,
            // Schema-driven addons (Skip/Pause/Loop, ...) keep every option
            // under clip.addon, forwarded wholesale so new options never
            // need adding to this list.
            addon: clip.addon,
            // Remotion engine data (effects, keyframes, captions).
            effects: clip.effects,
            keyframes: clip.keyframes,
            captions: clip.captions,
            captionStyle: clip.captionStyle,
            sourceClipId: clip.sourceClipId,
          }))
        })),
        selectedClipId: state.selectedClipId,
        timelineSeconds: state.timelineSeconds,
        playheadPercent: state.playheadPercent
      };

      // Use incremental renderer to avoid full innerHTML rebuild on every change.
      // Only rebuilds tracks/clips whose data actually changed.
      renderTracksIncremental(enhancedState, { trackRows: els.trackRows }, showToast);

      // Timecode ruler + mini-map refresh. Ruler is a <canvas> so it cannot
      // be incrementally diffed; mini-map is rebuilt fresh on every render.
      renderTimecodeRuler(state.timelineSeconds || 60, state.playheadPercent, state.zoom);
      renderMiniMap();
      renderOverlayLayer();
      scheduleEngineUpdate();

      // Add enhanced drag and drop handlers
      els.trackRows.querySelectorAll('.track-lane').forEach(lane => {
        const track = state.tracks.find(t => t.id === lane.dataset.trackId);

        // Wire each lane's listeners exactly once. renderTracks is called on
        // every state mutation (toggles, drops, undo, etc.) and would
        // otherwise stack N copies of every handler — a single drop would
        // then insert N clips.
        if (lane.dataset.dragWired === '1') return;
        lane.dataset.dragWired = '1';

        lane.addEventListener('click', (event) => {
          if (event.target !== lane) return;
          const rect = lane.getBoundingClientRect();
          const percent = ((event.clientX - rect.left) / rect.width) * 100;
          state.playheadPercent = Math.max(0, Math.min(100, percent));
          updatePlaybackUI();
        });

        lane.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!state.snapEnabled) return;
          const rect = lane.getBoundingClientRect();
          const raw = ((e.clientX - rect.left) / rect.width) * 100;
          const dropWidth = 16; // default for unknown media; real code could look up dragged clip
          const candidates = computeSnapCandidates();
          const snapped = snapPercent(raw, candidates, lane.dataset.trackId, dropWidth, 1.2);
          if (snapped !== raw) renderSnapGuide(snapped);
          else clearSnapGuide();
        });

        lane.addEventListener('dragleave', () => { clearSnapGuide(); });
        lane.addEventListener('drop', async (e) => {
          clearSnapGuide();
          e.preventDefault();
          const rect = lane.getBoundingClientRect();
          const percent = ((e.clientX - rect.left) / rect.width) * 100;
          
          // Handle CutAI storyboard shots/scenes (production-ready drag-drop)
          let cutaiData = null;
          try {
            const rawData = e.dataTransfer.getData('application/json');
            if (rawData) cutaiData = JSON.parse(rawData);
          } catch (_) {}
          
          if (cutaiData && (cutaiData.type === 'cutai-shot' || cutaiData.type === 'cutai-scene')) {
            const duration = cutaiData.duration || 5;
            const startTime = (percent / 100) * (state.totalDuration || 60);
            
            const clipData = {
              id: `cutai-drop-${Date.now()}`,
              name: cutaiData.label || cutaiData.description || 'CutAI Shot',
              type: cutaiData.clipType || 'video',
              start: startTime,
              end: startTime + duration,
              sourceStart: 0,
              sourceEnd: duration,
              assetId: cutaiData.assetId || null,
              volume: 1,
              opacity: 1,
              playbackRate: 1,
              effects: cutaiData.effects || [],
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              lane: 0,
              source: 'cutai',
              metadata: cutaiData.metadata || {}
            };
            
            if (track && state.addClip) {
              state.addClip(track.id, clipData);
            }
            renderTracks();
            return;
          }
          
          // Original clip/media drop handling
          const data = JSON.parse(e.dataTransfer.getData('application/json') || '{}');

          if (data.type === 'clip' || data.type === 'clip-group') {
            const clipIds = data.type === 'clip-group' ? data.clipIds : [data.clipId];
            const allClips = state.tracks.flatMap(t => t.items || []);
            const clips = clipIds.map(cid => allClips.find(c => c.id === cid)).filter(Boolean);
            if (!clips.length || !track) return;

            const first = clips[0];
            const drift = percent - (first.left || 0);

            // Alt+drag duplicate: copy rather than move
            const isDuplicate = e.altKey;
            if (isDuplicate) {
              state.tracks.forEach(t => {
                clips.forEach(c => {
                  if ((t.items || []).some(x => x.id === c.id)) {
                    const idx = t.items.findIndex(x => x.id === c.id);
                    const dropLeft = Math.max(0, Math.min(100 - (c.width || 16), (c.left || 0) + (c.width || 16)));
                    const clone = { ...JSON.parse(JSON.stringify(c)), id: 'clip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), left: dropLeft };
                    t.items.splice(idx + 1, 0, clone);
                  }
                });
              });
              reAliasAllTracks(state);
              commitAndRender(state);
              return;
            }

            // Remove from old tracks
            state.tracks.forEach(t => {
              clips.forEach(c => {
                t.items = (t.items || []).filter(x => x.id !== c.id);
              });
            });
            reAliasAllTracks(state);

            // New left follows drag with optional snap
            const snapCandidates = computeSnapCandidates();
            const targetLeft = snapPercent(
              Math.max(0, Math.min(100 - (first.width || 16), percent)),
              snapCandidates,
              track.id,
              first.width || 16,
              1.2
            );

            // Apply insert/overwrite on target track before placing
            if (state.insertMode && !state.overwriteMode) {
              applyInsertMode(track, targetLeft, first.width || 16);
            } else if (state.overwriteMode) {
              applyOverwriteMode(track, targetLeft, first.width || 16);
            }

            clips.forEach(c => {
              c.left = targetLeft + (c === first ? 0 : drift);
              // Keep the time-based properties in sync with the new pixel
              // position. renderTracksIncremental and renderTracks both
              // read clip.start/clip.end directly; without this write-back
              // a cross-track drop would leave stale start/end and the
              // clip would desync on the next paint.
              if (state.timelineSeconds) {
                const durSec = Math.max(0, ((c.width || first.width || 0) / 100) * state.timelineSeconds);
                c.start = (c.left / 100) * state.timelineSeconds;
                c.end = c.start + durSec;
              }
              track.items.push(c);
            });
            track.items.sort((a, b) => (a.left || 0) - (b.left || 0));
            reAliasAllTracks(state);

            if (state.rippleMode) trimTailPastEnd(track, state.timelineSeconds || 60);
            state.selectedClipId = clips[0].id;
            commitAndRender(state);
          } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // OS file drop: route through the unified upload pipeline.
            // This replaces the previous hardcoded MDN-sample behavior.
            for (const file of e.dataTransfer.files) {
              await processFileUpload(file, {
                state,
                dropZone: track ? track.id : 'timeline',
                dropPercent: percent,
                showToast: (msg, type) => {
                  if (typeof showToast === 'function') showToast(msg, type);
                },
                renderTracks: () => { try { renderTracks(); } catch (e) {} }
              });
            }
          } else if (data.type === 'media' && track) {
            // Media-library drag-to-timeline (dataTransfer JSON with mediaData).
            // A real src is required; if missing, surface the error instead of
            // injecting demo media.
            const extra = {};
            const src = data.src || data.url;
            if (src) {
              extra.src = src;
            } else if (data.mediaType === 'image') {
              extra.src = svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><text x="90" y="320" fill="white" font-size="74" font-family="Arial" font-weight="700">${data.label}</text></svg>`);
              extra.fit = 'contain';
            } else {
              console.warn('[Timeline] Cannot add media item without a real src:', data);
              showToast('Cannot add media: source URL is missing', 'error');
              return;
            }
            const width = 16;
            // snap-to-gap if enabled
            let dropLeft = Math.max(0, percent);
            if (state.snapToGap && track.items) {
              const gap = findNearestGap(track, width, dropLeft);
              if (gap && gap.left != null) dropLeft = gap.left;
            }
            const snappedLeft = state.snapEnabled ? snapPercent(dropLeft, computeSnapCandidates(), track.id, width, 1.2) : dropLeft;
            const newClip = { id: Date.now(), name: data.label, left: Math.max(0, snappedLeft), width, type: data.mediaType, ...extra };
            if (state.insertMode && !state.overwriteMode) {
              applyInsertMode(track, newClip.left, width);
            } else if (state.overwriteMode) {
              applyOverwriteMode(track, newClip.left, width);
            }
            track.items.push(newClip);
            ensureItemsAlias(track);
            state.selectedClipId = newClip.id;
            if (state.rippleMode) trimTailPastEnd(track, state.timelineSeconds || 60);
            saveStateSnapshot(state);
            renderTracks();
            updatePreview(newClip);
          }
        });

        // Prototype parity: clip rendering is owned exclusively by
        // renderTracksIncremental (single render path). The legacy
        // enhanced-clip append loop that used to live here caused every
        // clip to be appended once per renderTracks() call.
      });
    }

    function createClipForMedia(label, file) {
      const objectUrl = URL.createObjectURL(file);
      const base = { id: Date.now() + Math.floor(Math.random() * 1000), name: file.name || label, left: 12, width: 16 };
      if (file.type.startsWith('video/')) return { ...base, type: 'video', src: objectUrl };
      if (file.type.startsWith('image/')) return { ...base, type: 'image', src: objectUrl, fit: 'contain' };
      if (file.type.startsWith('audio/')) return { ...base, type: 'audio', src: objectUrl };
      return { ...base, type: 'text', heading: file.name || 'Text Asset', body: 'Text file uploaded — content will be rendered in the preview.' };
    }

    function insertClipIntoTrack(clip, preferredTrackName) {
      // Match the track by name, then by type ('Text' → the text track, which
      // is named "Titles"), so overlays never land on the video track.
      const wanted = String(preferredTrackName || '').toLowerCase();
      const targetTrack = state.tracks.find((track) => track.name === preferredTrackName)
        || state.tracks.find((track) => String(track.type || '').toLowerCase() === wanted)
        || state.tracks[0];

      // Convert start/end format to left/width format used by this timeline
      if (clip.start !== undefined && clip.end !== undefined) {
        clip.left = (clip.start / state.timelineSeconds) * 100;
        clip.width = ((clip.end - clip.start) / state.timelineSeconds) * 100;
        delete clip.start;
        delete clip.end;
      } else {
        clip.left = Math.min(78, 8 + targetTrack.items.length * 10);
      }

      // renderTracks() only ever reads track.items (see the enhancedState
      // mapping) — pushing to track.clips here meant every clip inserted
      // through this function (addTextOverlay, addPersonalizationOverlay,
      // addLeadCapture, ...) rendered once in the preview but was invisible
      // on the actual timeline from the next render onward.
      targetTrack.items.push(clip);
      state.selectedClipId = clip.id;
      renderTracks();
      updatePreview(clip);
    }

    function renderMedia() {
      // Prototype parity: keep the static 4-item Media Library grid from the
      // template (Clip 01 / VO Raw / Logo / Track). The enhanced CineGen media
      // library is a stripped feature — it lives behind the rail panels.
      // Uploads still flow through uploadBtn → uploadInput → timeline.
      return;

      // eslint-disable-next-line no-unreachable
      renderMediaGrid(state.media, els.mediaGrid, (media, index, showToast) => {
        const generatedId = Date.now();
        const clipData = {
          id: generatedId,
          name: media.label || `Media ${generatedId}`,
          start: (state.playheadPercent / 100) * (state.timelineSeconds || 60),
          duration: media.duration || 5
        };

        if (media.type === 'video') {
          clipData.type = 'video';
          clipData.src = media.src;
        } else if (media.type === 'image') {
          clipData.type = 'image';
          clipData.src = media.src;
        } else if (media.type === 'audio') {
          clipData.type = 'audio';
          clipData.src = media.src;
        } else {
          clipData.type = 'text';
          clipData.text = media.label;
        }

        const targetTrackType = media.type === 'audio' ? 'Audio' : 
                                media.type === 'image' ? 'B-Roll' : 'Video';
        
        insertClipIntoTrack(clipData, targetTrackType);
        
      }, showToast, state);

      // Prototype parity: skip enhanced media library injection
      // extendMediaLibrary(els.mediaGrid, state, showToast);

      // Prototype parity: skip media ingest components
      // Add media ingest components to media library
      /*
      const mediaLibraryContainer = els.mediaGrid.parentElement;
      if (mediaLibraryContainer && !mediaLibraryContainer.querySelector('.media-ingest-components')) {
        const ingestContainer = document.createElement('div');
        ingestContainer.className = 'media-ingest-components';

        // Add video gallery
        const videoGallery = VideoGallery();
        ingestContainer.appendChild(videoGallery);

        // Add stickers library
        const stickersLibrary = StickersLibrary();
        ingestContainer.appendChild(stickersLibrary);

        // Add lower thirds
        const lowerThirds = LowerThirds();
        ingestContainer.appendChild(lowerThirds);

        // Add animations list
        const animationList = AnimationList();
        ingestContainer.appendChild(animationList);

        mediaLibraryContainer.appendChild(ingestContainer);
      }
      */
    }

    function renderGenerateTypes() {
      if (!els.generateTypes) return;
      els.generateTypes.innerHTML = '';
      const generateTooltips = {
        'Text': 'Generate video from text descriptions',
        'Image': 'Generate images from text or modify existing images',
        'Retake': 'Regenerate with different parameters',
        'Extend': 'Extend the duration of existing clips',
        'B-Roll': 'Generate supplementary B-roll footage'
      };
      state.generateTypes.forEach(([icon, label]) => {
        const button = document.createElement('button');
        button.className = `generate-type ${state.generateType === label ? 'active' : ''}`;
        button.innerHTML = `<span class="emoji">${icon}</span><span>${label}</span>`;
        button.setAttribute('data-tooltip', generateTooltips[label] || `Switch generate mode to ${label}`);
        button.title = generateTooltips[label] || `Switch generate mode to ${label}`;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', () => {
          state.generateType = label;
          renderGenerateTypes();
        });
        els.generateTypes.appendChild(button);
      });

      // Extend with enhancement features
      extendGenerationPanel(els.generateTypes, state, showToast);
    }



    // Small curated set rather than the full Google Fonts catalog (upstream
    // pulls from a large constants/fonts list) — enough real choice without
    // shipping a font-directory dependency.
    const LEAD_FORM_GOOGLE_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Oswald', 'Raleway', 'Nunito', 'Playfair Display', 'Bebas Neue', 'Anton'];
    const loadedGoogleFonts = new Set();
    function ensureGoogleFontLoaded(family) {
      if (!family || loadedGoogleFonts.has(family)) return;
      loadedGoogleFonts.add(family);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css?family=${family.replace(/\s/g, '+')}:400,700`;
      document.head.appendChild(link);
    }

    function renderLeadFormEditor(clip) {
      clip.fields = Array.isArray(clip.fields) && clip.fields.length ? clip.fields : [{ id: 'email', type: 'email', label: 'Email' }];
      clip.style = clip.style || {};
      // Transient UI state, not part of the clip's actual data — persisted
      // on the clip object purely so the active tab survives re-renders
      // triggered by field add/remove/reorder/webhook add-remove.
      const activeTab = clip._activeSettingsTab || 'fields';

      els.clipEditorContainer.innerHTML = `
        <div class="clip-editor">
          <div class="clip-editor__tabs" style="display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid var(--border,rgba(255,255,255,0.1))">
            <button type="button" class="lf-tab-btn mini-btn${activeTab === 'fields' ? ' active' : ''}" data-tab="fields">Fields</button>
            <button type="button" class="lf-tab-btn mini-btn${activeTab === 'style' ? ' active' : ''}" data-tab="style">Style</button>
            <button type="button" class="lf-tab-btn mini-btn${activeTab === 'integrations' ? ' active' : ''}" data-tab="integrations">Integrations</button>
          </div>
          <div class="clip-editor__tab-panel" data-tab-panel="fields" ${activeTab === 'fields' ? '' : 'hidden'}>
          <div class="clip-editor__section">
            <h3>Content</h3>
            <div class="clip-editor__field">
              <label for="lf-heading">Heading</label>
              <input id="lf-heading" type="text" value="${clip.heading || ''}" placeholder="Get Your Free Guide" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-cta">Button Text</label>
              <input id="lf-cta" type="text" value="${clip.ctaText || ''}" placeholder="Submit" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-privacy">Privacy Disclaimer</label>
              <input id="lf-privacy" type="text" value="${clip.privacyText || ''}" placeholder="We respect your privacy." />
            </div>
            <div class="clip-editor__field">
              <label for="lf-privacy-caption">Privacy Policy Link Text</label>
              <input id="lf-privacy-caption" type="text" value="${clip.privacyPolicyCaption || ''}" placeholder="Privacy Policy" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-privacy-link">Privacy Policy URL</label>
              <input id="lf-privacy-link" type="url" value="${clip.privacyPolicyLink || ''}" placeholder="https://example.com/privacy" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-skip-enabled"><input id="lf-skip-enabled" type="checkbox" ${clip.skipButtonEnabled ? 'checked' : ''} /> Show Skip button (dismiss form, resume video)</label>
            </div>
          </div>
          <div class="clip-editor__section">
            <h3>Fields</h3>
            <div id="lf-fields-list">
              ${clip.fields.map((f, i) => `
                <div class="clip-editor__field lf-field-row" data-index="${i}" draggable="true" style="display:flex;gap:6px;align-items:center;cursor:grab">
                  <span class="lf-field-drag-handle" title="Drag to reorder" style="cursor:grab;opacity:.5;user-select:none">⠿</span>
                  <input type="text" class="lf-field-label" value="${f.label || ''}" placeholder="Label" style="flex:1" />
                  <select class="lf-field-type">
                    <option value="text" ${f.type === 'text' ? 'selected' : ''}>Text</option>
                    <option value="multiline" ${f.type === 'multiline' ? 'selected' : ''}>Multiline</option>
                    <option value="email" ${f.type === 'email' ? 'selected' : ''}>Email</option>
                    <option value="phone" ${f.type === 'phone' ? 'selected' : ''}>Phone</option>
                    <option value="number" ${f.type === 'number' ? 'selected' : ''}>Number</option>
                    <option value="date" ${f.type === 'date' ? 'selected' : ''}>Date</option>
                  </select>
                  <label title="Viewer must fill this field" style="display:flex;align-items:center;gap:2px;font-size:11px;white-space:nowrap"><input type="checkbox" class="lf-field-required" ${f.required ? 'checked' : ''} /> req</label>
                  <button type="button" class="lf-field-remove mini-btn" data-tooltip="Remove field">✕</button>
                </div>
              `).join('')}
            </div>
            <button id="lf-field-add" class="mini-btn" style="width:100%;margin-top:6px" ${clip.fields.length >= 5 ? 'disabled title="Maximum 5 fields"' : ''}>+ Add Field${clip.fields.length >= 5 ? ' (max 5)' : ''}</button>
          </div>
          </div>
          <div class="clip-editor__tab-panel" data-tab-panel="style" ${activeTab === 'style' ? '' : 'hidden'}>
          <div class="clip-editor__section">
            <h3>Style</h3>
            <div class="clip-editor__field">
              <label for="lf-brand-logo">Brand Logo URL</label>
              <input id="lf-brand-logo" type="url" value="${clip.brandLogoUrl || ''}" placeholder="https://example.com/logo.png" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-bg">Background Color</label>
              <input id="lf-bg" type="color" value="${clip.style.backgroundColor || '#0b1120'}" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-bg-image">Background Image URL</label>
              <input id="lf-bg-image" type="url" value="${clip.style.backgroundImage || ''}" placeholder="https://example.com/bg.jpg (overrides color)" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-font-family">Font Family</label>
              <select id="lf-font-family">
                <option value="">Default</option>
                ${LEAD_FORM_GOOGLE_FONTS.map((f) => `<option value="${f}" ${clip.style.fontFamily === f ? 'selected' : ''}>${f}</option>`).join('')}
              </select>
            </div>
            <div class="clip-editor__field">
              <label for="lf-font-size">Font Size (${clip.style.fontSize || 100}%)</label>
              <input id="lf-font-size" type="range" min="60" max="160" value="${clip.style.fontSize || 100}" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-caption-font-size">Heading Size (${clip.style.captionFontSize || 130}%)</label>
              <input id="lf-caption-font-size" type="range" min="60" max="220" value="${clip.style.captionFontSize || 130}" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-caption-align">Heading Alignment</label>
              <select id="lf-caption-align">
                <option value="left" ${clip.style.captionAlignment === 'left' ? 'selected' : ''}>Left</option>
                <option value="center" ${!clip.style.captionAlignment || clip.style.captionAlignment === 'center' ? 'selected' : ''}>Center</option>
                <option value="right" ${clip.style.captionAlignment === 'right' ? 'selected' : ''}>Right</option>
              </select>
            </div>
            <div class="clip-editor__field">
              <label for="lf-btn-color">Button Background Color</label>
              <input id="lf-btn-color" type="color" value="${clip.style.buttonColor || '#22d3ee'}" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-btn-font-color">Button Font Color</label>
              <input id="lf-btn-font-color" type="color" value="${clip.style.buttonFontColor || '#03131a'}" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-btn-radius">Button Border Radius (${clip.style.buttonBorderRadius ?? 10}px)</label>
              <input id="lf-btn-radius" type="range" min="0" max="40" value="${clip.style.buttonBorderRadius ?? 10}" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-btn-bottom-border"><input id="lf-btn-bottom-border-enabled" type="checkbox" ${clip.style.buttonBottomBorder ? 'checked' : ''} /> Button Bottom Border</label>
              <input id="lf-btn-bottom-border" type="color" value="${clip.style.buttonBottomBorder || '#000000'}" ${clip.style.buttonBottomBorder ? '' : 'disabled'} />
            </div>
          </div>
          <div class="clip-editor__section">
            <h3>Layout &amp; Animation</h3>
            <div class="clip-editor__field">
              <label for="lf-transition">Entrance Transition</label>
              <select id="lf-transition">
                <option value="none" ${!clip.style.transition || clip.style.transition === 'none' ? 'selected' : ''}>None</option>
                <option value="fade" ${clip.style.transition === 'fade' ? 'selected' : ''}>Fade</option>
                <option value="slide-up" ${clip.style.transition === 'slide-up' ? 'selected' : ''}>Slide Up</option>
                <option value="slide-down" ${clip.style.transition === 'slide-down' ? 'selected' : ''}>Slide Down</option>
              </select>
            </div>
            <div class="clip-editor__field">
              <label for="lf-width-pct">Width (${clip.style.widthPercent || 'auto'}${clip.style.widthPercent ? '%' : ''})</label>
              <input id="lf-width-pct" type="range" min="30" max="100" value="${clip.style.widthPercent || 82}" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-height-pct">Max Height (${clip.style.heightPercent || 'auto'}${clip.style.heightPercent ? '%' : ''})</label>
              <input id="lf-height-pct" type="range" min="20" max="100" value="${clip.style.heightPercent || 100}" />
            </div>
            <div class="clip-editor__field">
              <label for="lf-position">Vertical Position</label>
              <select id="lf-position">
                <option value="top" ${clip.style.position === 'top' ? 'selected' : ''}>Top</option>
                <option value="center" ${!clip.style.position || clip.style.position === 'center' ? 'selected' : ''}>Center</option>
                <option value="bottom" ${clip.style.position === 'bottom' ? 'selected' : ''}>Bottom</option>
              </select>
            </div>
          </div>
          </div>
          <div class="clip-editor__tab-panel" data-tab-panel="integrations" ${activeTab === 'integrations' ? '' : 'hidden'}>
          <div class="clip-editor__section">
            <h3>Integrations</h3>
            <div class="clip-editor__field">
              <label for="lf-webhook-enabled"><input id="lf-webhook-enabled" type="checkbox" ${clip.webhookEnabled ? 'checked' : ''} /> Send submissions to webhook(s)</label>
            </div>
            <div class="clip-editor__field">
              <label for="lf-webhook-url">Webhook URL</label>
              <input id="lf-webhook-url" type="url" value="${clip.webhookUrl || ''}" placeholder="https://your-endpoint.com/hook" />
            </div>
            ${clip.webhookUrl2 !== undefined ? `
            <div class="clip-editor__field lf-webhook-extra" style="display:flex;gap:6px;align-items:flex-end">
              <div style="flex:1"><label for="lf-webhook-url2">Webhook URL 2</label><input id="lf-webhook-url2" type="url" value="${clip.webhookUrl2 || ''}" placeholder="https://your-endpoint.com/hook-2" /></div>
              <button type="button" class="lf-webhook-remove mini-btn" data-target="2" data-tooltip="Remove webhook 2">✕</button>
            </div>` : ''}
            ${clip.webhookUrl3 !== undefined ? `
            <div class="clip-editor__field lf-webhook-extra" style="display:flex;gap:6px;align-items:flex-end">
              <div style="flex:1"><label for="lf-webhook-url3">Webhook URL 3</label><input id="lf-webhook-url3" type="url" value="${clip.webhookUrl3 || ''}" placeholder="https://your-endpoint.com/hook-3" /></div>
              <button type="button" class="lf-webhook-remove mini-btn" data-target="3" data-tooltip="Remove webhook 3">✕</button>
            </div>` : ''}
            ${clip.webhookUrl3 === undefined ? `
            <div class="clip-editor__field">
              <button id="lf-webhook-add" class="mini-btn" style="width:100%">+ Add Webhook Address</button>
            </div>` : ''}
            <div class="clip-editor__field">
              <button id="lf-webhook-test" type="button" class="mini-btn" style="width:100%">Test Webhook</button>
              <span id="lf-webhook-test-result" style="font-size:11px;color:var(--text-dim)"></span>
            </div>
            <div class="clip-editor__field">
              <label for="lf-email-enabled"><input id="lf-email-enabled" type="checkbox" ${clip.emailNotificationEnabled ? 'checked' : ''} /> Email notification on submit</label>
            </div>
            <div class="clip-editor__field">
              <label for="lf-email-address">Notification Address</label>
              <input id="lf-email-address" type="email" value="${clip.notificationEmail || ''}" placeholder="you@example.com" ${clip.emailNotificationEnabled ? '' : 'disabled'} />
            </div>
            <div class="clip-editor__field">
              <label for="lf-fb-pixel">Facebook Pixel ID</label>
              <input id="lf-fb-pixel" type="text" value="${clip.fbPixelId || ''}" placeholder="1234567890" />
            </div>
            <div class="clip-editor__field">
              <button id="lf-download-leads" class="mini-btn" style="width:100%" >Download leads${(clip._submittedLeads || []).length ? ` (${(clip._submittedLeads || []).length} this session)` : ''}</button>
            </div>
          </div>
          </div>
        </div>
      `;

      els.clipEditorContainer.querySelectorAll('.lf-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          clip._activeSettingsTab = btn.dataset.tab;
          els.clipEditorContainer.querySelectorAll('.lf-tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
          els.clipEditorContainer.querySelectorAll('.clip-editor__tab-panel').forEach((panel) => {
            panel.hidden = panel.dataset.tabPanel !== btn.dataset.tab;
          });
        });
      });

      const rerenderFields = () => {
        renderLeadFormEditor(clip);
        updatePreview(clip);
      };

      els.clipEditorContainer.querySelector('#lf-heading').addEventListener('input', (e) => {
        clip.heading = e.target.value;
        renderTracks();
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-cta').addEventListener('input', (e) => {
        clip.ctaText = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-privacy').addEventListener('input', (e) => {
        clip.privacyText = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-privacy-caption').addEventListener('input', (e) => {
        clip.privacyPolicyCaption = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-privacy-link').addEventListener('input', (e) => {
        clip.privacyPolicyLink = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-skip-enabled').addEventListener('change', (e) => {
        clip.skipButtonEnabled = e.target.checked;
        updatePreview(clip);
      });
      let dragFromIndex = null;
      els.clipEditorContainer.querySelectorAll('.lf-field-row').forEach((row) => {
        const index = parseInt(row.dataset.index, 10);
        row.querySelector('.lf-field-label').addEventListener('input', (e) => {
          clip.fields[index].label = e.target.value;
          clip.fields[index].id = e.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || clip.fields[index].id;
          updatePreview(clip);
        });
        row.querySelector('.lf-field-type').addEventListener('change', (e) => {
          clip.fields[index].type = e.target.value;
          updatePreview(clip);
        });
        row.querySelector('.lf-field-required').addEventListener('change', (e) => {
          clip.fields[index].required = e.target.checked;
          updatePreview(clip);
        });
        row.querySelector('.lf-field-remove').addEventListener('click', () => {
          if (clip.fields.length <= 1) return;
          clip.fields.splice(index, 1);
          rerenderFields();
        });

        // Native HTML5 drag-and-drop reorder, matching the same pattern
        // used for clip drag-and-drop on the timeline itself.
        row.addEventListener('dragstart', (e) => {
          dragFromIndex = index;
          e.dataTransfer.effectAllowed = 'move';
          row.style.opacity = '0.4';
        });
        row.addEventListener('dragend', () => {
          row.style.opacity = '';
        });
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          row.style.borderTop = '2px solid var(--cyan, #22d3ee)';
        });
        row.addEventListener('dragleave', () => {
          row.style.borderTop = '';
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          row.style.borderTop = '';
          if (dragFromIndex === null || dragFromIndex === index) return;
          const [moved] = clip.fields.splice(dragFromIndex, 1);
          clip.fields.splice(index, 0, moved);
          dragFromIndex = null;
          rerenderFields();
        });
      });
      els.clipEditorContainer.querySelector('#lf-field-add').addEventListener('click', () => {
        if (clip.fields.length >= 5) {
          showToast('A lead form can have a maximum of 5 fields', 'info');
          return;
        }
        clip.fields.push({ id: `field_${clip.fields.length + 1}`, type: 'text', label: 'New Field', required: false });
        rerenderFields();
      });
      els.clipEditorContainer.querySelector('#lf-brand-logo').addEventListener('input', (e) => {
        clip.brandLogoUrl = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-bg').addEventListener('input', (e) => {
        clip.style.backgroundColor = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-bg-image').addEventListener('input', (e) => {
        clip.style.backgroundImage = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-font-family').addEventListener('change', (e) => {
        clip.style.fontFamily = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-font-size').addEventListener('input', (e) => {
        clip.style.fontSize = parseInt(e.target.value, 10);
        e.target.previousElementSibling.textContent = `Font Size (${clip.style.fontSize}%)`;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-caption-font-size').addEventListener('input', (e) => {
        clip.style.captionFontSize = parseInt(e.target.value, 10);
        e.target.previousElementSibling.textContent = `Heading Size (${clip.style.captionFontSize}%)`;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-caption-align').addEventListener('change', (e) => {
        clip.style.captionAlignment = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-btn-color').addEventListener('input', (e) => {
        clip.style.buttonColor = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-btn-font-color').addEventListener('input', (e) => {
        clip.style.buttonFontColor = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-btn-radius').addEventListener('input', (e) => {
        clip.style.buttonBorderRadius = parseInt(e.target.value, 10);
        e.target.previousElementSibling.textContent = `Button Border Radius (${clip.style.buttonBorderRadius}px)`;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-btn-bottom-border-enabled').addEventListener('change', (e) => {
        clip.style.buttonBottomBorder = e.target.checked ? (els.clipEditorContainer.querySelector('#lf-btn-bottom-border').value || '#000000') : '';
        els.clipEditorContainer.querySelector('#lf-btn-bottom-border').disabled = !e.target.checked;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-btn-bottom-border').addEventListener('input', (e) => {
        clip.style.buttonBottomBorder = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-transition').addEventListener('change', (e) => {
        clip.style.transition = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-width-pct').addEventListener('input', (e) => {
        clip.style.widthPercent = parseInt(e.target.value, 10);
        e.target.previousElementSibling.textContent = `Width (${clip.style.widthPercent}%)`;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-height-pct').addEventListener('input', (e) => {
        clip.style.heightPercent = parseInt(e.target.value, 10);
        e.target.previousElementSibling.textContent = `Max Height (${clip.style.heightPercent}%)`;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-position').addEventListener('change', (e) => {
        clip.style.position = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#lf-webhook-enabled').addEventListener('change', (e) => {
        clip.webhookEnabled = e.target.checked;
      });
      els.clipEditorContainer.querySelector('#lf-webhook-url').addEventListener('input', (e) => {
        clip.webhookUrl = e.target.value;
      });
      const webhook2Input = els.clipEditorContainer.querySelector('#lf-webhook-url2');
      if (webhook2Input) {
        webhook2Input.addEventListener('input', (e) => { clip.webhookUrl2 = e.target.value; });
      }
      const webhook3Input = els.clipEditorContainer.querySelector('#lf-webhook-url3');
      if (webhook3Input) {
        webhook3Input.addEventListener('input', (e) => { clip.webhookUrl3 = e.target.value; });
      }
      const webhookAddBtn = els.clipEditorContainer.querySelector('#lf-webhook-add');
      if (webhookAddBtn) {
        webhookAddBtn.addEventListener('click', () => {
          if (clip.webhookUrl2 === undefined) {
            clip.webhookUrl2 = '';
          } else if (clip.webhookUrl3 === undefined) {
            clip.webhookUrl3 = '';
          }
          renderLeadFormEditor(clip);
        });
      }
      els.clipEditorContainer.querySelectorAll('.lf-webhook-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.target;
          if (target === '2') {
            // Shift webhook3 into webhook2's slot, matching upstream's
            // removeWebhook behavior, so there's never a gap between slots.
            clip.webhookUrl2 = clip.webhookUrl3 !== undefined ? clip.webhookUrl3 : undefined;
            clip.webhookUrl3 = undefined;
          } else if (target === '3') {
            clip.webhookUrl3 = undefined;
          }
          renderLeadFormEditor(clip);
        });
      });
      els.clipEditorContainer.querySelector('#lf-webhook-test').addEventListener('click', async () => {
        const urls = [clip.webhookUrl, clip.webhookUrl2, clip.webhookUrl3].filter(Boolean);
        const resultEl = els.clipEditorContainer.querySelector('#lf-webhook-test-result');
        if (!urls.length) {
          resultEl.textContent = 'No webhook URL configured';
          return;
        }
        resultEl.textContent = 'Testing...';
        const results = await Promise.allSettled(urls.map((url) => fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, source: 'lead-form-test', clipId: clip.id }),
        })));
        const failures = results.filter((r) => r.status === 'rejected' || (r.value && !r.value.ok));
        if (failures.length) {
          resultEl.textContent = `${failures.length}/${urls.length} failed`;
          showToast('Webhook test failed for one or more URLs', 'error');
        } else {
          resultEl.textContent = `${urls.length}/${urls.length} succeeded`;
          showToast('Webhook test succeeded', 'success');
        }
      });
      els.clipEditorContainer.querySelector('#lf-email-enabled').addEventListener('change', (e) => {
        clip.emailNotificationEnabled = e.target.checked;
        els.clipEditorContainer.querySelector('#lf-email-address').disabled = !e.target.checked;
      });
      els.clipEditorContainer.querySelector('#lf-email-address').addEventListener('input', (e) => {
        clip.notificationEmail = e.target.value;
      });
      els.clipEditorContainer.querySelector('#lf-fb-pixel').addEventListener('input', (e) => {
        clip.fbPixelId = e.target.value;
      });
      els.clipEditorContainer.querySelector('#lf-download-leads').addEventListener('click', () => {
        // Stored leads (lead-capture backend) merged with this session's.
        downloadLeadsCsv({ clipId: clip.id, local: clip._submittedLeads || [], name: clip.name || 'leads' });
      });
    }

    function renderClickToCallEditor(clip) {
      clip.style = clip.style || {};
      const valid = isValidPhoneNumber(clip.phoneNumber);

      els.clipEditorContainer.innerHTML = `
        <div class="clip-editor">
          <div class="clip-editor__section">
            <h3>Content</h3>
            <div class="clip-editor__field">
              <label for="ctc-phone">Phone Number</label>
              <input id="ctc-phone" type="tel" value="${clip.phoneNumber || ''}" placeholder="+1 555-123-4567" />
              <span id="ctc-phone-error" style="color:#f87171;font-size:11px;${valid || !clip.phoneNumber ? 'display:none' : ''}">Enter a valid phone number</span>
            </div>
            <div class="clip-editor__field">
              <label for="ctc-link">Link URL (used when no phone number is set)</label>
              <input id="ctc-link" type="url" value="${escapeHtml(clip.linkUrl || '')}" placeholder="https://" />
            </div>
            <div class="clip-editor__field">
              <label for="ctc-btn-text">Button Text</label>
              <input id="ctc-btn-text" type="text" maxlength="40" value="${escapeHtml(clip.buttonText || 'Call Now')}" />
            </div>
            <div class="clip-editor__field">
              <label for="ctc-notify">Email to notify about call attempt</label>
              <input id="ctc-notify" type="email" value="${escapeHtml(clip.callNotifyAddress || '')}" placeholder="you@example.com" />
            </div>
          </div>
          <div class="clip-editor__section">
            <h3>Animation</h3>
            <div class="cta-anim-grid" role="radiogroup" aria-label="Button animation">
              ${CTA_ANIMATIONS.map(([id, label]) => `<button type="button" class="cta-anim${(clip.animation || 'none') === id ? ' is-on' : ''}" data-cta-anim="${id}" role="radio" aria-checked="${(clip.animation || 'none') === id}" title="${escapeHtml(label)}"><span class="cta-anim__preview" data-cta-preview="${id}"></span><span class="cta-anim__label">${escapeHtml(label)}</span></button>`).join('')}
              <button type="button" class="cta-anim${clip.animation === 'custom' ? ' is-on' : ''}" data-cta-anim="custom" role="radio" aria-checked="${clip.animation === 'custom'}"><span class="cta-anim__preview cta-anim__preview--custom">{ }</span><span class="cta-anim__label">Your Lottie file</span></button>
            </div>
            <div class="clip-editor__field" data-cta-custom ${clip.animation === 'custom' ? '' : 'hidden'}>
              <label for="ctc-lottie">Lottie JSON (URL or upload)</label>
              <input id="ctc-lottie" type="url" value="${escapeHtml(clip.lottieSrc || '')}" placeholder="https://…/button.json" />
              <label class="mini-btn addon-upload-btn" style="margin-top:6px">Upload .json<input type="file" accept=".json,application/json" id="ctc-lottie-file" hidden /></label>
            </div>
          </div>
          <div class="clip-editor__section">
            <h3>Style</h3>
            <div class="clip-editor__field">
              <label>Color theme</label>
              <div class="cta-themes" role="group" aria-label="Color themes">
                ${CTA_COLOR_THEMES.map((t) => `<button type="button" class="cta-theme" data-cta-theme="${t.id}" title="${escapeHtml(t.label)}" aria-label="${escapeHtml(t.label)} theme" style="background:${t.buttonColor};color:${t.textColor}">Aa</button>`).join('')}
              </div>
            </div>
            ${[
              ['button', 'Button color', clip.style.buttonColor || '#eb5054', ''],
              ['text', 'Text color', clip.textColor || '#ffffff', ''],
              ['icon', 'Icon color', clip.iconColor || clip.textColor || '#ffffff', 'icon'],
              ['effect', 'Effect color (ring, glow, ripple, shine)', clip.accentColor || (clip.animation === 'shine' ? '#ffffff' : clip.style.buttonColor || '#eb5054'), 'effect'],
            ].map(([key, label, value, part]) => `
            <div class="clip-editor__field cta-color" data-cta-color-row="${key}"${part ? ` data-cta-part="${part}"` : ''}>
              <label for="ctc-${key}-color">${label}</label>
              <div class="cta-color__inputs">
                <input id="ctc-${key}-color" type="color" data-cta-color="${key}" value="${escapeHtml(value)}" />
                <input type="text" class="cta-color__hex" data-cta-hex="${key}" value="${escapeHtml(value)}" maxlength="7" spellcheck="false" aria-label="${label} hex" />
              </div>
            </div>`).join('')}
            <div class="clip-editor__field">
              <label for="ctc-font">Font</label>
              <select id="ctc-font">${OVERLAY_FONTS.map((f) => `<option ${f === (clip.fontFamily || 'Montserrat') ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}</select>
            </div>
          </div>
          <div class="clip-editor__section">
            <h3>Position &amp; Blend</h3>
            <p style="font-size:11px;color:var(--text-dim);margin:0 0 8px">Drag the button directly in the preview to reposition, or use the handle in its top-right corner to resize.</p>
            <div class="clip-editor__field">
              <label for="ctc-pos-left">Horizontal Position (${Math.round(clip.style.posLeft ?? 50)}%)</label>
              <input id="ctc-pos-left" type="range" min="0" max="100" value="${clip.style.posLeft ?? 50}" />
            </div>
            <div class="clip-editor__field">
              <label for="ctc-pos-top">Vertical Position (${Math.round(clip.style.posTop ?? 50)}%)</label>
              <input id="ctc-pos-top" type="range" min="0" max="100" value="${clip.style.posTop ?? 50}" />
            </div>
            <div class="clip-editor__field">
              <label for="ctc-pos-width">Width (${Math.round(clip.style.posWidth ?? 40)}%)</label>
              <input id="ctc-pos-width" type="range" min="10" max="90" value="${clip.style.posWidth ?? 40}" />
            </div>
            <div class="clip-editor__field">
              <label for="ctc-blend-mode">Blend Mode</label>
              <select id="ctc-blend-mode">
                ${['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion'].map((m) => `<option value="${m}" ${(clip.style.blendMode || 'normal') === m ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="clip-editor__field">
              <label for="ctc-opacity">Opacity (${clip.style.opacity ?? 100}%)</label>
              <input id="ctc-opacity" type="range" min="0" max="100" value="${clip.style.opacity ?? 100}" />
            </div>
          </div>
        </div>
      `;

      els.clipEditorContainer.querySelector('#ctc-link').addEventListener('input', (e) => {
        clip.linkUrl = e.target.value;
        updatePreview(clip);
        debouncedSave();
      });
      els.clipEditorContainer.querySelector('#ctc-phone').addEventListener('input', (e) => {
        clip.phoneNumber = e.target.value;
        const errEl = els.clipEditorContainer.querySelector('#ctc-phone-error');
        const isValid = isValidPhoneNumber(clip.phoneNumber);
        errEl.style.display = (isValid || !clip.phoneNumber) ? 'none' : 'block';
        renderTracks();
        updatePreview(clip);
      });
      const ctaChanged = () => {
        updatePreview(clip);
        scheduleEngineUpdate();
        debouncedSave();
        drawCtaPreviews();
      };
      els.clipEditorContainer.querySelector('#ctc-btn-text').addEventListener('input', (e) => {
        clip.buttonText = e.target.value;
        ctaChanged();
      });
      els.clipEditorContainer.querySelector('#ctc-notify').addEventListener('input', (e) => {
        clip.callNotifyAddress = e.target.value.trim();
        debouncedSave();
      });
      els.clipEditorContainer.querySelector('#ctc-font').addEventListener('change', (e) => {
        clip.fontFamily = e.target.value;
        ensureGoogleFontLoaded(clip.fontFamily);
        ctaChanged();
      });
      els.clipEditorContainer.querySelectorAll('[data-cta-anim]').forEach((btn) => btn.addEventListener('click', () => {
        clip.animation = btn.dataset.ctaAnim;
        els.clipEditorContainer.querySelectorAll('[data-cta-anim]').forEach((b) => {
          b.classList.toggle('is-on', b === btn);
          b.setAttribute('aria-checked', String(b === btn));
        });
        els.clipEditorContainer.querySelector('[data-cta-custom]').hidden = clip.animation !== 'custom';
        syncCtaColorParts();
        updatePreview(clip);
        scheduleEngineUpdate();
        debouncedSave();
      }));
      els.clipEditorContainer.querySelector('#ctc-lottie').addEventListener('change', (e) => {
        clip.lottieSrc = e.target.value.trim();
        ctaChanged();
      });
      els.clipEditorContainer.querySelector('#ctc-lottie-file').addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const json = JSON.parse(await file.text());
          if (!json || !Array.isArray(json.layers)) throw new Error('not a Lottie file');
          let url = null;
          try { url = await uploadFileToStorage(file); } catch { url = null; }
          if (!url) {
            const { localMediaUrl } = await import('../lib/editor/remotion/localMedia.js');
            url = localMediaUrl(new Blob([JSON.stringify(json)], { type: 'application/json' }));
          }
          clip.lottieSrc = typeof url === 'string' ? url : url.url;
          els.clipEditorContainer.querySelector('#ctc-lottie').value = clip.lottieSrc;
          ctaChanged();
        } catch (err) {
          showToast(`That file isn't a Lottie animation (${err.message})`, 'error');
        }
      });
      // Live previews of each animation style, in the clip's own text and colours.
      let ctaPreviewAnims = [];
      async function drawCtaPreviews() {
        const lottie = (await import('lottie-web')).default;
        ctaPreviewAnims.forEach((a) => a.destroy());
        ctaPreviewAnims = [];
        els.clipEditorContainer.querySelectorAll('[data-cta-preview]').forEach((host) => {
          const id = host.dataset.ctaPreview;
          host.innerHTML = '';
          if (id === 'none') {
            host.innerHTML = `<span class="cta-plain" style="background:${escapeHtml(clip.style.buttonColor || '#eb5054')};color:${escapeHtml(clip.textColor || '#fff')}">${escapeHtml(clip.buttonText || 'Call Now')}</span>`;
            return;
          }
          const data = buildCtaLottie({ ...clip, animation: id, buttonColor: clip.style.buttonColor });
          if (data) ctaPreviewAnims.push(lottie.loadAnimation({ container: host, renderer: 'svg', loop: true, autoplay: true, animationData: data }));
        });
      }
      drawCtaPreviews();
      // Colors: button, text, icon (icon styles) and effect (ring/glow/ripple/shine styles).
      const CTA_COLOR_KEYS = { button: null, text: 'textColor', icon: 'iconColor', effect: 'accentColor' };
      const setCtaColor = (key, value) => {
        if (!/^#[0-9a-f]{6}$/i.test(value)) return false;
        if (key === 'button') clip.style.buttonColor = value;
        else clip[CTA_COLOR_KEYS[key]] = value;
        const row = els.clipEditorContainer.querySelector(`[data-cta-color-row="${key}"]`);
        if (row) {
          row.querySelector('[data-cta-color]').value = value;
          const hex = row.querySelector('[data-cta-hex]');
          if (document.activeElement !== hex) hex.value = value;
        }
        return true;
      };
      const syncCtaColorParts = () => {
        const parts = ctaColorParts(clip.animation || 'none');
        els.clipEditorContainer.querySelectorAll('[data-cta-part]').forEach((row) => { row.hidden = !parts[row.dataset.ctaPart]; });
        // Unset colors show what the animation will actually use.
        const shown = { icon: clip.iconColor || clip.textColor || '#ffffff', effect: clip.accentColor || (clip.animation === 'shine' ? '#ffffff' : clip.style.buttonColor || '#eb5054') };
        Object.entries(shown).forEach(([key, value]) => {
          const row = els.clipEditorContainer.querySelector(`[data-cta-color-row="${key}"]`);
          if (row) { row.querySelector('[data-cta-color]').value = value; row.querySelector('[data-cta-hex]').value = value; }
        });
      };
      syncCtaColorParts();
      els.clipEditorContainer.querySelectorAll('[data-cta-color]').forEach((input) => input.addEventListener('input', () => {
        if (setCtaColor(input.dataset.ctaColor, input.value)) ctaChanged();
      }));
      els.clipEditorContainer.querySelectorAll('[data-cta-hex]').forEach((input) => input.addEventListener('input', () => {
        const v = input.value.trim().replace(/^([0-9a-f]{6})$/i, '#$1');
        input.classList.toggle('is-invalid', !/^#[0-9a-f]{6}$/i.test(v));
        if (setCtaColor(input.dataset.ctaHex, v.toLowerCase())) ctaChanged();
      }));
      els.clipEditorContainer.querySelectorAll('[data-cta-theme]').forEach((btn) => btn.addEventListener('click', () => {
        const t = CTA_COLOR_THEMES.find((x) => x.id === btn.dataset.ctaTheme);
        if (!t) return;
        setCtaColor('button', t.buttonColor);
        setCtaColor('text', t.textColor);
        setCtaColor('icon', t.iconColor);
        setCtaColor('effect', t.accentColor);
        ctaChanged();
      }));
      els.clipEditorContainer.querySelector('#ctc-pos-left').addEventListener('input', (e) => {
        clip.style.posLeft = parseInt(e.target.value, 10);
        e.target.previousElementSibling.textContent = `Horizontal Position (${clip.style.posLeft}%)`;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#ctc-pos-top').addEventListener('input', (e) => {
        clip.style.posTop = parseInt(e.target.value, 10);
        e.target.previousElementSibling.textContent = `Vertical Position (${clip.style.posTop}%)`;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#ctc-pos-width').addEventListener('input', (e) => {
        clip.style.posWidth = parseInt(e.target.value, 10);
        e.target.previousElementSibling.textContent = `Width (${clip.style.posWidth}%)`;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#ctc-blend-mode').addEventListener('change', (e) => {
        clip.style.blendMode = e.target.value;
        updatePreview(clip);
      });
      els.clipEditorContainer.querySelector('#ctc-opacity').addEventListener('input', (e) => {
        clip.style.opacity = parseInt(e.target.value, 10);
        e.target.previousElementSibling.textContent = `Opacity (${clip.style.opacity}%)`;
        updatePreview(clip);
      });
    }

    // ---------------------------------------------------------------
    // Remotion engine (preview). The <Player> renders the timeline as a
    // Remotion composition and is the playhead clock while playing. If it
    // can't start, the editor keeps its previous DOM preview, so nothing is
    // lost.
    // ---------------------------------------------------------------
    // `var` on purpose: functions that read these (renderPreviewAsset,
    // updatePlaybackUI) can run during start-up before this line executes.
    // eslint-disable-next-line no-var
    var remotionEngine = null;
    // eslint-disable-next-line no-var -- AI animation preview frame (sandboxed iframe)
    var codePreview = null;
    // eslint-disable-next-line no-var
    var remotionModel = null;
    // eslint-disable-next-line no-var
    var engineUpdateTimer = null;
    // eslint-disable-next-line no-var
    var ENGINE_FPS = 30;

    function isComposited(clip) {
      const addon = getAddon(clip.type);
      if (addon) return addon.category === 'overlay';
      return ['video', 'image', 'audio', 'text', 'remotion-code'].includes(clip.type);
    }
    function engineHasContent() {
      return !!remotionModel && (remotionModel.layers.length > 0 || remotionModel.audio.length > 0);
    }
    function buildEngineModel() {
      return timelineToComposition(state, { fps: ENGINE_FPS, quality: '1080p', profile: getActivePersonalizationProfile() });
    }
    function percentToFrame(p) {
      return Math.round(((p / 100) * (state.timelineSeconds || 60)) * ENGINE_FPS);
    }
    function frameToPercent(f) {
      return Math.max(0, Math.min(100, ((f / ENGINE_FPS) / (state.timelineSeconds || 60)) * 100));
    }

    async function initRemotionEngine() {
      if (remotionEngine || !els.remotionStage) return;
      try {
        const { createPreviewEngine } = await import('../lib/editor/remotion/previewEngine.jsx');
        remotionModel = buildEngineModel();
        remotionEngine = createPreviewEngine(els.remotionStage, {
          model: remotionModel,
          onFrame: handleEngineFrame,
          onEnded: () => {
            state.playing = false;
            updatePlaybackUI();
          },
          onReady: () => remotionEngine?.seekToFrame(percentToFrame(state.playheadPercent)),
          onError: (err) => console.warn('[Remotion preview]', err),
        });
        root.classList.add('remotion-engine-on');
        remotionEngine.seekToFrame(percentToFrame(state.playheadPercent));
        import('../lib/editor/remotion/codePreviewClient.js').then(({ createCodePreview }) => {
          codePreview = createCodePreview(els.remotionStage.parentElement, {
            onError: (layerId, message) => {
              const clip = allClips().find((c) => String(c.id) === String(layerId));
              if (clip) clip.lastError = message;
              showToast(`Animation "${clip?.name || layerId}" has an error: ${message}`, 'error');
            },
          });
          codePreview.update(remotionModel);
          codePreview.frame(percentToFrame(state.playheadPercent));
        });
        updatePreview();
        renderOverlayLayer();
      } catch (err) {
        console.warn('[Remotion preview] unavailable, using the classic preview', err);
        remotionEngine = null;
      }
    }

    /** Rebuild the composition after timeline edits (debounced). */
    function scheduleEngineUpdate() {
      if (!remotionEngine) return;
      window.clearTimeout(engineUpdateTimer);
      engineUpdateTimer = window.setTimeout(() => {
        remotionModel = buildEngineModel();
        remotionEngine.update(remotionModel);
        codePreview?.update(remotionModel);
      }, 60);
    }

    /** Player frame while playing → playhead, addon runtime, UI. */
    function handleEngineFrame(frame) {
      if (!state.playing) return;
      const prevPercent = state.playheadPercent;
      state.playheadPercent = frameToPercent(frame);
      codePreview?.frame(frame);
      runAddonTick(prevPercent, state.playheadPercent);
      if (!state.playing) {
        remotionEngine.pause();
        remotionEngine.seekToFrame(percentToFrame(state.playheadPercent));
      } else if (Math.abs(frameToPercent(frame) - state.playheadPercent) > 0.01) {
        // A Skip/Loop moved the playhead.
        remotionEngine.seekToFrame(percentToFrame(state.playheadPercent));
      }
      updatePlaybackUI();
    }

    /** Fit the interaction layer to the Player's letterboxed picture. */
    function fitOverlayLayerToPlayer(layer) {
      if (!remotionEngine || !remotionModel || !els.remotionStage) {
        layer.style.left = layer.style.top = layer.style.right = layer.style.bottom = '';
        layer.style.width = layer.style.height = '';
        return;
      }
      const W = els.remotionStage.clientWidth;
      const H = els.remotionStage.clientHeight;
      if (!W || !H) return;
      const aspect = remotionModel.width / remotionModel.height;
      let w = W;
      let h = W / aspect;
      if (h > H) { h = H; w = H * aspect; }
      Object.assign(layer.style, { left: `${(W - w) / 2}px`, top: `${(H - h) / 2}px`, right: 'auto', bottom: 'auto', width: `${w}px`, height: `${h}px` });
    }

    // ---------------------------------------------------------------
    // Overlay compositor: every overlay clip active at the playhead is
    // drawn into the overlay layer above the video (upstream Popcorn showed
    // all track events at once; the old preview showed only the selection).
    // ---------------------------------------------------------------
    function findBaseClipAtPlayhead() {
      const T = state.timelineSeconds || 60;
      const t = (state.playheadPercent / 100) * T;
      for (const track of state.tracks) {
        for (const clip of track.items || track.clips || []) {
          if (!['video', 'image'].includes(clip.type)) continue;
          const { start, end } = clipTimeRange(clip, T);
          if (t >= start && t < end) return clip;
        }
      }
      return null;
    }

    function baseClips() {
      const T = state.timelineSeconds || 60;
      return state.tracks
        .filter((tr) => (tr.type || '').toLowerCase() === 'video' || (tr.items || []).some((c) => c.type === 'video'))
        .flatMap((tr) => (tr.items || tr.clips || []).filter((c) => (c.type === 'video' || c.type === 'image') && c.src))
        .map((c) => ({ clip: c, ...clipTimeRange(c, T) }))
        .sort((a, b) => a.start - b.start);
    }

    /** Outgoing/incoming clips for a video transition spanning [start, end]. */
    function transitionSources(start, end) {
      const mid = (start + end) / 2;
      const clips = baseClips();
      const describe = (c) => (c ? { src: c.clip.src, type: c.clip.type, start: c.start } : null);
      const from = [...clips].reverse().find((c) => c.start < mid) || null;
      const to = clips.find((c) => c.start >= mid - 0.05 && c !== from) || clips.find((c) => c.end > end && c !== from) || null;
      return { from: describe(from), to: describe(to) };
    }

    /** Nearest cut (clip boundary on the video track) to `t`, or null. */
    function nearestCut(t) {
      const edges = baseClips().flatMap((c) => [c.start, c.end]).filter((x) => x > 0.2);
      if (!edges.length) return null;
      return edges.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), edges[0]);
    }

    function videoTrackName() {
      return (state.tracks.find((tr) => (tr.type || '').toLowerCase() === 'video') || state.tracks[0])?.name;
    }

    /** Add a stock video/image (Pixabay or Pexels) to the timeline at the playhead. */
    async function addStockToTimeline(item, kind) {
      const T = state.timelineSeconds || 60;
      const isVideo = kind === 'videos';
      const src = isVideo ? item.src : await importStockImage(item);
      if (!src) return;
      const duration = isVideo ? Math.min(30, Math.max(1, item.duration || 5)) : 5;
      const start = Math.min((state.playheadPercent / 100) * T, Math.max(0, T - duration));
      insertClipIntoTrack({
        id: Date.now(),
        name: item.name,
        type: isVideo ? 'video' : 'image',
        src,
        poster: item.thumbnail,
        fit: 'cover',
        start,
        end: Math.min(T, start + duration),
        source: item.source,
        credit: { user: item.user, pageURL: item.pageURL },
      }, videoTrackName());
      debouncedSave();
      showToast(`Added ${isVideo ? 'video' : 'image'} to the timeline`, 'success');
    }

    let stockBrowserMounted = false;
    function mountStockBrowser() {
      if (stockBrowserMounted || !els.stockBrowser) return;
      stockBrowserMounted = true;
      renderStockBrowser(els.stockBrowser, {
        search: (kind, source, query) => stockSearch(kind, source, query),
        onPick: (item, kind) => addStockToTimeline(item, kind),
      });
    }

    // Presets (upstream "combined"): save the overlays at the playhead as a
    // reusable group and drop them onto any video.
    function renderOverlayPresets() {
      const box = els.overlayPresets;
      if (!box) return;
      const presets = loadPresets();
      box.innerHTML = `
        <h4 class="addon-panel__heading">Presets</h4>
        <button type="button" class="mini-btn" data-preset-save style="width:100%">＋ Save overlays at playhead as preset</button>
        ${presets.length ? `<ul class="overlay-preset-list">${presets.map((p) => `
          <li><span class="overlay-preset-name" title="${escapeHtml(p.items.length)} overlay(s)">${escapeHtml(p.name)}</span>
            <button type="button" class="mini-btn" data-preset-insert="${escapeHtml(p.id)}">Add</button>
            <button type="button" class="mini-btn" data-preset-delete="${escapeHtml(p.id)}" aria-label="Delete preset ${escapeHtml(p.name)}">✕</button></li>`).join('')}</ul>`
          : '<p class="addon-field__hint">No presets yet. Arrange overlays (e.g. lower third + logo + sticker), put the playhead over them and save.</p>'}`;
    }

    function bindOverlayPresets() {
      els.overlayPresets?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const T = state.timelineSeconds || 60;
        const t = (state.playheadPercent / 100) * T;
        if (btn.dataset.presetSave !== undefined) {
          const name = window.prompt('Preset name', 'My preset');
          if (name === null) return;
          const preset = capturePreset(state.tracks, t, T, name);
          if (!preset) {
            showToast('No overlays under the playhead to save', 'info');
            return;
          }
          savePresets([preset, ...loadPresets()]);
          renderOverlayPresets();
          showToast(`Saved preset "${preset.name}" (${preset.items.length} overlay${preset.items.length === 1 ? '' : 's'})`, 'success');
        } else if (btn.dataset.presetInsert) {
          const preset = loadPresets().find((p) => p.id === btn.dataset.presetInsert);
          if (!preset) return;
          presetToClips(preset, t, T).forEach(({ trackName, ...clip }) => insertClipIntoTrack(clip, trackName || 'Text'));
          debouncedSave();
          showToast(`Added preset "${preset.name}"`, 'success');
        } else if (btn.dataset.presetDelete) {
          savePresets(loadPresets().filter((p) => p.id !== btn.dataset.presetDelete));
          renderOverlayPresets();
        }
      });
      renderOverlayPresets();
    }

    function overlaySignature(clip, profileId = getActivePersonalizationProfile()?.id || null) {
      return JSON.stringify([clip.addon, clip.left, clip.width, clip.id === state.selectedClipId, profileId]);
    }

    function renderOverlayLayer() {
      if (!els.viewerFrame && !els.previewStage) return;
      const layer = addonOverlayLayer();
      // With the Remotion engine the Player draws the overlays; this layer
      // keeps invisible hit boxes + selection handles at the same geometry.
      layer.classList.toggle('engine-on', !!remotionEngine);
      fitOverlayLayerToPlayer(layer);
      // Pixel size for overlay font sizing (see .addon-overlay-layer CSS).
      if (layer.clientWidth) {
        layer.style.setProperty('--ovl-w', `${layer.clientWidth}px`);
        layer.style.setProperty('--ovl-h', `${layer.clientHeight}px`);
      }
      const T = state.timelineSeconds || 60;
      const t = (state.playheadPercent / 100) * T;
      const active = activeOverlays(state.tracks, t, T);
      const activeIds = new Set(active.map((c) => String(c.id)));
      const existing = new Map();
      layer.querySelectorAll(`[data-overlay="${OVERLAY_TAG}"]`).forEach((el) => {
        if (el.dataset.leaving) return;
        existing.set(el.dataset.clipId, el);
      });
      // Leave: out-animation, then remove.
      existing.forEach((el, id) => {
        if (activeIds.has(id)) return;
        el.dataset.leaving = '1';
        if (el._detach) el._detach();
        const clip = allClips().find((c) => String(c.id) === id);
        playOutAndRemove(el, state.playing ? clip?.addon?.animation : null);
      });
      const profile = getActivePersonalizationProfile();
      const profileId = profile?.id || null;
      let previous = null;
      active.forEach((clip) => {
        const id = String(clip.id);
        const sig = overlaySignature(clip, profileId);
        let el = existing.get(id);
        if (el && el.dataset.sig !== sig) {
          if (el._detach) el._detach();
          destroyOverlayElement(el);
          el = null;
        }
        const isNew = !el;
        if (isNew) {
          el = buildOverlayElement(clip, { profile, editor: true });
          if (!el) return;
          el.dataset.sig = sig;
          el.addEventListener('click', (e) => {
            if (e.target.closest('a') && state.selectedClipId === clip.id) return;
            if (state.selectedClipId === clip.id) return;
            e.preventDefault();
            selectOverlayClip(clip.id);
          });
        }
        // Keep paint order: insert after the previous active overlay.
        const ref = previous ? previous.nextSibling : layer.firstChild;
        if (ref !== el) layer.insertBefore(el, ref);
        previous = el;
        if (isNew) {
          if (!remotionEngine) finishOverlayElement(el, { playing: state.playing });
          if (state.playing) playInAnimation(el, clip.addon?.animation);
          if (clip.id === state.selectedClipId) attachOverlayHandles(el, clip);
        }
      });
      if (remotionEngine) return;
      setOverlayPlaying(layer, state.playing);
      // Lower thirds follow the playhead frame-by-frame (scrubbing included).
      syncOverlayTime(layer, t, new Map(active.map((c) => {
        const r = clipTimeRange(c, T);
        const span = { start: r.start, duration: r.end - r.start };
        if (c.type === 'overlay-video-transition') Object.assign(span, transitionSources(r.start, r.end));
        return [String(c.id), span];
      })), { playing: state.playing });
    }

    function selectOverlayClip(clipId) {
      state.selectedClipId = clipId;
      renderTracks();
      showClipEditor(clipId);
    }

    function removeClipById(clipId) {
      state.tracks.forEach((t) => {
        const items = t.items || t.clips || [];
        const i = items.findIndex((c) => c.id === clipId);
        if (i >= 0) items.splice(i, 1);
      });
      if (state.selectedClipId === clipId) {
        state.selectedClipId = null;
        els.clipEditorContainer.innerHTML = '';
      }
      renderTracks();
      debouncedSave();
    }

    function attachOverlayHandles(el, clip) {
      const addon = getAddon(clip.type);
      const fullFrame = !addon.positioned;
      const detach = fullFrame
        ? attachDragResize(el, document.createElement('div'), { onDelete: () => removeClipById(clip.id) })
        : attachDragResize(el, addonOverlayLayer(), {
          geometry: clip.addon?.geometry,
          preserveRatio: !!addon.preserveRatio,
          onCommit: (g) => {
            clip.addon = { ...addonOptions(clip), geometry: g, position: 'custom' };
            el.dataset.sig = overlaySignature(clip);
            if (state.selectedClipId === clip.id) renderClipEditor(clip.id);
            debouncedSave();
          },
          onDelete: () => removeClipById(clip.id),
        });
      el._detach = detach;
      // Full-frame overlays: handles would be meaningless; keep only delete.
      if (fullFrame) el.querySelectorAll('.overlay-handle').forEach((h) => h.remove());
    }

    // Overlays panel: upstream toolbar sections BASIC and CREATIVE.
    function renderOverlaysPanel() {
      if (!els.overlayAddonList) return;
      const sections = {};
      OVERLAY_ADDONS.forEach((a) => {
        (sections[a.section] = sections[a.section] || []).push(
          `<button type="button" class="addon-panel__item" data-add-addon="${a.type}" title="${escapeHtml(a.description)}">
            ${a.iconSrc ? `<img src="${escapeHtml(a.iconSrc)}" alt="" />` : ''}<span>${escapeHtml(a.label)}</span>
          </button>`,
        );
      });
      els.overlayAddonList.innerHTML = ['Basic', 'Creative']
        .filter((name) => sections[name])
        .map((name) => `<div class="addon-panel__section"><h4 class="addon-panel__heading">${name}</h4><div class="addon-panel__grid">${sections[name].join('')}</div></div>`)
        .join('')
        + `<section class="pz-ui pz-panel" aria-label="Personalize">
            <span class="pz-label" style="margin:0">Personalize</span>
            <p class="pz-hint" style="margin:0">Layouts built from each contact's images in the Personalize window's image finder.</p>
            <div class="pz-layouts">
              ${PERSONALIZED_LAYOUTS.map((l) => `<button type="button" class="pz-layout" data-layout="${l.id}"${l.id === 'brand' ? ' data-brand-overlays="1"' : ''}>
                <strong><span aria-hidden="true">${l.icon}</span> ${escapeHtml(l.label)}</strong><span>${escapeHtml(l.description)}</span>
              </button>`).join('')}
            </div>
            <div class="pz-actions">
              <button type="button" class="pz-btn pz-btn-secondary" data-check-contacts="1" title="See every contact's images for this video">🗂️ Check contacts</button>
              <button type="button" class="pz-btn pz-btn-primary" data-all-video-ready="1" title="Clean up every contact image this video uses (background removal, fixes, Vision QA) on your OpenAI key">✨ Make images Video Ready</button>
            </div>
          </section>`;
      els.overlaysPanel?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-add-addon]');
        if (btn) addAddonAtPlayhead(btn.dataset.addAddon);
        const layout = e.target.closest('[data-layout]');
        if (layout) addLayout(layout.dataset.layout);
        if (e.target.closest('[data-check-contacts]')) openContactImageCheck();
        if (e.target.closest('[data-all-video-ready]')) makeAllVideoReady();
      });
    }

    // Smart Speech (upstream toolbar): a window for AI voice lines on the
    // Voiceover track, on the user's own MuAPI / OpenAI keys.
    function openSmartSpeech() {
      return openSmartSpeechModal({
        hasKey: (provider) => {
          const key = provider === 'openai' ? apiKeyManager.getOpenAIKey?.() : apiKeyManager.getMuapiKey?.();
          return !!key && key !== 'dev';
        },
        listClips: () => state.tracks.flatMap((t) => t.items || t.clips || []).filter((c) => c.tts),
        // Personalization Studio contacts (Personalize window + Find a Business details).
        listContacts: () => listContactProfiles(contactStore),
        tokens: TOKEN_DEFS.map((d) => [d.key, d.label]),
        resolveTokens: (text) => resolveOverlayText(text, getActivePersonalizationProfile()),
        toast: showToast,
        async generate(request) {
          const { generateAudio, persistAudio, probeDuration } = await import('../lib/editor/agent/audioGen.js');
          const remote = await generateAudio('tts', request);
          const url = await persistAudio(remote, { upload: uploadFileToStorage, name: 'speech' });
          return { url, duration: (await probeDuration(url)) || 3 };
        },
        add({ url, duration, tts, name }) {
          const T = state.timelineSeconds || 60;
          const start = Math.min((state.playheadPercent / 100) * T, Math.max(0, T - 0.5));
          const len = Math.max(0.5, Number(duration) || 3);
          if (start + len > T) {
            const next = Math.ceil(start + len + 1);
            state.tracks.forEach((t) => (t.items || []).forEach((c) => {
              if (typeof c.left === 'number') { c.left = (c.left * T) / next; c.width = (c.width * T) / next; }
            }));
            state.playheadPercent = ((state.playheadPercent || 0) * T) / next;
            state.timelineSeconds = next;
            drawRuler();
          }
          if (!state.tracks.some((t) => t.name === 'Voiceover')) {
            state.tracks.push({ id: `track-voiceover-${Date.now().toString(36)}`, type: 'audio', name: 'Voiceover', muted: false, solo: false, locked: false, items: [] });
          }
          saveStateSnapshot(state);
          const clip = { id: `speech-${Date.now().toString(36)}`, type: 'audio', role: 'voiceover', name, src: url, volume: 1, tts, start, end: start + len };
          insertClipIntoTrack(clip, 'Voiceover');
          scheduleEngineUpdate();
          debouncedSave();
          const voiced = Object.keys(tts.variants || {}).length;
          showToast(voiced ? `Personalized speech added: ${voiced} contact${voiced === 1 ? '' : 's'} voiced. Use personal links or Export one video per contact.` : 'Speech added to the Voiceover track', 'success');
          return clip;
        },
      });
    }

    // Blend Modes (upstream toolbar): full-frame looks on their own layer,
    // like upstream's blend tracks. Each is an editable Image/Wrapper clip.
    function renderBlendPanel() {
      if (!els.blendLibrary) return;
      els.blendLibrary.innerHTML = `
        <p class="blend-lib__hint">Click a look to add it at the playhead on its own layer. Change its blend mode and strength in the clip settings.</p>
        <label class="blend-lib__span"><input type="checkbox" id="blendWholeVideo" /> Cover the whole video</label>
        ${BLEND_CATEGORIES.map((cat) => `
          <div class="blend-lib__section">
            <h4 class="addon-panel__heading">${escapeHtml(cat.label)}</h4>
            <div class="blend-lib__grid">
              ${cat.items.map((item) => `
                <button type="button" class="blend-lib__tile" data-blend-id="${escapeHtml(item.id)}" title="${escapeHtml(`${item.label} · ${item.blendMode}`)}">
                  <span class="blend-lib__thumb" style="${escapeHtml(blendThumbStyle(item))}"></span>
                  <span class="blend-lib__label">${escapeHtml(item.label)}</span>
                  <span class="blend-lib__mode">${escapeHtml(item.blendMode)}</span>
                </button>`).join('')}
            </div>
          </div>`).join('')}
        <div class="blend-lib__section">
          <h4 class="addon-panel__heading">Light leak videos</h4>
          <button type="button" class="blend-lib__stock" data-add-addon="overlay-transition">🎞️ Search Pixabay &amp; Pexels light leaks, film burns and glitches</button>
        </div>`;
      els.blendLibrary.addEventListener('click', (e) => {
        const stock = e.target.closest('[data-add-addon]');
        if (stock) { addAddonAtPlayhead(stock.dataset.addAddon); return; }
        const tile = e.target.closest('[data-blend-id]');
        if (tile) addBlendLook(tile.dataset.blendId, { whole: root.querySelector('#blendWholeVideo')?.checked });
      });
    }

    function addBlendLook(id, { whole = false } = {}) {
      const mapped = blendItemToAddon(getBlendItem(id));
      if (!mapped) return null;
      const T = state.timelineSeconds || 60;
      const startSec = whole ? 0 : (state.playheadPercent / 100) * T;
      const clip = createAddonClip(mapped.type, { startSec, timelineSeconds: T });
      if (whole) clip.end = T;
      clip.addon = { ...clip.addon, ...mapped.options };
      clip.name = mapped.name;
      // A free "Blend" layer for this time span (new layer when it overlaps).
      const overlaps = (t) => (t.items || []).some((c) => {
        const r = clipTimeRange(c, T);
        return r.start < clip.end && clip.start < r.end;
      });
      let n = 1;
      let track = state.tracks.find((t) => t.name === 'Blend');
      while (track && overlaps(track)) {
        n += 1;
        const name = `Blend ${n}`;
        track = state.tracks.find((t) => t.name === name);
      }
      const name = n === 1 ? 'Blend' : `Blend ${n}`;
      if (!track) {
        track = { id: `track-blend-${Date.now().toString(36)}`, type: 'text', name, muted: false, solo: false, locked: false, items: [] };
        state.tracks.push(track);
      }
      saveStateSnapshot(state);
      insertClipIntoTrack(clip, name);
      showClipEditor(clip.id);
      scheduleEngineUpdate();
      debouncedSave();
      showToast(`${mapped.name.replace('Blend: ', '')} added (${getBlendItem(id).blendMode})`, 'success');
      return clip;
    }

    // Services the overlay settings form uses: uploads, the media library
    // and the personalization token list.
    // Pixabay + Pexels search through the existing server-side proxies
    // (/api/pixabay, /api/pexels) — the same ones Stock Media uses.
    const stockSearch = createStockSearch({
      pixabay: { searchImages: searchPixabayImages, searchVideos: searchPixabayVideos },
      pexels: { searchPhotos: searchPexelsPhotos, searchVideos: searchPexelsVideos },
    });

    /**
     * Pixabay doesn't allow permanent hotlinking of images, so a picked
     * Pixabay image is copied to the project's storage first. Pexels images
     * and all stock videos are used from their CDN.
     */
    async function importStockImage(item) {
      if (!item?.mustCopy) return item?.src;
      try {
        const res = await fetch(item.src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const file = new File([blob], `${item.id}.${ext}`, { type: blob.type || 'image/jpeg' });
        const url = await uploadFileToStorage(file);
        if (url) return url;
      } catch (err) {
        console.warn('[Stock] could not copy Pixabay image to storage', err);
      }
      showToast("Couldn't save a copy of this Pixabay image to your storage; using Pixabay's link for now, which may expire.", 'info');
      return item.src;
    }

    const addonEditorServices = {
      stockSources: STOCK_SOURCES,
      searchStock: (kind, source, query) => stockSearch(kind, source, query),
      importStockImage,
      tokens: TOKEN_DEFS.map((d) => [d.key, d.label]),
      stickers: STICKER_LIBRARY,
      animatedEmoji: ANIMATED_EMOJI,
      mediaImages: () => {
        const seen = new Set();
        return [...(state.mediaLibrary || []), ...(state.assets || []), ...(state.media || [])]
          .map((m) => ({ name: m.title || m.name || m.label || '', src: m.url || m.src || m.media?.url, type: m.type }))
          .filter((m) => m.src && (m.type === 'image' || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(m.src)))
          .filter((m) => (seen.has(m.src) ? false : seen.add(m.src)));
      },
      uploadFile: async (file) => {
        try {
          const url = await uploadFileToStorage(file);
          if (typeof url === 'string' && url) return url;
          if (url?.url) return url.url;
        } catch (err) {
          console.warn('[Overlays] upload failed, using a local preview URL', err);
        }
        showToast('Upload unavailable — using a local preview of the file (it will not be saved with the project)', 'info');
        const { localMediaUrl } = await import('../lib/editor/remotion/localMedia.js');
        return localMediaUrl(file);
      },
      onError: (err) => showToast(err?.message || 'Upload failed', 'error'),
      // Personalized Image: the selected contact's images from the
      // Personalize window's image finder.
      imageTokens: () => imageTokenChoices(getActivePersonalizationProfile()),
      contactLabel: () => {
        const p = getActivePersonalizationProfile();
        return p ? contactName(p) : '';
      },
      finderImages: () => listTimelineImageAssets(getActivePersonalizationProfile()),
      useFinderImage: (index) => useImageFinderImage(listTimelineImageAssets(getActivePersonalizationProfile())[index]),
      // The selected contact's image behind a Personalized Image's token.
      contactImage: (src) => {
        const profile = getActivePersonalizationProfile();
        const key = imageTokenOf(src);
        const asset = key ? assetForImageToken(profile, key) : null;
        if (!asset?.url) return null;
        return {
          url: asset.url,
          focus: asset.focus || null,
          videoReady: Boolean(asset.videoReady),
          busy: videoReadyBusy.has(asset.id),
          contact: contactName(profile),
          label: imageTokenChoices(profile).find((c) => c.key === key)?.label?.toLowerCase() || 'image',
        };
      },
      setImageFocus: (src, x, y) => {
        const key = imageTokenOf(src);
        const profile = getActivePersonalizationProfile();
        const asset = key ? assetForImageToken(profile, key) : null;
        if (!asset?.id) return;
        saveContactAsset(profile, asset.id, (a) => ({ ...a, focus: { x, y } }));
      },
      makeVideoReady: (src, redraw) => makeContactImageVideoReady(getActivePersonalizationProfile(), imageTokenOf(src), redraw),
    };

    // Update one saved image on a contact and refresh what shows it.
    function saveContactAsset(profile, assetId, updater) {
      if (!profile || !assetId) return null;
      const next = updatePersonalizationAsset(profile, assetId, updater);
      const saved = contactStore.saveProfile(next);
      try { renderOverlayLayer(); } catch { /* not mounted */ }
      scheduleEngineUpdate();
      return saved;
    }

    // "Make Video Ready" (the image finder's cleanup: background removal,
    // fixes, checked by Vision QA) for a contact's image, from the editor.
    // Runs on the user's own OpenAI key like the Personalize window.
    const videoReadyBusy = new Set();
    async function makeContactImageVideoReady(profile, key, redraw) {
      const asset = key ? assetForImageToken(profile, key) : null;
      if (!profile || !asset?.url || asset.videoReady || videoReadyBusy.has(asset.id)) return false;
      videoReadyBusy.add(asset.id);
      redraw?.();
      const business = profile.personalization?.business || {};
      try {
        const result = await makePersonalizationAssetVideoReady(asset, {
          businessContext: {
            businessName: business.businessName,
            industry: business.industry,
            productService: business.productService,
            brandDescription: business.brandDescription,
          },
        });
        const stored = await persistPersonalizationAssetVersion({
          sourceUrl: result.url,
          role: asset.role,
          name: `${asset.name || asset.role} — Video Ready`,
        });
        const fresh = contactStore.getProfile?.(profile.id) || profile;
        saveContactAsset(fresh, asset.id, (a) => ({
          ...a,
          ...result,
          url: stored.url,
          originalUrl: a.originalUrl || asset.url,
          luminance: undefined,
          versions: [...(Array.isArray(a.versions) ? a.versions : []), { id: `${a.id}:video-ready:${Date.now()}`, url: stored.url, type: 'video_ready', createdAt: new Date().toISOString() }],
        }));
        if (key === 'logoUrl') measureLogos([contactStore.getProfile?.(profile.id) || fresh]);
        showToast(`${contactName(profile)}'s ${key === 'avatarUrl' ? 'photo' : 'image'} is Video Ready`, 'success');
        return true;
      } catch (err) {
        const msg = err?.code === 'VISION_QA_REVIEW_REQUIRED'
          ? `Video Ready needs a review for ${contactName(profile)}: open the Personalize window's image finder to check it`
          : `Video Ready failed for ${contactName(profile)}: ${err?.message || err}`;
        showToast(msg, 'error');
        return false;
      } finally {
        videoReadyBusy.delete(asset.id);
        redraw?.();
      }
    }

    // Images the timeline's Personalized Images use, for every contact.
    function projectImageKeys() {
      return [...new Set(state.tracks.flatMap((t) => t.items || [])
        .filter((c) => c.type === 'overlay-personalized-image')
        .map((c) => imageTokenOf(c.addon?.src))
        .filter(Boolean))];
    }

    async function makeAllVideoReady() {
      const keys = projectImageKeys();
      if (!keys.length) {
        showToast('Add a Personalized Image (or a layout below) first', 'info');
        return;
      }
      const jobs = [];
      listContactProfiles(contactStore).forEach((p) => keys.forEach((key) => {
        const asset = assetForImageToken(p, key);
        if (asset?.url && !asset.videoReady) jobs.push([p, key]);
      }));
      if (!jobs.length) {
        showToast('Every contact image this video uses is already Video Ready', 'success');
        return;
      }
      let done = 0;
      for (const [p, key] of jobs) {
        showToast(`Making images Video Ready: ${done + 1} of ${jobs.length} (${contactName(p)})…`, 'info');
        if (await makeContactImageVideoReady(contactStore.getProfile?.(p.id) || p, key)) done += 1;
      }
      showToast(`${done} of ${jobs.length} images are now Video Ready${done < jobs.length ? ' — the rest need a look in the image finder' : ''}`, done === jobs.length ? 'success' : 'info');
    }

    // Logo brightness for the "Auto" backing plate, measured once per logo
    // and saved on the contact's image.
    const measuring = new Set();
    async function measureLogos(profiles = listContactProfiles(contactStore)) {
      for (const p of profiles) {
        const logo = assetForImageToken(p, 'logoUrl');
        if (!logo?.url || logo.luminance != null || measuring.has(logo.url)) continue;
        measuring.add(logo.url);
        const lum = await measureImageLuminance(logo.url);
        measuring.delete(logo.url);
        if (lum == null) continue;
        const fresh = contactStore.getProfile?.(p.id) || p;
        saveContactAsset(fresh, logo.id, (a) => ({ ...a, luminance: lum }));
      }
    }

    // Preview as: the contact whose details and images the preview shows.
    function renderContactSwitcher() {
      const select = root.querySelector('#previewContactSelect');
      if (!select) return;
      const contacts = listContactProfiles(contactStore);
      const current = getActivePersonalizationProfile()?.id || '';
      select.innerHTML = `<option value="">${contacts.length ? '👤 Preview as: no contact' : '👤 No contacts yet'}</option>${contacts.map((p) => `<option value="${escapeHtml(p.id)}"${p.id === current ? ' selected' : ''}>👤 ${escapeHtml(contactName(p))}</option>`).join('')}`;
      select.disabled = !contacts.length;
      if (!select.dataset.wired) {
        select.dataset.wired = '1';
        select.addEventListener('change', () => contactStore.selectContact(select.value || null));
      }
    }

    // A table of every contact's images for the slots this video uses.
    function openContactImageCheck() {
      const keys = projectImageKeys();
      const contacts = listContactProfiles(contactStore);
      if (!contacts.length) {
        showToast('Add contacts in the Personalize window first', 'info');
        return;
      }
      const cols = keys.length ? keys : ['logoUrl', 'avatarUrl', 'productImageUrl', 'ctaImageUrl'];
      const labels = Object.fromEntries(imageTokenChoices(null).map((c) => [c.key, c.label]));
      const { jobs, skipped } = planAiImages(cols, contacts);
      const rows = contacts.map((p) => `<tr><td><button type="button" class="pz-contact" data-preview-contact="${escapeHtml(p.id)}" title="Preview the video as ${escapeHtml(contactName(p))}">${escapeHtml(contactName(p))}</button></td>${cols.map((key) => {
        const asset = assetForImageToken(p, key);
        const url = asset?.url;
        if (!url) return `<td><span class="pz-chip pz-chip-warn">⚠ Missing</span>${AI_FILLABLE[key] ? '' : ''}</td>`;
        const review = asset.aiGenerated && asset.needsReview
          ? `<span class="pz-chip pz-chip-warn" title="${escapeHtml(asset.aiPrompt || 'AI-made image')}">AI · review</span>
             <button type="button" class="pz-btn pz-btn-secondary pz-btn-xs" data-ai-approve="${escapeHtml(p.id)}|${escapeHtml(asset.id)}">Approve</button>
             <button type="button" class="pz-btn pz-btn-secondary pz-btn-xs" data-ai-remove="${escapeHtml(p.id)}|${escapeHtml(asset.id)}">Remove</button>`
          : `${asset.aiGenerated ? '<span class="pz-chip">AI</span>' : ''}${asset.videoReady ? '<span class="pz-chip">✓ Ready</span>' : ''}`;
        return `<td><span class="pz-cell"><span class="pz-thumb" style="cursor:default;background-image:url(${escapeHtml(JSON.stringify(String(url)))})"></span>${review}</span></td>`;
      }).join('')}</tr>`).join('');
      const fillable = jobs.length
        ? `<div class="pz-card" style="flex-direction:row;align-items:center;justify-content:space-between;gap:12px">
            <span class="pz-hint" style="margin:0">${jobs.length} missing image${jobs.length === 1 ? '' : 's'} (${escapeHtml([...new Set(jobs.map((j) => j.label))].join(', '))}) can be made with AI from each contact's business details, on your OpenAI key. You review each one before sending. Logos, photos of people and CTA graphics are never generated.</span>
            <button type="button" class="pz-btn pz-btn-primary" data-ai-fill="1" style="flex:none">✨ Fill ${jobs.length} with AI</button>
          </div>`
        : '';
      const skippedNote = skipped.length
        ? `<p class="pz-hint">${skipped.length} missing image${skipped.length === 1 ? '' : 's'} can't be made with AI yet: add business details (name, industry or product/service) in the Personalize window's Business / Client tab.</p>`
        : '';
      openAdvancedModal(`
        <div class="pz-ui" data-contact-check>
          <p class="pz-hint" style="margin:0 0 8px">${keys.length ? 'The images this video uses, for every contact.' : 'No Personalized Images on the timeline yet: showing the main contact images.'} Click a name to preview the video as that contact.</p>
          ${fillable}${skippedNote}
          <p class="pz-hint" data-ai-progress hidden></p>
          <div style="max-height:56vh;overflow:auto"><table class="pz-table"><thead><tr><th>Contact</th>${cols.map((k) => `<th>${escapeHtml(labels[k] || k)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
        </div>
      `, 'Contact images');
      els.modalBody.querySelectorAll('[data-preview-contact]').forEach((b) => b.addEventListener('click', () => {
        contactStore.selectContact(b.dataset.previewContact);
        closeModal();
      }));
      const reviewAction = (attr, fn) => els.modalBody.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => {
        const [contactId, assetId] = b.getAttribute(attr).split('|');
        const profile = contactStore.getProfile?.(contactId);
        if (!profile) return;
        fn(profile, assetId);
        openContactImageCheck();
      }));
      reviewAction('data-ai-approve', (profile, assetId) => {
        saveContactAsset(profile, assetId, (a) => ({ ...a, needsReview: false, reviewedAt: new Date().toISOString() }));
        showToast('Approved', 'success');
      });
      reviewAction('data-ai-remove', (profile, assetId) => {
        contactStore.saveProfile(removePersonalizationAsset(profile, assetId));
        try { renderOverlayLayer(); } catch { /* not mounted */ }
        scheduleEngineUpdate();
        showToast('Removed', 'success');
      });
      els.modalBody.querySelector('[data-ai-fill]')?.addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        await fillMissingWithAi(jobs, (text) => {
          const el = els.modalBody.querySelector('[data-ai-progress]');
          if (el) { el.hidden = false; el.textContent = text; }
        });
        if (els.modalBody.querySelector('[data-contact-check]')) openContactImageCheck();
      });
    }

    // Shrink a generated image before upload (PNG → JPEG, longest side
    // 1600px): keeps the request well inside the function size limit.
    function compressDataUrl(dataUrl, { maxSide = 1600, quality = 0.9 } = {}) {
      return new Promise((resolve) => {
        if (!/^data:image\//.test(String(dataUrl))) { resolve(dataUrl); return; }
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * scale);
            canvas.height = Math.round(img.naturalHeight * scale);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch { resolve(dataUrl); }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    }

    // Generate each missing image (one at a time, on the user's OpenAI key),
    // store it, and save it on the contact marked "AI · needs review".
    async function fillMissingWithAi(jobs, onProgress) {
      let made = 0;
      const failures = [];
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        onProgress?.(`Making ${job.label} for ${job.contactName} (${i + 1} of ${jobs.length})…`);
        try {
          const result = await generateAiImage({ prompt: job.prompt, aspectRatio: job.aspectRatio, quality: 'medium', n: 1 });
          const url = result?.ok ? (result.assets?.[0]?.url || result.assets?.[0]?.src) : null;
          if (!url) throw new Error(result?.error || 'No image came back');
          const stored = await persistPersonalizationAssetVersion({
            sourceUrl: await compressDataUrl(url),
            role: job.role,
            name: `${job.label} (AI)`,
          });
          const profile = contactStore.getProfile?.(job.contactId);
          if (!profile) continue;
          const asset = markAiGenerated(createPersonalizationAsset({
            role: job.role,
            name: `${job.label[0].toUpperCase()}${job.label.slice(1)} (AI)`,
            url: stored.url,
            sourceType: 'AI_GENERATED',
            mimeType: stored.mimeType || 'image/jpeg',
          }), { prompt: job.prompt });
          contactStore.saveProfile(addPersonalizationAsset(profile, asset));
          made += 1;
        } catch (err) {
          const raw = String(err?.message || err);
          // Not signed in / no OpenAI key fails every job the same way: say
          // so plainly and stop early.
          if (/sign in/i.test(raw)) { failures.push('Sign in to save AI images to your contacts'); break; }
          if (/key/i.test(raw)) { failures.push(raw); break; }
          failures.push(`${job.contactName}: ${raw}`);
        }
      }
      try { renderOverlayLayer(); } catch { /* not mounted */ }
      scheduleEngineUpdate();
      const msg = `Made ${made} of ${jobs.length} images with AI${made ? ' — review them before sending' : ''}${failures.length ? `. ${failures[0]}` : ''}`;
      onProgress?.(msg);
      showToast(msg, failures.length && !made ? 'error' : 'success');
      return made;
    }

    // A picked image-finder image as a durable URL. Images found on the
    // business's website but not saved yet are saved to the contact first;
    // if that isn't possible (e.g. signed out) the website copy is used.
    async function useImageFinderImage(image) {
      if (!image) return null;
      if (image.saved || !image.discovered) return image.src;
      let profile = getActivePersonalizationProfile();
      try {
        const imported = await importDiscoveredAsset(image.discovered, {
          name: image.discovered.altText || image.discovered.category,
        });
        profile = addPersonalizationAsset(profile, imported);
        profile = setDiscoveredPersonalizationAssets(
          profile,
          (profile.personalization.discoveredAssets || []).map((candidate) => (
            candidate.id === image.discovered.id
              ? { ...candidate, importedAssetId: imported.id, selected: false, importError: null }
              : candidate
          )),
        );
        contactStore.saveProfile(profile);
        showToast('Saved to the contact\'s images', 'success');
        return imported.url;
      } catch (err) {
        showToast(`Using the website copy of this image (${err?.message || 'it could not be saved to the contact'})`, 'info');
        return image.src;
      }
    }

    // One-click personalized layouts (Overlays → Personalize): Logo + CTA
    // end card, presenter intro, product spotlight, opening frame. All built
    // from tokens, so every contact gets their own.
    function addLayout(layoutId) {
      const profile = getActivePersonalizationProfile();
      const layout = PERSONALIZED_LAYOUTS.find((l) => l.id === layoutId);
      if (!layout) return;
      if (!profile) {
        showToast('Select a contact in the Personalize window first', 'info');
        return;
      }
      const T = state.timelineSeconds || 60;
      const plan = buildLayoutPlan(layoutId, profile, { timelineSeconds: T, startSec: (state.playheadPercent / 100) * T });
      if (!plan.length) {
        showToast(`${contactName(profile)} has no logo, CTA graphic or CTA text yet. Add them in the Personalize window's image finder.`, 'info');
        return;
      }
      saveStateSnapshot(state);
      let last = null;
      plan.forEach((item) => {
        const clip = createAddonClip(item.type, { startSec: item.startSec, timelineSeconds: T });
        clip.start = item.startSec;
        clip.end = item.endSec;
        clip.addon = { ...clip.addon, ...item.addon };
        clip.name = item.name;
        insertClipIntoTrack(clip, getAddon(item.type)?.track || 'Text');
        last = clip;
      });
      if (last) showClipEditor(last.id);
      if (plan.some((i) => i.addon?.plate === 'auto')) measureLogos();
      scheduleEngineUpdate();
      debouncedSave();
      const missing = listContactProfiles(contactStore).filter((p) => plan.some((i) => {
        const key = imageTokenOf(i.addon?.src);
        return key && !resolveToken(p, key);
      })).length;
      showToast(`Added ${layout.label}${missing ? ` — ${missing} contact${missing === 1 ? ' has' : 's have'} no image for it yet (Check contacts)` : ''}`, missing ? 'info' : 'success');
    }

    // Settings panel for schema-driven addons (Skip / Pause / Loop). Mirrors
    // upstream's DefaultSettings "Basic" tab: Start (and End) time inputs
    // plus each plugin's manifest options, rendered from the descriptor.
    let activeAddonEditor = null;
    function renderSchemaAddonEditor(clip) {
      const addon = getAddon(clip.type);
      clip.addon = addonOptions(clip);
      const T = state.timelineSeconds || 60;
      const { start, end } = clipTimeRange(clip, T);
      const timing = addon.timing || ['start', 'end'];
      els.clipEditorContainer.innerHTML = `
        <div class="clip-editor addon-editor">
          <p class="addon-summary"><span aria-hidden="true">${addon.icon}</span> <strong>${escapeHtml(addon.label)}</strong> — ${escapeHtml(addon.description || '')}</p>
          <div class="clip-editor__section addon-timing">
            ${timing.includes('start') ? `<div class="clip-editor__field"><label for="addon-start">Start (seconds)</label><input id="addon-start" type="number" min="0" max="${T}" step="0.01" value="${start.toFixed(2)}" /></div>` : ''}
            ${timing.includes('end') ? `<div class="clip-editor__field"><label for="addon-end">End (seconds)</label><input id="addon-end" type="number" min="0" max="${T}" step="0.01" value="${end.toFixed(2)}" /></div>` : ''}
          </div>
          <div class="clip-editor__section" id="addonOptionsForm"></div>
          <button type="button" class="mini-btn" id="addon-delete" style="width:100%;margin-top:8px">Remove ${escapeHtml(addon.label)}</button>
        </div>
      `;
      const setTiming = (newStart, newEnd) => {
        const s0 = Math.max(0, Math.min(T, newStart));
        const e0 = Math.max(s0 + 0.1, Math.min(T, newEnd));
        clip.left = (s0 / T) * 100;
        clip.width = ((e0 - s0) / T) * 100;
        renderTracks();
        debouncedSave();
      };
      els.clipEditorContainer.querySelector('#addon-start')?.addEventListener('change', (e) => {
        const cur = clipTimeRange(clip, T);
        const v = Number(e.target.value) || 0;
        // Pause is a point event: moving it keeps its length.
        setTiming(v, timing.includes('end') ? cur.end : v + (cur.end - cur.start));
      });
      els.clipEditorContainer.querySelector('#addon-end')?.addEventListener('change', (e) => {
        const cur = clipTimeRange(clip, T);
        setTiming(cur.start, Number(e.target.value) || cur.end);
      });
      els.clipEditorContainer.querySelector('#addon-delete').addEventListener('click', () => {
        state.tracks.forEach((t) => {
          const items = t.items || t.clips || [];
          const i = items.findIndex((c) => c.id === clip.id);
          if (i >= 0) items.splice(i, 1);
        });
        state.selectedClipId = null;
        els.clipEditorContainer.innerHTML = '';
        renderTracks();
        updatePreview(null);
        debouncedSave();
      });
      activeAddonEditor?.destroy();
      activeAddonEditor = renderAddonEditor(els.clipEditorContainer.querySelector('#addonOptionsForm'), {
        fields: addon.fields,
        options: clip.addon,
        idPrefix: `addon-${clip.id}`,
        services: addonEditorServices,
        onFieldChange: addon.onFieldChange ? (key, next) => addon.onFieldChange(key, next) : undefined,
        onChange: (next) => {
          const prevDuration = clip.addon?.durationSec;
          clip.addon = next;
          if (addon.summary) clip.name = addon.summary(next);
          // Picking an overlay-transition video sizes the clip to the video.
          if (next.durationSec && next.durationSec !== prevDuration) {
            const T = state.timelineSeconds || 60;
            clip.width = Math.min(100 - clip.left, (next.durationSec / T) * 100);
          }
          renderTracks();
          if (addon.category !== 'overlay') updatePreview(clip);
          debouncedSave();
        },
      });
    }

    // Interactive panel: upstream toolbar sections "Video Controls" and
    // "Lead Generation" with upstream's icons and labels.
    function renderInteractivePanel() {
      if (!els.interactiveAddonList) return;
      const lb = state.listBuilder;
      const sections = {};
      INTERACTIVE_ADDONS.forEach((a) => {
        (sections[a.section] = sections[a.section] || []).push(
          `<button type="button" class="addon-panel__item" data-add-addon="${a.type}" title="${escapeHtml(a.description)}">
            ${a.iconSrc ? `<img src="${escapeHtml(a.iconSrc)}" alt="" />` : ''}<span>${escapeHtml(a.label)}</span>
          </button>`,
        );
      });
      PROJECT_FORMS.forEach((f) => {
        const on = lb?.enabled && lb.kind === f.kind;
        (sections[f.section] = sections[f.section] || []).push(
          `<button type="button" class="addon-panel__item${on ? ' is-on' : ''}" data-project-form="${f.kind}" aria-pressed="${on ? 'true' : 'false'}" title="${escapeHtml(f.label)} — shown at the start of the video">
            ${f.iconSrc ? `<img src="${escapeHtml(f.iconSrc)}" alt="" />` : ''}<span>${escapeHtml(f.label)}</span>
          </button>`,
        );
      });
      els.interactiveAddonList.innerHTML = ['Video Controls', 'Lead Generation']
        .filter((name) => sections[name])
        .map((name) => `<div class="addon-panel__section"><h4 class="addon-panel__heading">${name}</h4><div class="addon-panel__grid">${sections[name].join('')}</div></div>`)
        .join('');
    }

    let listBuilderEditor = null;
    function renderListBuilderSettings() {
      const box = els.listBuilderSettings;
      if (!box) return;
      const lb = state.listBuilder;
      if (!lb) {
        box.hidden = true;
        box.innerHTML = '';
        return;
      }
      box.hidden = false;
      box.innerHTML = `
        <div class="addon-panel__heading" style="display:flex;justify-content:space-between;align-items:center">
          <span>${lb.kind === 'personalizer' ? 'Personalizer' : 'List Builder'} settings</span>
          <span>
            <button type="button" class="mini-btn" id="lbPreview">Preview</button>
            <button type="button" class="mini-btn" id="lbDownload">Leads</button>
            <button type="button" class="mini-btn" id="lbRemove">Remove</button>
          </span>
        </div>
        <div id="lbForm"></div>`;
      listBuilderEditor?.destroy();
      listBuilderEditor = renderAddonEditor(box.querySelector('#lbForm'), {
        options: lb,
        fieldsFor: (o) => listBuilderFields(o),
        idPrefix: 'listbuilder',
        onChange: (next) => {
          const kindChanged = next.kind !== state.listBuilder.kind;
          state.listBuilder = kindChanged ? switchListBuilderKind(next, next.kind) : next;
          if (kindChanged) listBuilderEditor.setOptions(state.listBuilder);
          renderInteractivePanel();
          debouncedSave();
        },
      });
      box.querySelector('#lbPreview').addEventListener('click', () => openListBuilderOverlay({ preview: true }));
      box.querySelector('#lbRemove').addEventListener('click', () => {
        state.listBuilder = null;
        clearOverlay(addonOverlayLayer(), 'list-builder');
        renderInteractivePanel();
        renderListBuilderSettings();
        debouncedSave();
      });
      box.querySelector('#lbDownload').addEventListener('click', () => downloadLeadsCsv({
        clipId: 'list-builder', local: state.listBuilder?._localLeads || [], name: 'list_builder_leads',
      }));
    }

    function bindInteractivePanel() {
      if (!els.interactivePanel) return;
      els.interactivePanel.addEventListener('click', (e) => {
        const addBtn = e.target.closest('[data-add-addon]');
        if (addBtn) {
          addAddonAtPlayhead(addBtn.dataset.addAddon);
          return;
        }
        const formBtn = e.target.closest('[data-project-form]');
        if (formBtn) {
          const kind = formBtn.dataset.projectForm;
          // Upstream addRetargetForm: one form per project; picking the
          // other kind switches it.
          if (!state.listBuilder || state.listBuilder.kind !== kind) {
            state.listBuilder = { ...defaultListBuilder(kind), enabled: true };
          } else {
            state.listBuilder.enabled = true;
          }
          renderInteractivePanel();
          renderListBuilderSettings();
          openListBuilderOverlay({ preview: true });
          debouncedSave();
        }
      });
      renderInteractivePanel();
      renderListBuilderSettings();
    }

    // Add any registered addon as a clip starting at the playhead.
    function addAddonAtPlayhead(type) {
      const T = state.timelineSeconds || 60;
      let startSec = (state.playheadPercent / 100) * T;
      if (type === 'overlay-video-transition') {
        // Centre the blend on the nearest cut between two clips.
        const cut = nearestCut(startSec);
        const half = (getAddon(type).defaultDuration || 1) / 2;
        if (cut != null) startSec = Math.max(0, cut - half);
        else showToast('Tip: place Video Transitions over a cut between two clips', 'info');
      }
      const clip = createAddonClip(type, { startSec, timelineSeconds: T });
      const addon = getAddon(type);
      if (addon.summary) clip.name = addon.summary(addonOptions(clip));
      insertClipIntoTrack(clip, addon.track || 'Text');
      showClipEditor(clip.id);
      debouncedSave();
      return clip;
    }

    function addonOverlayLayer() {
      return ensureOverlayLayer(els.viewerFrame || els.previewStage.parentElement);
    }

    // Shared lead capture: stores via the lead-capture edge function, which
    // also forwards webhooks server-side; falls back to posting webhooks from
    // the browser if the backend is unreachable.
    async function captureLead({ clipId, kind, data, config, notificationEmail }) {
      const webhooks = webhookUrlsFor(config);
      const result = await submitLead(supabase, {
        projectId: state.projectId || currentTimelineId(state) || null,
        clipId,
        kind,
        data,
        webhooks,
        notificationEmail,
        preview: true,
      });
      if (result.error) {
        const direct = webhooks.length ? await postWebhooksDirect(webhooks, data) : { forwarded: 0, failed: 0 };
        return { stored: false, forwarded: direct.forwarded, failed: direct.failed, offline: true };
      }
      return result;
    }

    function leadResultMessage(res, emailConfigured) {
      const parts = [res.stored ? 'Lead saved' : 'Lead captured (preview only, not saved — sign in to store leads)'];
      if (res.forwarded || res.failed) {
        parts.push(res.failed ? `${res.failed} webhook(s) failed` : `sent to ${res.forwarded} webhook(s)`);
      }
      if (emailConfigured) parts.push('email notifications need an email provider (not connected yet)');
      return parts.join(' · ');
    }

    async function downloadLeadsCsv({ clipId, local = [], name = 'leads' }) {
      const stored = await fetchLeads(supabase, { projectId: state.projectId || currentTimelineId(state) || null, clipId });
      // Leads from the published video (/watch link) are filed under its id.
      const publishedId = (state.publishedVideos || {})[String(currentTimelineId(state) || 'default')];
      const viewers = publishedId ? await fetchLeads(supabase, { projectId: publishedId, clipId }) : [];
      const leads = mergeLeads(local, [...stored, ...viewers]);
      if (!leads.length) {
        showToast('No leads captured yet', 'info');
        return;
      }
      const blob = new Blob([leadsToCsv(leads)], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(name).replace(/[^a-z0-9]+/gi, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function personalizationPrefill() {
      const vars = getActivePersonalizationProfile()?.variables || {};
      return {
        EMAIL: vars.email,
        'FIRST NAME': vars.firstName,
        'LAST NAME': vars.lastName,
        COMPANY: vars.company,
      };
    }

    function openListBuilderOverlay({ preview = false } = {}) {
      const lb = state.listBuilder;
      if (!lb) return;
      const resume = () => {
        if (!preview && !state.playing) togglePlayback();
      };
      showListBuilderOverlay(addonOverlayLayer(), lb, {
        prefill: personalizationPrefill(),
        onSkip: resume,
        onSubmit: async (data) => {
          const res = await captureLead({
            clipId: 'list-builder',
            kind: lb.kind,
            data,
            config: lb.kind === 'personalizer' ? null : listBuilderWebhookConfig(lb),
            notificationEmail: lb.emailEnabled ? lb.emailAddress : '',
          });
          lb._localLeads = [...(lb._localLeads || []), { ...data, submittedAt: new Date().toISOString(), _stored: !!res.stored }];
          if (lb.kind === 'personalizer') {
            savePersonalizerProfile(data);
          } else {
            applyPreviewAnswers(data);
          }
          if (lb.fbPixelId && typeof window.fbq === 'function') {
            window.fbq('trackSingle', lb.fbPixelId, 'Lead', data);
          }
          if (!preview) lb._submitted = true;
          showToast(lb.kind === 'personalizer' ? 'Personalization applied — {{tokens}} now use these answers' : `${leadResultMessage(res, lb.emailEnabled && lb.emailAddress)} — {{tokens}} in the video now use these answers`, res.failed ? 'error' : 'success');
          resume();
          return '';
        },
      });
    }

    // Effects & Color (Remotion @remotion/effects), Captions and Keyframes
    // panels under the clip's settings.
    const EFFECT_CLIP_TYPES = new Set(['video', 'image', 'overlay-image', 'overlay-personalized-image', 'overlay-sticker']);
    const NO_KEYFRAME_TYPES = new Set(['audio', 'overlay-video-transition']);
    // eslint-disable-next-line no-var -- read by updatePlaybackUI before this line runs
    var activeEffectsPanel = null;
    // eslint-disable-next-line no-var -- read by updatePlaybackUI before this line runs
    var activeKeyframesPanel = null;
    // eslint-disable-next-line no-var -- read by updatePlaybackUI before this line runs
    var activeCaptionsPanel = null;
    // eslint-disable-next-line no-var -- read by updatePlaybackUI before this line runs
    var pendingAutoCaptions = null;
    // eslint-disable-next-line no-var -- background-removal jobs outlive the clip editor
    var bgJobs = new Map();
    // eslint-disable-next-line no-var
    var activeBgPanel = null;
    // eslint-disable-next-line no-var
    var editorClipId = null;
    const BG_REMOVAL_TYPES = new Set(['video', 'image', 'overlay-image']);
    const clipMediaSrc = (clip) => (clip.type === 'overlay-image' ? clip.addon?.src : clip.src);
    function setClipMediaSrc(clip, src) {
      if (clip.type === 'overlay-image') clip.addon = { ...(clip.addon || {}), src };
      else clip.src = src;
    }

    /** Remove a clip's background in the browser, store the result and swap it in (undoable). */
    function startBgRemoval(clip, settings) {
      const controller = new AbortController();
      const listeners = new Set();
      const job = {
        last: null,
        cancel: () => controller.abort(),
        subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      };
      const onProgress = (p) => { job.last = p; listeners.forEach((fn) => fn(p)); };
      job.done = (async () => {
        const m = await import('../lib/editor/remotion/bgRemoval.js');
        const src = clipMediaSrc(clip);
        if (!src) throw new Error('This clip has no media yet');
        const isVideo = clip.type === 'video';
        const fromSec = Number(clip.trimIn ?? clip.sourceStart ?? 0) || 0;
        const blob = isVideo
          ? await m.removeVideoBackground(src, { fromSec, toSec: fromSec + clipDurationSec(clip), ...settings, onProgress, signal: controller.signal })
          : await m.removeImageBackground(src, { edge: settings.edge, onProgress, signal: controller.signal });
        const file = new File([blob], `${String(clip.name || 'clip').replace(/[^\w-]+/g, '_')}-no-background.${isVideo ? 'webm' : 'png'}`, { type: blob.type });
        let url = null;
        try {
          const r = await uploadFileToStorage(file);
          url = typeof r === 'string' ? r : r?.url || null;
        } catch (err) {
          console.warn('[Background removal] upload failed, keeping a local copy', err);
        }
        if (!url) {
          const { localMediaUrl } = await import('../lib/editor/remotion/localMedia.js');
          url = localMediaUrl(blob);
          showToast('Background removed — kept for this session only (sign in to save the file with the project)', 'info');
        } else {
          showToast('Background removed', 'success');
        }
        saveStateSnapshot(state);
        clip.bgRemoval = { originalSrc: src, originalTrimIn: clip.trimIn ?? null, at: new Date().toISOString() };
        setClipMediaSrc(clip, url);
        if (isVideo) clip.trimIn = 0; // the new file starts where the clip started
        renderTracks();
        scheduleEngineUpdate();
        debouncedSave();
        if (editorClipId === clip.id) renderClipEditor(clip.id);
      })();
      job.done.catch((err) => {
        if (err?.name !== 'AbortError') showToast(`Background removal failed: ${err?.message || err}`, 'error');
      }).finally(() => bgJobs.delete(clip.id));
      bgJobs.set(clip.id, job);
      return job;
    }

    // ---------------------------------------------------------------
    // AI Video agent: the editor API its tools (and WebMCP) work through.
    function agentEditor() {
      const T = () => state.timelineSeconds || 60;
      const trackNameFor = (kind) => {
        if (kind === 'video') return videoTrackName();
        const t = state.tracks.find((tr) => (tr.type || '').toLowerCase() === kind);
        return t?.name || (kind === 'audio' ? 'Audio' : 'Text');
      };
      const profile = () => getActivePersonalizationProfile();
      return {
        snapshot: () => ({
          timelineSeconds: T(),
          playheadSec: playheadSec(),
          tracks: state.tracks.map((t) => ({ id: t.id, name: t.name, type: t.type, clips: t.items || t.clips || [] })),
        }),
        setTimelineSeconds(sec) {
          const T0 = T();
          // Clips are stored as % of the timeline; keep their times in seconds.
          allClips().forEach((c) => {
            if (typeof c.left === 'number') c.left = (c.left * T0) / sec;
            if (typeof c.width === 'number') c.width = (c.width * T0) / sec;
          });
          state.playheadPercent = Math.min(100, ((state.playheadPercent || 0) * T0) / sec);
          state.timelineSeconds = sec;
          drawRuler();
          updatePlaybackUI();
        },
        insertClip(clip, kind) {
          // A kind ('video' | 'audio' | 'text') or an exact track name ('Music').
          insertClipIntoTrack(clip, ['video', 'audio', 'text'].includes(kind) ? trackNameFor(kind) : kind);
          return clip;
        },
        ensureTrack(name, type) {
          let track = state.tracks.find((t) => t.name === name);
          if (!track) {
            track = { id: `track-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`, type, name, muted: false, solo: false, locked: false, items: [] };
            state.tracks.push(track);
          }
          return track;
        },
        async generateAudio(kind, params) {
          const { generateAudio, persistAudio, probeDuration } = await import('../lib/editor/agent/audioGen.js');
          const remote = await generateAudio(kind, params);
          const url = await persistAudio(remote, { upload: uploadFileToStorage, name: kind === 'tts' ? 'voiceover' : 'music' });
          return { url, duration: await probeDuration(url) };
        },
        createAddon(type, startSec, durationSec) {
          const clip = createAddonClip(type, { startSec, timelineSeconds: T() });
          clip.start = startSec;
          clip.end = Math.min(T(), startSec + durationSec);
          const addon = getAddon(type);
          if (addon?.summary) clip.name = addon.summary(addonOptions(clip));
          return clip;
        },
        getClip: (id) => allClips().find((c) => String(c.id) === String(id)) || null,
        clipTimes: (c) => ({ start: clipStartSec(c), end: clipStartSec(c) + clipDurationSec(c) }),
        setClipTimes(c, start, end) {
          c.left = (start / T()) * 100;
          c.width = ((end - start) / T()) * 100;
        },
        removeClip(id) {
          const c = allClips().find((x) => String(x.id) === String(id));
          if (!c) return false;
          removeClipById(c.id);
          return true;
        },
        commit() {
          renderTracks();
          scheduleEngineUpdate();
          debouncedSave();
        },
        searchStock: (kind, source, query) => stockSearch(kind, source, query),
        importStockImage,
        async transcribe(source, { language } = {}) {
          const { transcribeInBrowser, WHISPER_MODELS } = await import('../lib/editor/remotion/transcribe.js');
          const fromSec = Number(source.trimIn ?? source.sourceStart ?? 0) || 0;
          const model = navigator.gpu ? WHISPER_MODELS[0][0] : WHISPER_MODELS[1][0];
          const { captions } = await transcribeInBrowser(source.src, { fromSec, toSec: fromSec + clipDurationSec(source), language, model });
          return captions;
        },
        removeBackground: (clip) => (bgJobs.get(clip.id) || startBgRemoval(clip, { maskEvery: 2, edge: 0, maxSize: 1280 })).done,
        async renderStill(sec) {
          const { renderStill } = await import('../lib/editor/remotion/exportClient.js');
          const model = timelineToComposition(state, { fps: ENGINE_FPS, quality: '720p', profile: profile() });
          return renderStill(model, Math.round(sec * ENGINE_FPS));
        },
        async exportVideo({ container = 'mp4', quality = '1080p' } = {}) {
          const { exportModel, downloadBlob, EXTENSIONS } = await import('../lib/editor/remotion/exportClient.js');
          showToast('Exporting video…', 'info');
          const blob = await exportModel(timelineToComposition(state, { quality, profile: profile() }), { container, quality });
          const name = String(state.projectTitle || 'timeline').replace(/[^a-z0-9 _-]+/gi, '').trim() || 'timeline';
          const filename = `${name}.${EXTENSIONS[container] || 'mp4'}`;
          downloadBlob(blob, filename);
          showToast('Export complete — your video is downloading', 'success');
          return { filename };
        },
        confirm: (message) => Promise.resolve(window.confirm(message)),
      };
    }

    // eslint-disable-next-line no-var -- created on first use
    var agentToolsPromise = null;
    function getAgentTools() {
      agentToolsPromise ||= import('../lib/editor/agent/tools.js').then(({ createAgentTools }) => createAgentTools(agentEditor()));
      return agentToolsPromise;
    }

    // eslint-disable-next-line no-var
    var agentPanel = null;
    async function mountAgentPanel() {
      const host = root.querySelector('#aiAgentChat');
      if (agentPanel || !host) return;
      const [{ renderAgentPanel }, tools] = await Promise.all([import('../lib/editor/agent/agentPanel.js'), getAgentTools()]);
      if (agentPanel) return;
      const providers = (async () => {
        try {
          const token = await window.Clerk?.session?.getToken?.();
          const res = await fetch('/api/video-agent', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          const data = await res.json();
          // OpenAI runs on the user's own key (BYOK), checked when they send;
          // a key added in Settings later works without reloading.
          return data?.providers ? { ...data.providers, openai: true } : null;
        } catch {
          return null;
        }
      })();
      agentPanel = renderAgentPanel(host, {
        tools,
        providers,
        onTurnStart: () => saveStateSnapshot(state),
        onTurnEnd: () => { renderTracks(); scheduleEngineUpdate(); },
      });
    }

    /** WebMCP: let in-browser AI agents use the same tools (feature-detected). */
    async function initWebMcp() {
      if (typeof navigator === 'undefined' || !navigator.modelContext) return;
      const [{ registerWebMcpTools }, tools] = await Promise.all([import('../lib/editor/agent/webmcp.js'), getAgentTools()]);
      registerWebMcpTools(tools, {
        confirm: (message) => Promise.resolve(window.confirm(message)),
        onChange: () => saveStateSnapshot(state),
      });
    }

    // ---------------------------------------------------------------
    // Share: publish the timeline as an interactive video (/watch/<id>).
    // eslint-disable-next-line no-var -- created on first open
    var sharePanel = null;
    async function publishOwnerClient() {
      if (!window.Clerk?.user) throw new Error('Sign in to publish videos');
      await supabase.refreshUserHeader?.();
      if (!supabase.supabase) throw new Error('The video service is unavailable — check your connection');
      return supabase.supabase;
    }
    const publishedKey = () => String(currentTimelineId(state) || 'default');
    let scopesMounted = null;
    async function mountColorScopesPanel() {
      const host = root.querySelector('#colorScopesContainer');
      if (!host) return;
      if (scopesMounted) { scopesMounted.refresh(); return; }
      const { mountColorScopes } = await import('../lib/editor/colorScopes.js');
      scopesMounted = mountColorScopes(host, {
        getFrame: async () => {
          const hasMedia = state.tracks.some((t) => (t.items || t.clips || []).length);
          if (!hasMedia) return null;
          const { renderStill } = await import('../lib/editor/remotion/exportClient.js');
          const model = timelineToComposition(state, { fps: ENGINE_FPS, quality: '720p', profile: getActivePersonalizationProfile() });
          const sec = ((state.playheadPercent || 0) / 100) * (state.timelineSeconds || 60);
          const { blob } = await renderStill(model, Math.min(Math.max(0, model.durationInFrames - 1), Math.round(sec * ENGINE_FPS)));
          const bmp = await createImageBitmap(blob);
          const scale = Math.min(1, 480 / bmp.width);
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(bmp, 0, 0, c.width, c.height);
          return ctx.getImageData(0, 0, c.width, c.height);
        },
      });
    }
    async function mountSharePanel() {
      const host = root.querySelector('#shareBody');
      if (sharePanel || !host) return;
      const pub = await import('../lib/editor/publish/publishClient.js');
      const { renderSharePanel } = await import('../lib/editor/publish/sharePanel.js');
      const { localMediaBlob } = await import('../lib/editor/remotion/localMedia.js');
      const videoId = () => (state.publishedVideos || {})[publishedKey()] || null;
      sharePanel = renderSharePanel(host, {
        defaultTitle: state.projectTitle || 'Untitled video',
        async getInfo() {
          const id = videoId();
          if (!id || !window.Clerk?.user) return null;
          return pub.getMyVideo(await publishOwnerClient(), id);
        },
        async publish({ title }) {
          const client = await publishOwnerClient();
          const uploaded = await pub.uploadLocalMedia(state, { getBlob: localMediaBlob, upload: uploadFileToStorage });
          if (uploaded) {
            renderTracks();
            scheduleEngineUpdate();
          }
          const project = pub.preparePublishProject(state, { title });
          const id = videoId() || pub.makeSlug();
          const info = await pub.publishVideo(client, { id, project });
          state.publishedVideos = { ...(state.publishedVideos || {}), [publishedKey()]: id };
          debouncedSave();
          showToast('Published — copy the link to share it', 'success');
          return { ...info, published: true };
        },
        async setPublished(on) {
          await pub.setPublished(await publishOwnerClient(), videoId(), on);
          showToast(on ? 'Published' : 'Unpublished — the link no longer works', 'success');
        },
        async countLeads() {
          const leads = await fetchLeads(supabase, { projectId: videoId() });
          return Array.isArray(leads) ? leads.length : null;
        },
        copy: (text) => navigator.clipboard.writeText(text),
        personalLinks: (link) => {
          const tokens = projectTokens(state.tracks);
          const contacts = listContactProfiles(contactStore);
          const gaps = new Map(contactImageGaps(state, contacts).map((g) => [g.id, g.missing]));
          return contacts.map((p) => ({
            name: contactName(p),
            email: contactEmail(p),
            company: p?.contact?.company || p?.personalization?.business?.businessName || '',
            link: personalLink(link, p, tokens),
            // Images this contact's link can't show: none in the slot, or
            // stored only in this browser (data:/blob:).
            missing: gaps.get(p.id) || [],
            localImages: personalLinkIssues(p, tokens),
          }));
        },
        // Views / plays / finishes / CTA clicks / leads per contact.
        fetchStats: async () => pub.fetchVideoStats(await publishOwnerClient(), videoId()),
        contactLabel: (id) => {
          const p = contactStore.getProfile?.(id);
          return p ? contactName(p) : null;
        },
        downloadCsv: (rows) => {
          const blob = new Blob([linksCsv(rows)], { type: 'text/csv' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${String(state.projectTitle || 'video').replace(/[^\w-]+/g, '_')}-personal-links.csv`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        },
      });
    }

    function restoreBgRemoval(clip) {
      const info = clip.bgRemoval;
      if (!info) return;
      saveStateSnapshot(state);
      setClipMediaSrc(clip, info.originalSrc);
      if (clip.type === 'video') {
        if (info.originalTrimIn == null) delete clip.trimIn; else clip.trimIn = info.originalTrimIn;
      }
      delete clip.bgRemoval;
      renderTracks();
      scheduleEngineUpdate();
      debouncedSave();
      renderClipEditor(clip.id);
    }
    const timelineSec = () => state.timelineSeconds || 60;
    const clipStartSec = (clip) => ((Number(clip.left) || 0) / 100) * timelineSec();
    const clipDurationSec = (clip) => ((Number(clip.width) || 0) / 100) * timelineSec();
    const playheadSec = () => ((state.playheadPercent || 0) / 100) * timelineSec();
    function seekToSeconds(sec) {
      state.playheadPercent = Math.max(0, Math.min(100, (sec / timelineSec()) * 100));
      updatePlaybackUI();
    }
    function downloadText(name, text, mime) {
      const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    const isKeyframable = (clip) => {
      if (NO_KEYFRAME_TYPES.has(clip.type)) return false;
      const addon = isAddonType(clip.type) ? getAddon(clip.type) : null;
      if (addon && addon.category !== 'overlay') return false;
      if (clip.type === 'lead-form' || clip.type === 'click-to-call') return false;
      return true;
    };
    const editorSection = (cls, label) => {
      const host = document.createElement('section');
      host.className = `clip-editor__section ${cls}`;
      host.setAttribute('aria-label', label);
      els.clipEditorContainer.appendChild(host);
      return host;
    };
    function mediaSourcesForCaptions() {
      return allClips().filter((c) => (c.type === 'video' || c.type === 'audio') && c.src)
        .sort((a, b) => (a.left || 0) - (b.left || 0))
        .map((c) => ({ id: String(c.id), label: `${c.name || c.type} (${clipStartSec(c).toFixed(1)}s)` }));
    }

    // ── AI video clip per contact ───────────────────────────────────────
    // A video clip can be generated once per contact from one of their
    // images and a prompt with {{tokens}}; each contact's version plays for
    // them in the preview, exports and personal share links.
    const aiClipJobs = new Map(); // clipId → { done, total, current, stop }
    function renderAiClipSection(host, clip) {
      const cfg = aiClipConfig(clip);
      const contacts = listContactProfiles(contactStore);
      const job = aiClipJobs.get(clip.id);
      const made = contacts.filter((p) => cfg.variants[String(p.id)]?.url).length;
      const { jobs, skipped } = planClipJobs(cfg, contacts);
      const enabled = Boolean(clip.aiPerContact);
      host.innerHTML = `
        <span class="pz-label">Personalize with AI</span>
        ${!enabled ? `
          <p class="pz-hint" style="margin:0 0 8px">Make one version of this clip per contact, animated from their own image with a prompt that can use their details. Each contact sees their version in exports and on their personal link. Runs on your MuAPI key.</p>
          <button type="button" class="pz-btn pz-btn-secondary" data-ai-clip-enable>✨ Set up AI clip per contact</button>
        ` : `
          <div class="pz-card">
            <label class="pz-hint" style="margin:0">Animate each contact's
              <select data-ai-clip="imageKey" class="pz-select" style="margin-left:6px">${CLIP_IMAGE_SLOTS.map((sl) => `<option value="${sl.key}"${sl.key === cfg.imageKey ? ' selected' : ''}>${escapeHtml(sl.label)}</option>`).join('')}</select>
            </label>
            <label class="pz-hint" style="margin:0">Prompt (use {{tokens}} like {{businessName}})
              <textarea data-ai-clip="prompt" class="pz-token-code" rows="3" maxlength="600">${escapeHtml(cfg.prompt)}</textarea>
            </label>
            <div class="pz-actions">
              <select data-ai-clip="model" class="pz-select" aria-label="Video model">${AI_CLIP_MODELS.map((m) => `<option value="${m.id}"${m.id === cfg.model ? ' selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}</select>
              <select data-ai-clip="duration" class="pz-select" aria-label="Length">${[5, 10].map((d) => `<option value="${d}"${d === cfg.duration ? ' selected' : ''}>${d}s</option>`).join('')}</select>
            </div>
            <span class="pz-hint" style="margin:0">${made} of ${contacts.length} contact${contacts.length === 1 ? ' has' : 's have'} their version.${skipped.length ? ` ${skipped.length} can't yet: ${escapeHtml(skipped.slice(0, 3).map((x) => `${x.contactName} (${x.reason})`).join(', '))}${skipped.length > 3 ? '…' : ''}.` : ''}</span>
            ${job ? `<p class="pz-hint" style="margin:0">Generating ${job.done + 1} of ${job.total}${job.current ? ` · ${escapeHtml(job.current)}` : ''}… This can take a few minutes per clip.</p>
              <button type="button" class="pz-btn pz-btn-secondary" data-ai-clip-stop>Stop</button>` : `
              <div class="pz-actions">
                <button type="button" class="pz-btn pz-btn-primary" data-ai-clip-go ${jobs.length ? '' : 'disabled'}>✨ Generate ${jobs.length} clip${jobs.length === 1 ? '' : 's'}</button>
                ${made ? '<button type="button" class="pz-btn pz-btn-secondary" data-ai-clip-redo>Regenerate all</button>' : ''}
                <button type="button" class="pz-btn pz-btn-secondary" data-ai-clip-disable>Turn off</button>
              </div>`}
          </div>`}
      `;
      const save = () => { scheduleEngineUpdate(); debouncedSave(); };
      host.querySelector('[data-ai-clip-enable]')?.addEventListener('click', () => {
        saveStateSnapshot(state);
        clip.aiPerContact = { ...DEFAULT_CLIP_SETTINGS(), variants: {} };
        save();
        renderAiClipSection(host, clip);
      });
      host.querySelector('[data-ai-clip-disable]')?.addEventListener('click', () => {
        saveStateSnapshot(state);
        delete clip.aiPerContact;
        save();
        updatePreview();
        renderAiClipSection(host, clip);
      });
      host.querySelectorAll('[data-ai-clip]').forEach((el) => el.addEventListener('change', () => {
        const key = el.dataset.aiClip;
        clip.aiPerContact = { ...aiClipConfig(clip), [key]: key === 'duration' ? Number(el.value) : el.value };
        save();
        renderAiClipSection(host, clip);
      }));
      host.querySelector('[data-ai-clip-stop]')?.addEventListener('click', () => { aiClipJobs.get(clip.id)?.stop?.(); });
      const go = (redo) => generateClipsPerContact(clip, planClipJobs(aiClipConfig(clip), contacts, { redo }).jobs, () => {
        if (host.isConnected) renderAiClipSection(host, clip);
      });
      host.querySelector('[data-ai-clip-go]')?.addEventListener('click', () => go(false));
      host.querySelector('[data-ai-clip-redo]')?.addEventListener('click', () => go(true));
    }
    const DEFAULT_CLIP_SETTINGS = () => {
      const cfg = aiClipConfig({});
      delete cfg.variants;
      return cfg;
    };

    async function generateClipsPerContact(clip, jobs, redraw) {
      if (!jobs.length || aiClipJobs.has(clip.id)) return;
      const controller = new AbortController();
      const run = { done: 0, total: jobs.length, current: '', stop: () => controller.abort() };
      aiClipJobs.set(clip.id, run);
      redraw();
      const { default: muapi } = await import('../lib/muapi.js');
      let made = 0;
      let failure = '';
      for (const job of jobs) {
        if (controller.signal.aborted) break;
        run.current = job.contactName;
        redraw();
        try {
          const cfg = aiClipConfig(clip);
          const result = await muapi.generateI2V({
            model: cfg.model,
            prompt: job.prompt,
            image_url: job.imageUrl,
            aspect_ratio: cfg.aspectRatio,
            duration: cfg.duration,
            studioType: 'timeline-personalize',
          }, controller.signal);
          if (!result?.url) throw new Error('No video came back');
          // Keep a copy in SmartVideo storage when possible (provider links expire).
          let url = result.url;
          try {
            const res = await fetch(result.url);
            if (res.ok) {
              const blob = await res.blob();
              const stored = await uploadFileToStorage(new File([blob], `ai-clip-${job.contactId}.mp4`, { type: blob.type || 'video/mp4' }));
              const storedUrl = typeof stored === 'string' ? stored : stored?.url;
              if (storedUrl && !String(storedUrl).startsWith('blob:')) url = storedUrl;
            }
          } catch { /* keep the provider link */ }
          const fresh = aiClipConfig(clip);
          clip.aiPerContact = {
            ...fresh,
            variants: { ...fresh.variants, [job.contactId]: { url, prompt: job.prompt, model: fresh.model, at: new Date().toISOString(), name: job.contactName } },
          };
          made += 1;
          scheduleEngineUpdate();
          debouncedSave();
        } catch (err) {
          const raw = String(err?.message || err);
          if (/cancel/i.test(raw)) break;
          failure = /key/i.test(raw) ? 'Add your MuAPI key in Settings → API keys' : `${job.contactName}: ${raw}`;
          if (/key/i.test(raw)) break;
        }
        run.done += 1;
        redraw();
      }
      aiClipJobs.delete(clip.id);
      updatePreview();
      redraw();
      showToast(`Made ${made} of ${jobs.length} AI clips${failure ? `. ${failure}` : ''}`, failure && !made ? 'error' : 'success');
    }

    function renderClipEditor(clipId) {
      renderClipEditorBase(clipId);
      [activeEffectsPanel, activeKeyframesPanel, activeCaptionsPanel, activeBgPanel].forEach((p) => p?.destroy());
      activeEffectsPanel = activeKeyframesPanel = activeCaptionsPanel = activeBgPanel = null;
      editorClipId = clipId;
      const clip = allClips().find((c) => c.id === clipId);
      if (!clip) return;

      if (BG_REMOVAL_TYPES.has(clip.type) && (clipMediaSrc(clip) || clip.bgRemoval)) {
        const host = editorSection('clip-bg-removal', 'Remove background');
        Promise.all([import('../lib/editor/remotion/bgRemovalPanel.js'), import('../lib/editor/remotion/bgRemoval.js')])
          .then(async ([{ renderBgRemovalPanel }, { hasWebGpu }]) => {
            const gpu = await hasWebGpu();
            if (!host.isConnected) return;
            activeBgPanel = renderBgRemovalPanel(host, {
              kind: clip.type === 'video' ? 'video' : 'image',
              removed: !!clip.bgRemoval,
              gpu,
              job: bgJobs.get(clip.id),
              start: (settings) => startBgRemoval(clip, settings),
              onRestore: () => restoreBgRemoval(clip),
            });
          });
      }

      if (clip.type === 'video') {
        renderAiClipSection(editorSection('clip-ai-per-contact pz-ui', 'Personalize with AI'), clip);
      }

      if (clip.type === 'remotion-code') {
        const host = editorSection('clip-animation', 'Animation');
        import('../lib/editor/agent/animationPanel.js').then(({ renderAnimationPanel }) => {
          if (!host.isConnected) return;
          activeCaptionsPanel = renderAnimationPanel(host, {
            clip,
            onApply: ({ code, props }) => {
              saveStateSnapshot(state);
              clip.code = code;
              clip.props = props;
              delete clip.lastError;
              scheduleEngineUpdate();
              debouncedSave();
              showToast('Animation updated', 'success');
            },
            onCheck: async () => {
              const { renderStill } = await import('../lib/editor/remotion/exportClient.js');
              const mid = clipStartSec(clip) + clipDurationSec(clip) / 2;
              const model = timelineToComposition(state, { fps: ENGINE_FPS, quality: '720p', profile: getActivePersonalizationProfile() });
              try {
                const { blob, codeErrors } = await renderStill(model, Math.round(mid * ENGINE_FPS));
                const error = codeErrors?.[String(clip.id)] || null;
                if (error) clip.lastError = error; else delete clip.lastError;
                return { blob, error };
              } catch (err) {
                return { blob: null, error: err?.codeErrors?.[String(clip.id)] || err?.message };
              }
            },
          });
        });
      }

      if (clip.type === 'captions') {
        const host = editorSection('clip-captions', 'Captions');
        const auto = pendingAutoCaptions === clip.id;
        pendingAutoCaptions = null;
        import('../lib/editor/remotion/captionsPanel.js').then(({ renderCaptionsPanel }) => {
          if (!host.isConnected) return;
          activeCaptionsPanel = renderCaptionsPanel(host, {
            captions: clip.captions || [],
            style: clip.captionStyle,
            sources: mediaSourcesForCaptions(),
            selectedSource: clip.sourceClipId ? String(clip.sourceClipId) : undefined,
            autoTranscribe: auto,
            currentMs: () => Math.max(0, (playheadSec() - clipStartSec(clip)) * 1000),
            onSeek: (ms) => seekToSeconds(clipStartSec(clip) + ms / 1000),
            onDownload: (name, text, mime) => downloadText(`${(clip.name || 'captions').replace(/[^\w-]+/g, '_')}.${name.split('.').pop()}`, text, mime),
            onError: (err) => showToast(err?.message || 'Captions error', 'error'),
            onTranscribe: async ({ sourceId, model, language, onProgress, signal }) => {
              const source = allClips().find((c) => String(c.id) === sourceId);
              if (!source?.src) throw new Error('That clip has no media to transcribe');
              const { transcribeInBrowser } = await import('../lib/editor/remotion/transcribe.js');
              const fromSec = Number(source.trimIn ?? source.sourceStart ?? 0) || 0;
              const { captions } = await transcribeInBrowser(source.src, { fromSec, toSec: fromSec + clipDurationSec(source), model, language, onProgress, signal });
              if (!captions.length) throw new Error('No speech was found in that clip');
              // Line the captions clip up with the clip it was made from.
              saveStateSnapshot(state);
              clip.left = source.left;
              clip.width = source.width;
              clip.sourceClipId = source.id;
              renderTracks();
              showToast(`${captions.length} words transcribed`, 'success');
              return captions;
            },
            onChange: ({ captions, captionStyle }) => {
              clip.captions = captions;
              clip.captionStyle = captionStyle;
              const first = captions.slice(0, 5).map((c) => c.text).join('').trim();
              clip.name = first ? `Captions: ${first}${captions.length > 5 ? '…' : ''}` : 'Captions';
              scheduleEngineUpdate();
              debouncedSave();
            },
          });
        });
      }

      if (EFFECT_CLIP_TYPES.has(clip.type) && !(clip.type === 'overlay-sticker' && clip.addon?.kind === 'lottie')) {
        const host = editorSection('clip-effects', 'Effects and color');
        import('../lib/editor/remotion/effectsPanel.js').then(({ renderEffectsPanel }) => {
          if (!host.isConnected) return;
          activeEffectsPanel = renderEffectsPanel(host, {
            effects: clip.effects || [],
            onError: (err) => showToast(err?.message || 'Effect error', 'error'),
            onChange: (next) => {
              clip.effects = next;
              // Drop keyframes of effects that were removed.
              if (clip.keyframes) {
                const uids = new Set(next.map((fx) => fx.uid));
                Object.keys(clip.keyframes).forEach((k) => { const m = /^fx:([^:]+):/.exec(k); if (m && !uids.has(m[1])) delete clip.keyframes[k]; });
              }
              activeKeyframesPanel?.refresh();
              scheduleEngineUpdate();
              debouncedSave();
            },
          });
        });
      }

      if (isKeyframable(clip)) {
        // The new panel replaces the older keyframe controls in the base editor.
        els.clipEditorContainer.querySelector('#add-keyframe-btn')?.closest('.clip-editor__section')?.remove();
        const host = editorSection('clip-keyframes', 'Keyframes');
        import('../lib/editor/remotion/keyframesPanel.js').then(({ renderKeyframesPanel }) => {
          if (!host.isConnected) return;
          activeKeyframesPanel = renderKeyframesPanel(host, {
            clip,
            duration: clipDurationSec(clip),
            getTime: () => Math.max(0, Math.min(clipDurationSec(clip), playheadSec() - clipStartSec(clip))),
            onSeek: (t) => seekToSeconds(clipStartSec(clip) + t),
            onChange: (keyframes) => {
              saveStateSnapshot(state);
              if (Object.keys(keyframes).length) clip.keyframes = keyframes; else delete clip.keyframes;
              renderTracks();
              scheduleEngineUpdate();
              debouncedSave();
            },
          });
        });
      }
    }

    function renderClipEditorBase(clipId) {
      const clip = state.tracks.flatMap(t => t.items || t.clips || []).find(c => c.id === clipId);
      if (!clip) {
        els.clipEditorContainer.innerHTML = '<p>Clip not found</p>';
        return;
      }

      if (clip.type === 'lead-form') {
        renderLeadFormEditor(clip);
        return;
      }
      if (clip.type === 'click-to-call') {
        renderClickToCallEditor(clip);
        return;
      }
      if (isAddonType(clip.type) && !getAddon(clip.type).customEditor) {
        renderSchemaAddonEditor(clip);
        return;
      }

      els.clipEditorContainer.innerHTML = `
        <div class="clip-editor">
          <div class="clip-editor__section">
            <h3>Basic Properties</h3>
            <div class="clip-editor__field">
              <label for="clip-title" data-tooltip="The name displayed for this clip on the timeline">Clip Title</label>
              <input id="clip-title" type="text" value="${clip.name || ''}" placeholder="Enter clip title" data-tooltip="Edit the name of this clip" />
            </div>
            <div class="clip-editor__field">
              <label for="clip-start" data-tooltip="Where this clip begins on the timeline">Start Time (seconds)</label>
              <input id="clip-start" type="number" step="0.1" min="0" value="${clip.left || 0}" data-tooltip="Set the start time in seconds" />
            </div>
            <div class="clip-editor__field">
              <label for="clip-end" data-tooltip="Where this clip ends on the timeline">End Time (seconds)</label>
              <input id="clip-end" type="number" step="0.1" min="0" value="${(clip.left || 0) + (clip.width || 0)}" data-tooltip="Set the end time in seconds" />
            </div>
          </div>
           <div class="clip-editor__section">
             <h3>Keyframes</h3>
             <div class="clip-editor__field">
               <button id="add-keyframe-btn" class="mini-btn" style="width:100%">+ Add Keyframe at Playhead</button>
             </div>
             <div class="clip-editor__field">
               <label>Property</label>
               <select id="keyframe-property">
                 <option value="position-x">Position X</option>
                 <option value="position-y">Position Y</option>
                 <option value="scale">Scale</option>
                 <option value="rotation">Rotation</option>
                 <option value="opacity">Opacity</option>
                 <option value="blur">Blur</option>
                 <option value="crop-top">Crop Top</option>
                 <option value="crop-bottom">Crop Bottom</option>
               </select>
             </div>
             <div class="clip-editor__field">
               <label>Easing</label>
               <select id="keyframe-easing">
                 <option value="linear">Linear</option>
                 <option value="ease-in-quad">Ease In Quad</option>
                 <option value="ease-out-quad">Ease Out Quad</option>
                 <option value="ease-in-out-quad">Ease In-Out Quad</option>
                 <option value="ease-in-cubic">Ease In Cubic</option>
                 <option value="ease-out-cubic">Ease Out Cubic</option>
                 <option value="bounce">Bounce</option>
                 <option value="elastic">Elastic</option>
               </select>
             </div>
           </div>

           <div class="clip-editor__section">
             <h3>Transitions</h3>
             <div class="clip-editor__field">
               <label>Transition to Next Clip</label>
               <select id="clip-transition" data-tooltip="Choose transition effect after this clip">
                 <option value="">None</option>
                 <option value="fade">Fade</option>
                 <option value="dissolve">Dissolve</option>
                 <option value="wipe-left">Wipe Left</option>
                 <option value="wipe-right">Wipe Right</option>
                 <option value="wipe-up">Wipe Up</option>
                 <option value="wipe-down">Wipe Down</option>
                 <option value="zoom-in">Zoom In</option>
                 <option value="zoom-out">Zoom Out</option>
                 <option value="blur">Blur</option>
               </select>
             </div>
             <div class="clip-editor__field">
               <label>Duration (s)</label>
               <input id="clip-transition-duration" type="number" step="0.1" min="0.1" max="3" value="0.5" />
             </div>
           </div>

           <div class="clip-editor__section">
             <h3>Audio Controls</h3>
            <div class="clip-editor__field">
              <label for="clip-volume">Volume: ${Math.round((clip.volume || 1) * 100)}%</label>
              <input id="clip-volume" type="range" min="0" max="1" step="0.01" value="${clip.volume || 1}" data-tooltip="Adjust clip volume from 0% to 100%" />
            </div>
            <div class="clip-editor__field">
              <button id="clip-mute" type="button" data-tooltip="${clip.mute ? 'Unmute this clip' : 'Mute this clip to silence it'}">${clip.mute ? 'Unmute' : 'Mute'}</button>
            </div>
          </div>
          <div class="clip-editor__section">
            <h3>Visual Controls</h3>
            <div class="clip-editor__field">
              <button id="clip-visibility" type="button" data-tooltip="${clip.hidden ? 'Make clip visible on timeline' : 'Hide clip from timeline view'}">${clip.hidden ? 'Show' : 'Hide'}</button>
            </div>
            <div class="clip-editor__field">
              <label for="clip-fill" data-tooltip="How the clip fits within its frame">Fill Mode</label>
              <select id="clip-fill" data-tooltip="Choose how the clip scales to fit">
                <option value="scale" ${clip.fit === 'contain' ? 'selected' : ''}>Scale to Fit</option>
                <option value="fit" ${clip.fit !== 'contain' ? 'selected' : ''}>Fit</option>
              </select>
            </div>
          </div>
        </div>
      `;

      // Add event listeners
      els.clipEditorContainer.querySelector('#clip-title').addEventListener('input', (e) => {
        clip.name = e.target.value;
        renderTracks();
      });
      els.clipEditorContainer.querySelector('#clip-start').addEventListener('input', (e) => {
        const newStart = parseFloat(e.target.value);
        clip.left = Math.max(0, newStart);
        renderTracks();
      });
      els.clipEditorContainer.querySelector('#clip-end').addEventListener('input', (e) => {
        const newEnd = parseFloat(e.target.value);
        clip.width = Math.max(0, newEnd - (clip.left || 0));
        renderTracks();
      });
      els.clipEditorContainer.querySelector('#clip-volume').addEventListener('input', (e) => {
        clip.volume = parseFloat(e.target.value);
        e.target.previousElementSibling.textContent = `Volume: ${Math.round(clip.volume * 100)}%`;
      });
      els.clipEditorContainer.querySelector('#clip-mute').addEventListener('click', () => {
        clip.mute = !clip.mute;
        e.target.textContent = clip.mute ? 'Unmute' : 'Mute';
      });
      els.clipEditorContainer.querySelector('#clip-visibility').addEventListener('click', () => {
        clip.hidden = !clip.hidden;
        e.target.textContent = clip.hidden ? 'Show' : 'Hide';
        renderTracks();
      });
       const transSelect = els.clipEditorContainer.querySelector('#clip-transition');
       if (transSelect) {
         transSelect.value = clip.transition?.type || '';
         transSelect.onchange = () => {
           clip.transition = clip.transition || {};
            clip.transition.type = transSelect.value;
            if (timelineTransitions) timelineTransitions.updateClipTransition(clip.id, clip.transition);
            renderTracks();
         };
       }
       // Keyframe controls
       const addKfBtn = els.clipEditorContainer.querySelector('#add-keyframe-btn');
       if (addKfBtn && state.keyframeSystem) {
         addKfBtn.onclick = () => {
           const prop = els.clipEditorContainer.querySelector('#keyframe-property').value;
           const easing = els.clipEditorContainer.querySelector('#keyframe-easing').value;
           const time = (state.playheadPercent / 100) * (state.timelineSeconds || 60);
           state.keyframeSystem.addKeyframe(clip.id, prop, time, clip[prop] ?? 0, easing);
           console.log(`Keyframe added for ${prop} (${easing})`);
           renderTracks();
         };
       }

       const transDur = els.clipEditorContainer.querySelector('#clip-transition-duration');
       if (transDur) {
         transDur.value = clip.transition?.duration || 0.5;
         transDur.onchange = () => {
           clip.transition = clip.transition || {};
            clip.transition.duration = parseFloat(transDur.value);
            renderTracks();
         };
       }

       els.clipEditorContainer.querySelector('#clip-fill').addEventListener('change', (e) => {
        clip.fit = e.target.value === 'fit' ? 'contain' : 'cover';
        renderTracks();
      });
    }

    function initializeTransitionEditor() {
      if (!transitionEditor) {
        transitionEditor = new TransitionEditor(els.transitionEditorContainer, (transition, params, duration) => {
          if (duration === undefined) return; // a selection, not Apply
          applyTransitionAtCut(transition, duration);
        }, () => removeTransitionAtCut(), { toast: showToast });
      }
    }

    // The Transitions Panel's library names → the Video Transition the player and export use.
    const PANEL_TRANSITION_MAP = {
      dissolve: 'dissolve', wipeLeft: 'wipeLeft', wipeRight: 'wipeRight', wipeUp: 'wipeUp', wipeDown: 'wipeDown', wipeDiagonal: 'angular',
      pushLeft: 'Directional', pushRight: 'splitSlideInHorizontal', pushUp: 'splitSlideInVertical', pushDown: 'TopBottom',
      zoomIn: 'SimpleZoom', zoomOut: 'SimpleZoomOut', zoomPan: 'CrossZoom',
      irisCircle: 'circleopen', irisDiamond: 'Rectangle', irisSquare: 'Rectangle', shapeStar: 'StarWipe', shapeHeart: 'heart', shapeCustom: 'circle',
    };
    function applyTransitionAtCut(transition, duration) {
      const T = state.timelineSeconds || 60;
      const playSec = (state.playheadPercent / 100) * T;
      const cut = nearestCut(playSec);
      if (cut == null) { showToast('Add two clips next to each other first, then move the playhead near the cut.', 'info'); return; }
      const addon = getAddon('overlay-video-transition');
      const seconds = Math.min(10, Math.max(0.3, Number(duration) || addon.defaultDuration || 1));
      const startSec = Math.max(0, cut - seconds / 2);
      const clip = createAddonClip('overlay-video-transition', { startSec, timelineSeconds: T });
      clip.start = startSec;
      clip.end = Math.min(T, startSec + seconds);
      clip.addon = { ...clip.addon, transition: PANEL_TRANSITION_MAP[transition.key] || 'fade' };
      if (addon.summary) clip.name = addon.summary(addonOptions(clip));
      saveStateSnapshot(state);
      insertClipIntoTrack(clip, addon.track || 'Text');
      scheduleEngineUpdate();
      debouncedSave();
      showToast(`${transition.name} added at the cut near ${cut.toFixed(1)}s`, 'success');
    }
    function removeTransitionAtCut() {
      const clip = findSelectedClip();
      if (!clip || clip.type !== 'overlay-video-transition') { showToast('Select a transition on the timeline to remove it.', 'info'); return; }
      saveStateSnapshot(state);
      state.tracks.forEach((t) => { t.items = (t.items || []).filter((c) => c !== clip); });
      state.selectedClipId = null;
      renderTracks();
      scheduleEngineUpdate();
      debouncedSave();
    }

    function initializeTimelineTransitions() {
      if (!timelineTransitions) {
        timelineTransitions = new TimelineTransitions(els.timelineBody, state);
      }
    }

    function initializeSceneDetector() {
      if (!sceneDetector && els.sceneDetectorContainer) {
        sceneDetector = new SceneDetector(els.sceneDetectorContainer, {
          getTracks: () => state.tracks,
          getTimelineSeconds: () => state.timelineSeconds,
          get selectedClipId() { return state.selectedClipId; },
          clipStartSec: (clip) => clipTimeRange(clip, state.timelineSeconds || 60).start,
          seekTo: (time) => {
            state.playheadPercent = (time / state.timelineSeconds) * 100;
            renderPlayhead();
            renderPreview();
          }
        }, {
          showToast: showToast
        });
      }
    }

    function initializeCameraEffects() {
      if (!cameraEffects && els.cameraEffectsContainer) {
        cameraEffects = new CameraEffects(els.cameraEffectsContainer, {
          timelineState: state,
          getClip: (id) => state.tracks.flatMap((t) => t.items || t.clips || []).find((c) => c.id === id),
          clipDuration: (clip) => { const { start, end } = clipTimeRange(clip, state.timelineSeconds || 60); return Math.max(0.1, end - start); },
          applyKeyframes: (clipId, byProp) => {
            const clip = state.tracks.flatMap((t) => t.items || t.clips || []).find((c) => c.id === clipId);
            if (!clip) return;
            saveStateSnapshot(state);
            let kf = { ...(clip.keyframes || {}) };
            Object.entries(byProp).forEach(([prop, list]) => {
              delete kf[prop];
              list.forEach((k) => { kf = setKeyframe(kf, prop, k.t, k.v, k.easing); });
            });
            clip.keyframes = kf;
          },
          onPreviewUpdate: () => {},
          onKeyframeUpdate: () => { renderTracks(); scheduleEngineUpdate(); debouncedSave(); },
          onMessage: (msg, kind) => showToast(msg, kind),
        });
      }
    }

    function initializeAIChatPanel() {
      if (!aiChatPanel && els.aiChatContainer) {
        aiChatPanel = new AIChatPanel(els.aiChatContainer, state, {
          detectScenes: async () => {
            initializeSceneDetector();
            if (sceneDetector && sceneDetector.detectScenes) {
              await sceneDetector.detectScenes();
            }
          },
          splitClipAtPlayhead: () => {
            // Find selected clip and split it
            const selectedTrack = state.tracks.find(t => t.id === state.selectedTrackId);
            if (selectedTrack) {
              const selectedClip = selectedTrack.clips.find(c => c.id === state.selectedClipId);
              if (selectedClip) {
                const splitTime = (state.playheadPercent / 100) * state.timelineSeconds;
                // Implement split logic here
                showToast('Clip split functionality to be implemented', 'info');
              }
            }
          },
          trimSelectedClip: (start, end) => {
            // Implement trim logic
            showToast('Trim clip functionality to be implemented', 'info');
          },
          addTransition: (type, duration) => {
            // Implement add transition logic
            showToast(`Add ${type} transition functionality to be implemented`, 'info');
          },
          addTextOverlay: (text, position) => {
            // Implement add text overlay logic
            showToast('Add text overlay functionality to be implemented', 'info');
          },
          generateSubtitles: async () => {
            // Implement subtitle generation
            showToast('Subtitle generation functionality to be implemented', 'info');
          },
          removeFillerWords: () => {
            // Implement filler word removal
            showToast('Remove filler words functionality to be implemented', 'info');
          },
          addBRoll: (query) => {
            // Implement B-roll addition
            showToast('Add B-roll functionality to be implemented', 'info');
          },
          speedRamp: (speed) => {
            // Implement speed ramp
            showToast(`Speed ramp to ${speed}x functionality to be implemented`, 'info');
          },
          stabilizeVideo: () => {
            // Implement video stabilization
            showToast('Video stabilization functionality to be implemented', 'info');
          },
          findRelatedFootage: async (query) => {
            // Implement semantic search
            showToast('Find related footage functionality to be implemented', 'info');
            return [];
          }
        });
      }
    }

    // function initializeColorCorrectionSystem() { // Disabled - ColorCorrectionSystem not available
    //   if (!colorCorrectionSystem) {
    //     // Create a keyframe system for color correction
    //     const { KeyframeSystem } = require('../lib/editor/keyframeSystem.js');
    //     const keyframeSystem = new KeyframeSystem();
    //
    //     colorCorrectionSystem = new ColorCorrectionSystem(els.timelineBody, state, keyframeSystem);
    //
    //     // Add color correction panel to DOM
    //     const colorPanel = colorCorrectionSystem.getPanel();
    //     if (colorPanel && els.colorCorrectionContainer) {
    //       els.colorCorrectionContainer.appendChild(colorPanel);
    //     }
    //
    //     // Add color scopes panel to DOM
    //     const scopesPanel = colorCorrectionSystem.getScopes();
    //     if (scopesPanel && els.colorScopesContainer) {
    //       els.colorScopesContainer.appendChild(scopesPanel);
    //     }
    //   }
    // }



    function applyAIModifications(modifications) {
      if (!modifications) return;

      saveStateSnapshot(state);

      // Apply playhead changes
      if (modifications.playheadPercent !== undefined) {
        state.playheadPercent = Math.max(0, Math.min(100, modifications.playheadPercent));
      }

      // Apply zoom changes
      if (modifications.zoom !== undefined) {
        state.zoom = Math.max(0.5, Math.min(2, modifications.zoom));
      }

      // Apply clip modifications
      if (modifications.clipChanges) {
        modifications.clipChanges.forEach(change => {
          const track = state.tracks.find(t => t.id === change.trackId);
          if (track) {
            const clip = track.clips.find(c => c.id === change.clipId);
            if (clip) {
              Object.assign(clip, change.updates);
            }
          }
        });
      }

      // Apply track modifications
      if (modifications.trackChanges) {
        modifications.trackChanges.forEach(change => {
          const track = state.tracks.find(t => t.id === change.trackId);
          if (track) {
            Object.assign(track, change.updates);
          }
        });
      }

      // Add new clips
      if (modifications.newClips) {
        modifications.newClips.forEach(clipData => {
          const track = state.tracks.find(t => t.name === clipData.trackName);
          if (track) {
            track.clips.push(clipData.clip);
            state.selectedClipId = clipData.clip.id;
          }
        });
      }

      renderAll();
    }

    function renderKeyframes() {
      // Keyframe rendering is handled by the timeline renderer
      // This function is called when keyframes are updated
    }



    // Floating rail action functionality
    function deleteSelectedClip() {
      const selectedId = window.timelineState?.selectedClipId;
      if (!selectedId) return;

      saveStateSnapshot(state);
      
      state.project.tracks.forEach(track => {
        track.items = (track.items || []).filter(item => item.id !== selectedId);
      });
      
      window.timelineState.selectedClipId = null;
      renderTracks();
      
    }

    function duplicateSelectedClip() {
      const selectedId = window.timelineState?.selectedClipId;
      if (!selectedId) return;

      saveStateSnapshot(state);

      for (const track of state.project.tracks) {
        const clip = (track.items || []).find(item => item.id === selectedId);
        if (clip) {
          const newClip = {
            ...clip,
            id: `clip-${Date.now()}`,
            start: clip.start + (clip.duration || 5) + 0.5,
            end: clip.end + (clip.duration || 5) + 0.5
          };
          track.items.push(newClip);
          window.timelineState.selectedClipId = newClip.id;
          break;
        }
      }
      
      renderTracks();
      
    }

    function splitClipAtPlayhead() {
      const selectedClip = findSelectedClip();
      if (!selectedClip) {
        return;
      }

      saveStateSnapshot(state);

      const track = state.tracks.find(t => t.clips.some(c => c.id === selectedClip.id));
      if (!track) return;

      const clipIndex = track.clips.findIndex(c => c.id === selectedClip.id);
      const splitPosition = (state.playheadPercent / 100) * 100; // Convert to clip width percentage

      if (splitPosition <= selectedClip.left || splitPosition >= selectedClip.left + selectedClip.width) {
        return;
      }

      // Create two new clips from the split
      const leftClip = {
        ...selectedClip,
        id: Date.now(),
        width: splitPosition - selectedClip.left
      };

      const rightClip = {
        ...selectedClip,
        id: Date.now() + 1,
        left: splitPosition,
        width: (selectedClip.left + selectedClip.width) - splitPosition
      };

      // Replace the original clip with the two new ones
      track.clips.splice(clipIndex, 1, leftClip, rightClip);
      state.selectedClipId = leftClip.id;

      renderTracks();
      updatePreview();
    }

    async function detectScenes() {
      if (sceneDetector) {
        await sceneDetector.detectScenes();
      } else {
        // Fallback: fallback block removed to avoid unterminated catch — use sceneDetector fallback above.
      }
    }

    // Fallback: subtitle generation requires a real transcription service
    let subtitleTrack = state.project.tracks.find(t => t.type === 'subtitle' || t.type === 'text');
    if (!subtitleTrack) {
      state.addTrack('Text');
      subtitleTrack = state.project.tracks.find(t => t.type === 'text');
    }

    renderTracks();

    /** Captions: add a captions clip and transcribe the selected (or first) media clip in the browser. */
    async function generateSubtitles() {
      const selected = findSelectedClip();
      if (selected?.type === 'captions') { showClipEditor(selected.id); return; }
      const media = allClips().filter((c) => (c.type === 'video' || c.type === 'audio') && c.src);
      const source = selected && media.includes(selected) ? selected : media.sort((a, b) => (a.left || 0) - (b.left || 0))[0];
      const { defaultCaptionStyle } = await import('../lib/editor/remotion/captions.js');
      saveStateSnapshot(state);
      const startSec = source ? clipStartSec(source) : playheadSec();
      const clip = {
        id: `captions-${Date.now()}`,
        type: 'captions',
        name: 'Captions',
        captions: [],
        captionStyle: defaultCaptionStyle('tiktok'),
        sourceClipId: source?.id ?? null,
        start: startSec,
        end: startSec + (source ? clipDurationSec(source) : Math.min(10, timelineSec() - startSec)),
      };
      const textTrack = state.tracks.find((t) => (t.type || '').toLowerCase() === 'text') || state.tracks.find((t) => t.name === 'Text');
      insertClipIntoTrack(clip, textTrack?.name || 'Text');
      if (source) pendingAutoCaptions = clip.id;
      else showToast('Captions added — import an SRT/VTT file or type captions in its settings', 'info');
      showClipEditor(clip.id);
      debouncedSave();
    }

    async function suggestBRoll() {

      try {
        const { data, error } = await supabase.functions.invoke('frame-agent', {
          body: {
            command: 'b-roll',
            context: {
              timeline: state.tracks,
              playhead: state.playheadPercent
            }
          }
        });

        if (error) throw error;

        if (data.suggestions) {
          // Add suggested B-Roll clips
        }
      } catch (err) {
        console.error('B-Roll suggestion error:', err);
      }
    }

    function adjustSpeed() {
      const selectedClip = findSelectedClip();
      if (!selectedClip) {
        return;
      }

      // Simple speed adjustment (could be enhanced with UI)
      const newSpeed = prompt('Enter speed multiplier (0.25-4.0):', '1.0');
      if (newSpeed && !isNaN(parseFloat(newSpeed))) {
        saveStateSnapshot(state);
        selectedClip.speed = parseFloat(newSpeed);
      }
    }

    async function stabilizeFootage() {
      const selectedClip = findSelectedClip();
      if (!selectedClip || selectedClip.type !== 'video') {
        return;
      }


      try {
        const { data, error } = await supabase.functions.invoke('frame-agent', {
          body: {
            command: 'stabilize',
            context: {
              clipId: selectedClip.id,
              videoUrl: selectedClip.src
            }
          }
        });

        if (error) throw error;

      } catch (err) {
        console.error('Stabilization error:', err);
      }
    }

    function addTextOverlay() {
      const text = prompt('Enter text for overlay:');
      if (text) {
        const clipId = Date.now();
        const clip = {
          id: clipId,
          name: `Text: ${text.slice(0, 18)}`,
          left: state.playheadPercent,
          width: 10,
          type: 'text',
          heading: text.slice(0, 40),
          body: text
        };

        insertClipIntoTrack(clip, 'Text');
      }
    }

    // Modal integration functions for timeline toolbar
    function openAIVideoCreatorModal(state, showToast) {
      try {
        const modal = new AIVideoCreator({
          onComplete: (result) => {
            addVideoToTimeline(result, state);
          },
          onError: (error) => console.log(`AI Video creation failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('AI Video creation failed:', error);
        showToast(`AI Video creation failed: ${error.message || error}`, 'error');
      }
    }

    function openRecorderModal(state, showToast) {
      try {
        const modal = new RecorderModal({
          onComplete: (result) => {
            addVideoToTimeline(result, state);
          },
          onError: (error) => console.log(`Recording failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Recording failed:', error);
        showToast(`Recording failed: ${error.message || error}`, 'error');
      }
    }

    function openEnhancedRecorderModal(state, showToast) {
      try {
        const modal = new EnhancedRecorderModal({
          onComplete: (result) => {
            addVideoToTimeline(result, state);
          },
          onError: (error) => console.log(`Enhanced recording failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Enhanced recording failed:', error);
        showToast(`Enhanced recording failed: ${error.message || error}`, 'error');
      }
    }

    function openTemplateGeneratorModal(state, showToast) {
      try {
        const modal = new TemplateGeneratorModal({
          // The wizard hands back a composition ({ tracks, transitions }); place it on this
          // editor's own tracks at the playhead.
          onConfirm: (result) => {
            const n = applyCompositionToTimeline(result?.composition, state);
            if (n) showToast(`Added ${n} clip${n === 1 ? '' : 's'} to the timeline`, 'success');
          },
          onError: (error) => console.log(`Template generation failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Template generation failed:', error);
        showToast(`Template generation failed: ${error.message || error}`, 'error');
      }
    }

    function openTemplatePreviewModal(state, showToast) {
      try {
        const modal = new TemplatePreviewModal({
          onComplete: (result) => {
            applyTemplateToTimeline(result, state);
          },
          onError: (error) => console.log(`Template preview failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Template preview failed:', error);
        showToast(`Template preview failed: ${error.message || error}`, 'error');
      }
    }

    function openSocialPublisherModal(state, showToast) {
      try {
        // Open the muapi social publisher for the current generated video.
        const mediaUrl = typeof state.lastGeneratedVideo === 'string'
          ? state.lastGeneratedVideo
          : (state.lastGeneratedVideo?.src || state.lastGeneratedVideo?.url || '');
        openSocialPublish({ mediaUrl, mediaType: 'video' });
      } catch (error) {
        console.error('Publishing failed:', error);
        showToast(`Publishing failed: ${error.message || error}`, 'error');
      }
    }

    function openEmailCampaignModal(state, showToast) {
      try {
        const modal = new EmailCampaignModal({
          projectData: state,
          onComplete: (result) => {
          },
          onError: (error) => console.log(`Email campaign creation failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Email campaign creation failed:', error);
        showToast(`Email campaign creation failed: ${error.message || error}`, 'error');
      }
    }

    function openUrlVideoModal(state, showToast) {
      try {
        const modal = new UrlVideoModal({
          onComplete: (result) => {
            addVideoToTimeline(result, state);
          },
          onError: (error) => console.log(`URL video import failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('URL video import failed:', error);
        showToast(`URL video import failed: ${error.message || error}`, 'error');
      }
    }

    function openPageShotModal(state, showToast) {
      try {
        const modal = new PageShotModal({
          onComplete: (result) => {
            addImageToTimeline(result, state);
          },
          onError: (error) => console.log(`Page screenshot failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Page screenshot failed:', error);
        showToast(`Page screenshot failed: ${error.message || error}`, 'error');
      }
    }

    function openContactImporterModal(state, showToast) {
      try {
        const modal = new ContactImporterModal({
          onComplete: (result) => {
            // Store contacts for personalization
            state.contacts = result.contacts;
          },
          onError: (error) => console.log(`Contact import failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Contact import failed:', error);
        showToast(`Contact import failed: ${error.message || error}`, 'error');
      }
    }

    function openVideoPersonalizationHubModal(state, showToast) {
      try {
        const modal = new VideoPersonalizationHub({
          preloadedVideo: state.lastGeneratedVideo, // Pass any recently generated video
          onComplete: (result) => {
            // After personalization, offer landing page builder
            if (result && result.generations && result.generations.length > 0) {
              setTimeout(() => {
                setTimeout(() => {
                  openLandingPageBuilderModal(state, showToast);
                }, 1500);
              }, 1000);
            } else {
            }
          },
          onError: (error) => console.log(`Personalization Suite error: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Personalization Suite error:', error);
        showToast(`Personalization Suite error: ${error.message || error}`, 'error');
      }
    }

    // Make personalization modal accessible globally for toast integration
    window.openVideoPersonalizationHubModal = () => openVideoPersonalizationHubModal(state, showToast);
    TLEditor.openVideoPersonalizationHubModal = window.openVideoPersonalizationHubModal;

    // Global function to add personalization overlay to timeline
    window.addPersonalizationOverlay = () => {
      const overlayClip = {
        id: Date.now(),
        name: 'Personalization Overlay',
        left: state.playheadPercent * 10, // Position near playhead
        width: 8,
        type: 'text',
        heading: 'Hello {first_name}!',
        body: 'Welcome to our personalized video experience.',
        fontSize: 48,
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.7)',
        position: 'center'
      };
      insertClipIntoTrack(overlayClip, 'Text');
    };
    TLEditor.addPersonalizationOverlay = window.addPersonalizationOverlay;

    // Global function to add contact import functionality
    window.addContactImport = () => {
      openContactImporterModal(state, showToast);
    };
    TLEditor.addContactImport = window.addContactImport;

    // Global function to add lead generation form
    window.addLeadCapture = () => addAddonAtPlayhead('lead-form');
    TLEditor.addLeadCapture = window.addLeadCapture;

    // Global function to add a click-to-call button
    window.addClickToCall = () => addAddonAtPlayhead('click-to-call');
    TLEditor.addClickToCall = window.addClickToCall;

    // Any registered addon: 'addon-skip' | 'addon-pause' | 'addon-loop' |
    // 'lead-form' | 'click-to-call'.
    window.addTimelineAddon = (type) => addAddonAtPlayhead(type);
    TLEditor.addAddon = window.addTimelineAddon;

    // Global function to apply dynamic personalization layer to current clip
    window.applyPersonalizationLayer = async (clipId, scanData) => {
      try {
        const layer = assetReplacementEngine.createPersonalizationLayer(scanData, {
          textOverlays: [
            { text: 'Hello {{first_name}}!', position: 'top-center' },
            { text: '{{company}}', position: 'bottom-right' }
          ]
        });
        
        // Store the layer on the clip for rendering
        const track = state.tracks.find(t => t.clips.some(c => c.id === clipId));
        if (track) {
          const clip = track.clips.find(c => c.id === clipId);
          if (clip) {
            clip.personalizationLayer = layer;
            renderTracks();
            
          }
        }
      } catch (err) {
        console.error('Failed to apply personalization layer:', err);
        
      }
    };
    TLEditor.applyPersonalizationLayer = window.applyPersonalizationLayer;

    // Global function to add personalized image overlay
    window.addPersonalizationImage = () => {
      const imageClip = {
        id: Date.now(),
        name: 'Personalized Image',
        left: state.playheadPercent * 10,
        width: 8,
        type: 'image',
        src: '', // Will be set by user
        personalizationTokens: ['first_name', 'company'],
        overlayText: 'Welcome {first_name} from {company}!'
      };
      insertClipIntoTrack(imageClip, 'Video');
    };
    TLEditor.addPersonalizationImage = window.addPersonalizationImage;

    // Global function to add voice narration
    window.addPersonalizationAudio = () => {
      const audioClip = {
        id: Date.now(),
        name: 'Personalized Voice',
        left: state.playheadPercent * 10,
        width: 12,
        type: 'audio',
        src: '', // Will be generated
        text: 'Hello {first_name}, thank you for being part of {company}.',
        voice: 'neural-male',
        personalizationTokens: ['first_name', 'company']
      };
      insertClipIntoTrack(audioClip, 'Audio');
    };
    TLEditor.addPersonalizationAudio = window.addPersonalizationAudio;

    // Global function to add dynamic content based on contact data
    window.addDynamicContent = (contentType) => {
      let contentClip;

      switch (contentType) {
        case 'greeting':
          contentClip = {
            id: Date.now(),
            name: 'Dynamic Greeting',
            left: state.playheadPercent * 10,
            width: 6,
            type: 'text',
            heading: 'Hello {first_name}!',
            body: 'Welcome back to our exclusive content.',
            personalizationTokens: ['first_name']
          };
          break;

        case 'product':
          contentClip = {
            id: Date.now(),
            name: 'Product Personalization',
            left: state.playheadPercent * 10,
            width: 10,
            type: 'text',
            heading: '{company} Special Offer',
            body: 'As a valued {job_title} at {company}, you qualify for our premium package.',
            personalizationTokens: ['company', 'job_title']
          };
          break;

        case 'testimonial':
          contentClip = {
            id: Date.now(),
            name: 'Personalized Testimonial',
            left: state.playheadPercent * 10,
            width: 8,
            type: 'text',
            heading: 'What {first_name} Says',
            body: '"This solution transformed how {company} operates." - {first_name}',
            personalizationTokens: ['first_name', 'company']
          };
          break;

        default:
          contentClip = {
            id: Date.now(),
            name: 'Custom Personalization',
            left: state.playheadPercent * 10,
            width: 6,
            type: 'text',
            heading: 'Personalized Content',
            body: 'Custom message for {first_name}',
            personalizationTokens: ['first_name']
          };
      }

      insertClipIntoTrack(contentClip, 'Text');
    };

    function openLandingPageBuilderModal(state, showToast) {
      try {
        const modal = new LandingPageBuilder({
          onComplete: (result) => {
            // After landing pages, offer lead generation
            if (result && result.pages && result.pages > 0) {
              setTimeout(() => {
                setTimeout(() => {
                  openLeadGeneratorModal(state, showToast);
                }, 1500);
              }, 1000);
            } else {
            }
          },
          onError: (error) => console.log(`Landing page generation failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Landing page generation failed:', error);
        showToast(`Landing page generation failed: ${error.message || error}`, 'error');
      }
    }

    function openLeadGeneratorModal(state, showToast) {
      try {
        const modal = new LeadGeneratorModal({
          onComplete: (result) => {
            // Handle lead saving
          },
          onError: (error) => console.log(`Lead generation failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
        console.error('Lead generation failed:', error);
        showToast(`Lead generation failed: ${error.message || error}`, 'error');
      }
    }

    // Helper functions for modal integration
    function addVideoToTimeline(videoData, state) {
      const videoTrack = state.tracks.find(t => t.type === 'video');
      if (videoTrack) {
        const src = videoData.blob ? URL.createObjectURL(videoData.blob) : videoData.src;
        const newClip = {
          id: Date.now(),
          name: videoData.name || 'Imported Video',
          left: 50,
          width: 20,
          type: 'video',
          src,
          poster: videoData.poster
        };
        videoTrack.items.push(newClip);
        renderTracks();
      }
    }

    function addImageToTimeline(imageData, state) {
      const videoTrack = state.tracks.find(t => t.name === 'Video');
      if (videoTrack) {
        const newClip = {
          id: Date.now(),
          name: imageData.name || 'Imported Image',
          left: 50,
          width: 15,
          type: 'image',
          src: imageData.src
        };
        videoTrack.clips.push(newClip);
        renderTracks();
      }
    }

    function addAudioToTimeline(audioData, state) {
      const audioTrack = state.tracks.find(t => t.name === 'Audio');
      if (audioTrack) {
        const newClip = {
          id: Date.now(),
          name: audioData.name || 'Generated Audio',
          left: 50,
          width: 20,
          type: 'audio',
          src: audioData.src
        };
        audioTrack.clips.push(newClip);
        renderTracks();
      }
    }

    /**
     * Template Generator → timeline. Media clips go on the video track one after another
     * from the playhead (credit kept, transitions stored on the outgoing clip); script
     * captions and text elements go on text tracks. Returns the number of clips added.
     */
    function applyCompositionToTimeline(composition, st) {
      if (!composition?.tracks?.length) return 0;
      const T0 = st.timelineSeconds || 45;
      const offset = Math.min((st.playheadPercent / 100) * T0, Math.max(0, T0 - 1));
      const mk = (c, i, trackDef) => {
        const start = offset + (Number(c.startTime) || 0);
        const duration = Math.max(0.5, Number(c.duration) || 5);
        const a = c.asset || {};
        const base = { id: Date.now() + Math.floor(Math.random() * 1e6) + i, name: c.name || a.name || 'Clip', start, end: start + duration };
        if (c.type === 'video' || c.type === 'image') {
          return { ...base, type: c.type, src: a.url, poster: a.thumbnail, fit: 'cover', source: a.source || a.provider, credit: a.credit };
        }
        const text = String(c.text || c.name || '');
        return { ...base, type: 'text', heading: text.slice(0, 40), body: text, caption: trackDef.name === 'Script' || c.type === 'caption' };
      };
      let count = 0;
      let end = 0;
      const placed = [];
      composition.tracks.forEach((trackDef, ti) => {
        const isMedia = (trackDef.clips || []).some((c) => c.type === 'video' || c.type === 'image');
        if (trackDef.type === 'audio' && !isMedia) return; // audio is added from the editor's Audio tools
        const trackName = isMedia ? videoTrackName() : (trackDef.name || 'Text');
        const clips = [];
        (trackDef.clips || []).forEach((c, i) => {
          const clip = mk(c, count + i, trackDef);
          if (!clip.src && clip.type !== 'text') return;
          end = Math.max(end, clip.end);
          clips.push(clip);
        });
        placed[ti] = clips;
        if (!isMedia && !st.tracks.some((t) => t.name === trackName) && clips.length) {
          st.tracks.push({ id: `track-tg-${Date.now().toString(36)}-${ti}`, type: 'text', name: trackName, muted: false, solo: false, locked: false, items: [] });
        }
        trackDef._hostTrack = trackName;
      });
      if (end > st.timelineSeconds) st.timelineSeconds = Math.ceil(end + 2);
      placed.forEach((clips, ti) => clips?.forEach((clip) => {
        insertClipIntoTrack(clip, composition.tracks[ti]._hostTrack);
        count += 1;
      }));
      (composition.transitions || []).forEach((tr) => {
        const clip = placed[typeof tr.inTrack === 'number' ? tr.inTrack : tr.trackIndex]?.[tr.fromClipIndex];
        if (clip) clip.transition = { type: tr.type, duration: tr.duration || 1 };
      });
      renderTracks();
      debouncedSave();
      return count;
    }

    function applyTemplateToTimeline(templateData, state) {
      // Apply template settings to timeline
      if (templateData.settings) {
        Object.assign(state, templateData.settings);
      }
      if (templateData.clips) {
        templateData.clips.forEach(clip => {
          const track = state.tracks.find(t => t.name === clip.trackType);
          if (track) {
            track.clips.push({ ...clip, id: Date.now() });
          }
        });
      }
      renderTracks();
    }

    // Reveal a collapsed editor-only panel from the floating rail.
    const LEGACY_RAIL_PANELS = ['tokenEditorPanel', 'batchGeneratorPanel', 'personalizationPanel', 'personalizationEditorPanel'];
    // `exclusive` (rail clicks) closes the other side panels first; the clip
    // editor opens beside them. Each panel gets a ✕. (The page stylesheet hides
    // [hidden] with !important, so an inline display alone never shows a panel.)
    function openPanel(id, { exclusive = true, scroll = true } = {}) {
      const el = root.querySelector('#' + id);
      if (!el) return;
      if (exclusive) {
        [...Object.values(RAIL_PANEL_MAP), ...LEGACY_RAIL_PANELS].forEach((other) => {
          const o = other === id ? null : root.querySelector('#' + other);
          if (o) { o.hidden = true; o.style.display = 'none'; }
        });
      }
      const title = el.querySelector('.card-title');
      if (title && !title.querySelector('.panel-close')) {
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'panel-close';
        close.setAttribute('aria-label', 'Close panel');
        close.textContent = '✕';
        close.addEventListener('click', () => { el.hidden = true; el.style.display = 'none'; });
        title.appendChild(close);
      }
      if (id === 'stockPanel') mountStockBrowser();
      if (id === 'aiAgentPanel') mountAgentPanel();
      if (id === 'sharePanel') mountSharePanel();
      if (id === 'colorScopesPanel') mountColorScopesPanel();
      if (id === 'multiCameraPanel') renderMultiCamera();
      el.hidden = false;
      el.style.display = 'block';
      if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Media: the library card with Upload and Stock Media.
    function openMediaLibrary() {
      const card = root.querySelector('#mediaGrid')?.closest('.side-card');
      if (!card) return;
      card.hidden = false;
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      card.classList.add('rp-flash');
      setTimeout(() => card.classList.remove('rp-flash'), 1600);
      root.querySelector('#uploadBtn')?.focus({ preventScroll: true });
    }

    // AI Animation: the AI Agent, with animation ideas to start from.
    const ANIMATION_STARTERS = [
      ['Title intro', 'Create an animated title intro for my video with a bold headline that slides in and a subtle glow.'],
      ['Kinetic text', 'Create a kinetic typography animation that spells out my headline word by word.'],
      ['Logo reveal', 'Create a logo reveal animation with a light sweep across the logo.'],
      ['Lower third', 'Create an animated lower third with a name and a job title that slides in and out.'],
      ['Countdown', 'Create a 5 second countdown animation for a launch.'],
    ];
    // Open the AI Agent with a request typed in, ready to send.
    async function openAgentWithPrompt(prompt) {
      openPanel('aiAgentPanel');
      await mountAgentPanel();
      const input = root.querySelector('#aiAgentChat [data-agent-input]');
      if (input) { input.value = prompt; input.focus({ preventScroll: true }); }
    }
    async function openAiAnimation() {
      openPanel('aiAgentPanel');
      await mountAgentPanel();
      const chat = root.querySelector('#aiAgentChat');
      const input = chat?.querySelector('[data-agent-input]');
      if (!chat || !input) return;
      if (!chat.querySelector('.rp-starters')) {
        const row = document.createElement('div');
        row.className = 'pz-ui rp-starters';
        row.innerHTML = `<span class="pz-label">Animation ideas</span>${ANIMATION_STARTERS.map(([label, prompt]) => `<button type="button" class="pz-btn pz-btn-secondary pz-btn-xs" data-prompt="${escapeHtml(prompt)}">${escapeHtml(label)}</button>`).join('')}`;
        row.addEventListener('click', (e) => {
          const prompt = e.target.closest('[data-prompt]')?.dataset.prompt;
          if (prompt) { input.value = prompt; input.focus(); }
        });
        chat.prepend(row);
      }
      input.focus({ preventScroll: true });
    }

    // Clip Editor: the selected clip's settings, or a hint to pick one.
    function showClipEditorOrHint() {
      const selected = state.selectedClipId != null && state.tracks.flatMap((t) => t.items || t.clips || []).some((c) => c.id === state.selectedClipId);
      if (selected) renderClipEditor(state.selectedClipId);
      else if (els.clipEditorContainer) els.clipEditorContainer.innerHTML = '<div class="pz-ui"><p class="pz-hint">Click a clip on the timeline to edit its settings here.</p></div>';
    }

    // Maps floating-rail labels to collapsed panel element ids.
    const RAIL_PANEL_MAP = {
      'Interactive': 'interactivePanel',
      'Overlays': 'overlaysPanel',
      'Blend Modes': 'blendPanel',
      'Stock Media': 'stockPanel',
      'AI Agent': 'aiAgentPanel',
      'Share': 'sharePanel',
      'Scene Detector': 'sceneDetectorPanel',
      'Camera FX': 'cameraEffectsPanel',
      'Color Scopes': 'colorScopesPanel',
      'Multi-Cam': 'multiCameraPanel',
      'Clip Editor': 'clipSettingsPanel',
      'Transitions Panel': 'transitionSettingsPanel',
      'AI Tools': 'cinegenResultsPanel'
    };

    // Maps feature-index chip data-modal keys to editor modal/open actions.
    const FEATURE_INDEX_MODALS = {
      previewMedia: () => openPreviewMediaModal(state, showToast),
      videoPlayer: () => openVideoPlayerModal(state, showToast),
      recorder: () => openRecorderModal(state, showToast),
      urlVideo: () => openUrlVideoModal(state, showToast),
      templates: () => openTemplateGeneratorModal(state, showToast),
      aiVideo: () => openAIVideoCreatorModal(state, showToast),
      personalization: () => openVideoPersonalizationHubModal(state, showToast),
      landing: () => openLandingPageBuilderModal(state, showToast),
      social: () => openSocialPublisherModal(state, showToast),
      email: () => openEmailCampaignModal(state, showToast),
      leads: () => openLeadGeneratorModal(state, showToast),
      contacts: () => openContactImporterModal(state, showToast),
      endScreen: () => openTemplateLibrary('endScreens'),
      import: () => showToast('Import timeline functionality coming soon', 'info'),
      storyboard: () => { if (window.showCutAIFromTimeline) window.showCutAIFromTimeline(); else showToast('Storyboard coming soon', 'info'); },
      subtitleEditor: () => generateSubtitles(),
      imageCrop: () => showToast('Image cropper coming soon', 'info'),
      imageEdit: () => showToast('Image editor coming soon', 'info'),
      voice: () => openSmartSpeech()
    };

    // Populate the preview filmstrip (prototype-style clip thumbnails).
    function renderFilmstrip() {
      // Prototype parity: the reference filmstrip is an empty container —
      // no thumbnails are generated.
      const fs = root.querySelector('#filmstrip');
      if (fs) fs.innerHTML = '';
    }

    function renderRail() {
      els.floatingRail.innerHTML = '';
      renderFilmstrip();
      const railTooltips = {
        'Generate': 'Generate - make a video clip or an image from a description, on your own MuAPI key',
        'Split': 'Split clip at playhead - Divide the selected clip into two at the current position',
        'Scenes': 'Detect scenes - Automatically identify scene changes in your footage',
        'Subtitle': 'Add subtitles - Generate or edit subtitles for your video',
        'B-Roll': 'Suggest B-roll - Get AI recommendations for supplementary footage',
        'Speed': 'Adjust speed - Change playback speed with speed ramping',
        'Stabilize': 'Stabilize footage - Remove camera shake from video clips',
        'Text': 'Add text overlay - Insert titles, captions, or text elements',
        'Transitions': 'Add transitions - Apply transition effects between clips',
        'AI Video': 'AI video creator - Generate complete videos with AI',
        'Recorder': 'Screen recorder - Record your screen or webcam directly',
        'Enhanced Recorder': 'Advanced recorder - Multi-track recording with effects',
        'Templates': 'Browse templates - Choose from pre-built video templates',
        'Preview Template': 'Preview template - See how a template looks before applying',
        'Social': 'Social publisher - Share directly to social media platforms',
        'Email Campaign': 'Email campaigns - Create and send video email campaigns',
        'URL Video': 'Import from URL - Download and import video from a web address',
        'Page Shot': 'Webpage capture - Take a screenshot of any webpage',
        'Contacts': 'Import contacts - Import contact lists for personalization',
        'Canvas': 'Canvas - Place text, images, stickers and shapes on the video (opens Overlays)',
        'Media': 'Media - Your media library: upload or drag clips onto the timeline',
        'AI Animation': 'AI Animation - Ask the AI Agent to build an animation, with starter ideas',
        'Token Editor': 'Token editor - Create and manage personalization tokens',
        'Batch Generator': 'Batch generation - Generate multiple videos at once',
        'Personalization': 'Personalization - Add dynamic content for different viewers',
        'Personalization Editor': 'Personalization editor - Advanced personalization settings',
        'Personalization Suite': 'Personalization suite - Complete video personalization workflow',
        'Landing Pages': 'Landing pages - Create personalized landing pages',
        'Lead Generator': 'Lead capture - Add lead generation forms to videos',
        'AI Personalizer': 'AI Personalizer - Scan profiles and generate personalized content',
        'AI Tools': 'AI Tools - Fill Gap, Extend, Element and Shot Board on your own MuAPI key',
        'Gap Fill': 'CineGen Gap Fill - Fill gaps between clips with AI',
        'Extend Clip': 'CineGen Extend - Extend selected clip with AI-generated content',
        'Generate Music': 'CineGen Generate Music - Create background music',
        'Mask Tool': 'CineGen AI Mask - Generate object isolation masks',
        'Element': 'CineGen Element - Generate reusable visual elements',
        'Polish': 'CineGen Polish - Gap Fill + Extend in one step',
        'Smart Subtitles': 'CineGen Smart Subtitles - Auto-generate timed subtitles',
        'LLM Assistant': 'CineGen LLM Assistant - Advanced reasoning for edits',
        'SAM3': 'CineGen SAM3 - Precise segment masks',
        'Audio Sync': 'CineGen Audio Sync - Align audio to video',
        'Layer Decomp': 'CineGen Layer Decomposition - Foreground/background/effects layers',
        'Shot Board': 'CineGen Shot Board - Multi-shot sequences',
        'Proxy Play': 'CineGen Proxy Playback - Smooth scrubbing proxies',
        'Comp Plan': 'CineGen Composition Plan - AI edit plan',
        'Scene Detector': 'Scene detection - Identify scene changes in footage',
        'Camera FX': 'Camera effects - Shake, orbit, hitchcock, pan, tilt',
        'Color Scopes': 'Color scopes - Waveform, vectorscope, histogram',
        'Multi-Cam': 'Multi-camera editing, PIP, and split screen',
        'Clip Editor': 'Clip editor - Edit selected clip properties',
        'Transitions Panel': 'Transitions - Add effects between clips',
        'CineGen Results': 'CineGen AI Tools results history',
        'Interactive': 'Interactive - Skip, Pause, Loop, Lead Generator, List Builder, Personalizer, CTA',
        'Overlays': 'Overlays - Smart Text, Text Mask, Personalized Image, Image, Stickers, Wrapper, Lower Thirds, Transitions, Presets',
        'Stock Media': 'Stock Media - Pixabay and Pexels videos and images for the timeline',
        'AI Agent': 'AI Agent - describe a video or animation and the agent builds it on the timeline',
        'Share': 'Share - publish an interactive video with a link and embed code'
      };
      state.railActions.forEach(([icon, label, active]) => {
        const button = document.createElement('button');
        button.className = `rail-btn ${active ? 'active' : ''}`;
        button.innerHTML = `<span class="emoji">${icon}</span><span>${label}</span>`;
        button.setAttribute('data-tooltip', railTooltips[label] || `${label} action`);
        button.title = railTooltips[label] || `${label} action`;
        button.setAttribute('aria-label', `${label} action`);

        // Add specific functionality for each rail action
        button.addEventListener('click', async () => {
          switch (label) {
            case 'Generate':
              openAiTools('generate');
              break;
            case 'Split':
              splitClipAtPlayhead();
              break;
            case 'Scenes':
              detectScenes();
              break;
            case 'Subtitle':
              generateSubtitles();
              break;
            case 'B-Roll':
              suggestBRoll();
              break;
            case 'Speed':
              adjustSpeed();
              break;
            case 'Stabilize':
              stabilizeFootage();
              break;
            case 'Text':
              addTextOverlay();
              break;
            case 'Transitions':
              showTransitionSettings();
              break;
            case 'AI Video':
              openAiTools('fill_gap');
              break;
            case 'Recorder':
              openRecorderModal(state, showToast);
              break;
            case 'Enhanced Recorder':
              openEnhancedRecorderModal(state, showToast);
              break;
            case 'Templates':
              openTemplateGeneratorModal(state, showToast);
              break;
            case 'Preview Template':
              openTemplatePreviewModal(state, showToast);
              break;
            case 'Social':
              openSocialPublisherModal(state, showToast);
              break;
            case 'Email Campaign':
              openEmailCampaignModal(state, showToast);
              break;
            case 'URL Video':
              openUrlVideoModal(state, showToast);
              break;
            case 'Page Shot':
              openPageShotModal(state, showToast);
              break;
            case 'Contacts':
              openContactImporterModal(state, showToast);
              break;
            case 'Canvas':
              // Overlays is the canvas: text, images, stickers and shapes you place and drag on the video.
              openPanel('overlaysPanel');
              break;
            case 'Media':
              openMediaLibrary();
              break;
            case 'AI Animation':
              openAiAnimation();
              break;
            case 'Token Editor':
              showTokenEditorPanel();
              break;
            case 'Batch Generator':
              showBatchGeneratorPanel();
              break;
            case 'Personalization':
              showPersonalizationPanel();
              break;
            case 'Personalization Editor':
              showPersonalizationEditorPanel();
              break;
            case 'Personalization Suite':
              openVideoPersonalizationHubModal(state, showToast);
              break;
            case 'Landing Pages':
              openLandingPageBuilderModal(state, showToast);
              break;
            case 'Lead Generator':
              openLeadGeneratorModal(state, showToast);
              break;
            case 'AI Personalizer':
              window.dispatchEvent(new CustomEvent('open-personalizer'));
              break;
            case 'End Screens':
              openTemplateLibrary('endScreens');
              break;
            case 'Connect Form':
              openTemplateLibrary('connect');
              break;
            case 'Smart Speech':
              openSmartSpeech();
              break;
             case 'Export':
               openExportModal(state, showToast);
               break;
            case 'AI Tools':
              openPanel('cinegenResultsPanel');
              openAiTools();
              break;
            default:
              if (RAIL_PANEL_MAP[label]) openPanel(RAIL_PANEL_MAP[label]);
              if (label === 'Clip Editor') showClipEditorOrHint();
          }
        });

        els.floatingRail.appendChild(button);
      });
    }

    function addTrack(type) {
      state.tracks.push({ id: `${type.toLowerCase()}-${Date.now()}`, name: type, muted: false, solo: false, locked: false, clips: [] });
      renderTracks();
    }

    function showClipEditor(clipId) {
      openPanel('clipSettingsPanel', { exclusive: false, scroll: false });
      renderClipEditor(clipId);
    }

    function showTransitionSettings() {
      openPanel('transitionSettingsPanel', { exclusive: false, scroll: false });
    }

    function showColorCorrectionPanel() {
      if (!els.colorCorrectionPanel) return;
      if (!FEATURE_FLAGS.colorCorrection) {
        els.colorCorrectionContainer && (els.colorCorrectionContainer.innerHTML = '<p style="color: #ef4444;">Color correction system unavailable</p>');
        els.colorCorrectionPanel.style.display = 'block';
        return;
      }
      if (!colorCorrectionSystem) {
        try {
          if (!els.colorCorrectionContainer) return;
          colorCorrectionSystem = new ColorCorrectionSystem(els.colorCorrectionContainer, state, state.keyframeSystem);
          els.colorCorrectionContainer.innerHTML = '';
          els.colorCorrectionContainer.appendChild(colorCorrectionSystem.getPanel());
        } catch (error) {
          console.error('Failed to load ColorCorrectionSystem:', error);
          els.colorCorrectionContainer && (els.colorCorrectionContainer.innerHTML = '<p style="color: #ef4444;">Color correction system unavailable</p>');
        }
      }
      els.colorCorrectionPanel?.style && (els.colorCorrectionPanel.style.display = 'block');
      
    }

    function openAdvancedModal(content, title = 'Advanced Editing') {
      els.modalTitle.textContent = title;
      els.modalBody.innerHTML = content;
      els.modalOverlay.style.display = 'flex';
      // Focus the close button for keyboard users
      if (els.modalClose) els.modalClose.focus();
      // Trap focus within modal
      cleanup.addDocumentListener('keydown', handleModalKeydown);
    }

    function openExportModal(state, showToast) {
      // Remotion web renderer (in-browser, sandboxed runner). The previous
      // ExportPipeline stays available as "Basic export".
      const content = `
        <div class="export-modal">
          <div class="form-group">
            <label for="exportFormat">Format</label>
            <select id="exportFormat">
              <option value="mp4">MP4 (H.264)</option>
              <option value="webm">WebM (VP9)</option>
              <option value="mov">MOV</option>
            </select>
          </div>
          <div class="form-group">
            <label for="exportQuality">Quality</label>
            <select id="exportQuality">
              <option value="1080p">1080p (Full HD)</option>
              <option value="720p">720p (HD)</option>
              <option value="4k">4K (Ultra HD) — slower</option>
            </select>
          </div>
          <div class="form-group">
            <label for="exportFor">Videos</label>
            <select id="exportFor">
              <option value="one">One video${getActivePersonalizationProfile() ? ` (for ${escapeHtml(contactName(getActivePersonalizationProfile()))})` : ''}</option>
              <option value="each"${listContactProfiles(contactStore).length ? '' : ' disabled'}>One video per contact (${listContactProfiles(contactStore).length} in Personalization Studio)</option>
            </select>
          </div>
          <ul id="exportWarnings" class="export-warnings"></ul>
          <button class="primary-btn" id="startExportBtn">Start Export</button>
          <button class="secondary-btn" id="cancelExportBtn">Cancel</button>
          <button class="secondary-btn" id="basicExportBtn" title="The previous exporter">Basic export</button>
          <button class="secondary-btn" id="publishInteractiveBtn" title="Share a link where viewers get the pauses, lead forms and CTA buttons">Publish interactive video…</button>
          <div id="exportProgress" style="margin-top:12px;display:none;">
            <div class="progress-bar"><div class="progress-fill" id="exportProgressFill" style="width:0%"></div></div>
            <div id="exportProgressText">Preparing export...</div>
          </div>
        </div>
      `;
      openAdvancedModal(content, 'Export Project');

      const q = (sel) => els.modalBody.querySelector(sel);
      const startBtn = q('#startExportBtn');
      const cancelBtn = q('#cancelExportBtn');
      const basicBtn = q('#basicExportBtn');
      q('#publishInteractiveBtn')?.addEventListener('click', () => { closeModal(); openPanel('sharePanel'); });
      const progress = q('#exportProgress');
      const progressFill = q('#exportProgressFill');
      const progressText = q('#exportProgressText');
      const warningsList = q('#exportWarnings');
      let abort = null;

      const setProgress = (pct, text) => {
        progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        progressText.textContent = text;
      };

      const buildModel = async (quality, profile = getActivePersonalizationProfile()) => {
        const { timelineToComposition } = await import('../lib/editor/remotion/timelineToComposition.js');
        return timelineToComposition(state, { quality, profile });
      };

      // Contacts the export covers (one = the selected contact).
      const exportContacts = () => (q('#exportFor')?.value === 'each'
        ? listContactProfiles(contactStore)
        : [getActivePersonalizationProfile()].filter(Boolean));
      let warningsRun = 0;
      const refreshWarnings = async () => {
        const run = ++warningsRun;
        let list = [];
        try {
          const { exportWarnings, canExportInBrowser } = await import('../lib/editor/remotion/exportWarnings.js');
          const quality = q('#exportQuality')?.value || '1080p';
          list = exportWarnings(await buildModel(quality), { quality });
          if (!canExportInBrowser()) list.unshift("This browser can't encode video. Use Chrome or Edge 94+, Firefox 130+ or Safari 26+, or use Basic export.");
        } catch (err) {
          console.warn('[Export] warnings unavailable', err);
        }
        // Personalized images: contacts with nothing in a slot, then (async)
        // images that no longer load.
        const contacts = exportContacts();
        const imageWarnings = [
          ...describeImageGaps(contactImageGaps(state, contacts)),
          ...describeUnreviewed(unreviewedAiImages(projectImageKeys(), contacts)),
          ...describeClipGaps(state, contacts),
        ];
        if (run !== warningsRun) return;
        // Personalized-image warnings look like the Personalize window's.
        const imageItem = (w) => `<li class="pz-warning">${escapeHtml(w)}</li>`;
        warningsList.innerHTML = list.map((w) => `<li>${escapeHtml(w)}</li>`).join('') + imageWarnings.map(imageItem).join('');
        const broken = await findBrokenImages(state, contacts, { probe: browserImageProbe() }).catch(() => []);
        if (run !== warningsRun || !broken.length) return;
        warningsList.insertAdjacentHTML('beforeend', describeBrokenImages(broken).map(imageItem).join(''));
      };
      q('#exportQuality')?.addEventListener('change', refreshWarnings);
      q('#exportFor')?.addEventListener('change', refreshWarnings);
      refreshWarnings();

      const doExport = async () => {
        if (!startBtn) return;
        startBtn.disabled = true;
        basicBtn.disabled = true;
        progress.style.display = 'block';
        setProgress(0, 'Preparing export...');
        abort = new AbortController();
        const container = q('#exportFormat')?.value || 'mp4';
        const quality = q('#exportQuality')?.value || '1080p';
        try {
          const { exportModel, downloadBlob, EXTENSIONS } = await import('../lib/editor/remotion/exportClient.js');
          const name = String(state.projectTitle || 'timeline').replace(/[^a-z0-9 _-]+/gi, '').trim() || 'timeline';
          // One video per Personalization Studio contact: their details fill
          // the text and their own Smart Speech line plays.
          if (q('#exportFor')?.value === 'each') {
            const contacts = listContactProfiles(contactStore);
            for (let i = 0; i < contacts.length; i += 1) {
              if (abort.signal.aborted) throw new Error('Cancelled');
              const who = contactName(contacts[i]);
              const part = await exportModel(await buildModel(quality, contacts[i]), {
                container,
                quality,
                signal: abort.signal,
                onProgress: (p) => setProgress(((i + p) / contacts.length) * 100, `Video ${i + 1} of ${contacts.length} · ${who} · ${Math.round(p * 100)}%`),
              });
              downloadBlob(part, `${name} - ${who.replace(/[^a-z0-9 _-]+/gi, '').trim() || contacts[i].id}.${EXTENSIONS[container] || 'mp4'}`);
            }
            setProgress(100, `Done: ${contacts.length} videos downloaded`);
            showToast(`Exported ${contacts.length} personalized videos`, 'success');
            return;
          }
          const model = await buildModel(quality);
          const blob = await exportModel(model, {
            container,
            quality,
            signal: abort.signal,
            onProgress: (p) => setProgress(p * 100, `Rendering... ${Math.round(p * 100)}%`),
          });
          downloadBlob(blob, `${name}.${EXTENSIONS[container] || 'mp4'}`);
          setProgress(100, `Export complete (${(blob.size / 1048576).toFixed(1)} MB)`);
          showToast('Export complete — your video is downloading', 'success');
          setTimeout(closeModal, 1500);
        } catch (err) {
          setProgress(0, `Export error: ${err.message}`);
          showToast(`Export error: ${err.message}`, 'error');
        } finally {
          startBtn.disabled = false;
          basicBtn.disabled = false;
          abort = null;
        }
      };

      // The previous exporter, kept so nothing is removed.
      const doBasicExport = async () => {
        startBtn.disabled = true;
        basicBtn.disabled = true;
        progress.style.display = 'block';
        setProgress(0, 'Exporting...');
        try {
          const { ExportPipeline } = await import('../lib/editor/exportPipeline.js');
          const pipeline = new ExportPipeline(els.timelineBody, state);
          pipeline.onProgress = (pct) => setProgress(pct, `Exporting... ${Math.round(pct)}%`);
          await pipeline.startExport();
          setProgress(100, 'Export complete!');
          showToast('Export complete', 'success');
          setTimeout(closeModal, 1500);
        } catch (err) {
          setProgress(0, `Export error: ${err.message}`);
          showToast(`Export error: ${err.message}`, 'error');
        } finally {
          startBtn.disabled = false;
          basicBtn.disabled = false;
        }
      };

      startBtn?.addEventListener('click', doExport);
      basicBtn?.addEventListener('click', doBasicExport);
      cancelBtn?.addEventListener('click', () => {
        if (abort) {
          abort.abort();
          setProgress(0, 'Cancelling...');
        } else {
          closeModal();
        }
      });
    }

    function closeModal() {
      els.modalOverlay.style.display = 'none';
      cleanup.removeDocumentListener('keydown', handleModalKeydown);
    }

    function handleModalKeydown(event) {
      if (event.key === 'Escape') {
        closeModal();
        return;
      }
      if (event.key === 'Tab' && els.modalOverlay.style.display === 'flex') {
        const focusable = els.modalOverlay.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    function showRetakePanel(clip) {
      const panel = document.createElement('div');
      panel.className = 'retake-panel-fixed';
      panel.innerHTML = `
        <div class="bg-[#1a1a1f] rounded-xl p-6 w-full max-w-md border border-white/10 shadow-lg">
          <h3 class="text-lg font-bold mb-4">Retake Clip</h3>
          <p class="text-sm text-white/60 mb-4">Regenerate this clip with new parameters</p>
          <div class="space-y-3">
            <div>
              <label class="text-xs text-white/50 mb-1 block">Prompt</label>
              <textarea class="w-full bg-[#0d0d11] border border-white/10 rounded px-3 py-2 text-sm" placeholder="Describe the retake..." rows="3">${clip.prompt || ''}</textarea>
            </div>
            <div>
              <label class="text-xs text-white/50 mb-1 block">Duration (seconds)</label>
              <input type="number" min="1" max="30" value="${clip.duration || 5}" class="w-full bg-[#0d0d11] border border-white/10 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div class="flex gap-2 mt-6">
            <button class="flex-1 px-4 py-2 bg-white/10 rounded text-sm hover:bg-white/20" onclick="this.closest('.retake-panel-fixed').remove()">Cancel</button>
            <button class="flex-1 px-4 py-2 bg-primary rounded text-sm font-semibold hover:opacity-90" onclick="retakeClipHandler(${clip.id})">Retake</button>
          </div>
        </div>
      `;
      document.body.appendChild(panel);
    }

    function retakeClipHandler(clipId) {
      const clip = state.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
      if (clip) {
        showRetakePanel(clip);
      }
    }

    async function showRetakePanel(clip) {
      const panel = document.createElement('div');
      panel.className = 'retake-panel-fixed';
      panel.innerHTML = `
        <div class="bg-[#1a1a1f] rounded-xl p-6 w-full max-w-md border border-white/10 shadow-lg">
          <h3 class="text-lg font-bold mb-4">Retake Clip</h3>
          <p class="text-sm text-white/60 mb-4">Regenerating with MuAPI...</p>
          <div class="text-xs text-white/50">Processing: ${clip.id}</div>
        </div>
      `;
      document.body.appendChild(panel);
      
      try {
        const { cinegen } = await import('../lib/cinegen.js');
        const result = await cinegen.applyEditTool('extend', {
          prompt: clip.prompt || '',
          extendDuration: clip.duration || 5
        });
        
        if (result.success) {
          
          onRetake?.(clip, result.data);
        } else {
          
        }
      } catch (e) {
        
      }
      
      panel.remove();
    }

    function showImportTimelineModal() {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]';
      modal.innerHTML = `
        <div class="bg-[#1a1a1f] rounded-xl p-6 w-full max-w-md border border-white/10">
          <h3 class="text-lg font-bold mb-4">Import Timeline</h3>
          <p class="text-sm text-white/60 mb-4">Import from JSON file</p>
          <div class="border border-dashed border-white/20 rounded-lg p-6 text-center">
            <input type="file" id="timelineFileInput" accept=".json" class="hidden" />
            <label for="timelineFileInput" class="cursor-pointer">Click to browse</label>
          </div>
          <button class="w-full mt-4 px-4 py-2 bg-white/10 rounded" onclick="this.closest('.fixed').remove()">Cancel</button>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#timelineFileInput').onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const data = JSON.parse(ev.target.result);
              
              modal.remove();
            } catch (err) {
              
            }
          };
          reader.readAsText(file);
        }
      };
    }

    function showICLoraPanel() {
      const panel = document.createElement('div');
      panel.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]';
      panel.innerHTML = `
        <div class="bg-[#1a1a1f] rounded-xl p-6 w-full max-w-md border border-white/10">
          <h3 class="text-lg font-bold mb-4">IC-LoRA Character Consistency</h3>
          <p class="text-sm text-white/60 mb-4">Applying with MuAPI...</p>
          <div class="text-xs text-white/50">Processing character consistency</div>
        </div>
      `;
      document.body.appendChild(panel);
      
      // Simulate MuAPI call
      setTimeout(() => {
        
        panel.remove();
      }, 500);
    }

    // Category C Editor Surface panel functions
    // Personalization rail panels (src/lib/editor/panels/personalPanels.js):
    // real contacts and details from the Personalization Studio.
    const railPanels = {};
    function mountRailPanel(key, container, render) {
      if (!container) return;
      if (railPanels[key]) railPanels[key].redraw?.();
      else railPanels[key] = render(container);
    }
    function addSmartText(text) {
      const T = state.timelineSeconds || 60;
      const startSec = (state.playheadPercent / 100) * T;
      const clip = createAddonClip('overlay-text', { startSec, timelineSeconds: T });
      clip.addon = { ...clip.addon, text };
      clip.name = `Text: ${text.slice(0, 30)}`;
      saveStateSnapshot(state);
      insertClipIntoTrack(clip, 'Text');
      scheduleEngineUpdate();
      debouncedSave();
      showToast('Added as Smart Text at the playhead', 'success');
      return clip;
    }
    // Intelligence layer: scenes for the selected contact become Smart Text clips.
    async function buildSceneClips() {
      const contactId = localStorage.getItem('remix_selected_contact_id');
      if (!contactId) throw new Error('select a contact first');
      const headers = { 'Content-Type': 'application/json' };
      try {
        const { supabase: sb } = await import('../lib/supabase.js');
        const { data } = await sb.auth.getSession();
        if (data?.session) headers.Authorization = `Bearer ${data.session.access_token}`;
      } catch { /* anonymous */ }
      const res = await fetch(`/api/intelligence/auto-timeline/${encodeURIComponent(contactId)}`, { method: 'POST', headers, body: '{}' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const scenes = (await res.json()).scenes || [];
      const T = state.timelineSeconds || 60;
      let at = (state.playheadPercent / 100) * T;
      saveStateSnapshot(state);
      let added = 0;
      scenes.forEach((scene) => {
        const dur = Math.max(1, Number(scene.durationSeconds) || 5);
        if (at >= T - 0.1) return;
        const clip = createAddonClip('overlay-text', { startSec: at, timelineSeconds: T });
        clip.start = at;
        clip.end = Math.min(T, at + dur);
        clip.addon = { ...clip.addon, text: String(scene.prompt || scene.beat || '').slice(0, 140) };
        clip.name = `Scene: ${String(scene.beat || scene.prompt || '').slice(0, 24)}`;
        insertClipIntoTrack(clip, 'Text');
        at += dur;
        added += 1;
      });
      scheduleEngineUpdate();
      debouncedSave();
      return added;
    }
    const activeContact = () => getActivePersonalizationProfile();

    function showPersonalizationPanel() {
      openPanel('personalizationPanel');
      mountRailPanel('personalization', els.personalizationContainer, (el) => {
        const panel = renderPersonalizationPanel(el, {
          contacts: () => listContactProfiles(contactStore),
          active: activeContact,
          select: (id) => contactStore.selectContact(id),
          addText: addSmartText,
          openPersonalize: () => import('../features/personalization/mount.jsx').then((m) => m.openPersonalization({
            studioId: 'timeline', studioName: 'Timeline Editor', appId: 'ai-video-agent',
            onComplete: () => { contactSync.run({ leads: true }).catch(() => {}); renderContactSwitcher(); panel.redraw(); },
          })),
        });
        window.addEventListener('remix:contact-changed', panel.redraw);
        return panel;
      });
    }

    function showPersonalizationEditorPanel() {
      openPanel('personalizationEditorPanel');
      mountRailPanel('pedit', els.personalizationEditorContainer, (el) => renderPersonalizationEditor(el, {
        active: activeContact,
        tokens: TOKEN_DEFS.map((d) => [d.key, d.label]),
        resolve: (text, profile) => resolveOverlayText(text, profile),
        addText: addSmartText,
      }));
    }

    function showTokenEditorPanel() {
      openPanel('tokenEditorPanel');
      mountRailPanel('token', els.tokenEditorContainer, (el) => renderTokenEditor(el, {
        active: activeContact,
        insert: addSmartText,
        autoTimeline: buildSceneClips,
      }));
    }

    function showBatchGeneratorPanel() {
      openPanel('batchGeneratorPanel');
      mountRailPanel('batch', els.batchGeneratorContainer, (el) => renderBatchHub(el, {
        contacts: () => listContactProfiles(contactStore),
        tokensUsed: () => projectTokens(state.tracks),
        exportEach: () => {
          openExportModal(state, showToast);
          const sel = els.modalBody.querySelector('#exportFor');
          if (sel && !sel.disabled) sel.value = 'each';
        },
        openShare: () => openPanel('sharePanel'),
      }));
    }

    function renderLineDuration(clipId) {
      const clip = state.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
      if (!clip) return '';

      const start = (clip.left / 100) * state.timelineSeconds;
      const end = ((clip.left + clip.width) / 100) * state.timelineSeconds;
      const trimIn = clip.trimIn || 0;
      const trimOut = clip.trimOut || (end - start);

      return `
        <div class="line-duration" style="width: 300px; height: 60px; margin: 20px 0;">
          <div class="line-duration-track" style="position: relative; width: 100%; height: 100%; background: #2a2a2a; border-radius: 4px; cursor: pointer;">
            <div class="line-duration-trimmed" style="position: absolute; left: ${(trimIn / (end - start)) * 100}%; width: ${((trimOut - trimIn) / (end - start)) * 100}%; height: 100%; background: #4a9eff; border-radius: 2px; opacity: 0.8;"></div>
            <div class="line-duration-handle line-duration-handle-in" style="position: absolute; left: ${(trimIn / (end - start)) * 300 - 8}px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; background: #ff6b6b; border-radius: 50%; cursor: ew-resize; border: 2px solid #fff; z-index: 10;"></div>
            <div class="line-duration-handle line-duration-handle-out" style="position: absolute; left: ${(trimOut / (end - start)) * 300 - 8}px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; background: #4ecdc4; border-radius: 50%; cursor: ew-resize; border: 2px solid #fff; z-index: 10;"></div>
            <div class="line-duration-display" style="position: absolute; top: -24px; left: ${(trimIn / (end - start)) * 300}px; background: #1a1a1a; color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 12px;">${(trimOut - trimIn).toFixed(2)}s</div>
          </div>
        </div>
      `;
    }

    async function generateClip() {
      if (!(await requireEntitlement())) return;
      if (!els.promptInput || !els.negativeInput || !els.durationSelect || !els.aspectSelect || !els.styleSelect) {
        return;
      }
      const prompt = els.promptInput.value.trim();
      const negativePrompt = els.negativeInput.value.trim();
      const duration = els.durationSelect.value;
      const aspect = els.aspectSelect.value;
      const style = els.styleSelect.value;

      if (!prompt) {
        return;
      }

      if (state.isProcessing) {
        return;
      }

      state.isProcessing = true;

      try {
        let generationResult;

        // Determine generation endpoint based on type
        if (state.generateType === 'Text') {
          // For text generation, create a text clip directly
          const clipId = Date.now();
          const clip = {
            id: clipId,
            name: `Text: ${prompt.slice(0, 18)}`,
            left: 0,
            width: 14,
            type: 'text',
            heading: prompt.slice(0, 40),
            body: negativePrompt || `Generated text content for: ${prompt}`
          };
          insertClipIntoTrack(clip, 'Text');
          return;
        }

        // Check if Supabase is configured before making requests
        if (!supabase || typeof supabase.functions?.invoke !== 'function') {
          throw new Error('Generation features require Supabase configuration');
        }

        if (state.generateType === 'Image' || state.generateType === 'B-Roll') {
          // Generate image using muapi-proxy
          const { data, error } = await supabase.functions.invoke('muapi-proxy', {
            body: {
              endpoint: 'predictions',
              method: 'POST',
              data: {
                model: 'flux-dev',
                prompt: prompt,
                negative_prompt: negativePrompt,
                aspect_ratio: aspect === '16:9' ? '16:9' : aspect === '9:16' ? '9:16' : '1:1',
                style: style.toLowerCase()
              }
            }
          });

          if (error) throw error;
          generationResult = data;
        } else {
          // Collect subtitles from timeline if available
          const subtitleTrack = state.project?.tracks?.find(t => t.type === 'subtitle' || t.type === 'text');
          const subtitles = subtitleTrack?.items?.map(item => ({
            start: item.start,
            end: item.end,
            text: item.text || item.name
          })) || [];

          // Video generation with timeline subtitles
          const { data, error } = await supabase.functions.invoke('muapi-proxy', {
            body: {
              endpoint: 'video-generation',
              method: 'POST',
              data: {
                prompt: prompt,
                negative_prompt: negativePrompt,
                duration: duration,
                aspect_ratio: aspect === '16:9' ? '16:9' : aspect === '9:16' ? '9:16' : '1:1',
                style: style.toLowerCase(),
                subtitles: subtitles.length > 0 ? subtitles : undefined,
                timelineData: prepareTimelineForVideoGeneration(),
                cinegenTools: {
                  enabled: true,
                  availableTools: ['gap_fill', 'extend', 'music_generation', 'mask_tool', 'element_create', 'llm_chat', 'fill_gap', 'extend_clip'],
                  structuredResults: true,
                  version: '1.1',
                  autoApply: true
                }
              }
            }
          });

          if (error) throw error;
          generationResult = data;
        }

        // Process the generation result
        if (generationResult && generationResult.url) {
          const clipId = Date.now();
          let clip;

          if (state.generateType === 'Image' || state.generateType === 'B-Roll') {
            clip = {
              id: clipId,
              name: `${state.generateType}: ${prompt.slice(0, 18)}`,
              left: 0,
              width: 14,
              type: 'image',
              src: generationResult.url,
              fit: 'contain'
            };
          } else {
            clip = {
              id: clipId,
              name: `Video: ${prompt.slice(0, 18)}`,
              left: 0,
              width: parseInt(duration) * 2, // Rough width based on duration
              type: 'video',
              src: generationResult.url,
              poster: generationResult.thumbnail_url
            };
          }

          insertClipIntoTrack(clip, state.generateType === 'B-Roll' ? 'B-Roll' : 'Video');

          // Add to media library
          state.mediaLibrary.push({
            id: clipId,
            name: clip.name,
            type: state.generateType.toLowerCase(),
            url: generationResult.url,
            generatedAt: new Date().toISOString(),
            prompt: prompt
          });


          // Offer personalization suite for video generation
          if (state.generateType !== 'Image' && state.generateType !== 'Text') {
            // Store the generated video for personalization
            state.lastGeneratedVideo = {
              id: clipId,
              name: clip.name,
              src: generationResult.url,
              poster: generationResult.thumbnail_url,
              prompt: prompt,
              generatedAt: new Date().toISOString()
            };

            setTimeout(() => {
              // Create a toast with personalization offer
              const toast = document.createElement('div');
              toast.className = 'personalization-toast';
              toast.innerHTML = `
                <div class="toast-content">
                  <div class="toast-icon">🎬</div>
                  <div class="toast-text">
                    <strong>Video Ready!</strong>
                    <br>
                    <small>Personalize this video for your audience?</small>
                  </div>
                  <div class="toast-actions">
                    <button class="toast-btn toast-btn-secondary" onclick="this.closest('.personalization-toast').remove()">Maybe Later</button>
                    <button class="toast-btn toast-btn-primary" onclick="window.openVideoPersonalizationHubModal(); this.closest('.personalization-toast').remove()">Personalize Now</button>
                  </div>
                </div>
              `;

              // Add toast styles
              const existingToast = document.querySelector('.personalization-toast');
              if (existingToast) existingToast.remove();

              toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: var(--panel);
                border: 1px solid var(--border);
                border-radius: 20px;
                box-shadow: var(--shadow);
                padding: 20px;
                max-width: 320px;
                font-family: inherit;
              `;

              // Add button styles
              const style = document.createElement('style');
              style.textContent = `
                .toast-content { display: flex; align-items: center; gap: 12px; }
                .toast-icon { font-size: 24px; }
                .toast-text { flex: 1; }
                .toast-actions { display: flex; gap: 8px; margin-top: 12px; }
                .toast-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 12px; }
                .toast-btn-primary { background: var(--cyan); color: white; }
                .toast-btn-secondary { background: transparent; color: var(--text); }
                .toast-btn:hover { transform: translateY(-1px); }
              `;

              if (!document.querySelector('#toast-styles')) {
                style.id = 'toast-styles';
                document.head.appendChild(style);
              }

              document.body.appendChild(toast);

              // Auto-remove after 10 seconds
              setTimeout(() => {
                if (toast.parentNode) {
                  toast.remove();
                }
              }, 10000);
            }, 2000); // Show after 2 seconds
          }
        } else {
          throw new Error('No result URL returned from generation');
        }

       } catch (error) {
         console.error('Generation error:', error);
         // Provide user-friendly error messages
         const msg = error.message || '';
         
         if (msg.includes('401') || msg.includes('auth')) {
         } else if (msg.includes('Supabase') || msg.includes('configuration')) {
         } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Network')) {
         } else if (msg.includes('API key not configured') || msg.includes('service is not configured')) {
         } else {
         }
       } finally {
         state.isProcessing = false;
         // Save project state after generation (debounced)
         debouncedSave();
       }
    }

    // Interactive addon runtime (Skip / Pause / Loop / Lead Generator gate /
    // List Builder). Replaces upstream's Popcorn start/end hooks: each
    // playback tick reports the playhead move and applies the actions.
    const addonRuntime = new AddonRuntime();
    let addonResumeTimer = null;
    function allClips() {
      return state.tracks.flatMap((t) => t.items || t.clips || []);
    }
    function pausePlaybackForAddon() {
      state.playing = false;
      window.clearInterval(playbackTimer);
      remotionEngine?.pause();
    }
    function runAddonTick(prevPercent, nowPercent) {
      const T = state.timelineSeconds || 60;
      const actions = addonRuntime.tick((prevPercent / 100) * T, (nowPercent / 100) * T, {
        clips: allClips(),
        timelineSeconds: T,
        listBuilder: state.listBuilder,
      });
      for (const action of actions) {
        if (action.type === 'seek') {
          state.playheadPercent = Math.max(0, Math.min(100, (action.time / T) * 100));
        } else if (action.type === 'pause') {
          pausePlaybackForAddon();
          if (action.resumeAfter) {
            window.clearTimeout(addonResumeTimer);
            addonResumeTimer = window.setTimeout(() => {
              if (!state.playing) togglePlayback();
            }, action.resumeAfter * 1000);
          }
        } else if (action.type === 'show') {
          if (action.overlay === 'pause-continue') {
            showPauseOverlay(addonOverlayLayer(), {
              text: addonOptions(action.clip).continueText || 'Click to continue',
              onContinue: () => { if (!state.playing) togglePlayback(); },
            });
          } else if (action.overlay === 'lead-form') {
            // Show the Lead Generator's own preview (with its submit/skip
            // handlers) and hold playback until it is completed.
            state.selectedClipId = action.clip.id;
            action.clip._gating = true;
            updatePreview(action.clip);
            renderTracks();
          } else if (action.overlay === 'list-builder') {
            openListBuilderOverlay();
          }
        }
      }
      return actions.length > 0;
    }

    function togglePlayback() {
      state.playing = !state.playing;
      if (state.playing) {
        window.clearTimeout(addonResumeTimer);
        clearOverlay(addonOverlayLayer(), 'pause-continue');
        // A List Builder at the very start gates before the first frame.
        if (runAddonTick(state.playheadPercent, state.playheadPercent) && !state.playing) {
          updatePlaybackUI();
          return;
        }
        if (remotionEngine) {
          // The Player is the clock; handleEngineFrame follows it.
          if (state.playheadPercent >= 100) state.playheadPercent = 0;
          remotionEngine.seekToFrame(percentToFrame(state.playheadPercent));
          remotionEngine.play();
          updatePlaybackUI();
          return;
        }
        playbackTimer = window.setInterval(() => {
          const prevPercent = state.playheadPercent;
          state.playheadPercent += 0.6;
          if (state.playheadPercent >= 100) {
            state.playheadPercent = 100;
            state.playing = false;
            window.clearInterval(playbackTimer);
          }
          runAddonTick(prevPercent, state.playheadPercent);
          updatePlaybackUI();
          // Apply keyframes during playback
          const selected = findSelectedClip();
          if (selected) {
            updatePreview(selected);
          }
        }, 120);
      } else {
        window.clearInterval(playbackTimer);
        remotionEngine?.pause();
      }
      updatePlaybackUI();
    }

    function stopPlayback() {
      state.playing = false;
      window.clearInterval(playbackTimer);
      remotionEngine?.pause();
      window.clearTimeout(addonResumeTimer);
      clearOverlay(addonOverlayLayer());
      // Stop = replay from the top: forms gate again, as a fresh viewer
      // would see them.
      addonRuntime.reset();
      if (state.listBuilder) state.listBuilder._submitted = false;
      allClips().forEach((c) => { if (c.type === 'lead-form') { c._submitted = false; c._gating = false; } });
      state.playheadPercent = 0;
      updatePlaybackUI();
      const media = els.previewStage.querySelector('video, audio');
      if (media) media.currentTime = 0;
    }

    function rewindPlayback() {
      state.playing = false;
      window.clearInterval(playbackTimer);
      remotionEngine?.pause();
      state.playheadPercent = Math.max(0, state.playheadPercent - 10);
      updatePlaybackUI();
    }

    function jumpToEndPlayback() {
      state.playing = false;
      window.clearInterval(playbackTimer);
      remotionEngine?.pause();
      state.playheadPercent = 100;
      updatePlaybackUI();
    }

    async function handleUpload(file) {
      if (!file) return;

      // Route through the unified upload pipeline. The pipeline handles
      // validation (magic bytes), metadata extraction, Supabase upload,
      // asset creation, timeline insertion (track.items via alias),
      // undo snapshot, persistence, and toast.
      await processFileUpload(file, {
        state,
        showToast: (msg, type) => {
          // Use the page's existing toast mechanism if available
          if (typeof showToast === 'function') showToast(msg, type);
        },
        renderTracks: () => {
          try { renderTracks(); } catch (e) { /* best-effort */ }
        }
      });
    }

    // Rendiv Animation Demo Functions
    function bindEvents() {
      // Bind whatever exists — never abort the whole batch because one
      // optional surface (generateBtn, backBtn) is not in the template.
      const required = ['playBtn','stopBtn','rewindBtn','generateBtn','uploadBtn','uploadInput','backBtn'];
      const missing = required.filter(id => !els[id]);
      if (missing.length) {
        console.warn('[Timeline] Optional elements not present, binding rest:', missing);
      }

      els.playBtn?.addEventListener('click', togglePlayback);
      els.stopBtn?.addEventListener('click', stopPlayback);
      els.rewindBtn?.addEventListener('click', rewindPlayback);

      // Viewer mode switching
      const viewerModeBtns = root.querySelectorAll('.viewer-mode-btn');
      viewerModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          viewerModeBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.viewerMode = btn.dataset.viewer || 'timeline';
          renderPreviewAsset(state.viewerMode === 'source' ? findSelectedClip() : null);
        });
      });
      els.generateBtn?.addEventListener('click', () => openAiTools('generate'));

      // Header top actions (prototype skeleton, listeners-only)
      bindTopActions();

      // Timeline-top toolbar (redesign: playback / edit groups match prototype)
      const tbRewind = root.querySelector('#tbRewind');
      const tbPlay = root.querySelector('#tbPlay');
      const tbStop = root.querySelector('#tbStop');
      const tbSplit = root.querySelector('#tbSplit');
      const tbDelete = root.querySelector('#tbDelete');
      const tbAddTrack = root.querySelector('#tbAddTrack');
      const tbMerge = root.querySelector('#tbMerge');
      const tbInsertMode = root.querySelector('#tbInsertMode');
      const tbOverwriteMode = root.querySelector('#tbOverwriteMode');
      const tbSnap = root.querySelector('#tbSnap');
      const tbMask = root.querySelector('#tbMask');
      if (tbRewind) tbRewind.addEventListener('click', rewindPlayback);
      if (tbPlay) tbPlay.addEventListener('click', togglePlayback);
      if (tbStop) tbStop.addEventListener('click', jumpToEndPlayback);
      if (tbSplit) tbSplit.addEventListener('click', splitClipAtPlayhead);
      if (tbDelete) tbDelete.addEventListener('click', deleteSelectedClip);
      if (tbAddTrack) tbAddTrack.addEventListener('click', () => addTrack('Video'));
      if (tbMerge) tbMerge.addEventListener('click', mergeAdjacentClipWithNeighbor);
      if (tbInsertMode) tbInsertMode.addEventListener('click', () => {
        state.insertMode = true; state.overwriteMode = false;
        tbInsertMode.classList.add('active'); tbOverwriteMode?.classList.remove('active');
        tbInsertMode.setAttribute('aria-pressed', 'true'); tbOverwriteMode?.setAttribute('aria-pressed', 'false');
        showToast('Insert mode', 'info');
      });
      if (tbOverwriteMode) tbOverwriteMode.addEventListener('click', () => {
        state.overwriteMode = true; state.insertMode = false;
        tbOverwriteMode.classList.add('active'); tbInsertMode?.classList.remove('active');
        tbOverwriteMode.setAttribute('aria-pressed', 'true'); tbInsertMode?.setAttribute('aria-pressed', 'false');
        showToast('Overwrite mode', 'info');
      });
      if (tbSnap) tbSnap.addEventListener('click', () => {
        state.snapEnabled = !state.snapEnabled;
        tbSnap.classList.toggle('active', state.snapEnabled);
        tbSnap.setAttribute('aria-pressed', String(state.snapEnabled));
        showToast(`Snap ${state.snapEnabled ? 'ON' : 'OFF'}`, 'info');
      });
      if (tbMask) tbMask.addEventListener('click', () => selectTool('mask'));

      if (els.addTimelineTabBtn) {
        els.addTimelineTabBtn.addEventListener('click', () => {
          addNewTimeline(state);
          renderAll();
          showToast('New timeline tab created', 'success');
        });
      }

      // Keyboard shortcuts
      root.setAttribute('tabindex', '0');
      root.addEventListener('keydown', (ev) => {
        const tag = (ev.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || (ev.target && ev.target.isContentEditable)) return;
        const key = ev.key.toLowerCase();
        if (key === ' ' || key === 'spacebar') { ev.preventDefault(); togglePlayback(); }
        else if (key === 'arrowleft') { ev.preventDefault(); state.playheadPercent = Math.max(0, (state.playheadPercent || 0) - 0.8); updatePlaybackUI(); }
        else if (key === 'arrowright') { ev.preventDefault(); state.playheadPercent = Math.min(100, (state.playheadPercent || 0) + 0.8); updatePlaybackUI(); }
        else if (key === 's' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); splitClipAtPlayhead(); }
        else if (key === 'delete' || key === 'backspace') { ev.preventDefault(); deleteSelectedClip(); }
        else if ((ev.ctrlKey || ev.metaKey) && key === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(state); }
        else if ((ev.ctrlKey || ev.metaKey) && (key === 'y' || (key === 'z' && ev.shiftKey))) { ev.preventDefault(); redo(state); }
        else if ((ev.ctrlKey || ev.metaKey) && key === 'd') { ev.preventDefault(); duplicateSelectedClip(); }
        else if ((ev.ctrlKey || ev.metaKey) && key === 'g') { ev.preventDefault(); groupSelectedClips(); }
        else if ((ev.ctrlKey || ev.metaKey) && key === 'shift' && ev.key.toLowerCase() === 'g') { ev.preventDefault(); ungroupSelectedClips(); }
        else if (key === '[') { nudgeSelectedClip(-0.5); }
        else if (key === ']') { nudgeSelectedClip(0.5); }
        else if ((ev.ctrlKey || ev.metaKey) && key === 'c') { ev.preventDefault(); copySelectedClip(); }
        else if ((ev.ctrlKey || ev.metaKey) && key === 'v') { ev.preventDefault(); pasteClipAtPlayhead(); }
        else if (toolMap[key] && !ev.ctrlKey && !ev.metaKey) {
          ev.preventDefault();
          const toolKey = key;
          state.selectedTool = toolMap[toolKey];
          renderTools();
          updatePreview();
          if (toolMap[toolKey] === 'mask') {
            showToast('Mask tool active — select a clip and open AI Tools to segment');
          }
        }
      });

      // Zoom controls (prototype: out / track / in / fit)
      const zoomOutBtn = root.querySelector('[data-action="zoom-out"]');
      const zoomInBtn = root.querySelector('[data-action="zoom-in"]');
      const zoomFitBtn = root.querySelector('[data-action="zoom-fit"]');
      const setZoom = (next) => { state.zoom = Math.max(0.5, Math.min(2, next)); renderTracks(); };
      if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setZoom((state.zoom || 1) - 0.25));
      if (zoomInBtn) zoomInBtn.addEventListener('click', () => setZoom((state.zoom || 1) + 0.25));
      if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => setZoom(1));

      // Mask overlay click/box capture for AI segmentation
      const maskOverlay = root.querySelector('#maskOverlay');
      if (maskOverlay) {
        maskOverlay.addEventListener('click', (e) => {
          if (selectedToolLabel() !== 'Mask') return;
          const rect = maskOverlay.getBoundingClientRect();
          maskClickPoint = {
            x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
          };
        });
        maskOverlay.addEventListener('mousedown', (e) => {
          if (selectedToolLabel() !== 'Mask') return;
          const rect = maskOverlay.getBoundingClientRect();
          normStartX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          normStartY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          maskSelectionBox = null;
        });
        maskOverlay.addEventListener('mouseup', (e) => {
          if (selectedToolLabel() !== 'Mask') return;
          const rect = maskOverlay.getBoundingClientRect();
          const endX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const endY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          maskSelectionBox = {
            x: Math.min(normStartX, endX),
            y: Math.min(normStartY, endY),
            w: Math.abs(endX - normStartX),
            h: Math.abs(endY - normStartY),
          };
        });
      }

      // The preview is always edge-to-edge (see .preview-large CSS in
      // timeline-editor-page.css) — no toggle, no button, always on.

      // Generate card tiles (prototype-style) → open the matching surface
      const genAutoCut = root.querySelector('#genAutoCut');
      const genSubtitles = root.querySelector('#genSubtitles');
      const genAiVideo = root.querySelector('#genAiVideo');
      const genCutAi = root.querySelector('#genCutAi');
      const openSubtitleEditorBtn = root.querySelector('#openSubtitleEditor');
      if (genAutoCut) genAutoCut.addEventListener('click', () => openTemplateGeneratorModal(state, showToast));
      if (genSubtitles) genSubtitles.addEventListener('click', () => generateSubtitles());
      if (genAiVideo) genAiVideo.addEventListener('click', () => openAiTools('fill_gap'));
      if (genCutAi && window.showCutAIFromTimeline) genCutAi.addEventListener('click', () => window.showCutAIFromTimeline());
      if (openSubtitleEditorBtn) openSubtitleEditorBtn.addEventListener('click', () => generateSubtitles());
      const ccReset = root.querySelector('#ccReset');
      const ccLuts = root.querySelector('#ccLuts');
      if (ccReset) ccReset.addEventListener('click', () => { const f = root.querySelectorAll('#colorCorrectionPanel input[type="range"]'); f.forEach(i => i.value = 0); });
      if (ccLuts) ccLuts.addEventListener('click', () => openPanel('colorScopesPanel'));

      // Media Library → Timeline (HTML5 drag-and-drop, native).
      // The 4 static media items are draggable="true"; this delegation listener
      // sets the dataTransfer payload that the lane drop zone (see renderTracks
      // lane binding, ~line 2032) expects. Aligns with the lane's
      // `application/json` + { type: 'media', mediaType, label, src } contract.
      const mediaGrid = root.querySelector('#mediaGrid');
      if (mediaGrid) {
        mediaGrid.addEventListener('dragstart', (e) => {
          const item = e.target.closest('.media-item');
          if (!item || !item.hasAttribute('draggable')) return;
          const mediaType = item.getAttribute('data-type') || 'video';
          const label = item.getAttribute('data-label') || item.querySelector('.media-label')?.textContent || 'Media';
          const payload = { type: 'media', mediaType, label, src: null };
          try {
            e.dataTransfer.setData('application/json', JSON.stringify(payload));
            e.dataTransfer.effectAllowed = 'move';
            // Hide the default browser drag image (a translucent item ghost is
            // awkward over a track lane; the lane's drop highlight is enough).
            const ghost = document.createElement('div');
            ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 0, 0);
            requestAnimationFrame(() => ghost.remove());
          } catch (err) {
            console.warn('[Timeline] media dragstart failed', err);
          }
        });
      }

      // Body class toggle during any active drag — the rail overlay rule in
      // styles/timeline-editor-page.css uses `body.is-dragging .floating-rail`
      // to drop pointer-events so the rail can't intercept drops that land
      // near the bottom of the timeline.
      const onDragStartAny = () => document.body.classList.add('is-dragging');
      const onDragEndAny = () => document.body.classList.remove('is-dragging');
      document.addEventListener('dragstart', onDragStartAny);
      document.addEventListener('dragend', onDragEndAny);
      document.addEventListener('drop', onDragEndAny);

      // Feature-index chips (prototype parity) → open the matching editor surface
      root.querySelectorAll('.fi-chip, .media-item[data-modal]').forEach(chip => {
        const key = chip.getAttribute('data-modal');
        const handler = FEATURE_INDEX_MODALS[key];
        if (handler) chip.addEventListener('click', handler);
      });

      els.uploadBtn?.addEventListener('click', () => els.uploadInput?.click());
      els.uploadInput?.addEventListener('change', (event) => handleUpload(event.target.files?.[0]));

      // Browse Stock Media: Pixabay + Pexels videos and images, added to
      // the timeline at the playhead (the Stock Media panel).
      els.pexelsMediaBtn?.addEventListener('click', () => openPanel('stockPanel'));
      initWebMcp().catch((err) => console.warn('[WebMCP] unavailable', err));
      root.querySelector('#openAgents')?.addEventListener('click', () => openPanel('aiAgentPanel'));

      // VideoDB: add an indexed video to the timeline using the user's VideoDB
      // API key (configured in Settings).
      if (els.videoDbBtn) {
        els.videoDbBtn.addEventListener('click', () => {
          const id = prompt('Enter a VideoDB media id (e.g. m-12345):');
          if (id && typeof window.__addVideoDBMedia === 'function') {
            window.__addVideoDBMedia(id.trim());
          }
        });
      }
      if (els.backBtn) els.backBtn.addEventListener('click', () => showToast('Back action clicked'));

      // Mobile side-panel tab switching. On desktop all panels are visible
      // (CSS overrides `hidden` attribute). On mobile, only the active tab's
      // panel is shown. Keyboard arrow-key navigation is included for a11y.
      const sideTabs = root.querySelectorAll('.side-tab');
      const sidePanels = {
        media: root.querySelector('#sidePanelMedia'),
        tools: root.querySelector('#sidePanelTools'),
        generate: root.querySelector('#sidePanelGenerate'),
      };
      function activateSideTab(tabName) {
        sideTabs.forEach(tab => {
          const isActive = tab.dataset.tab === tabName;
          tab.classList.toggle('active', isActive);
          tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        Object.entries(sidePanels).forEach(([name, panel]) => {
          if (!panel) return;
          panel.hidden = name !== tabName;
        });
      }
      sideTabs.forEach(tab => {
        tab.addEventListener('click', () => activateSideTab(tab.dataset.tab));
        tab.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            const tabsArr = Array.from(sideTabs);
            const currentIdx = tabsArr.indexOf(tab);
            const delta = event.key === 'ArrowRight' ? 1 : -1;
            const nextIdx = (currentIdx + delta + tabsArr.length) % tabsArr.length;
            tabsArr[nextIdx].focus();
            activateSideTab(tabsArr[nextIdx].dataset.tab);
          }
        });
      });

      root.querySelectorAll('[data-add-track]').forEach((button) => button.addEventListener('click', () => addTrack(button.dataset.addTrack)));
      // Zoom in/out are bound once in the zoom-controls block above (single binding).

      const cutaiBtn = root.querySelector('#cutaiStoryboardBtn');
      if (cutaiBtn) cutaiBtn.addEventListener('click', () => showCutAI());

      root.querySelector('#openAiTools')?.addEventListener('click', () => openAiTools());

      // Camera FX quick buttons: apply the effect, with its default settings, to the selected clip.
      root.querySelectorAll('[data-camera-effect]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!cameraEffects) initializeCameraEffects();
          const selected = findSelectedClip();
          if (!selected) { showToast('Select a clip on the timeline first.', 'info'); return; }
          cameraEffects?.applyQuick(btn.dataset.cameraEffect, selected.id);
        });
      });
    }

      const clearBtn = root.querySelector('#clearCineGenResults');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          cinegenHistory = [];
          renderAiToolHistory();
          
        });
      }

    function renderAll() {
      renderTools();
      renderPills();
      renderTracks();
      renderMedia();
      renderGenerateTypes();
      renderTimelineTabs();

      renderRail();
      renderMultiCamera();
      updatePreview();
      updatePlaybackUI();
    }

    function renderMultiCamera() {
      if (!els.multiCameraToolbar) return;
      renderMultiCamPanel(els.multiCameraToolbar, state, {
        changed: () => { scheduleEngineUpdate(); debouncedSave(); },
        toast: showToast,
        addVideoTrack: () => {
          const n = state.tracks.filter((t) => String(t.type || '').toLowerCase() === 'video').length + 1;
          const track = { id: `track-video-${Date.now().toString(36)}`, type: 'video', name: `Camera ${n}`, muted: false, solo: false, locked: false, items: [] };
          const lastVideo = state.tracks.map((t) => String(t.type || '').toLowerCase()).lastIndexOf('video');
          state.tracks.splice(lastVideo + 1, 0, track);
          renderTracks();
          return track;
        },
        moveSelectedTo: (trackId) => {
          const from = state.tracks.find((t) => (t.items || []).some((c) => c.id === state.selectedClipId));
          const to = state.tracks.find((t) => t.id === trackId);
          if (!from || !to || from === to) return false;
          const clip = from.items.find((c) => c.id === state.selectedClipId);
          if (clip.type !== 'video' && clip.type !== 'image') return false;
          saveStateSnapshot(state);
          from.items.splice(from.items.indexOf(clip), 1);
          (to.items = to.items || []).push(clip);
          renderTracks();
          return true;
        },
      });
    }

    function renderTimelineTabs() {
      if (!els.timelineTabsContainer) return;
      const timelines = timelineList(state);
      const selectedId = currentTimelineId(state);
      els.timelineTabsContainer.innerHTML = timelines.map(t => `
        <button class="mini-btn timeline-tab-btn ${t.id === selectedId ? 'active' : ''}" data-timeline-id="${t.id}" title="${escapeHtml(t.projectTitle || 'Untitled')}">
          ${escapeHtml(t.projectTitle || 'Timeline')}
          <span class="tab-close" data-timeline-id="${t.id}" title="Close tab">×</span>
        </button>
      `).join('');

      els.timelineTabsContainer.querySelectorAll('.timeline-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (e.target.classList.contains('tab-close')) {
            e.stopPropagation();
            const id = e.target.dataset.timelineId;
            const idx = timelineList(state).findIndex(t => t.id === id);
            if (idx > -1 && timelineCount(state) > 1) {
              // Switch before removing: switchToTimeline syncs the live state
              // into the current tab, which must still be the tab being closed
              // here. Removing first makes the pointer dangle, so the sync
              // would land on (and overwrite) the surviving fallback tab.
              if (currentTimelineId(state) === id) {
                const fallback = timelineList(state).find(t => t.id !== id);
                if (fallback) switchToTimeline(state, fallback.id);
              }
              removeTimelineById(state, id);
              renderAll();
            }
            return;
          }
          switchToTimeline(state, btn.dataset.timelineId);
          renderAll();
        });
      });
    }

     // Color correction system not implemented

     // Load asset from URL parameter if present (Universal Asset Pipeline handoff)
     (async () => {
       try {
         const params = new URLSearchParams(window.location.search);
         const assetId = params.get('asset');
         if (assetId) {
           const asset = await assetStore.getAsset(assetId);
           if (asset) {
             // Determine media type
             let mediaType = 'file';
             if (asset.type === 'video') mediaType = 'video';
             else if (asset.type === 'image') mediaType = 'image';
             else if (asset.type === 'audio') mediaType = 'audio';
             // Build media object expected by addMediaToTimeline
             const media = {
               type: mediaType,
               url: asset.media?.url,
               thumbnail: asset.media?.thumbnail,
               label: asset.title,
               source: 'pipeline',
               id: asset.id,
               duration: asset.metadata?.duration || 5
             };
             // Add to timeline media library
             addMediaToTimeline(media, state.mediaLibrary?.length || 0, state, showToast);
             
           } else {
             
           }
         }
       } catch (e) {
         console.error('Failed to load asset from pipeline:', e);
       }
     })();

      renderAll();
      bindEvents();
      bindInteractivePanel();
      renderOverlaysPanel();
      renderContactSwitcher();
      // Logo brightness for "Auto" backing plates (once per logo, saved).
      setTimeout(() => { measureLogos().catch(() => {}); }, 1500);
      renderBlendPanel();
      bindOverlayPresets();
      initRemotionEngine();
      window.addEventListener('resize', () => renderOverlayLayer());
      setupEnhancedTooltips();
      setupUploadSources({ state, showToast });

      // Initialize media ingest components
    integrateMediaIngest();

    // Render enhanced timeline controls
    const timelineControlsContainer = document.getElementById('timelineControlsEnhanced');
    if (timelineControlsContainer) {
      renderTimelineControls(state, timelineControlsContainer);
    }

    // Initialize transition system
    // Prototype parity: skip in-lane "Drop transition here" drop-zone injection.
    // Transition editing stays available via the rail's Transitions Panel.
    // initializeTimelineTransitions();
    initializeTransitionEditor();

    // Initialize scene detector
    initializeSceneDetector();
    initializeCameraEffects();
    initializeAIChatPanel();

    // Initialize multi-camera functionality
    window.timelineState = state; // Make state globally accessible for multi-camera functions
    TLEditor.state = state; // Exposed on namespace to avoid polluting global scope
    // External systems (e.g. media-library drag-drop in src/lib/editor/dragDrop.js)
    // need a way to ask the timeline to re-render after they mutate state directly.
    // The legacy addMediaToTimeline helper mutates the track's items array but
    // does not re-render — without this hook the dropped clip never appears.
    window.__timelineRender = function __timelineRender() {
      try { renderTracks(); } catch (e) { console.warn('[Timeline] render via global hook failed', e); }
    };

    // Initialize AI agent integration
    initializeAgentSystem(state, showToast);
    // CineGen agent tools registered via cinegenIntegration.js + standalone app

    // Agent system functions - integrated with MuAPI
    function initializeAgentSystem(state, showToast) {
      // Make timeline state available globally for AI analysis
      window.timelineState = state;
      TLEditor.state = state;
      
      // Initialize agent hooks if available
      if (typeof initTimelineAgentIntegration === 'function') {
        const timelineEditorInterface = {
          getState: () => state,
          getSelectedClips: () => {
            const selectedClip = state.tracks.flatMap(track => track.clips).find(item => item.id === state.selectedClipId);
            return selectedClip ? [selectedClip] : [];
          },
          showNotification: (options) => {
          }
        };

        try {
          const agentIntegration = initTimelineAgentIntegration(timelineEditorInterface, {
            theme: 'electric',
            autoEnableAgents: false
          });
          root._agentIntegration = agentIntegration;
        } catch (e) {
          console.log('Agent integration skipped:', e.message);
        }
      }
    }

    function openCharacterTrackingPanel(state, showToast) {
      try {
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = `
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
          background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          border: 1px solid var(--border); border-radius: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
          max-width: 400px; width: 90%;
        `;
        
        modalContent.innerHTML = `
          <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.2);">
            <h3 style="margin: 0; color: rgba(255,255,255,0.9);">Character Tracking</h3>
            <button class="modal-close" style="background: none; border: none; color: rgba(255,255,255,0.6); font-size: 20px; cursor: pointer; padding: 4px;">✕</button>
          </div>
          <div class="modal-body" style="padding: 24px;">
            <p style="color: rgba(255,255,255,0.7); margin-bottom: 16px;">Track and maintain character consistency across clips.</p>
            <div style="display: grid; gap: 8px; margin-bottom: 16px;">
              <button style="padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 8px; cursor: pointer;">Detect Characters</button>
              <button style="padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 8px; cursor: pointer;">Apply Consistency Rules</button>
            </div>
            <div style="display: flex; justify-content: flex-end;">
              <button id="close-character" style="padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid var(--border); border-radius: 8px; cursor: pointer;">Close</button>
            </div>
          </div>
        `;
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        const closeModal = () => document.body.removeChild(modalOverlay);
        modalContent.querySelector('.modal-close').addEventListener('click', closeModal);
        modalContent.querySelector('#close-character').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => e.target === modalOverlay && closeModal());
        
        
      } catch (error) {
        console.error('Failed to open Character Tracking panel:', error);
        
      }
    }

    function openTimelineAnalysisPanel(state, showToast) {
      try {
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = `
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
          background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          border: 1px solid var(--border); border-radius: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
          max-width: 450px; width: 90%;
        `;
        
        modalContent.innerHTML = `
          <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.2);">
            <h3 style="margin: 0; color: rgba(255,255,255,0.9);">Timeline Analysis</h3>
            <button class="modal-close" style="background: none; border: none; color: rgba(255,255,255,0.6); font-size: 20px; cursor: pointer; padding: 4px;">✕</button>
          </div>
          <div class="modal-body" style="padding: 24px;">
            <p style="color: rgba(255,255,255,0.7); margin-bottom: 16px;">Analyze timeline for gaps, scene changes, and improvement suggestions.</p>
            <div id="analysis-results" style="margin-bottom: 16px; max-height: 200px; overflow-y: auto;"></div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button id="close-analysis" style="padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid var(--border); border-radius: 8px; cursor: pointer;">Close</button>
            </div>
          </div>
        `;
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        const resultsDiv = modalContent.querySelector('#analysis-results');
        resultsDiv.innerHTML = `
          <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px;">
            <div style="color: rgba(255,255,255,0.5); font-weight: 500;">Analysis running...</div>
            <div style="color: rgba(255,255,255,0.4); font-size: 12px;">Detect scenes from the Scene Detector panel for real results.</div>
          </div>
        `;
        
        const closeModal = () => document.body.removeChild(modalOverlay);
        modalContent.querySelector('.modal-close').addEventListener('click', closeModal);
        modalContent.querySelector('#close-analysis').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => e.target === modalOverlay && closeModal());
        
      } catch (error) {
        console.error('Failed to open Timeline Analysis panel:', error);
      }
    }

    // FEATURE HELPERS — insertion maintain the track.items / track.clips alias.
    // Every mutation path below sets track.items = track.clips after reassigning
    // .clips, so the renderer's path at ~line 2015 (track.items first) stays
    // in sync. These helpers are referenced from the drop handler at ~2074 and
    // from bindEvents() for keyboard actions.

    function ensureItemsAlias(track) {
      if (!track) return;
      if (Array.isArray(track.items)) {
        track.clips = track.items;
      } else if (Array.isArray(track.clips)) {
        track.items = track.clips;
      } else {
        track.items = [];
        track.clips = track.items;
      }
    }

    function reAliasAllTracks(state) {
      (state.tracks || []).forEach(ensureItemsAlias);
    }

    // --- snapshot + undo helper ---
    function commitAndRender(state) {
      saveStateSnapshot(state);
      renderTracks();
    }

    // --- shift downstream clips after an insert point ---
    function shiftClipsAfter(track, fromPercent, byPercent) {
      if (!track || !Array.isArray(track.items)) return;
      track.items.forEach(clip => {
        const clipEnd = (clip.left || 0) + (clip.width || 0);
        if ((clip.left || 0) >= fromPercent - 0.05) {
          clip.left = clipEnd + byPercent; // advance so clips touch edge-to-edge
          // recalculate width unchanged, or we can keep it and just move left
          // we want the clip's left to be pushed to the right edge of the inserted clip
          clip.left = fromPercent + byPercent; // actual insert drift
        }
      });
      reAliasAllTracks(state);
    }

    // --- gap-aware insert shift: push right until a gap is reached ---
    function shiftClipsUntilGap(track, fromPercent, minFreePercent) {
      if (!track || !Array.isArray(track.items)) return;
      const sorted = [...track.items].sort((a, b) => (a.left || 0) - (b.left || 0));
      let cursor = fromPercent;
      for (const clip of sorted) {
        const clipEnd = (clip.left || 0) + (clip.width || 0);
        // if this clip sits before the insert point, update cursor to its end
        if ((clip.left || 0) + (clip.width || 0) <= fromPercent + 0.05) {
          cursor = Math.max(cursor, clipEnd);
        } else if ((clip.left || 0) < fromPercent - 0.05) {
          cursor = Math.max(cursor, clipEnd);
        }
      }
      return cursor;
    }

    // --- insert mode mutation: push downstream in the target track ---
    function applyInsertMode(track, insertLeft, insertWidth) {
      if (!state.insertMode || !track || !Array.isArray(track.items)) return;
      const sorted = [...track.items].sort((a, b) => (a.left || 0) - (b.left || 0));
      const drift = 0;
      for (const clip of sorted) {
        const clipStart = clip.left || 0;
        if (clipStart >= insertLeft - 0.05) {
          clip.left = clipStart + insertWidth;
        }
      }
      reAliasAllTracks(state);
    }

    // --- overwrite mode mutation: remove anything fully covered ---
    function applyOverwriteMode(track, insertLeft, insertWidth) {
      if (!state.overwriteMode || !track || !Array.isArray(track.items)) return;
      const insertEnd = insertLeft + insertWidth;
      track.items = track.items.filter(clip => {
        const clipEnd = (clip.left || 0) + (clip.width || 0);
        const clippedLeft = Math.max(clip.left || 0, insertLeft);
        const clippedRight = Math.min(clipEnd, insertEnd);
        return (clippedRight - clippedLeft) < 0.5; // keep anything not fully overwritten
      });
      reAliasAllTracks(state);
    }

    // --- ripple: trim tail past timeline end ---
    function trimTailPastEnd(track, timelineSeconds) {
      if (!track || !Array.isArray(track.items)) return;
      const limitPercent = 100;
      track.items = track.items.filter(clip => {
        const end = (clip.left || 0) + (clip.width || 0);
        return end <= limitPercent + 0.05;
      });
      reAliasAllTracks(state);
    }

    // --- snap-to-gap: find the nearest gap in a track, return center % ---
    function findNearestGap(track, clipWidthPercent, rawLeftPercent) {
      if (!track || !Array.isArray(track.items)) return null;
      const sorted = [...track.items].sort((a, b) => (a.left || 0) - (b.left || 0));
      const candidates = [];
      let prevEnd = 0;
      for (const clip of sorted) {
        const clipEnd = (clip.left || 0) + (clip.width || 0);
        const free = (clip.left || 0) - prevEnd;
        if (free >= clipWidthPercent - 0.1) {
          candidates.push({ left: prevEnd, width: free, dist: Math.abs(rawLeftPercent - (prevEnd + free / 2)) });
        }
        prevEnd = clipEnd;
      }
      const tailFree = 100 - prevEnd;
      if (tailFree >= clipWidthPercent - 0.1) {
        candidates.push({ left: prevEnd, width: tailFree, dist: Math.abs(rawLeftPercent - (prevEnd + tailFree / 2)) });
      }
      if (!candidates.length) return null;
      candidates.sort((a, b) => a.dist - b.dist);
      return candidates[0];
    }

    // --- merge selected clip with its touching neighbor ---
    function mergeAdjacentClipWithNeighbor() {
      const selId = state.selectedClipId;
      if (!selId) { showToast('Select a clip that is touching another clip to merge', 'info'); return null; }
      const found = null;
      for (const track of state.tracks) {
        if (!Array.isArray(track.items)) continue;
        if (!track.items.some(c => c.id === selId)) continue;
        const idx = track.items.findIndex(c => c.id === selId);
        if (idx < 0) continue;
        const center = track.items[idx];
        for (const dir of [-1, 1]) {
          const ni = idx + dir;
          if (ni < 0 || ni >= track.items.length) continue;
          const neighbor = track.items[ni];
          const cEnd = (center.left || 0) + (center.width || 0);
          const nEnd = (neighbor.left || 0) + (neighbor.width || 0);
          if (Math.abs((dir < 0 ? nEnd : (neighbor.left || 0)) - (dir < 0 ? (center.left || 0) : cEnd)) < 0.4) {
            const left = Math.min(center.left || 0, neighbor.left || 0);
            const width = Math.max(cEnd, nEnd) - left;
            const merged = {
              ...center,
              id: 'clip-' + Date.now(),
              left,
              width,
              name: [center.name, neighbor.name].filter(Boolean).join(' + ') || 'Merged',
              start: center.start != null ? center.start : (left / 100) * (state.timelineSeconds || 60),
              end: (left + width) / 100 * (state.timelineSeconds || 60)
            };
            track.items = track.items.filter(c => c.id !== center.id && c.id !== neighbor.id);
            track.items.push(merged);
            reAliasAllTracks(state);
            state.selectedClipId = merged.id;
            commitAndRender(state);
            showToast('Clips merged', 'success');
            return merged;
          }
        }
      }
      showToast('No touching neighbor found to merge', 'info');
      return null;
    }

    // --- grouping ---
    function groupSelectedClips() {
      const ids = Array.from(state.selectedClipIds || []);
      if (ids.length < 2) { showToast('Select 2+ clips with Ctrl+Click before grouping', 'info'); return; }
      const gid = 'grp-' + Date.now();
      ids.forEach(id => {
        for (const track of state.tracks) {
          const c = (track.items || []).find(x => x.id === id);
          if (c) { c.groupId = gid; break; }
        }
      });
      saveStateSnapshot(state);
      renderTracks();
      showToast(`Grouped ${ids.length} clips`, 'success');
    }

    function ungroupSelectedClips() {
      const ids = Array.from(state.selectedClipIds || []);
      let removed = 0;
      ids.forEach(id => {
        for (const track of state.tracks) {
          const c = (track.items || []).find(x => x.id === id);
          if (c && c.groupId) { delete c.groupId; removed++; break; }
        }
      });
      saveStateSnapshot(state);
      renderTracks();
      if (removed) showToast(`Ungrouped ${removed} clips`, 'success');
    }

    // --- copy/paste ---
    function copySelectedClip() {
      const t = findSelectedClip();
      if (!t) { showToast('Select a clip to copy', 'info'); return; }
      state.clipboard = JSON.parse(JSON.stringify(t));
      showToast('Clip copied', 'success');
    }

    function pasteClipAtPlayhead() {
      const template = state.clipboard;
      if (!template) { showToast('Clipboard is empty — copy a clip first', 'info'); return; }
      const targetTrack = state.tracks.find(tr => (tr.type || 'video') === (template.type || 'video')) || state.tracks[0];
      if (!targetTrack) return;
      const left = Math.max(0, Math.min(100 - (template.width || 16), (state.playheadPercent || 0)));
      const clone = { ...template, id: 'clip-' + Date.now(), left };
      targetTrack.items.push(clone);
      reAliasAllTracks(state);
      state.selectedClipId = clone.id;
      commitAndRender(state);
      showToast('Clip pasted', 'success');
    }

    // --- delete / duplicate selected ---
    function deleteSelectedClip() {
      const selId = state.selectedClipId;
      if (!selId) return;
      for (const track of state.tracks) {
        const before = track.items.length;
        track.items = track.items.filter(c => c.id !== selId);
        if (track.items.length !== before) { reAliasAllTracks(state); break; }
      }
      state.selectedClipId = null;
      commitAndRender(state);
    }

    function duplicateSelectedClip() {
      const t = findSelectedClip();
      if (!t) return;
      const track = state.tracks.find(tr => (tr.items || []).some(c => c.id === t.id));
      if (!track) return;
      const clone = { ...JSON.parse(JSON.stringify(t)), id: 'clip-' + Date.now(), left: Math.min(100 - (t.width || 16), (t.left || 0) + (t.width || 16)) };
      track.items.push(clone);
      reAliasAllTracks(state);
      state.selectedClipId = clone.id;
      commitAndRender(state);
      showToast('Clip duplicated', 'success');
    }

    // --- nudge selected clip by delta seconds (e.g., for [ / ] keys) ---
    function nudgeSelectedClip(deltaSeconds) {
      const t = findSelectedClip();
      if (!t) return;
      const seconds = (state.timelineSeconds || 60);
      const deltaPct = (deltaSeconds / seconds) * 100;
      t.left = Math.max(0, Math.min(100 - (t.width || 16), (t.left || 0) + deltaPct));
      reAliasAllTracks(state);
      commitAndRender(state);
    }

    // --- snapping ---
    function computeSnapCandidates() {
      const candidates = [];
      (state.tracks || []).forEach(track => {
        (track.items || []).forEach(clip => {
          const left = clip.left || 0;
          const width = clip.width || 16;
          candidates.push({ trackId: track.id, clipId: clip.id, leftPercent: left, rightPercent: left + width, widthPercent: width });
        });
      });
      if (state.playheadPercent != null && !isNaN(state.playheadPercent)) {
        candidates.push({ trackId: null, clipId: 'playhead', leftPercent: state.playheadPercent, rightPercent: state.playheadPercent, widthPercent: 0 });
      }
      const gridStepSec = 0.5;
      const timelineSec = state.timelineSeconds || 60;
      const gridPercent = (gridStepSec / timelineSec) * 100;
      for (let p = 0; p <= 100; p += gridPercent) {
        candidates.push({ trackId: null, clipId: 'grid', leftPercent: p, rightPercent: p, widthPercent: 0 });
      }
      return candidates;
    }

    function snapPercent(rawPercent, candidates, trackId, clipWidthPercent, tolerancePercent) {
      if (!state.snapEnabled) return rawPercent;
      const t = tolerancePercent || 1.5;
      let best = rawPercent;
      let bestDist = t;
      const leftTargets = [rawPercent];
      const rightTargets = [rawPercent + (clipWidthPercent || 16)];
      for (const c of candidates) {
        if (c.trackId && c.trackId !== trackId) continue;
        const pts = [c.leftPercent, c.rightPercent];
        for (const raw of leftTargets) {
          for (const p of pts) {
            const d = Math.abs(raw - p);
            if (d < bestDist) { bestDist = d; best = raw === rawPercent ? p : rawPercent; }
          }
        }
      }
      return Math.max(0, Math.min(100 - (clipWidthPercent || 16), best));
    }

    // --- visual snap guide ---
    function renderSnapGuide(leftPercent) {
      clearSnapGuide();
      const guide = document.createElement('div');
      guide.className = 'snap-guide-line';
      guide.style.cssText = `position:absolute;left:${leftPercent}%;top:0;bottom:0;width:1px;background:#4ade80;pointer-events:none;z-index:50;opacity:.9;`;
      const rows = document.getElementById('trackRows') || document.querySelector('.timeline-body');
      if (rows) rows.appendChild(guide);
    }

    function clearSnapGuide() {
      document.querySelectorAll('.snap-guide-line').forEach(el => el.remove());
    }

    // --- ruler timecodes ---
    function renderTimecodeRuler(timelineSeconds, playheadPercent, zoom) {
      const canvas = document.getElementById('rulerCanvas');
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      const w = Math.max(rect.width || 800, 1);
      const h = 28;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, 0, w, h);
      const step = 1;
      ctx.font = '10px Inter, ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      for (let t = 0; t <= timelineSeconds; t += step) {
        const x = (t / timelineSeconds) * 100 * (w / 100);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, h); ctx.stroke();
        const mm = String(Math.floor(t / 60)).padStart(2, '0');
        const ss = String(Math.floor(t % 60)).padStart(2, '0');
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`${mm}:${ss}`, x, 12);
      }
      const px = ((playheadPercent || 0) / 100) * w;
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      ctx.fillStyle = '#f87171';
      ctx.beginPath(); ctx.moveTo(px - 5, 0); ctx.lineTo(px + 5, 0); ctx.lineTo(px, 6); ctx.closePath(); ctx.fill();
    }

    // --- mini-map overview ---
    function renderMiniMap() {
      let map = document.getElementById('miniMap');
      if (!map) {
        map = document.createElement('div');
        map.id = 'miniMap';
        map.style.cssText = 'position:relative;height:14px;background:rgba(255,255,255,0.03);border-radius:4px;margin:6px 0;overflow:hidden;';
        const header = document.querySelector('.timeline-header');
        if (header) header.appendChild(map);
      }
      map.innerHTML = '';
      (state.tracks || []).forEach(track => {
        const colors = { video: '#3b82f6', audio: '#10b981', text: '#f59e0b', effects: '#a78bfa', 'b-roll': '#8b5cf6' };
        (track.items || []).forEach(clip => {
          const el = document.createElement('div');
          const left = clip.left || 0;
          const w = clip.width || 16;
          el.style.cssText = `position:absolute;left:${left}%;width:${w}%;top:2px;bottom:2px;background:${colors[track.type] || colors.video};border-radius:2px;opacity:.7;`;
          map.appendChild(el);
        });
      });
      const ph = document.createElement('div');
      ph.style.cssText = `position:absolute;left:${state.playheadPercent || 0}%;top:-2px;bottom:-2px;width:1px;background:#f87171;pointer-events:none;`;
      map.appendChild(ph);
    }

    // --- track visibility controls ---
    function renderTrackVisibilityControls() {
      const panel = document.getElementById('trackVisibilityPanel');
      if (!panel) return;
      panel.innerHTML = '';
      (state.tracks || []).forEach(track => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 0;';
        const left = document.createElement('span');
        left.textContent = track.name;
        left.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.8);';
        const btn = document.createElement('button');
        const vis = track.visible !== false;
        btn.textContent = vis ? '👁' : '—';
        btn.title = vis ? 'Hide track' : 'Show track';
        btn.onclick = () => {
          track.visible = !track.visible;
          renderTrackVisibilityControls();
          renderTracks();
        };
        row.appendChild(left);
        row.appendChild(btn);
        panel.appendChild(row);
      });
    }

    // --- group drag behavior: when dragstart includes groupId=true, attach it ---
    function attachGroupDragData(dataTransfer, clip) {
      if (state.clipGroups && clip.groupId) {
        const members = (state.tracks || []).flatMap(t => (t.items || []).filter(c => c.groupId === clip.groupId && c.id !== clip.id));
        if (members.length) {
          dataTransfer.setData('application/json', JSON.stringify({ type: 'clip-group', clipIds: [clip.id, ...members.map(c => c.id)] }));
        }
      }
    }

    // Helpers for finding selected clip by type model
    function findSelectedClip() {
      const selId = state.selectedClipId;
      if (!selId) return null;
      for (const track of state.tracks) {
        const clip = (track.items || []).find(c => c.id === selId);
        if (clip) return clip;
      }
      return null;
    }

    return {
      destroy() {
        window.clearInterval(playbackTimer);

        // Clean up agent integration
        if (root._agentIntegration) {
          root._agentIntegration.destroy();
        }
        // Run all registered cleanups (document listeners, timers, intervals)
        cleanup.run();
        // Save final state
        saveProjectToStorage(state);
      }
    };
  }

  // --- Insert styles and initialize the timeline editor app
  injectStyles();
  createTimelineEditorApp(container);

  // Added after the editor is built: it replaces the container's contents when it mounts.
  container.insertBefore(createEditorBanner('timeline', 'Timeline Editor', 'Edit, caption, personalise and export your video'), container.firstChild);

  return container;
}
