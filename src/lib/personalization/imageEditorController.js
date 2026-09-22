import {
  PersonalizationImageEditorService,
  preparePersonalizationImageDataUrl,
} from './imageEditorService.js';
import {
  appendEditorVersion,
  createPersonalizationImageEditorSession,
  currentEditorVersion,
  editorPreserveList,
  getEditorOperationForSession,
  setEditorVersionIndex,
} from './imageEditorPanel.js';
import { applyLocalImageAdjustments } from './localImageEditor.js';
import { mountPersonalizationMaskEditor } from './maskEditor.js';
import {
  analyzePersonalizationImages,
  validatePersonalizationImageEdit,
} from './visionService.js';
import { makePersonalizationAssetVideoReady } from './videoReady.js';
import { persistPersonalizationAssetVersion } from './assetDiscoveryService.js';

function isDataImage(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function modelControls(session) {
  if (session.modelMode === 'precision') {
    return { quality: 'high', inputFidelity: 'high' };
  }
  if (session.modelMode === 'fast') {
    return { quality: 'medium' };
  }
  return {};
}

function businessContextForSession(session) {
  return {
    ...(session.businessContext || {}),
    preserve: editorPreserveList(session),
  };
}

export class PersonalizationImageEditorController {
  constructor({
    onChange = () => {},
    onPreview = () => {},
  } = {}) {
    this.session = null;
    this.service = new PersonalizationImageEditorService();
    this.maskController = null;
    this.onChange = onChange;
    this.onPreview = onPreview;
  }

  _change(render = true) {
    this.onChange?.(this.session, { render });
  }

  open(asset, options = {}) {
    this.destroyMask();
    this.session = createPersonalizationImageEditorSession(asset, options);
    this._change(true);
    return this.session;
  }

  close() {
    this.destroyMask();
    this.session = null;
    this._change(true);
  }

  destroyMask() {
    try { this.maskController?.destroy?.(); } catch {}
    this.maskController = null;
  }

  currentVersion() {
    return currentEditorVersion(this.session);
  }

  setMode(mode) {
    if (!this.session) return;
    this.session.mode = mode === 'advanced' ? 'advanced' : 'simple';
    if (this.session.mode === 'simple') {
      this.session.maskMode = false;
      this.destroyMask();
    }
    this._change(true);
  }

  setGroup(group) {
    if (!this.session || !group) return;
    this.session.activeGroup = group;
    this._change(true);
  }

  setSmartPrompt(value) {
    if (!this.session) return;
    this.session.smartPrompt = String(value || '');
  }

  setSetting(key, value) {
    if (!this.session) return;
    if (key === 'modelMode' && ['auto', 'fast', 'precision'].includes(value)) this.session.modelMode = value;
    if (key === 'aspectRatio' && ['original', '9:16', '16:9', '1:1', '4:5'].includes(value)) {
      this.session.aspectRatio = value;
      this.session.localControls.aspectRatio = value;
    }
    if (key === 'outputFormat' && ['png', 'webp', 'jpeg'].includes(value)) {
      this.session.outputFormat = value;
      this.session.localControls.outputFormat = value;
    }
  }

  setProtection(key, enabled) {
    if (!this.session || !(key in this.session.protections)) return;
    this.session.protections[key] = Boolean(enabled);
  }

  setLocalControl(key, value) {
    if (!this.session || !(key in this.session.localControls)) return;
    const booleanKeys = new Set(['flipX', 'flipY']);
    this.session.localControls[key] = booleanKeys.has(key) ? Boolean(value) : value;
  }

  toggleCompare() {
    if (!this.session) return;
    this.session.compareMode = !this.session.compareMode;
    this._change(true);
  }

  toggleSafeArea() {
    if (!this.session) return;
    this.session.safeArea = !this.session.safeArea;
    this._change(true);
  }

  undo() {
    if (!this.session) return;
    setEditorVersionIndex(this.session, this.session.versionIndex - 1);
    this._change(true);
  }

  redo() {
    if (!this.session) return;
    setEditorVersionIndex(this.session, this.session.versionIndex + 1);
    this._change(true);
  }

  revertOriginal() {
    if (!this.session) return;
    setEditorVersionIndex(this.session, 0);
    this.session.compareMode = false;
    this._change(true);
  }

  chooseVersion(index) {
    if (!this.session) return;
    setEditorVersionIndex(this.session, index);
    this._change(true);
  }

  async analyze() {
    const session = this.session;
    const current = this.currentVersion();
    if (!session || !current?.dataUrl) return;

    session.busyLabel = 'Analyzing asset with SmartVideo AI Vision…';
    session.error = '';
    this._change(true);
    try {
      const analyses = await analyzePersonalizationImages({
        images: [{
          id: session.assetId,
          imageUrl: current.dataUrl,
          categoryHint: session.category,
          roleHint: session.role,
        }],
        businessContext: session.businessContext,
      });
      const analysis = analyses[0];
      if (!analysis) throw new Error('Vision returned no analysis.');
      session.visionAnalysis = analysis;
      if (analysis.confidence >= 75) session.category = analysis.category;
      session.status = '✓ Vision analysis complete';
    } catch (error) {
      session.error = error?.message || 'Vision analysis failed.';
    } finally {
      session.busyLabel = '';
      this._change(true);
    }
  }

  async runOperation(operationId) {
    const session = this.session;
    const current = this.currentVersion();
    if (!session || !current?.dataUrl) return;
    const operation = getEditorOperationForSession(session, operationId);
    if (!operation) {
      session.error = 'That edit is not available for this asset type.';
      this._change(true);
      return;
    }

    session.busyLabel = `Running ${operation.label}…`;
    session.error = '';
    this._change(true);

    try {
      let imageUrl = current.dataUrl;
      let maskB64 = null;
      if (session.maskMode && session.maskB64) {
        imageUrl = await preparePersonalizationImageDataUrl(imageUrl);
        maskB64 = session.maskB64;
      }

      const result = await this.service.edit({
        imageUrl,
        operationId,
        category: session.category,
        role: session.role,
        visionAnalysis: session.visionAnalysis,
        businessContext: businessContextForSession(session),
        maskB64,
        outputFormat: session.outputFormat,
        ...modelControls(session),
      });

      if (!result?.imageDataUrl) throw new Error('Image edit returned no image.');
      appendEditorVersion(session, {
        label: operation.label,
        dataUrl: result.imageDataUrl,
        operation: operation.id,
        prompt: operation.prompt,
        model: result.modelUsed || 'openai-image',
        transparent: Boolean(operation.transparency),
        responseId: result.responseId,
        revisedPrompt: result.revisedPrompt,
      });
      session.maskMode = false;
      session.maskB64 = null;
      session.maskPreparedUrl = null;
      this.destroyMask();
      session.status = `✓ ${operation.label} complete`;
    } catch (error) {
      session.error = error?.message || `${operation.label} failed.`;
    } finally {
      session.busyLabel = '';
      this._change(true);
    }
  }

  async smartEdit() {
    const session = this.session;
    const current = this.currentVersion();
    if (!session || !current?.dataUrl || !session.smartPrompt.trim()) return;

    session.busyLabel = 'SmartVideo AI is editing…';
    session.error = '';
    session.streamingPreview = null;
    this._change(true);

    try {
      const result = await this.service.smartEditStream({
        imageUrl: current.dataUrl,
        prompt: session.smartPrompt,
        previousResponseId: current.responseId || '',
        category: session.category,
        role: session.role,
        visionAnalysis: session.visionAnalysis,
        businessContext: businessContextForSession(session),
        outputFormat: session.outputFormat,
        partialImages: 2,
        ...modelControls(session),
      }, {
        onPartial: (dataUrl) => {
          if (!this.session || this.session !== session) return;
          session.streamingPreview = dataUrl;
          this.onPreview?.(dataUrl);
        },
      });

      if (!result?.imageDataUrl) throw new Error('Smart Edit returned no image.');
      appendEditorVersion(session, {
        label: 'Smart Edit',
        dataUrl: result.imageDataUrl,
        operation: 'custom',
        prompt: session.smartPrompt,
        model: result.modelUsed || 'openai-responses',
        responseId: result.responseId,
        revisedPrompt: result.revisedPrompt,
      });
      session.smartPrompt = '';
      session.status = '✓ Smart Edit complete';
    } catch (error) {
      session.error = error?.message || 'Smart Edit failed.';
    } finally {
      session.streamingPreview = null;
      session.busyLabel = '';
      this._change(true);
    }
  }

  async makeVideoReady() {
    const session = this.session;
    const current = this.currentVersion();
    if (!session || !current?.dataUrl) return;

    session.error = '';
    session.busyLabel = 'Preparing Video Ready workflow…';
    this._change(true);

    const asset = {
      id: session.assetId,
      url: current.dataUrl,
      originalUrl: session.originalUrl,
      sourceCategory: session.category,
      role: session.role,
      visionAnalysis: session.visionAnalysis,
    };

    try {
      const result = await makePersonalizationAssetVideoReady(asset, {
        businessContext: businessContextForSession(session),
        targetVideoFormat: session.aspectRatio === 'original' ? '' : session.aspectRatio,
        editorService: this.service,
        onStep: (step) => {
          if (!this.session || this.session !== session) return;
          session.busyLabel = step.label || 'Making Video Ready…';
          this._change(false);
        },
      });

      appendEditorVersion(session, {
        label: 'Video Ready',
        dataUrl: result.url,
        operation: 'video_ready',
        prompt: result.editMetadata?.prompt || 'Make Video Ready',
        model: result.editMetadata?.model || 'openai-image',
        transparent: Boolean(result.hasTransparency),
        videoReady: true,
        visionValidation: result.visionValidation || null,
      });
      session.visionAnalysis = result.visionAnalysis || session.visionAnalysis;
      session.status = '✓ Asset is Video Ready';
    } catch (error) {
      if (error?.code === 'VISION_QA_REVIEW_REQUIRED' && error.editedImageUrl) {
        const version = appendEditorVersion(session, {
          label: 'Video Ready — Review',
          dataUrl: error.editedImageUrl,
          operation: 'video_ready',
          prompt: 'Make Video Ready',
          model: 'openai-image',
          videoReady: false,
          visionValidation: error.validation || null,
        });
        session.validationOverrideVersionId = null;
        session.error = `Vision QA needs review before using ${version.label}: ${error.validation?.summary || error.message}`;
      } else {
        session.error = error?.message || 'Make Video Ready failed.';
      }
    } finally {
      session.busyLabel = '';
      this._change(true);
    }
  }

  async applyLocal() {
    const session = this.session;
    const current = this.currentVersion();
    if (!session || !current?.dataUrl) return;

    session.busyLabel = 'Applying local edit…';
    session.error = '';
    this._change(true);
    try {
      const sourceDataUrl = await preparePersonalizationImageDataUrl(current.dataUrl);
      const result = await applyLocalImageAdjustments(sourceDataUrl, {
        ...session.localControls,
        aspectRatio: session.aspectRatio,
        outputFormat: session.outputFormat,
      });
      appendEditorVersion(session, {
        label: 'Local Edit',
        dataUrl: result.dataUrl,
        operation: 'local_adjustments',
        prompt: '',
        model: 'local-canvas',
        transparent: result.transparent,
      });
      session.status = '✓ Local edit applied without AI credits';
    } catch (error) {
      session.error = error?.message || 'Local edit failed.';
    } finally {
      session.busyLabel = '';
      this._change(true);
    }
  }

  async toggleMask() {
    const session = this.session;
    const current = this.currentVersion();
    if (!session || !current?.dataUrl) return;

    if (session.maskMode) {
      session.maskMode = false;
      session.maskB64 = null;
      session.maskPreparedUrl = null;
      this.destroyMask();
      this._change(true);
      return;
    }

    session.busyLabel = 'Preparing image for regional editing…';
    session.error = '';
    this._change(true);
    try {
      session.maskPreparedUrl = await preparePersonalizationImageDataUrl(current.dataUrl);
      session.maskB64 = null;
      session.maskMode = true;
      session.mode = 'advanced';
    } catch (error) {
      session.error = error?.message || 'Could not prepare image for masking.';
    } finally {
      session.busyLabel = '';
      this._change(true);
    }
  }

  mountMask(container) {
    const session = this.session;
    if (!session?.maskMode || !session.maskPreparedUrl || !container) return;
    this.destroyMask();
    this.maskController = mountPersonalizationMaskEditor(container, {
      imageUrl: session.maskPreparedUrl,
      initialMaskB64: session.maskB64 || '',
      onMaskChange: (maskB64) => {
        if (this.session === session) session.maskB64 = maskB64;
      },
    });
  }

  async validateCurrent() {
    const session = this.session;
    const current = this.currentVersion();
    if (!session || !current || session.versionIndex === 0) return { ok: false, reason: 'no-edit' };

    if (current.model === 'local-canvas') return { ok: true };
    if (current.visionValidation?.passed) return { ok: true, validation: current.visionValidation };

    if (current.visionValidation && !current.visionValidation.passed) {
      if (session.validationOverrideVersionId === current.id) return { ok: true, overridden: true };
      session.validationOverrideVersionId = current.id;
      session.error = `Vision QA needs review: ${current.visionValidation.summary || current.visionValidation.issues?.join(' • ') || 'preservation issue detected'}. Click Use Anyway to override.`;
      this._change(true);
      return { ok: false, validation: current.visionValidation };
    }

    session.busyLabel = 'Running final Vision QA…';
    session.error = '';
    this._change(true);
    try {
      const validation = await validatePersonalizationImageEdit({
        originalImageUrl: session.originalUrl,
        editedImageUrl: current.dataUrl,
        preserve: editorPreserveList(session),
        intendedOperation: current.operation || 'image edit',
        businessContext: session.businessContext,
      });
      current.visionValidation = validation;
      if (!validation.passed) {
        session.validationOverrideVersionId = current.id;
        session.error = `Vision QA needs review: ${validation.summary || validation.issues?.join(' • ') || 'preservation issue detected'}. Click Use Anyway to override.`;
        return { ok: false, validation };
      }
      session.status = '✓ Vision QA passed';
      return { ok: true, validation };
    } catch (error) {
      session.error = error?.message || 'Vision QA failed.';
      return { ok: false, error };
    } finally {
      session.busyLabel = '';
      this._change(true);
    }
  }

  async persistVersions() {
    const session = this.session;
    if (!session?.role) throw new Error('Choose a destination role before saving edited versions.');

    const persisted = [];
    for (let index = 0; index < session.versions.length; index += 1) {
      const version = session.versions[index];
      if (!isDataImage(version.dataUrl)) {
        persisted.push({ ...version });
        continue;
      }
      session.busyLabel = `Saving ${version.label}…`;
      this._change(false);
      const stored = await persistPersonalizationAssetVersion({
        sourceUrl: version.dataUrl,
        role: session.role,
        name: `${session.name} — ${version.label}`,
      });
      persisted.push({
        ...version,
        dataUrl: stored.url,
        storagePath: stored.storagePath || null,
        mimeType: stored.mimeType || null,
      });
    }
    session.versions = persisted;
    session.versionIndex = Math.min(session.versionIndex, persisted.length - 1);
    session.busyLabel = '';
    return session;
  }
}
