import { Component } from '../../../../base/Component.js';
import { getStore } from '../../../../stores/base/Store.js';
import classnames from 'classnames';
import { ANIMATION_TYPES, NONE_CLASS } from '../../../../lib/constants/animations';
import { POPCORN_ELEMENT_LABELS, POPCORN_ELEMENT_TYPES } from '../../../../lib/constants/popcorn';
import { wrapTokens } from '../../../../lib/utils/tokens-helper';
import { generationService, createTextToVideoRequest, createImageToVideoRequest } from '../../../../lib/editor/generationService.js';

/**
 * Enhanced AnimatableElement with deep timeline store integration
 * AI generation, editing, and state management fully synchronized through the store
 */
export class AnimatableElement extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.timelineStore = getStore('timelineStore');

    this.state = {
      onSelect: props.onSelect,
      item: props.item,
      elementId: props.item?.id || props.item?.i,
    };

    this.removeAnimation = this.removeAnimation.bind(this);

    // Bind AI methods
    this.generateContent = this.generateContent.bind(this);
    this.regenerateContent = this.regenerateContent.bind(this);
    this.showAISuggestions = this.showAISuggestions.bind(this);
    this.applyAISuggestion = this.applyAISuggestion.bind(this);
    this.closeAISuggestions = this.closeAISuggestions.bind(this);
    
    // Bind store integration methods
    this.syncWithTimelineStore = this.syncWithTimelineStore.bind(this);
    this.updateTimelineStoreState = this.updateTimelineStoreState.bind(this);
    this.handleAIStateUpdate = this.handleAIStateUpdate.bind(this);
  }

  componentDidMount() {
    // Sync with timeline store on mount
    this.syncWithTimelineStore();
    
    // Subscribe to timeline store for AI state updates
    if (this.timelineStore?.subscribe) {
      this.unsubscribeFromStore = this.timelineStore.subscribe((state) => {
        this.handleStoreUpdate(state);
      });
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeFromStore) {
      this.unsubscribeFromStore();
    }
  }

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
    if (elementState?.ai) {
      this.handleAIStateUpdate(elementState.ai);
    }
  }

  /**
   * Handle AI state updates from store
   */
  handleAIStateUpdate(aiState) {
    const { item } = this.state;
    
    this.setState({
      item: {
        ...item,
        isGenerating: aiState.isGenerating,
        generationError: aiState.generationError,
        generationId: aiState.generationId,
        generated: aiState.generated,
        assetId: aiState.assetId,
      },
    });
  }

  /**
   * Update timeline store with current state
   */
  updateTimelineStoreState(updates) {
    const { elementId } = this.state;
    if (!elementId || !this.timelineStore) return;

    // Update AI state in timeline store
    if (updates.ai) {
      this.timelineStore.setElementAIState?.(elementId, updates.ai);
    }
    
    // Update trim state
    if (updates.trim) {
      this.timelineStore.setElementTrimState?.(elementId, updates.trim);
    }
    
    // Update property state
    if (updates.properties) {
      this.timelineStore.setElementPropertyState?.(elementId, updates.properties);
    }
    
    // Update transition state
    if (updates.transitions) {
      this.timelineStore.setElementTransitionState?.(elementId, updates.transitions);
    }
  }

  removeAnimation(e, animationType) {
    e.stopPropagation();
    
    // Push undo state before change
    const { elementId } = this.state;
    if (this.timelineStore?.pushUndoState) {
      this.timelineStore.pushUndoState({
        animationRemoved: { elementId, animationType },
      });
    }
    
    this.projectStore.updateAnimation(animationType);
  }

  // ============================================================================
  // AI CONTENT GENERATION METHODS (with store integration)
  // ============================================================================

  /**
   * Generate text content using AI
   * @param {string} prompt - The generation prompt
   * @param {Object} options - Additional generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateTextContent(prompt, options = {}) {
    const { elementId } = this.state;
    
    try {
      // Set generating state in timeline store
      if (this.timelineStore?.setElementGenerating) {
        this.timelineStore.setElementGenerating(elementId, true);
      }

      const request = createTextToVideoRequest(prompt, {
        duration: options.duration || 5,
        aspectRatio: options.aspectRatio || '16:9',
        fps: options.fps || 24,
        stylePreset: options.stylePreset || 'cinematic',
        ...options,
      });

      const result = await generationService.submit(request, 'ltx');

      if (result.status === 'completed') {
        await this.handleGenerationComplete(result);
      } else if (result.generationId) {
        // Update store with generation ID for polling
        if (this.timelineStore?.setElementGenerating) {
          this.timelineStore.setElementGenerating(elementId, true, result.generationId);
        }
      }

      return result;
    } catch (error) {
      if (this.timelineStore?.setElementGenerationError) {
        this.timelineStore.setElementGenerationError(elementId, error.message);
      }
      this.setState({ generationError: error.message });
      throw error;
    }
  }

  /**
   * Generate image content using AI
   * @param {string} prompt - The generation prompt
   * @param {Object} options - Additional generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateImageContent(prompt, options = {}) {
    const { elementId } = this.state;
    
    try {
      // Set generating state in timeline store
      if (this.timelineStore?.setElementGenerating) {
        this.timelineStore.setElementGenerating(elementId, true);
      }

      const request = createImageToVideoRequest('', prompt, {
        duration: options.duration || 3,
        aspectRatio: options.aspectRatio || '16:9',
        fps: options.fps || 24,
        ...options,
      });

      const result = await generationService.submit(request, 'ltx');

      if (result.status === 'completed') {
        await this.handleGenerationComplete(result);
      } else if (result.generationId) {
        if (this.timelineStore?.setElementGenerating) {
          this.timelineStore.setElementGenerating(elementId, true, result.generationId);
        }
      }

      return result;
    } catch (error) {
      if (this.timelineStore?.setElementGenerationError) {
        this.timelineStore.setElementGenerationError(elementId, error.message);
      }
      this.setState({ generationError: error.message });
      throw error;
    }
  }

  /**
   * Generate video content using AI
   * @param {string} prompt - The generation prompt
   * @param {Object} options - Additional generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateVideoContent(prompt, options = {}) {
    const { elementId } = this.state;
    
    try {
      // Set generating state in timeline store
      if (this.timelineStore?.setElementGenerating) {
        this.timelineStore.setElementGenerating(elementId, true);
      }

      const request = createTextToVideoRequest(prompt, {
        duration: options.duration || 5,
        aspectRatio: options.aspectRatio || '16:9',
        fps: options.fps || 24,
        stylePreset: options.stylePreset || 'cinematic',
        ...options,
      });

      const result = await generationService.submit(request, 'ltx');

      if (result.status === 'completed') {
        await this.handleGenerationComplete(result);
      } else if (result.generationId) {
        if (this.timelineStore?.setElementGenerating) {
          this.timelineStore.setElementGenerating(elementId, true, result.generationId);
        }
      }

      return result;
    } catch (error) {
      if (this.timelineStore?.setElementGenerationError) {
        this.timelineStore.setElementGenerationError(elementId, error.message);
      }
      this.setState({ generationError: error.message });
      throw error;
    }
  }

  /**
   * Generate video content with retry logic
   * @param {string} prompt - The generation prompt
   * @param {number} maxRetries - Maximum number of retries
   * @param {Object} options - Additional generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateVideoContentWithRetry(prompt, maxRetries = 3, options = {}) {
    const { elementId } = this.state;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateVideoContent(prompt, options);
      } catch (error) {
        if (attempt === maxRetries) {
          if (this.timelineStore?.setElementGenerationError) {
            this.timelineStore.setElementGenerationError(elementId, error.message);
          }
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  /**
   * Handle generation completion and update element state
   * @param {Object} result - Generation result
   */
  async handleGenerationComplete(result) {
    const { item, elementId } = this.state;

    const updatedItem = {
      ...item,
      assetId: result.assetIds?.[0],
      previewUrl: result.previewUrl,
      generated: true,
      generationId: result.generationId,
      generationError: null,
      isGenerating: false,
    };

    this.setState({ item: updatedItem });

    // Update timeline store
    if (this.timelineStore?.setElementGenerationComplete) {
      this.timelineStore.setElementGenerationComplete(elementId, result.assetIds?.[0]);
    }

    // Update project store with new asset
    this.projectStore.updateElement(item.i, updatedItem);
  }

  // ============================================================================
  // AI-POWERED EDITING METHODS (with store integration)
  // ============================================================================

  /**
   * Apply AI-suggested trimming
   * @param {Object} suggestion - AI trimming suggestion {startTime, endTime}
   */
  applyAISuggestedTrim(suggestion) {
    const { item, elementId } = this.state;

    // Push undo state before change
    if (this.timelineStore?.pushUndoState) {
      this.timelineStore.pushUndoState({
        elementTrim: { [elementId]: { trimStart: item.startTime, trimEnd: item.endTime } },
      });
    }

    const updatedItem = {
      ...item,
      startTime: suggestion.startTime,
      endTime: suggestion.endTime,
      duration: suggestion.endTime - suggestion.startTime,
    };

    this.setState({ item: updatedItem });

    // Update timeline store
    this.updateTimelineStoreState({
      trim: {
        trimStart: suggestion.startTime,
        trimEnd: suggestion.endTime,
        duration: suggestion.endTime - suggestion.startTime,
      },
    });

    this.projectStore.updateElement(item.i, updatedItem);
  }

  /**
   * Apply AI-suggested property enhancements
   * @param {Object} enhancements - AI property suggestions
   */
  applyAIPropertyEnhancements(enhancements) {
    const { item, elementId } = this.state;

    // Push undo state before change
    if (this.timelineStore?.pushUndoState) {
      this.timelineStore.pushUndoState({
        elementProperties: { [elementId]: { ...item.properties } },
      });
    }

    const updatedItem = {
      ...item,
      properties: {
        ...item.properties,
        ...enhancements,
      },
    };

    this.setState({ item: updatedItem });

    // Update timeline store
    this.updateTimelineStoreState({
      properties: updatedItem.properties,
    });

    this.projectStore.updateElement(item.i, updatedItem);
  }

  /**
   * Apply AI-suggested transitions
   * @param {Object} transitions - AI transition suggestions {in: string, out: string}
   */
  applyAITransitions(transitions) {
    const { item, elementId } = this.state;

    // Push undo state before change
    if (this.timelineStore?.pushUndoState) {
      this.timelineStore.pushUndoState({
        elementTransitions: { [elementId]: { ...item.transitions } },
      });
    }

    const updatedItem = {
      ...item,
      transitions: {
        ...item.transitions,
        ...transitions,
      },
    };

    this.setState({ item: updatedItem });

    // Update timeline store
    this.updateTimelineStoreState({
      transitions: {
        transitionIn: transitions.in,
        transitionOut: transitions.out,
      },
    });

    this.projectStore.updateElement(item.i, updatedItem);
  }

  // ============================================================================
  // AI WORKFLOW INTEGRATION METHODS
  // ============================================================================

  /**
   * Run a specific AI workflow
   * @param {string} workflowType - Type of workflow ('text-to-video', 'image-to-video', etc.)
   * @param {Object} params - Workflow parameters
   * @returns {Promise<Object>} Workflow result
   */
  async runAIWorkflow(workflowType, params = {}) {
    const { item, elementId } = this.state;

    switch (workflowType) {
      case 'text-to-video':
        return await this.generateTextContent(params.prompt, params.options);

      case 'image-to-video':
        return await this.generateImageContent(params.prompt, params.options);

      case 'retake':
        // Implement retake workflow
        if (this.timelineStore?.setElementGenerating) {
          this.timelineStore.setElementGenerating(elementId, true);
        }
        
        const retakeRequest = {
          mode: 'retake',
          prompt: params.prompt || 'Improve this video segment',
          sourceAssetId: item.assetId,
          selectedRange: params.range || { start: 0, end: item.duration || 5 },
          duration: params.duration || item.duration || 5,
          stylePreset: params.stylePreset || 'cinematic',
        };
        
        try {
          const retakeResult = await generationService.submit(retakeRequest, 'ltx');
          if (retakeResult.status === 'completed') {
            await this.handleGenerationComplete(retakeResult);
          }
          return retakeResult;
        } catch (error) {
          if (this.timelineStore?.setElementGenerationError) {
            this.timelineStore.setElementGenerationError(elementId, error.message);
          }
          throw error;
        }

      case 'extend':
        // Implement extend workflow
        if (this.timelineStore?.setElementGenerating) {
          this.timelineStore.setElementGenerating(elementId, true);
        }
        
        const extendRequest = {
          mode: 'extend',
          prompt: params.prompt || 'Continue this video',
          sourceAssetId: item.assetId,
          duration: params.extendDuration || 5,
        };
        
        try {
          const extendResult = await generationService.submit(extendRequest, 'ltx');
          if (extendResult.status === 'completed') {
            await this.handleGenerationComplete(extendResult);
          }
          return extendResult;
        } catch (error) {
          if (this.timelineStore?.setElementGenerationError) {
            this.timelineStore.setElementGenerationError(elementId, error.message);
          }
          throw error;
        }

      case 'broll':
        // Implement b-roll workflow
        if (this.timelineStore?.setElementGenerating) {
          this.timelineStore.setElementGenerating(elementId, true);
        }
        
        const brollRequest = {
          mode: 'broll',
          prompt: params.prompt || 'Generate complementary footage',
          duration: params.duration || 3,
          aspectRatio: params.aspectRatio || '16:9',
        };
        
        try {
          const brollResult = await generationService.submit(brollRequest, 'ltx');
          if (brollResult.status === 'completed') {
            await this.handleGenerationComplete(brollResult);
          }
          return brollResult;
        } catch (error) {
          if (this.timelineStore?.setElementGenerationError) {
            this.timelineStore.setElementGenerationError(elementId, error.message);
          }
          throw error;
        }

      default:
        throw new Error(`Unknown workflow type: ${workflowType}`);
    }
  }

  /**
   * Get AI-powered content suggestions
   * @returns {string[]} Array of content suggestions
   */
  getAIContentSuggestions() {
    const { item } = this.state;
    const suggestions = [];

    if (item.type === 'TEXT') {
      suggestions.push(
        'Make it more engaging with action verbs',
        'Add emotional appeal to connect with viewers',
        'Optimize for video delivery with shorter sentences',
        'Include a clear call-to-action',
        'Use storytelling elements for better retention'
      );
    } else if (item.type === 'IMAGE') {
      suggestions.push(
        'Enhance visual impact with better composition',
        'Add dynamic elements for video flow',
        'Optimize colors for better contrast',
        'Consider aspect ratio for video compatibility',
        'Add text overlays for better context'
      );
    } else if (item.type === 'VIDEO') {
      suggestions.push(
        'Improve pacing with better cuts',
        'Add B-roll for visual interest',
        'Enhance audio with background music',
        'Optimize for different screen sizes',
        'Add transitions for smoother flow'
      );
    }

    return suggestions;
  }

  getGridItem(animationType) {
    const { item } = this.state;
    const { activeElementId } = this.projectStore;
    const isViewCloseButton = activeElementId === item.i;

    switch (item.type) {
      case POPCORN_ELEMENT_TYPES.LEAD_GENERATOR:
      case POPCORN_ELEMENT_TYPES.TEXT:
      case POPCORN_ELEMENT_TYPES.IMAGE: {
        const animated = item.animation && item.animation[animationType]
          && item.animation[animationType].type !== NONE_CLASS;
        if (animated && isViewCloseButton) {
          return `<div class="${classnames('popcorn-element-part', { [\`\${animationType}-animation-element\`]: animated })}"><button class="icon-button" onclick="this.removeAnimation(event, '${animationType}')">x</button></div>`;
        } else {
          return `<div class="${classnames('popcorn-element-part', { [\`\${animationType}-animation-element\`]: animated })}"></div>`;
        }
      }
      default: {
        return '';
      }
    }
  }

  render() {
    const { onSelect, item, generationError } = this.state;

    const aiControls = item.generated ? `
      <div class="ai-controls">
        <button class="ai-button ai-regenerate" onclick="this.regenerateContent(event)">🔄</button>
        <button class="ai-button ai-enhance" onclick="this.showAISuggestions(event)">✨</button>
      </div>
    ` : `
      <div class="ai-controls">
        <button class="ai-button ai-generate" onclick="this.generateContent(event)">🤖 Generate</button>
      </div>
    `;

    const errorDisplay = generationError ? `
      <div class="ai-error">${generationError}</div>
    ` : '';

    const generatingIndicator = item.isGenerating ? `
      <div class="generating-indicator">Generating...</div>
    ` : '';

    const html = `
      <div class="popcorn-element ${item.generated ? 'ai-generated' : ''} ${item.isGenerating ? 'ai-generating' : ''}" title="${item.type || item.title || item.htmlText}" tabindex="-1" onclick="${onSelect ? onSelect.name : ''}">
        <span class="popcorn-element-name">
          ${item.htmlText ? `<span class="popcorn-element-text" contenteditable="true">${wrapTokens(item.htmlText)}</span>` : POPCORN_ELEMENT_LABELS[item.type]}
          ${item.generated ? '<span class="ai-indicator">🤖</span>' : ''}
        </span>
        ${this.getGridItem(ANIMATION_TYPES.IN)}
        ${this.getGridItem(ANIMATION_TYPES.IDLE)}
        ${this.getGridItem(ANIMATION_TYPES.OUT)}
        ${aiControls}
        ${generatingIndicator}
        ${errorDisplay}
      </div>
    `;

    return this.createElementFromHTML(html);
  }

  // ============================================================================
  // AI UI INTERACTION METHODS
  // ============================================================================

  /**
   * Handle generate content button click
   * @param {Event} e - Click event
   */
  generateContent(e) {
    e.stopPropagation();
    const { item } = this.state;

    // Trigger AI generation based on element type
    const prompt = item.htmlText || `Generate ${item.type.toLowerCase()} content for video`;

    switch (item.type) {
      case POPCORN_ELEMENT_TYPES.TEXT:
        this.generateTextContent(prompt);
        break;
      case POPCORN_ELEMENT_TYPES.IMAGE:
        this.generateImageContent(prompt);
        break;
      case POPCORN_ELEMENT_TYPES.VIDEO:
        this.generateVideoContent(prompt);
        break;
      default:
        this.generateTextContent(prompt);
    }
  }

  /**
   * Handle regenerate content button click
   * @param {Event} e - Click event
   */
  regenerateContent(e) {
    e.stopPropagation();
    this.generateContent(e);
  }

  /**
   * Show AI suggestions panel
   * @param {Event} e - Click event
   */
  showAISuggestions(e) {
    e.stopPropagation();
    const suggestions = this.getAIContentSuggestions();

    // Create suggestions overlay (in a real implementation, this would be a proper modal/component)
    const suggestionsHtml = `
      <div class="ai-suggestions-overlay">
        <h4>AI Suggestions</h4>
        <ul>
          ${suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
        </ul>
        <button onclick="this.applyAISuggestion(event, 'enhance')">Apply Enhancement</button>
        <button onclick="this.closeAISuggestions(event)">Close</button>
      </div>
    `;

    // For now, just log suggestions (real implementation would show modal)
    console.log('AI Suggestions:', suggestions);
  }

  /**
   * Apply AI suggestion
   * @param {Event} e - Click event
   * @param {string} suggestionType - Type of suggestion to apply
   */
  applyAISuggestion(e, suggestionType) {
    e.stopPropagation();

    switch (suggestionType) {
      case 'enhance':
        // Apply random enhancement as example
        const enhancements = {
          fontSize: Math.floor(Math.random() * 10) + 20,
          color: '#' + Math.floor(Math.random()*16777215).toString(16),
        };
        this.applyAIPropertyEnhancements(enhancements);
        break;
      default:
        break;
    }

    this.closeAISuggestions(e);
  }

  /**
   * Close AI suggestions panel
   * @param {Event} e - Click event
   */
  closeAISuggestions(e) {
    e.stopPropagation();
    // Close overlay logic would go here
  }
}

export default AnimatableElement;
