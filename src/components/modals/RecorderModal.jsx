import { BUILTIN_BACKGROUNDS, effectsActive, loadEffects, saveEffects, applyCameraEffects } from '../../lib/recorder/effects.js';
import { BaseModal } from './BaseModal.jsx';
import { keepAwake } from '../../lib/recorder/wakeLock.js';
import { mediaPermissions, permissionMessage, watchMediaPermissions } from '../../lib/recorder/permissions.js';
import { COLORS as DRAW_COLORS, pointOnPicture } from '../../lib/recorder/annotate.js';
import { createTeleprompterClock, loadTeleprompter, readingPosition, saveTeleprompter, scriptLines, teleprompterSettings } from '../../lib/recorder/teleprompter.js';
import { openMonitorWindow, monitorSupported } from '../../lib/recorder/monitorWindow.js';
import { createLevelMeter, levelHint, loadAudioSettings, mixAudioTracks, recordMicTest, saveAudioSettings } from '../../lib/recorder/audio.js';
import { createCountdown } from '../../lib/recorder/countdown.js';

// Camera quality. Screen recordings use the screen's own size; audio takes have none.
const QUALITY_OPTIONS = [
  { id: '1080p', name: '1080p HD', resolution: '1920x1080', fps: 30 },
  { id: '720p', name: '720p', resolution: '1280x720', fps: 30 },
  { id: '480p', name: '480p', resolution: '854x480', fps: 30 }
];

const MODES = [
  { id: 'screen', label: 'Screen', title: 'Record your screen', tip: 'Record your screen, a window or a tab, with your voice' },
  { id: 'camera', label: 'Camera', title: 'Record your camera', tip: 'Record yourself on camera' },
  { id: 'both', label: 'Screen + Camera', title: 'Record screen and camera', tip: 'Your screen with your face in a bubble. Each source is also kept as its own file.' },
  { id: 'audio', label: 'Audio', title: 'Record audio', tip: 'Record your voice only' },
];

const DEFAULT_MIC_OPTIONS = [{ id: 'default', label: 'Default microphone' }];
const DEFAULT_CAMERA_OPTIONS = [{ id: 'default', label: 'Default camera' }];
const COUNTDOWN_KEY = 'recorder-countdown';

