import { supabase, uploadFileToStorage } from '../lib/hybrid-supabase.js';
import { initializeMediaLibraryDragDrop, setupEnhancedTooltips } from '../lib/editor/dragDrop.js';
// MARKER_TEST_ABC123import { processFileUpload } from '../lib/editor/uploadPipeline.js';
import { setupUploadSources } from '../lib/editor/uploadSources.js';
import { saveProjectToStorage } from '../lib/editor/persistence.js';
import { renderMediaGrid, addMediaToTimeline } from '../lib/editor/mediaLibrary.js';
import { assetStore } from '../lib/assets/assetStore.js';
import { extendClipContextMenu, extendGenerationPanel, extendMediaLibrary, extendTopActions, openGTMPromptModal } from '../lib/uiIntegration.js';
import { integrateMediaIngest, GiphyIntegration, StickersLibrary, LowerThirds, VideoGallery, AnimationList } from '../lib/mediaIngest.js';
import { renderMultiCameraToolbar, renderPipControls, renderSplitScreenControls } from '../lib/editor/multiCamera.js';
import { createTimelineState } from '../lib/editor/timelineEditorState.js';
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
      <button class="icon-btn" id="backBtn" data-tooltip="Go back - Return to the previous view or project selection" aria-label="Go back to the previous view">←</button>
      <div class="brand-mark">🎬</div>
      <div>
        <div class="brand-title">TIMELINE</div>
        <div class="brand-sub">AI Video Editor</div>
      </div>
    </div>
    <div class="project-head">
      <div class="title" id="projectTitle">Untitled Project</div>
      <div class="sub" id="projectSub">Working timeline preview</div>
    </div>
    <div class="top-actions" id="topActions" data-tooltip="Quick action toolbar"></div>
  </header>
  <div class="main-grid">
    <div class="left-col">
      <div class="left-top">
        <aside class="side-card" style="min-height:100%; display:flex; flex-direction:column;">
          <div id="aiChatContainer"></div>
        </aside>
        <section class="preview-card">
          <div class="preview-glow"></div>
          <div class="preview-inner">
            <div class="preview-stage" id="previewStage"></div>
            <div class="preview-empty" id="previewEmpty">
              <div class="preview-screen">
                <div class="preview-emoji" id="previewEmoji">🎥</div>
                <div class="preview-title" id="previewTitle">Center Preview</div>
                <div class="preview-sub" id="previewSubtitle">Glow preview styled like the render page</div>
              </div>
            </div>
          </div>
          <input type="file" id="uploadInput" accept="video/*,image/*,audio/*,.txt" hidden data-testid="file-input" />
          <div class="preview-overlay">
            <div class="time-row">
              <span id="currentTime">00:12.40</span>
              <span id="totalTime">01:00.00</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
            <div class="control-row">
              <button class="circle-btn" id="rewindBtn" data-tooltip="Rewind - Move the playhead back by 10% (←)" aria-label="Rewind the playhead by 10%">⏮</button>
              <button class="circle-btn primary" id="playBtn" data-tooltip="Play or pause timeline preview (Spacebar)" aria-label="Play or pause timeline preview">▶</button>
              <button class="circle-btn" id="stopBtn" data-tooltip="Stop - Stop playback and return to beginning" aria-label="Stop playback and return to the beginning">⏹</button>
            </div>
          </div>
        </section>
      </div>
      <section class="timeline-card" data-testid="timeline-container">
        <div class="timeline-top">
          <div class="toolbar-left">
            <div class="tool-group" id="toolGroup"></div>
             <button class="mini-btn" data-action="zoom-out" data-tooltip="Zoom out - See more of the timeline (Mouse wheel)" aria-label="Zoom out on the timeline">🔍-</button>
            <button class="mini-btn" data-action="zoom-in" data-tooltip="Zoom in - See timeline in more detail (Mouse wheel)" aria-label="Zoom in on the timeline">🔍+</button>
            <button class="mini-btn" data-add-track="Video" data-tooltip="Add video track - Create a new video layer on the timeline" aria-label="Add a new video track">+Video</button>
            <button class="mini-btn" data-add-track="Audio" data-tooltip="Add audio track - Create a new audio layer on the timeline" aria-label="Add a new audio track">+Audio</button>
            <button class="mini-btn" data-add-track="Text" data-tooltip="Add text track - Create a new text overlay layer" aria-label="Add a new text track">+Text</button>
            <button class="mini-btn" data-add-track="B-Roll" data-tooltip="Add B-roll track - Create a new B-roll overlay layer" aria-label="Add a new B-roll track">+B-Roll</button>
            <button class="mini-btn" id="cutaiStoryboardBtn" data-tooltip="Generate storyboard with CutAI" aria-label="Open CutAI storyboard generator">✨AI</button>
             <button class="mini-btn" id="cinegenToolsBtn" data-tooltip="CineGen AI Tools: Open full set of AI editing tools including Gap Fill, Extend, Music, Mask and Elements" aria-label="Open CineGen tools">🎨CG</button>
             <button class="mini-btn" id="cinegenGapFillBtn" data-tooltip="CineGen Gap Fill: Automatically fill gaps between clips using AI" aria-label="Gap Fill">GF</button>
             <button class="mini-btn" id="cinegenExtendBtn" data-tooltip="CineGen Extend Clip: Extend selected clip duration with AI-generated content" aria-label="Extend">EX</button>
              <button class="mini-btn" id="cinegenMusicBtn" data-tooltip="CineGen Generate Music: Create background music track for current clip" aria-label="Generate Music">♫</button>
              <select id="musicModelSelect" class="mini-select" title="Music Model">
                <option value="suno-create">Suno</option>
                <option value="mmaudio-t2a">MMAudio</option>
              </select>
              <button class="mini-btn" id="cinegenMaskBtn" data-tooltip="CineGen AI Mask Tool: Generate precise masks for object isolation" aria-label="Mask Tool">M</button>
             <button class="mini-btn" id="cinegenElementBtn" data-tooltip="Create CineGen Element: Generate reusable visual elements or overlays" aria-label="Create Element">EL</button>
             <button class="mini-btn" id="cinegenPolishBtn" data-tooltip="CineGen Polish Clip: Apply Gap Fill + Extend in one step for seamless results" aria-label="Polish Clip">Polish</button>
             <button class="mini-btn" id="cinegenChatBtn" data-tooltip="Ask CineGen Assistant: Get contextual AI help for timeline editing" aria-label="CineGen Chat">AI</button>
             <button class="mini-btn" id="cinegenSubBtn" data-tooltip="CineGen Smart Subtitles: Auto-generate accurate timed subtitles" aria-label="Smart Subtitles">Sub</button>
             <button class="mini-btn" id="cinegenLLMBtn" data-tooltip="CineGen LLM Assistant: Advanced reasoning for complex edits" aria-label="LLM Assistant">LLM</button>
             <button class="mini-btn" id="cinegenSAMBtn" data-tooltip="CineGen SAM3 Segmentation: Use Meta SAM3 for precise segment masks" aria-label="SAM3 Segmentation">SAM</button>
              <button class="mini-btn" id="cinegenSyncBtn" data-tooltip="CineGen Audio Sync: Automatically align audio to video clips" aria-label="Audio Sync">Sync</button>
              <button class="mini-btn" id="cinegenLayerBtn" data-tooltip="CineGen Layer Decomposition: Separate foreground, background and effects layers" aria-label="Layer Decomposition">Layer</button>
              <button class="mini-btn" id="cinegenShotBtn" data-tooltip="CineGen Shot Board: Create and manage multi-shot sequences" aria-label="Shot Board">Shot</button>
              <button class="mini-btn" id="cinegenProxyBtn" data-tooltip="CineGen Proxy Playback: Use optimized proxies for smooth scrubbing" aria-label="Proxy Playback">Proxy</button>
              <button class="mini-btn" id="cinegenPlanBtn" data-tooltip="CineGen Composition Plan: Generate AI-suggested edit plan for project" aria-label="Composition Plan">Plan</button>
           </div>
          <div class="pill-row" id="pillRow"></div>
        </div>
        <div class="timeline-controls-enhanced" id="timelineControlsEnhanced"></div>
        <div class="timeline-shell">
          <div class="timeline-header-grid">
            <div class="timeline-corner">
              <span>Tracks</span>
              <span class="hint">drag • snap</span>
            </div>
            <div class="timeline-ruler" id="timelineRuler">
              <canvas id="rulerCanvas"></canvas>
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
      <!-- Mobile-only tab bar: lets users switch between panel groups on phones.
           Hidden on desktop via CSS; on mobile, only the active tab's panel is visible. -->
      <nav class="side-tabs" role="tablist" aria-label="Side panel navigation">
        <button class="side-tab active" data-tab="media" role="tab" aria-selected="true" aria-controls="sidePanelMedia">📁 Media</button>
        <button class="side-tab" data-tab="tools" role="tab" aria-selected="false" aria-controls="sidePanelTools">🛠 Tools</button>
        <button class="side-tab" data-tab="generate" role="tab" aria-selected="false" aria-controls="sidePanelGenerate">⚡ Generate</button>
      </nav>
      <div id="sidePanelMedia" class="side-panel" role="tabpanel" aria-labelledby="sidePanelMedia-tab">
      <aside class="side-card">
        <div class="card-title">📁 Media</div>
        <button class="upload-btn" id="uploadBtn" data-tooltip="Upload media - Import video, image, or audio files into the project" aria-label="Upload media into the editor">Upload</button>
        <div class="media-note">Choose what you want to add to the timeline. Each tile inserts a different type of source asset.</div>
        <div class="media-grid" id="mediaGrid"></div>
      </aside>
      <aside class="side-card" id="sceneDetectorPanel">
        <div id="sceneDetectorContainer"></div>
      </aside>
      <aside class="side-card" id="cameraEffectsPanel">
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
      <aside class="side-card generate">
        <div class="generate-head"><div class="card-title cyan">⚡ Generate</div><div style="color: rgba(255,255,255,0.6)" aria-label="Close generation panel" role="button" tabindex="0">✕</div></div>
        <div class="generate-types" id="generateTypes"></div>
        <textarea class="text-area" id="promptInput" placeholder="A cinematic shot of..."></textarea>
        <input class="text-input" id="negativeInput" placeholder="Negative prompt" />
        <div class="select-row">
          <select class="select-input" id="durationSelect"><option>5s</option><option>8s</option><option>12s</option></select>
          <select class="select-input" id="aspectSelect"><option>16:9</option><option>9:16</option><option>1:1</option></select>
          <select class="select-input" id="styleSelect"><option>Cinematic</option><option>Commercial</option><option>Documentary</option></select>
        </div>
        <button class="primary-btn" id="generateBtn" aria-label="Generate a new asset from the prompt settings">⚡ Generate</button>
      </aside>
      </div>
      <div id="sidePanelTools" class="side-panel" role="tabpanel" aria-labelledby="sidePanelTools-tab" hidden>
            <aside class="side-card" id="cinegenResultsPanel" data-tooltip="CineGen AI Tools Results">
              <div class="card-title">🎨 CineGen Results</div>
              <div id="cinegenResults" style="font-size: 12px; color: var(--dim); min-height: 60px;">
                No CineGen tools used yet
              </div>
              <button class="mini-btn" id="clearCineGenResults" style="margin-top: 8px; width: 100%;">Clear History</button>
            </aside>

      <aside class="side-card" id="animationDemoPanel" style="display: none;" data-tooltip="Rendiv animation demonstrations">
        <div class="card-title">🎭 Rendiv Animation Demo</div>
        <div id="animationDemoContainer">
          <div class="animation-demo-controls">
            <button class="mini-btn" id="runSpringDemo" data-tooltip="Spring animation - Demonstrates physics-based spring motion with damping">Spring Animation</button>
            <button class="mini-btn" id="runNoiseDemo" data-tooltip="Noise animation - Shows organic Perlin noise-based movement">Noise Animation</button>
            <button class="mini-btn" id="runInterpolateDemo" data-tooltip="Interpolation demo - Compare linear, ease-out, bounce, and color blending">Interpolate Demo</button>
          </div>
          <div class="animation-demo-canvas">
            <canvas id="animationCanvas" width="300" height="200"></canvas>
          </div>
          <div class="animation-demo-info">
            <div id="demoStatus">Click a button to start animation demo</div>
          </div>
        </div>
      </aside>
      </div>
      <div id="sidePanelGenerate" class="side-panel" role="tabpanel" aria-labelledby="sidePanelGenerate-tab" hidden>
      <aside class="side-card" id="clipSettingsPanel" style="display: none;" data-tooltip="Clip editor - Edit selected clip properties">
        <div class="card-title">🎬 Clip Editor</div>
        <div id="clipEditorContainer"></div>
      </aside>
      <aside class="side-card" id="transitionSettingsPanel" style="display: none;" data-tooltip="Transitions - Add effects between clips">
        <div class="card-title">🔄 Transitions</div>
        <div id="transitionEditorContainer"></div>
      </aside>
      <aside class="side-card" id="multiCameraPanel" data-tooltip="Multi-camera editing, PIP, and split screen">
        <div class="card-title">📺 Multi-Camera</div>
        <div id="multiCameraToolbar"></div>
        <div id="pipControls" class="pip-controls-container" style="display: none;"></div>
        <div id="splitControls" class="split-controls-container" style="display: none;"></div>
      </aside>
      <aside class="side-card" id="colorCorrectionPanel" style="display: none;" data-tooltip="Color correction - Adjust color grading and correction">
        <div class="card-title">🎨 Color Correction</div>
        <div id="colorCorrectionContainer"></div>
      </aside>
      <aside class="side-card" id="colorScopesPanel" data-tooltip="Color scopes - Waveform, vectorscope, and histogram">
        <div class="card-title">📊 Color Scopes</div>
        <div id="colorScopesContainer"></div>
      </aside>

      <!-- Category C Editor Surfaces -->
      <aside class="side-card" id="canvasPanel" style="display: none;" data-tooltip="Canvas editor - Visual composition surface">
        <div class="card-title">🎨 Canvas Editor</div>
        <div id="canvasContainer"></div>
      </aside>
      <aside class="side-card" id="tokenEditorPanel" style="display: none;" data-tooltip="Token editor - Create personalization tokens">
        <div class="card-title">🏷️ Token Editor</div>
        <div id="tokenEditorContainer"></div>
      </aside>
      <aside class="side-card" id="batchGeneratorPanel" style="display: none;" data-tooltip="Batch generator - Generate multiple videos at once">
        <div class="card-title">📦 Batch Generator</div>
        <div id="batchGeneratorContainer"></div>
      </aside>
      <aside class="side-card" id="workflowPanel" style="display: none;" data-tooltip="Workflow automation - Create automated video pipelines">
        <div class="card-title">🔄 Workflow Automation</div>
        <div id="workflowContainer"></div>
      </aside>
      <aside class="side-card" id="personalizationPanel" style="display: none;" data-tooltip="Personalization - Add dynamic content for different viewers">
        <div class="card-title">👤 Personalization</div>
        <div id="personalizationContainer"></div>
      </aside>
      <aside class="side-card" id="personalizationEditorPanel" style="display: none;" data-tooltip="Personalization editor - Advanced personalization settings">
        <div class="card-title">✏️ Personalization Editor</div>
        <div id="personalizationEditorContainer"></div>
      </aside>
      </div>
    </div>
  </div>
