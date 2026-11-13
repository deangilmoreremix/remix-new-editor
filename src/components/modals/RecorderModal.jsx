import { BaseModal } from './BaseModal.jsx';
import {
  PREFIXES,
  VISIBLE_BY_DEFAULT,
  VIEW_LABELS,
  VIDEO_SIZES,
  FPS_AVAILABLE,
  attachVolumeMeter,
  canRotateCamera,
  convertTake,
  describeStreamError,
  enumerateDevicesOrTimeOut,
  formatDeviceLabel,
  formatMilliseconds,
  getExtension,
  getMaxResolutionOfDevice,
  getPreferredResolutionForDevice,
  getSelectedVideoSource,
  getVideoStream,
  setPreferredResolutionForDevice,
  startMediaRecorder,
  storage,
  volumeCoverPercent
} from './recorder/capture.js';

// Recorder modal ported from Remotion Recorder (https://www.remotion.dev/docs/recorder).
// Up to four views (Webcam, Screen, Camera 2, Camera 3) are recorded in sync, one file each,
// and land on separate timeline tracks. The microphone belongs to the Webcam view, like the original.

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// The full Remotion Recorder also runs as its own app (apps/remotion-recorder, `npm run dev:remotion-recorder`).
const RECORDER_APP_URL = (() => {
  try { return import.meta.env?.VITE_REMOTION_RECORDER_URL || 'http://localhost:4000'; } catch { return 'http://localhost:4000'; }
})();

const MIRROR_KEY = 'mirrorCamera';
const CROP_KEY = 'showCropIndicator';
const videoPrefKey = (prefix) => `recorder-video-${prefix}`;
const AUDIO_PREF_KEY = 'recorder-audio';

const newView = () => ({
  video: null, // { type: 'camera', device } | { type: 'display-without-audio' } | { type: 'display-with-audio' }
  state: 'initial', // initial | loading | loaded | error
  stream: null,
  error: '',
  resolution: null,
  constraint: { maxSize: null, minimumFps: null },
  portrait: false,
  pickerOpen: false
});

const STYLES = `
  <style>
    .rr-wrap { display:flex; flex-direction:column; gap:14px; padding:20px 24px; overflow:auto; }
    .rr-top { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
    .rr-btn { padding:6px 10px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--panel-soft); color:var(--text); cursor:pointer; font:inherit; font-size:12px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; }
    .rr-btn:hover { border-color:var(--primary); }
    .rr-btn.on { border-color:var(--primary); background:var(--primary-soft); }
    .rr-btn:disabled { opacity:.45; cursor:not-allowed; }
    .rr-views { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; }
    .rr-view { display:flex; flex-direction:column; gap:8px; border:1px solid var(--border-soft, var(--border)); border-radius:var(--radius-md); padding:10px; background:rgba(255,255,255,.02); }
    .rr-vhead { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .rr-vname { font-weight:600; font-size:13px; margin-right:auto; }
    .rr-sel { padding:5px 8px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--panel-soft); color:var(--text); font:inherit; font-size:12px; max-width:170px; }
    .rr-meter { display:flex; height:4px; background-image:linear-gradient(to right,#0b800b,#0b800b 66%,#bda615 66%,#bda615 90%,#800b0b 90%,#800b0b); justify-content:flex-end; border-radius:2px; overflow:hidden; }
    .rr-meter > i { display:block; height:4px; background:#242424; width:85%; }
    .rr-stage { position:relative; aspect-ratio:16/9; background:#000; border-radius:var(--radius-sm); overflow:hidden; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:13px; text-align:center; }
    .rr-stage video { width:100%; height:100%; object-fit:contain; }
    .rr-crop { position:absolute; border:2px solid #F7D449; border-radius:10px; pointer-events:none; }
    .rr-picker { position:absolute; inset:0; background:rgba(0,0,0,.92); padding:12px; display:flex; gap:12px; overflow:auto; text-align:left; }
    .rr-picker > div { flex:1; min-width:0; }
    .rr-picker h5 { margin:0 0 6px; font-size:12px; }
    .rr-item { display:block; width:100%; text-align:left; padding:6px 8px; margin-bottom:4px; border-radius:var(--radius-sm); border:1px solid var(--border); background:transparent; color:var(--text); cursor:pointer; font:inherit; font-size:12px; }
    .rr-item.sel { border-color:var(--primary); background:var(--primary-soft); }
    .rr-overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:16px; background:rgba(0,0,0,.6); color:var(--muted); font-size:13px; }
    .rr-overlay a { color:var(--text); text-decoration:underline; cursor:pointer; }
    .rr-rec { display:flex; align-items:center; gap:8px; font-variant-numeric:tabular-nums; }
    .rr-dot { width:10px; height:10px; border-radius:50%; background:#ef4444; animation:rr-pulse 1s infinite; }
    @keyframes rr-pulse { 50% { opacity:.3; } }
    .rr-takes { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
    .rr-take video { width:100%; border-radius:var(--radius-sm); background:#000; }
    .rr-hint { font-size:12px; color:var(--muted); }
    .rr-err { color:var(--danger); font-size:13px; }
    .rr-seg { display:flex; gap:8px; flex-wrap:wrap; }
  </style>`;