// Outline icons (stroke = currentColor), so buttons stay unfilled.
const ICON_PATHS = {
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  camera: '<path d="M15 10l5-3v10l-5-3z"/><rect x="3" y="6" width="12" height="12" rx="2"/>',
  both: '<rect x="3" y="4" width="18" height="12" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M8 20h8"/>',
  audio: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  micOff: '<path d="M3 3l18 18M9 9v2a3 3 0 0 0 5 2.2M15 9.5V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.6 2.8M12 18v3"/>',
  script: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 10h7M9 14h7M9 18h4"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  spot: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  share: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 13V7M9 10l3-3 3 3M8 20h8"/>',
};
const icon = (name, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
const escAttr = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// A full-screen recorder: big preview in the middle, side panel for settings, controls along the bottom.
const RECORDER_STYLES = `
  .modal-content.rec-modal { max-width: none !important; width: 100% !important; border-left: 0; background: #0b0c0f; }
  .rec-modal .modal-header { padding: 12px 20px; }
  .rec-modal .modal-body { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 12px 20px 0; overflow: auto; }
  .recorder-container { flex: 1; display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0; }
  .recorder-container button { font: inherit; cursor: pointer; }
  .rec-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
  .recorder-type-selector { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--border); border-radius: 12px; }
  .recorder-type-selector .type-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border: 1px solid transparent; border-radius: 9px; background: transparent; color: var(--muted); font-size: 13px; font-weight: 600; white-space: nowrap; }
  .recorder-type-selector .type-btn:hover { color: var(--text); }
  .recorder-type-selector .type-btn.active { border-color: var(--primary); color: var(--primary); }
  .rec-mode-label { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; font-weight: 600; }
  .rec-tools { display: flex; flex-wrap: wrap; gap: 6px; }
  .preview-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--text); font-size: 12px; font-weight: 600; white-space: nowrap; }
  .preview-toggle:hover { border-color: rgba(255,255,255,.32); }
  .preview-toggle.active { border-color: var(--primary); color: var(--primary); }
  .preview-toggle:disabled { opacity: .5; cursor: default; }
  .rec-main { flex: 1; display: flex; gap: 16px; min-height: 0; }
  .rec-stage { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
  .preview-viewport { position: relative; padding: 0; width: min(100%, calc((100vh - 270px) * 16 / 9)); aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden; background: #000; border: 1px solid var(--border); }
  .preview-viewport > div { position: absolute; inset: 0; }
  .preview-viewport .webcam-feed, .preview-viewport .screen-choice { width: 100%; height: 100%; object-fit: cover; display: block; }
  .preview-viewport .screen-choice { object-fit: contain; }
  .preview-placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; text-align: center; color: var(--muted); font-size: 14px; }
  .preview-placeholder svg { opacity: .7; }
  .combined-preview .screen-area { position: absolute; inset: 0; }
  .audio-preview { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--muted); font-size: 14px; }
  .rec-big-meter { width: 60%; height: 14px; border-radius: 999px; border: 1px solid var(--border); overflow: hidden; }
  .rec-big-meter > span, .rec-meter > span { display: block; height: 100%; width: 0; background: #2fb344; transition: width .06s linear; }
  .preview-viewport > .recording-status { position: absolute; top: 12px; left: 12px; right: auto; bottom: auto; z-index: 5; display: flex; align-items: center; gap: 8px; padding: 5px 11px; border-radius: 999px; background: rgba(0,0,0,.6); color: #fff; font-size: 13px; font-weight: 700; }
  .rec-dot { width: 9px; height: 9px; border-radius: 50%; background: #ef4444; animation: rec-blink 1.2s ease-in-out infinite; }
  .is-paused .rec-dot { animation: none; background: #f5a524; }
  @keyframes rec-blink { 50% { opacity: .3; } }
  .rec-count { position: absolute; inset: 0; z-index: 6; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: rgba(0,0,0,.45); color: #fff; cursor: pointer; }
  .rec-count b { font-size: 120px; line-height: 1; font-weight: 800; }
  .rec-count span { font-size: 13px; opacity: .8; }
  .rec-side { width: 340px; flex: none; overflow: auto; max-height: calc(100vh - 220px); }
  .rec-panel { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; }
  .rec-panel h4 { margin: 4px 0 0; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .rec-switch { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: start; font-size: 13px; cursor: pointer; }
  .rec-switch input { margin-top: 3px; }
  .rec-switch small { grid-column: 2; color: var(--muted); font-size: 11px; line-height: 1.35; }
  .quality-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .quality-btn { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 9px; background: transparent; color: var(--text); font-size: 12px; text-align: left; }
  .quality-btn.active { border-color: var(--primary); color: var(--primary); }
  .quality-res { color: var(--muted); font-size: 11px; }
  .recorder-notice { font-size: 13px; color: var(--muted); text-align: center; max-width: 720px; }
  .rec-review-video { width: min(100%, calc((100vh - 330px) * 16 / 9)); max-height: calc(100vh - 330px); border-radius: 14px; background: #000; border: 1px solid var(--border); }
  .rec-busy { display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--muted); font-size: 14px; }
  .rec-spinner { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(255,255,255,.15); border-top-color: var(--primary); animation: rec-spin .8s linear infinite; }
  @keyframes rec-spin { to { transform: rotate(360deg); } }
  .rec-trim { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; width: min(100%, 720px); font-size: 12px; color: var(--muted); }
  .rec-trim-track { position: relative; height: 28px; }
  .rec-trim-track input { position: absolute; inset: 0; width: 100%; margin: 0; background: transparent; pointer-events: none; -webkit-appearance: none; appearance: none; }
  .rec-trim-track input::-webkit-slider-thumb { pointer-events: auto; -webkit-appearance: none; width: 14px; height: 26px; border-radius: 4px; border: 2px solid var(--primary); background: #0b0c0f; cursor: ew-resize; }
  .rec-trim-track input::-moz-range-thumb { pointer-events: auto; width: 12px; height: 24px; border-radius: 4px; border: 2px solid var(--primary); background: #0b0c0f; cursor: ew-resize; }
  .rec-trim-rail { position: absolute; left: 0; right: 0; top: 11px; height: 6px; border-radius: 999px; background: rgba(255,255,255,.12); }
  .rec-trim-kept { position: absolute; top: 11px; height: 6px; border-radius: 999px; background: var(--primary); }
  .rec-bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 12px 0 16px; border-top: 1px solid var(--border); }
  .rec-bar-left, .rec-bar-right { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
  .rec-bar-right { justify-content: flex-end; }
  .rec-bar-center { display: flex; align-items: center; gap: 10px; }
  .rec-select { max-width: 210px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--panel); color: var(--text); font: inherit; font-size: 12px; }
  .rec-meter { width: 70px; height: 8px; border-radius: 999px; border: 1px solid var(--border); overflow: hidden; }
  .rec-hint { font-size: 11px; color: #f5a524; }
  .rec-go { width: 62px; height: 62px; border-radius: 50%; border: 2px solid #ef4444; background: transparent; color: #ef4444; display: grid; place-items: center; }
  .rec-go:hover { border-color: #ff6b6b; color: #ff6b6b; }
  .rec-go.stop { border-color: #ef4444; }
  .rec-time { min-width: 56px; font-variant-numeric: tabular-nums; font-weight: 700; font-size: 15px; }
  .rec-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: var(--text); font-size: 13px; font-weight: 600; white-space: nowrap; }
  .rec-btn:hover { border-color: rgba(255,255,255,.32); }
  .rec-btn.primary { border-color: var(--primary); color: var(--primary); }
  .rec-btn.danger { border-color: rgba(239,68,68,.6); color: #ff8a8d; }
  .rec-btn:disabled { opacity: .5; cursor: default; }
  .rec-keys { font-size: 11px; color: var(--muted); }
  @media (max-width: 900px) {
    .rec-main { flex-direction: column; }
    .rec-side { width: auto; max-height: none; }
    .preview-viewport { width: 100%; }
    .rec-bar { grid-template-columns: 1fr; justify-items: center; }
    .rec-bar-left, .rec-bar-right { justify-content: center; }
    .recorder-type-selector { width: 100%; overflow-x: auto; }
  }
`;

export class RecorderModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Record',
      size: 'full',
      showFooter: false,
      closeOnBackdrop: false,
      ...options
    });

    this.recordingType = 'screen';
    this.selectedQuality = '1080p';
    this.micOptions = DEFAULT_MIC_OPTIONS;
    this.selectedMic = 'default';
    this.cameraList = DEFAULT_CAMERA_OPTIONS;
    this.selectedCamera = 'default';
    this.micEnabled = true;
    // Noise suppression, echo cancellation, automatic volume, computer sound (src/lib/recorder/audio.js).
    this.audio = loadAudioSettings();
    // Seconds of 3-2-1 before a take (0 = start at once). Tests set 0.
    this.countdownSeconds = options.countdown ?? readCountdown();
    this.counting = null;
    this.countValue = 0;
    // 'circle' is the face bubble used by video-outreach tools; 'rounded' is a
    // plain picture-in-picture rectangle. Only used by the Both (screen + cam) mode.
    this.camShape = 'circle';
    // Camera effects (src/lib/recorder/effects.js): blur, virtual background, touch-up, mirror.
    this.effects = loadEffects();
    this.showEffects = false;
    this.showSettings = false;
    // Teleprompter (src/lib/recorder/teleprompter.js): the script over the preview, never recorded.
    // A script passed in (Video Outreach's Script card) wins over the last one used.
    this.prompter = teleprompterSettings({ ...loadTeleprompter(), ...(options.script ? { script: options.script, on: true } : {}) });
    this.onScriptChange = options.onScriptChange || null;
    this.showPrompterPanel = false;
    this.prompterClock = createTeleprompterClock();
    this.prompterClock.onFrame((ms) => this.paintPrompter(ms));
    // Drawing on screen (src/lib/recorder/annotate.js) and camera spotlight (Both), while recording.
    this.annotator = null;
    this.drawTool = 'pen';
    this.drawColor = DRAW_COLORS[0];
    this.spotlights = [];   // [{ start, end }] in seconds of the take
    this.activeMs = 0;      // recorded time, without pauses
    this.activeSince = null;
    this.previewFx = null;
    this.isRecording = false;
    this.isPaused = false;
    this.recordingTime = 0;
    this.recordedBlob = null;
    this.previewUrl = null;
    this.takeLength = 0;            // seconds of the finished take
    this.trim = { start: 0, end: null };
    // Raw per-source recordings from a Both take, kept so a later editor can
    // re-layout screen and camera independently. { screen?: Blob, camera?: Blob }
    this.trackBlobs = {};
    this.hasAudio = false;
    this.notice = '';
    this.webcamStream = null; // live camera preview only
    this.chosenDisplay = null; // a screen chosen before recording (shown in the preview)
    this.meterStream = null;  // microphone for the level meter before recording
    this.stopMeter = null;
    this.liveStreams = [];    // the streams being recorded
    this.session = null;      // src/lib/recorder/session.js
    this.stopping = false;
    this.combining = false;
    this.recordingInterval = null;

    // Fire-and-forget: populates real input devices once permission/labels
    // are available, then re-renders the camera and microphone pickers.
    this.loadMicDevices();
  }

  // Cameras and microphones (labels appear once the browser has been allowed to use them).
  async loadMicDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      const cams = devices.filter(d => d.kind === 'videoinput');
      if (mics.length) {
        this.micOptions = mics.map((d, i) => ({ id: d.deviceId || 'default', label: d.label || `Microphone ${i + 1}` }));
        if (!this.micOptions.some(m => m.id === this.selectedMic)) this.selectedMic = this.micOptions[0].id;
      }
      if (cams.length) {
        this.cameraList = cams.map((d, i) => ({ id: d.deviceId || 'default', label: d.label || `Camera ${i + 1}` }));
        if (!this.cameraList.some(c => c.id === this.selectedCamera)) this.selectedCamera = this.cameraList[0].id;
      }
      if ((mics.length || cams.length) && this.overlay && this.phase === 'setup') this.rerender();
    } catch (err) {
      console.error('Failed to list cameras and microphones:', err);
    }
  }

  // setup → (countdown) → recording → review
  get phase() {
    if (this.counting) return 'countdown';
    if (this.isRecording) return 'recording';
    if (this.recordedBlob || this.stopping || this.combining) return 'review';
    return 'setup';
  }

  usesCamera() { return this.recordingType === 'camera' || this.recordingType === 'both'; }
  usesScreen() { return this.recordingType === 'screen' || this.recordingType === 'both'; }
  usesMic() { return this.recordingType === 'audio' || this.micEnabled; }

  renderBody() {
    const phase = this.phase;
    const mode = MODES.find((m) => m.id === this.recordingType) || MODES[0];
    return `
      <style>${RECORDER_STYLES}</style>
      <div class="recorder-container" data-phase="${phase}">
        <div class="rec-top">
          ${phase === 'setup' ? `
            <div class="recorder-type-selector" role="tablist">
              ${MODES.map((m) => `<button type="button" role="tab" aria-selected="${m.id === this.recordingType}" class="type-btn ${m.id === this.recordingType ? 'active' : ''}" data-type="${m.id}" data-tooltip="${escAttr(m.tip)}">${icon(m.id)}<span class="type-label">${m.label}</span></button>`).join('')}
            </div>
            <div class="rec-tools">
              ${this.recordingType !== 'audio' ? `<button type="button" class="preview-toggle ${this.prompter.on ? 'active' : ''}" data-action="toggle-prompter" data-tooltip="Show your script over the preview while you record">${icon('script', 14)} Teleprompter</button>` : ''}
              ${this.usesCamera() ? `<button type="button" class="preview-toggle ${effectsActive(this.effects) || this.showEffects ? 'active' : ''}" data-action="toggle-effects" data-tooltip="Background blur, virtual background, touch-up and mirror">${icon('sparkle', 14)} Effects</button>` : ''}
              ${this.recordingType === 'both' ? `
                <button type="button" class="preview-toggle ${this.camShape === 'circle' ? 'active' : ''}" data-shape="circle" data-tooltip="Round face bubble">Circle</button>
                <button type="button" class="preview-toggle ${this.camShape === 'rounded' ? 'active' : ''}" data-shape="rounded" data-tooltip="Rounded rectangle camera">Rectangle</button>
              ` : ''}
              <button type="button" class="preview-toggle ${this.showSettings ? 'active' : ''}" data-action="toggle-settings" data-tooltip="Audio settings, video quality and countdown">${icon('gear', 14)} Settings</button>
            </div>
          ` : `<div class="rec-mode-label">${phase === 'review' ? `${icon('check')} Review your take` : `${icon(mode.id)} ${phase === 'countdown' ? 'Get ready…' : 'Recording'}`}</div>
               ${phase === 'recording' && this.recordingType !== 'audio' ? `<div class="rec-tools"><button type="button" class="preview-toggle ${this.prompter.on ? 'active' : ''}" data-action="toggle-prompter">${icon('script', 14)} Teleprompter</button></div>` : ''}`}
        </div>

        <div class="rec-main">
          <div class="rec-stage">
            ${phase === 'review' ? this.renderReview() : this.renderViewport()}
            ${this.isRecording && this.annotator ? this.renderDrawTools() : ''}
            ${this.notice ? `<div class="recorder-notice" role="status">${this.notice}</div>` : ''}
          </div>
          ${this.renderSidePanel(phase)}
        </div>

        ${this.renderBar(phase)}
      </div>
    `;
  }

  renderViewport() {
    const phase = this.phase;
    const live = phase === 'countdown' || phase === 'recording';
    const choose = `<button type="button" class="rec-btn primary" data-action="choose-screen">${icon('share')} Choose what to share</button>`;
    const screenArea = this.chosenDisplay && !live
      ? '<video class="screen-choice" autoplay muted playsinline></video>'
      : `<div class="preview-placeholder">${icon('screen', 40)}<span>${live ? 'Recording your screen' : 'Pick a screen, window or tab to see it here. You can also pick it when you press record.'}</span>${live ? '' : choose}</div>`;
    return `
      <div class="preview-viewport ${this.isPaused ? 'is-paused' : ''}">
        ${this.recordingType === 'screen' ? `
          <div class="screen-preview">${screenArea}</div>
        ` : this.recordingType === 'camera' ? `
          <div class="camera-preview">
            <video class="webcam-feed" autoplay muted playsinline></video>
          </div>
        ` : this.recordingType === 'both' ? `
          <div class="combined-preview">
            <div class="screen-area">${screenArea}</div>
            <div class="webcam-overlay" style="position:absolute;left:4%;bottom:6%;width:22%;aspect-ratio:1/1;overflow:hidden;border:3px solid #fff;border-radius:${this.camShape === 'circle' ? '50%' : '10px'};z-index:4;">
              <video class="webcam-feed" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>
            </div>
          </div>
        ` : `
          <div class="audio-preview">
            ${icon('audio', 44)}
            <div class="rec-big-meter" data-mic-meter><span data-mic-level></span></div>
            <span data-mic-hint>${live ? 'Recording your voice' : 'Say something to check your level'}</span>
          </div>
        `}

        ${(live) && this.annotator ? this.renderDrawLayer() : ''}
        ${this.prompter.on && this.prompter.script.trim() && this.recordingType !== 'audio' ? this.renderPrompterOverlay() : ''}
        ${this.isRecording ? `
          <div class="recording-status">
            <span class="rec-dot"></span>
            <span class="rec-label">${this.isPaused ? 'PAUSED' : 'REC'}</span>
            <span class="rec-time">${this.formatTime(this.recordingTime)}</span>
          </div>
        ` : ''}
        ${phase === 'countdown' ? `<div class="rec-count" data-countdown><b data-count-value>${this.countValue}</b><span>Click to start now · Esc to cancel</span></div>` : ''}
      </div>`;
  }

  renderReview() {
    if (this.stopping || this.combining || !this.recordedBlob) {
      return `<div class="rec-busy"><div class="rec-spinner"></div><span>${this.combining ? 'Combining screen and camera…' : 'Saving your take…'}</span></div>`;
    }
    const len = this.takeLength || this.recordingTime || 0;
    const start = this.trim.start;
    const end = this.trim.end ?? len;
    const pct = (v) => (len ? (v / len) * 100 : 0);
    const audioOnly = /^audio\//.test(this.recordedBlob.type || '') || this.recordingType === 'audio';
    return `
      ${audioOnly
        ? `<div class="audio-preview" style="padding:40px 0;">${icon('audio', 44)}<audio class="recorded-playback" src="${this.getPreviewUrl()}" controls style="width:min(520px,100%);"></audio></div>`
        : `<video class="recorded-playback rec-review-video" src="${this.getPreviewUrl()}" controls playsinline></video>`}
      ${len > 1 ? `
        <div class="rec-trim" data-trim>
          <span>Trim</span>
          <div class="rec-trim-track">
            <div class="rec-trim-rail"></div>
            <div class="rec-trim-kept" data-trim-kept style="left:${pct(start)}%;width:${pct(end) - pct(start)}%;"></div>
            <input type="range" min="0" max="${len.toFixed(2)}" step="0.1" value="${start}" data-trim-start aria-label="Trim start">
            <input type="range" min="0" max="${len.toFixed(2)}" step="0.1" value="${end}" data-trim-end aria-label="Trim end">
          </div>
          <span data-trim-label>${this.formatTime(Math.round(start))} – ${this.formatTime(Math.round(end))}</span>
        </div>` : ''}`;
  }

  renderSidePanel(phase) {
    if (phase !== 'setup') {
      // The script can still be edited while recording is paused; nothing else changes mid-take.
      return this.showPrompterPanel && phase === 'recording' && this.recordingType !== 'audio' ? `<div class="rec-side">${this.renderPrompterPanel()}</div>` : '';
    }
    let inner = '';
    if (this.showSettings) inner = this.renderSettingsPanel();
    else if (this.showPrompterPanel && this.recordingType !== 'audio') inner = this.renderPrompterPanel();
    else if (this.showEffects && this.usesCamera()) inner = this.renderEffectsPanel();
    return inner ? `<div class="rec-side">${inner}</div>` : '';
  }

  renderSettingsPanel() {
    const a = this.audio;
    const sw = (key, label, help, disabled = false) => `
      <label class="rec-switch"><input type="checkbox" data-audio-setting="${key}" ${a[key] ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>${label}</span><small>${help}</small></label>`;
    return `
      <div class="rec-panel" data-recorder-settings>
        <h4>Microphone</h4>
        <select class="rec-select mic-select" data-mic-select-panel style="max-width:none;" aria-label="Microphone">
          ${this.micOptions.map(mic => `<option value="${escAttr(mic.id)}" ${this.selectedMic === mic.id ? 'selected' : ''}>${escAttr(mic.label)}</option>`).join('')}
        </select>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="rec-meter" data-mic-meter style="flex:1;width:auto;height:10px;"><span data-mic-level></span></div>
        </div>
        <span class="rec-hint" data-mic-hint></span>
        ${sw('noiseSuppression', 'Noise suppression', 'Removes steady background noise like fans, hum and keyboard clicks.')}
        ${sw('echoCancellation', 'Echo cancellation', 'Stops sound from your speakers coming back through the microphone. Leave on unless you use headphones and want the most natural sound.')}
        ${sw('autoGainControl', 'Automatic volume', 'Evens out loud and quiet speech. Turn off if your volume pumps up and down.')}
        ${this.usesScreen() ? sw('systemAudio', 'Include computer sound', 'Records the sound of the tab or screen you share, mixed with your voice. In the share picker, tick "Share tab audio" or "Share system audio".') : ''}
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button type="button" class="preview-toggle" data-action="mic-test" ${this.micTesting ? 'disabled' : ''} style="align-self:flex-start;">${icon('audio', 14)} ${this.micTesting ? 'Recording… speak now' : 'Test my microphone'}</button>
          ${this.micTestUrl ? `<audio src="${this.micTestUrl}" controls data-mic-test-playback style="width:100%;"></audio><small style="color:var(--muted);font-size:11px;">This is how you will sound. Try the switches above and test again.</small>` : ''}
        </div>
        ${this.usesCamera() ? `
          <h4>Camera quality</h4>
          <div class="quality-options">
            ${QUALITY_OPTIONS.map(q => `<button type="button" class="quality-btn ${this.selectedQuality === q.id ? 'active' : ''}" data-quality="${q.id}"><span class="quality-name">${q.name}</span><span class="quality-res">${q.resolution}</span></button>`).join('')}
          </div>` : ''}
        <h4>Countdown</h4>
        <div style="display:flex;gap:6px;">
          ${[0, 3, 5].map((n) => `<button type="button" class="preview-toggle ${this.countdownSeconds === n ? 'active' : ''}" data-countdown-set="${n}">${n ? `${n} seconds` : 'Off'}</button>`).join('')}
        </div>
      </div>`;
  }

  renderBar(phase) {
    const meter = `<div class="rec-meter" data-mic-meter title="Microphone level"><span data-mic-level></span></div>`;
    if (phase === 'setup') {
      return `
        <div class="rec-bar">
          <div class="rec-bar-left">
            ${this.usesCamera() ? `<select class="rec-select" data-camera-select aria-label="Camera">${this.cameraList.map(c => `<option value="${escAttr(c.id)}" ${this.selectedCamera === c.id ? 'selected' : ''}>${escAttr(c.label)}</option>`).join('')}</select>` : ''}
            ${this.recordingType !== 'audio' ? `<button type="button" class="preview-toggle ${this.micEnabled ? 'active' : ''}" data-action="toggle-mic" data-tooltip="${this.micEnabled ? 'Mute microphone' : 'Record microphone'}">${icon(this.micEnabled ? 'audio' : 'micOff', 14)} Mic ${this.micEnabled ? 'on' : 'off'}</button>` : ''}
            ${this.usesMic() ? `<select class="rec-select mic-select" aria-label="Microphone">${this.micOptions.map(mic => `<option value="${escAttr(mic.id)}" ${this.selectedMic === mic.id ? 'selected' : ''}>${escAttr(mic.label)}</option>`).join('')}</select>${meter}<span class="rec-hint" data-mic-hint></span>` : ''}
          </div>
          <div class="rec-bar-center">
            <button type="button" class="rec-go" data-action="start" aria-label="Start recording" data-tooltip="Start recording">${'<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>'}</button>
          </div>
          <div class="rec-bar-right">
            <button type="button" class="rec-btn modal-cancel">Cancel</button>
          </div>
        </div>`;
    }
    if (phase === 'countdown') {
      return `<div class="rec-bar"><div class="rec-bar-left"></div><div class="rec-bar-center"><button type="button" class="rec-btn primary" data-action="skip-countdown">Start now</button><button type="button" class="rec-btn" data-action="cancel-countdown">Cancel</button></div><div class="rec-bar-right"></div></div>`;
    }
    if (phase === 'recording') {
      return `
        <div class="rec-bar">
          <div class="rec-bar-left">
            ${this.usesMic() ? `${icon('audio', 14)}${meter}<span class="rec-hint" data-mic-hint></span>` : '<span class="rec-keys">Microphone off</span>'}
          </div>
          <div class="rec-bar-center">
            <span class="rec-time" data-bar-time>${this.formatTime(this.recordingTime)}</span>
            <button type="button" class="rec-btn" data-action="${this.isPaused ? 'resume' : 'pause'}" data-tooltip="${this.isPaused ? 'Resume recording (Space)' : 'Pause recording (Space)'}">${icon(this.isPaused ? 'play' : 'pause')} ${this.isPaused ? 'Resume' : 'Pause'}</button>
            <button type="button" class="rec-go stop" data-action="stop" aria-label="Stop recording" data-tooltip="Stop recording (Esc)">${icon('stop', 24)}</button>
            <button type="button" class="rec-btn" data-action="restart-take" data-tooltip="Throw this take away and start again">${icon('restart')} Restart</button>
            ${this.recordingType === 'both' ? `<button type="button" class="rec-btn ${this.spotlightOn() ? 'primary' : ''}" data-action="spotlight" data-tooltip="Make your camera big in the middle; click again to shrink it">${icon('spot')} Spotlight</button>` : ''}
          </div>
          <div class="rec-bar-right">
            <span class="rec-keys">Space pause · Esc stop</span>
            ${monitorSupported() ? `<button type="button" class="rec-btn" data-action="monitor" data-tooltip="A small window that stays on top of other windows, with the time, your sound level, Pause and Stop">${this.monitorWin ? 'Close floating controls' : 'Float controls'}</button>` : ''}
            <button type="button" class="rec-btn danger" data-action="delete-take" data-tooltip="Stop and throw this take away">${icon('trash')} Delete</button>
          </div>
        </div>`;
    }
    // review
    const busy = this.stopping || this.combining || this.trimming || !this.recordedBlob;
    return `
      <div class="rec-bar">
        <div class="rec-bar-left">
          <button type="button" class="rec-btn" data-action="discard" ${busy ? 'disabled' : ''} data-tooltip="Throw this take away and record again">${icon('restart')} Retake</button>
        </div>
        <div class="rec-bar-center">
          <button type="button" class="rec-btn" data-action="save" ${busy ? 'disabled' : ''} data-tooltip="Download this take">${icon('download')} Download</button>
          <button type="button" class="rec-btn primary" data-action="use-recording" ${busy ? 'disabled' : ''} data-tooltip="Use this take">${icon('check')} Use this take</button>
        </div>
        <div class="rec-bar-right"><button type="button" class="rec-btn modal-cancel">Cancel</button></div>
      </div>`;
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

  renderDrawLayer() {
    return `
      <div class="draw-stage" style="background:#000;z-index:2;">
        <video class="screen-feed" autoplay muted playsinline style="width:100%;height:100%;object-fit:contain;"></video>
        <div class="draw-layer" data-draw-layer style="position:absolute;inset:0;cursor:crosshair;touch-action:none;"></div>
      </div>`;
  }

  renderDrawTools() {
    const tool = (id, label) => `<button class="preview-toggle ${this.drawTool === id ? 'active' : ''}" data-draw-tool="${id}">${label}</button>`;
    return `
      <div data-draw-tools style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;">
        <span style="font-size:12px;opacity:.7;">Draw on the screen:</span>
        ${tool('pen', '✎ Pen')}${tool('arrow', '➜ Arrow')}${tool('box', '▭ Box')}
        ${DRAW_COLORS.map((c) => `<button data-draw-color="${c}" aria-label="Colour ${c}" style="width:20px;height:20px;border-radius:50%;background:${c};border:2px solid ${this.drawColor === c ? '#fff' : 'transparent'};cursor:pointer;"></button>`).join('')}
        <button class="preview-toggle" data-draw-clear>Clear</button>
        <span style="font-size:11px;opacity:.5;">Marks fade after a few seconds and are recorded.</span>
      </div>`;
  }

  // Seconds of the take so far (pauses excluded): the time a spotlight starts or ends at.
  takeSeconds() {
    return (this.activeMs + (this.activeSince == null ? 0 : performance.now() - this.activeSince)) / 1000;
  }

  spotlightOn() {
    const last = this.spotlights[this.spotlights.length - 1];
    return !!last && last.end == null;
  }

  toggleSpotlight() {
    if (this.spotlightOn()) this.spotlights[this.spotlights.length - 1].end = this.takeSeconds();
    else this.spotlights.push({ start: this.takeSeconds(), end: null });
    this.rerender();
  }

  // The live screen (with marks) shown while recording, and pointer drawing on it.
  attachDrawing() {
    // The live camera preview follows re-renders while recording (pause, spotlight, tools).
    const cam = this.overlay?.querySelector('.webcam-feed');
    if ((this.isRecording || this.counting) && cam && this.liveCam && cam.srcObject !== this.liveCam) cam.srcObject = this.liveCam;
    const a = this.annotator;
    const video = this.overlay?.querySelector('.screen-feed');
    const layer = this.overlay?.querySelector('[data-draw-layer]');
    if (!a || !video || !layer) return;
    if (video.srcObject !== a.stream) video.srcObject = a.stream;
    const at = (e) => pointOnPicture(e.clientX, e.clientY, layer.getBoundingClientRect(), a.width, a.height);
    layer.onpointerdown = (e) => { const pt = at(e); if (!pt) return; layer.setPointerCapture?.(e.pointerId); a.begin(this.drawTool, this.drawColor, pt); };
    layer.onpointermove = (e) => { const pt = at(e); if (pt) a.move(pt); };
    layer.onpointerup = () => a.end();
    layer.onpointercancel = () => a.end();
  }

  // Delete: stop and throw the take away. Restart: the same, then record again.
  async discardTake({ restart = false } = {}) {
    if (!this.session) return;
    clearInterval(this.recordingInterval);
    const session = this.session;
    this.session = null;
    this.isRecording = false;
    this.isPaused = false;
    this.prompterClock.reset();
    this.prompterRunning = false;
    this.stopFollowing();
    try {
      const result = await session.stop();
      const { releaseTakes } = await import('../../lib/recorder/session.js');
      await releaseTakes(result);
    } catch { /* the take is being thrown away */ }
    this.stopAllStreams();
    this.annotator = null;
    this.spotlights = [];
    this.recordingTime = 0;
    this.notice = restart ? '' : 'Take deleted.';
    this.rerender();
    if (restart) await this.startRecording();
  }

  renderPrompterOverlay() {
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const lines = scriptLines(this.prompter.script);
    return `
      <div class="tp-overlay" data-teleprompter style="inset:auto;top:0;left:0;right:0;height:42%;overflow:hidden;background:linear-gradient(rgba(0,0,0,.78),rgba(0,0,0,.55));pointer-events:none;z-index:3;">
        <div class="tp-lines" style="position:absolute;left:6%;right:6%;top:30%;transition:transform .25s linear;font-size:${this.prompter.fontSize}px;line-height:1.35;font-weight:700;text-align:center;">
          ${lines.map((l, i) => `<div class="tp-line" data-tp-line="${i}" style="color:rgba(255,255,255,.45);">${esc(l)}</div>`).join('')}
        </div>
      </div>`;
  }

  renderPrompterPanel() {
    const p = this.prompter;
    return `
      <div data-teleprompter-panel style="display:flex;flex-direction:column;gap:8px;margin-top:8px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:12px;">
        <textarea data-tp-script rows="5" placeholder="Paste or write your script. Start with [pause] where the personalized greeting goes." style="width:100%;padding:8px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;font:inherit;font-size:13px;">${String(p.script).replace(/</g, '&lt;')}</textarea>
        <label style="display:flex;gap:8px;align-items:center;font-size:12px;"><span style="opacity:.7;width:84px;">Speed</span><input type="range" min="60" max="260" step="10" value="${p.wpm}" data-tp-wpm style="flex:1;"><span data-tp-wpm-label style="width:70px;text-align:right;opacity:.7;">${p.wpm} wpm</span></label>
        <label style="display:flex;gap:8px;align-items:center;font-size:12px;"><span style="opacity:.7;width:84px;">Font size</span><input type="range" min="14" max="48" step="1" value="${p.fontSize}" data-tp-size style="flex:1;"><span style="width:70px;text-align:right;opacity:.7;">${p.fontSize}px</span></label>
        <label style="display:flex;gap:8px;align-items:center;font-size:12px;"><input type="checkbox" data-tp-follow ${p.follow ? 'checked' : ''}> Follow my voice: scroll as I speak (speech is recognised on this device; the model downloads once, about 50 MB)</label>
        <span data-tp-follow-status style="font-size:11px;opacity:.6;">${this.followStatus || ''}</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap;white-space:nowrap;">
          <button class="preview-toggle" data-tp-practice>${this.prompterRunning ? 'Pause scrolling' : 'Practice'}</button>
          <button class="preview-toggle" data-tp-reset>Back to start</button>
          ${typeof window !== 'undefined' && 'documentPictureInPicture' in window ? `<button class="preview-toggle" data-tp-popout>${this.pipWin ? 'Close floating script' : 'Float over other windows'}</button>` : ''}
        </div>
        <span style="font-size:11px;opacity:.5;">Scrolls on its own when you start recording; pauses with the recording.${this.recordingType === 'screen' || this.recordingType === 'both' ? ' Sharing another window? Float the script so it stays on top while you record.' : ''}</span>
      </div>`;
  }

  // The script in a small always-on-top window (Document Picture-in-Picture, Chrome and Edge), for recording
  // another window or the whole screen: it stays visible over whatever you are showing.
  async openPrompterWindow() {
    const api = globalThis.window?.documentPictureInPicture;
    if (!api || this.pipWin) return;
    this.closeMonitorWindow(); // one floating window per tab
    try {
      const w = await api.requestWindow({ width: 520, height: 240 });
      w.document.title = 'Teleprompter';
      w.document.body.style.cssText = 'margin:0;background:#000;color:#fff;font-family:Inter,Arial,sans-serif;overflow:hidden;';
      w.document.body.innerHTML = this.renderPrompterOverlay().replace('height:42%', 'height:100%').replace('top:30%', 'top:38%');
      w.document.body.firstElementChild?.setAttribute('data-teleprompter-window', '');
      w.addEventListener('pagehide', () => { this.pipWin = null; this.rerender(); });
      this.pipWin = w;
      this.paintPrompter(this.prompterClock.elapsed());
      this.rerender();
    } catch { /* the browser refused (no user gesture, or unsupported) */ }
  }

  closePrompterWindow() {
    try { this.pipWin?.close(); } catch { /* gone */ }
    this.pipWin = null;
    this.rerender();
  }

  // Highlight and scroll to the line being read.
  paintPrompter(ms) {
    // The overlay on the preview and, when floated, the same script in its own window.
    const boxes = [this.overlay?.querySelector('.tp-lines'), this.pipWin?.document?.querySelector('.tp-lines')].filter(Boolean);
    boxes.forEach((box) => this.paintPrompterBox(box, ms));
  }

  paintPrompterBox(box, ms) {
    const lines = scriptLines(this.prompter.script);
    let { index, progress } = readingPosition(lines, ms, this.prompter.wpm);
    if (this.prompter.follow) {
      // Follow my voice: the line you are reading, from what the microphone heard.
      if (!this.followWords) import('../../lib/recorder/voiceFollow.js').then((m) => { this.followMod = m; this.followWords = m.scriptWords(lines); });
      index = this.followMod && this.followWords ? this.followMod.lineForWord(this.followWords, this.followAt || 0) : 0;
      progress = 0;
    }
    const els = box.querySelectorAll('.tp-line');
    // Measured, so a line the box wraps onto two rows still scrolls right.
    const cur = els[Math.min(index, els.length - 1)];
    if (cur) box.style.transform = `translateY(${-(cur.offsetTop + (index < els.length ? progress : 1) * cur.offsetHeight)}px)`;
    els.forEach((el, i) => { el.style.color = i === index ? '#fff' : 'rgba(255,255,255,.45)'; });
  }

  // Follow my voice: listen to the microphone (the take's own mic while recording).
  async startFollowing() {
    if (!this.prompter.follow || this.follower) return;
    try {
      let track = this.liveStreams?.flatMap((st) => st.getAudioTracks())[0] || null;
      if (!track) { this.followMic = await navigator.mediaDevices.getUserMedia({ audio: true }); track = this.followMic.getAudioTracks()[0]; }
      const { listen, advance, scriptWords } = await import('../../lib/recorder/voiceFollow.js');
      const words = scriptWords(scriptLines(this.prompter.script));
      this.followWords = words;
      this.follower = await listen(track, {
        onHeard: (text) => { this.followAt = advance(words, this.followAt || 0, text); this.paintPrompter(this.prompterClock.elapsed()); },
        onStatus: (st) => {
          this.followStatus = st.stage === 'download' ? `Loading speech recognition… ${Math.round((st.progress || 0) * 100)}%` : st.stage === 'error' ? `Follow my voice is unavailable: ${st.message}` : '';
          const el = this.overlay?.querySelector('[data-tp-follow-status]');
          if (el && this.followStatus) el.textContent = this.followStatus;
        },
      });
    } catch (err) {
      this.followStatus = `Follow my voice is unavailable: ${err?.message || err}`;
    }
  }

  stopFollowing() {
    this.follower?.stop();
    this.follower = null;
    this.followMic?.getTracks().forEach((t) => t.stop());
    this.followMic = null;
  }

  setPrompter(patch, { rerender = false } = {}) {
    this.prompter = teleprompterSettings({ ...this.prompter, ...patch });
    saveTeleprompter(this.prompter);
    if ('script' in patch) { this.onScriptChange?.(this.prompter.script); this.followWords = null; this.followAt = 0; }
    if (rerender) this.rerender();
    this.paintPrompter(this.prompterClock.elapsed());
  }

  async setEffects(patch, { rerender = true } = {}) {
    this.effects = { ...this.effects, ...patch };
    saveEffects(this.effects);
    if (rerender) this.rerender();
    await this.refreshPreviewEffects();
  }

  setupEventListeners() {
    super.setupEventListeners();
    const on = (sel, ev, fn) => this.overlay.querySelector(sel)?.addEventListener(ev, fn);
    const onAll = (sel, ev, fn) => this.overlay.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(el, e)));

    on('[data-action="delete-take"]', 'click', () => this.discardTake());
    on('[data-action="restart-take"]', 'click', () => this.discardTake({ restart: true }));
    on('[data-action="spotlight"]', 'click', () => this.toggleSpotlight());
    onAll('[data-draw-tool]', 'click', (b) => { this.drawTool = b.dataset.drawTool; this.rerender(); });
    onAll('[data-draw-color]', 'click', (b) => { this.drawColor = b.dataset.drawColor; this.rerender(); });
    on('[data-draw-clear]', 'click', () => this.annotator?.clear());

    on('[data-action="toggle-prompter"]', 'click', () => {
      // First click opens the script panel; with a script, the button shows or hides the prompter.
      if (!this.prompter.script.trim() || !this.showPrompterPanel) { this.showPrompterPanel = true; this.prompter.on = true; } else { this.prompter.on = !this.prompter.on; this.showPrompterPanel = this.prompter.on; }
      if (this.showPrompterPanel) { this.showEffects = false; this.showSettings = false; }
      saveTeleprompter(this.prompter);
      this.rerender();
    });
    on('[data-tp-script]', 'input', (e) => this.setPrompter({ script: e.target.value }));
    on('[data-tp-script]', 'change', () => this.rerender());
    on('[data-tp-wpm]', 'input', (e) => {
      this.setPrompter({ wpm: Number(e.target.value) });
      const l = this.overlay.querySelector('[data-tp-wpm-label]'); if (l) l.textContent = `${this.prompter.wpm} wpm`;
    });
    on('[data-tp-follow]', 'change', (e) => {
      this.setPrompter({ follow: e.target.checked }, { rerender: true });
      if (e.target.checked) import('../../lib/recorder/voiceFollow.js').then((m) => m.preloadFollow()).catch(() => {});
    });
    on('[data-tp-size]', 'change', (e) => this.setPrompter({ fontSize: Number(e.target.value) }, { rerender: true }));
    on('[data-tp-practice]', 'click', () => {
      if (this.prompterRunning) { this.prompterClock.pause(); this.prompterRunning = false; this.stopFollowing(); } else { this.prompterClock.start(); this.prompterRunning = true; this.startFollowing(); }
      this.syncWakeLock();
      this.rerender();
    });
    on('[data-tp-popout]', 'click', () => (this.pipWin ? this.closePrompterWindow() : this.openPrompterWindow()));
    on('[data-tp-reset]', 'click', () => { this.prompterClock.reset(); this.prompterRunning = false; this.followAt = 0; this.stopFollowing(); this.syncWakeLock(); this.rerender(); });

    on('[data-action="toggle-effects"]', 'click', () => {
      this.showEffects = !this.showEffects;
      if (this.showEffects) { this.showSettings = false; this.showPrompterPanel = false; }
      this.rerender();
    });
    onAll('[data-fx-bg]', 'click', (btn) => {
      const id = btn.dataset.fxBg;
      if (id === 'upload') { this.overlay.querySelector('[data-fx-upload]')?.click(); return; }
      if (id === 'none' || id === 'blur') this.setEffects({ mode: id });
      else this.setEffects({ mode: 'background', background: id });
    });
    on('[data-fx-upload]', 'change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => this.setEffects({ mode: 'background', background: String(reader.result) });
      reader.readAsDataURL(file);
    });
    on('[data-fx-blur]', 'input', (e) => this.setEffects({ blur: Number(e.target.value) }, { rerender: false }));
    on('[data-fx-touchup]', 'input', (e) => this.setEffects({ touchUp: Number(e.target.value) }, { rerender: false }));
    on('[data-fx-mirror]', 'change', (e) => this.setEffects({ mirror: e.target.checked }));

    on('[data-action="toggle-settings"]', 'click', () => {
      this.showSettings = !this.showSettings;
      if (this.showSettings) { this.showEffects = false; this.showPrompterPanel = false; }
      this.rerender();
    });
    onAll('[data-audio-setting]', 'change', (el) => this.setAudio({ [el.dataset.audioSetting]: el.checked }));
    on('[data-action="mic-test"]', 'click', () => this.testMic());
    onAll('[data-countdown-set]', 'click', (b) => {
      this.countdownSeconds = Number(b.dataset.countdownSet);
      try { localStorage.setItem(COUNTDOWN_KEY, String(this.countdownSeconds)); } catch { /* private mode */ }
      this.rerender();
    });

    onAll('.type-btn', 'click', (btn) => {
      if (this.phase !== 'setup' || btn.dataset.type === this.recordingType) return;
      this.recordingType = btn.dataset.type;
      if (!this.usesScreen()) this.releaseChosenDisplay();
      this.notice = '';
      this.rerender();
    });
    onAll('[data-shape]', 'click', (btn) => { this.camShape = btn.dataset.shape; this.rerender(); });
    onAll('.quality-btn', 'click', (btn) => { this.selectedQuality = btn.dataset.quality; this.rerender(); });

    onAll('.mic-select', 'change', (el) => { this.selectedMic = el.value; this.restartMeter(); this.rerender(); });
    on('[data-camera-select]', 'change', (e) => {
      this.selectedCamera = e.target.value;
      this.stopPreviewCamera({ force: true });
      this.syncCameraPreview();
    });

    on('[data-action="toggle-mic"]', 'click', () => {
      if (this.isRecording) return;
      this.micEnabled = !this.micEnabled;
      this.rerender();
    });
    on('[data-action="choose-screen"]', 'click', () => this.chooseScreen());

    on('[data-action="start"]', 'click', () => this.startRecording());
    on('[data-countdown]', 'click', () => this.counting?.skip());
    on('[data-action="skip-countdown"]', 'click', () => this.counting?.skip());
    on('[data-action="cancel-countdown"]', 'click', () => this.counting?.cancel());
    on('[data-action="pause"]', 'click', () => this.pauseRecording());
    on('[data-action="resume"]', 'click', () => this.resumeRecording());
    on('[data-action="stop"]', 'click', () => this.stopRecording());
    on('[data-action="monitor"]', 'click', () => this.toggleMonitorWindow());
    on('[data-action="discard"]', 'click', () => this.discardRecording());
    on('[data-action="save"]', 'click', () => this.saveRecording());
    on('[data-action="use-recording"]', 'click', () => this.useRecording());

    const trimStart = this.overlay.querySelector('[data-trim-start]');
    const trimEnd = this.overlay.querySelector('[data-trim-end]');
    const seek = (t) => { const v = this.overlay.querySelector('.recorded-playback'); if (v && Number.isFinite(t)) { try { v.currentTime = t; } catch { /* not ready */ } } };
    trimStart?.addEventListener('input', () => { this.setTrim({ start: Number(trimStart.value) }); seek(this.trim.start); });
    trimEnd?.addEventListener('input', () => { this.setTrim({ end: Number(trimEnd.value) }); seek(this.trim.end); });
    // Playback stays inside the trimmed part.
    const player = this.overlay.querySelector('.recorded-playback');
    player?.addEventListener('timeupdate', () => {
      const end = this.trim.end;
      if (end != null && player.currentTime > end + 0.05) { player.pause(); player.currentTime = end; }
    });
    player?.addEventListener('play', () => { if (player.currentTime < this.trim.start || (this.trim.end != null && player.currentTime >= this.trim.end - 0.05)) player.currentTime = this.trim.start; });
  }

  // BaseModal adds a document key listener (and moves focus to the first control) on every redraw; the
  // recorder redraws often, so keep exactly one listener and only move focus when it opens. Otherwise
  // one Space press would pause and resume again.
  setupAccessibility() {
    if (!this.content) return;
    this.focusableElements = Array.from(this.content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled);
    if (!this.focusedOnce && this.focusableElements.length) {
      this.focusedOnce = true;
      setTimeout(() => (this.overlay?.querySelector('[data-action="start"]') || this.focusableElements[0])?.focus(), 50);
    }
    if (this.boundHandlers.keydown) document.removeEventListener('keydown', this.boundHandlers.keydown);
    this.boundHandlers.keydown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.boundHandlers.keydown);
  }

  // Space pauses or resumes, Esc stops (or cancels the countdown). Esc does not close the recorder mid-take.
  handleKeyDown(e) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
    if (this.counting && e.key === 'Escape') { e.preventDefault(); this.counting.cancel(); return; }
    if (this.isRecording) {
      if (e.key === 'Escape') { e.preventDefault(); this.stopRecording(); return; }
      if ((e.key === ' ' || e.code === 'Space') && !typing) {
        e.preventDefault();
        // A focused button would also be "clicked" by the Space key when it is released.
        if (e.target?.tagName === 'BUTTON') e.target.blur();
        if (this.isPaused) this.resumeRecording(); else this.pauseRecording();
        return;
      }
    }
    if (e.key === 'Escape' && (this.stopping || this.combining || this.trimming)) { e.preventDefault(); return; }
    super.handleKeyDown(e);
  }

  // updateBody() re-attaches the event listeners itself (BaseModal); attaching them again here would
  // make every button fire twice.
  rerender() {
    this.updateBody(this.renderBody());
    const mode = MODES.find((m) => m.id === this.recordingType);
    if (mode) this.setTitle(mode.title);
    this.syncCameraPreview();
    this.syncMeter();
    this.attachChosenDisplay();
    this.paintPrompter(this.prompterClock.elapsed());
    this.attachDrawing();
  }

  getPreviewUrl() {
    if (!this.previewUrl && this.recordedBlob) this.previewUrl = URL.createObjectURL(this.recordedBlob);
    return this.previewUrl;
  }

  // Keeps a live camera preview running in Camera and Both modes, and stops it in
  // the others so the camera light is not left on.
  async syncCameraPreview() {
    if (this.phase !== 'setup') return;
    if (!this.usesCamera()) {
      this.stopPreviewCamera();
      return;
    }
    if (!this.webcamStream) {
      try {
        const video = this.selectedCamera && this.selectedCamera !== 'default' ? { deviceId: { exact: this.selectedCamera } } : true;
        this.webcamStream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        this.previewCameraOnly = true;
        // Camera names are only shown once the browser has been allowed to use one.
        if (this.cameraList.every((c) => !c.label || /^Camera \d|^Default camera$/.test(c.label))) this.loadMicDevices();
      } catch (err) {
        console.error('Camera access denied:', err);
        this.notice = permissionMessage({ need: ['camera'], perms: await mediaPermissions(), err })
          || 'Camera access was blocked. Allow it in your browser settings to record with your camera.';
        this.watchPermissions();
        this.previewCameraOnly = false;
        this.updateBody(this.renderBody());
        return;
      }
      if (this.phase !== 'setup' || !this.usesCamera()) { this.stopPreviewCamera(); return; }
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

  stopPreviewCamera({ force = false } = {}) {
    this.previewFx?.stop();
    this.previewFx = null;
    if (this.webcamStream && (this.previewCameraOnly || force)) {
      this.webcamStream.getTracks().forEach(t => t.stop());
      this.webcamStream = null;
    }
  }

  // --- Microphone level meter -------------------------------------------------------------------
  // Before recording it listens to its own microphone stream (with the chosen device and switches);
  // while recording it listens to the take's own sound.
  paintMeter(level, peak, clipped = false) {
    if (this.monitor) this.paintMonitor(level, clipped);
    this.overlay?.querySelectorAll('[data-mic-level]').forEach((el) => {
      el.style.width = `${Math.round(level * 100)}%`;
      el.style.background = clipped ? '#ef4444' : level > 0.85 ? '#f5a524' : '#2fb344';
    });
    const hint = levelHint(peak, clipped);
    this.overlay?.querySelectorAll('.rec-hint[data-mic-hint]').forEach((el) => { if (el.textContent !== hint) el.textContent = hint; });
  }

  async syncMeter() {
    const canMeter = !!(globalThis.AudioContext || globalThis.webkitAudioContext);
    const phase = this.phase;
    const want = canMeter && this.usesMic() && (phase === 'setup' || phase === 'countdown' || phase === 'recording');
    if (!want) { this.releaseMeter(); return; }
    if (phase !== 'setup') {
      const stream = this.liveStreams?.find((s) => s.getAudioTracks().length);
      if (stream && this.meterSource !== stream) { this.releaseMeter(); this.meterSource = stream; this.stopMeter = createLevelMeter(stream, (l, p, c) => this.paintMeter(l, p, c)); }
      return;
    }
    if (this.meterStream || this.meterStarting) return;
    this.meterStarting = true;
    try {
      const { getMicStream } = await import('../../lib/recorder/streams.js');
      const stream = await getMicStream({ selectedAudioSource: this.selectedMic, audioSettings: this.audio });
      if (this.phase !== 'setup' || !this.usesMic() || this.destroyed) { stream.getTracks().forEach((t) => t.stop()); return; }
      this.meterStream = stream;
      this.meterSource = stream;
      this.stopMeter = createLevelMeter(stream, (l, p, c) => this.paintMeter(l, p, c));
      if (this.micOptions.every((m) => m.id === 'default' || /^Microphone \d/.test(m.label))) this.loadMicDevices();
    } catch (err) {
      if (!this.notice) this.notice = permissionMessage({ need: ['microphone'], perms: await mediaPermissions(), err }) || '';
      if (this.notice) { this.watchPermissions(); this.updateBody(this.renderBody()); }
    } finally {
      this.meterStarting = false;
    }
  }

  releaseMeter() {
    this.stopMeter?.();
    this.stopMeter = null;
    this.meterSource = null;
    this.meterStream?.getTracks().forEach((t) => t.stop());
    this.meterStream = null;
  }

  restartMeter() { this.releaseMeter(); }

  setAudio(patch) {
    this.audio = { ...this.audio, ...patch };
    saveAudioSettings(this.audio);
    // A screen chosen without its sound has to be chosen again to include it.
    if ('systemAudio' in patch && this.chosenDisplay) {
      this.releaseChosenDisplay();
      if (patch.systemAudio) this.notice = 'Choose what to share again so its sound can be included.';
    }
    this.releaseMeter();
    if (this.micTestUrl) { URL.revokeObjectURL(this.micTestUrl); this.micTestUrl = null; }
    this.rerender();
  }

  // Record four seconds with the current microphone and switches, then play it back.
  async testMic() {
    if (this.micTesting) return;
    this.micTesting = true;
    if (this.micTestUrl) { URL.revokeObjectURL(this.micTestUrl); this.micTestUrl = null; }
    this.rerender();
    let own = null;
    try {
      let stream = this.meterStream;
      if (!stream) {
        const { getMicStream } = await import('../../lib/recorder/streams.js');
        stream = own = await getMicStream({ selectedAudioSource: this.selectedMic, audioSettings: this.audio });
      }
      const blob = await recordMicTest(stream, 4000);
      this.micTestUrl = URL.createObjectURL(blob);
    } catch (err) {
      this.notice = permissionMessage({ need: ['microphone'], perms: await mediaPermissions(), err }) || `The microphone test failed: ${err?.message || err}`;
    } finally {
      own?.getTracks().forEach((t) => t.stop());
      this.micTesting = false;
      if (!this.destroyed) this.rerender();
    }
  }

  // --- Choosing the screen before recording -----------------------------------------------------
  async chooseScreen() {
    try {
      const { getDisplayStream } = await import('../../lib/recorder/streams.js');
      const display = await getDisplayStream({ withAudio: !!this.audio.systemAudio });
      this.releaseChosenDisplay();
      this.chosenDisplay = display;
      display.getVideoTracks()[0]?.addEventListener('ended', () => { if (this.chosenDisplay === display) { this.chosenDisplay = null; if (this.phase === 'setup') this.rerender(); } }, { once: true });
      this.notice = '';
      this.rerender();
    } catch (err) {
      if (err?.name !== 'NotAllowedError') { this.notice = `The screen could not be shared: ${err?.message || err}`; this.rerender(); }
    }
  }

  attachChosenDisplay() {
    const el = this.overlay?.querySelector('.screen-choice');
    if (el && this.chosenDisplay && el.srcObject !== this.chosenDisplay) el.srcObject = this.chosenDisplay;
  }

  // Hand the chosen screen to the take (once), if it is still being shared.
  takeChosenDisplay() {
    const d = this.chosenDisplay;
    this.chosenDisplay = null;
    return d && d.getVideoTracks().some((t) => t.readyState !== 'ended') ? d : null;
  }

  releaseChosenDisplay() {
    this.chosenDisplay?.getTracks().forEach((t) => t.stop());
    this.chosenDisplay = null;
  }

  open() {
    super.open();
    this.content?.classList.add('rec-modal');
    const mode = MODES.find((m) => m.id === this.recordingType);
    if (mode) this.setTitle(mode.title);
    this.syncCameraPreview();
    this.syncMeter();
    if (navigator.mediaDevices?.addEventListener) {
      this.onDeviceChange = () => this.loadMicDevices();
      navigator.mediaDevices.addEventListener('devicechange', this.onDeviceChange);
    }
    // Follow my voice: have the speech model ready by the time recording starts.
    if (this.prompter.on && this.prompter.follow) import('../../lib/recorder/voiceFollow.js').then((m) => m.preloadFollow()).catch(() => {});
  }

  // Recording uses the engine ported from Remotion Recorder (src/lib/recorder): every source is
  // recorded to its own file, in sync, and saved to the browser's private file storage as it goes.
  // Both = the camera (with the microphone) and the screen as two files; they are combined into one
  // video afterwards, in the browser (src/lib/recorder/composeBoth.jsx).
  cameraOptions() {
    const quality = QUALITY_OPTIONS.find(q => q.id === this.selectedQuality);
    const [maxWidth, maxHeight] = quality?.resolution ? quality.resolution.split('x').map(Number) : [];
    return { deviceId: this.selectedCamera || 'default', maxWidth, maxHeight };
  }

  async buildSources() {
    const streams = await import('../../lib/recorder/streams.js');
    const audio = { recordAudio: this.micEnabled, selectedAudioSource: this.selectedMic, audioSettings: this.audio };
    const type = this.recordingType;
    if (type === 'audio') {
      return [{ prefix: 'audio', stream: await streams.getMicStream({ selectedAudioSource: this.selectedMic, audioSettings: this.audio }), audioOnly: true }];
    }
    // The screen goes through the drawing layer, so marks you draw are in the recording.
    const withDrawing = async (display) => {
      try {
        const { createAnnotator } = await import('../../lib/recorder/annotate.js');
        this.annotator = await createAnnotator(display);
        return this.annotator.stream;
      } catch (err) {
        console.error('Drawing layer failed:', err);
        this.annotator = null;
        return display;
      }
    };
    if (type === 'screen') {
      const display = await streams.getDisplayStreamWithMic({ ...audio, display: this.takeChosenDisplay(), mix: mixAudioTracks });
      this.extraStreams = [display];
      const drawn = await withDrawing(display);
      // The drawing layer only carries the picture: keep the sound.
      if (drawn !== display && display.getAudioTracks().length && !drawn.getAudioTracks().length) {
        return [{ prefix: 'display', stream: new globalThis.MediaStream([...drawn.getVideoTracks(), ...display.getAudioTracks()]) }];
      }
      return [{ prefix: 'display', stream: drawn }];
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
    const display = this.takeChosenDisplay() || await streams.getDisplayStream({ withAudio: !!this.audio.systemAudio });
    try {
      let webcam = await withEffects(await streams.getCameraStream({ camera: this.cameraOptions(), ...audio }));
      // The computer's sound rides with the voice on the camera file.
      const system = this.audio.systemAudio ? display.getAudioTracks()[0] : null;
      if (system) {
        const voice = webcam.getAudioTracks()[0];
        const mixed = voice ? mixAudioTracks([voice, system]) : { track: system, stop: () => {} };
        const out = new globalThis.MediaStream([...webcam.getVideoTracks(), mixed.track]);
        out.stopMix = mixed.stop;
        out.sourceTracks = webcam.getTracks();
        webcam = out;
      }
      return [{ prefix: 'webcam', stream: webcam }, { prefix: 'display', stream: await withDrawing(display) }];
    } catch (err) {
      display.getTracks().forEach(t => t.stop());
      throw err;
    }
  }

  // Once the user allows the camera or mic in the browser, clear the "blocked" message.
  async watchPermissions() {
    if (this.stopPermWatch) return;
    this.stopPermWatch = await watchMediaPermissions((name, state) => {
      if (state !== 'granted' || !this.notice) return;
      this.notice = '';
      this.rerender();
    });
  }

  // Keep the screen awake while a take is running or the teleprompter is scrolling (Screen Wake Lock).
  syncWakeLock() {
    const want = !!(this.isRecording || this.prompterRunning || this.counting);
    if (want && !this.releaseWake) this.releaseWake = keepAwake();
    if (!want && this.releaseWake) { this.releaseWake(); this.releaseWake = null; }
  }

  // Shows each number of the countdown (without rebuilding the page).
  paintCount(n) {
    this.countValue = n;
    const el = this.overlay?.querySelector('[data-count-value]');
    if (el) el.textContent = String(n);
  }

  async startRecording() {
    // One take at a time: a second start (double click, or a second click handler) would leave an
    // orphaned recorder holding the camera and its file.
    if (this.isRecording || this.starting) return;
    this.starting = true;
    this.notice = '';
    this.stopPreviewCamera();
    this.releaseMeter();
    if (this.micTestUrl) { URL.revokeObjectURL(this.micTestUrl); this.micTestUrl = null; }
    try {
      const sources = await this.buildSources();
      this.liveStreams = sources.map(s => s.stream);
      this.hasAudio = sources.some(s => s.stream.getAudioTracks().length > 0);
      if (this.micEnabled && !this.hasAudio) this.notice = 'Microphone was unavailable, so this take has no sound.';
      this.liveCam = sources.find(s => s.prefix === 'webcam')?.stream || null;

      // 3-2-1 on the live picture, after any share dialog, so the take starts when you are ready.
      if (this.countdownSeconds > 0) {
        this.counting = createCountdown(this.countdownSeconds, { onTick: (n) => this.paintCount(n) });
        this.countValue = this.countdownSeconds;
        this.syncWakeLock();
        this.rerender();
        const go = await this.counting.promise;
        this.counting = null;
        if (!go || this.destroyed) {
          this.stopAllStreams();
          this.syncWakeLock();
          if (!this.destroyed) this.rerender();
          return;
        }
      }

      const { startSession } = await import('../../lib/recorder/session.js');
      this.session = await startSession(sources);
      // Like Recorder: when any track ends (e.g. the browser's "Stop sharing" button), stop everything.
      for (const s of this.liveStreams) for (const t of s.getTracks()) t.addEventListener('ended', () => { if (this.isRecording) this.stopRecording(); }, { once: true });

      this.isRecording = true;
      this.isPaused = false;
      this.spotlights = [];
      this.activeMs = 0;
      this.activeSince = performance.now();
      this.prompterClock.reset();
      this.prompterClock.start();
      this.prompterRunning = true;
      this.syncWakeLock();
      this.followAt = 0;
      this.stopFollowing();
      this.startFollowing();
      this.recordingTime = 0;
      this.recordingInterval = setInterval(() => {
        if (!this.isPaused) {
          this.recordingTime++;
          this.overlay?.querySelectorAll('.rec-time').forEach((el) => { el.textContent = this.formatTime(this.recordingTime); });
          this.paintMonitor();
        }
      }, 1000);
      this.rerender();
    } catch (err) {
      console.error('Recording failed:', err);
      this.counting = null;
      this.stopAllStreams();
      this.isRecording = false;
      this.prompterRunning = false;
      this.syncWakeLock();
      const need = [...(this.usesCamera() ? ['camera'] : []), ...(this.micEnabled || this.recordingType === 'audio' ? ['microphone'] : [])];
      // A refused screen share is also NotAllowedError: only explain the camera/mic when they are
      // actually blocked, missing or busy.
      const perms = need.length ? await mediaPermissions() : {};
      const blocked = need.some((n) => perms[n] === 'denied');
      const help = need.length && (blocked || err?.name !== 'NotAllowedError') ? permissionMessage({ need, perms, err }) : '';
      if (help) this.watchPermissions();
      this.notice = help || (err?.name === 'NotAllowedError'
        ? 'Permission was denied. Allow screen, camera and microphone access to record.'
        : `Recording could not start: ${err?.message || err}`);
      this.rerender();
    } finally {
      this.starting = false;
    }
  }

  // The floating recording controls (src/lib/recorder/monitorWindow.js). One floating window per tab, so opening these
  // closes the floating script, and the other way round.
  async toggleMonitorWindow() {
    if (this.monitorWin) { this.closeMonitorWindow(); this.rerender(); return; }
    if (this.pipWin) this.closePrompterWindow();
    const opened = await openMonitorWindow({ onStop: () => this.stopRecording(), onPause: () => this.pauseRecording(), onResume: () => this.resumeRecording() });
    if (!opened) return;
    this.monitorWin = opened.win; this.monitor = opened.monitor;
    opened.win.addEventListener('pagehide', () => { this.monitorWin = null; this.monitor = null; if (!this.destroyed) this.rerender(); });
    this.paintMonitor();
    this.rerender();
  }

  closeMonitorWindow() {
    try { this.monitorWin?.close(); } catch { /* gone */ }
    this.monitorWin = null; this.monitor = null;
  }

  paintMonitor(level = this.lastLevel || 0, clipped = this.lastClipped || false) {
    this.lastLevel = level; this.lastClipped = clipped;
    this.monitor?.update({ seconds: this.recordingTime || 0, level, clipped, paused: !!this.isPaused });
  }

  pauseRecording() {
    if (!this.session || this.isPaused) return;
    this.session.pause();
    this.isPaused = true;
    this.activeMs += performance.now() - (this.activeSince ?? performance.now());
    this.activeSince = null;
    this.prompterClock.pause();
    this.prompterRunning = false;
    this.paintMonitor();
    this.rerender();
  }

  resumeRecording() {
    if (!this.session || !this.isPaused) return;
    this.session.resume();
    this.isPaused = false;
    this.activeSince = performance.now();
    this.prompterClock.start();
    this.prompterRunning = true;
    this.paintMonitor();
    this.rerender();
  }

  async stopRecording() {
    if (!this.session || this.stopping) return;
    this.stopping = true;
    this.closeMonitorWindow();
    this.stopFollowing();
    if (this.spotlightOn()) this.spotlights[this.spotlights.length - 1].end = this.takeSeconds();
    this.takeLength = this.takeSeconds();
    this.trim = { start: 0, end: null };
    this.prompterClock.pause();
    this.prompterRunning = false;
    clearInterval(this.recordingInterval);
    const session = this.session;
    this.releaseWake?.(); // the take is over: the screen may sleep again
    this.releaseWake = null;
    this.releaseMeter();
    this.isRecording = false;
    this.updateBody(this.renderBody()); // "Saving your take…"
    try {
      const result = await session.stop();
      this.stopAllStreams();
      const { takeBlobs, releaseTakes } = await import('../../lib/recorder/session.js');
      const blobs = await takeBlobs(result);
      await releaseTakes(result);
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
      this.stopAllStreams();
    } finally {
      this.session = null;
      this.stopping = false;
      this.previewUrl = null;
      if (!this.destroyed) this.rerender();
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
        spotlights: this.spotlights,
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
    this.liveCam = null;
    this.annotator?.stop();
    this.annotator = null;
    [...(this.liveStreams || []), ...(this.extraStreams || []), this.webcamStream].forEach((s) => {
      if (!s) return;
      s.getTracks().forEach(track => track.stop());
      s.sourceTracks?.forEach((t) => t.stop());
      s.stopMix?.();
    });
    this.liveStreams = [];
    this.extraStreams = [];
    this.webcamStream = null;
  }

  // Closing the modal mid-take (or after a preview) must release camera, mic and
  // screen capture, otherwise the browser's recording indicators stay on.
  destroy() {
    this.destroyed = true;
    this.closeMonitorWindow();
    this.counting?.cancel();
    clearInterval(this.recordingInterval);
    this.releaseWake?.();
    this.releaseWake = null;
    this.stopPermWatch?.();
    this.stopPermWatch = null;
    if (this.onDeviceChange) navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange);
    try { this.pipWin?.close(); } catch { /* gone */ }
    this.pipWin = null;
    this.prompterClock.reset();
    this.stopFollowing();
    this.releaseMeter();
    this.releaseChosenDisplay();
    const session = this.session;
    this.session = null;
    if (session) {
      session.stop()
        .then(async (result) => (await import('../../lib/recorder/session.js')).releaseTakes(result))
        .catch(() => {});
    }
    this.stopAllStreams();
    this.previewFx?.stop();
    this.previewFx = null;
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    if (this.micTestUrl) { URL.revokeObjectURL(this.micTestUrl); this.micTestUrl = null; }
    super.destroy();
  }

  // Retake: back to the camera, ready to record again.
  discardRecording() {
    this.recordedBlob = null;
    this.trackBlobs = {};
    this.trim = { start: 0, end: null };
    this.takeLength = 0;
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.recordingTime = 0;
    this.notice = '';
    this.rerender();
  }

  // --- Trim -------------------------------------------------------------------------------------
  setTrim(patch) {
    const len = this.takeLength || this.recordingTime || 0;
    let start = 'start' in patch ? patch.start : this.trim.start;
    let end = 'end' in patch ? patch.end : (this.trim.end ?? len);
    const gap = Math.min(0.5, len / 4);
    if ('start' in patch) start = Math.max(0, Math.min(start, end - gap));
    if ('end' in patch) end = Math.min(len, Math.max(end, start + gap));
    this.trim = { start, end: end >= len - 0.05 ? null : end };
    const s = this.overlay?.querySelector('[data-trim-start]');
    const e = this.overlay?.querySelector('[data-trim-end]');
    if (s && Number(s.value) !== start) s.value = String(start);
    if (e && Number(e.value) !== end) e.value = String(end);
    const kept = this.overlay?.querySelector('[data-trim-kept]');
    if (kept && len) { kept.style.left = `${(start / len) * 100}%`; kept.style.width = `${((end - start) / len) * 100}%`; }
    const label = this.overlay?.querySelector('[data-trim-label]');
    if (label) label.textContent = `${this.formatTime(Math.round(start))} – ${this.formatTime(Math.round(end))}`;
  }

  isTrimmed() { return this.trim.start > 0.05 || this.trim.end != null; }

  // The take as it will be used: cut to the trim handles when they were moved.
  async finalBlob() {
    if (!this.isTrimmed() || !this.recordedBlob) return this.recordedBlob;
    this.trimming = true;
    this.notice = 'Trimming…';
    this.rerender();
    try {
      const { trimTake } = await import('../../lib/recorder/convert.js');
      const out = await trimTake(this.recordedBlob, {
        start: this.trim.start,
        end: this.trim.end ?? undefined,
        onProgress: (p) => { const el = this.overlay?.querySelector('.recorder-notice'); if (el) el.textContent = `Trimming… ${Math.round(p * 100)}%`; },
      });
      this.notice = '';
      return out;
    } finally {
      this.trimming = false;
    }
  }

  trimmedSeconds() {
    const len = this.takeLength || this.recordingTime || 0;
    return Math.max(0, (this.trim.end ?? len) - this.trim.start);
  }

  async saveRecording() {
    if (!this.recordedBlob) return;
    let blob;
    try { blob = await this.finalBlob(); } catch (err) {
      this.notice = `This take could not be trimmed: ${err?.message || err}. Move the handles back to download the full take.`;
      this.rerender();
      return;
    }
    const url = blob === this.recordedBlob ? this.getPreviewUrl() : URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = /mp4/.test(blob.type) ? (/^audio/.test(blob.type) ? 'm4a' : 'mp4') : 'webm';
    a.download = `recording-${Date.now()}.${ext}`;
    a.click();
    if (url !== this.previewUrl) setTimeout(() => URL.revokeObjectURL(url), 10000);
    this.rerender();
  }

  async useRecording() {
    if (!this.recordedBlob || this.trimming) return;
    let blob;
    try { blob = await this.finalBlob(); } catch (err) {
      this.notice = `This take could not be trimmed: ${err?.message || err}. Move the handles back to use the full take.`;
      this.rerender();
      return;
    }
    const labels = { screen: 'Screen recording', camera: 'Camera recording', both: 'Screen + camera recording', audio: 'Audio recording' };
    this.onConfirm({
      action: 'recordingComplete',
      name: labels[this.recordingType] || 'Recording',
      blob,
      duration: this.isTrimmed() ? Math.round(this.trimmedSeconds()) : this.recordingTime,
      type: this.recordingType,
      quality: this.selectedQuality,
      hasAudio: this.hasAudio,
      // Present only for Both: the untouched screen and camera files.
      tracks: { ...this.trackBlobs }
    });
    this.close();
  }
}

function readCountdown() {
  try {
    const v = globalThis.localStorage?.getItem(COUNTDOWN_KEY);
    return v == null ? 3 : Math.max(0, Math.min(10, Number(v) || 0));
  } catch { return 3; }
}

export default RecorderModal;
