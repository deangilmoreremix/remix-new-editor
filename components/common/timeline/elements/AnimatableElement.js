import { Component } from '../../../../base/Component.js';
import { getStore } from '../../../../stores/base/Store.js';
import classnames from 'classnames';
import { ANIMATION_TYPES, NONE_CLASS } from '../../../../lib/constants/animations';
import { POPCORN_ELEMENT_LABELS, POPCORN_ELEMENT_TYPES } from '../../../../lib/constants/popcorn';
import { wrapTokens } from '../../../../lib/utils/tokens-helper';
import { generationService, createTextToVideoRequest, createImageToVideoRequest } from '../../../../lib/editor/generationService.js';

export class AnimatableElement extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');

    this.state = {
      onSelect: props.onSelect,
      item: props.item,
    };

    this.removeAnimation = this.removeAnimation.bind(this);

    // Bind AI methods
    this.generateContent = this.generateContent.bind(this);
    this.regenerateContent = this.regenerateContent.bind(this);
    this.showAISuggestions = this.showAISuggestions.bind(this);
    this.applyAISuggestion = this.applyAISuggestion.bind(this);
    this.closeAISuggestions = this.closeAISuggestions.bind(this);
  }

  removeAnimation(e, animationType) {
    e.stopPropagation();
    this.projectStore.updateAnimation(animationType);
  }

  // ============================================================================
  // AI CONTENT GENERATION METHODS
  // ============================================================================

  /**
   * Generate text content using AI
   * @param {string} prompt - The generation prompt
   * @param {Object} options - Additional generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateTextContent(prompt, options = {}) {
    try {
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
      }

      return result;
    } catch (error) {
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
    try {
      const request = createImageToVideoRequest('', prompt, {
        duration: options.duration || 3,
        aspectRatio: options.aspectRatio || '16:9',
        fps: options.fps || 24,
        ...options,
      });

      const result = await generationService.submit(request, 'ltx');

      if (result.status === 'completed') {
        await this.handleGenerationComplete(result);
      }

      return result;
    } catch (error) {
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
    try {
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
      }

      return result;
    } catch (error) {
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
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateVideoContent(prompt, options);
      } catch (error) {
        if (attempt === maxRetries) {
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
    const { item } = this.state;

    this.setState({
      item: {
        ...item,
        assetId: result.assetIds?.[0],
        previewUrl: result.previewUrl,
        generated: true,
        generationId: result.generationId,
        generationError: null,
      },
    });

    // Update project store with new asset
    this.projectStore.updateElement(item.i, this.state.item);
  }

  // ============================================================================
  // AI-POWERED EDITING METHODS
  // ============================================================================

  /**
   * Apply AI-suggested trimming
   * @param {Object} suggestion - AI trimming suggestion {startTime, endTime}
   */
  applyAISuggestedTrim(suggestion) {
    const { item } = this.state;

    this.setState({
      item: {
        ...item,
        startTime: suggestion.startTime,
        endTime: suggestion.endTime,
        duration: suggestion.endTime - suggestion.startTime,
      },
    });

    this.projectStore.updateElement(item.i, this.state.item);
  }

  /**
   * Apply AI-suggested property enhancements
   * @param {Object} enhancements - AI property suggestions
   */
  applyAIPropertyEnhancements(enhancements) {
    const { item } = this.state;

    this.setState({
      item: {
        ...item,
        properties: {
          ...item.properties,
          ...enhancements,
        },
      },
    });

    this.projectStore.updateElement(item.i, this.state.item);
  }

  /**
   * Apply AI-suggested transitions
   * @param {Object} transitions - AI transition suggestions {in: string, out: string}
   */
  applyAITransitions(transitions) {
    const { item } = this.state;

    this.setState({
      item: {
        ...item,
        transitions: {
          ...item.transitions,
          ...transitions,
        },
      },
    });

    this.projectStore.updateElement(item.i, this.state.item);
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
    const { item } = this.state;

    switch (workflowType) {
      case 'text-to-video':
        return await this.generateTextContent(params.prompt, params.options);

      case 'image-to-video':
        return await this.generateImageContent(params.prompt, params.options);

      case 'retake':
        // Implement retake workflow
        const retakeRequest = {
          mode: 'retake',
          prompt: params.prompt || 'Improve this video segment',
          sourceAssetId: item.assetId,
          selectedRange: params.range || { start: 0, end: item.duration || 5 },
          duration: params.duration || item.duration || 5,
          stylePreset: params.stylePreset || 'cinematic',
        };
        const retakeResult = await generationService.submit(retakeRequest, 'ltx');
        if (retakeResult.status === 'completed') {
          await this.handleGenerationComplete(retakeResult);
        }
        return retakeResult;

      case 'extend':
        // Implement extend workflow
        const extendRequest = {
          mode: 'extend',
          prompt: params.prompt || 'Continue this video',
          sourceAssetId: item.assetId,
          duration: params.extendDuration || 5,
        };
        const extendResult = await generationService.submit(extendRequest, 'ltx');
        if (extendResult.status === 'completed') {
          await this.handleGenerationComplete(extendResult);
        }
        return extendResult;

      case 'broll':
        // Implement b-roll workflow
        const brollRequest = {
          mode: 'broll',
          prompt: params.prompt || 'Generate complementary footage',
          duration: params.duration || 3,
          aspectRatio: params.aspectRatio || '16:9',
        };
        const brollResult = await generationService.submit(brollRequest, 'ltx');
        if (brollResult.status === 'completed') {
          await this.handleGenerationComplete(brollResult);
        }
        return brollResult;

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
          return `<div class="${classnames('popcorn-element-part', { [\`${animationType}-animation-element\`]: animated })}"><button class="icon-button" onclick="this.removeAnimation(event, '${animationType}')">x</button></div>`;
        } else {
          return `<div class="${classnames('popcorn-element-part', { [\`${animationType}-animation-element\`]: animated })}"></div>`;
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

    const html = `
      <div class="popcorn-element ${item.generated ? 'ai-generated' : ''}" title="${item.type || item.title || item.htmlText}" tabindex="-1" onclick="${onSelect ? onSelect.name : ''}">
        <span class="popcorn-element-name">
          ${item.htmlText ? `<span class="popcorn-element-text" contenteditable="true">${wrapTokens(item.htmlText)}</span>` : POPCORN_ELEMENT_LABELS[item.type]}
          ${item.generated ? '<span class="ai-indicator">🤖</span>' : ''}
        </span>
        ${this.getGridItem(ANIMATION_TYPES.IN)}
        ${this.getGridItem(ANIMATION_TYPES.IDLE)}
        ${this.getGridItem(ANIMATION_TYPES.OUT)}
        ${aiControls}
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
