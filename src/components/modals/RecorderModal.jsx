import { BUILTIN_BACKGROUNDS, effectsActive, loadEffects, saveEffects, applyCameraEffects } from '../../lib/recorder/effects.js';
import { BaseModal } from './BaseModal.jsx';

const QUALITY_OPTIONS = [
  { id: '1080p', name: '1080p HD', resolution: '1920x1080', fps: 30 },
  { id: '720p', name: '720p', resolution: '1280x720', fps: 30 },
  { id: '480p', name: '480p', resolution: '854x480', fps: 30 },
  { id: 'audio-only', name: 'Audio Only', resolution: null, fps: null }
];

const DEFAULT_MIC_OPTIONS = [
  { id: 'default', label: 'System Default' }
];

// Scoped styles for the recorder (it had none). Uses the app's design tokens (BaseModal).
const RECORDER_STYLES = `
  .recorder-container { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  /* Tooltip text the app adds inside buttons must not widen the panel. */
  .recorder-container .type-btn, .recorder-container .preview-toggle, .recorder-container .quality-btn { min-width: 0; overflow: hidden; }
  .recorder-type-selector { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 4px; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); }
  .recorder-type-selector .type-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
  .recorder-type-selector .type-btn.active { background: var(--primary); color: var(--on-primary); }
  .recorder-type-selector .type-icon { font-size: 18px; line-height: 1; }
  .preview-viewport { position: relative; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; background: #000; border: 1px solid var(--border); }
  .preview-viewport > div { position: absolute; inset: 0; }
  .preview-viewport .webcam-feed { width: 100%; height: 100%; object-fit: cover; }
  .preview-placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 16px; text-align: center; color: var(--muted); font-size: 13px; }
  .combined-preview .screen-area { position: absolute; inset: 0; }
  .combined-preview .preview-placeholder { justify-content: flex-start; padding-top: 14%; }
  .audio-preview { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; font-size: 28px; color: var(--muted); }
  .recording-status { position: absolute; top: 10px; left: 10px; z-index: 5; display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 999px; background: rgba(0,0,0,.6); color: #fff; font-size: 12px; font-weight: 600; }
  .rec-indicator { display: flex; align-items: center; gap: 6px; }
  .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--danger, #ef4444); }
  .preview-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .preview-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--text); font: inherit; font-size: 12px; cursor: pointer; }
  .preview-toggle.active { border-color: var(--primary); color: var(--primary); }
  .recorder-options { display: flex; flex-direction: column; gap: 14px; }
  .option-label { display: block; margin-bottom: 6px; color: var(--muted); font-size: 12px; font-weight: 600; }
  .quality-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .quality-btn { display: flex; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 9px; background: transparent; color: var(--text); font: inherit; font-size: 12px; cursor: pointer; }
  .quality-btn.active { border-color: var(--primary); }
  .quality-res { color: var(--muted); }
  .mic-select { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--panel); color: var(--text); font: inherit; }
  .recording-preview h4 { margin: 0 0 8px; font-size: 13px; }
  .recorded-playback { width: 100%; border-radius: 10px; background: #000; }
  .recording-actions { display: flex; gap: 8px; margin-top: 8px; }
  .recording-actions .action-btn { padding: 6px 12px; border: 1px solid var(--border); border-radius: 9px; background: transparent; color: var(--text); font: inherit; font-size: 12px; cursor: pointer; }
`;