export class RecorderModal extends BaseModal {
  constructor(options = {}) {
    super({ title: 'Screen Recorder', size: 'large', showFooter: false, ...options });

    this.views = Object.fromEntries(PREFIXES.map((p) => [p, newView()]));
    this.audioDeviceId = storage.get(AUDIO_PREF_KEY) || null;
    this.showAllViews = false;
    this.devices = [];
    this.mirror = storage.get(MIRROR_KEY) === null ? true : storage.get(MIRROR_KEY) === 'true';
    this.showCrop = storage.get(CROP_KEY) === 'true';

    this.status = 'idle'; // idle | recording | finished
    this.startDate = 0;
    this.recorders = [];
    this.takes = null;
    this.working = null; // { title, description } while converting
    this.error = '';
    this.meterStops = {};

    this.onKey = (e) => {
      if (e.key.toLowerCase() !== 'r' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (this.status === 'recording') this.stopRecording();
      else if (this.status === 'idle' && this.canRecord()) this.startRecording();
    };
    document.addEventListener('keydown', this.onKey);

    this.loadDevices({ restore: true });
  }

  // ----- helpers -----------------------------------------------------------

  isVisible(prefix) { return this.showAllViews || VISIBLE_BY_DEFAULT[prefix]; }

  get videoInputs() { return this.devices.filter((d) => d.kind === 'videoinput'); }
  get audioInputs() { return this.devices.filter((d) => d.kind === 'audioinput'); }

  deviceLabel(d, i = 0) { return formatDeviceLabel(d.label) || `${d.kind === 'audioinput' ? 'Microphone' : 'Camera'} ${i + 1}`; }

  activeViews() {
    return PREFIXES.filter((p) => this.isVisible(p) && this.views[p].state === 'loaded');
  }

  canRecord() {
    const w = this.views.webcam;
    return w.state === 'loaded' && w.stream?.getVideoTracks().length > 0 && !this.working;
  }

  refresh() {
    if (!this.overlay) return;
    // updateBody() re-runs setupEventListeners() itself; calling it again would double every handler.
    this.updateBody(this.renderBody());
    this.attachStreams();
  }

  // ----- devices -------------------------------------------------------------

  async loadDevices({ restore = false } = {}) {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      this.devices = await enumerateDevicesOrTimeOut();
    } catch (err) {
      this.error = err.message;
      this.refresh();
      return;
    }
    if (restore) {
      // Re-open the cameras/mics used last time (screens need a click, so they are not auto-started).
      for (const prefix of PREFIXES) {
        const saved = storage.get(videoPrefKey(prefix));
        const device = saved && this.videoInputs.find((d) => d.deviceId === saved);
        if (device && this.views[prefix].state === 'initial') {
          this.views[prefix].video = { type: 'camera', device };
          this.views[prefix].constraint = getPreferredResolutionForDevice(device.deviceId);
          this.loadStream(prefix);
        }
      }
    }
    this.refresh();
  }

