import {
  IMAGE_EDIT_OPERATIONS,
  getAssetRecipe,
  getOperation,
  getOperationsForAsset,
  operationGroupsForAsset,
  resolveEditorAssetKind,
} from './imageEditRegistry.js';
import { DEFAULT_LOCAL_IMAGE_CONTROLS } from './localImageEditor.js';

const GROUP_LABELS = Object.freeze({
  smart: 'Smart',
  background: 'Background',
  subject: 'Subject',
  people: 'People',
  product: 'Product',
  brand: 'Brand',
  object: 'Objects',
  text: 'Text',
  scene: 'Scene',
  video: 'Video',
  effects: 'Effects',
  transform: 'Transform',
});

const ASPECTS = ['original', '9:16', '16:9', '1:1', '4:5'];
const FORMATS = ['png', 'webp', 'jpeg'];

export function createRecastState() {
  return {
    open: false,
    sourceName: '',
    sourcePreviewUrl: '',
    sourceUrl: '',
    duration: 0,
    prompt: '',
    status: 'idle',
    statusLabel: '',
    resultUrl: '',
    error: '',
    saved: false,
    startedAt: 0,
    characters: [],
    characterId: '',
    jobId: '',
    canRetry: false,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanVersion(version, index, fallbackUrl) {
  const url = version?.dataUrl || version?.url || fallbackUrl || '';
  return {
    id: version?.id || `editor-version-${index}`,
    label: version?.label || (index === 0 ? 'Original' : `Version ${index}`),
    dataUrl: url,
    operation: version?.operation || (index === 0 ? 'original' : 'existing_edit'),
    prompt: version?.prompt || '',
    model: version?.model || (index === 0 ? 'original' : 'unknown'),
    transparent: Boolean(version?.transparent),
    videoReady: Boolean(version?.videoReady),
    responseId: version?.responseId || version?.response_id || null,
    imageGenerationCallId: version?.imageGenerationCallId || version?.image_generation_call_id || null,
    revisedPrompt: version?.revisedPrompt || version?.revised_prompt || null,
    quality: version?.quality || null,
    outputFormat: version?.outputFormat || null,
    outputCompression: typeof version?.outputCompression === 'number' ? version.outputCompression : null,
    inputFidelity: version?.inputFidelity || null,
    visionValidation: version?.visionValidation || null,
    createdAt: version?.createdAt || new Date().toISOString(),
  };
}

function defaultProtections(kind) {
  return {
    subject: true,
    face: kind === 'person' || kind === 'team',
    product: kind === 'product',
    logo: ['logo', 'brand', 'storefront', 'branded_vehicle', 'cta_graphic'].includes(kind),
    text: ['logo', 'product', 'brand', 'storefront', 'branded_vehicle', 'cta_graphic', 'last_frame'].includes(kind),
    brandColors: !['general', 'background_reference'].includes(kind),
  };
}

function sourceUrlFor(asset) {
  return asset?.originalUrl || asset?.sourceUrl || asset?.previewUrl || asset?.url || asset?.editedUrl || '';
}

function currentUrlFor(asset) {
  return asset?.editedUrl || asset?.url || asset?.previewUrl || asset?.sourceUrl || asset?.originalUrl || '';
}

export function createPersonalizationImageEditorSession(asset, {
  source = 'discovered',
  businessContext = {},
} = {}) {
  if (!asset?.id) throw new Error('Editor asset id is required.');
  const originalUrl = sourceUrlFor(asset);
  const currentUrl = currentUrlFor(asset);
  if (!originalUrl || !currentUrl) throw new Error('Editor asset image URL is required.');

  const kind = resolveEditorAssetKind(asset.sourceCategory || asset.category, asset.role || asset.assignedRole);
  const existingVersions = Array.isArray(asset.versions) && asset.versions.length
    ? asset.versions.map((version, index) => cleanVersion(version, index, originalUrl))
    : [cleanVersion(null, 0, originalUrl)];

  if (
    currentUrl !== originalUrl &&
    !existingVersions.some((version) => version.dataUrl === currentUrl)
  ) {
    existingVersions.push(cleanVersion({
      id: `${asset.id}:current`,
      label: asset.videoReady ? 'Video Ready' : 'Current Edit',
      dataUrl: currentUrl,
      operation: asset.editMetadata?.operation || 'existing_edit',
      prompt: asset.editMetadata?.prompt || '',
      model: asset.editMetadata?.model || 'unknown',
      transparent: Boolean(asset.hasTransparency),
      videoReady: Boolean(asset.videoReady),
      visionValidation: asset.visionValidation || null,
    }, existingVersions.length, currentUrl));
  }

  return {
    assetId: asset.id,
    source,
    name: asset.name || asset.altText || asset.category || 'Business Asset',
    originalUrl,
    category: asset.sourceCategory || asset.category || 'general',
    role: asset.role || asset.assignedRole || null,
    kind,
    businessContext: { ...businessContext },
    visionAnalysis: asset.visionAnalysis || null,
    versions: existingVersions,
    versionIndex: existingVersions.length - 1,
    mode: 'simple',
    activeGroup: 'smart',
    panelTab: 'tools',
    recast: createRecastState(),
    compareMode: false,
    safeArea: false,
    maskMode: false,
    maskB64: null,
    maskPreparedUrl: null,
    smartPrompt: '',
    streamingPreview: null,
    busyLabel: '',
    error: '',
    status: '',
    modelMode: 'auto',
    aspectRatio: 'original',
    outputFormat: 'png',
    outputCompression: 90,
    protections: defaultProtections(kind),
    localControls: { ...DEFAULT_LOCAL_IMAGE_CONTROLS },
    validationOverrideVersionId: null,
  };
}

export function currentEditorVersion(session) {
  if (!session?.versions?.length) return null;
  const requested = Number(session.versionIndex);
  const safeIndex = Number.isFinite(requested)
    ? Math.max(0, Math.min(session.versions.length - 1, requested))
    : 0;
  if (session.versionIndex !== safeIndex) session.versionIndex = safeIndex;
  return session.versions[safeIndex] || session.versions[0] || null;
}

export function appendEditorVersion(session, version) {
  if (!session) throw new Error('Editor session is required.');
  const truncated = session.versions.slice(0, session.versionIndex + 1);
  const next = cleanVersion({
    ...version,
    id: version?.id || `${session.assetId}:v${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: version?.label || 'Edit',
  }, truncated.length, version?.dataUrl || '');
  session.versions = [...truncated, next];
  session.versionIndex = session.versions.length - 1;
  session.validationOverrideVersionId = null;
  session.streamingPreview = null;
  session.error = '';
  return next;
}

export function setEditorVersionIndex(session, index) {
  if (!session?.versions?.length) return;
  session.versionIndex = Math.max(0, Math.min(session.versions.length - 1, Number(index) || 0));
  session.validationOverrideVersionId = null;
}

export function editorProtectionList(session) {
  const labels = {
    subject: 'Subject',
    face: 'Face / Identity',
    product: 'Product',
    logo: 'Logo',
    text: 'Text',
    brandColors: 'Brand Colors',
  };
  return Object.entries(session?.protections || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => labels[key])
    .filter(Boolean);
}

export function editorPreserveList(session) {
  const recipe = getAssetRecipe(session?.category, session?.role);
  return Array.from(new Set([
    ...(recipe?.preserve || []),
    ...(session?.visionAnalysis?.preserve || []),
    ...editorProtectionList(session),
  ]));
}

function renderMediaStage(session) {
  const current = currentEditorVersion(session);
  const src = session.streamingPreview || current?.dataUrl || session.originalUrl;
  const safeArea = session.safeArea ? `
    <div class="pm-editor-safe-area" aria-hidden="true">
      <div class="pm-editor-safe-v"></div>
      <div class="pm-editor-safe-h"></div>
    </div>` : '';

  if (session.compareMode && session.versionIndex > 0) {
    return `
      <div class="pm-editor-compare">
        <figure><img src="${escapeHtml(session.originalUrl)}" alt="Original asset" /><figcaption>Original</figcaption></figure>
        <figure><img src="${escapeHtml(src)}" alt="Edited asset" /><figcaption>Edited</figcaption></figure>
      </div>
    `;
  }

  return `
    <div class="pm-editor-stage">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(session.name)}" data-editor-preview />
      ${safeArea}
      ${session.busyLabel ? `<div class="pm-editor-busy"><span class="pm-spinner"></span>${escapeHtml(session.busyLabel)}</div>` : ''}
      ${session.streamingPreview ? '<div class="pm-editor-progressive">Progressive preview</div>' : ''}
    </div>
  `;
}

function renderVersions(session) {
  if (!session.versions.length) return '';
  return `
    <div class="pm-editor-versions" aria-label="Image edit versions">
      ${session.versions.map((version, index) => `
        <button
          type="button"
          class="pm-editor-version ${index === session.versionIndex ? 'active' : ''}"
          data-editor-version="${index}"
          title="${escapeHtml(version.label)}"
        >
          <img src="${escapeHtml(version.dataUrl)}" alt="" />
          <span>${escapeHtml(version.label)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderQuickActions(session) {
  const recipe = getAssetRecipe(session.category, session.role);
  const ids = (
    session.visionAnalysis?.recommendedOperations?.length
      ? session.visionAnalysis.recommendedOperations
      : recipe?.recommended || []
  )
    .filter((id) => IMAGE_EDIT_OPERATIONS[id])
    .filter((id) => {
      const op = getOperation(id);
      return !op.applicableTo || op.applicableTo.includes(session.kind);
    })
    .slice(0, 6);

  return ids.map((id) => {
    const operation = getOperation(id);
    return `
      <button type="button" class="pm-small-btn" data-editor-operation="${id}" ${session.busyLabel ? 'disabled' : ''}>
        ✦ ${escapeHtml(operation.label)}
      </button>
    `;
  }).join('');
}

function renderVisionRecommendation(session) {
  const recipe = getAssetRecipe(session.category, session.role);
  const vision = session.visionAnalysis;
  const summary = vision?.summary || recipe?.description || 'Prepare this asset for its SmartVideo AI video role.';
  const target = vision?.targetRole || recipe?.outputRole || 'Video Asset';
  const issues = vision?.issues?.length
    ? `<div class="pm-editor-issue-row">${vision.issues.slice(0, 5).map((issue) => `<span>${escapeHtml(issue)}</span>`).join('')}</div>`
    : '';

  return `
    <div class="pm-editor-recommendation">
      <div>
        <strong>✦ SmartVideo AI recommends</strong>
        <p>${escapeHtml(summary)} <b>Target:</b> ${escapeHtml(target)}.</p>
        ${issues}
      </div>
      <div class="pm-asset-actions">
        <button type="button" class="pm-small-btn" data-editor-action="analyze" ${session.busyLabel ? 'disabled' : ''}>
          ${vision ? 'Re-analyze Vision' : 'Analyze with Vision'}
        </button>
        <button type="button" class="pm-btn pm-btn-primary" data-editor-action="video-ready" ${session.busyLabel ? 'disabled' : ''}>✦ Make Video Ready</button>
      </div>
    </div>
  `;
}

function renderSimple(session) {
  const current = currentEditorVersion(session);
  return `
    <div class="pm-editor-simple">
      ${renderMediaStage(session)}
      <div class="pm-editor-meta">
        <span class="pm-preview-pill pm-preview-pill-muted">${escapeHtml(getAssetRecipe(session.category, session.role)?.label || session.kind)}</span>
        <span>•</span><span>${escapeHtml(getAssetRecipe(session.category, session.role)?.outputRole || 'Video Asset')}</span>
        ${current?.transparent ? '<span>•</span><span>Transparent</span>' : ''}
        ${current?.videoReady ? '<span>•</span><span class="pm-editor-good">Video Ready</span>' : ''}
      </div>

      ${renderVisionRecommendation(session)}

      <div class="pm-editor-quick-actions">
        ${renderQuickActions(session)}
        ${supportsFullBodyRecast(session) ? `<button type="button" class="pm-small-btn pm-editor-recast-cta" data-editor-action="recast-open" ${session.busyLabel ? 'disabled' : ''}>⇄ Full Body Recast</button>` : ''}
      </div>

      <div class="pm-editor-smart">
        <label for="pm-editor-smart-prompt">Ask SmartVideo AI</label>
        <div class="pm-editor-smart-row">
          <textarea id="pm-editor-smart-prompt" data-editor-smart-prompt rows="3" placeholder="Example: Remove the truck behind the contractor, but keep the contractor exactly the same.">${escapeHtml(session.smartPrompt)}</textarea>
          <button type="button" class="pm-btn pm-btn-primary" data-editor-action="smart-edit" ${!session.smartPrompt.trim() || session.busyLabel ? 'disabled' : ''}>✦ Smart Edit</button>
        </div>
      </div>

      ${renderVersions(session)}

      ${current?.revisedPrompt ? `<div class="pm-editor-note"><b>AI revised prompt:</b> ${escapeHtml(current.revisedPrompt)}</div>` : ''}
      ${current?.visionValidation ? `<div class="pm-editor-note"><b>Vision QA:</b> ${current.visionValidation.passed ? 'Passed' : 'Review needed'} · ${escapeHtml(current.visionValidation.summary || '')}</div>` : ''}
      ${session.error ? `<div class="pm-error" role="alert">${escapeHtml(session.error)}</div>` : ''}
      ${session.status ? `<div class="pm-editor-status">${escapeHtml(session.status)}</div>` : ''}

      <div class="pm-editor-footer">
        <div class="pm-asset-actions">
          ${session.versionIndex > 0 ? `<button type="button" class="pm-small-btn" data-editor-action="compare">${session.compareMode ? 'Single View' : 'Compare'}</button>` : ''}
          <button type="button" class="pm-small-btn ${session.safeArea ? 'active' : ''}" data-editor-action="safe-area">Safe Area</button>
          <button type="button" class="pm-small-btn" data-editor-action="advanced">Advanced Edit</button>
          ${session.versionIndex > 0 ? '<button type="button" class="pm-small-btn" data-editor-action="revert-original">Revert to Original</button>' : ''}
        </div>
        <div class="pm-asset-actions">
          <button type="button" class="pm-btn pm-btn-secondary" data-editor-action="close">Close Editor</button>
          <button type="button" class="pm-btn pm-btn-primary" data-editor-action="apply" ${session.versionIndex === 0 || session.busyLabel ? 'disabled' : ''}>
            ${current?.visionValidation && !current.visionValidation.passed && session.validationOverrideVersionId === current.id ? 'Use Anyway' : 'Use Edited Asset'}
          </button>
        </div>
      </div>
    </div>
  `;
}

const GROUP_ICONS = Object.freeze({
  smart: '✦',
  background: '▧',
  subject: '◎',
  people: '☺',
  product: '▣',
  brand: '◆',
  object: '◇',
  text: 'T',
  scene: '☀',
  video: '▶',
  effects: '✧',
  transform: '⤢',
});

const PANEL_TABS = Object.freeze([
  ['tools', 'AI Tools'],
  ['adjust', 'Adjust'],
  ['output', 'Output'],
]);

const PROTECTION_LABELS = Object.freeze([
  ['subject', 'Subject'],
  ['face', 'Face / Identity'],
  ['product', 'Product'],
  ['logo', 'Logo'],
  ['text', 'Text'],
  ['brandColors', 'Brand Colors'],
]);

export function supportsFullBodyRecast(session) {
  return ['person', 'team'].includes(session?.kind);
}

function renderToolRail(session) {
  const groups = Array.from(operationGroupsForAsset(session.kind).keys());
  const recastOpen = Boolean(session.recast?.open);
  const railButton = (attrs, icon, label, active) => `
    <button type="button" class="pm-editor-rail-btn ${active ? 'active' : ''}" ${attrs} title="${escapeHtml(label)}">
      <span class="pm-editor-rail-icon" aria-hidden="true">${escapeHtml(icon)}</span>
      <span class="pm-editor-rail-label">${escapeHtml(label)}</span>
    </button>
  `;
  return `
    <nav class="pm-editor-rail" aria-label="AI tool groups">
      ${supportsFullBodyRecast(session) ? railButton('data-editor-action="recast-open"', '⇄', 'Full Body', recastOpen) : ''}
      ${railButton('data-editor-action="mask"', '⌖', 'Mask', session.maskMode)}
      <span class="pm-editor-rail-sep" aria-hidden="true"></span>
      ${groups.map((group) => railButton(
        `data-editor-group="${escapeHtml(group)}"`,
        GROUP_ICONS[group] || '•',
        GROUP_LABELS[group] || group,
        !recastOpen && !session.maskMode && session.activeGroup === group,
      )).join('')}
    </nav>
  `;
}

function rangeControl(key, label, value, min, max, step = 1, suffix = '') {
  return `
    <label class="pm-editor-control">
      <span>${escapeHtml(label)} <b data-editor-local-value="${key}">${escapeHtml(value)}${suffix}</b></span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${escapeHtml(value)}" data-editor-local="${key}" data-editor-suffix="${escapeHtml(suffix)}" />
    </label>
  `;
}

function segmented(key, options, current) {
  return `
    <div class="pm-editor-segmented" role="group">
      ${options.map(([value, label]) => `
        <button type="button" class="${current === value ? 'active' : ''}" data-editor-segment="${escapeHtml(key)}" data-value="${escapeHtml(value)}" aria-pressed="${current === value ? 'true' : 'false'}">${escapeHtml(label)}</button>
      `).join('')}
    </div>
  `;
}

function renderToolsTab(session) {
  const grouped = operationGroupsForAsset(session.kind);
  const operations = grouped.get(session.activeGroup) || [];
  return `
    <div class="pm-editor-ask">
      <textarea id="pm-editor-smart-prompt" data-editor-smart-prompt rows="2" placeholder="Describe an edit… e.g. remove the truck behind the contractor">${escapeHtml(session.smartPrompt)}</textarea>
      <button type="button" class="pm-btn pm-btn-primary" data-editor-action="smart-edit" ${!session.smartPrompt.trim() || session.busyLabel ? 'disabled' : ''}>✦ Edit</button>
    </div>
    <div class="pm-editor-sidebar-title">${escapeHtml(GROUP_LABELS[session.activeGroup] || session.activeGroup)}</div>
    <div class="pm-editor-op-grid">
      ${operations.map((operation) => `
        <button type="button" class="pm-editor-op ${operation.video ? 'pm-editor-op-video' : ''}" data-editor-operation="${operation.id}" title="${escapeHtml(operation.description)}" ${session.busyLabel ? 'disabled' : ''}>
          ${escapeHtml(operation.label)}
        </button>
      `).join('') || '<div class="pm-editor-note">No AI tools in this group for this asset.</div>'}
    </div>
  `;
}

function renderAdjustTab(session) {
  const c = session.localControls;
  return `
    <div class="pm-editor-tab-scroll">
      <div class="pm-editor-button-grid">
        <button type="button" class="pm-small-btn" data-editor-local-action="rotate">Rotate 90°</button>
        <button type="button" class="pm-small-btn ${c.flipX ? 'active' : ''}" data-editor-local-action="flipX">Flip H</button>
        <button type="button" class="pm-small-btn ${c.flipY ? 'active' : ''}" data-editor-local-action="flipY">Flip V</button>
      </div>
      <label class="pm-editor-control"><span>Fit</span><select data-editor-local-select="fitMode"><option value="contain" ${c.fitMode === 'contain' ? 'selected' : ''}>Fit</option><option value="cover" ${c.fitMode === 'cover' ? 'selected' : ''}>Fill</option></select></label>
      ${rangeControl('zoom', 'Zoom', c.zoom, 10, 300, 1, '%')}
      ${rangeControl('brightness', 'Brightness', c.brightness, 0, 250, 1, '%')}
      ${rangeControl('contrast', 'Contrast', c.contrast, 0, 250, 1, '%')}
      ${rangeControl('saturation', 'Saturation', c.saturation, 0, 300, 1, '%')}
      <details class="pm-editor-details">
        <summary>More adjustments</summary>
        <div class="pm-editor-detail-body">
          ${rangeControl('opacity', 'Opacity', c.opacity, 0, 100, 1, '%')}
          ${rangeControl('blur', 'Blur', c.blur, 0, 30, 1, 'px')}
          ${rangeControl('grayscale', 'Grayscale', c.grayscale, 0, 100, 1, '%')}
          ${rangeControl('sepia', 'Sepia', c.sepia, 0, 100, 1, '%')}
          ${rangeControl('padding', 'Padding', c.padding, 0, 300, 1, 'px')}
          ${rangeControl('borderSize', 'Border', c.borderSize, 0, 50, 1, 'px')}
          ${rangeControl('shadow', 'Shadow', c.shadow, 0, 80, 1, 'px')}
          <label class="pm-editor-control"><span>Canvas Background</span><input type="text" value="${escapeHtml(c.backgroundColor)}" placeholder="transparent or #ffffff" data-editor-local-text="backgroundColor" /></label>
          <label class="pm-editor-control"><span>Text Overlay</span><input type="text" value="${escapeHtml(c.overlayText)}" data-editor-local-text="overlayText" /></label>
          ${rangeControl('textSize', 'Text Size', c.textSize, 12, 180, 1, 'px')}
          <label class="pm-editor-control"><span>Text Position</span><select data-editor-local-select="textPosition"><option value="top" ${c.textPosition === 'top' ? 'selected' : ''}>Top</option><option value="center" ${c.textPosition === 'center' ? 'selected' : ''}>Center</option><option value="bottom" ${c.textPosition === 'bottom' ? 'selected' : ''}>Bottom</option></select></label>
        </div>
      </details>
    </div>
    <div class="pm-editor-tab-footer">
      <button type="button" class="pm-btn pm-btn-primary" data-editor-action="apply-local" ${session.busyLabel ? 'disabled' : ''}>Apply Adjustments</button>
      <span>No AI credits used</span>
    </div>
  `;
}

function renderOutputTab(session) {
  return `
    <div class="pm-editor-control"><span>AI Mode</span>${segmented('modelMode', [['auto', 'Auto'], ['fast', 'Fast'], ['precision', 'Precise']], session.modelMode)}</div>
    <div class="pm-editor-control"><span>Aspect Ratio</span>${segmented('aspectRatio', ASPECTS.map((ratio) => [ratio, ratio === 'original' ? 'Orig' : ratio]), session.aspectRatio)}</div>
    <div class="pm-editor-control"><span>Format</span>${segmented('outputFormat', FORMATS.map((format) => [format, format.toUpperCase()]), session.outputFormat)}</div>
    <div class="pm-editor-control">
      <span>Protect during AI edits</span>
      <div class="pm-editor-chips">
        ${PROTECTION_LABELS.map(([key, label]) => `
          <label class="pm-editor-chip"><input type="checkbox" data-editor-protection="${key}" ${session.protections[key] ? 'checked' : ''}/><span>${label}</span></label>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPanelTabs(session) {
  const active = PANEL_TABS.some(([id]) => id === session.panelTab) ? session.panelTab : 'tools';
  const body = active === 'adjust'
    ? renderAdjustTab(session)
    : active === 'output'
      ? renderOutputTab(session)
      : renderToolsTab(session);
  return `
    <aside class="pm-editor-panel">
      <div class="pm-editor-tabs" role="tablist" aria-label="Editor panels">
        ${PANEL_TABS.map(([id, label]) => `
          <button type="button" role="tab" class="${active === id ? 'active' : ''}" aria-selected="${active === id ? 'true' : 'false'}" data-editor-tab="${id}">${label}</button>
        `).join('')}
      </div>
      <div class="pm-editor-tab-body pm-editor-tab-${active}" role="tabpanel">${body}</div>
    </aside>
  `;
}

export function recastSteps(recast = {}) {
  const has = (value) => Boolean(value);
  return [
    { id: 'upload', label: 'Upload clip', done: has(recast.sourceUrl), active: !recast.sourceUrl },
    { id: 'person', label: 'Choose person', done: true, active: false },
    { id: 'recast', label: 'Recast', done: has(recast.resultUrl), active: has(recast.sourceUrl) && !recast.resultUrl },
    // Saving is automatic: the background job stores the video when it's ready.
    { id: 'save', label: recast.saved ? 'Saved' : 'Auto-save', done: has(recast.saved), active: recast.status === 'saving' },
  ];
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function renderRecastStepper(recast) {
  return `
    <ol class="pm-recast-steps" aria-label="Recast steps">
      ${recastSteps(recast).map((step, index) => `
        <li class="${step.done ? 'done' : ''} ${step.active ? 'active' : ''}" ${step.active ? 'aria-current="step"' : ''}>
          <span class="pm-recast-step-num">${step.done && !step.active ? '✓' : index + 1}</span>
          <span class="pm-recast-step-label">${escapeHtml(step.label)}</span>
        </li>
      `).join('')}
    </ol>
  `;
}

function recastPanel(label, content) {
  return `
    <figure class="pm-recast-panel">
      <figcaption>${escapeHtml(label)}</figcaption>
      <div class="pm-recast-media">${content}</div>
    </figure>
  `;
}

export function renderRecastView(session) {
  const recast = session.recast || {};
  const current = currentEditorVersion(session);
  const busy = recast.status === 'uploading' || recast.status === 'generating' || recast.status === 'saving';
  const fileInput = '<input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" data-recast-file hidden />';

  const source = recast.sourcePreviewUrl
    ? `
      <video src="${escapeHtml(recast.sourcePreviewUrl)}" muted loop playsinline preload="metadata" data-recast-video="source"></video>
      ${recast.duration ? `<span class="pm-recast-chip">${Math.round(recast.duration)}s</span>` : ''}
      ${recast.status === 'uploading' ? `<div class="pm-recast-overlay"><span class="pm-spinner"></span>${escapeHtml(recast.statusLabel || 'Uploading…')}</div>` : ''}
      ${!busy ? `<label class="pm-recast-replace">${fileInput}Replace</label>` : ''}
    `
    : `
      <label class="pm-recast-drop" data-recast-drop>
        ${fileInput}
        <span class="pm-recast-drop-icon" aria-hidden="true">⬆</span>
        <strong>Upload a performance clip</strong>
        <span>One person, head to toe in view · MP4 or MOV · 4–30 s</span>
      </label>
    `;

  const characterId = recast.characterId || session.assetId;
  const selected = characterId === session.assetId
    ? { name: session.name, url: current?.dataUrl }
    : (recast.characters || []).find((c) => c.id === characterId) || {};
  const characters = recast.characters || [];
  const picker = characters.length > 1 ? `
    <div class="pm-recast-people" role="radiogroup" aria-label="Choose the person">
      ${characters.map((c) => `
        <button type="button" role="radio" class="pm-recast-person ${c.id === characterId ? 'active' : ''}" aria-checked="${c.id === characterId ? 'true' : 'false'}" data-recast-character="${escapeHtml(c.id)}" title="${escapeHtml(c.name || 'Person')}" ${busy ? 'disabled' : ''}>
          <img src="${escapeHtml(c.id === session.assetId ? (current?.dataUrl || c.url) : c.url)}" alt="${escapeHtml(c.name || 'Person')}" />
        </button>
      `).join('')}
    </div>
  ` : '';
  const character = selected.url
    ? `<img src="${escapeHtml(selected.url)}" alt="${escapeHtml(selected.name || 'Character reference')}" />${picker}`
    : '<div class="pm-recast-empty">No character image</div>';

  let result;
  if (recast.resultUrl) {
    result = `<video src="${escapeHtml(recast.resultUrl)}" muted loop playsinline autoplay preload="auto" data-recast-video="result"></video>`;
  } else if (recast.status === 'generating') {
    result = `
      <div class="pm-recast-overlay pm-recast-overlay-static">
        <span class="pm-spinner"></span>
        <span>${escapeHtml(recast.statusLabel || 'Recasting…')}</span>
        <span class="pm-recast-elapsed" data-recast-elapsed data-started-at="${Number(recast.startedAt) || 0}">${formatElapsed(recast.startedAt ? Date.now() - recast.startedAt : 0)}</span>
      </div>`;
  } else {
    result = `<div class="pm-recast-empty"><span aria-hidden="true">✦</span>${recast.sourceUrl ? 'Ready — click Recast' : 'Your recast appears here'}</div>`;
  }

  const canRun = Boolean(recast.sourceUrl) && !busy && Boolean(selected.url);
  return `
    <div class="pm-recast" data-recast-view>
      ${renderRecastStepper(recast)}
      <div class="pm-recast-grid">
        ${recastPanel('Source performance', source)}
        ${recastPanel(characters.length > 1 ? 'Character · tap to change' : 'Character image', character)}
        ${recastPanel('Recast result', result)}
      </div>
      <div class="pm-recast-controls">
        <input type="text" id="pm-recast-prompt" maxlength="1000" value="${escapeHtml(recast.prompt || '')}" placeholder="Optional direction, e.g. keep the hand gesture natural" data-recast-prompt ${busy ? 'disabled' : ''} />
        ${recast.status === 'generating'
          ? '<button type="button" class="pm-btn pm-btn-secondary" data-editor-action="recast-cancel">Cancel</button>'
          : `<button type="button" class="pm-btn pm-btn-primary" data-editor-action="recast-run" ${canRun ? '' : 'disabled'}>✦ ${recast.resultUrl ? 'Recast Again' : 'Recast Full Body'}</button>`}
      </div>
      <details class="pm-recast-tips">
        <summary>Tips for a great result</summary>
        <ul>
          <li>Use a clip with one person, head to toe in frame, and a steady camera.</li>
          <li>Pick a well-lit, front-facing photo of the new person; full-body photos work best.</li>
          <li>The clip's movement, camera and location are kept. The result is silent.</li>
          <li>Recasts usually take 2–5 minutes. Keep this editor open while it runs.</li>
        </ul>
      </details>
    </div>
  `;
}

function renderFooter(session) {
  const recast = session.recast || {};
  if (recast.open) {
    const running = recast.status === 'generating' || recast.status === 'saving';
    let message = '';
    if (recast.error) message = `<span class="pm-editor-footer-error" role="alert">${escapeHtml(recast.error)}</span>`;
    else if (recast.saved) message = '<span class="pm-editor-good">✓ Saved to Presenter Videos</span>';
    else if (running && recast.jobId) message = '<span>You can close this — the video saves to Presenter Videos when it’s ready.</span>';
    return `
      <div class="pm-editor-footer pm-editor-footer-sticky">
        <div class="pm-editor-footer-msg">${message}</div>
        <div class="pm-asset-actions">
          <button type="button" class="pm-btn pm-btn-secondary" data-editor-action="recast-close">← Back to Image</button>
          ${recast.canRetry ? '<button type="button" class="pm-btn pm-btn-primary" data-editor-action="recast-retry">↻ Retry</button>' : ''}
          ${recast.saved ? '<button type="button" class="pm-btn pm-btn-primary" data-editor-action="recast-another">＋ Recast Another</button>' : ''}
        </div>
      </div>
    `;
  }

  const current = currentEditorVersion(session);
  let message = '';
  if (session.error) message = `<span class="pm-editor-footer-error" role="alert">${escapeHtml(session.error)}</span>`;
  else if (session.maskMode) message = '<span>Paint the area to change, then pick an AI tool.</span>';
  else if (session.status) message = `<span class="pm-editor-good">${escapeHtml(session.status)}</span>`;
  return `
    <div class="pm-editor-footer pm-editor-footer-sticky">
      <div class="pm-editor-footer-msg">${message}</div>
      <div class="pm-asset-actions">
        <button type="button" class="pm-btn pm-btn-secondary" data-editor-action="close">Close Editor</button>
        <button type="button" class="pm-btn pm-btn-primary" data-editor-action="apply" ${session.versionIndex === 0 || session.busyLabel ? 'disabled' : ''}>
          ${current?.visionValidation && !current.visionValidation.passed && session.validationOverrideVersionId === current.id ? 'Use Anyway' : 'Use Edited Asset'}
        </button>
      </div>
    </div>
  `;
}

function renderAdvanced(session) {
  const recastOpen = Boolean(session.recast?.open);
  let canvas;
  if (recastOpen) {
    canvas = renderRecastView(session);
  } else if (session.maskMode) {
    canvas = '<div class="pm-editor-mask-host" data-editor-mask-host></div>';
  } else {
    canvas = `
      ${renderMediaStage(session)}
      <div class="pm-editor-float-bar">
        ${session.versionIndex > 0 ? `<button type="button" class="pm-small-btn ${session.compareMode ? 'active' : ''}" data-editor-action="compare">Compare</button>` : ''}
        <button type="button" class="pm-small-btn ${session.safeArea ? 'active' : ''}" data-editor-action="safe-area">Safe Area</button>
        ${session.versionIndex > 0 ? '<button type="button" class="pm-small-btn" data-editor-action="revert-original">Revert</button>' : ''}
      </div>
      ${session.versions.length > 1 ? renderVersions(session) : ''}
    `;
  }

  return `
    <div class="pm-editor-workspace ${recastOpen ? 'is-recast' : ''}">
      ${renderToolRail(session)}
      <main class="pm-editor-canvas">${canvas}</main>
      ${recastOpen ? '' : renderPanelTabs(session)}
    </div>
    ${renderFooter(session)}
  `;
}

export function renderPersonalizationImageEditorPanel(session) {
  if (!session) return '';
  const recipe = getAssetRecipe(session.category, session.role);
  return `
    <section class="pm-editor-shell pm-editor-shell-${session.mode === 'advanced' ? 'advanced' : 'simple'}" data-personalization-image-editor data-editor-asset-id="${escapeHtml(session.assetId)}">
      <header class="pm-editor-header">
        <div>
          <div class="pm-editor-title">✦ SmartVideo AI Image Editor</div>
          <div class="pm-editor-subtitle">${escapeHtml(session.name)} · ${escapeHtml(recipe?.label || session.kind)} · ${escapeHtml(recipe?.outputRole || 'Video Asset')}</div>
        </div>
        <div class="pm-asset-actions">
          ${session.versions.length > 1 ? `
            <button type="button" class="pm-small-btn" data-editor-action="undo" ${session.versionIndex === 0 ? 'disabled' : ''}>Undo</button>
            <button type="button" class="pm-small-btn" data-editor-action="redo" ${session.versionIndex >= session.versions.length - 1 ? 'disabled' : ''}>Redo</button>
          ` : ''}
          ${session.mode === 'advanced' ? '<button type="button" class="pm-small-btn" data-editor-action="simple">← Simple Mode</button>' : ''}
          <button type="button" class="pm-small-btn" data-editor-action="close" aria-label="Close image editor">Close</button>
        </div>
      </header>
      ${session.mode === 'advanced' ? renderAdvanced(session) : renderSimple(session)}
    </section>
  `;
}

export function getEditorOperationForSession(session, operationId) {
  const operation = getOperation(operationId);
  if (!operation) return null;
  const allowed = getOperationsForAsset(session.kind).some((candidate) => candidate.id === operationId);
  return allowed ? operation : null;
}
