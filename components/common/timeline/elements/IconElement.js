import { Component } from '../../../../base/Component.js';
import { getStore } from '../../../../stores/base/Store.js';
import classnames from 'classnames';
import { ASSET_TYPES } from '../../../../lib/constants/media';
import {
  POPCORN_ELEMENT_LABELS,
  POPCORN_ELEMENT_TYPES,
  SEQUENCER,
} from '../../../../lib/constants/popcorn';
import { DEFAULT_SETTINGS } from '../../../../lib/constants/settings';
import {
  TIMELINE_ELEMENT_DEFAULT_FIELD as DEFAULT_FIELD,
  TIMELINE_ELEMENT_DEFAULT_ICONS,
  TIMELINE_ELEMENT_ICONS,
} from '../../../../lib/constants/timeline';

import svgAudioIcon from '../../../../public/static/images/media/icon-audio.svg';
import personalizedVoiceIcon from '../../../../public/static/images/media/personalized-voice.svg';
import voiceIcon from '../../../../public/static/images/media/voice.svg';

// Editing capabilities - imported for integration
import LineDuration from '../../../../media/LineDuration';
import ClipEditor from '../../../../settings/video-settings/tabs/ClipEditor';
import VideoTransitionSettings from '../../../../settings/video-transition-settings/VideoTransitionSettings';
import OverlayListTransitions from '../../../../media/OverlayListTransitions';

// Import AI generation service
import {
  generationService,
  createTextToVideoRequest,
  createImageToVideoRequest,
  createRetakeRequest,
  createExtendRequest,
  createBrollRequest,
} from '../../../../lib/editor/generationService.js';

/**
 * Enhanced IconElement with deep timeline store integration
 * Full state synchronization for trimming, properties, transitions, overlays, and AI generation
 */