  // ----- stream lifecycle ------------------------------------------------------

  sourceFor(view) {
    if (!view.video) return null;
    if (view.video.type === 'camera') {
      return getSelectedVideoSource({
        resolutionConstraint: view.constraint,
        maxResolution: getMaxResolutionOfDevice(view.video.device),
        device: view.video.device
      });
    }
    return { type: view.video.type };
  }

  async loadStream(prefix) {
    const view = this.views[prefix];
    this.releaseView(prefix);
    const source = this.sourceFor(view);
    if (!source) { view.state = 'initial'; this.refresh(); return; }

    view.state = 'loading';
    view.error = '';
    this.refresh();
    try {
      const stream = await getVideoStream({
        selectedVideoSource: source,
        preferPortrait: view.portrait,
        recordAudio: prefix === 'webcam',
        selectedAudioSource: this.audioDeviceId
      });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No video track');
      const s = track.getSettings();
      view.resolution = { width: s.width, height: s.height, fps: s.frameRate };
      track.addEventListener('ended', () => {
        if (this.status === 'recording') return; // the recorder handles it and stops the take
        this.clearView(prefix);
      }, { once: true });
      view.stream = stream;
      view.state = 'loaded';
      // Labels only become readable once permission was granted.
      if (view.video.type === 'camera') this.loadDevices();
    } catch (err) {
      view.state = 'error';
      view.error = describeStreamError(err, source, view.portrait);
    }
    this.refresh();
    if (view.state === 'loaded' && prefix === 'webcam') this.startMeter();
  }

  releaseView(prefix) {
    const view = this.views[prefix];
    if (prefix === 'webcam') this.meterStops.webcam?.();
    view.stream?.getTracks().forEach((t) => t.stop());
    view.stream = null;
    view.resolution = null;
  }

  clearView(prefix) {
    const view = this.views[prefix];
    this.releaseView(prefix);
    view.video = null;
    view.state = 'initial';
    view.error = '';
    view.pickerOpen = false;
    storage.set(videoPrefKey(prefix), '');
    this.refresh();
  }

  startMeter() {
    this.meterStops.webcam?.();
    const stream = this.views.webcam.stream;
    this.meterStops.webcam = attachVolumeMeter(stream, (level) => {
      const bar = this.overlay?.querySelector('[data-meter-cover="webcam"]');
      if (bar) bar.style.width = `${volumeCoverPercent(level)}%`;
    });
  }

  attachStreams() {
    PREFIXES.forEach((prefix) => {
      const el = this.overlay?.querySelector(`video[data-live="${prefix}"]`);
      const { stream } = this.views[prefix];
      if (el && stream) { el.srcObject = stream; el.play().catch(() => {}); }
    });
    if (this.takes) {
      this.overlay?.querySelectorAll('video[data-take]').forEach((el) => {
        const take = this.takes.find((t) => t.prefix === el.dataset.take);
        if (take) el.src = take.url;
      });
    }
  }

  // ----- rendering ---------------------------------------------------------------

