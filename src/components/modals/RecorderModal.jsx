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
    this.isRecording = false;
    this.isPaused = false;
    this.recordingTime = 0;
    this.recordedBlob = null;
    this.previewUrl = null;
    // Raw per-source recordings from a Both take, kept so a later editor can
    // re-layout screen and camera independently. { screen?: Blob, camera?: Blob }
    this.trackBlobs = {};
    this.trackRecorders = [];
    this.hasAudio = false;
    this.notice = '';
    this.webcamStream = null;
    this.screenStream = null;
    this.micStream = null;
    // Streams built for MediaRecorder hold cloned tracks; those must be stopped too
    // or the browser keeps the camera and mic indicators on.
    this.recordingStreams = [];
    this.recordingInterval = null;
    this.compositeFrame = null;
    this.compositeVideos = null;
    this.compositing = false;

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
        this.setupEventListeners();
      }
    } catch (err) {
      console.error('Failed to enumerate microphones:', err);
    }
  }

  renderBody() {
    return `
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
              <div class="combined-preview" style="position:relative;">
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
            ${this.recordingType === 'both' ? `
              <button class="preview-toggle ${this.camShape === 'circle' ? 'active' : ''}" data-shape="circle" data-tooltip="Round face bubble">● Circle</button>
              <button class="preview-toggle ${this.camShape === 'rounded' ? 'active' : ''}" data-shape="rounded" data-tooltip="Rounded rectangle camera">▢ Rectangle</button>
            ` : ''}
          </div>
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
          ${this.isRecording ? `
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

  setupEventListeners() {
    super.setupEventListeners();

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
        this.setupEventListeners();
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

  rerender() {
    this.updateBody(this.renderBody());
    this.setupEventListeners();
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
        this.setupEventListeners();
        return;
      }
    }
    const el = this.overlay?.querySelector('.webcam-feed');
    if (el && el.srcObject !== this.webcamStream) el.srcObject = this.webcamStream;
  }

  stopPreviewCamera() {
    if (this.webcamStream && this.previewCameraOnly) {
      this.webcamStream.getTracks().forEach(t => t.stop());
      this.webcamStream = null;
    }
  }

  getQualityConstraints() {
    const quality = QUALITY_OPTIONS.find(q => q.id === this.selectedQuality);
    if (!quality || !quality.resolution) return {};
    const [width, height] = quality.resolution.split('x').map(Number);
    return {
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: quality.fps }
    };
  }

  getAudioConstraints() {
    if (this.selectedMic && this.selectedMic !== 'default') {
      return { deviceId: { exact: this.selectedMic } };
    }
    return true;
  }

  open() {
    super.open();
    this.syncCameraPreview();
  }

  // Draws the screen stream full-frame with the camera composited on top (a face
  // bubble or a rounded rectangle, bottom-left), and returns a MediaStream of the
  // result. MediaRecorder can only record one video track, so the composite is
  // what makes "Both" produce one combined video.
  composeScreenAndCam(screenStream, camStream, qualityConstraints) {
    const width = qualityConstraints.width?.ideal || 1920;
    const height = qualityConstraints.height?.ideal || 1080;
    const fps = qualityConstraints.frameRate?.ideal || 30;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const makeVideo = (stream) => {
      const v = document.createElement('video');
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      v.play().catch(() => {});
      return v;
    };
    const screenVideo = makeVideo(screenStream);
    const camVideo = makeVideo(camStream);
    this.compositeVideos = { screenVideo, camVideo };

    const size = Math.round(width * 0.2);
    const margin = Math.round(width * 0.03);
    const x = margin;
    const y = height - size - margin;
    const circle = this.camShape === 'circle';

    this.compositing = true;
    const draw = () => {
      if (!this.compositing) return;
      ctx.drawImage(screenVideo, 0, 0, width, height);
      // Centre-crop the camera to a square so the face is not squashed.
      const vw = camVideo.videoWidth || 16;
      const vh = camVideo.videoHeight || 9;
      const side = Math.min(vw, vh);
      const sx = (vw - side) / 2;
      const sy = (vh - side) / 2;
      ctx.save();
      ctx.beginPath();
      if (circle) {
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      } else {
        const r = Math.round(size * 0.1);
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + size, y, x + size, y + size, r);
        ctx.arcTo(x + size, y + size, x, y + size, r);
        ctx.arcTo(x, y + size, x, y, r);
        ctx.arcTo(x, y, x + size, y, r);
        ctx.closePath();
      }
      ctx.clip();
      ctx.drawImage(camVideo, sx, sy, side, side, x, y, size, size);
      ctx.restore();
      ctx.lineWidth = Math.max(3, Math.round(size * 0.02));
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      this.compositeFrame = requestAnimationFrame(draw);
    };
    this.compositeFrame = requestAnimationFrame(draw);

    return canvas.captureStream(fps);
  }

  // Microphone is recorded in every mode. If access is refused the take still
  // goes ahead without audio and the user is told why.
  async getMicTracks() {
    if (!this.micEnabled) return [];
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: this.getAudioConstraints(), video: false });
      return this.micStream.getAudioTracks();
    } catch (err) {
      console.error('Microphone unavailable:', err);
      this.notice = 'Microphone was unavailable, so this take has no sound.';
      return [];
    }
  }

  createRecorder(stream, onData) {
    const mimeType = this.getMimeType();
    this.recordingStreams.push(stream);
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.chunks = chunks;
    recorder.finish = () => new Blob(chunks, { type: mimeType || 'video/webm' });
    if (onData) onData(recorder);
    return recorder;
  }

  async startRecording() {
    this.notice = '';
    try {
      const q = this.getQualityConstraints();
      const micTracks = this.recordingType === 'audio' ? [] : await this.getMicTracks();
      const withMic = (videoStream) => new MediaStream([...videoStream.getVideoTracks(), ...micTracks.map(t => t.clone())]);
      const type = this.recordingType;
      let stream = null;
      this.trackBlobs = {};
      this.trackRecorders = [];

      this.stopPreviewCamera();

      if (type === 'screen' || type === 'both') {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor', ...q },
          audio: false
        });
        this.screenStream.getVideoTracks()[0].onended = () => {
          if (this.isRecording) this.stopRecording();
        };
      }
      if (type === 'camera' || type === 'both') {
        this.webcamStream = await navigator.mediaDevices.getUserMedia({ video: type === 'camera' ? q : true, audio: false });
        this.previewCameraOnly = false;
      }

      if (type === 'screen') {
        stream = withMic(this.screenStream);
      } else if (type === 'camera') {
        stream = withMic(this.webcamStream);
      } else if (type === 'both') {
        stream = new MediaStream([
          ...this.composeScreenAndCam(this.screenStream, this.webcamStream, q).getVideoTracks(),
          ...micTracks.map(t => t.clone())
        ]);
        // Keep each source as its own file too, so it can be re-laid-out later.
        this.trackRecorders.push(
          this.createRecorder(withMic(this.screenStream), (r) => { r.trackName = 'screen'; }),
          this.createRecorder(withMic(this.webcamStream), (r) => { r.trackName = 'camera'; })
        );
      } else if (type === 'audio') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: this.getAudioConstraints() });
        this.micStream = stream;
      }

      this.hasAudio = stream.getAudioTracks().length > 0;
      this.trackRecorders.forEach((r) => {
        r.onstop = () => { this.trackBlobs[r.trackName] = r.finish(); };
      });

      this.mediaRecorder = this.createRecorder(stream);
      this.mediaRecorder.onstop = () => {
        this.recordedBlob = this.mediaRecorder.finish();
        this.previewUrl = null;
        this.isRecording = false;
        clearInterval(this.recordingInterval);
        this.updateBody(this.renderBody());
        this.setupEventListeners();
      };

      this.mediaRecorder.start(1000);
      this.trackRecorders.forEach(r => r.start(1000));
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
      this.setupEventListeners();
      // The preview <video> is re-created by the re-render; reattach the camera.
      const el = this.overlay?.querySelector('.webcam-feed');
      if (el && this.webcamStream) el.srcObject = this.webcamStream;
    } catch (err) {
      console.error('Recording failed:', err);
      this.stopAllStreams();
      this.isRecording = false;
      this.notice = err?.name === 'NotAllowedError'
        ? 'Permission was denied. Allow screen, camera and microphone access to record.'
        : `Recording could not start: ${err?.message || err}`;
      this.rerender();
    }
  }

  getMimeType() {
    if (this.recordingType === 'audio') return 'audio/webm';
    const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return candidates.find(c => MediaRecorder.isTypeSupported?.(c)) || '';
  }

  allRecorders() {
    return [this.mediaRecorder, ...this.trackRecorders].filter(Boolean);
  }

  pauseRecording() {
    const active = this.allRecorders().filter(r => r.state === 'recording');
    if (active.length) {
      active.forEach(r => r.pause());
      this.isPaused = true;
      this.updateBody(this.renderBody());
      this.setupEventListeners();
    }
  }

  resumeRecording() {
    const paused = this.allRecorders().filter(r => r.state === 'paused');
    if (paused.length) {
      paused.forEach(r => r.resume());
      this.isPaused = false;
      this.updateBody(this.renderBody());
      this.setupEventListeners();
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.allRecorders().forEach(r => { if (r.state !== 'inactive') r.stop(); });
      this.stopAllStreams();
    }
  }

  stopAllStreams() {
    this.compositing = false;
    if (this.compositeFrame) {
      cancelAnimationFrame(this.compositeFrame);
      this.compositeFrame = null;
    }
    if (this.compositeVideos) {
      this.compositeVideos.screenVideo.pause();
      this.compositeVideos.camVideo.pause();
      this.compositeVideos = null;
    }
    [this.screenStream, this.webcamStream, this.micStream, ...this.recordingStreams].forEach((s) => {
      if (s) s.getTracks().forEach(track => track.stop());
    });
    this.recordingStreams = [];
    this.screenStream = null;
    this.webcamStream = null;
    this.micStream = null;
  }

  // Closing the modal mid-take (or after a preview) must release camera, mic and
  // screen capture, otherwise the browser's recording indicators stay on.
  destroy() {
    clearInterval(this.recordingInterval);
    this.allRecorders().forEach(r => { try { if (r.state !== 'inactive') r.stop(); } catch { /* already stopped */ } });
    this.stopAllStreams();
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    super.destroy();
  }

  discardRecording() {
    this.recordedBlob = null;
    this.recordedChunks = [];
    this.trackBlobs = {};
    this.trackRecorders = [];
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
      a.download = `recording-${Date.now()}.webm`;
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