export class IconElement extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.timelineStore = getStore('timelineStore');

    const elementId = props.item?.id || props.item?.i;

    // Core state
    this.state = {
      item: props.item,
      className: props.className,
      editingMode: false,
      elementId,
      
      // Clip trimming state (synced with timeline store)
      trimStart: props.item?.popcornOptions?.from || 0,
      trimEnd: props.item?.popcornOptions?.to || (props.item?.popcornOptions?.duration || 0),
      duration: props.item?.popcornOptions?.duration || 0,
      
      // Clip properties state (synced with timeline store)
      clipProperties: {
        volume: props.item?.popcornOptions?.volume || 1.0,
        muted: props.item?.popcornOptions?.muted || false,
        hidden: props.item?.popcornOptions?.hidden || false,
        fill: props.item?.popcornOptions?.fill || false,
        startTime: props.item?.popcornOptions?.start || 0,
        endTime: props.item?.popcornOptions?.end || 0,
        audioFadeIn: props.item?.popcornOptions?.audioFadeIn || 0,
        audioFadeOut: props.item?.popcornOptions?.audioFadeOut || 0,
      },
      
      // Transition state (synced with timeline store)
      transitionIn: props.item?.transitions?.in || null,
      transitionOut: props.item?.transitions?.out || null,
      selectedTransition: null,
      
      // Overlay state (synced with timeline store)
      overlayTransitions: props.item?.overlays || [],
      selectedOverlay: null,
      
      // AI generation state (synced with timeline store)
      generationState: {
        isGenerating: false,
        generationError: null,
        generationId: null,
        generated: props.item?.generated || false,
      },
      
      // Icon customization state
      iconCustomization: {
        iconColor: props.item?.iconColor || null,
        iconSize: props.item?.iconSize || 'medium',
        iconAnimation: props.item?.iconAnimation || null,
      },
    };

    // Bind all methods
    this.bindMethods();
  }

  bindMethods() {
    // Editing mode methods
    this.toggleEditing = this.toggleEditing.bind(this);
    this.setEditingMode = this.setEditingMode.bind(this);
    
    // Trim handling methods
    this.handleTrimChange = this.handleTrimChange.bind(this);
    this.handleTrimStart = this.handleTrimStart.bind(this);
    this.handleTrimEnd = this.handleTrimEnd.bind(this);
    
    // Property management methods
    this.handlePropertyChange = this.handlePropertyChange.bind(this);
    this.updateClipProperty = this.updateClipProperty.bind(this);
    
    // Transition methods
    this.createTransition = this.createTransition.bind(this);
    this.handleTransitionUpdate = this.handleTransitionUpdate.bind(this);
    
    // Overlay methods
    this.selectOverlayTransition = this.selectOverlayTransition.bind(this);
    this.applyOverlayTransition = this.applyOverlayTransition.bind(this);
    
    // AI generation methods
    this.generateContent = this.generateContent.bind(this);
    this.regenerateContent = this.regenerateContent.bind(this);
    this.generateIconVariant = this.generateIconVariant.bind(this);
    this.runAIWorkflow = this.runAIWorkflow.bind(this);
    this.getAIContentSuggestions = this.getAIContentSuggestions.bind(this);
    this.applyAISuggestion = this.applyAISuggestion.bind(this);
    
    // UI methods
    this.getTrimmingUI = this.getTrimmingUI.bind(this);
    this.renderTrimmingControls = this.renderTrimmingControls.bind(this);
    this.getPropertyManagerUI = this.getPropertyManagerUI.bind(this);
    this.renderPropertyControls = this.renderPropertyControls.bind(this);
    this.getTransitionUI = this.getTransitionUI.bind(this);
    this.renderTransitionControls = this.renderTransitionControls.bind(this);
    this.getOverlayUI = this.getOverlayUI.bind(this);
    this.renderOverlayControls = this.renderOverlayControls.bind(this);
    this.getEditingControls = this.getEditingControls.bind(this);
    this.renderEditingUI = this.renderEditingUI.bind(this);
    this.renderIconCustomization = this.renderIconCustomization.bind(this);
    this.animateIcon = this.animateIcon.bind(this);
    
    // Event handlers
    this.handleClick = this.handleClick.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
    
    // Store integration methods
    this.syncWithTimelineStore = this.syncWithTimelineStore.bind(this);
    this.handleStoreUpdate = this.handleStoreUpdate.bind(this);
    this.pushUndoState = this.pushUndoState.bind(this);
  }

  // ============================================================================
  // LIFECYCLE METHODS WITH STORE INTEGRATION
  // ============================================================================

  componentDidMount() {
    // Sync with timeline store on mount
    this.syncWithTimelineStore();
    
    // Subscribe to timeline store updates
    if (this.timelineStore?.subscribe) {
      this.unsubscribeFromStore = this.timelineStore.subscribe((state) => {
        this.handleStoreUpdate(state);
      });
    }
    
    // Initialize any resources when mounted
    this.setupEventListeners();
    
    // Apply any pending animations
    if (this.state.iconCustomization.iconAnimation) {
      this.animateIcon(this.state.iconCustomization.iconAnimation);
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeFromStore) {
      this.unsubscribeFromStore();
    }
    this.cleanupEventListeners();
  }

  componentDidUpdate() {
    // Handle updates
    if (this.state.editingMode) {
      // Re-render editing UI if in editing mode
      const editorContainer = this.element?.querySelector('.icon-element-editor');
      if (editorContainer) {
        editorContainer.outerHTML = this.renderEditingUI();
      }
    }
  }

  // ============================================================================
  // STORE INTEGRATION METHODS
  // ============================================================================

  /**
   * Sync element state with timeline store
   */
  syncWithTimelineStore() {
    const { item, elementId } = this.state;
    if (elementId && this.timelineStore?.syncElementState) {
      this.timelineStore.syncElementState({
        id: elementId,
        ...item,
      });
    }
  }

  /**
   * Handle updates from timeline store
   */
  handleStoreUpdate(storeState) {
    const { elementId } = this.state;
    if (!elementId || !this.timelineStore?.getElementState) return;
    
    const elementState = this.timelineStore.getElementState(elementId);
    if (elementState) {
      this.handleElementStateUpdate(elementState);
    }
  }

  /**
   * Handle element state updates from store
   */
  handleElementStateUpdate(elementState) {
    const updates = {};
    
    if (elementState.trim) {
      updates.trimStart = elementState.trim.trimStart;
      updates.trimEnd = elementState.trim.trimEnd;
      updates.duration = elementState.trim.duration;
    }
    
    if (elementState.properties) {
      updates.clipProperties = elementState.properties;
    }
    
    if (elementState.transitions) {
      updates.transitionIn = elementState.transitions.transitionIn;
      updates.transitionOut = elementState.transitions.transitionOut;
    }
    
    if (elementState.overlays) {
      updates.overlayTransitions = elementState.overlays.overlays || [];
    }
    
    if (elementState.ai) {
      updates.generationState = elementState.ai;
    }
    
    this.setState(updates);
  }

  /**
   * Push undo state to timeline store
   */
  pushUndoState(state) {
    if (this.timelineStore?.pushUndoState) {
      this.timelineStore.pushUndoState(state);
    }
  }

  // ============================================================================
  // EDITING MODE METHODS
  // ============================================================================

  toggleEditing() {
    const { editingMode, elementId } = this.state;
    const newMode = !editingMode;
    
    this.setState({ editingMode: newMode });
    
    if (this.timelineStore?.setElementEditingState) {
      this.timelineStore.setElementEditingState(elementId, { 
        isEditing: newMode, 
        mode: newMode ? 'full' : null 
      });
    }
  }

  setEditingMode(mode) {
    const { elementId } = this.state;
    this.setState({ editingMode: mode });
    
    if (this.timelineStore?.setElementEditingState) {
      this.timelineStore.setElementEditingState(elementId, { 
        isEditing: mode, 
        mode: mode ? 'full' : null 
      });
    }
  }

  // ============================================================================
  // VISUAL CLIP TRIMMING METHODS (with store integration)
  // ============================================================================

  handleTrimChange(changes) {
    const { item, elementId, trimStart, trimEnd, duration } = this.state;
    
    // Push undo state before change
    this.pushUndoState({
      elementTrim: { [elementId]: { trimStart, trimEnd, duration } },
    });
    
    const newTrimStart = changes.from !== undefined ? changes.from : trimStart;
    const newTrimEnd = changes.end !== undefined ? changes.end : trimEnd;
    
    this.setState({
      trimStart: newTrimStart,
      trimEnd: newTrimEnd,
    });

    // Update timeline store
    if (this.timelineStore?.setElementTrimState) {
      this.timelineStore.setElementTrimState(elementId, {
        trimStart: newTrimStart,
        trimEnd: newTrimEnd,
        duration,
      });
    }

    // Update project store
    this.projectStore.findAndUpdate(item.id, {
      popcornOptions: {
        ...item.popcornOptions,
        from: changes.from,
        to: changes.end,
      },
    });
  }

  handleTrimStart(from) {
    this.handleTrimChange({ from });
  }

  handleTrimEnd(end) {
    this.handleTrimChange({ end });
  }

  getTrimmingUI() {
    const { duration, trimStart, trimEnd } = this.state;
    
    return {
      duration,
      from: trimStart,
      to: trimEnd,
      changeFrom: (field) => this.handleTrimStart(field.from),
      changeOut: (field) => this.handleTrimEnd(field.out),
      updateFrom: (field) => this.handleTrimChange(field),
    };
  }

  renderTrimmingControls() {
    const ui = this.getTrimmingUI();
    
    return `
      <div class="trimming-controls">
        <h4>Trim Clip</h4>
        <div class="trim-slider-container">
          <div class="trim-slider" data-duration="${ui.duration}" data-from="${ui.from}" data-to="${ui.to}">
            <div class="trim-range" style="left: ${(ui.from / ui.duration) * 100}%; right: ${100 - (ui.to / ui.duration) * 100}%;"></div>
            <div class="trim-handle trim-start" style="left: ${(ui.from / ui.duration) * 100}%"></div>
            <div class="trim-handle trim-end" style="left: ${(ui.to / ui.duration) * 100}%"></div>
          </div>
          <div class="trim-times">
            <span class="trim-from">${this.formatTime(ui.from)}</span>
            <span class="trim-duration">${this.formatTime(ui.duration)}</span>
            <span class="trim-to">${this.formatTime(ui.to)}</span>
          </div>
        </div>
      </div>
    `;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  // ============================================================================
  // CLIP PROPERTY MANAGEMENT METHODS (with store integration)
  // ============================================================================

  handlePropertyChange(changes) {
    const { item, elementId, clipProperties } = this.state;
    
    // Push undo state before change
    this.pushUndoState({
      elementProperties: { [elementId]: { ...clipProperties } },
    });
    
    const updatedProperties = { ...clipProperties, ...changes };
    
    this.setState({
      clipProperties: updatedProperties,
    });

    // Update timeline store
    if (this.timelineStore?.setElementPropertyState) {
      this.timelineStore.setElementPropertyState(elementId, updatedProperties);
    }

    // Update project store
    this.projectStore.findAndUpdate(item.id, {
      popcornOptions: {
        ...item.popcornOptions,
        ...changes,
      },
    });
  }

  updateClipProperty(key, value) {
    this.handlePropertyChange({ [key]: value });
  }

  getPropertyManagerUI() {
    const { clipProperties } = this.state;
    
    return {
      values: clipProperties,
      onChange: this.handlePropertyChange,
    };
  }

  renderPropertyControls() {
    const { clipProperties } = this.state;
    
    return `
      <div class="property-controls">
        <h4>Clip Properties</h4>
        <div class="property-grid">
          <div class="property-field">
            <label>Volume</label>
            <input type="range" min="0" max="2" step="0.1" value="${clipProperties.volume}" 
                   onchange="this.updateClipProperty('volume', this.value)" />
            <span>${Math.round(clipProperties.volume * 100)}%</span>
          </div>
          <div class="property-field">
            <label>Mute</label>
            <input type="checkbox" ${clipProperties.muted ? 'checked' : ''} 
                   onchange="this.updateClipProperty('muted', this.checked)" />
          </div>
          <div class="property-field">
            <label>Hidden</label>
            <input type="checkbox" ${clipProperties.hidden ? 'checked' : ''} 
                   onchange="this.updateClipProperty('hidden', this.checked)" />
          </div>
          <div class="property-field">
            <label>Fill Screen</label>
            <input type="checkbox" ${clipProperties.fill ? 'checked' : ''} 
                   onchange="this.updateClipProperty('fill', this.checked)" />
          </div>
          <div class="property-field">
            <label>Audio Fade In</label>
            <input type="number" value="${clipProperties.audioFadeIn}" 
                   onchange="this.updateClipProperty('audioFadeIn', parseFloat(this.value))" />
          </div>
          <div class="property-field">
            <label>Audio Fade Out</label>
            <input type="number" value="${clipProperties.audioFadeOut}" 
                   onchange="this.updateClipProperty('audioFadeOut', parseFloat(this.value))" />
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // TRANSITION CREATION METHODS (with store integration)
  // ============================================================================

  createTransition(type, options = {}) {
    const { item, elementId, transitionIn, transitionOut } = this.state;
    
    // Push undo state before change
    this.pushUndoState({
      elementTransitions: { 
        [elementId]: { 
          transitionIn: transitionIn ? { ...transitionIn } : null, 
          transitionOut: transitionOut ? { ...transitionOut } : null 
        } 
      },
    });
    
    const transition = {
      type: options.type || 'fade',
      duration: options.duration || 0.5,
      easing: options.easing || 'ease-in-out',
      ...options,
    };

    const key = type === 'in' ? 'transitionIn' : 'transitionOut';
    this.setState({
      [key]: transition,
      selectedTransition: transition,
    });

    // Update timeline store
    if (this.timelineStore?.addElementTransition) {
      this.timelineStore.addElementTransition(elementId, type, transition);
    }

    // Update project store
    this.projectStore.findAndUpdate(item.id, {
      transitions: {
        ...item.transitions,
        [type === 'in' ? 'in' : 'out']: transition,
      },
    });
  }

  handleTransitionUpdate(options) {
    const { item, elementId, selectedTransition, transitionIn, transitionOut } = this.state;
    
    if (!selectedTransition) return;

    // Push undo state before change
    this.pushUndoState({
      elementTransitions: { 
        [elementId]: { 
          transitionIn: transitionIn ? { ...transitionIn } : null, 
          transitionOut: transitionOut ? { ...transitionOut } : null 
        } 
      },
    });

    const updatedTransition = { ...selectedTransition, ...options };
    const type = selectedTransition.type === 'in' ? 'transitionIn' : 'transitionOut';
    
    this.setState({
      [type]: updatedTransition,
      selectedTransition: updatedTransition,
    });

    // Update timeline store
    if (this.timelineStore?.updateElementTransition) {
      const transType = selectedTransition.type === 'in' ? 'in' : 'out';
      this.timelineStore.updateElementTransition(elementId, transType, options);
    }

    this.projectStore.findAndUpdate(item.id, {
      transitions: {
        ...item.transitions,
        [updatedTransition.type === 'in' ? 'in' : 'out']: updatedTransition,
      },
    });
  }

  getTransitionUI() {
    const { selectedTransition, transitionIn, transitionOut } = this.state;
    
    return {
      element: selectedTransition,
      transitionIn,
      transitionOut,
      update: this.handleTransitionUpdate,
      find: (id) => this.projectStore.elements.find(el => el.id === id),
    };
  }

  renderTransitionControls() {
    const { transitionIn, transitionOut } = this.state;
    const transitions = [
      { id: 'fade', name: 'Fade', icon: '✨' },
      { id: 'slide', name: 'Slide', icon: '➡️' },
      { id: 'zoom', name: 'Zoom', icon: '🔍' },
      { id: 'wipe', name: 'Wipe', icon: '🧹' },
      { id: 'dissolve', name: 'Dissolve', icon: '🌫️' },
    ];
    
    return `
      <div class="transition-controls">
        <h4>Create Transition</h4>
        <div class="transition-section">
          <h5>In Transition ${transitionIn ? '✓' : ''}</h5>
          <div class="transition-grid">
            ${transitions.map(t => `
              <button class="transition-btn ${transitionIn?.type === t.id ? 'active' : ''}" 
                      onclick="this.createTransition('in', { type: '${t.id}' })">
                <span class="transition-icon">${t.icon}</span>
                <span class="transition-name">${t.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="transition-section">
          <h5>Out Transition ${transitionOut ? '✓' : ''}</h5>
          <div class="transition-grid">
            ${transitions.map(t => `
              <button class="transition-btn ${transitionOut?.type === t.id ? 'active' : ''}" 
                      onclick="this.createTransition('out', { type: '${t.id}' })">
                <span class="transition-icon">${t.icon}</span>
                <span class="transition-name">${t.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // OVERLAY TRANSITIONS METHODS (with store integration)
  // ============================================================================

  selectOverlayTransition(overlay) {
    this.setState({ selectedOverlay: overlay });
  }

  applyOverlayTransition(overlay) {
    const { item, elementId, overlayTransitions } = this.state;
    
    // Push undo state before change
    this.pushUndoState({
      elementOverlays: { [elementId]: { overlays: [...overlayTransitions] } },
    });
    
    const updatedOverlays = [...overlayTransitions, overlay];
    
    this.setState({
      overlayTransitions: updatedOverlays,
      selectedOverlay: overlay,
    });

    // Update timeline store
    if (this.timelineStore?.addElementOverlay) {
      this.timelineStore.addElementOverlay(elementId, overlay);
    }

    // Update project store
    this.projectStore.findAndUpdate(item.id, {
      overlays: updatedOverlays,
    });
  }

  getOverlayUI() {
    const { overlayTransitions, selectedOverlay } = this.state;
    
    return {
      overlays: overlayTransitions,
      selected: selectedOverlay,
      select: this.selectOverlayTransition,
      apply: this.applyOverlayTransition,
    };
  }

  renderOverlayControls() {
    const { overlayTransitions, selectedOverlay } = this.state;
    const presetOverlays = [
      { id: 'vignette', name: 'Vignette', category: 'effects' },
      { id: 'grain', name: 'Film Grain', category: 'effects' },
      { id: 'light-leak', name: 'Light Leak', category: 'effects' },
      { id: 'lens-flare', name: 'Lens Flare', category: 'effects' },
      { id: 'vhs', name: 'VHS Effect', category: 'retro' },
      { id: 'glitch', name: 'Glitch', category: 'retro' },
      { id: 'noise', name: 'Static Noise', category: 'retro' },
    ];
    
    return `
      <div class="overlay-controls">
        <h4>Overlay Transitions</h4>
        <div class="overlay-presets">
          ${presetOverlays.map(o => `
            <button class="overlay-btn ${selectedOverlay?.id === o.id ? 'active' : ''}"
                    onclick="this.applyOverlayTransition({ id: '${o.id}', name: '${o.name}', category: '${o.category}' })">
              ${o.name}
            </button>
          `).join('')}
        </div>
        ${overlayTransitions.length > 0 ? `
          <div class="active-overlays">
            <h5>Active Overlays</h5>
            ${overlayTransitions.map((o, i) => `
              <div class="active-overlay-item">
                <span>${o.name}</span>
                <button onclick="this.removeOverlay(${i})">×</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  removeOverlay(index) {
    const { item, elementId, overlayTransitions } = this.state;
    
    // Push undo state before change
    this.pushUndoState({
      elementOverlays: { [elementId]: { overlays: [...overlayTransitions] } },
    });
    
    const updatedOverlays = overlayTransitions.filter((_, i) => i !== index);
    
    this.setState({ overlayTransitions: updatedOverlays });
    
    // Update timeline store
    if (this.timelineStore?.removeElementOverlay) {
      this.timelineStore.removeElementOverlay(elementId, index);
    }
    
    this.projectStore.findAndUpdate(item.id, {
      overlays: updatedOverlays,
    });
  }

  // ============================================================================
  // AI CONTENT GENERATION METHODS (with store integration)
  // ============================================================================

  async generateContent(options = {}) {
    const { item, elementId, generationState } = this.state;
    
    this.setState({
      generationState: {
        ...generationState,
        isGenerating: true,
        generationError: null,
      },
    });

    // Update timeline store
    if (this.timelineStore?.setElementGenerating) {
      this.timelineStore.setElementGenerating(elementId, true);
    }

    try {
      const prompt = options.prompt || `Generate icon content for ${item.type}`;
      const request = createTextToVideoRequest(prompt, {
        duration: options.duration || 3,
        aspectRatio: options.aspectRatio || '1:1',
        ...options,
      });

      const result = await generationService.submit(request, options.provider || 'ltx');

      if (result.status === 'completed') {
        await this.handleGenerationComplete(result);
      } else {
        this.setState({
          generationState: {
            ...generationState,
            isGenerating: false,
            generationId: result.generationId,
          },
        });
        
        // Update timeline store
        if (this.timelineStore?.setElementGenerating) {
          this.timelineStore.setElementGenerating(elementId, true, result.generationId);
        }
        
        // Start polling
        generationService.startPolling(result.generationId, this.handleGenerationProgress.bind(this));
      }

      return result;
    } catch (error) {
      this.setState({
        generationState: {
          ...generationState,
          isGenerating: false,
          generationError: error.message,
        },
      });
      
      // Update timeline store
      if (this.timelineStore?.setElementGenerationError) {
        this.timelineStore.setElementGenerationError(elementId, error.message);
      }
      
      throw error;
    }
  }

  async regenerateContent(options = {}) {
    return this.generateContent({
      ...options,
      prompt: options.prompt || `Regenerate: ${this.state.item.type}`,
    });
  }

  async generateIconVariant(variantType, options = {}) {
    const prompt = `Generate ${variantType} icon variant for ${this.state.item.type}`;
    return this.generateContent({ ...options, prompt });
  }

  handleGenerationProgress(result) {
    const { elementId, generationState } = this.state;
    
    if (result.status === 'completed') {
      this.handleGenerationComplete(result);
    } else if (result.status === 'failed') {
      this.setState({
        generationState: {
          ...generationState,
          isGenerating: false,
          generationError: result.error || 'Generation failed',
        },
      });
      
      // Update timeline store
      if (this.timelineStore?.setElementGenerationError) {
        this.timelineStore.setElementGenerationError(elementId, result.error || 'Generation failed');
      }
    }
  }

  async handleGenerationComplete(result) {
    const { item, elementId, generationState } = this.state;

    const updatedItem = {
      ...item,
      assetId: result.assetIds?.[0],
      previewUrl: result.previewUrl,
      generated: true,
    };

    this.setState({
      item: updatedItem,
      generationState: {
        ...generationState,
        isGenerating: false,
        generationId: result.generationId,
        generated: true,
        generationError: null,
      },
    });

    // Update timeline store
    if (this.timelineStore?.setElementGenerationComplete) {
      this.timelineStore.setElementGenerationComplete(elementId, result.assetIds?.[0]);
    }

    // Update project store
    this.projectStore.updateElement(item.i, updatedItem);
  }

  async runAIWorkflow(workflowType, params = {}) {
    const { item, elementId } = this.state;

    switch (workflowType) {
      case 'text-to-video':
        return await this.generateContent(params);

      case 'image-to-video': {
        const imageRequest = createImageToVideoRequest(params.imageUrl, params.prompt, params);
        return await generationService.submit(imageRequest, params.provider || 'ltx');
      }

      case 'retake': {
        const retakeRequest = createRetakeRequest(
          item.assetId,
          params.prompt || 'Retake this icon',
          params.range || { start: 0, end: 3 },
          params
        );
        return await generationService.submit(retakeRequest, params.provider || 'ltx');
      }

      case 'extend': {
        const extendRequest = createExtendRequest(
          item.assetId,
          params.prompt || 'Extend this icon',
          params.duration || 2,
          params
        );
        return await generationService.submit(extendRequest, params.provider || 'ltx');
      }

      case 'broll': {
        const brollRequest = createBrollRequest(
          params.prompt || 'Generate B-roll for icon',
          { duration: params.duration || 3, ...params }
        );
        return await generationService.submit(brollRequest, params.provider || 'ltx');
      }

      default:
        throw new Error(`Unknown workflow type: ${workflowType}`);
    }
  }

  getAIContentSuggestions() {
    const { item } = this.state;
    const suggestions = [];

    switch (item.type) {
      case POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION:
        suggestions.push(
          'Add smooth fade transition',
          'Use zoom transition for impact',
          'Try slide transition for flow',
          'Add glitch effect for style',
          'Use morphing transition'
        );
        break;
      case POPCORN_ELEMENT_TYPES.SOCIAL:
        suggestions.push(
          'Optimize icon for social media',
          'Add brand colors',
          'Use trending visual style',
          'Add animated badge',
          'Include call-to-action'
        );
        break;
      case POPCORN_ELEMENT_TYPES.JSON_TRANSITION:
        suggestions.push(
          'Apply custom JSON animation',
          'Use Lottie animation',
          'Add micro-interaction',
          'Optimize for performance',
          'Add hover effects'
        );
        break;
      default:
        suggestions.push(
          'Enhance icon visibility',
          'Add subtle animation',
          'Use consistent styling',
          'Optimize for timeline',
          'Add hover feedback'
        );
    }

    return suggestions;
  }

  applyAISuggestion(suggestionType) {
    const { iconCustomization } = this.state;

    switch (suggestionType) {
      case 'enhance':
        this.setState({
          iconCustomization: {
            ...iconCustomization,
            iconAnimation: 'pulse',
          },
        });
        break;
      case 'scale':
        this.setState({
          iconCustomization: {
            ...iconCustomization,
            iconSize: 'large',
          },
        });
        break;
      default:
        break;
    }
  }

  // ============================================================================
  // ICON CUSTOMIZATION METHODS
  // ============================================================================

  animateIcon(animationType) {
    const { iconCustomization } = this.state;
    
    this.setState({
      iconCustomization: {
        ...iconCustomization,
        iconAnimation: animationType,
      },
    });

    // Apply animation to DOM element
    if (this.element) {
      const iconWrapper = this.element.querySelector('.popcorn-timeline-icon');
      if (iconWrapper) {
        iconWrapper.classList.add(`animation-${animationType}`);
      }
    }
  }

  renderIconCustomization() {
    const { iconCustomization } = this.state;
    const sizes = ['small', 'medium', 'large'];
    const animations = ['none', 'pulse', 'bounce', 'fade', 'spin'];
    
    return `
      <div class="icon-customization">
        <h4>Icon Customization</h4>
        <div class="customization-section">
          <label>Size</label>
          <div class="size-options">
            ${sizes.map(s => `
              <button class="size-btn ${iconCustomization.iconSize === s ? 'active' : ''}"
                      onclick="this.setState({ iconCustomization: { ...this.state.iconCustomization, iconSize: '${s}' } })">
                ${s}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="customization-section">
          <label>Animation</label>
          <div class="animation-options">
            ${animations.map(a => `
              <button class="anim-btn ${iconCustomization.iconAnimation === a ? 'active' : ''}"
                      onclick="this.animateIcon('${a}')">
                ${a}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // EDITING UI METHODS
  // ============================================================================

  getEditingControls() {
    return {
      trimming: this.getTrimmingUI(),
      properties: this.getPropertyManagerUI(),
      transitions: this.getTransitionUI(),
      overlays: this.getOverlayUI(),
      ai: {
        generate: this.generateContent,
        regenerate: this.regenerateContent,
        suggestions: this.getAIContentSuggestions(),
      },
    };
  }

  renderEditingUI() {
    const { editingMode, generationState } = this.state;
    
    if (!editingMode) return '';

    return `
      <div class="icon-element-editor">
        <div class="editor-header">
          <h3>Edit Icon Element</h3>
          <button class="close-editor" onclick="this.toggleEditing()">×</button>
        </div>
        
        <div class="editor-content">
          ${this.renderTrimmingControls()}
          ${this.renderPropertyControls()}
          ${this.renderTransitionControls()}
          ${this.renderOverlayControls()}
          ${this.renderIconCustomization()}
          
          <div class="ai-generation-section">
            <h4>AI Generation</h4>
            ${generationState.isGenerating ? `
              <div class="generating-indicator">Generating...</div>
            ` : `
              <button class="ai-generate-btn" onclick="this.generateContent()">
                🤖 Generate with AI
              </button>
              ${generationState.generated ? `
                <button class="ai-regenerate-btn" onclick="this.regenerateContent()">
                  🔄 Regenerate
                </button>
              ` : ''}
            `}
            ${generationState.generationError ? `
              <div class="generation-error">${generationState.generationError}</div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // EVENT HANDLING METHODS
  // ============================================================================

  setupEventListeners() {
    if (this.element) {
      this.addEventListener(this.element, 'click', this.handleClick);
      this.addEventListener(this.element, 'dblclick', this.handleDoubleClick);
    }
  }

  handleClick(e) {
    // Handle click events for editing toggle
    if (e.target.closest('.popcorn-element')) {
      // Single click could trigger selection
      this.emit('element-clicked', { item: this.state.item });
    }
  }

  handleDoubleClick(e) {
    // Double click toggles editing mode
    if (e.target.closest('.popcorn-element')) {
      this.toggleEditing();
    }
  }

  cleanupEventListeners() {
    // Cleanup when unmounted
  }

  // ============================================================================
  // MAIN RENDER METHOD
  // ============================================================================

  render() {
    const { item, className, editingMode, generationState, iconCustomization } = this.state;
    const { isAudio } = this.projectStore;

    let kind = null;
    if (!item.kind && item.type === SEQUENCER) {
      kind = isAudio({ popcornOptions: item }) ? ASSET_TYPES.AUDIO : ASSET_TYPES.VIDEO;
    }

    let icon = null;
    if (item.kind === ASSET_TYPES.PERSONALIZED_VOICE) {
      icon = personalizedVoiceIcon;
    } else if (item.kind === ASSET_TYPES.AUDIO || kind === ASSET_TYPES.AUDIO) {
      icon = svgAudioIcon;
    } else if (item.kind === ASSET_TYPES.VOICE) {
      icon = voiceIcon;
    } else {
      icon = TIMELINE_ELEMENT_ICONS[item.type];
    }

    const quantityIcon = TIMELINE_ELEMENT_DEFAULT_ICONS[item.type];

    let itemTitle = '';
    if (!(item.kind === ASSET_TYPES.VOICE
      || item.kind === ASSET_TYPES.VIDEO
      || kind === ASSET_TYPES.VIDEO
      || kind === ASSET_TYPES.AUDIO
      || item.kind === ASSET_TYPES.AUDIO)) {
      if (item.type === POPCORN_ELEMENT_TYPES.SOCIAL) {
        itemTitle = item.title;
      } else {
        itemTitle = POPCORN_ELEMENT_LABELS[item.type];
      }
    } else {
      itemTitle = item.kind || kind;
    }

    let innerHTML = '';

    // Icon with animation and customization classes
    const iconClasses = classnames('inner-wrapper', 'popcorn-timeline-icon', {
      [`size-${iconCustomization.iconSize}`]: iconCustomization.iconSize,
      [`animation-${iconCustomization.iconAnimation}`]: iconCustomization.iconAnimation,
    });

    if (icon) {
      innerHTML += `<div class="${iconClasses}"><div class="icon-btn--inline">${icon}</div></div>`;
    }

    // AI indicator
    if (generationState.generated) {
      innerHTML += `<span class="ai-indicator">🤖</span>`;
    }

    if (item.kind !== ASSET_TYPES.PERSONALIZED_VOICE && item.type !== POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION) {
      innerHTML += `<div class="popcorn-element-title">${itemTitle}</div>`;
      innerHTML += `<div class="${classnames('inner-wrapper', 'popcorn-timeline-icon')}">`;
      if (quantityIcon && item[DEFAULT_FIELD[item.type]] === DEFAULT_SETTINGS[item.type][DEFAULT_FIELD[item.type]]) {
        innerHTML += `<div class="icon-btn--inline">${quantityIcon}</div>`;
      } else {
        innerHTML += item[DEFAULT_FIELD[item.type]];
      }
      innerHTML += `</div>`;
    }

    // Editing indicator
    const editingIndicator = editingMode ? `<span class="editing-indicator">✏️</span>` : '';

    const html = `
      <div class="${classnames(className, 'popcorn-element', 'icon-element', `popcorn-${item.type}-element`, { 
        'popcorn-element-personalized-voice': item.kind === ASSET_TYPES.PERSONALIZED_VOICE,
        'editing-mode': editingMode,
        'ai-generated': generationState.generated,
        'ai-generating': generationState.isGenerating,
      })}" 
           title="${item.title || item.htmlText || item.type}" 
           data-element-id="${item.id || item.i}"
           tabindex="-1">
        ${innerHTML}
        ${editingIndicator}
        ${this.renderEditingUI()}
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}

export default IconElement;
