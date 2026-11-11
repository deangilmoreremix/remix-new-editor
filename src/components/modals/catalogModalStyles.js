// Shared layout styles for the catalog-style modals (Recipes, Prompt Gallery,
// Monetization Hub): a searchable list on the left, a detail pane on the right.
// BaseModal only styles the drawer chrome, so without these the modal bodies
// rendered as unstyled text.

const STYLE_ID = 'catalog-modal-styles';

const CATALOG_STYLES = `
  .recipe-split, .prompt-gallery-split, .monetization-split {
    display: grid; grid-template-columns: minmax(260px, 1fr) minmax(300px, 1.4fr); gap: 20px; min-height: 100%;
  }
  @media (max-width: 760px) {
    .recipe-split, .prompt-gallery-split, .monetization-split { grid-template-columns: 1fr; }
  }
  .prompt-gallery-root, .monetization-root { display: flex; flex-direction: column; gap: 16px; }
  .prompt-gallery-tabs, .monetization-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--border-soft, rgba(255,255,255,0.08)); padding-bottom: 10px; }
  .prompt-gallery-tabs .tab, .monetization-tabs .tab {
    padding: 7px 14px; border-radius: 999px; border: 1px solid transparent; background: transparent;
    color: var(--muted, #9ca3af); font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .prompt-gallery-tabs .tab:hover, .monetization-tabs .tab:hover { color: var(--text, #fff); background: rgba(255,255,255,0.05); }
  .prompt-gallery-tabs .tab.active, .monetization-tabs .tab.active {
    color: var(--on-primary, #000); background: var(--primary, #d9ff00);
  }

  .recipe-catalog, .recipe-detail, .prompt-catalog, .prompt-detail, .monetization-catalog, .monetization-detail {
    display: flex; flex-direction: column; gap: 12px; min-width: 0;
  }
  .recipe-detail, .prompt-detail, .monetization-detail, .builder-panel {
    padding: 16px; border-radius: 14px; border: 1px solid var(--border, rgba(255,255,255,0.1)); background: rgba(255,255,255,0.02);
  }
  .recipe-controls, .prompt-controls, .monetization-controls { display: flex; gap: 8px; flex-wrap: wrap; }
  .recipe-controls input, .recipe-controls select,
  .prompt-controls input, .prompt-controls select,
  .monetization-controls input, .monetization-controls select,
  .builder-panel input, .builder-panel select, .builder-panel textarea,
  .builder input, .builder select {
    flex: 1; min-width: 0; padding: 9px 12px; border-radius: 10px;
    border: 1px solid var(--border, rgba(255,255,255,0.12)); background: rgba(255,255,255,0.05);
    color: var(--text, #fff); font-size: 13px; font-family: inherit; outline: none;
  }
  .recipe-controls select, .prompt-controls select, .monetization-controls select { flex: 0 0 auto; }
  .recipe-controls :focus, .prompt-controls :focus, .monetization-controls :focus, .builder-panel :focus, .builder :focus {
    border-color: var(--primary, #d9ff00);
  }
  .recipe-list, .prompt-list, .monetization-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
  .recipe-card, .prompt-card, .monetization-card {
    padding: 12px 14px; border-radius: 12px; cursor: pointer;
    border: 1px solid var(--border, rgba(255,255,255,0.1)); background: rgba(255,255,255,0.03);
    transition: border-color 150ms ease, background 150ms ease;
  }
  .recipe-card:hover, .prompt-card:hover, .monetization-card:hover { border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.06); }
  .recipe-card:focus-visible, .prompt-card:focus-visible, .monetization-card:focus-visible { outline: 2px solid var(--primary, #d9ff00); outline-offset: 2px; }
  .recipe-card.selected, .prompt-card.selected, .monetization-card.selected { border-color: var(--primary, #d9ff00); background: rgba(217,255,0,0.08); }
  .recipe-name, .monetization-title, .detail-title { font-weight: 700; font-size: 14px; color: var(--text, #fff); }
  .detail-title { font-size: 18px; }
  .prompt-card-text { font-size: 13px; color: var(--text, #fff); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .recipe-desc, .monetization-desc, .detail-desc { font-size: 12px; color: var(--muted, #9ca3af); margin-top: 4px; line-height: 1.45; }
  .recipe-meta, .monetization-meta, .detail-meta { font-size: 11px; color: var(--dim, #6b7280); margin-top: 6px; text-transform: capitalize; }
  .prompt-card-meta, .prompt-detail .detail-meta { display: flex; align-items: center; gap: 6px; margin-top: 8px; text-transform: none; }
  .prompt-source-badge, .prompt-category-badge {
    padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600;
    background: rgba(255,255,255,0.07); color: var(--muted, #9ca3af);
  }
  .favorite-btn {
    margin-left: auto; padding: 2px 8px; border-radius: 8px; border: 1px solid transparent; background: transparent;
    color: var(--muted, #9ca3af); font-size: 13px; cursor: pointer;
  }
  .favorite-btn:hover { border-color: var(--border, rgba(255,255,255,0.12)); }
  .favorite-btn.active { color: var(--primary, #d9ff00); }
  .detail-prompt { font-size: 14px; line-height: 1.55; color: var(--text, #fff); white-space: pre-wrap; }
  .detail-steps { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
  .detail-steps .step { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text, #fff); }
  .step-num {
    display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex-shrink: 0;
    border-radius: 999px; background: var(--primary, #d9ff00); color: var(--on-primary, #000); font-size: 11px; font-weight: 700;
  }
  .step-meta { margin-left: auto; font-size: 11px; color: var(--dim, #6b7280); font-family: ui-monospace, monospace; }
  .detail-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .template-preview, .builder-panel .preview, .builder .preview {
    margin: 0; padding: 12px; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-soft, rgba(255,255,255,0.08));
    color: var(--text, #fff); font-size: 12px; line-height: 1.5; white-space: pre-wrap; max-height: 360px; overflow: auto;
  }
  .builder-panel, .builder { display: flex; flex-direction: column; gap: 8px; }
  .builder { margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border-soft, rgba(255,255,255,0.08)); }
  .builder-panel label, .builder label { font-size: 12px; color: var(--muted, #9ca3af); margin-top: 4px; }
  .panel-header h3 { margin: 0; font-size: 14px; color: var(--text, #fff); }
  .recipe-log { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-family: ui-monospace, monospace; color: var(--muted, #9ca3af); }
  .recipe-log .log-time { color: var(--dim, #6b7280); margin-right: 8px; }
  .recipe-result a { color: var(--primary, #d9ff00); word-break: break-all; font-size: 12px; }
  .recipe-split .empty-state, .prompt-gallery-split .empty-state, .monetization-split .empty-state {
    color: var(--muted, #9ca3af); font-size: 13px; text-align: center; padding: 24px 8px;
  }
  .copy-flash { color: var(--primary, #d9ff00); }
`;

export function injectCatalogModalStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CATALOG_STYLES;
  document.head.appendChild(style);
}
