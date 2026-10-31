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
import {
  readVideoDuration,
  resolveRecastCharacterUrl,
  uploadRecastSource,
  validateRecastDuration,
  validateRecastSourceFile,
} from './fullBodyRecast.js';
import {
  cancelRecastJob,
  getRecastJobs,
  isRecastJobActive,
  retryRecastJob,
  startRecastJob,
  subscribeRecastJobs,
} from './recastJobs.js';

const RECASTING_LABEL = 'Recasting the performer… usually 2–5 minutes.';
// Re-opening a person's recast shows a job that finished within this window.
const RECENT_RECAST_MS = 60 * 60 * 1000;

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

function openAIImageSizeForAspectRatio(aspectRatio) {
  switch (aspectRatio) {
    case '9:16': return '1024x1536';
    case '1:1': return '1024x1024';
    case '4:5': return '1024x1280';
    case '16:9': return '1536x1024';
    default: return 'auto';
  }
}

function aiEditControls(session) {
  return {
    ...modelControls(session),
    size: openAIImageSizeForAspectRatio(session.aspectRatio),
    outputFormat: session.outputFormat,
    outputCompression: typeof session.outputCompression === 'number' ? session.outputCompression : 90,
  };
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
    this.contactId = null;
    this._recastUnsubscribe = null;
    this._recastPreparing = null;
  }

  _change(render = true) {
    this.onChange?.(this.session, { render });
  }

  open(asset, options = {}) {
    this.destroyMask();
    this._detachRecastJob();
    this.contactId = options.contactId || null;
    this.session = createPersonalizationImageEditorSession(asset, options);
    this._change(true);
    return this.session;
  }

  close() {
    this.destroyMask();
    // Recasts are background jobs: closing the editor only stops watching.
    this._detachRecastJob();
    if (this._recastPreparing) this._recastPreparing.cancelled = true;
    this._revokeRecastPreview();
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

  setPanelTab(tab) {
    if (!this.session || !['tools', 'adjust', 'output'].includes(tab)) return;
    this.session.panelTab = tab;
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
      this.service.aspectRatio = value === 'original' ? '16:9' : value;
      // ThumbnailService exposes aspectRatio as a getter over its options.
      if (this.service.thumbnailService?.options) {
        this.service.thumbnailService.options.aspectRatio = this.service.aspectRatio;
      }
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
    // Full Body Recast produces a video, so it opens its own workflow instead
    // of running an image edit.
    if (operation.video) {
      this.openRecast();
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

      const controls = aiEditControls(session);
      const result = await this.service.edit({
        imageUrl,
        operationId,
        category: session.category,
        role: session.role,
        visionAnalysis: session.visionAnalysis,
        businessContext: businessContextForSession(session),
        maskB64,
        ...controls,
      });

      if (!result?.imageDataUrl) throw new Error('Image edit returned no image.');
      appendEditorVersion(session, {
        label: operation.label,
        dataUrl: result.imageDataUrl,
        operation: operation.id,
        prompt: operation.prompt,
        model: result.modelUsed || 'openai-image',
        quality: controls.quality || 'medium',
        transparent: Boolean(operation.transparency),
        responseId: result.responseId,
        imageGenerationCallId: result.imageGenerationCallId,
        revisedPrompt: result.revisedPrompt,
        outputFormat: controls.outputFormat,
        outputCompression: controls.outputCompression,
        inputFidelity: controls.inputFidelity || null,
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
      const controls = aiEditControls(session);
      const result = await this.service.smartEditStream({
        imageUrl: current.dataUrl,
        prompt: session.smartPrompt,
        previousResponseId: current.responseId || '',
        category: session.category,
        role: session.role,
        visionAnalysis: session.visionAnalysis,
        businessContext: businessContextForSession(session),
        partialImages: 2,
        ...controls,
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
        quality: controls.quality || 'medium',
        responseId: result.responseId,
        imageGenerationCallId: result.imageGenerationCallId,
        revisedPrompt: result.revisedPrompt,
        outputFormat: controls.outputFormat,
        outputCompression: controls.outputCompression,
        inputFidelity: controls.inputFidelity || null,
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

  // ── Full Body Recast (open-genjutsu flow) ──────────────────────────────
  // Recasts run as background jobs (recastJobs.js). The editor only starts
  // them and mirrors their state, so closing it never stops a recast.

  /**
   * @param {{ characters?: Array<{ id: string, name?: string, url: string }> }} [options]
   *   People the user can recast with. The asset being edited is always first.
   */
  openRecast({ characters } = {}) {
    const session = this.session;
    if (!session) return;
    session.mode = 'advanced';
    session.maskMode = false;
    this.destroyMask();
    const recast = session.recast;
    if (Array.isArray(characters)) {
      const others = characters.filter((c) => c?.id && c.url && c.id !== session.assetId);
      recast.characters = [{ id: session.assetId, name: session.name, url: session.originalUrl }, ...others];
    }
    if (!recast.characterId) recast.characterId = session.assetId;
    recast.open = true;
    recast.error = '';
    if (!recast.jobId) {
      const job = this._findRecentRecastJob();
      if (job) this._attachRecastJob(job, { restore: true });
    } else {
      this._attachRecastJob(getRecastJobs().find((job) => job.id === recast.jobId) || { id: recast.jobId });
    }
    this._change(true);
  }

  /** The newest job started from this asset that is running or finished recently. */
  _findRecentRecastJob() {
    const session = this.session;
    if (!session || !this.contactId) return null;
    return getRecastJobs({ contactId: this.contactId }).find((job) => (
      (job.editorAssetId === session.assetId || job.characterAssetId === session.assetId)
      && job.status !== 'cancelled'
      && (isRecastJobActive(job) || Date.now() - (job.finishedAt || 0) < RECENT_RECAST_MS)
    )) || null;
  }

  _attachRecastJob(job, { restore = false } = {}) {
    const recast = this.session?.recast;
    if (!recast || !job?.id) return;
    this._detachRecastJob();
    recast.jobId = job.id;
    if (restore) {
      const known = job.characterAssetId === this.session.assetId
        || recast.characters.some((c) => c.id === job.characterAssetId);
      if (known) recast.characterId = job.characterAssetId;
      Object.assign(recast, {
        sourceName: 'Source clip',
        sourcePreviewUrl: job.sourceUrl || '',
        sourceUrl: job.sourceUrl || '',
        duration: job.duration || 0,
        prompt: job.prompt || '',
      });
    }
    if (job.status) this._syncRecastFromJob(job);
    this._recastUnsubscribe = subscribeRecastJobs((jobs) => {
      const latest = jobs.find((candidate) => candidate.id === recast.jobId);
      if (!latest || this.session?.recast !== recast) return;
      this._syncRecastFromJob(latest);
      this._change(true);
    });
  }

  _detachRecastJob() {
    this._recastUnsubscribe?.();
    this._recastUnsubscribe = null;
  }

  _syncRecastFromJob(job) {
    const recast = this.session?.recast;
    if (!recast) return;
    recast.startedAt = job.startedAt || recast.startedAt;
    recast.canRetry = false;
    if (job.status === 'submitting' || job.status === 'running') {
      Object.assign(recast, { status: 'generating', statusLabel: RECASTING_LABEL, error: '' });
    } else if (job.status === 'saving') {
      Object.assign(recast, { status: 'saving', statusLabel: 'Saving to Presenter Videos…', resultUrl: job.resultUrl, error: '' });
    } else if (job.status === 'done') {
      Object.assign(recast, {
        status: 'done',
        statusLabel: '',
        resultUrl: job.savedUrl || job.resultUrl,
        saved: true,
        error: '',
      });
    } else if (job.status === 'error') {
      Object.assign(recast, {
        status: 'error',
        statusLabel: '',
        resultUrl: job.resultUrl || '',
        error: job.error || 'Full body recast failed.',
        canRetry: Boolean(job.requestId),
      });
    } else if (job.status === 'cancelled') {
      Object.assign(recast, { status: 'idle', statusLabel: '', error: '', jobId: '' });
      this._detachRecastJob();
    }
  }

  setRecastCharacter(id) {
    const recast = this.session?.recast;
    if (!recast || recast.status === 'generating' || recast.status === 'saving') return;
    const exists = id === this.session.assetId || recast.characters.some((c) => c.id === id);
    if (!exists || recast.characterId === id) return;
    this._detachRecastJob();
    Object.assign(recast, {
      characterId: id,
      jobId: '',
      resultUrl: '',
      saved: false,
      error: '',
      canRetry: false,
    });
    if (recast.status === 'done' || recast.status === 'error') recast.status = 'idle';
    this._change(true);
  }

  /** Image URL for the selected person. The edited asset uses its current version. */
  recastCharacterUrl() {
    const session = this.session;
    if (!session) return '';
    const { characterId, characters } = session.recast;
    if (!characterId || characterId === session.assetId) return this.currentVersion()?.dataUrl || '';
    return characters.find((c) => c.id === characterId)?.url || '';
  }

  /** After a recast is saved, start a new one with the same person. */
  recastAnother() {
    const recast = this.session?.recast;
    if (!recast) return;
    this._detachRecastJob();
    this._revokeRecastPreview();
    Object.assign(recast, {
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
      jobId: '',
      canRetry: false,
    });
    this._change(true);
  }

  closeRecast() {
    if (!this.session) return;
    this._detachRecastJob();
    this.session.recast.open = false;
    this._change(true);
  }

  _revokeRecastPreview() {
    const preview = this.session?.recast?.sourcePreviewUrl;
    if (preview && preview.startsWith('blob:')) {
      try { URL.revokeObjectURL(preview); } catch {}
    }
  }

  async setRecastSource(file) {
    const session = this.session;
    if (!session) return;
    const recast = session.recast;
    const fileError = validateRecastSourceFile(file);
    if (fileError) {
      recast.error = fileError;
      this._change(true);
      return;
    }

    this._detachRecastJob();
    this._revokeRecastPreview();
    const previewUrl = URL.createObjectURL(file);
    Object.assign(recast, {
      sourceName: file.name || 'Source clip',
      sourcePreviewUrl: previewUrl,
      sourceUrl: '',
      duration: 0,
      resultUrl: '',
      saved: false,
      error: '',
      jobId: '',
      canRetry: false,
      status: 'uploading',
      statusLabel: 'Reading clip…',
    });
    this._change(true);

    try {
      const duration = await readVideoDuration(previewUrl);
      const durationError = validateRecastDuration(duration);
      if (durationError) throw new Error(durationError);
      recast.duration = duration;
      recast.statusLabel = 'Uploading source clip…';
      this._change(true);

      const sourceUrl = await uploadRecastSource(file);
      if (this.session !== session || recast.sourcePreviewUrl !== previewUrl) return;
      recast.sourceUrl = sourceUrl;
      recast.status = 'idle';
      recast.statusLabel = '';
    } catch (error) {
      if (this.session !== session || recast.sourcePreviewUrl !== previewUrl) return;
      recast.status = 'error';
      recast.statusLabel = '';
      recast.error = error?.message || 'The source clip could not be uploaded.';
      if (!recast.duration) {
        this._revokeRecastPreview();
        recast.sourcePreviewUrl = '';
        recast.sourceName = '';
      }
    }
    this._change(true);
  }

  setRecastPrompt(value) {
    if (!this.session) return;
    this.session.recast.prompt = String(value || '').slice(0, 1000);
  }

  async runRecast() {
    const session = this.session;
    const characterImage = this.recastCharacterUrl();
    if (!session || !characterImage) return;
    const recast = session.recast;
    if (!recast.sourceUrl || recast.status === 'generating' || recast.status === 'saving') return;
    if (!this.contactId) {
      recast.error = 'Select a contact before starting a recast.';
      this._change(true);
      return;
    }

    this._detachRecastJob();
    const preparing = { cancelled: false };
    this._recastPreparing = preparing;
    Object.assign(recast, {
      status: 'generating',
      startedAt: Date.now(),
      statusLabel: 'Preparing character image…',
      error: '',
      resultUrl: '',
      saved: false,
      jobId: '',
      canRetry: false,
    });
    this._change(true);

    try {
      const character = recast.characters.find((c) => c.id === recast.characterId);
      const characterName = character?.name || session.name;
      const characterUrl = await resolveRecastCharacterUrl(characterImage, {
        role: session.role,
        name: characterName,
      });
      if (preparing.cancelled || this.session !== session) return;

      const job = startRecastJob({
        contactId: this.contactId,
        editorAssetId: session.assetId,
        characterAssetId: recast.characterId || session.assetId,
        characterName,
        characterImageUrl: characterUrl,
        sourceUrl: recast.sourceUrl,
        duration: recast.duration,
        prompt: recast.prompt,
      });
      this._attachRecastJob(job);
    } catch (error) {
      if (this.session !== session || preparing.cancelled) return;
      Object.assign(recast, {
        status: 'error',
        statusLabel: '',
        error: error?.message || 'Full body recast failed.',
      });
    } finally {
      if (this._recastPreparing === preparing) this._recastPreparing = null;
      if (this.session === session) this._change(true);
    }
  }

  cancelRecast() {
    const recast = this.session?.recast;
    if (this._recastPreparing) {
      this._recastPreparing.cancelled = true;
      this._recastPreparing = null;
      if (recast) Object.assign(recast, { status: 'idle', statusLabel: '' });
    }
    if (recast?.jobId) cancelRecastJob(recast.jobId);
    if (recast) this._change(true);
  }

  /** Check the same MuAPI request again after a failure. */
  retryRecast() {
    const recast = this.session?.recast;
    if (!recast?.jobId) return;
    if (!retryRecastJob(recast.jobId)) {
      this._detachRecastJob();
      Object.assign(recast, { status: 'idle', error: '', jobId: '', canRetry: false });
      this._change(true);
    }
  }

  async persistVersions() {
    const session = this.session;
    if (!session?.role) throw new Error('Choose a destination role before saving edited versions.');

    for (let index = 0; index < session.versions.length; index += 1) {
      const version = session.versions[index];
      if (!isDataImage(version.dataUrl)) continue;

      session.busyLabel = `Saving ${version.label}…`;
      this._change(false);

      const stored = await persistPersonalizationAssetVersion({
        sourceUrl: version.dataUrl,
        role: session.role,
        name: `${session.name} — ${version.label}`,
      });

      // Commit each successful upload immediately so a later failure cannot
      // orphan earlier durable versions or upload them again on retry.
      session.versions[index] = {
        ...version,
        dataUrl: stored.url,
        storagePath: stored.storagePath || null,
        mimeType: stored.mimeType || null,
      };
      this._change(false);
    }

    session.versionIndex = Math.max(0, Math.min(session.versionIndex, session.versions.length - 1));
    session.busyLabel = '';
    return session;
  }
}
