import { TemplateThumbnailModal, mountThumbnailModal } from './TemplateThumbnailModal.jsx';
import { createElementFromHTML } from '../../utils/jsx.js';

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

const PANEL_STYLES = `
/* ============================================
   Studio Thumbnail Panel — side drawer shell
   ============================================ */

.thumb-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 280ms ease-out;
}

.thumb-panel-overlay.active {
  opacity: 1;
}

.studio-thumb-panel {
  --app-primary: #10b981;
  --app-accent: #34d399;
  --app-soft: rgba(16, 185, 129, 0.12);
  --app-soft-accent: rgba(52, 211, 153, 0.12);

  color: var(--text-primary);
  font-family: var(--font-family);
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 460px;
  max-width: 100vw;
  background: var(--bg-app);
  border-left: 1px solid var(--border-color);
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 280ms ease-out;
}

.thumb-panel-overlay.active .studio-thumb-panel {
  transform: translateX(0);
}

.studio-thumb-panel .thumb-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.studio-thumb-panel .thumb-panel-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.studio-thumb-panel .thumb-panel-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.studio-thumb-panel .thumb-panel-close:hover {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--app-primary);
}

.studio-thumb-panel .thumb-step-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 24px;
  flex-shrink: 0;
}

.studio-thumb-panel .thumb-step {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: var(--bg-panel);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.studio-thumb-panel .thumb-step.active {
  background: linear-gradient(135deg, var(--app-primary), var(--app-accent));
  color: #ffffff;
  border-color: transparent;
}

.studio-thumb-panel .thumb-step.done {
  background: var(--app-soft);
  color: var(--app-primary);
  border-color: var(--app-primary);
}

.studio-thumb-panel .thumb-step-line {
  flex: 1;
  height: 2px;
  background: var(--border-color);
  border-radius: 1px;
}

.studio-thumb-panel .thumb-step-line.done {
  background: linear-gradient(90deg, var(--app-primary), var(--app-accent));
}

/* Host the base .thumb-modal flow inside the drawer */
.studio-thumb-panel .modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  overscroll-behavior: contain;
}

.studio-thumb-panel .modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-panel);
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .studio-thumb-panel {
    width: 100vw;
  }
}
`;

let panelStylesInjected = false;
function injectPanelStyles() {
  if (panelStylesInjected) return;
  const styleEl = document.createElement('style');
  styleEl.textContent = PANEL_STYLES;
  document.head.appendChild(styleEl);
  panelStylesInjected = true;
}

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