  renderBody() {
    const recording = this.status === 'recording';
    const shown = PREFIXES.filter((p) => this.isVisible(p));
    return `
      ${STYLES}
      <div class="rr-wrap recorder-container">
        <div class="rr-top">
          <div class="rr-seg">
            <button class="rr-btn ${this.showAllViews ? 'on' : ''}" data-act="toggle-all" ${recording ? 'disabled' : ''} data-tooltip="Show Camera 2 and Camera 3 as well">${this.showAllViews ? 'Hide extra views' : 'Show all views'}</button>
            <button class="rr-btn" data-act="rescan" ${recording ? 'disabled' : ''} data-tooltip="Look for newly connected cameras and microphones">⟳ Rescan devices</button>
          </div>
          <div class="rr-seg">
            <a class="rr-btn" href="${escapeHtml(RECORDER_APP_URL)}" target="_blank" rel="noopener noreferrer" data-tooltip="Opens the standalone Remotion Recorder app">↗ Full Recorder app</a>
            <button class="rr-btn" data-act="import" data-tooltip="Add a video or audio file exported from the Recorder">⬆ Import</button>
            <input type="file" data-import-input accept="video/*,audio/*" multiple hidden>
          </div>
        </div>

        ${this.error ? `<div class="rr-err" role="alert">${escapeHtml(this.error)}</div>` : ''}

        <div class="rr-views">${shown.map((p) => this.renderView(p)).join('')}</div>

        ${this.takes ? `
        <div>
          <div class="rr-hint" style="margin-bottom:8px">Review your take</div>
          <div class="rr-takes">
            ${this.takes.map((t) => `
              <div class="rr-take"><video data-take="${t.prefix}" controls playsinline></video>
              <div class="rr-hint">${escapeHtml(VIEW_LABELS[t.prefix])} · .${getExtension(t.mimeType)}</div></div>`).join('')}
          </div>
        </div>` : ''}

        ${this.working ? `<div class="rr-hint" data-working>${escapeHtml(this.working.title)} — ${escapeHtml(this.working.description)}</div>` : ''}
      </div>

      <div class="modal-footer recorder-footer">
        <div class="footer-left">
          ${recording ? `<div class="rr-rec"><span class="rr-dot"></span><span data-timer>${formatMilliseconds(Date.now() - this.startDate)}</span></div>` : ''}
        </div>
        <div class="footer-right">${this.renderFooter()}</div>
      </div>
    `;
  }

  renderFooter() {
    if (this.working) return '<button class="modal-btn modal-btn-secondary" data-act="cancel-work">Cancel</button>';
    if (this.status === 'finishing') return '<button class="modal-btn modal-btn-secondary" disabled>Saving take…</button>';
    if (this.status === 'recording') return '<button class="modal-btn modal-btn-danger" data-act="stop" data-tooltip="Press R to stop">⏹ Stop recording</button>';
    if (this.status === 'finished') {
      return `
        <button class="modal-btn modal-btn-secondary" data-act="discard">🗑 Discard</button>
        <button class="modal-btn modal-btn-secondary" data-act="retake">↺ Discard &amp; retake</button>
        <button class="modal-btn modal-btn-secondary" data-act="save">💾 Save files</button>
        <button class="modal-btn modal-btn-primary" data-act="use-take">Use this take</button>`;
    }
    const cams = this.activeViews().length;
    const mics = this.audioDeviceId && this.views.webcam.stream?.getAudioTracks().length ? 1 : 0;
    const ok = this.canRecord();
    return `
      <button class="modal-btn modal-btn-secondary modal-cancel">Cancel</button>
      <button class="modal-btn modal-btn-primary" data-act="start" ${ok ? '' : 'disabled'} data-tooltip="${ok ? 'Press R to start recording' : 'Select a video source on the Webcam view to start recording'}">
        ⏺ ${ok ? 'Start recording' : 'Select video to record'}${ok ? ` · 📷 ${cams}${mics ? ' · 🎤 ' + mics : ''}` : ''}
      </button>`;
  }

