import { BaseModal } from './BaseModal.jsx';

// Recorder modal modelled on Remotion Recorder (https://www.remotion.dev/docs/recorder):
// screen, facecam and microphone are captured as independent, synchronised sources
// (one MediaRecorder each, all started in the same tick) so the editor can place them
// on separate tracks and re-layout them afterwards. A single composited
// picture-in-picture file is available as an alternative output.

const QUALITY_OPTIONS = [
  { id: '1080p', name: '1080p', width: 1920, height: 1080, fps: 30 },
  { id: '720p', name: '720p', width: 1280, height: 720, fps: 30 },
  { id: '480p', name: '480p', width: 854, height: 480, fps: 30 }
];

const SOURCES = [
  { id: 'screen', icon: '🖥', label: 'Screen', hint: 'Capture a screen, window or tab' },
  { id: 'webcam', icon: '📷', label: 'Facecam', hint: 'Capture your camera' },
  { id: 'mic', icon: '🎤', label: 'Microphone', hint: 'Capture your voice' }
];

const LAYOUTS = [
  { id: 'separate', label: 'Separate tracks', hint: 'Each source becomes its own clip so you can re-layout it on the timeline' },
  { id: 'composite', label: 'Single video (PiP)', hint: 'Facecam baked into the screen recording as a corner overlay' }
];

