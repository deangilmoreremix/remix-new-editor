import { TemplateThumbnailModal, mountThumbnailModal } from './TemplateThumbnailModal.jsx';
import { createElementFromHTML } from '../../utils/jsx.js';
import { injectPanelStyles } from './thumbPanelStyles.js';

/**
 * StudioThumbnailPanel — side-drawer version of the thumbnail studio.
 *
 * It is intentionally a *thin shell* around the working TemplateThumbnailModal
 * 5-step flow (brief → generate → refine → save → apply). It overrides only:
 *   - render()      → builds a right-side drawer (overlay + panel) that still
 *                     contains a `.modal-body` and `.modal-footer` so the base
 *                     class's updateBody()/setupEventListeners() keep working.
 *   - open()        → injects drawer styles, then delegates to the base flow.
 *   - updateBody()  → refreshes the step indicator after each base re-render.
 *   - close()       → handled by BaseModal (removes overlay + restores scroll).
 *
 * All generation logic, candidate rendering, refine/inpaint, save, and apply
 * are inherited unchanged from TemplateThumbnailModal.
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

  // ---------------------------------------------------------------------------
  // Shell rendering — a right-side drawer that hosts the base modal flow
  // ---------------------------------------------------------------------------
  render() {
    const content = this.error
      ? this.renderError()
      : this.loading
        ? this.renderLoading()
        : this.renderBody();

    const footer = this.showFooter
      ? `<div class="modal-footer">${this.footerContent || this.renderFooter()}</div>`
      : '';

    this.overlay = createElementFromHTML(`
      <div class="thumb-panel-overlay" role="dialog" aria-modal="true" aria-labelledby="thumb-panel-title">
        <div class="studio-thumb-panel">
          <div class="thumb-panel-header">
            <h3 class="thumb-panel-title" id="thumb-panel-title">🎬 Thumbnail Studio</h3>
            <button class="modal-close thumb-panel-close" aria-label="Close thumbnail panel">&times;</button>
          </div>
          ${this._renderStepIndicatorHTML()}
          <div class="modal-body">${content}</div>
          ${footer}
        </div>
      </div>
    `);

    document.body.appendChild(this.overlay);
    this.content = this.overlay.querySelector('.studio-thumb-panel');
    return this.overlay;
  }

  _renderStepIndicatorHTML() {
    const steps = ['Brief', 'Generate', 'Refine', 'Saved'];
    const order = { brief: 0, generate: 1, refine: 2, saved: 3 };
    const current = order[this.step] ?? 0;

    return `<div class="thumb-step-indicator">${steps
      .map((label, i) => {
        const cls = ['thumb-step', i < current ? 'done' : '', i === current ? 'active' : '']
          .filter(Boolean)
          .join(' ');
        const line = i < steps.length - 1
          ? `<div class="thumb-step-line ${i < current ? 'done' : ''}"></div>`
          : '';
        return `<div class="${cls}" title="${label}">${i + 1}</div>${line}`;
      })
      .join('')}</div>`;
  }

  // Keep the step indicator in sync after each base re-render
  updateBody(content) {
    super.updateBody(content);
    const indicator = this.overlay?.querySelector('.thumb-step-indicator');
    if (indicator) indicator.outerHTML = this._renderStepIndicatorHTML();
  }

  // Inject drawer styles, then run the full base open() flow
  // (state reset + preset setup + BaseModal.open → render() → event wiring)
  open() {
    injectPanelStyles();
    super.open();
    return this;
  }
}

export function mountStudioThumbnailModal(modal) {
  // Reuse the same global mount point
  return mountThumbnailModal(modal);
}

export default StudioThumbnailModal;