  renderView(prefix) {
    const view = this.views[prefix];
    const isWebcam = prefix === 'webcam';
    const recording = this.status === 'recording';
    const isCamera = view.video?.type === 'camera';
    const source = this.sourceFor(view);
    const rotatable = canRotateCamera({ selectedSource: source, preferPortrait: view.portrait, resolution: view.resolution });
    const maxRes = isCamera ? getMaxResolutionOfDevice(view.video.device) : null;

    const sizes = Object.entries(VIDEO_SIZES).filter(([, v]) =>
      !maxRes || ((maxRes.width === null || v.width <= maxRes.width) && (maxRes.height === null || v.height <= maxRes.height)));
    const fpsList = FPS_AVAILABLE.filter((f) => !maxRes || maxRes.frameRate === null || f <= maxRes.frameRate).reverse();

    const sourceLabel = !view.video ? 'Select video'
      : view.video.type === 'display-with-audio' ? 'Screen + audio'
      : view.video.type === 'display-without-audio' ? 'Screen'
      : this.deviceLabel(view.video.device);

    return `
      <div class="rr-view" data-view="${prefix}">
        <div class="rr-vhead">
          <span class="rr-vname">${VIEW_LABELS[prefix]}</span>
          <button class="rr-btn" data-act="picker" data-prefix="${prefix}" ${recording ? 'disabled' : ''}>${escapeHtml(sourceLabel)}</button>
          ${isWebcam ? `<button class="rr-btn" data-act="picker" data-prefix="${prefix}" ${recording ? 'disabled' : ''} data-tooltip="Microphone">🎤 ${escapeHtml(this.audioLabel())}</button>` : ''}
          ${view.video && !recording ? `<button class="rr-btn" data-act="clear" data-prefix="${prefix}" data-tooltip="Remove this source">✕</button>` : ''}
        </div>
        <div class="rr-vhead">
          ${isWebcam ? `<button class="rr-btn ${this.showCrop ? 'on' : ''}" data-act="crop" data-tooltip="Show crop guide for the facecam overlay">⛶ Crop guide</button>` : ''}
          ${isWebcam && isCamera ? `<button class="rr-btn ${this.mirror ? 'on' : ''}" data-act="mirror" ${recording ? 'disabled' : ''} data-tooltip="Mirror the preview (the recorded file is not mirrored)">⇋ Mirror</button>` : ''}
          ${rotatable || view.portrait ? `<button class="rr-btn ${view.portrait ? 'on' : ''}" data-act="rotate" data-prefix="${prefix}" ${recording ? 'disabled' : ''} data-tooltip="Record in portrait">⟳ Portrait</button>` : ''}
          ${isCamera ? `
            <select class="rr-sel" data-act="size" data-prefix="${prefix}" ${recording ? 'disabled' : ''} data-tooltip="Limit the resolution for this camera">
              <option value="full" ${!view.constraint.maxSize ? 'selected' : ''}>Max resolution</option>
              ${sizes.map(([k]) => `<option value="${k}" ${view.constraint.maxSize === k ? 'selected' : ''}>${k}</option>`).join('')}
            </select>
            <select class="rr-sel" data-act="fps" data-prefix="${prefix}" ${recording ? 'disabled' : ''} data-tooltip="Minimum frame rate">
              <option value="any" ${!view.constraint.minimumFps ? 'selected' : ''}>Any FPS</option>
              ${fpsList.map((f) => `<option value="${f}" ${view.constraint.minimumFps === f ? 'selected' : ''}>≥ ${f} fps</option>`).join('')}
            </select>` : ''}
          ${view.resolution ? `<span class="rr-hint">${view.resolution.width}×${view.resolution.height}${view.resolution.fps ? ' · ' + Math.round(view.resolution.fps) + ' fps' : ''}</span>` : ''}
        </div>
        ${isWebcam ? '<div class="rr-meter"><i data-meter-cover="webcam"></i></div>' : ''}
        <div class="rr-stage">
          <video data-live="${prefix}" muted playsinline style="${isWebcam && isCamera && this.mirror ? 'transform:scaleX(-1);' : ''}${view.state === 'loaded' ? '' : 'opacity:0;'}"></video>
          ${isWebcam && this.showCrop && view.resolution && view.state === 'loaded' && !view.pickerOpen ? this.renderCrop(view.resolution) : ''}
          ${view.state === 'initial' && !view.pickerOpen ? '<div class="rr-overlay" style="background:none">No source selected</div>' : ''}
          ${view.state === 'loading' ? '<div class="rr-overlay">Opening…</div>' : ''}
          ${view.state === 'error' ? `<div class="rr-overlay">${escapeHtml(view.error)}<a data-act="retry" data-prefix="${prefix}">Try again</a></div>` : ''}
          ${view.pickerOpen ? this.renderPicker(prefix) : ''}
        </div>
      </div>`;
  }

