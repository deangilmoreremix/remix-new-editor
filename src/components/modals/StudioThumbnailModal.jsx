import { TemplateThumbnailModal, mountThumbnailModal } from './TemplateThumbnailModal.jsx';
import { supabase } from '../../lib/supabase.js';
import { ThumbnailService } from '../../lib/thumbnailService.js';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import { PRESET_LIST, applyPresetToControls } from '../../lib/thumbnailPresets.js';

/**
 * StudioThumbnailModal — generalized thumbnail studio for any non-template
 * video/image creation studio.
 *
 * Wraps TemplateThumbnailModal with a synthesized "template" object so the
 * existing 5-step flow (brief → generate → refine → save → apply) works
 * without requiring a real template. The thumbnail URL returned via
 * onApply can be wired into any studio's generation params.
 *
 * Required options:
 *   appTheme:    one of the getAppColorScheme keys (e.g. "video-studio")
 *   studioId:    unique id used for storage path (e.g. "video-studio")
 *   studioName:  human-readable name shown in the brief (e.g. "Video Studio")
 *   onApply:     ({ imageUrl, revisedPrompt }) => void
 *   onClear:     () => void  (optional)
 *
 * Optional:
 *   aspectRatio: default "16:9"
 *   outputType:  "video" | "image" (affects controls)
 *   visualStyle, cinematography, niche: optional hints for preset matching
 *   initialBrief: optional pre-populated brief text
 */

/**
 * StudioThumbnailModal — generalized wrapper for any studio.
 *
 * Builds a minimal "template" object from the studio context so the
 * underlying TemplateThumbnailModal works without a real template.
 */
export class StudioThumbnailModal extends TemplateThumbnailModal {
  constructor(options = {}) {
    const {
      appTheme = 'video-studio',
      studioId = 'studio',
      studioName = 'Studio',
      aspectRatio = '16:9',
      outputType = 'video',
      visualStyle = '',
      cinematography = '',
      niche = '',
      initialBrief = '',
      onApply,
      onClear,
      ...rest
    } = options;

    // Build a minimal "template" shape that TemplateThumbnailModal understands
    const syntheticTemplate = {
      id: studioId,
      name: studioName,
      aspectRatio,
      outputType,
      visualStyle,
      cinematography,
      niche,
      uiDescription: initialBrief || `Custom thumbnail for ${studioName} output`,
      coreUseCase: studioName,
      sceneBlueprint: [],
    };

    super({
      ...rest,
      appTheme,
      template: syntheticTemplate,
      onApply: onApply || (() => {}),
      onClear: onClear || (() => {}),
    });

    this.studioId = studioId;
    this.studioName = studioName;
    this.studioOutputType = outputType;
  }

  // Override the subtitle to make it clear this is the studio variant
  renderBody() {
        if (this._error) return this.renderError();
    if (this.isGenerating) return this.renderLoading();

    const primary = this.appColors.primary;
    const accent = this.appColors.accent;

    let main = '';
    switch (this.step) {
      case 'brief':
        main = this.renderBrief();
        break;
      case 'generate':
        main = this.renderGenerate();
        break;
      case 'refine':
        main = this.renderRefine();
        break;
      case 'saved':
        main = this.renderSaved();
        break;
      default:
        main = this.renderBrief();
    }

    return `<div class="thumb-modal studio-thumb-modal" style="--app-primary: ${primary}; --app-accent: ${accent}; --app-soft: ${this.hexToRgba(primary, 0.12)}; --app-soft-accent: ${this.hexToRgba(accent, 0.12)}">
      <p class="thumb-subtitle">Generate a custom thumbnail for your ${this.studioOutputType} using OpenAI's image model. Create, refine, and apply it before generation.</p>
      <div class="thumb-form">${main}</div>
    </div>`;
  }

  // Override buildInitialBrief to work without template sceneBlueprint
  buildInitialBrief() {
    if (this._customBrief) return this._customBrief;
    const parts = [
      `${this.studioName} thumbnail`,
      this.template?.uiDescription ? `Context: ${this.template.uiDescription}` : null,
    ].filter(Boolean);
    return parts.join('\n');
  }

  // Allow caller to set a custom brief
  setCustomBrief(text) {
    this._customBrief = text;
  }
}

export function mountStudioThumbnailModal(modal) {
  // Reuse the same global mount point
  return mountThumbnailModal(modal);
}

export default StudioThumbnailModal;
