import { supabase, uploadFileToStorage } from '../lib/hybrid-supabase.js';
import { setupEnhancedTooltips } from '../lib/editor/dragDrop.js';
// MARKER_TEST_ABC123import { processFileUpload } from '../lib/editor/uploadPipeline.js';
import { setupUploadSources } from '../lib/editor/uploadSources.js';
import { saveProjectToStorage } from '../lib/editor/persistence.js';
import { renderMediaGrid, addMediaToTimeline } from '../lib/editor/mediaLibrary.js';
import { assetStore } from '../lib/assets/assetStore.js';
import { extendClipContextMenu, extendGenerationPanel, extendMediaLibrary, openGTMPromptModal } from '../lib/uiIntegration.js';
import { integrateMediaIngest, GiphyIntegration, StickersLibrary, LowerThirds, VideoGallery, AnimationList } from '../lib/mediaIngest.js';
import { renderMultiCameraToolbar, renderPipControls, renderSplitScreenControls } from '../lib/editor/multiCamera.js';
import { createTimelineState } from '../lib/editor/timelineEditorState.js';
import { legacyToTimeline, getPreviewClipFromTimeline, syncTimelineFromState } from '../lib/editor/timeline-bridge.js';
import { KeyframeSystem } from '../lib/editor/keyframeSystem.jsx';
import { TransitionEditor } from '../lib/editor/transitionEditor.js';
import { TimelineTransitions } from '../lib/editor/timelineTransitions.js';
import { SceneDetector } from './timeline/SceneDetector.js';
import { CameraEffects } from './timeline/CameraEffects.js';
import AIChatPanel from './timeline/AIChatPanel.js';
import TIMELINE_DESIGN_SYSTEM, { enforceDesignSystem } from '../lib/designSystemEnforcer.js';
import { createVideoPreview } from '../lib/videoPlayer.js';
// Design-system styles are imported statically so Vite bundles and emits them
// into dist/ (with subpath-safe URLs). Injecting them via a runtime <link> to a
// project-root path 404s in production because Vite never copies unreferenced
// files into the build output.
import '../../styles/timeline-tokens.css';
import '../../styles/timeline-editor-page.css';
// Import rendiv animation primitives
import { interpolate, spring, blendColors, noise2D, useSequence, useSeries } from '../lib/editor/animationControls.jsx';
// Agent system integration
import { initTimelineAgentIntegration } from '../timelineAgentIntegration.js';
import { ColorCorrectionSystem } from '../lib/editor/colorCorrectionSystem.jsx';
import { runCineGenTool, CINEGEN_TOOLS } from '../lib/cinegenIntegration.js';
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
import { SocialPublisherModal } from './modals/SocialPublisherModal.jsx';
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
import { createHeroSection } from '../lib/thumbnails.js';

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

  const heroBanner = createHeroSection('timeline', 'h-64 md:h-80 lg:h-96 mb-4');
  if (heroBanner) container.appendChild(heroBanner);

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
        <div class="brand-title">Higgsfield</div>
        <div class="brand-sub">Editor</div>
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
                <div class="preview-stage" id="previewStage"></div>
                <div class="vf-gradient"></div>
                <div class="preview-empty" id="previewEmpty">
                  <div class="vf-subtitle" id="vfSubtitle">Your story starts here.</div>
                </div>
                <div class="vf-badge" id="vfBadge">● REC · 00:12.4</div>
              </div>
              <div class="viewer-controls">
                <button class="circle-btn" id="rewindBtn" data-tooltip="Rewind - Move the playhead back by 10% (←)" aria-label="Rewind the playhead by 10%">⏮</button>
                <button class="circle-btn primary" id="playBtn" data-tooltip="Play or pause timeline preview (Spacebar)" aria-label="Play or pause timeline preview">▶</button>
                <button class="circle-btn" id="stopBtn" data-tooltip="Stop - Stop playback and return to beginning" aria-label="Stop playback and return to the beginning">⏹</button>
                <div class="vf-progress"><div class="vf-fill" id="progressFill" style="width:28%"></div></div>
                <span class="vf-time"><span id="currentTime">00:12.4</span> / <span id="totalTime">00:45.0</span></span>
                <button class="circle-btn" id="vfFull" aria-label="Fullscreen / open player" title="Open Video Player" data-tooltip="Open the fullscreen video player">⤢</button>
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
              <span class="time-now">00:12.4</span>
              <span class="time-total">/ 00:45.0</span>
            </div>
            <div class="tool-group" role="group" aria-label="Edit tools">
              <button class="tool-btn" id="tbSplit" data-tooltip="Split selected clip at playhead" aria-label="Split clip at playhead">✂</button>
              <button class="tool-btn" id="tbDelete" data-tooltip="Delete selected clip" aria-label="Delete selected clip">⌫</button>
              <button class="tool-btn" id="tbAddTrack" data-tooltip="Add a video track" aria-label="Add a video track">＋</button>
              <button class="tool-btn" id="tbMerge" data-tooltip="Merge selected clip with its touching neighbor" aria-label="Merge clips">⤡</button>
              <button class="tool-btn active" id="tbInsertMode" data-tooltip="Insert mode: push downstream when dropping" aria-label="Insert mode" aria-pressed="true">Insert</button>
              <button class="tool-btn" id="tbOverwriteMode" data-tooltip="Overwrite mode: replace existing media" aria-label="Overwrite mode">Overwrite</button>
              <button class="tool-btn active" id="tbSnap" data-tooltip="Snap clips to grid / edges / playhead" aria-label="Snap toggled">Snap</button>
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
          <div class="timeline-body" id="timelineBody">
            <div class="compositing-overlay" id="compositingOverlay"></div>
            <div class="playhead-layer"><div class="playhead-line" id="playheadLine"></div><div class="playhead-knob" id="playheadKnob" role="slider" tabindex="0" aria-label="Playhead position" aria-valuemin="0" aria-valuemax="45" aria-valuenow="14.4" aria-valuetext="00:14.4"></div></div>
            <div id="trackRows"></div>
          </div>
        </div>
      </section>
    </div>
    <div class="side-col">
      <!-- AI Assistant (prototype parity) -->
      <aside class="side-card" id="agentPanel">
        <h3 class="card-title cyan">AI Assistant</h3>
        <div class="chat-stack">
          <div class="chat-bubble user">Trim the intro to 3s</div>
          <div class="chat-bubble ai">Done — trimmed first clip, kept audio in sync.</div>
          <div class="chat-bubble user">Add a crossfade here</div>
          <div class="chat-bubble ai">Added 0.5s crossfade between clips 2 & 3.</div>
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
      <aside class="side-card" id="cameraEffectsPanel" hidden>
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
      <aside class="side-card" id="cinegenResultsPanel" hidden data-tooltip="CineGen AI Tools Results">
        <div class="card-title">🎨 CineGen Results</div>
        <div id="cinegenResults" style="font-size: 12px; color: var(--text-dim); min-height: 60px;">No CineGen tools used yet</div>
        <button class="mini-btn" id="clearCineGenResults" style="margin-top: 8px; width: 100%;">Clear History</button>
      </aside>
      <aside class="side-card" id="animationDemoPanel" hidden data-tooltip="Rendiv animation demonstrations">
        <div class="card-title">🎭 Rendiv Animation Demo</div>
        <div id="animationDemoContainer">
          <div class="animation-demo-controls">
            <button class="mini-btn" id="runSpringDemo">Spring Animation</button>
            <button class="mini-btn" id="runNoiseDemo">Noise Animation</button>
            <button class="mini-btn" id="runInterpolateDemo">Interpolate Demo</button>
          </div>
          <div class="animation-demo-canvas"><canvas id="animationCanvas" width="300" height="200"></canvas></div>
          <div class="animation-demo-info"><div id="demoStatus">Click a button to start animation demo</div></div>
        </div>
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
      <aside class="side-card" id="canvasPanel" hidden data-tooltip="Canvas editor"><div class="card-title">🎨 Canvas Editor</div><div id="canvasContainer"></div></aside>
      <aside class="side-card" id="tokenEditorPanel" hidden data-tooltip="Token editor"><div class="card-title">🏷️ Token Editor</div><div id="tokenEditorContainer"></div></aside>
      <aside class="side-card" id="batchGeneratorPanel" hidden data-tooltip="Batch generator"><div class="card-title">📦 Batch Generator</div><div id="batchGeneratorContainer"></div></aside>
      <aside class="side-card" id="workflowPanel" hidden data-tooltip="Workflow automation"><div class="card-title">🔄 Workflow Automation</div><div id="workflowContainer"></div></aside>
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

    // Override with local demo data but keep enhanced features
    const demoState = {
      projectTitle: 'Untitled Sequence',
      selectedTool: 'Select',
      selectedClipId: 'clip-hero',
      generateType: 'Text',
      playing: false,
      playheadPercent: 34,
      zoom: 1,
      timelineSeconds: 45,
      // Prototype seed (timeline-redesign-prototype.html): 4 tracks, demo clips,
      // one crossfade transition, one scene marker. Percent-based left/width.
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
      tools: baseState.tools, // Use enhanced tools from baseState
      pills: ['Text to Video', 'Image to Video', 'Retake', 'Extend', 'B-Roll', 'Music Gen', 'Audio Sync', 'Fill Gap AI', 'Elements', 'Import Timeline', 'IC-LoRA'],
      topIcons: ['↶','↷','▦','⚙','🔗','🤖','💾'], // reference only — template is source of truth
      media: [
        { icon: '🎬', label: 'Video Clip', desc: 'Insert a source shot or generated video clip.', tooltip: 'Video clip - Add video footage to the timeline' },
        { icon: '🖼️', label: 'Image Frame', desc: 'Add still images, frames, or storyboard art.', tooltip: 'Image frame - Add still images or graphics' },
        { icon: '🎵', label: 'Audio Track', desc: 'Place music, voiceover, or sound design assets.', tooltip: 'Audio track - Add music, voiceover, or sound effects' },
        { icon: '🎞️', label: 'B-Roll Asset', desc: 'Drop in cutaways, overlays, or support footage.', tooltip: 'B-roll - Add supplementary footage and cutaways' }
      ],
      generateTypes: [['✍️', 'Text'], ['🖼️', 'Image'], ['🔄', 'Retake'], ['➡️', 'Extend'], ['🎞️', 'B-Roll']],
      quickCommands: ['⚡Generate','Retake','Extend','B-Roll','🎬 Detect Scenes'],
      railActions: [
        ['＋', 'Media'],
        ['✨', 'Generate', true],
        ['⬆', 'Export'],
        ['🎬', 'Scene Detector'],
        ['🎥', 'Camera FX'],
        ['📊', 'Color Scopes'],
        ['🎞️', 'Multi-Cam'],
        ['✂️', 'Clip Editor'],
        ['🔄', 'Transitions Panel'],
        ['🎨', 'CineGen Results'],
        ['🎭', 'Anim Demo'],
        ['🎨', 'Canvas'],
        ['🏷️', 'Token Editor'],
        ['📦', 'Batch Generator'],
        ['🔄', 'Workflow'],
        ['👤', 'Personalization'],
        ['✏️', 'Personalization Editor']
      ],

      // Enhanced state management
      projectId: null,
      undoStack: [],
      redoStack: [],
      mediaLibrary: [],
      generationQueue: [],
      isProcessing: false,
      insertMode: true,        // push downstream on drop (default)
      overwriteMode: false,    // replace existing media on drop
      rippleMode: false,       // after insert, trim gaps beyond end
      snapToGap: true,         // prefer dropping into empty gaps
      clipGroups: [],          // id bucket for grouped clips
      selectedClipIds: new Set(),
      clipboard: null
    };

    const merged = { ...baseState, ...demoState };

    // Unify track.clips and track.items on the merged state.
    // track.items is the canonical model; track.clips is a compatibility
    // alias for the 58+ legacy call sites. They reference the SAME array
    // so writes via either name are visible through both.
    (merged.tracks || []).forEach(track => {
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
    merged.timeline = legacyToTimeline(merged);

    return merged;
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

  // Enhanced state management with local storage persistence
  function loadProjectFromStorage() {
    try {
      const saved = localStorage.getItem('timeline-editor-project');
      if (saved) {
        const projectData = JSON.parse(saved);

        const state = { ...createState(), ...projectData };
        // Ensure tracks is always an array
        if (!Array.isArray(state.tracks)) {
          state.tracks = createState().tracks;
        }
        state.tracks = normalizeTrackTypes(state.tracks);
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
      addTimer(id) { this.timers.push(id); },
      addInterval(id) { this.intervals.push(id); },
      run() {
        this.documentListeners.forEach(({ type, handler, options }) => {
          document.removeEventListener(type, handler, options);
        });
        this.documentListeners.length = 0;
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

      // CineGen keyboard shortcuts
      if (event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'g':
            event.preventDefault();
            runCineGenTool(CINEGEN_TOOLS.GAP_FILL, { clipId: state.selectedClipId }).then(updateCineGenResults);
            break;
          case 'e':
            event.preventDefault();
            runCineGenTool(CINEGEN_TOOLS.EXTEND, { clipId: state.selectedClipId }).then(updateCineGenResults);
            break;
          case 'm':
            event.preventDefault();
            runCineGenTool('music_generation', { clipId: state.selectedClipId }).then(updateCineGenResults);
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
    root.innerHTML = template;

    // Debounced project save: avoids blocking the main thread on every keystroke
    // or drag. Coalesces rapid changes into a single write at most every 400ms.
    let saveTimer = null;
    function debouncedSave(delay = 400) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
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
      previewEmpty: root.querySelector('#previewEmpty'),
      playheadLine: root.querySelector('#playheadLine'),
      playheadKnob: root.querySelector('#playheadKnob'),
      rulerCanvas: root.querySelector('#rulerCanvas'),
      rulerTicks: root.querySelector('#rulerTicks'),
      projectTitle: root.querySelector('#projectTitle'),
      promptInput: root.querySelector('#promptInput'),
      durationSelect: root.querySelector('#durationSelect'),
      aspectSelect: root.querySelector('#aspectSelect'),
      styleSelect: root.querySelector('#styleSelect'),
      generateBtn: root.querySelector('#generateBtn'),
      chatInput: root.querySelector('#chatInput'),
      toast: root.querySelector('#toast'),
      uploadBtn: root.querySelector('#uploadBtn'),
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
      canvasPanel: root.querySelector('#canvasPanel'),
      canvasContainer: root.querySelector('#canvasContainer'),
      tokenEditorPanel: root.querySelector('#tokenEditorPanel'),
      tokenEditorContainer: root.querySelector('#tokenEditorContainer'),
      batchGeneratorPanel: root.querySelector('#batchGeneratorPanel'),
      batchGeneratorContainer: root.querySelector('#batchGeneratorContainer'),
      workflowPanel: root.querySelector('#workflowPanel'),
      workflowContainer: root.querySelector('#workflowContainer'),
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

    function updateCineGenResults(result) {
      const container = document.getElementById('cinegenResults');
      if (!container) return;

      const entry = {
        timestamp: new Date().toLocaleTimeString(),
        result
      };
      cinegenHistory.push(entry);

      const item = document.createElement('div');
      item.style.marginBottom = '8px';
      item.style.padding = '8px';
      item.style.borderRadius = '8px';
      item.style.background = 'rgba(255,255,255,0.05)';
      item.style.border = '1px solid var(--border)';
      item.style.fontSize = '11px';

      const success = result && result.success !== false;
      item.style.borderColor = success ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)';
      item.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px;color:${success ? '#86efac' : '#fca5a5'}">
          ${entry.timestamp} — ${success ? 'Success' : 'Failed'}
        </div>
        <div style="color:rgba(255,255,255,0.75);word-break:break-word;">
          ${(result && result.message) || JSON.stringify(result)}
        </div>
      `;

      container.insertBefore(item, container.firstChild);
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
      clearPreviewStage();
      if (!selected) {
        els.previewEmpty.style.display = 'flex';
        if (els.vfSubtitle) els.vfSubtitle.textContent = 'Your story starts here.';
        return;
      }

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

      if (selected.type === 'video' && selected.src) {
        const video = createVideoPreview(selected.src, 'preview-media', {
          poster: selected.poster
        });
        els.previewStage.appendChild(video);
        return;
      }

      if (selected.type === 'image' && selected.src) {
        const image = document.createElement('img');
        image.className = `preview-media ${selected.fit === 'cover' ? '' : 'contain'}`;
        image.src = selected.src;
        image.alt = selected.name;
        els.previewStage.appendChild(image);
        return;
      }

      if (selected.type === 'audio') {
        const wrap = document.createElement('div');
        wrap.className = 'preview-audio-card';
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
        wrap.appendChild(audio);
        els.previewStage.appendChild(wrap);
        return;
      }

      if (selected.type === 'text') {
        const textCard = document.createElement('div');
        textCard.className = 'preview-text-card';
        textCard.innerHTML = `
          <div class="preview-text-kicker">Text Overlay Preview</div>
          <div class="preview-text-heading">${selected.heading || selected.name}</div>
          <div class="preview-text-body">${selected.body || 'This clip shows how text overlays, captions, or title cards can render in the preview stage.'}</div>
        `;
        els.previewStage.appendChild(textCard);
        return;
      }

      els.previewEmpty.style.display = 'flex';
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
      }
    }

    function openVideoPlayerModal(state, showToast) {
      try {
        const modal = new VideoPlayerModal({
          timelineData: state,
          onComplete: (result) => {
          },
          onError: (error) => console.log(`Video player error: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
      }
    }

    function addEndScreenToTimeline(endScreenData, state) {
      // Add end screen elements to the end of the timeline
      const videoTrack = state.tracks.find(t => t.name === 'Video');
      if (videoTrack && endScreenData.elements) {
        endScreenData.elements.forEach(element => {
          const clip = {
            id: Date.now() + Math.random(),
            name: element.name || 'End Screen Element',
            left: state.timelineSeconds * 10, // Position at end
            width: element.duration || 5,
            type: element.type || 'text',
            ...element
          };
          videoTrack.clips.push(clip);
        });
        renderTracks();
      }
    }

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
      const agentsBtn = root.querySelector('#openAgents');
      const saveBtn = root.querySelector('#openSave');
      if (settingsBtn) settingsBtn.addEventListener('click', () => openEditorSettings());
      if (connectBtn) connectBtn.addEventListener('click', () => openConnectModal(state, showToast));
      if (agentsBtn) agentsBtn.addEventListener('click', () => openAIAgentsPanel(state, showToast));
      if (saveBtn) saveBtn.addEventListener('click', () => openSaveProjectModal(state, showToast));
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
      const tools = state.tools || [
        ['🔍', 'Select'],
        ['✂️', 'Blade'],
        ['↗️', 'Ripple'],
        ['↔️', 'Roll'],
        ['↕️', 'Slip'],
        ['↔️', 'Slide'],
        ['🔍', 'Zoom'],
        ['✋', 'Hand']
      ];
      tools.forEach(([icon, label]) => {
        const button = document.createElement('button');
        button.className = `tool-btn ${state.selectedTool === label ? 'active' : ''}`;
        button.textContent = icon;
        button.setAttribute('data-tooltip', toolTooltips[label] || label);
        button.title = toolTooltips[label] || label;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', () => {
          state.selectedTool = label;
          renderTools();
          updatePreview();
        });
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
      }
    }

    function initializeDefaultTracks() {
      // Prototype seed (timeline-redesign-prototype.html): 4 tracks with demo
      // clips, one crossfade transition, one scene marker. Percent-based items
      // (left/width) are converted to seconds downstream by renderTracks().
      if (!state.tracks || state.tracks.length === 0) {
        state.tracks = [
          { id: 'track-video', type: 'video', name: 'Main Video', muted: false, solo: false, locked: false,
            items: [
              { id: 'clip-hero', name: 'Hero Wide', type: 'video', left: 2, width: 22 },
              { id: 'clip-product', name: 'Product Spin', type: 'video', left: 25, width: 16 },
              { id: 'clip-lifestyle', name: 'Lifestyle B', type: 'video', left: 46, width: 20 }
            ],
            transitions: [{ left: 40, width: 5, duration: 0.5, name: 'Crossfade' }] },
          { id: 'track-audio', type: 'audio', name: 'Voiceover', muted: false, solo: false, locked: true,
            items: [
              { id: 'clip-vo1', name: 'VO Take 1', type: 'audio', left: 2, width: 40, waveform: true },
              { id: 'clip-vo2', name: 'VO Take 2', type: 'audio', left: 44, width: 30, waveform: true }
            ] },
          { id: 'track-text', type: 'text', name: 'Titles', muted: false, solo: false, locked: false,
            items: [
              { id: 'clip-lower', name: 'Lower Third', type: 'text', left: 8, width: 14 },
              { id: 'clip-title', name: 'Title Card', type: 'text', left: 30, width: 20 },
              { id: 'clip-end', name: 'End Card', type: 'text', left: 54, width: 12 }
            ],
            markers: [52] },
          { id: 'track-fx', type: 'effects', name: 'Effects', muted: false, solo: false, locked: false,
            items: [
              { id: 'clip-grade', name: 'Color Grade', type: 'effects', left: 2, width: 60 }
            ] }
        ];
      }
      // Prototype renders "Hero Wide" as the active clip on load
      if (!state.selectedClipId) state.selectedClipId = 'clip-hero';
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
              updatePreview(clip);
              // Full pipeline rebuild: re-rendering with the viewState closure
              // would keep the stale selectedClipId and .active would never move.
              renderTracks();
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
            const isText = trackType === 'text';
            const isFx = trackType === 'effects' || trackType === 'fx';
            const icon = isAudio ? '🎙️' : isText ? '🅣' : isFx ? '✨' : '🎥';
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
            metadata: clip.metadata || {}
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
            // Falls back to a placeholder clip if the mediaData has no real src.
            const extra = {};
            const src = data.src || data.url;
            if (src) {
              extra.src = src;
            } else if (data.mediaType === 'video') {
              // Legacy demo fallback: only used if a media-library entry
              // has no real src. New code should always provide src.
              extra.src = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
            } else if (data.mediaType === 'image') {
              extra.src = svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><text x="90" y="320" fill="white" font-size="74" font-family="Arial" font-weight="700">${data.label}</text></svg>`);
              extra.fit = 'contain';
            } else if (data.mediaType === 'audio') {
              extra.src = 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3';
            } else {
              extra.heading = data.label;
              extra.body = 'Dragged text asset.';
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
      return { ...base, type: 'text', heading: file.name || 'Text Asset', body: 'Uploaded text asset preview placeholder.' };
    }

    function insertClipIntoTrack(clip, preferredTrackName) {
      const targetTrack = state.tracks.find((track) => track.name === preferredTrackName) || state.tracks[0];

      // Convert start/end format to left/width format used by this timeline
      if (clip.start !== undefined && clip.end !== undefined) {
        clip.left = (clip.start / state.timelineSeconds) * 100;
        clip.width = ((clip.end - clip.start) / state.timelineSeconds) * 100;
        delete clip.start;
        delete clip.end;
      } else {
        clip.left = Math.min(78, 8 + targetTrack.clips.length * 10);
      }

      targetTrack.clips.push(clip);
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
        let clipData = {
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



    function renderClipEditor(clipId) {
      const clip = state.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
      if (!clip) {
        els.clipEditorContainer.innerHTML = '<p>Clip not found</p>';
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
          // Handle transition application from editor
        });
      }
    }

    function initializeTimelineTransitions() {
      if (!timelineTransitions) {
        timelineTransitions = new TimelineTransitions(els.timelineBody, state);
      }
    }

    function initializeSceneDetector() {
      if (!sceneDetector && els.sceneDetectorContainer) {
        sceneDetector = new SceneDetector(els.sceneDetectorContainer, {
          tracks: state.tracks,
          timelineSeconds: state.timelineSeconds,
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
          keyframeSystem: state.keyframeSystem,
          timelineState: state,
          onPreviewUpdate: (clipId, transform) => {
            // Update preview with camera effect transform
            renderPreview();
          },
          onKeyframeUpdate: () => {
            // Refresh timeline and keyframe displays
            renderTimeline();
            renderKeyframes();
          }
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

    // Fallback: add sample subtitles
    let subtitleTrack = state.project.tracks.find(t => t.type === 'subtitle' || t.type === 'text');
    if (!subtitleTrack) {
      state.addTrack('Text');
      subtitleTrack = state.project.tracks.find(t => t.type === 'text');
    }

    const samples = [
      { start: 0, end: 3.2, text: "Welcome to this video" },
      { start: 3.5, end: 6.8, text: "Today we explore new techniques" },
      { start: 7.2, end: 11.0, text: "Let's begin with the timeline" }
    ];

    samples.forEach((sub, i) => {
      subtitleTrack.items.push({
        id: `subtitle-${Date.now()}-${i}`,
        name: sub.text,
        type: 'text',
        start: sub.start,
        end: sub.end,
        text: sub.text,
        style: { fontSize: 18, color: '#ffffff', background: 'rgba(0,0,0,0.75)' }
      });
    });

    renderTracks();

    async function generateSubtitles() {
      showToast('Generating subtitles...', 'info');
      try {
        // Attempt real transcription if available
        if (typeof whisperService !== 'undefined' && whisperService.transcribe) {
          const selectedClip = findSelectedClip();
          if (!selectedClip || !selectedClip.src) {
            showToast('Select a video clip to generate subtitles from', 'info');
            return;
          }
          // In a real implementation, fetch the media and run transcription.
          showToast('Subtitle generation requires media upload', 'info');
          return;
        }

        // Fallback: create sample subtitle track
        let subtitleTrack = state.project.tracks.find(t => t.type === 'subtitle' || t.type === 'text');
        if (!subtitleTrack) {
          state.addTrack('Text');
          subtitleTrack = state.project.tracks.find(t => t.type === 'text');
        }

        const samples = [
          { start: 0, end: 3.2, text: 'Welcome to this video' },
          { start: 3.5, end: 6.8, text: 'Today we explore new techniques' },
          { start: 7.2, end: 11.0, text: 'Let\'s begin with the timeline' }
        ];

        samples.forEach((sub, i) => {
          subtitleTrack.items.push({
            id: `subtitle-${Date.now()}-${i}`,
            name: sub.text,
            type: 'text',
            start: sub.start,
            end: sub.end,
            text: sub.text,
            style: { fontSize: 18, color: '#ffffff', background: 'rgba(0,0,0,0.75)' }
          });
        });

        renderTracks();
        showToast('Subtitles generated', 'success');
      } catch (error) {
        console.error('Subtitle generation failed:', error);
        showToast('Subtitle generation failed', 'error');
      }
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
      }
    }

    function openTemplateGeneratorModal(state, showToast) {
      try {
        const modal = new TemplateGeneratorModal({
          onComplete: (result) => {
            // Apply template to timeline
            applyTemplateToTimeline(result, state);
          },
          onError: (error) => console.log(`Template generation failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
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
      }
    }

    function openSocialPublisherModal(state, showToast) {
      try {
        const modal = new SocialPublisherModal({
          projectData: state,
          onComplete: (result) => {
          },
          onError: (error) => console.log(`Publishing failed: ${error}`, 'error')
        });
        modal.open();
      } catch (error) {
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
    window.addLeadCapture = () => {
      const leadClip = {
        id: Date.now(),
        name: 'Lead Capture Form',
        left: state.playheadPercent * 10,
        width: 6,
        type: 'text',
        heading: 'Get Your Free Guide',
        body: 'Enter your email to receive personalized content.',
        formFields: ['email', 'first_name'],
        ctaText: 'Download Now'
      };
      insertClipIntoTrack(leadClip, 'Text');
    };
    TLEditor.addLeadCapture = window.addLeadCapture;

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
      }
    }

    // Helper functions for modal integration
    function addVideoToTimeline(videoData, state) {
      const videoTrack = state.tracks.find(t => t.name === 'Video');
      if (videoTrack) {
        const newClip = {
          id: Date.now(),
          name: videoData.name || 'Imported Video',
          left: 50,
          width: 20,
          type: 'video',
          src: videoData.src,
          poster: videoData.poster
        };
        videoTrack.clips.push(newClip);
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
    function openPanel(id) {
      const el = root.querySelector('#' + id);
      if (!el) return;
      el.hidden = false;
      el.style.display = 'block';
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Maps floating-rail labels to collapsed panel element ids.
    const RAIL_PANEL_MAP = {
      'Scene Detector': 'sceneDetectorPanel',
      'Camera FX': 'cameraEffectsPanel',
      'Color Scopes': 'colorScopesPanel',
      'Multi-Cam': 'multiCameraPanel',
      'Clip Editor': 'clipSettingsPanel',
      'Transitions Panel': 'transitionSettingsPanel',
      'CineGen Results': 'cinegenResultsPanel',
      'Anim Demo': 'animationDemoPanel'
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
      endScreen: () => openEndScreenModal(state, showToast),
      import: () => showToast('Import timeline functionality coming soon', 'info'),
      storyboard: () => { if (window.showCutAIFromTimeline) window.showCutAIFromTimeline(); else showToast('Storyboard coming soon', 'info'); },
      subtitleEditor: () => generateSubtitles(),
      imageCrop: () => showToast('Image cropper coming soon', 'info'),
      imageEdit: () => showToast('Image editor coming soon', 'info'),
      voice: () => showToast('Voice/TTS coming soon', 'info')
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
        'Generate': 'Generate new AI content - Create video, images, or audio from prompts',
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
        'Canvas': 'Canvas editor - Open the visual canvas composition editor',
        'Token Editor': 'Token editor - Create and manage personalization tokens',
        'Batch Generator': 'Batch generation - Generate multiple videos at once',
        'Workflow': 'Workflow automation - Create automated video production pipelines',
        'Personalization': 'Personalization - Add dynamic content for different viewers',
        'Personalization Editor': 'Personalization editor - Advanced personalization settings',
        'Personalization Suite': 'Personalization suite - Complete video personalization workflow',
        'Landing Pages': 'Landing pages - Create personalized landing pages',
        'Lead Generator': 'Lead capture - Add lead generation forms to videos',
        'AI Personalizer': 'AI Personalizer - Scan profiles and generate personalized content',
        'CineGen Tools': 'CineGen AI Tools - Full suite of AI editing tools',
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
        'Anim Demo': 'Rendiv animation demonstrations'
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
              // Trigger generation with current prompt
              await generateClip();
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
              
              // Quick access to CineGen tools from timeline
              runCineGenTool(CINEGEN_TOOLS.GAP_FILL, { clipId: state.selectedClipId });
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
              showCanvasPanel();
              break;
            case 'Token Editor':
              showTokenEditorPanel();
              break;
            case 'Batch Generator':
              showBatchGeneratorPanel();
              break;
            case 'Workflow':
              showWorkflowPanel();
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
            case 'CineGen Tools':
              openPanel('cinegenResultsPanel');
              break;
            case 'Gap Fill':
              runCineGenTool(CINEGEN_TOOLS.GAP_FILL, { clipId: state.selectedClipId });
              break;
            case 'Extend Clip':
              runCineGenTool(CINEGEN_TOOLS.EXTEND, { clipId: state.selectedClipId });
              break;
            case 'Generate Music':
            case 'Mask Tool':
            case 'Element':
            case 'Polish':
            case 'Smart Subtitles':
            case 'LLM Assistant':
            case 'SAM3':
            case 'Audio Sync':
            case 'Layer Decomp':
            case 'Shot Board':
            case 'Proxy Play':
            case 'Comp Plan':
              openPanel('cinegenResultsPanel');
              break;
            default:
              if (RAIL_PANEL_MAP[label]) openPanel(RAIL_PANEL_MAP[label]);
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
      els.clipSettingsPanel?.style && (els.clipSettingsPanel.style.display = 'block');
      renderClipEditor(clipId);
    }

    function showTransitionSettings() {
      els.transitionSettingsPanel?.style && (els.transitionSettingsPanel.style.display = 'block');
      
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
    function showCanvasPanel() {
      // Hide other panels
      hideAllEditorPanels();
      els.canvasPanel?.style && (els.canvasPanel.style.display = 'block');

      // Render Canvas component
      if (els.canvasContainer && !els.canvasContainer.innerHTML) {
        // For now, render basic canvas HTML. In a full implementation, this would use ReactDOM
        els.canvasContainer.innerHTML = `
          <div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">
            <h3 style="margin: 0 0 16px 0; color: #e5e7eb;">Canvas Editor</h3>
            <p style="color: #9ca3af; margin-bottom: 16px;">Visual canvas-based editing surface for composition.</p>
            <canvas id="canvasEditor" width="800" height="450" style="border: 1px solid #374151; background: #1a1a1a; flex: 1;"></canvas>
            <div style="margin-top: 16px; display: flex; gap: 8px;">
              <button style="padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px;">Add Text</button>
              <button style="padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px;">Add Shape</button>
              <button style="padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px;">Add Image</button>
            </div>
          </div>
        `;
      }
    }

    function showTokenEditorPanel() {
      hideAllEditorPanels();
      els.tokenEditorPanel?.style && (els.tokenEditorPanel.style.display = 'block');

      if (els.tokenEditorContainer && !els.tokenEditorContainer.innerHTML) {
        // Load variables from intelligence layer if a contact is selected
        let tokenEntries = [
          { token: '{first_name}', label: 'first_name' },
          { token: '{last_name}', label: 'last_name' },
          { token: '{email}', label: 'email' },
          { token: '{company}', label: 'company' },
        ];

        try {
          const selectedContactId = localStorage.getItem('remix_selected_contact_id');
          if (selectedContactId) {
            const profiles = JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]');
            const profile = profiles.find((p) => p.id === selectedContactId);
            if (profile?.variables) {
              const enriched = Object.entries(profile.variables).map(([key, value]) => ({
                token: `{{${key}}}`,
                label: key,
                preview: value ? String(value).slice(0, 30) : '',
              }));
              if (enriched.length > 0) {
                tokenEntries = enriched;
              }
            }
          }
        } catch {}

        const tokenButtons = tokenEntries.map((t) => `
          <button class="token-btn" data-token="${t.token}" title="${t.preview || ''}" style="padding: 6px 10px; background: #1f2937; color: #e5e7eb; border: 1px solid #374151; border-radius: 4px; cursor: pointer; font-size: 11px;">${t.label}${t.preview ? ` (${t.preview})` : ''}</button>
        `).join('');

        const contactBanner = (() => {
          try {
            const id = localStorage.getItem('remix_selected_contact_id');
            if (!id) return '';
            const contacts = JSON.parse(localStorage.getItem('remix_contacts') || '[]');
            const contact = contacts.find((c) => c.id === id);
            if (!contact) return '';
            return `<div style="padding: 8px 12px; background: rgba(217,255,0,0.05); border: 1px solid rgba(217,255,0,0.2); border-radius: 6px; margin-bottom: 12px; color: #d9ff00; font-size: 12px;">Personalized for: ${contact.name}${contact.company ? ` at ${contact.company}` : ''}</div>`;
          } catch { return ''; }
        })();

        els.tokenEditorContainer.innerHTML = `
          <div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">
            <h3 style="margin: 0 0 8px 0; color: #e5e7eb;">Token Editor</h3>
            <p style="color: #9ca3af; margin-bottom: 12px; font-size: 13px;">Create content with dynamic tokens. Click a token to insert it.</p>
            ${contactBanner}
            <textarea placeholder="Enter text with {tokens}..." style="flex: 1; padding: 12px; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: #e5e7eb; resize: vertical; font-family: monospace; min-height: 200px;"></textarea>
            <div style="margin-top: 16px;">
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Available tokens</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${tokenButtons}
              </div>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #1f2937; display: flex; gap: 8px;">
              <button id="refresh-tokens" style="padding: 6px 12px; background: #1f2937; color: #9ca3af; border: 1px solid #374151; border-radius: 4px; cursor: pointer; font-size: 11px;">↻ Refresh</button>
              <button id="auto-timeline-btn" style="padding: 6px 12px; background: rgba(217,255,0,0.1); color: #d9ff00; border: 1px solid rgba(217,255,0,0.3); border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">✨ Auto-generate timeline</button>
              <a href="#/contacts" style="padding: 6px 12px; background: transparent; color: #d9ff00; border: 1px solid rgba(217,255,0,0.3); border-radius: 4px; text-decoration: none; font-size: 11px;">Manage Contacts</a>
            </div>
          </div>
        `;

        // Add token button functionality
        els.tokenEditorContainer.querySelectorAll('.token-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const textarea = els.tokenEditorContainer.querySelector('textarea');
            const token = btn.dataset.token;
            textarea.value += token;
            textarea.focus();
          });
        });

        // Refresh button
        const refreshBtn = els.tokenEditorContainer.querySelector('#refresh-tokens');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', () => {
            els.tokenEditorContainer.innerHTML = '';
            showTokenEditorPanel();
          });
        }

        // Auto-generate timeline button — calls /api/intelligence/auto-timeline
        // and prepends the returned scenes to the current timeline.
        const autoTimelineBtn = els.tokenEditorContainer.querySelector('#auto-timeline-btn');
        if (autoTimelineBtn) {
          autoTimelineBtn.addEventListener('click', async () => {
            const contactId = localStorage.getItem('remix_selected_contact_id');
            if (!contactId) {
              alert('Select a contact first to auto-generate a personalized timeline.');
              return;
            }
            const originalLabel = autoTimelineBtn.textContent;
            autoTimelineBtn.disabled = true;
            autoTimelineBtn.textContent = '⏳ Generating...';
            try {
              const session = await (async () => {
                try {
                  const { supabase } = await import('../lib/supabase.js');
                  const { data } = await supabase.auth.getSession();
                  return data.session;
                } catch { return null; }
              })();
              const headers = { 'Content-Type': 'application/json' };
              if (session) headers.Authorization = `Bearer ${session.access_token}`;
              const res = await fetch(`/api/intelligence/auto-timeline/${contactId}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({}),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
              }
              const data = await res.json();
              const scenes = data.scenes || [];
              if (scenes.length === 0) {
                alert('No scenes generated. Make sure the contact has a complete profile.');
                return;
              }
              // Convert scenes to timeline clips and prepend
              const baseTime = 0;
              scenes.forEach((scene, i) => {
                const clip = {
                  id: `auto-${Date.now()}-${i}`,
                  type: 'text',
                  start: baseTime + scenes.slice(0, i).reduce((s, sc) => s + (sc.durationSeconds || 5), 0),
                  duration: scene.durationSeconds || 5,
                  text: scene.prompt,
                  assetUrl: scene.assetHints?.image || '',
                  source: 'auto-timeline',
                  beat: scene.beat,
                };
                // Push to the global clips array if available
                if (typeof window !== 'undefined' && Array.isArray(window.__timelineClips)) {
                  window.__timelineClips.push(clip);
                } else if (typeof clips !== 'undefined' && Array.isArray(clips)) {
                  clips.push(clip);
                }
              });
              // Trigger a re-render of the timeline if a render function is exposed
              if (typeof window !== 'undefined' && typeof window.__timelineRender === 'function') {
                window.__timelineRender();
              } else if (typeof renderTimeline === 'function') {
                renderTimeline();
              }
              autoTimelineBtn.textContent = `✓ Added ${scenes.length} scenes`;
              setTimeout(() => { autoTimelineBtn.textContent = originalLabel; autoTimelineBtn.disabled = false; }, 2500);
            } catch (err) {
              alert(`Auto-timeline failed: ${err.message}`);
              autoTimelineBtn.textContent = originalLabel;
              autoTimelineBtn.disabled = false;
            }
          });
        }
      }
    }

    function showBatchGeneratorPanel() {
      hideAllEditorPanels();
      els.batchGeneratorPanel?.style && (els.batchGeneratorPanel.style.display = 'block');

      if (els.batchGeneratorContainer && !els.batchGeneratorContainer.innerHTML) {
        els.batchGeneratorContainer.innerHTML = `
          <div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">
            <h3 style="margin: 0 0 16px 0; color: #e5e7eb;">Batch Generator</h3>
            <p style="color: #9ca3af; margin-bottom: 16px;">Generate multiple videos or content items at once.</p>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
              <select style="padding: 8px; background: #1f2937; border: 1px solid #374151; border-radius: 4px; color: #e5e7eb;">
                <option>Select Template...</option>
                <option>Video Template 1</option>
                <option>Video Template 2</option>
              </select>
              <div id="batchItems" style="flex: 1; overflow-y: auto; border: 1px solid #374151; border-radius: 4px; padding: 8px;">
                <!-- Batch items will be added here -->
              </div>
              <div style="display: flex; gap: 8px;">
                <button id="addBatchItem" style="padding: 8px 12px; background: #10b981; color: white; border: none; border-radius: 4px;">Add Item</button>
                <button id="startBatch" style="padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px;">Start Batch</button>
              </div>
            </div>
          </div>
        `;

        // Add batch functionality
        const addBtn = els.batchGeneratorContainer.querySelector('#addBatchItem');
        const batchItems = els.batchGeneratorContainer.querySelector('#batchItems');

        addBtn.addEventListener('click', () => {
          const itemCount = batchItems.children.length + 1;
          const itemDiv = document.createElement('div');
          itemDiv.style.cssText = 'background: #111827; padding: 8px; margin-bottom: 8px; border-radius: 4px;';
          itemDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span>Item ${itemCount}</span>
              <button class="remove-item" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 2px 6px;">×</button>
            </div>
            <input type="text" placeholder="Item data..." style="width: 100%; padding: 4px; background: #1f2937; border: 1px solid #374151; border-radius: 4px; color: #e5e7eb;">
          `;
          itemDiv.querySelector('.remove-item').addEventListener('click', () => itemDiv.remove());
          batchItems.appendChild(itemDiv);
        });
      }
    }

    function showWorkflowPanel() {
      hideAllEditorPanels();
      els.workflowPanel?.style && (els.workflowPanel.style.display = 'block');

      if (els.workflowContainer && !els.workflowContainer.innerHTML) {
        els.workflowContainer.innerHTML = `
          <div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">
            <h3 style="margin: 0 0 16px 0; color: #e5e7eb;">Workflow Automation</h3>
            <p style="color: #9ca3af; margin-bottom: 16px;">Automate your video creation and distribution workflows.</p>
            <div style="flex: 1; overflow-y: auto;">
              <div style="display: grid; gap: 12px;">
                <div class="workflow-card" style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 12px; cursor: pointer;">
                  <h4 style="margin: 0 0 8px 0; color: #e5e7eb;">Video Creation Pipeline</h4>
                  <p style="margin: 0; color: #9ca3af; font-size: 14px;">Generate, edit, and publish videos automatically</p>
                </div>
                <div class="workflow-card" style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 12px; cursor: pointer;">
                  <h4 style="margin: 0 0 8px 0; color: #e5e7eb;">Batch Processing</h4>
                  <p style="margin: 0; color: #9ca3af; font-size: 14px;">Process multiple videos with consistent branding</p>
                </div>
                <div class="workflow-card" style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 12px; cursor: pointer;">
                  <h4 style="margin: 0 0 8px 0; color: #e5e7eb;">Personalization Hub</h4>
                  <p style="margin: 0; color: #9ca3af; font-size: 14px;">Create personalized content at scale</p>
                </div>
              </div>
            </div>
            <button style="margin-top: 16px; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px;">Create New Workflow</button>
          </div>
        `;
      }
    }

    function showPersonalizationPanel() {
      hideAllEditorPanels();
      els.personalizationPanel?.style && (els.personalizationPanel.style.display = 'block');

      if (els.personalizationContainer && !els.personalizationContainer.innerHTML) {
        els.personalizationContainer.innerHTML = `
          <div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">
            <h3 style="margin: 0 0 16px 0; color: #e5e7eb;">Personalization</h3>
            <p style="color: #9ca3af; margin-bottom: 16px;">Create personalized content using merge fields.</p>
            <div style="flex: 1; overflow-y: auto; display: grid; gap: 8px;">
              <div class="merge-field" style="background: #1f2937; padding: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: bold; color: #e5e7eb;">First Name</div>
                  <div style="font-size: 12px; color: #6b7280;">{first_name}</div>
                </div>
                <span style="color: #9ca3af;">John</span>
              </div>
              <div class="merge-field" style="background: #1f2937; padding: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: bold; color: #e5e7eb;">Email</div>
                  <div style="font-size: 12px; color: #6b7280;">{email}</div>
                </div>
                <span style="color: #9ca3af;">john@example.com</span>
              </div>
              <div class="merge-field" style="background: #1f2937; padding: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: bold; color: #e5e7eb;">Company</div>
                  <div style="font-size: 12px; color: #6b7280;">{company}</div>
                </div>
                <span style="color: #9ca3af;">Acme Corp</span>
              </div>
            </div>
            <button style="margin-top: 16px; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px;">Add Field</button>
          </div>
        `;
      }
    }

    function showPersonalizationEditorPanel() {
      hideAllEditorPanels();
      els.personalizationEditorPanel?.style && (els.personalizationEditorPanel.style.display = 'block');

      if (els.personalizationEditorContainer && !els.personalizationEditorContainer.innerHTML) {
        els.personalizationEditorContainer.innerHTML = `
          <div style="padding: 16px; height: 100%; display: flex; flex-direction: column;">
            <h3 style="margin: 0 0 16px 0; color: #e5e7eb;">Personalization Editor</h3>
            <p style="color: #9ca3af; margin-bottom: 16px;">Edit personalized content with dynamic tokens.</p>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
              <textarea placeholder="Enter personalized text..." style="flex: 1; padding: 12px; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: #e5e7eb; resize: vertical;"></textarea>
              <div style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 12px;">
                <h4 style="margin: 0 0 8px 0; color: #e5e7eb;">Preview</h4>
                <div id="personalizationPreview" style="color: #e5e7eb;">Preview will appear here...</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    function hideAllEditorPanels() {
      els.canvasPanel?.style && (els.canvasPanel.style.display = 'none');
      els.tokenEditorPanel?.style && (els.tokenEditorPanel.style.display = 'none');
      els.batchGeneratorPanel?.style && (els.batchGeneratorPanel.style.display = 'none');
      els.workflowPanel?.style && (els.workflowPanel.style.display = 'none');
      els.personalizationPanel?.style && (els.personalizationPanel.style.display = 'none');
      els.personalizationEditorPanel?.style && (els.personalizationEditorPanel.style.display = 'none');
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

    function togglePlayback() {
      state.playing = !state.playing;
      if (state.playing) {
        playbackTimer = window.setInterval(() => {
          state.playheadPercent += 0.6;
          if (state.playheadPercent >= 100) {
            state.playheadPercent = 100;
            state.playing = false;
            window.clearInterval(playbackTimer);
          }
          updatePlaybackUI();
          // Apply keyframes during playback
          const selected = findSelectedClip();
          if (selected) {
            updatePreview(selected);
          }
        }, 120);
      } else {
        window.clearInterval(playbackTimer);
      }
      updatePlaybackUI();
    }

    function stopPlayback() {
      state.playing = false;
      window.clearInterval(playbackTimer);
      state.playheadPercent = 0;
      updatePlaybackUI();
      const media = els.previewStage.querySelector('video, audio');
      if (media) media.currentTime = 0;
    }

    function rewindPlayback() {
      state.playing = false;
      window.clearInterval(playbackTimer);
      state.playheadPercent = Math.max(0, state.playheadPercent - 10);
      updatePlaybackUI();
    }

    function jumpToEndPlayback() {
      state.playing = false;
      window.clearInterval(playbackTimer);
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
    function runSpringDemo(canvas, statusEl) {
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      let animationId = null;
      let frame = 0;

      statusEl.textContent = 'Running spring animation demo...';

      function animate() {
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        // Calculate spring position (simulate a bouncing ball)
        const springValue = spring({ frame, fps: 30, config: { damping: 12, stiffness: 100 } });
        const x = width / 2;
        const y = height - (springValue * height * 0.8) - 50;

        // Draw ball
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, 2 * Math.PI);
        ctx.fill();

        // Draw trail
        for (let i = 1; i <= 5; i++) {
          const trailFrame = Math.max(0, frame - i * 2);
          const trailSpring = spring({ frame: trailFrame, fps: 30, config: { damping: 12, stiffness: 100 } });
          const trailY = height - (trailSpring * height * 0.8) - 50;
          const alpha = (6 - i) / 6;

          ctx.fillStyle = `rgba(34, 211, 238, ${alpha * 0.5})`;
          ctx.beginPath();
          ctx.arc(x, trailY, 20 - i * 2, 0, 2 * Math.PI);
          ctx.fill();
        }

        frame++;
        if (frame < 180) { // 6 seconds at 30fps
          animationId = requestAnimationFrame(animate);
        } else {
          statusEl.textContent = 'Spring demo complete! Ball reached rest position.';
        }
      }

      animate();
    }

    function runNoiseDemo(canvas, statusEl) {
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      let animationId = null;
      let frame = 0;

      statusEl.textContent = 'Running Perlin noise animation demo...';

      function animate() {
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        // Generate organic movement using noise
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 60;

        // Create multiple orbiting elements with noise
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + frame * 0.02;
          const noiseOffset = noise2D(frame * 0.05 + i, 0) * Math.PI * 0.5;
          const finalAngle = angle + noiseOffset;

          const x = centerX + Math.cos(finalAngle) * radius;
          const y = centerY + Math.sin(finalAngle) * radius;

          // Color based on position
          const hue = (i / 8) * 360;
          ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Draw central pulsing element
        const pulseScale = 1 + noise2D(frame * 0.1, 1) * 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15 * pulseScale, 0, 2 * Math.PI);
        ctx.fill();

        frame++;
        if (frame < 300) { // 10 seconds at 30fps
          animationId = requestAnimationFrame(animate);
        } else {
          statusEl.textContent = 'Noise demo complete! Organic movement simulation finished.';
        }
      }

      animate();
    }

    function runInterpolateDemo(canvas, statusEl) {
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      let animationId = null;
      let frame = 0;

      statusEl.textContent = 'Running interpolation animation demo...';

      function animate() {
        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        // Demonstrate different interpolation types
        const progress = (frame / 120) % 1; // 4 seconds loop at 30fps

        // Linear interpolation
        const linearX = interpolate(progress, [0, 1], [50, width - 50]);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(linearX, 60, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Ease-out interpolation
        const easeOutX = interpolate(progress, [0, 1], [50, width - 50], 'ease-out');
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(easeOutX, 100, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Bounce interpolation
        const bounceX = interpolate(progress, [0, 1], [50, width - 50], 'bounce');
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(bounceX, 140, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Color interpolation
        const color = blendColors(progress, '#ff0000', '#0000ff');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(width / 2, 180, 12, 0, 2 * Math.PI);
        ctx.fill();

        // Labels
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '11px Arial';
        ctx.fillText('Linear', 50, 50);
        ctx.fillText('Ease-Out', 50, 90);
        ctx.fillText('Bounce', 50, 130);
        ctx.fillText('Color Blend', 50, 170);

        frame++;
        if (frame < 480) { // 16 seconds at 30fps
          animationId = requestAnimationFrame(animate);
        } else {
          statusEl.textContent = 'Interpolation demo complete! Showed linear, easing, bounce, and color interpolation.';
        }
      }

      animate();
    }

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
      els.generateBtn?.addEventListener('click', generateClip);

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
      });

      // Zoom controls (prototype: out / track / in / fit)
      const zoomOutBtn = root.querySelector('[data-action="zoom-out"]');
      const zoomInBtn = root.querySelector('[data-action="zoom-in"]');
      const zoomFitBtn = root.querySelector('[data-action="zoom-fit"]');
      const setZoom = (next) => { state.zoom = Math.max(0.5, Math.min(2, next)); renderTracks(); };
      if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setZoom((state.zoom || 1) - 0.25));
      if (zoomInBtn) zoomInBtn.addEventListener('click', () => setZoom((state.zoom || 1) + 0.25));
      if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => setZoom(1));

      // Viewer fullscreen → video player modal (prototype vfFull)
      const vfFull = root.querySelector('#vfFull');
      if (vfFull) vfFull.addEventListener('click', () => openVideoPlayerModal(state, showToast));

      // Generate card tiles (prototype-style) → open the matching surface
      const genAutoCut = root.querySelector('#genAutoCut');
      const genSubtitles = root.querySelector('#genSubtitles');
      const genAiVideo = root.querySelector('#genAiVideo');
      const genCutAi = root.querySelector('#genCutAi');
      const openSubtitleEditorBtn = root.querySelector('#openSubtitleEditor');
      if (genAutoCut) genAutoCut.addEventListener('click', () => openTemplateGeneratorModal(state, showToast));
      if (genSubtitles) genSubtitles.addEventListener('click', () => generateSubtitles());
      if (genAiVideo) genAiVideo.addEventListener('click', () => runCineGenTool(CINEGEN_TOOLS.GAP_FILL, { clipId: state.selectedClipId }));
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
      root.querySelectorAll('.fi-chip').forEach(chip => {
        const key = chip.getAttribute('data-modal');
        const handler = FEATURE_INDEX_MODALS[key];
        if (handler) chip.addEventListener('click', handler);
      });

      // Rendiv Animation Demo handlers
      const runSpringDemoBtn = root.querySelector('#runSpringDemo');
      const runNoiseDemoBtn = root.querySelector('#runNoiseDemo');
      const runInterpolateDemoBtn = root.querySelector('#runInterpolateDemo');
      const animationCanvas = root.querySelector('#animationCanvas');
      const demoStatus = root.querySelector('#demoStatus');

      if (runSpringDemoBtn) runSpringDemoBtn.addEventListener('click', () => runSpringDemo(animationCanvas, demoStatus));
      if (runNoiseDemoBtn) runNoiseDemoBtn.addEventListener('click', () => runNoiseDemo(animationCanvas, demoStatus));
      if (runInterpolateDemoBtn) runInterpolateDemoBtn.addEventListener('click', () => runInterpolateDemo(animationCanvas, demoStatus));

      els.uploadBtn?.addEventListener('click', () => els.uploadInput?.click());
      els.uploadInput?.addEventListener('change', (event) => handleUpload(event.target.files?.[0]));

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

      const cinegenBtn = root.querySelector('#cinegenToolsBtn');
      if (cinegenBtn) {
        cinegenBtn.addEventListener('click', () => {
          runCineGenTool(CINEGEN_TOOLS.GAP_FILL, { clipId: state.selectedClipId });
          
        });
      }

      const gapFillBtn = root.querySelector('#cinegenGapFillBtn');
      if (gapFillBtn) {
        gapFillBtn.addEventListener('click', async () => {
          const result = await runCineGenTool(CINEGEN_TOOLS.GAP_FILL, { clipId: state.selectedClipId });
          updateCineGenResults(result);
          if (result.success) {
            applyCineGenResultToTimeline(result);
            
          }
        });
      }

      const extendBtn = root.querySelector('#cinegenExtendBtn');
      if (extendBtn) {
        extendBtn.addEventListener('click', async () => {
          const result = await runCineGenTool(CINEGEN_TOOLS.EXTEND, { clipId: state.selectedClipId });
          updateCineGenResults(result);
          if (result.success) {
            applyCineGenResultToTimeline(result);
            
          }
        });
      }

      const musicBtn = root.querySelector('#cinegenMusicBtn');
      const modelSelect = root.querySelector('#musicModelSelect');
      if (modelSelect && musicBtn) {
        modelSelect.addEventListener('change', () => {
          musicBtn.dataset.model = modelSelect.value;
        });
        musicBtn.dataset.model = modelSelect.value;
      }
      if (musicBtn) {
        musicBtn.addEventListener('click', async () => {
          try {
            const { default: muapi } = await import('../lib/muapi.js');
            const model = musicBtn.dataset.model || 'suno-create-music';
            const prompt = prompt('Describe the music (or leave empty for auto):') || 'cinematic background music';
            const result = await muapi.generateMusic({ model, prompt, duration: 30 });
            if (result.url) {
              // Drop generated audio onto the Audio track
              const audioTrack = state.tracks.find(t => t.type === 'audio') || state.tracks[3];
              if (audioTrack) {
                audioTrack.clips = audioTrack.clips || [];
                audioTrack.clips.push({
                  id: 'music_' + Date.now(),
                  name: `Music: ${model}`,
                  src: result.url,
                  start: 0,
                  duration: 30,
                  type: 'audio'
                });
                
                if (typeof render === 'function') render();
              }
            } else {
              
            }
          } catch (e) {
            
          }
        });
      }

      const maskBtn = root.querySelector('#cinegenMaskBtn');
      if (maskBtn) {
        maskBtn.addEventListener('click', async () => {
          const result = await runCineGenTool('mask_tool', { clipId: state.selectedClipId });
          updateCineGenResults(result);
          if (result.success) {}
        });
      }

      const elementBtn = root.querySelector('#cinegenElementBtn');
      if (elementBtn) {
        elementBtn.addEventListener('click', async () => {
          const result = await runCineGenTool('element_create', { clipId: state.selectedClipId });
          updateCineGenResults(result);
          if (result.success) {}
        });
      }

      const polishBtn = root.querySelector('#cinegenPolishBtn');
      if (polishBtn) {
        polishBtn.addEventListener('click', async () => {
          const gapResult = await runCineGenTool(CINEGEN_TOOLS.GAP_FILL, { clipId: state.selectedClipId });
          if (gapResult.success) applyCineGenResultToTimeline(gapResult);

          const extendResult = await runCineGenTool(CINEGEN_TOOLS.EXTEND, { clipId: state.selectedClipId });
          if (extendResult.success) applyCineGenResultToTimeline(extendResult);

          updateCineGenResults({ success: true, message: 'Clip polished (Gap Fill + Extend)' });
          
        });
      }

      const chatBtn = root.querySelector('#cinegenChatBtn');
      if (chatBtn) {
        chatBtn.addEventListener('click', () => {
          // Focus the AI Chat panel
          const chatInput = document.querySelector('#chatInput');
          if (chatInput) chatInput.focus();
          
        });
      }

      const subBtn = root.querySelector('#cinegenSubBtn');
      if (subBtn) {
        subBtn.addEventListener('click', async () => {
          await generateSubtitles();
          
        });
      }

      const llmBtn = root.querySelector('#cinegenLLMBtn');
      if (llmBtn) {
        llmBtn.addEventListener('click', () => {
          const chatInput = document.querySelector('#chatInput');
          if (chatInput) {
            chatInput.focus();
            chatInput.placeholder = 'Ask CineGen LLM...';
          }
          
        });
      }

      const samBtn = root.querySelector('#cinegenSAMBtn');
      if (samBtn) {
        samBtn.addEventListener('click', async () => {
          const prompt = prompt('Enter segmentation prompt (e.g., "the person in red shirt")');
          if (!prompt) return;

          const result = await runCineGenTool('sam3_segment', {
            clipId: state.selectedClipId,
            prompt: prompt
          });

          if (result.success) {
            updateCineGenResults(result);
            applyCineGenResultToTimeline(result);
            
          }
        });
      }

      const syncBtn = root.querySelector('#cinegenSyncBtn');
      if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
          const result = await runCineGenTool('audio_sync', {
            clipId: state.selectedClipId
          });
          updateCineGenResults(result);
          if (result.success) {}
        });
      }

      const layerBtn = root.querySelector('#cinegenLayerBtn');
      if (layerBtn) {
        layerBtn.addEventListener('click', async () => {
          const result = await runCineGenTool('layer_decompose', { clipId: state.selectedClipId });
          updateCineGenResults(result);
          if (result.success) {}
        });
      }

      const shotBtn = root.querySelector('#cinegenShotBtn');
      if (shotBtn) {
        shotBtn.addEventListener('click', async () => {
          const result = await runCineGenTool('shot_board', { clipId: state.selectedClipId });
          updateCineGenResults(result);
          if (result.success) {}
        });
      }

      const proxyBtn = root.querySelector('#cinegenProxyBtn');
      if (proxyBtn) {
        proxyBtn.addEventListener('click', async () => {
          const result = await runCineGenTool('proxy_playback', { enabled: true });
          updateCineGenResults(result);
          if (result.success) {}
        });
      }

      const planBtn = root.querySelector('#cinegenPlanBtn');
      if (planBtn) {
        planBtn.addEventListener('click', async () => {
          const result = await runCineGenTool('composition_plan', { clipId: state.selectedClipId });
          updateCineGenResults(result);
          if (result.success) {}
        });
      }

      // 3D Camera Effects quick buttons
      root.querySelectorAll('[data-camera-effect]').forEach(btn => {
        btn.addEventListener('click', () => {
          const effect = btn.dataset.cameraEffect;
          const selected = findSelectedClip();
          if (!selected) {
            
            return;
          }

          applyCameraEffect(effect);
        });
      });
    }

      const clearBtn = root.querySelector('#clearCineGenResults');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          const container = document.getElementById('cinegenResults');
          if (container) {
            container.innerHTML = 'No CineGen tools used yet';
          }
          cinegenHistory = [];
          
        });
      }

    function renderAll() {
      initializeDefaultTracks();
      renderTools();
      renderPills();
      renderTracks();
      renderMedia();
      renderGenerateTypes();

      renderRail();
      renderMultiCamera();
      updatePreview();
      updatePlaybackUI();
    }

    function renderMultiCamera() {
      if (els.multiCameraToolbar) renderMultiCameraToolbar(state, els.multiCameraToolbar);
      if (els.pipControls) renderPipControls(state, els.pipControls);
      if (els.splitControls) renderSplitScreenControls(state, els.splitControls);
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

    function openAIAgentsPanel(state, showToast) {
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
          max-width: 500px; width: 90%; max-height: 80vh; overflow: hidden;
        `;
        
        modalContent.innerHTML = `
          <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.2);">
            <h3 style="margin: 0; color: rgba(255,255,255,0.9);">AI Agents Panel</h3>
            <button class="modal-close" style="background: none; border: none; color: rgba(255,255,255,0.6); font-size: 20px; cursor: pointer; padding: 4px;">✕</button>
          </div>
          <div class="modal-body" style="padding: 24px; max-height: 60vh; overflow-y: auto;">
            <p style="color: rgba(255,255,255,0.7); margin-bottom: 16px;">Analyze timeline and get AI-powered suggestions for improvement.</p>
            <div id="agents-list" style="display: grid; gap: 12px; margin-bottom: 16px;"></div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button id="close-agents" style="padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid var(--border); border-radius: 8px; cursor: pointer;">Close</button>
            </div>
          </div>
        `;
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        const agentsList = modalContent.querySelector('#agents-list');
        const agents = [
          { id: 'analyze', name: 'Timeline Analysis', desc: 'Detect scenes, gaps, and improvement suggestions', icon: '📊' },
          { id: 'character', name: 'Character Tracking', desc: 'Maintain character consistency across shots', icon: '👤' },
          { id: 'broll', name: 'B-Roll Suggestions', desc: 'Get relevant b-roll recommendations', icon: '🎞️' },
          { id: 'audio', name: 'Audio Sync', desc: 'Fix audio timing and levels', icon: '🎵' }
        ];
        
        agents.forEach(agent => {
          const btn = document.createElement('button');
          btn.style.cssText = 'padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; text-align: left;';
          btn.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 24px;">${agent.icon}</span>
              <div>
                <div style="color: rgba(255,255,255,0.9); font-weight: 500;">${agent.name}</div>
                <div style="color: rgba(255,255,255,0.5); font-size: 12px;">${agent.desc}</div>
              </div>
            </div>
          `;
          btn.addEventListener('click', () => {
            if (agent.id === 'analyze') openAIAnalyzeModal(state, showToast);
            else if (agent.id === 'character') openCharacterTrackingPanel(state, showToast);
            else if (agent.id === 'broll') suggestBRoll();
            else if (agent.id === 'audio') generateSubtitles();
            document.body.removeChild(modalOverlay);
          });
          agentsList.appendChild(btn);
        });
        
        const closeModal = () => document.body.removeChild(modalOverlay);
        modalContent.querySelector('.modal-close').addEventListener('click', closeModal);
        modalContent.querySelector('#close-agents').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => e.target === modalOverlay && closeModal());
        
        
      } catch (error) {
        console.error('Failed to open AI Agents panel:', error);
        
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
            <div style="color: #cffafe; font-weight: 500;">✓ No gaps detected</div>
            <div style="color: rgba(255,255,255,0.5); font-size: 12px;">Timeline is continuous</div>
          </div>
          <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px;">
            <div style="color: #cffafe; font-weight: 500;">3 scenes detected</div>
            <div style="color: rgba(255,255,255,0.5); font-size: 12px;">Opening, Main, Closing</div>
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
      let drift = 0;
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
      let found = null;
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

  return container;
}
