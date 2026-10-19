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

      <div class="pm-editor-quick-actions">${renderQuickActions(session)}</div>

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

function renderOperationSidebar(session) {
  const groups = Array.from(operationGroupsForAsset(session.kind).keys());
  return `
    <aside class="pm-editor-tool-sidebar">
      <button type="button" class="pm-small-btn" data-editor-action="simple">← Simple Mode</button>
      <div class="pm-editor-sidebar-title">AI Tools</div>
      ${groups.map((group) => `
        <button type="button" class="pm-editor-group ${session.activeGroup === group ? 'active' : ''}" data-editor-group="${group}">
          ${escapeHtml(GROUP_LABELS[group] || group)}
        </button>
      `).join('')}
      <div class="pm-editor-sidebar-separator"></div>
      <button type="button" class="pm-editor-group ${session.maskMode ? 'active' : ''}" data-editor-action="mask">Select / Mask Area</button>
    </aside>
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

function renderLocalControls(session) {
  const c = session.localControls;
  return `
    <details class="pm-editor-details" open>
      <summary>Output & AI</summary>
      <div class="pm-editor-detail-body">
        <label class="pm-editor-control">
          <span>AI Mode</span>
          <select data-editor-setting="modelMode">
            ${['auto','fast','precision'].map((mode) => `<option value="${mode}" ${session.modelMode === mode ? 'selected' : ''}>${mode}</option>`).join('')}
          </select>
        </label>
        <label class="pm-editor-control">
          <span>Aspect Ratio</span>
          <select data-editor-setting="aspectRatio">
            ${ASPECTS.map((ratio) => `<option value="${ratio}" ${session.aspectRatio === ratio ? 'selected' : ''}>${ratio}</option>`).join('')}
          </select>
        </label>
        <label class="pm-editor-control">
          <span>Format</span>
          <select data-editor-setting="outputFormat">
            ${FORMATS.map((format) => `<option value="${format}" ${session.outputFormat === format ? 'selected' : ''}>${format}</option>`).join('')}
          </select>
        </label>
      </div>
    </details>

    <details class="pm-editor-details">
      <summary>Local Canvas Tools</summary>
      <div class="pm-editor-detail-body">
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
        <button type="button" class="pm-btn pm-btn-primary" data-editor-action="apply-local">Apply Local Edit</button>
      </div>
    </details>

    <details class="pm-editor-details">
      <summary>Protect</summary>
      <div class="pm-editor-detail-body pm-editor-protections">
        ${[
          ['subject','Subject'],
          ['face','Face / Identity'],
          ['product','Product'],
          ['logo','Logo'],
          ['text','Text'],
          ['brandColors','Brand Colors'],
        ].map(([key,label]) => `
          <label><input type="checkbox" data-editor-protection="${key}" ${session.protections[key] ? 'checked' : ''}/> ${label}</label>
        `).join('')}
      </div>
    </details>
  `;
}

function renderAdvanced(session) {
  const grouped = operationGroupsForAsset(session.kind);
  const operations = grouped.get(session.activeGroup) || [];
  return `
    <div class="pm-editor-advanced">
      ${renderOperationSidebar(session)}
      <main class="pm-editor-advanced-stage">
        ${session.maskMode ? '<div class="pm-editor-mask-host" data-editor-mask-host></div>' : renderMediaStage(session)}
        ${session.maskMode ? '<div class="pm-editor-note">Paint/select the area to change, then choose an AI operation from the right. The selection remains local until you run an edit.</div>' : renderVersions(session)}
        ${session.error ? `<div class="pm-error" role="alert">${escapeHtml(session.error)}</div>` : ''}
      </main>
      <aside class="pm-editor-right-panel">
        <div class="pm-editor-sidebar-title">${escapeHtml(GROUP_LABELS[session.activeGroup] || session.activeGroup)} AI Tools</div>
        <div class="pm-editor-operation-list">
          ${operations.map((operation) => `
            <button type="button" class="pm-editor-operation" data-editor-operation="${operation.id}" ${session.busyLabel ? 'disabled' : ''}>
              <strong>${escapeHtml(operation.label)}</strong>
              <span>${escapeHtml(operation.description)}</span>
            </button>
          `).join('')}
        </div>
        ${renderLocalControls(session)}
      </aside>
    </div>
    <div class="pm-editor-footer">
      <div class="pm-asset-actions">
        <button type="button" class="pm-small-btn ${session.safeArea ? 'active' : ''}" data-editor-action="safe-area">Safe Area</button>
        ${session.versionIndex > 0 ? '<button type="button" class="pm-small-btn" data-editor-action="compare">Compare</button>' : ''}
      </div>
      <div class="pm-asset-actions">
        <button type="button" class="pm-btn pm-btn-secondary" data-editor-action="close">Close Editor</button>
        <button type="button" class="pm-btn pm-btn-primary" data-editor-action="apply" ${session.versionIndex === 0 || session.busyLabel ? 'disabled' : ''}>Use Edited Asset</button>
      </div>
    </div>
  `;
}

export function renderPersonalizationImageEditorPanel(session) {
  if (!session) return '';
  const recipe = getAssetRecipe(session.category, session.role);
  return `
    <section class="pm-editor-shell" data-personalization-image-editor data-editor-asset-id="${escapeHtml(session.assetId)}">
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