export class RecorderModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Screen Recorder',
      size: 'medium',
      showFooter: false,
      ...options
    });

    this.recordingType = 'screen';
    this.selectedQuality = '1080p';
    this.micOptions = DEFAULT_MIC_OPTIONS;
    this.selectedMic = 'default';
    this.micEnabled = true;
    // 'circle' is the face bubble used by video-outreach tools; 'rounded' is a
    // plain picture-in-picture rectangle. Only used by the Both (screen + cam) mode.
    this.camShape = 'circle';
    // Camera effects (src/lib/recorder/effects.js): blur, virtual background, touch-up, mirror.
    this.effects = loadEffects();
    this.showEffects = false;
    this.previewFx = null;
    this.isRecording = false;
    this.isPaused = false;
    this.recordingTime = 0;
    this.recordedBlob = null;
    this.previewUrl = null;
    // Raw per-source recordings from a Both take, kept so a later editor can
    // re-layout screen and camera independently. { screen?: Blob, camera?: Blob }
    this.trackBlobs = {};
    this.hasAudio = false;
    this.notice = '';
    this.webcamStream = null; // live camera preview only
    this.liveStreams = [];    // the streams being recorded
    this.session = null;      // src/lib/recorder/session.js
    this.stopping = false;
    this.combining = false;
    this.recordingInterval = null;

    // Fire-and-forget: populates real input devices once permission/labels
    // are available, then re-renders the Microphone dropdown.
    this.loadMicDevices();
  }

  async loadMicDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      if (mics.length === 0) return;

      this.micOptions = mics.map((d, i) => ({
        id: d.deviceId,
        label: d.label || `Microphone ${i + 1}`
      }));
      if (!this.micOptions.some(m => m.id === this.selectedMic)) {
        this.selectedMic = this.micOptions[0].id;
      }
      if (this.overlay) {
        this.updateBody(this.renderBody());
      }
    } catch (err) {
      console.error('Failed to enumerate microphones:', err);
    }
  }

  renderBody() {
    return `
      <style>${RECORDER_STYLES}</style>
      <div class="recorder-container">
        <div class="recorder-type-selector">
          <button class="type-btn ${this.recordingType === 'screen' ? 'active' : ''}" data-type="screen" data-tooltip="Record your screen">
            <span class="type-icon">🖥</span>
            <span class="type-label">Screen</span>
          </button>
          <button class="type-btn ${this.recordingType === 'camera' ? 'active' : ''}" data-type="camera" data-tooltip="Record from your camera">
            <span class="type-icon">📷</span>
            <span class="type-label">Camera</span>
          </button>
          <button class="type-btn ${this.recordingType === 'both' ? 'active' : ''}" data-type="both" data-tooltip="Record screen and camera together, with a face bubble over the screen. Each source is also kept as its own file.">
            <span class="type-icon">⊕</span>
            <span class="type-label">Both</span>
          </button>
          <button class="type-btn ${this.recordingType === 'audio' ? 'active' : ''}" data-type="audio" data-tooltip="Record audio only">
            <span class="type-icon">🎤</span>
            <span class="type-label">Audio</span>
          </button>
        </div>

        <div class="recorder-preview-area">
          <div class="preview-viewport">
            ${this.recordingType === 'screen' ? `
              <div class="screen-preview">
                <div class="preview-placeholder">
                  <span class="placeholder-icon">🖥</span>
                  <span class="placeholder-text">Select screen to record</span>
                </div>
              </div>
            ` : this.recordingType === 'camera' ? `
              <div class="camera-preview">
                <video class="webcam-feed" autoplay muted playsinline></video>
              </div>
            ` : this.recordingType === 'both' ? `
              <div class="combined-preview">
                <div class="screen-area">
                  <div class="preview-placeholder">
                    <span>Your screen is chosen when you start. The camera bubble shows where your face will appear.</span>
                  </div>
                </div>
                <div class="webcam-overlay" style="position:absolute;left:4%;bottom:6%;width:22%;aspect-ratio:1/1;overflow:hidden;border:3px solid #fff;border-radius:${this.camShape === 'circle' ? '50%' : '10px'};">
                  <video class="webcam-feed" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>
                </div>
              </div>
            ` : `
              <div class="audio-preview">
                <div class="audio-icon">🎤</div>
                <div class="audio-waveform-placeholder">∿∿∿∿∿</div>
              </div>
            `}

            ${this.isRecording ? `
              <div class="recording-status">
                <div class="rec-indicator">
                  <span class="rec-dot"></span>
                  <span class="rec-label">REC</span>
                </div>
                <span class="rec-time">${this.formatTime(this.recordingTime)}</span>
              </div>
            ` : ''}
          </div>

          <div class="preview-controls">
            ${this.recordingType !== 'audio' ? `
              <button class="preview-toggle ${this.micEnabled ? 'active' : ''}" data-action="toggle-mic" data-tooltip="${this.micEnabled ? 'Mute microphone' : 'Record microphone'}">
                <span>🎤</span> Mic ${this.micEnabled ? 'on' : 'off'}
              </button>
            ` : ''}
            ${(this.recordingType === 'camera' || this.recordingType === 'both') && !this.isRecording ? `
              <button class="preview-toggle ${effectsActive(this.effects) || this.showEffects ? 'active' : ''}" data-action="toggle-effects" data-tooltip="Background blur, virtual background, touch-up and mirror">✨ Effects</button>
            ` : ''}
            ${this.recordingType === 'both' ? `
              <button class="preview-toggle ${this.camShape === 'circle' ? 'active' : ''}" data-shape="circle" data-tooltip="Round face bubble">● Circle</button>
              <button class="preview-toggle ${this.camShape === 'rounded' ? 'active' : ''}" data-shape="rounded" data-tooltip="Rounded rectangle camera">▢ Rectangle</button>
            ` : ''}
          </div>
          ${this.showEffects && (this.recordingType === 'camera' || this.recordingType === 'both') && !this.isRecording ? this.renderEffectsPanel() : ''}
          ${this.notice ? `<div class="recorder-notice" style="font-size:12px;opacity:.8;margin-top:6px;">${this.notice}</div>` : ''}
        </div>

        <div class="recorder-options">
          <div class="option-group">
            <label class="option-label">Quality</label>
            <div class="quality-options">
              ${QUALITY_OPTIONS.map(q => `
                <button class="quality-btn ${this.selectedQuality === q.id ? 'active' : ''}" data-quality="${q.id}" data-tooltip="${q.name}${q.resolution ? ' - ' + q.resolution + ' at ' + q.fps + 'fps' : ''}">
                  <span class="quality-name">${q.name}</span>
                  ${q.resolution ? `<span class="quality-res">${q.resolution}</span>` : ''}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="option-group">
            <label class="option-label">Microphone</label>
            <select class="mic-select" data-tooltip="Select microphone input source">
              ${this.micOptions.map(mic => `
                <option value="${mic.id}" ${this.selectedMic === mic.id ? 'selected' : ''} data-tooltip="${mic.label}">${mic.label}</option>
              `).join('')}
            </select>
          </div>
        </div>

        ${this.recordedBlob ? `
          <div class="recording-preview">
            <h4>Recording Preview</h4>
            <video class="recorded-playback" src="${this.getPreviewUrl()}" controls></video>
            <div class="recording-actions">
              <button class="action-btn" data-action="discard" data-tooltip="Discard this recording">
                <span>🗑</span> Discard
              </button>
              <button class="action-btn" data-action="save" data-tooltip="Save recording to file">
                <span>💾</span> Save Recording
              </button>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="modal-footer recorder-footer">
        <div class="footer-left"></div>
        <div class="footer-right">
          ${this.stopping || this.combining ? `
            <button class="modal-btn modal-btn-secondary" disabled>Saving…</button>
          ` : this.isRecording ? `
            <button class="modal-btn ${this.isPaused ? 'modal-btn-primary' : 'modal-btn-secondary'}" data-action="${this.isPaused ? 'resume' : 'pause'}" data-tooltip="${this.isPaused ? 'Resume recording' : 'Pause recording'}">
              ${this.isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button class="modal-btn modal-btn-danger" data-action="stop" data-tooltip="Stop recording">
              ⏹ Stop
            </button>
          ` : this.recordedBlob ? `
            <button class="modal-btn modal-btn-secondary modal-cancel" data-tooltip="Cancel and close">Cancel</button>
            <button class="modal-btn modal-btn-primary" data-action="use-recording" data-tooltip="Use this recording in your project">
              Use Recording
            </button>
          ` : `
            <button class="modal-btn modal-btn-secondary modal-cancel" data-tooltip="Cancel and close">Cancel</button>
            <button class="modal-btn modal-btn-primary" data-action="start" data-tooltip="Start recording">
              ⏺ Start Recording
            </button>
          `}
        </div>
      </div>
    `;
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  renderEffectsPanel() {
    const fx = this.effects;
    const chip = (id, label, on) => `<button class="preview-toggle ${on ? 'active' : ''}" data-fx-bg="${id}">${label}</button>`;
    const bgOn = (id) => fx.mode === 'background' && fx.background === id;
    const custom = fx.mode === 'background' && !BUILTIN_BACKGROUNDS.some((b) => b.id === fx.background);
    return `
      <div class="recorder-effects" data-recorder-effects style="display:flex;flex-direction:column;gap:8px;margin-top:8px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:12px;">
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
          <span style="font-size:12px;opacity:.7;width:84px;">Background</span>
          ${chip('none', 'None', fx.mode === 'none')}
          ${chip('blur', 'Blur', fx.mode === 'blur')}
          ${BUILTIN_BACKGROUNDS.map((b) => chip(b.id, b.label, bgOn(b.id))).join('')}
          ${chip('upload', custom ? 'Your image ✓' : 'Upload image…', custom)}
          <input type="file" accept="image/*" data-fx-upload hidden>
        </div>
        ${fx.mode === 'blur' ? `<label style="display:flex;gap:8px;align-items:center;font-size:12px;"><span style="opacity:.7;width:84px;">Blur amount</span><input type="range" min="0" max="1" step="0.05" value="${fx.blur}" data-fx-blur style="flex:1;"></label>` : ''}
        <label style="display:flex;gap:8px;align-items:center;font-size:12px;"><span style="opacity:.7;width:84px;">Touch-up</span><input type="range" min="0" max="1" step="0.05" value="${fx.touchUp}" data-fx-touchup style="flex:1;"></label>
        <label style="display:flex;gap:8px;align-items:center;font-size:12px;"><span style="opacity:.7;width:84px;">Mirror</span><input type="checkbox" ${fx.mirror ? 'checked' : ''} data-fx-mirror></label>
        <span style="font-size:11px;opacity:.5;">Effects run on your device and are recorded into the video.</span>
      </div>`;
  }

  async setEffects(patch, { rerender = true } = {}) {
    this.effects = { ...this.effects, ...patch };
    saveEffects(this.effects);
    if (rerender) this.rerender();
    await this.refreshPreviewEffects();
  }

  setupEventListeners() {
    super.setupEventListeners();

    this.overlay.querySelector('[data-action="toggle-effects"]')?.addEventListener('click', () => {
      this.showEffects = !this.showEffects;
      this.rerender();
    });
    this.overlay.querySelectorAll('[data-fx-bg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.fxBg;
        if (id === 'upload') { this.overlay.querySelector('[data-fx-upload]')?.click(); return; }
        if (id === 'none' || id === 'blur') this.setEffects({ mode: id });
        else this.setEffects({ mode: 'background', background: id });
      });
    });
    this.overlay.querySelector('[data-fx-upload]')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => this.setEffects({ mode: 'background', background: String(reader.result) });
      reader.readAsDataURL(file);
    });
    this.overlay.querySelector('[data-fx-blur]')?.addEventListener('input', (e) => this.setEffects({ blur: Number(e.target.value) }, { rerender: false }));
    this.overlay.querySelector('[data-fx-touchup]')?.addEventListener('input', (e) => this.setEffects({ touchUp: Number(e.target.value) }, { rerender: false }));
    this.overlay.querySelector('[data-fx-mirror]')?.addEventListener('change', (e) => this.setEffects({ mirror: e.target.checked }));

    this.overlay.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isRecording) return;
        this.recordingType = btn.dataset.type;
        this.rerender();
      });
    });

    this.overlay.querySelectorAll('[data-shape]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.camShape = btn.dataset.shape;
        this.rerender();
      });
    });

    this.overlay.querySelectorAll('.quality-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedQuality = btn.dataset.quality;
        this.updateBody(this.renderBody());
      });
    });

    const micSelect = this.overlay.querySelector('.mic-select');
    if (micSelect) {
      micSelect.addEventListener('change', (e) => {
        this.selectedMic = e.target.value;
      });
    }

    this.overlay.querySelector('[data-action="toggle-mic"]')?.addEventListener('click', () => {
      if (this.isRecording) return;
      this.micEnabled = !this.micEnabled;
      this.rerender();
    });

    this.overlay.querySelector('[data-action="start"]')?.addEventListener('click', () => this.startRecording());
    this.overlay.querySelector('[data-action="pause"]')?.addEventListener('click', () => this.pauseRecording());
    this.overlay.querySelector('[data-action="resume"]')?.addEventListener('click', () => this.resumeRecording());
    this.overlay.querySelector('[data-action="stop"]')?.addEventListener('click', () => this.stopRecording());
    this.overlay.querySelector('[data-action="discard"]')?.addEventListener('click', () => this.discardRecording());
    this.overlay.querySelector('[data-action="save"]')?.addEventListener('click', () => this.saveRecording());
    this.overlay.querySelector('[data-action="use-recording"]')?.addEventListener('click', () => this.useRecording());
  }

  // updateBody() re-attaches the event listeners itself (BaseModal); attaching them again here would
  // make every button fire twice.
  rerender() {
    this.updateBody(this.renderBody());
    this.syncCameraPreview();
  }

  getPreviewUrl() {
    if (!this.previewUrl && this.recordedBlob) this.previewUrl = URL.createObjectURL(this.recordedBlob);
    return this.previewUrl;
  }

  // Keeps a live camera preview running in Camera and Both modes, and stops it in
  // the others so the camera light is not left on.
  async syncCameraPreview() {
    if (this.isRecording || this.recordedBlob) return;
    const wantsCam = this.recordingType === 'camera' || this.recordingType === 'both';
    if (!wantsCam) {
      this.stopPreviewCamera();
      return;
    }
    if (!this.webcamStream) {
      try {
        this.webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.previewCameraOnly = true;
      } catch (err) {
        console.error('Camera access denied:', err);
        this.notice = 'Camera access was blocked. Allow it in your browser settings to record with your camera.';
        this.previewCameraOnly = false;
        this.updateBody(this.renderBody());
        return;
      }
    }
    await this.refreshPreviewEffects();
  }

  // The preview shows the camera through the same effects the take will be recorded with.
  async refreshPreviewEffects() {
    if (!this.webcamStream) return;
    // Switching between "no effect" (camera as is) and "effects" rebuilds the preview; otherwise the
    // running preview just takes the new settings.
    if (this.previewFx && this.previewFx.passthrough !== !effectsActive(this.effects)) { this.previewFx.stop(); this.previewFx = null; }
    if (this.previewFx) await this.previewFx.update(this.effects);
    if (!this.previewFx) {
      try {
        this.previewFx = await applyCameraEffects(this.webcamStream, this.effects, { keepSource: true });
      } catch (err) {
        console.error('Camera effects failed:', err);
        this.notice = 'Camera effects are not available in this browser, so the camera is shown as it is.';
        this.previewFx = { stream: this.webcamStream, update: () => {}, stop: () => {}, passthrough: true };
      }
    }
    const el = this.overlay?.querySelector('.webcam-feed');
    if (el && el.srcObject !== this.previewFx.stream) el.srcObject = this.previewFx.stream;
  }

  stopPreviewCamera() {
    this.previewFx?.stop();
    this.previewFx = null;
    if (this.webcamStream && this.previewCameraOnly) {
      this.webcamStream.getTracks().forEach(t => t.stop());
      this.webcamStream = null;
    }
  }

  open() {
    super.open();
    this.syncCameraPreview();
  }

  // Recording uses the engine ported from Remotion Recorder (src/lib/recorder): every source is
  // recorded to its own file, in sync, and saved to the browser's private file storage as it goes.
  // Both = the camera (with the microphone) and the screen as two files; they are combined into one
  // video afterwards, in the browser (src/lib/recorder/composeBoth.jsx).
  cameraOptions() {
    const quality = QUALITY_OPTIONS.find(q => q.id === this.selectedQuality);
    const [maxWidth, maxHeight] = quality?.resolution ? quality.resolution.split('x').map(Number) : [];
    return { deviceId: 'default', maxWidth, maxHeight };
  }

  async buildSources() {
    const streams = await import('../../lib/recorder/streams.js');
    const audio = { recordAudio: this.micEnabled, selectedAudioSource: this.selectedMic };
    const type = this.recordingType;
    if (type === 'audio') {
      return [{ prefix: 'audio', stream: await streams.getMicStream({ selectedAudioSource: this.selectedMic }), audioOnly: true }];
    }
    if (type === 'screen') {
      return [{ prefix: 'display', stream: await streams.getDisplayStreamWithMic(audio) }];
    }
    // The recorded camera goes through the chosen effects (the original stream passes through when none).
    const withEffects = async (cam) => {
      try { return (await applyCameraEffects(cam, this.effects)).stream; } catch (err) {
        console.error('Camera effects failed:', err);
        this.notice = 'Camera effects could not start, so this take is recorded without them.';
        return cam;
      }
    };
    if (type === 'camera') {
      return [{ prefix: 'webcam', stream: await withEffects(await streams.getCameraStream({ camera: this.cameraOptions(), ...audio })) }];
    }
    // Both: ask for the screen first (it is the dialog the user may cancel), then the camera.
    const display = await streams.getDisplayStream({});
    try {
      const webcam = await withEffects(await streams.getCameraStream({ camera: this.cameraOptions(), ...audio }));
      return [{ prefix: 'webcam', stream: webcam }, { prefix: 'display', stream: display }];
    } catch (err) {
      display.getTracks().forEach(t => t.stop());
      throw err;
    }
  }

  async startRecording() {
    // One take at a time: a second start (double click, or a second click handler) would leave an
    // orphaned recorder holding the camera and its file.
    if (this.isRecording || this.starting) return;
    this.starting = true;
    this.notice = '';
    this.stopPreviewCamera();
    try {
      const sources = await this.buildSources();
      this.liveStreams = sources.map(s => s.stream);
      this.hasAudio = sources.some(s => s.stream.getAudioTracks().length > 0);
      if (this.micEnabled && !this.hasAudio) this.notice = 'Microphone was unavailable, so this take has no sound.';
      const { startSession } = await import('../../lib/recorder/session.js');
      this.session = await startSession(sources);
      // Like Recorder: when any track ends (e.g. the browser's "Stop sharing" button), stop everything.
      for (const s of this.liveStreams) for (const t of s.getTracks()) t.addEventListener('ended', () => { if (this.isRecording) this.stopRecording(); }, { once: true });

      this.isRecording = true;
      this.isPaused = false;
      this.recordingTime = 0;
      this.recordingInterval = setInterval(() => {
        if (!this.isPaused) {
          this.recordingTime++;
          const recTimeEl = this.overlay?.querySelector('.rec-time');
          if (recTimeEl) recTimeEl.textContent = this.formatTime(this.recordingTime);
        }
      }, 1000);
      this.updateBody(this.renderBody());
      const el = this.overlay?.querySelector('.webcam-feed');
      const cam = sources.find(s => s.prefix === 'webcam');
      if (el && cam) el.srcObject = cam.stream;
    } catch (err) {
      console.error('Recording failed:', err);
      this.stopAllStreams();
      this.isRecording = false;
      this.notice = err?.name === 'NotAllowedError'
        ? 'Permission was denied. Allow screen, camera and microphone access to record.'
        : `Recording could not start: ${err?.message || err}`;
      this.rerender();
    } finally {
      this.starting = false;
    }
  }

  pauseRecording() {
    if (!this.session || this.isPaused) return;
    this.session.pause();
    this.isPaused = true;
    this.updateBody(this.renderBody());
  }

  resumeRecording() {
    if (!this.session || !this.isPaused) return;
    this.session.resume();
    this.isPaused = false;
    this.updateBody(this.renderBody());
  }

  async stopRecording() {
    if (!this.session || this.stopping) return;
    this.stopping = true;
    clearInterval(this.recordingInterval);
    const session = this.session;
    try {
      const result = await session.stop();
      this.stopAllStreams();
      const { takeBlobs, releaseTakes } = await import('../../lib/recorder/session.js');
      const blobs = await takeBlobs(result);
      await releaseTakes(result);
      this.isRecording = false;
      if (this.recordingType === 'both') {
        this.trackBlobs = { screen: blobs.display, camera: blobs.webcam };
        await this.combineBoth(result);
      } else {
        this.trackBlobs = {};
        this.recordedBlob = blobs.audio || blobs.webcam || blobs.display || null;
      }
    } catch (err) {
      console.error('Stopping the recording failed:', err);
      this.notice = `The recording could not be saved: ${err?.message || err}`;
      this.isRecording = false;
      this.stopAllStreams();
    } finally {
      this.session = null;
      this.stopping = false;
      this.previewUrl = null;
      this.updateBody(this.renderBody());
    }
  }

  // One video from the two Both files. If the browser cannot render it, keep the camera file and say so.
  async combineBoth(result) {
    this.combining = true;
    this.notice = 'Combining screen and camera…';
    this.updateBody(this.renderBody());
    try {
      const { composeBoth } = await import('../../lib/recorder/composeBoth.jsx');
      const seconds = (result.endDate - result.startDate) / 1000;
      const { screen, camera } = this.trackBlobs;
      const out = await composeBoth({
        screen,
        camera,
        shape: this.camShape,
        seconds,
        onProgress: (p) => {
          const el = this.overlay?.querySelector('.recorder-notice');
          if (el) el.textContent = `Combining screen and camera… ${Math.round(p * 100)}%`;
        },
      });
      this.recordedBlob = out.blob;
      this.notice = '';
    } catch (err) {
      console.error('Combining failed:', err);
      // The microphone is on the camera file, so that one is the usable video on its own.
      this.recordedBlob = this.trackBlobs.camera;
      this.notice = `${err?.message || 'Screen and camera could not be combined.'} The camera recording (with your voice) is used; the screen file is kept separately.`;
    } finally {
      this.combining = false;
    }
  }

  stopAllStreams() {
    [...(this.liveStreams || []), this.webcamStream].forEach((s) => {
      if (s) s.getTracks().forEach(track => track.stop());
    });
    this.liveStreams = [];
    this.webcamStream = null;
  }

  // Closing the modal mid-take (or after a preview) must release camera, mic and
  // screen capture, otherwise the browser's recording indicators stay on.
  destroy() {
    clearInterval(this.recordingInterval);
    const session = this.session;
    this.session = null;
    if (session) {
      session.stop()
        .then(async (result) => (await import('../../lib/recorder/session.js')).releaseTakes(result))
        .catch(() => {});
    }
    this.stopAllStreams();
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    super.destroy();
  }

  discardRecording() {
    this.recordedBlob = null;
    this.trackBlobs = {};
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.recordingTime = 0;
    this.rerender();
  }

  saveRecording() {
    if (this.recordedBlob) {
      const a = document.createElement('a');
      a.href = this.getPreviewUrl();
      const ext = /mp4/.test(this.recordedBlob.type) ? 'mp4' : 'webm';
      a.download = `recording-${Date.now()}.${ext}`;
      a.click();
    }
  }

  useRecording() {
    if (this.recordedBlob) {
      const labels = { screen: 'Screen recording', camera: 'Camera recording', both: 'Screen + camera recording', audio: 'Audio recording' };
      this.onConfirm({
        action: 'recordingComplete',
        name: labels[this.recordingType] || 'Recording',
        blob: this.recordedBlob,
        duration: this.recordingTime,
        type: this.recordingType,
        quality: this.selectedQuality,
        hasAudio: this.hasAudio,
        // Present only for Both: the untouched screen and camera files.
        tracks: { ...this.trackBlobs }
      });
      this.close();
    }
  }
}

export default RecorderModal;