  audioLabel() {
    const d = this.audioInputs.find((x) => x.deviceId === this.audioDeviceId);
    return d ? this.deviceLabel(d) : 'No microphone';
  }

  // 350×400 guide, fitted inside the video the same way the Recorder does.
  renderCrop(res) {
    const ar = res.width / res.height; // video aspect vs. 16:9 stage
    const stageAr = 16 / 9;
    const videoW = ar >= stageAr ? 100 : (ar / stageAr) * 100;
    const videoH = ar >= stageAr ? (stageAr / ar) * 100 : 100;
    // Fit 350x400 inside the video: height-limited for landscape videos.
    const guideAr = 350 / 400;
    const wPct = Math.min(videoW, (videoH * stageAr * guideAr));
    const hPct = wPct / stageAr / guideAr;
    return `<div class="rr-crop" style="width:${wPct}%;height:${hPct}%;left:${(100 - wPct) / 2}%;top:${(100 - hPct) / 2}%"></div>`;
  }

  renderPicker(prefix) {
    const view = this.views[prefix];
    const sel = view.video?.type === 'camera' ? view.video.device.deviceId : view.video?.type;
    return `
      <div class="rr-picker">
        <div>
          <h5>Select video</h5>
          <button class="rr-item ${sel === 'display-without-audio' ? 'sel' : ''}" data-act="pick-screen" data-prefix="${prefix}" data-audio="0">🖥 Screen capture</button>
          <button class="rr-item ${sel === 'display-with-audio' ? 'sel' : ''}" data-act="pick-screen" data-prefix="${prefix}" data-audio="1">🖥 Screen capture with audio</button>
          ${this.videoInputs.map((d, i) => `<button class="rr-item ${sel === d.deviceId ? 'sel' : ''}" data-act="pick-camera" data-prefix="${prefix}" data-id="${escapeHtml(d.deviceId)}">📷 ${escapeHtml(this.deviceLabel(d, i))}</button>`).join('')}
        </div>
        ${prefix === 'webcam' ? `
        <div>
          <h5>Select audio</h5>
          ${this.audioInputs.map((d, i) => `<button class="rr-item ${this.audioDeviceId === d.deviceId ? 'sel' : ''}" data-act="pick-audio" data-id="${escapeHtml(d.deviceId)}">🎤 ${escapeHtml(this.deviceLabel(d, i))}</button>`).join('') || '<div class="rr-hint">No microphones found</div>'}
        </div>` : ''}
        <button class="rr-btn" data-act="picker" data-prefix="${prefix}" style="position:absolute;top:8px;right:8px">Done</button>
      </div>`;
  }

  // ----- events ----------------------------------------------------------------------

  setupEventListeners() {
    super.setupEventListeners();
    const root = this.overlay;

    root.querySelectorAll('[data-act]').forEach((el) => {
      const act = el.dataset.act;
      const prefix = el.dataset.prefix;
      const evt = el.tagName === 'SELECT' ? 'change' : 'click';
      el.addEventListener(evt, (e) => this.handle(act, prefix, el, e));
    });
    root.querySelector('[data-import-input]')?.addEventListener('change', (e) => this.importFiles(Array.from(e.target.files || [])));
  }