// The full Remotion Recorder runs as its own app (apps/remotion-recorder, `npm run dev:remotion-recorder`).
const RECORDER_APP_URL = (() => {
  try { return import.meta.env?.VITE_REMOTION_RECORDER_URL || 'http://localhost:4000'; } catch { return 'http://localhost:4000'; }
})();

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export class RecorderModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Screen Recorder',
      size: 'medium',
      showFooter: false,
      ...options
    });

    this.sources = { screen: true, webcam: false, mic: true };
    this.layout = 'separate';
    this.selectedQuality = '1080p';
    this.cams = [{ id: 'default', label: 'Default camera' }];
    this.mics = [{ id: 'default', label: 'System default' }];
    this.selectedCam = 'default';
    this.selectedMic = 'default';

    this.countdown = 0;
    this.isRecording = false;
    this.isPaused = false;
    this.recordingTime = 0;
    this.error = '';
    this.takes = null; // [{ kind, label, blob, url }]
    this.streams = {};
    this.recorders = [];
    this.previewStream = null;

    this.loadDevices();
  }

  // ----- devices ---------------------------------------------------------

  async loadDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const toOptions = (kind, fallback) => {
        const list = devices.filter((d) => d.kind === kind && d.deviceId);
        return list.length
          ? list.map((d, i) => ({ id: d.deviceId, label: d.label || `${fallback} ${i + 1}` }))
          : null;
      };
      this.mics = toOptions('audioinput', 'Microphone') || this.mics;
      this.cams = toOptions('videoinput', 'Camera') || this.cams;
      if (!this.mics.some((m) => m.id === this.selectedMic)) this.selectedMic = this.mics[0].id;
      if (!this.cams.some((c) => c.id === this.selectedCam)) this.selectedCam = this.cams[0].id;
      this.refresh();
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }

  deviceConstraint(id) {
    return id && id !== 'default' ? { deviceId: { exact: id } } : true;
  }

  get quality() {
    return QUALITY_OPTIONS.find((q) => q.id === this.selectedQuality) || QUALITY_OPTIONS[0];
  }

  // ----- rendering -------------------------------------------------------

  refresh() {
    if (!this.overlay) return;
    this.updateBody(this.renderBody());
    this.setupEventListeners();
    this.attachPreview();
  }

  renderBody() {
    const busy = this.isRecording || this.countdown > 0;
    const hasSources = this.sources.screen || this.sources.webcam || this.sources.mic;
    return `
      <style>
        .rr-wrap { display:flex; flex-direction:column; gap:16px; padding:20px 24px; overflow:auto; }
        .rr-label { font-size:12px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; display:block; }
        .rr-sources, .rr-seg { display:flex; gap:8px; flex-wrap:wrap; }
        .rr-chip { flex:1; min-width:110px; display:flex; flex-direction:column; align-items:center; gap:4px; padding:12px 8px; border-radius:var(--radius-md); border:1px solid var(--border); background:var(--panel-soft); color:var(--text); cursor:pointer; font:inherit; }
        .rr-chip.on { border-color:var(--primary); background:var(--primary-soft); }
        .rr-chip:disabled { opacity:.5; cursor:not-allowed; }
        .rr-chip .rr-icon { font-size:20px; }
        .rr-seg button { flex:1; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--panel-soft); color:var(--text); cursor:pointer; font:inherit; font-size:13px; }
        .rr-seg button.on { border-color:var(--primary); background:var(--primary-soft); }
        .rr-seg button:disabled { opacity:.5; cursor:not-allowed; }
        .rr-select { width:100%; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--panel-soft); color:var(--text); font:inherit; }
        .rr-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .rr-stage { position:relative; aspect-ratio:16/9; background:#000; border-radius:var(--radius-md); overflow:hidden; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:13px; text-align:center; padding:12px; }
        .rr-stage video { width:100%; height:100%; object-fit:cover; }
        .rr-count { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:96px; font-weight:700; color:#fff; background:rgba(0,0,0,.55); }
        .rr-rec { position:absolute; top:10px; left:10px; display:flex; gap:8px; align-items:center; background:rgba(0,0,0,.65); color:#fff; padding:4px 10px; border-radius:999px; font-size:12px; }
        .rr-dot { width:8px; height:8px; border-radius:50%; background:#ef4444; animation:rr-pulse 1s infinite; }
        @keyframes rr-pulse { 50% { opacity:.3; } }
        .rr-take { display:flex; flex-direction:column; gap:6px; }
        .rr-take video, .rr-take audio { width:100%; border-radius:var(--radius-sm); background:#000; }
        .rr-link { flex:1; display:flex; align-items:center; justify-content:center; padding:8px 10px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--panel-soft); color:var(--text); font-size:13px; text-decoration:none; }
        .rr-link:hover { border-color:var(--primary); }
        .rr-err { color:var(--danger); font-size:13px; }
        .rr-hint { font-size:12px; color:var(--muted); margin-top:6px; }
      </style>

      <div class="rr-wrap recorder-container">
        <div>
          <span class="rr-label">Sources</span>
          <div class="rr-sources">
            ${SOURCES.map((s) => `
              <button class="rr-chip ${this.sources[s.id] ? 'on' : ''}" data-source="${s.id}" ${busy ? 'disabled' : ''} data-tooltip="${escapeHtml(s.hint)}" aria-pressed="${!!this.sources[s.id]}">
                <span class="rr-icon">${s.icon}</span><span>${s.label}</span>
              </button>`).join('')}
          </div>
        </div>

        <div class="rr-stage" data-stage>
          ${this.sources.webcam ? '<video class="rr-preview" autoplay muted playsinline></video>' : ''}
          ${!this.sources.webcam ? `<span>${this.sources.screen ? 'You will be asked to pick a screen, window or tab when recording starts.' : this.sources.mic ? '🎤 Audio only' : 'Pick at least one source'}</span>` : ''}
          ${this.countdown > 0 ? `<div class="rr-count">${this.countdown}</div>` : ''}
          ${this.isRecording ? `<div class="rr-rec"><span class="rr-dot"></span>${this.isPaused ? 'PAUSED' : 'REC'} <span class="rec-time">${this.formatTime(this.recordingTime)}</span></div>` : ''}
        </div>

        ${this.sources.screen && this.sources.webcam ? `
        <div>
          <span class="rr-label">Output</span>
          <div class="rr-seg">
            ${LAYOUTS.map((l) => `<button class="${this.layout === l.id ? 'on' : ''}" data-layout="${l.id}" ${busy ? 'disabled' : ''} data-tooltip="${escapeHtml(l.hint)}">${l.label}</button>`).join('')}
          </div>
        </div>` : ''}

        <div class="rr-grid">
          ${this.sources.webcam ? `
          <div>
            <span class="rr-label">Camera</span>
            <select class="rr-select" data-device="cam" ${busy ? 'disabled' : ''}>
              ${this.cams.map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === this.selectedCam ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
            </select>
          </div>` : ''}
          ${this.sources.mic ? `
          <div>
            <span class="rr-label">Microphone</span>
            <select class="rr-select" data-device="mic" ${busy ? 'disabled' : ''}>
              ${this.mics.map((m) => `<option value="${escapeHtml(m.id)}" ${m.id === this.selectedMic ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
            </select>
          </div>` : ''}
          ${this.sources.screen || this.sources.webcam ? `
          <div>
            <span class="rr-label">Quality</span>
            <select class="rr-select" data-quality ${busy ? 'disabled' : ''}>
              ${QUALITY_OPTIONS.map((q) => `<option value="${q.id}" ${q.id === this.selectedQuality ? 'selected' : ''}>${q.name}</option>`).join('')}
            </select>
          </div>` : ''}
        </div>

        ${!busy && !this.takes ? `
        <div class="rr-full">
          <span class="rr-label">Full Remotion Recorder</span>
          <div class="rr-seg">
            <a class="rr-link" href="${escapeHtml(RECORDER_APP_URL)}" target="_blank" rel="noopener noreferrer" data-tooltip="Opens the Remotion Recorder app in a new tab">↗ Open Remotion Recorder</a>
            <button data-action="import" data-tooltip="Add a video or audio file exported from the Recorder">⬆ Import recording</button>
            <input type="file" data-import-input accept="video/*,audio/*" multiple hidden>
          </div>
          <div class="rr-hint">Captions, layouts, end cards and chapters live in the Recorder. Render there, then import the file here.</div>
        </div>` : ''}

        ${this.error ? `<div class="rr-err" role="alert">${escapeHtml(this.error)}</div>` : ''}

        ${this.takes ? `
        <div>
          <span class="rr-label">Review</span>
          <div class="rr-grid">
            ${this.takes.map((t) => `
              <div class="rr-take">
                ${t.kind === 'audio' ? `<audio src="${t.url}" controls></audio>` : `<video src="${t.url}" controls></video>`}
                <span class="rr-hint">${escapeHtml(t.label)}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>

      <div class="modal-footer recorder-footer">
        <div class="footer-left"></div>
        <div class="footer-right">
          ${this.countdown > 0 ? `
            <button class="modal-btn modal-btn-secondary" data-action="cancel-countdown">Cancel</button>
          ` : this.isRecording ? `
            <button class="modal-btn ${this.isPaused ? 'modal-btn-primary' : 'modal-btn-secondary'}" data-action="${this.isPaused ? 'resume' : 'pause'}">${this.isPaused ? '▶ Resume' : '⏸ Pause'}</button>
            <button class="modal-btn modal-btn-danger" data-action="stop">⏹ Stop</button>
          ` : this.takes ? `
            <button class="modal-btn modal-btn-secondary" data-action="discard">🗑 Discard</button>
            <button class="modal-btn modal-btn-secondary" data-action="save">💾 Save files</button>
            <button class="modal-btn modal-btn-primary" data-action="use-recording">Add to timeline</button>
          ` : `
            <button class="modal-btn modal-btn-secondary modal-cancel">Cancel</button>
            <button class="modal-btn modal-btn-primary" data-action="start" ${hasSources ? '' : 'disabled'}>⏺ Start recording</button>
          `}
        </div>
      </div>
    `;
  }

  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  // ----- events ----------------------------------------------------------

  setupEventListeners() {
    super.setupEventListeners();
    const q = (sel) => this.overlay.querySelector(sel);

    this.overlay.querySelectorAll('[data-source]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.source;
        this.sources[id] = !this.sources[id];
        if (id === 'webcam' && !this.sources.webcam) this.stopPreview();
        this.error = '';
        this.refresh();
      });
    });
    this.overlay.querySelectorAll('[data-layout]').forEach((btn) => {
      btn.addEventListener('click', () => { this.layout = btn.dataset.layout; this.refresh(); });
    });
    q('[data-device="cam"]')?.addEventListener('change', (e) => {
      this.selectedCam = e.target.value;
      this.stopPreview();
      this.attachPreview();
    });
    q('[data-device="mic"]')?.addEventListener('change', (e) => { this.selectedMic = e.target.value; });
    q('[data-quality]')?.addEventListener('change', (e) => { this.selectedQuality = e.target.value; });

    q('[data-action="import"]')?.addEventListener('click', () => q('[data-import-input]')?.click());
    q('[data-import-input]')?.addEventListener('change', (e) => this.importFiles(Array.from(e.target.files || [])));
    q('[data-action="start"]')?.addEventListener('click', () => this.beginCountdown());
    q('[data-action="cancel-countdown"]')?.addEventListener('click', () => this.cancelCountdown());
    q('[data-action="pause"]')?.addEventListener('click', () => this.setPaused(true));
    q('[data-action="resume"]')?.addEventListener('click', () => this.setPaused(false));
    q('[data-action="stop"]')?.addEventListener('click', () => this.stopRecording());
    q('[data-action="discard"]')?.addEventListener('click', () => this.discardRecording());
    q('[data-action="save"]')?.addEventListener('click', () => this.saveRecording());
    q('[data-action="use-recording"]')?.addEventListener('click', () => this.useRecording());
  }

  // Live facecam preview while idle.
  async attachPreview() {
    const el = this.overlay?.querySelector('.rr-preview');
    if (!el) return;
    if (this.isRecording && this.streams.webcam) { el.srcObject = this.streams.webcam; return; }
    if (this.previewStream) { el.srcObject = this.previewStream; return; }
    if (!this.sources.webcam || this.isRecording) return;
    try {
      this.previewStream = await navigator.mediaDevices.getUserMedia({ video: this.deviceConstraint(this.selectedCam), audio: false });
      const target = this.overlay?.querySelector('.rr-preview');
      if (target && this.sources.webcam) target.srcObject = this.previewStream;
      else this.stopPreview();
      // Labels become available only after permission is granted.
      this.loadDevices();
    } catch (err) {
      this.sources.webcam = false;
      this.error = `Camera unavailable: ${err.message || err.name}`;
      this.refresh();
    }
  }

  stopPreview() {
    this.previewStream?.getTracks().forEach((t) => t.stop());
    this.previewStream = null;
  }

  // Files rendered/exported by the Remotion Recorder app go straight to the timeline.
  async importFiles(files) {
    if (!files.length) return;
    const probe = (file) => new Promise((resolve) => {
      const isAudio = file.type.startsWith('audio/');
      const el = document.createElement(isAudio ? 'audio' : 'video');
      const url = URL.createObjectURL(file);
      const done = (duration) => { URL.revokeObjectURL(url); resolve(duration); };
      el.preload = 'metadata';
      el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : 0);
      el.onerror = () => done(0);
      el.src = url;
    });
    const sources = await Promise.all(files.map(async (file) => ({
      kind: file.type.startsWith('audio/') ? 'audio' : 'import',
      label: file.name.replace(/\.[^.]+$/, ''),
      blob: file,
      duration: await probe(file)
    })));
    this.onConfirm({
      action: 'recordingComplete',
      blob: sources[0].blob,
      type: sources[0].kind,
      duration: Math.max(...sources.map((x) => x.duration), 1),
      layout: 'separate',
      sources
    });
    this.close();
  }

  // ----- recording -------------------------------------------------------

  beginCountdown() {
    if (!window.MediaRecorder) {
      this.error = 'This browser does not support recording.';
      this.refresh();
      return;
    }
    this.error = '';
    this.countdown = 3;
    this.refresh();
    this.countdownTimer = setInterval(() => {
      this.countdown -= 1;
      if (this.countdown <= 0) {
        clearInterval(this.countdownTimer);
        this.countdown = 0;
        this.startRecording();
      } else {
        const el = this.overlay?.querySelector('.rr-count');
        if (el) el.textContent = this.countdown;
      }
    }, 1000);
  }

  cancelCountdown() {
    clearInterval(this.countdownTimer);
    this.countdown = 0;
    this.refresh();
  }

  mimeFor(kind) {
    const candidates = kind === 'audio'
      ? ['audio/webm;codecs=opus', 'audio/webm']
      : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  }

  // Acquire every selected source first, so a denied permission aborts before anything records.
  async acquireStreams() {
    const q = this.quality;
    const streams = {};
    try {
      if (this.sources.screen) {
        streams.screen = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: q.width }, height: { ideal: q.height }, frameRate: { ideal: q.fps } },
          audio: false
        });
      }
      if (this.sources.webcam) {
        this.stopPreview();
        streams.webcam = await navigator.mediaDevices.getUserMedia({
          video: { ...(this.selectedCam !== 'default' ? { deviceId: { exact: this.selectedCam } } : {}), width: { ideal: q.width }, height: { ideal: q.height }, frameRate: { ideal: q.fps } },
          audio: false
        });
      }
      if (this.sources.mic) {
        streams.mic = await navigator.mediaDevices.getUserMedia({
          audio: { ...(this.selectedMic !== 'default' ? { deviceId: { exact: this.selectedMic } } : {}), echoCancellation: true, noiseSuppression: true },
          video: false
        });
      }
    } catch (err) {
      Object.values(streams).forEach((s) => s.getTracks().forEach((t) => t.stop()));
      throw err;
    }
    return streams;
  }

  // Draws screen full-frame with the facecam as a PiP corner overlay.
  composeStream(screen, cam) {
    const { width, height, fps } = this.quality;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const mk = (stream) => {
      const v = document.createElement('video');
      v.srcObject = stream; v.muted = true; v.playsInline = true;
      v.play().catch(() => {});
      return v;
    };
    const sv = mk(screen);
    const cv = mk(cam);
    this.compositeVideos = [sv, cv];
    const pipW = Math.round(width * 0.22);
    const margin = Math.round(width * 0.0125);
    const draw = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      if (sv.videoWidth) ctx.drawImage(sv, 0, 0, width, height);
      const aspect = cv.videoWidth ? cv.videoHeight / cv.videoWidth : 9 / 16;
      const pipH = Math.round(pipW * aspect);
      if (cv.videoWidth) ctx.drawImage(cv, width - pipW - margin, height - pipH - margin, pipW, pipH);
      this.compositeFrame = requestAnimationFrame(draw);
    };
    this.compositeFrame = requestAnimationFrame(draw);
    return canvas.captureStream(fps);
  }

  async startRecording() {
    let streams;
    try {
      streams = await this.acquireStreams();
    } catch (err) {
      this.error = err?.name === 'NotAllowedError'
        ? 'Permission was denied. Allow screen/camera/microphone access and try again.'
        : `Could not start recording: ${err.message || err.name}`;
      this.refresh();
      return;
    }
    this.streams = streams;

    // Build the list of files to record: { kind, label, stream }.
    const jobs = [];
    const mic = streams.mic?.getAudioTracks() || [];
    if (streams.screen && streams.webcam && this.layout === 'composite') {
      const out = this.composeStream(streams.screen, streams.webcam);
      mic.forEach((t) => out.addTrack(t));
      jobs.push({ kind: 'composite', label: 'Screen + facecam', stream: out });
    } else {
      if (streams.screen) jobs.push({ kind: 'screen', label: 'Screen', stream: streams.screen });
      if (streams.webcam) {
        // Like Remotion Recorder, the voice travels with the facecam file when one exists.
        const camOut = new MediaStream([...streams.webcam.getVideoTracks(), ...mic]);
        jobs.push({ kind: 'webcam', label: mic.length ? 'Facecam + microphone' : 'Facecam', stream: camOut });
      } else if (mic.length) {
        jobs.push({ kind: 'audio', label: 'Microphone', stream: new MediaStream(mic) });
      }
    }

    this.recorders = jobs.map((job) => {
      const chunks = [];
      const mimeType = this.mimeFor(job.kind === 'audio' ? 'audio' : 'video');
      const rec = new MediaRecorder(job.stream, mimeType ? { mimeType } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise((resolve) => {
        rec.onstop = () => resolve({
          kind: job.kind,
          label: job.label,
          blob: new Blob(chunks, { type: rec.mimeType || mimeType || 'video/webm' })
        });
      });
      return { rec, done, job };
    });

    // Ending the screen share from the browser UI stops the take.
    streams.screen?.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (this.isRecording) this.stopRecording();
    });

    this.isRecording = true;
    this.isPaused = false;
    this.recordingTime = 0;
    this.recorders.forEach(({ rec }) => rec.start(1000)); // same tick keeps the sources in sync
    this.recordingInterval = setInterval(() => {
      if (this.isPaused) return;
      this.recordingTime += 1;
      const el = this.overlay?.querySelector('.rec-time');
      if (el) el.textContent = this.formatTime(this.recordingTime);
    }, 1000);
    this.refresh();
  }

  setPaused(paused) {
    this.recorders.forEach(({ rec }) => {
      if (paused && rec.state === 'recording') rec.pause();
      if (!paused && rec.state === 'paused') rec.resume();
    });
    this.isPaused = paused;
    this.refresh();
  }

  async stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    clearInterval(this.recordingInterval);
    const recorders = this.recorders;
    recorders.forEach(({ rec }) => { if (rec.state !== 'inactive') rec.stop(); });
    const results = await Promise.all(recorders.map((r) => r.done));
    this.releaseStreams();
    this.takes = results
      .filter((r) => r.blob.size > 0)
      .map((r) => ({ ...r, url: URL.createObjectURL(r.blob) }));
    if (!this.takes.length) {
      this.takes = null;
      this.error = 'Nothing was recorded.';
    }
    this.refresh();
  }

  releaseStreams() {
    cancelAnimationFrame(this.compositeFrame);
    this.compositeFrame = null;
    (this.compositeVideos || []).forEach((v) => { v.pause(); v.srcObject = null; });
    this.compositeVideos = null;
    Object.values(this.streams).forEach((s) => s?.getTracks().forEach((t) => t.stop()));
    this.streams = {};
    this.stopPreview();
  }

  revokeTakes() {
    (this.takes || []).forEach((t) => URL.revokeObjectURL(t.url));
    this.takes = null;
  }

  discardRecording() {
    this.revokeTakes();
    this.recordingTime = 0;
    this.refresh();
  }

  saveRecording() {
    (this.takes || []).forEach((t) => {
      const a = document.createElement('a');
      a.href = t.url;
      a.download = `recording-${t.kind}-${Date.now()}.webm`;
      a.click();
    });
  }

  useRecording() {
    if (!this.takes) return;
    const primary = this.takes.find((t) => t.kind !== 'audio') || this.takes[0];
    this.onConfirm({
      action: 'recordingComplete',
      // `blob`/`type` keep the original single-file contract for older callers.
      blob: primary.blob,
      type: primary.kind,
      duration: this.recordingTime,
      quality: this.selectedQuality,
      layout: this.layout,
      sources: this.takes.map(({ kind, label, blob }) => ({ kind, label, blob }))
    });
    this.takes = null; // blob URLs are owned by the timeline clips now
    this.close();
  }

  close() {
    clearInterval(this.countdownTimer);
    clearInterval(this.recordingInterval);
    this.recorders.forEach(({ rec }) => { if (rec.state !== 'inactive') { rec.onstop = null; rec.stop(); } });
    this.recorders = [];
    this.releaseStreams();
    this.revokeTakes();
    return super.close();
  }
}

export default RecorderModal;
