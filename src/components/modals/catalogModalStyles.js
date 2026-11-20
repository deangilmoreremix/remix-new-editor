// Shared styles for the catalog-style modals (Recipes, Prompt Gallery): a
// searchable list on the left, a detail pane on the right.
// BaseModal only styles the drawer chrome, so these supply the body.
//
// Look: the CineGen Edit-tab surfaces (raised dark panels, 1px soft borders,
// pill tabs/chips, ringed selection, mono labels). The accent follows the
// host app's brand colour (`--primary`), like every other modal drawer here.

const STYLE_ID = 'catalog-modal-styles';

const CATALOG_STYLES = `
  .cm-root, .recipe-split {
    --cm-accent: var(--primary, #d9ff00);
    --cm-accent-dim: var(--primary-soft, rgba(217,255,0,0.14));
    --cm-on-accent: var(--on-primary, #000);
    --cm-void: #080b11;
    --cm-raised: #0c1118;
    --cm-elev: #111823;
    --cm-overlay: #17202d;
    --cm-input: #0a0e15;
    --cm-text: var(--text, #fff);
    --cm-text2: rgba(255,255,255,0.6);
    --cm-text3: rgba(255,255,255,0.4);
    --cm-line: rgba(255,255,255,0.08);
    --cm-line2: rgba(255,255,255,0.14);
    --cm-mono: 'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .cm-root { display: flex; flex-direction: column; gap: 14px; min-height: 100%; }
  .cm-intro { font-size: 12px; color: var(--cm-text2); }
  .cm-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cm-text3); font-weight: 700; }

  /* ---- Tabs (segmented) ---- */
  .prompt-gallery-tabs {
    display: inline-flex; align-self: flex-start; gap: 2px; padding: 3px;
    background: var(--cm-input); border: 1px solid var(--cm-line2); border-radius: 10px;
  }
  .prompt-gallery-tabs .tab {
    display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 7px;
    border: 1px solid transparent; background: transparent; color: var(--cm-text2);
    font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
  }
  .prompt-gallery-tabs .tab:hover { color: var(--cm-text); }
  .prompt-gallery-tabs .tab.active { color: var(--cm-text); background: var(--cm-accent-dim); border-color: var(--cm-accent); }
  .tab-count { font: 600 10px var(--cm-mono); padding: 1px 5px; border-radius: 5px; background: rgba(255,255,255,0.07); color: var(--cm-text3); }
  .tab.active .tab-count { color: var(--cm-accent); background: rgba(255,255,255,0.08); }

  /* ---- Two-pane layout ---- */
  .recipe-split, .prompt-gallery-split {
    display: grid; grid-template-columns: minmax(300px, 0.9fr) minmax(360px, 1.3fr); gap: 16px; flex: 1; min-height: 0;
  }
  @media (max-width: 860px) {
    .recipe-split, .prompt-gallery-split { grid-template-columns: 1fr; }
  }
  .recipe-catalog, .prompt-catalog, .recipe-detail, .prompt-detail { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0; }
  .recipe-detail, .prompt-detail, .builder-panel {
    padding: 18px 20px; border-radius: 14px; border: 1px solid var(--cm-line2); background: var(--cm-raised);
  }

  /* ---- Search + chips ---- */
  .cm-search {
    display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 10px;
    background: var(--cm-input); border: 1px solid var(--cm-line2); color: var(--cm-text3);
  }
  .cm-search:focus-within { border-color: var(--cm-accent); }
  .cm-search input { flex: 1; min-width: 0; padding: 9px 0; border: 0; background: transparent; color: var(--cm-text); font-size: 13px; font-family: inherit; outline: none; }
  .recipe-controls, .prompt-controls { display: flex; flex-direction: column; gap: 10px; }
  .recipe-controls select {
    padding: 9px 12px; border-radius: 10px; border: 1px solid var(--cm-line2); background: var(--cm-input);
    color: var(--cm-text); font-size: 13px; font-family: inherit; outline: none;
  }
  .cm-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .cm-chip {
    padding: 4px 11px; border-radius: 999px; border: 1px solid var(--cm-line2); background: transparent;
    color: var(--cm-text2); font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit;
  }
  .cm-chip:hover { color: var(--cm-text); border-color: rgba(255,255,255,0.3); }
  .cm-chip.on { background: var(--cm-accent-dim); border-color: var(--cm-accent); color: var(--cm-text); }
  .cm-list-head { display: flex; align-items: center; justify-content: space-between; }
  .cm-count { font: 600 11px var(--cm-mono); color: var(--cm-text3); }

  /* ---- Lists + cards ---- */
  .recipe-list, .prompt-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; min-height: 0; padding: 2px 4px 2px 2px; }
  .recipe-card, .prompt-card {
    position: relative; padding: 12px 14px; border-radius: 12px; cursor: pointer;
    border: 1px solid var(--cm-line); background: var(--cm-elev);
    transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
  }
  .recipe-card:hover, .prompt-card:hover { border-color: var(--cm-line2); background: var(--cm-overlay); }
  .recipe-card:focus-visible, .prompt-card:focus-visible { outline: 2px solid var(--cm-accent); outline-offset: 2px; }
  .recipe-card.selected, .prompt-card.selected {
    border-color: var(--cm-accent); background: var(--cm-accent-dim); box-shadow: 0 0 0 3px var(--cm-accent-dim);
  }
  .recipe-name, .detail-title { font-weight: 700; font-size: 14px; color: var(--cm-text); }
  .detail-title { font-size: 18px; }
  .prompt-card-text {
    font-size: 13px; color: var(--cm-text); line-height: 1.45; padding-right: 26px;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .recipe-desc, .detail-desc { font-size: 12px; color: var(--cm-text2); margin-top: 4px; line-height: 1.45; }
  .recipe-meta, .detail-meta { font-size: 11px; color: var(--cm-text3); margin-top: 6px; text-transform: capitalize; }
  .prompt-card-meta, .prompt-detail .detail-meta { display: flex; align-items: center; gap: 6px; margin-top: 8px; text-transform: none; }
  .prompt-source-badge, .prompt-category-badge {
    padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 600;
    background: rgba(255,255,255,0.07); color: var(--cm-text2);
  }
  .prompt-category-badge { background: var(--cm-accent-dim); color: var(--cm-text); }
  .favorite-btn {
    margin-left: auto; padding: 2px 8px; border-radius: 8px; border: 1px solid transparent; background: transparent;
    color: var(--cm-text3); font-size: 13px; cursor: pointer; font-family: inherit;
  }
  .prompt-card .favorite-btn { position: absolute; top: 8px; right: 6px; margin: 0; }
  .favorite-btn:hover { border-color: var(--cm-line2); color: var(--cm-text); }
  .favorite-btn.active { color: #fbbf24; }

  /* ---- Detail pane ---- */
  .detail-prompt { font-size: 16px; line-height: 1.55; font-weight: 600; color: var(--cm-text); white-space: pre-wrap; margin-top: 6px; }
  .detail-header { display: flex; flex-direction: column; gap: 8px; }
  .detail-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .prompt-detail .detail-actions { padding-bottom: 14px; border-bottom: 1px solid var(--cm-line); }

  /* ---- Builder ---- */
  .builder, .builder-panel { display: flex; flex-direction: column; gap: 8px; }
  .builder { margin-top: 4px; }
  .builder-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 640px) { .builder-grid { grid-template-columns: 1fr; } }
  .builder input, .builder select, .builder-panel input, .builder-panel select, .builder-panel textarea {
    width: 100%; min-width: 0; padding: 9px 12px; border-radius: 10px; box-sizing: border-box;
    border: 1px solid var(--cm-line2); background: var(--cm-input);
    color: var(--cm-text); font-size: 13px; font-family: inherit; outline: none;
  }
  .builder input:focus, .builder select:focus, .builder-panel :focus { border-color: var(--cm-accent); }
  .builder > .cm-label, .builder-panel > .cm-label, .builder label, .builder-panel label {
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cm-text3); font-weight: 700; margin-top: 6px;
  }
  .builder .preview, .builder-panel .preview, .recipe-log, .template-preview {
    margin: 0; padding: 12px; border-radius: 10px; background: var(--cm-input); border: 1px solid var(--cm-line2);
    color: var(--cm-text2); font: 11.5px/1.6 var(--cm-mono); white-space: pre-wrap; max-height: 260px; overflow: auto;
  }
  .panel-header h3 { margin: 0; font-size: 14px; color: var(--cm-text); }

  /* ---- Recipes ---- */
  .detail-steps { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
  .detail-steps .step {
    display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--cm-text);
    padding: 9px 12px; border: 1px solid var(--cm-line); background: var(--cm-elev); border-radius: 10px;
  }
  .step-num {
    display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex-shrink: 0;
    border-radius: 999px; background: var(--cm-accent-dim); color: var(--cm-accent); font: 700 11px var(--cm-mono);
  }
  .step--running .step-num { background: var(--cm-accent); color: var(--cm-on-accent); }
  .step--done .step-num { background: rgba(52,211,153,0.18); color: #34d399; }
  .step--error .step-num { background: rgba(239,68,68,0.2); color: #f87171; }
  .step-meta { margin-left: auto; font: 11px var(--cm-mono); color: var(--cm-text3); }
  .recipe-cost { margin-top: 12px; font-size: 11.5px; color: var(--cm-text2); }
  .recipe-log { display: flex; flex-direction: column; gap: 4px; }
  .recipe-log:empty { display: none; }
  .recipe-log .log-time { color: var(--cm-text3); margin-right: 8px; }
  .recipe-result { display: flex; flex-wrap: wrap; gap: 8px; }
  .recipe-result a, .recipe-history a {
    padding: 4px 10px; border-radius: 999px; border: 1px solid var(--cm-accent); background: var(--cm-accent-dim);
    color: var(--cm-text); font-size: 12px; font-weight: 600; text-decoration: none;
  }
  .recipe-history { display: flex; flex-direction: column; gap: 6px; }
  .recipe-history__title { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cm-text3); font-weight: 700; }
  .recipe-history__row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 11px; color: var(--cm-text2); }
  .recipe-history a { padding: 2px 8px; font-size: 11px; }

  /* ---- Buttons ---- */
  .cm-root .btn-primary-modern, .cm-root .btn-secondary-modern {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; border-radius: 10px;
    font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid var(--cm-accent);
    background: var(--cm-accent); color: var(--cm-on-accent); box-shadow: none; transition: filter 150ms ease, border-color 150ms ease;
  }
  .cm-root .btn-primary-modern:hover:not(:disabled) { filter: brightness(1.08); }
  .cm-root .btn-primary-modern:disabled { opacity: 0.5; cursor: not-allowed; }
  .cm-root .btn-secondary-modern { background: var(--cm-overlay); color: var(--cm-text); border-color: var(--cm-line2); }
  .cm-root .btn-secondary-modern:hover { border-color: rgba(255,255,255,0.3); }
  .cm-root .builder > .btn-primary-modern { align-self: flex-start; margin-top: 6px; }
  .cm-root :focus-visible { outline: 2px solid var(--cm-accent); outline-offset: 2px; }

  /* ---- Empty states ---- */
  .recipe-split .empty-state, .prompt-gallery-split .empty-state {
    color: var(--cm-text2); font-size: 13px; text-align: center; padding: 28px 12px; line-height: 1.5;
  }
  .copy-flash { color: var(--cm-accent); }
`;

export function injectCatalogModalStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CATALOG_STYLES;
  document.head.appendChild(style);
}