  handle(act, prefix, el) {
    const view = prefix ? this.views[prefix] : null;
    switch (act) {
      case 'toggle-all':
        this.showAllViews = !this.showAllViews;
        this.refresh();
        break;
      case 'rescan':
        this.loadDevices();
        break;
      case 'import':
        this.overlay.querySelector('[data-import-input]')?.click();
        break;
      case 'picker':
        view.pickerOpen = !view.pickerOpen;
        this.refresh();
        break;
      case 'clear':
        this.clearView(prefix);
        break;
      case 'retry':
        this.loadStream(prefix);
        break;
      case 'pick-screen':
        view.video = { type: el.dataset.audio === '1' ? 'display-with-audio' : 'display-without-audio' };
        view.pickerOpen = false;
        storage.set(videoPrefKey(prefix), view.video.type);
        this.loadStream(prefix);
        break;
      case 'pick-camera': {
        const device = this.videoInputs.find((d) => d.deviceId === el.dataset.id);
        if (!device) break;
        view.video = { type: 'camera', device };
        view.constraint = getPreferredResolutionForDevice(device.deviceId);
        view.pickerOpen = false;
        storage.set(videoPrefKey(prefix), device.deviceId);
        this.loadStream(prefix);
        break;
      }
      case 'pick-audio':
        this.audioDeviceId = el.dataset.id;
        storage.set(AUDIO_PREF_KEY, this.audioDeviceId);
        this.views.webcam.pickerOpen = false;
        if (this.views.webcam.video) this.loadStream('webcam');
        else this.refresh();
        break;
      case 'crop':
        this.showCrop = !this.showCrop;
        storage.set(CROP_KEY, String(this.showCrop));
        this.refresh();
        break;
      case 'mirror':
        this.mirror = !this.mirror;
        storage.set(MIRROR_KEY, String(this.mirror));
        this.refresh();
        break;
      case 'rotate':
        view.portrait = !view.portrait;
        this.loadStream(prefix);
        break;
      case 'size':
        view.constraint = { ...view.constraint, maxSize: el.value === 'full' ? null : el.value };
        setPreferredResolutionForDevice(view.video.device.deviceId, view.constraint);
        this.loadStream(prefix);
        break;
      case 'fps':
        view.constraint = { ...view.constraint, minimumFps: el.value === 'any' ? null : Number(el.value) };
        setPreferredResolutionForDevice(view.video.device.deviceId, view.constraint);
        this.loadStream(prefix);
        break;
      case 'start': this.startRecording(); break;
      case 'stop': this.stopRecording(); break;
      case 'discard': this.discardTake(); break;
      case 'retake': this.discardTake().then(() => this.startRecording()); break;
      case 'save': this.saveTake(); break;
      case 'use-take': this.useTake(); break;
      case 'cancel-work': this.workAbort?.(); break;
      default: break;
    }
  }

  // ----- recording ------------------------------------------------------------------------

  async startRecording() {
    if (!this.canRecord() || this.status === 'recording') return;
    this.error = '';
    const timestamp = Date.now();
    try {
      const recorders = await Promise.all(this.activeViews().map((prefix) =>
        startMediaRecorder({ prefix, timestamp, stream: this.views[prefix].stream })));
      this.recorders = recorders;
    } catch (err) {
      this.error = `Could not start recording: ${err.message}`;
      this.refresh();
      return;
    }
    this.startDate = timestamp;
    this.status = 'recording';

    // If any track ends, the take is over (the recorder already stopped itself).
    this.recorders.forEach((r) => r.stream.getTracks().forEach((t) =>
      t.addEventListener('ended', () => { if (this.status === 'recording') this.stopRecording(); }, { once: true })));

    this.timerInterval = setInterval(() => {
      const el = this.overlay?.querySelector('[data-timer]');
      if (el) el.textContent = formatMilliseconds(Date.now() - this.startDate);
    }, 1000);
    this.refresh();
  }

