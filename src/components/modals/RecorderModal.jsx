import { BaseModal } from './BaseModal.jsx';

// The screen recorder IS the upstream Remotion Recorder app (apps/remotion-recorder/src, unmodified), built to /recorder-ui/ and shown
// here in an iframe. This file only hosts that iframe and receives what it saves: no recording, device or capture code lives here.
// The five calls the upstream UI makes to its own Bun server are answered by apps/remotion-recorder/embed/adapters (postMessage).
//
//   iframe -> editor : { type: 'file', prefix, endDate, expectedFrames, mimeType, blob }   a converted take (webcam / display / ...)
//                      { type: 'transcribe', requestId, endDate }                          upstream asks for captions of that take
//                      { type: 'cancel-transcribe', requestId }
//   editor -> iframe : { type: 'transcribe-progress' | 'transcribe-done' | 'transcribe-aborted' | 'transcribe-error', requestId, ... }

const CHANNEL = 'remotion-recorder-embed';
const FOLDER = 'timeline-project'; // must match EDITOR_FOLDER in embed/adapters/bridge.ts
const APP_URL = `${import.meta.env?.BASE_URL ?? '/'}recorder-ui/index.html?folder=${FOLDER}`;
const FPS = 30; // upstream's config/fps.ts

const KIND_LABELS = { webcam: 'Webcam', display: 'Screen', alternative1: 'Camera 2', alternative2: 'Camera 3' };

const STYLES = `
  <style>
    .rre-wrap { display:flex; flex-direction:column; height:100%; min-height:560px; }
    .rre-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 16px; border-bottom:1px solid var(--border-soft, var(--border)); font-size:13px; }
    .rre-bar .rre-grow { flex:1; color:var(--muted); min-width:160px; }
    .rre-btn { padding:7px 12px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--panel-soft, rgba(255,255,255,.04)); color:var(--text); cursor:pointer; font:inherit; font-size:12px; }
    .rre-btn:hover:not(:disabled) { border-color:var(--primary); }
    .rre-btn:disabled { opacity:.5; cursor:not-allowed; }
    .rre-btn.primary { background:var(--primary); color:var(--on-primary); border-color:var(--primary); font-weight:600; }
    .rre-frame { flex:1; width:100%; border:0; background:#000; min-height:480px; }
    .rre-missing { padding:32px; color:var(--muted); font-size:14px; line-height:1.6; }
    .rre-missing code { background:rgba(255,255,255,.08); padding:2px 6px; border-radius:4px; }
  </style>`;

export class RecorderModal extends BaseModal {
  constructor(options = {}) {
    super({ title: 'Screen Recorder', size: 'full', showFooter: false, closeOnBackdrop: false, ...options });
    this.onStudioExport = options.onStudioExport || (() => {});
    this.takes = new Map(); // endDate -> { files: { [prefix]: { blob, mimeType } }, expectedFrames, captions }
    this.latest = null; // endDate of the most recent take that has finished saving
    this.jobs = new Map(); // transcription requestId -> AbortController
    this.onMessage = (e) => this.handleMessage(e);
    window.addEventListener('message', this.onMessage);
  }

  renderBody() {
    return `${STYLES}
      <div class="rre-wrap">
        <div class="rre-bar">
          <span class="rre-grow" data-status>Record with the Remotion Recorder below. When a take is saved you can add it to the timeline or edit it in Recorder Studio.</span>
          <button class="rre-btn" data-act="open-studio" title="Scenes, captions, layouts, chapters and an end card">🎬 Recorder Studio</button>
          <button class="rre-btn" data-act="add" disabled>Add to timeline</button>
        </div>
        <iframe class="rre-frame" data-frame title="Remotion Recorder" allow="camera; microphone; display-capture; autoplay; clipboard-write" src="${APP_URL}"></iframe>
      </div>`;
  }

  setupEventListeners() {
    super.setupEventListeners();
    const root = this.overlay;
    root.querySelector('[data-act="open-studio"]')?.addEventListener('click', () => this.openStudio({ withLatest: true }));
    root.querySelector('[data-act="add"]')?.addEventListener('click', () => this.addToTimeline());
    const frame = root.querySelector('[data-frame]');
    frame?.addEventListener('load', () => this.onFrameLoaded(frame));
  }

  // The built app is served from /recorder-ui/ (npm run build:remotion-recorder). If it is missing, the dev server answers with the
  // editor's own index.html instead, so say so rather than showing the editor inside itself.
  async onFrameLoaded(frame) {
    let ok = false;
    try {
      ok = /Remotion Recorder/.test(frame.contentDocument?.title || '');
    } catch { /* cross-origin: treat as loaded */ ok = true; }
    if (!ok) {
      frame.outerHTML = '<div class="rre-missing">The Remotion Recorder has not been built yet.<br>Run <code>npm run build:remotion-recorder</code> once, then reopen this window.</div>';
      return;
    }
    // Upstream's "Go to Studio" link points at its own Remotion Studio server (localhost:3000); open the editor's Studio instead.
    try {
      frame.contentDocument.addEventListener('click', (ev) => {
        const link = ev.target?.closest?.('a[href^="http://localhost:3000/"]');
        if (!link) return;
        ev.preventDefault();
        this.openStudio({ withLatest: true });
      }, true);
    } catch { /* not reachable */ }
  }