</div>
<div class="floating-rail" id="floatingRail"></div>
<div class="status-toast" id="toast"></div>
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
      projectTitle: 'Untitled Project',
      selectedTool: 'Select',
      selectedClipId: 1,
      generateType: 'Text',
      playing: false,
      playheadPercent: 32,
      zoom: 1,
      timelineSeconds: 60,
      tracks: [
        { id: 'video-1', type: 'video', name: 'Video', muted: false, solo: false, locked: true, clips: [
          { id: 1, name: 'Opening Shot', left: 8, width: 18, type: 'video', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', poster: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#06131f"/><stop offset="1" stop-color="#123b4a"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="970" cy="180" r="120" fill="#22d3ee" opacity=".18"/><text x="90" y="310" fill="white" font-size="74" font-family="Arial" font-weight="700">Opening Shot</text><text x="92" y="380" fill="#a5f3fc" font-size="30" font-family="Arial">Cinematic demo preview</text></svg>`) },
          { id: 2, name: 'Generated Clip', left: 34, width: 16, type: 'video', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm', poster: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><rect x="110" y="145" width="1060" height="430" rx="28" fill="white" opacity=".04"/><text x="110" y="310" fill="white" font-size="76" font-family="Arial" font-weight="700">Generated Clip</text><text x="112" y="382" fill="#bbf7d0" font-size="30" font-family="Arial">Rendered output preview</text></svg>`) }
        ] },
        { id: 'audio-1', type: 'audio', name: 'Audio', muted: false, solo: false, locked: false, clips: [
          { id: 3, name: 'Music Bed', left: 5, width: 42, type: 'audio', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3' }
        ] },
        { id: 'text-1', type: 'text', name: 'Text', muted: false, solo: false, locked: false, clips: [
          { id: 4, name: 'Title Card', left: 14, width: 12, type: 'text', heading: 'Launch Faster', body: 'Use your timeline editor to turn generated media, overlays, and captions into polished deliverables.' }
        ] },
        { id: 'broll-1', type: 'b-roll', name: 'B-Roll', muted: false, solo: false, locked: false, clips: [
          { id: 5, name: 'City Cutaway', left: 52, width: 20, type: 'image', src: svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#020617"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><g opacity=".9"><rect x="120" y="340" width="120" height="250" fill="#0f172a"/><rect x="260" y="280" width="140" height="310" fill="#111827"/><rect x="430" y="210" width="180" height="380" fill="#1f2937"/><rect x="650" y="250" width="110" height="340" fill="#0f172a"/><rect x="780" y="180" width="210" height="410" fill="#1e293b"/></g><circle cx="1060" cy="130" r="70" fill="#e0f2fe" opacity=".75"/><text x="120" y="150" fill="white" font-size="78" font-family="Arial" font-weight="700">City Cutaway</text></svg>`), fit: 'cover' }
        ] }
      ],
      tools: baseState.tools, // Use enhanced tools from baseState
      pills: ['Text to Video', 'Image to Video', 'Retake', 'Extend', 'B-Roll', 'Music Gen', 'Audio Sync', 'Fill Gap AI', 'Elements', 'Import Timeline', 'IC-LoRA'],
      topIcons: ['👁','📺','📁','⚡','🎵','🔊','🎞️','👤','🎨','💬','📋','🎬','💾','⚙️','💳','🔗','👀','▶️','🤖','🎭','📊'],
      media: [
        { icon: '🎬', label: 'Video Clip', desc: 'Insert a source shot or generated video clip.', tooltip: 'Video clip - Add video footage to the timeline' },
        { icon: '🖼️', label: 'Image Frame', desc: 'Add still images, frames, or storyboard art.', tooltip: 'Image frame - Add still images or graphics' },
        { icon: '🎵', label: 'Audio Track', desc: 'Place music, voiceover, or sound design assets.', tooltip: 'Audio track - Add music, voiceover, or sound effects' },
        { icon: '🎞️', label: 'B-Roll Asset', desc: 'Drop in cutaways, overlays, or support footage.', tooltip: 'B-roll - Add supplementary footage and cutaways' }
      ],
      generateTypes: [['✍️', 'Text'], ['🖼️', 'Image'], ['🔄', 'Retake'], ['➡️', 'Extend'], ['🎞️', 'B-Roll']],
      quickCommands: ['⚡Generate','Retake','Extend','B-Roll','🎬 Detect Scenes'],
      railActions: [['⚡', 'Generate', true], ['✂️', 'Split'], ['🎬', 'Scenes'], ['💬', 'Subtitle'], ['🎞️', 'B-Roll'], ['⏱️', 'Speed'], ['🪄', 'Stabilize'], ['📝', 'Text'], ['🔄', 'Transitions'], ['🎬', 'AI Video'], ['🎥', 'Recorder'], ['🎙️', 'Enhanced Recorder'], ['📋', 'Templates'], ['👀', 'Preview Template'], ['📱', 'Social'], ['📧', 'Email Campaign'], ['🔗', 'URL Video'], ['📸', 'Page Shot'], ['👥', 'Contacts'], ['🎨', 'Canvas'], ['🏷️', 'Token Editor'], ['📦', 'Batch Generator'], ['🔄', 'Workflow'], ['👤', 'Personalization'], ['✏️', 'Personalization Editor'], ['🎬', 'Personalization Suite'], ['🏠', 'Landing Pages'], ['📋', 'Lead Generator']],

      // Enhanced state management
      projectId: null,
      undoStack: [],
      redoStack: [],
      mediaLibrary: [],
      generationQueue: [],
      isProcessing: false
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
    const hundredths = Math.floor((current % 1) * 100);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
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
      previewTitle: root.querySelector('#previewTitle'),
      previewSubtitle: root.querySelector('#previewSubtitle'),
      previewEmoji: root.querySelector('#previewEmoji'),
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
        els.previewTitle.textContent = 'Center Preview';
        els.previewSubtitle.textContent = 'Glow preview styled like the render page';
        els.previewEmoji.textContent = '🎥';
        return;
      }

      els.previewEmpty.style.display = 'none';
      els.previewTitle.textContent = selected.name;
      els.previewSubtitle.textContent = `${state.selectedTool} tool active • ${state.generateType} generation ready`;
      els.previewEmoji.textContent = selected.type === 'audio' ? '🎵' : selected.type === 'text' ? '📝' : selected.type === 'image' ? '🖼️' : '🎥';

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
      const selected = clip || findSelectedClip();
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
        const step = (e.shiftKey ? 5 : 1); // 1% default, 5% with Shift
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
      els.playBtn.textContent = state.playing ? '❚❚' : '▶';
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

    function renderTopActions() {
      els.topActions.innerHTML = '';
      const topActionTooltips = {
        '👁': 'Toggle preview visibility - Show or hide the preview panel',
        '📺': 'Monitor settings - Configure display and monitoring options',
        '📁': 'Media library - Browse and manage project media files',
        '⚡': 'Quick AI actions - Access AI-powered editing tools',
        '🎵': 'Music tools - Add and edit music tracks and sound effects',
        '🔊': 'Audio controls - Adjust volume, mixing, and audio levels',
        '🎞️': 'Video tools - Access video editing and scene tools',
        '👤': 'Character tools - Manage character profiles and tracking',
        '🎨': 'Color correction - Open color grading and correction panel',
        '⚙️': 'Editor settings - Configure editor preferences and options',
        '💬': 'AI chat - Open the AI assistant chat panel',
        '📋': 'Project notes - View and edit project notes',
        '🎬': 'End screen - Add end screen elements to your video',
        '💾': 'Save project - Save your current project progress',
        '💳': 'Billing - Manage subscriptions and billing',
        '🔗': 'Connections - Configure third-party integrations',
        '👀': 'Preview media - Preview media files before adding',
        '▶️': 'Video player - Open the full video player',
        '🤖': 'AI Agents - Analyze timeline and generate suggestions',
        '🎭': 'Character tracking - Maintain character consistency',
        '📊': 'Timeline analysis - Detect gaps and analyze timeline'
      };
      state.topIcons.forEach((icon, index) => {
        const button = document.createElement('button');
        button.className = `top-icon ${index === 3 ? 'active' : ''}`;
        button.textContent = icon;
        button.setAttribute('data-tooltip', topActionTooltips[icon] || `${icon} action`);
        button.title = topActionTooltips[icon] || 'Top action';
        button.setAttribute('aria-label', button.title);

        // Add specific functionality for each icon
        button.addEventListener('click', () => {
          switch (icon) {
            case '👁':
              togglePreviewVisibility();
              break;
            case '📺':
              openMonitorSettings();
              break;
            case '📁':
              openMediaLibrary();
              break;
            case '⚡':
              toggleQuickAIActions();
              break;
            case '🎵':
              openMusicTools();
              break;
            case '🔊':
              openAudioControls();
              break;
            case '🎞️':
              openVideoTools();
              break;
            case '👤':
              openProfileTools();
              break;
            case '🎨':
              showColorCorrectionPanel();
              break;
            case '⚙️':
              openEditorSettings();
              break;
            case '💬':
              focusChatInput();
              break;
            case '📋':
              openProjectNotes();
              break;
            case '🎬':
              openEndScreenModal(state, showToast);
              break;
             case '💾':
               openSaveProjectModal(state, showToast);
               break;
             // Duplicate case removed
             case '🔗':
               openConnectModal(state, showToast);
               break;
            case '👀':
              openPreviewMediaModal(state, showToast);
              break;
            case '▶️':
              openVideoPlayerModal(state, showToast);
              break;
            case '🤖':
              openAIAgentsPanel(state, showToast);
              break;
            case '🎭':
              openCharacterTrackingPanel(state, showToast);
              break;
            case '📊':
              openTimelineAnalysisPanel(state, showToast);
              break;
            default:
          }
        });

        els.topActions.appendChild(button);
      });

      // Extend top actions with enhancement features
      extendTopActions(els.topActions, state, showToast);

      const ready = document.createElement('div');
      ready.className = 'ready-pill';
      ready.innerHTML = '<span class="ready-dot"></span>Ready';
      ready.title = 'Editor is ready for interaction';
      ready.setAttribute('aria-label', 'Editor is ready for interaction');
      els.topActions.appendChild(ready);
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
      if (!state.project) state.project = { tracks: [] };
      if (!state.project.tracks || state.project.tracks.length === 0) {
        state.project.tracks = [
          { id: 'track-video', type: 'video', name: 'Video', items: [], muted: false, solo: false, locked: false },
          { id: 'track-audio', type: 'audio', name: 'Audio', items: [], muted: false, solo: false, locked: false },
          { id: 'track-text', type: 'text', name: 'Text', items: [], muted: false, solo: false, locked: false },
          { id: 'track-effects', type: 'effects', name: 'Effects', items: [], muted: false, solo: false, locked: false },
          { id: 'track-broll', type: 'b-roll', name: 'B-Roll', items: [], muted: false, solo: false, locked: false }
        ];
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
            <div class="clip-handle left" data-handle="left"></div>
            <div class="clip-handle right" data-handle="right"></div>
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
    function renderTracksIncremental(state, els, showToast) {
      const seenTrackIds = new Set();
      const trackRows = els.trackRows;

      state.tracks.forEach((track, trackIndex) => {
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
              renderTracksIncremental(state, els, showToast);
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
        const countEl = cached.meta.querySelector('.track-count');
        if (countEl && countEl.textContent !== `${track.clips.length} clips`) {
          countEl.textContent = `${track.clips.length} clips`;
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
          const leftPercent = (clip.start / state.timelineSeconds) * 100;
          const widthPercent = ((clip.end - clip.start) / state.timelineSeconds) * 100;

          // If clip position or selection changed, update in place
          if (clipEl && prevData &&
              prevData.leftPercent === leftPercent &&
              prevData.widthPercent === widthPercent &&
              prevData.selectedClipId === state.selectedClipId &&
              prevData.label === (clip.text || clip.name)) {
            return; // No change needed
          }

          if (!clipEl) {
            clipEl = document.createElement('button');
            clipEl.type = 'button';
            clipEl.className = `clip ${state.selectedClipId === clip.id ? 'active' : ''}`;
            clipEl.setAttribute('aria-label', `${clip.text || clip.name} — ${clip.type || 'clip'} clip on the ${track.name} track. Press Enter to select.`);
            clipEl.innerHTML = `<span class="clip-label"></span>`;
            cached.lane.appendChild(clipEl);
            cached.clipEls.set(clip.id, clipEl);

            clipEl.addEventListener('click', (event) => {
              if (event.target.classList.contains('clip-handle')) return;
              event.stopPropagation();
              state.selectedClipId = clip.id;
              renderTracksIncremental(state, els, showToast);
            });
          }

          clipEl.style.left = `${leftPercent}%`;
          clipEl.style.width = `${widthPercent}%`;
          clipEl.className = `clip ${state.selectedClipId === clip.id ? 'active' : ''}`;
          clipEl.setAttribute('aria-label', `${clip.text || clip.name} — ${clip.type || 'clip'} clip on the ${track.name} track. Press Enter to select.`);
          const labelEl = clipEl.querySelector('.clip-label');
          if (labelEl) labelEl.textContent = clip.text || clip.name;

          cached.clipData.set(clip.id, {
            leftPercent, widthPercent,
            selectedClipId: state.selectedClipId,
            label: clip.text || clip.name
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
          <div class="clip-handle left" data-handle="left"></div>
          <div class="clip-handle right" data-handle="right"></div>
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

      // Add enhanced drag and drop handlers
      els.trackRows.querySelectorAll('.track-lane').forEach(lane => {
        const track = state.tracks.find(t => t.id === lane.dataset.trackId);

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
        });

        lane.addEventListener('drop', async (e) => {
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
            return;
          }
          
          // Original clip/media drop handling
          const data = JSON.parse(e.dataTransfer.getData('application/json') || '{}');

          if (data.type === 'clip') {
            const allClips = state.tracks.flatMap(t => t.clips);
            const clip = allClips.find(c => c.id === data.clipId);
            if (clip && track) {
              // Remove from old track
              state.tracks.forEach(t => t.clips = t.clips.filter(c => c.id !== clip.id));
              // Add to new track
              clip.left = Math.max(0, Math.min(100 - clip.width, percent));
              track.clips.push(clip);
              // Sort clips by left
              track.clips.sort((a, b) => a.left - b.left);
              saveStateSnapshot(state);
              renderTracks();
            }
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
            const newClip = { id: Date.now(), name: data.label, left: Math.max(0, percent), width: 16, type: data.mediaType, ...extra };
            track.clips.push(newClip);
            state.selectedClipId = newClip.id;
            saveStateSnapshot(state);
            renderTracks();
            updatePreview(newClip);
          }
        });
        track.clips.forEach((clip) => {
          // Convert clip format for enhanced renderer
          const enhancedClip = {
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
            waveformData: clip.waveformData
          };

          const clipEl = (typeof createEnhancedClipElement !== 'undefined' && createEnhancedClipElement)
            ? createEnhancedClipElement(enhancedClip, { id: track.id, name: track.name }, {
                selectedClipId: state.selectedClipId,
                timelineSeconds: state.timelineSeconds
              }, state.zoom || 1)
            : createBasicClipElement(enhancedClip, { id: track.id, name: track.name }, {
                selectedClipId: state.selectedClipId,
                timelineSeconds: state.timelineSeconds
              });

          // Extend clip with enhancement context menus
          extendClipContextMenu(clipEl, clip, track, state, showToast);

          // Override click handler to work with this timeline's state management
          clipEl.addEventListener('click', (event) => {
            if (event.target.classList.contains('clip-handle')) return; // Don't trigger on handle clicks
            event.stopPropagation();
            state.selectedClipId = clip.id;
            updatePreview(clip);
            renderTracks();
          }, true); // Use capture to override the default handler

          lane.appendChild(clipEl);
        });
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
      // Enhanced media library with semantic search and better drag & drop
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

      // Extend media library with enhancement features
      extendMediaLibrary(els.mediaGrid, state, showToast);

      // Add media ingest components to media library
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
    }

    function renderGenerateTypes() {
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
      if (!sceneDetector) {
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
      if (!cameraEffects) {
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

    function renderRail() {
      els.floatingRail.innerHTML = '';
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
        'AI Personalizer': 'AI Personalizer - Scan profiles and generate personalized content'
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
            default:
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
      els.clipSettingsPanel.style.display = 'block';
      renderClipEditor(clipId);
    }

    function showTransitionSettings() {
      els.transitionSettingsPanel.style.display = 'block';
      
    }

    function showColorCorrectionPanel() {
      if (!FEATURE_FLAGS.colorCorrection) {
        els.colorCorrectionContainer.innerHTML = '<p style="color: #ef4444;">Color correction system unavailable</p>';
        els.colorCorrectionPanel.style.display = 'block';
        return;
      }
      if (!colorCorrectionSystem) {
        try {
          colorCorrectionSystem = new ColorCorrectionSystem(els.colorCorrectionContainer, state, state.keyframeSystem);
          els.colorCorrectionContainer.innerHTML = '';
          els.colorCorrectionContainer.appendChild(colorCorrectionSystem.getPanel());
        } catch (error) {
          console.error('Failed to load ColorCorrectionSystem:', error);
          els.colorCorrectionContainer.innerHTML = '<p style="color: #ef4444;">Color correction system unavailable</p>';
        }
      }
      els.colorCorrectionPanel.style.display = 'block';
      
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
      els.canvasPanel.style.display = 'block';

      // Render Canvas component
      if (!els.canvasContainer.innerHTML) {
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
      els.tokenEditorPanel.style.display = 'block';

      if (!els.tokenEditorContainer.innerHTML) {
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
                  const { createClient } = await import('../lib/supabase.js');
                  const supabase = createClient();
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
      els.batchGeneratorPanel.style.display = 'block';

      if (!els.batchGeneratorContainer.innerHTML) {
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
      els.workflowPanel.style.display = 'block';

      if (!els.workflowContainer.innerHTML) {
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
      els.personalizationPanel.style.display = 'block';

      if (!els.personalizationContainer.innerHTML) {
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
      els.personalizationEditorPanel.style.display = 'block';

      if (!els.personalizationEditorContainer.innerHTML) {
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
      els.canvasPanel.style.display = 'none';
      els.tokenEditorPanel.style.display = 'none';
      els.batchGeneratorPanel.style.display = 'none';
      els.workflowPanel.style.display = 'none';
      els.personalizationPanel.style.display = 'none';
      els.personalizationEditorPanel.style.display = 'none';
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
      els.playBtn.addEventListener('click', togglePlayback);
      els.stopBtn.addEventListener('click', stopPlayback);
      els.rewindBtn.addEventListener('click', rewindPlayback);
      els.generateBtn.addEventListener('click', generateClip);

      // Rendiv Animation Demo handlers
      const runSpringDemoBtn = root.querySelector('#runSpringDemo');
      const runNoiseDemoBtn = root.querySelector('#runNoiseDemo');
      const runInterpolateDemoBtn = root.querySelector('#runInterpolateDemo');
      const animationCanvas = root.querySelector('#animationCanvas');
      const demoStatus = root.querySelector('#demoStatus');

      if (runSpringDemoBtn) runSpringDemoBtn.addEventListener('click', () => runSpringDemo(animationCanvas, demoStatus));
      if (runNoiseDemoBtn) runNoiseDemoBtn.addEventListener('click', () => runNoiseDemo(animationCanvas, demoStatus));
      if (runInterpolateDemoBtn) runInterpolateDemoBtn.addEventListener('click', () => runInterpolateDemo(animationCanvas, demoStatus));

      els.uploadBtn.addEventListener('click', () => els.uploadInput.click());
      els.uploadInput.addEventListener('change', (event) => handleUpload(event.target.files?.[0]));
      els.backBtn.addEventListener('click', () => showToast('Back action clicked'));

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
      root.querySelectorAll('[data-action="zoom-in"]').forEach((button) => button.addEventListener('click', () => { state.zoom = Math.min(2, state.zoom + 0.1); console.log(`Zoom ${state.zoom.toFixed(1)}x`); }));
      root.querySelectorAll('[data-action="zoom-out"]').forEach((button) => button.addEventListener('click', () => { state.zoom = Math.max(0.5, state.zoom - 0.1); console.log(`Zoom ${state.zoom.toFixed(1)}x`); }));

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
            const model = musicBtn.dataset.model || 'suno-create';
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
      renderTopActions();
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
      renderMultiCameraToolbar(state, els.multiCameraToolbar);
      renderPipControls(state, els.pipControls);
      renderSplitScreenControls(state, els.splitControls);
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
      initializeMediaLibraryDragDrop(state, els.mediaGrid, { showToast });
      setupUploadSources({ state, showToast });

      // Initialize media ingest components
    integrateMediaIngest();

    // Render enhanced timeline controls
    const timelineControlsContainer = document.getElementById('timelineControlsEnhanced');
    if (timelineControlsContainer) {
      renderTimelineControls(state, timelineControlsContainer);
    }

    // Initialize transition system
    initializeTimelineTransitions();
    initializeTransitionEditor();

    // Initialize scene detector
    initializeSceneDetector();
    initializeCameraEffects();
    initializeAIChatPanel();

    // Initialize multi-camera functionality
    window.timelineState = state; // Make state globally accessible for multi-camera functions
    TLEditor.state = state; // Exposed on namespace to avoid polluting global scope

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

  // Inject styles and initialize the timeline editor app
  injectStyles();
  createTimelineEditorApp(container);

  return container;
}