  async stopRecording() {
    if (this.status !== 'recording') return;
    this.status = 'finishing';
    clearInterval(this.timerInterval);
    const recorders = this.recorders;
    let finished;
    try {
      finished = await Promise.all(recorders.map((r) => r.stopAndWaitUntilDone()));
    } catch (err) {
      this.status = 'idle';
      this.error = err.message;
      this.refresh();
      return;
    }
    this.duration = (Date.now() - this.startDate) / 1000;
    this.takes = await Promise.all(finished.map(async (f) => {
      const file = await f.data();
      return { prefix: f.prefix, mimeType: f.mimeType, file, url: URL.createObjectURL(file), release: f.releaseData };
    }));
    this.recorders = [];
    this.status = 'finished';
    this.refresh();
  }

  async discardTake() {
    const takes = this.takes || [];
    takes.forEach((t) => URL.revokeObjectURL(t.url));
    await Promise.all(takes.map((t) => t.release().catch(() => {})));
    this.takes = null;
    this.status = 'idle';
    this.refresh();
  }

  saveTake() {
    (this.takes || []).forEach((t) => {
      const a = document.createElement('a');
      a.href = t.url;
      a.download = `${t.prefix}${this.startDate}.${getExtension(t.mimeType)}`;
      a.click();
    });
  }

  async useTake() {
    if (!this.takes || this.working) return;
    let aborted = false;
    this.workAbort = () => { aborted = true; this.convertAbort?.(); };
    const sources = [];
    try {
      for (const take of this.takes) {
        if (aborted) break;
        this.working = { title: `Converting ${VIEW_LABELS[take.prefix]}`, description: 'Starting…' };
        this.refresh();
        let blob = await convertTake({
          src: take.file,
          mimeType: take.mimeType,
          onProgress: (p, abort) => {
            this.convertAbort = abort;
            const el = this.overlay?.querySelector('[data-working]');
            if (el) el.textContent = `Converting ${VIEW_LABELS[take.prefix]} — ${Math.round(p * 100)}%`;
          }
        });
        // Copy out of file storage so the file can be released safely.
        if (blob === take.file) blob = new Blob([await take.file.arrayBuffer()], { type: take.file.type });
        sources.push({ kind: take.prefix, label: VIEW_LABELS[take.prefix], blob, mimeType: take.mimeType, mirror: take.prefix === 'webcam' && this.mirror });
      }
    } catch (err) {
      this.working = null;
      this.error = `Could not prepare the take: ${err.message}`;
      this.refresh();
      return;
    }
    this.working = null;
    if (aborted || !sources.length) { this.refresh(); return; }

    const primary = sources.find((s) => s.kind === 'display') || sources[0];
    const duration = this.duration;
    await this.discardTake();
    this.onConfirm({
      action: 'recordingComplete',
      // `blob`/`type` keep the original single-file contract for older callers.
      blob: primary.blob,
      type: primary.kind,
      duration,
      layout: 'separate',
      sources
    });
    this.close();
  }

  // Files rendered/exported by the standalone Remotion Recorder app go straight to the timeline.
  async importFiles(files) {
    if (!files.length) return;
    const probe = (file) => new Promise((resolve) => {
      const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
      const url = URL.createObjectURL(file);
      const done = (d) => { URL.revokeObjectURL(url); resolve(d); };
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

  close() {
    document.removeEventListener('keydown', this.onKey);
    clearInterval(this.timerInterval);
    this.recorders.forEach((r) => { try { r.recorder.state !== 'inactive' && r.recorder.stop(); } catch { /* already stopped */ } });
    this.recorders = [];
    PREFIXES.forEach((p) => this.releaseView(p));
    (this.takes || []).forEach((t) => { URL.revokeObjectURL(t.url); t.release?.().catch(() => {}); });
    this.takes = null;
    return super.close();
  }
}

export default RecorderModal;