  frameWindow() {
    return this.overlay?.querySelector('[data-frame]')?.contentWindow ?? null;
  }

  reply(message) {
    this.frameWindow()?.postMessage({ channel: CHANNEL, ...message }, window.location.origin);
  }

  setStatus(text) {
    const el = this.overlay?.querySelector('[data-status]');
    if (el) el.textContent = text;
  }

  handleMessage(event) {
    const data = event.data;
    if (event.origin !== window.location.origin || event.source !== this.frameWindow()) return;
    if (!data || data.channel !== CHANNEL) return;

    if (data.type === 'file') {
      const take = this.takes.get(data.endDate) || { files: {}, expectedFrames: 0, captions: null };
      take.files[data.prefix] = { blob: data.blob, mimeType: data.mimeType };
      take.expectedFrames = Math.max(take.expectedFrames, data.expectedFrames || 0);
      this.takes.set(data.endDate, take);
      this.setStatus(`Saving take… ${Object.keys(take.files).length} file(s) received`);
    } else if (data.type === 'transcribe') {
      this.transcribe(data.requestId, data.endDate);
    } else if (data.type === 'cancel-transcribe') {
      this.jobs.get(data.requestId)?.abort();
    }
  }

  async transcribe(requestId, endDate) {
    const take = this.takes.get(endDate);
    const webcam = take?.files.webcam;
    if (!webcam) {
      this.reply({ type: 'transcribe-error', requestId, message: 'No webcam recording to transcribe.' });
      this.takeFinished(endDate);
      return;
    }
    const controller = new AbortController();
    this.jobs.set(requestId, controller);
    try {
      const { transcribeTake } = await import('../../features/recorder-studio/captions/transcribe.ts');
      const captions = await transcribeTake(webcam.blob, {
        signal: controller.signal,
        onProgress: (p) => {
          const pct = p.progress != null ? Math.round(p.progress * 100) : null;
          this.reply({
            type: 'transcribe-progress', requestId,
            title: p.stage === 'loading-model' ? 'Downloading Whisper model' : `Transcribing webcam${endDate}`,
            description: pct !== null ? `${pct}%` : 'In your browser',
          });
        },
      });
      take.captions = captions.length ? captions : null;
      this.reply({ type: 'transcribe-done', requestId });
    } catch (err) {
      if (err?.name === 'AbortError') this.reply({ type: 'transcribe-aborted', requestId });
      else this.reply({ type: 'transcribe-error', requestId, message: err?.message || 'Transcription failed' });
    } finally {
      this.jobs.delete(requestId);
      this.takeFinished(endDate);
    }
  }

  takeFinished(endDate) {
    this.latest = endDate;
    const take = this.takes.get(endDate);
    const names = Object.keys(take?.files || {}).map((k) => KIND_LABELS[k] || k).join(', ');
    this.setStatus(`Take saved (${names})${take?.captions ? ' with captions' : ''}. Add it to the timeline or edit it in Recorder Studio.`);
    const add = this.overlay?.querySelector('[data-act="add"]');
    if (add) { add.disabled = false; add.classList.add('primary'); }
  }

  sourcesOf(endDate) {
    const take = this.takes.get(endDate);
    if (!take) return [];
    return Object.entries(take.files).map(([kind, f]) => ({ kind, label: KIND_LABELS[kind] || kind, blob: f.blob, mimeType: f.mimeType }));
  }

  addToTimeline() {
    if (this.latest == null) return;
    const take = this.takes.get(this.latest);
    const sources = this.sourcesOf(this.latest);
    if (!sources.length) return;
    this.onConfirm({
      action: 'recordingComplete',
      blob: sources[0].blob,
      type: sources[0].kind,
      duration: take.expectedFrames ? take.expectedFrames / FPS : 0,
      layout: 'separate',
      sources,
    });
    this.close();
  }

  async openStudio({ withLatest = false } = {}) {
    const [{ getRecorderProject }, { RecorderStudioModal }] = await Promise.all([
      import('../../features/recorder-studio/mount.tsx'),
      import('./RecorderStudioModal.jsx'),
    ]);
    if (withLatest && this.latest != null) {
      const sources = this.sourcesOf(this.latest);
      const project = getRecorderProject();
      if (sources.some((s) => s.kind === 'webcam') && !project.takeTimestamps().includes(this.latest)) {
        project.addTake({ sources, timestamp: this.latest });
        const captions = this.takes.get(this.latest)?.captions;
        if (captions) project.setCaptions(this.latest, captions);
      }
    }
    const onAddToTimeline = this.onStudioExport;
    this.close();
    new RecorderStudioModal({ onAddToTimeline }).open();
  }

  close() {
    window.removeEventListener('message', this.onMessage);
    this.jobs.forEach((c) => c.abort());
    return super.close();
  }
}

export default RecorderModal;
