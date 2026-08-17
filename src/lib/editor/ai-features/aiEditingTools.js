import { AiMuAPI } from '../aiMuapi.js';
import { createTimelineStateAdapter } from '../timelineStateAdapter.js';
import { fillGap, extendClip } from './fillExtendTools.js';

const FILL_EXTEND_MODELS = [
  { value: 'seedance-2.5-first-last-frame', label: 'Seedance 2.5 First/Last Frame' },
  { value: 'minimax-h3-open-image-to-video', label: 'MiniMax H3 Open Image-to-Video' },
  { value: 'vidu-q2-turbo-start-end-video', label: 'Vidu Q2 Turbo Start/End' },
  { value: 'vidu-q2-pro-start-end-video', label: 'Vidu Q2 Pro Start/End' },
];

function modelSelectHTML(selectedValue) {
  const options = FILL_EXTEND_MODELS.map(m =>
    `<option value="${m.value}"${m.value === selectedValue ? ' selected' : ''}>${m.label}</option>`
  ).join('');
  return `<div class="form-group"><label>Model</label><select id="fill-extend-model">${options}</select></div>`;
}

export const EDITING_TOOLS = {
  FILL_GAP: 'fillGap',
  EXTEND_CLIP: 'extend-clip',
  GENERATE_MUSIC: 'generate-music',
  SAM3_MASKING: 'sam3-masking'
};

export class AIEditingTools {
  constructor(timelineState) {
    this.timelineState = timelineState;
    this.currentTool = null;
    this.modal = null;
  }

  init(container) {
    this.container = container;
    return this;
  }

  setModal(modal) {
    this.modal = modal;
  }

  getSelectedClips() {
    if (typeof this.timelineState.getSelectedClips === 'function') {
      return this.timelineState.getSelectedClips();
    }
    return [];
  }

  getModal() {
    return this.modal;
  }

  selectTool(tool) {
    this.currentTool = tool;
    const btns = this.container.querySelectorAll('.ai-tool-btn');
    btns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    this.showToolModal(tool);
  }

  showToolModal(tool) {
    this.closeModal();

    const modal = document.createElement('div');
    modal.className = 'ai-tool-modal';
    modal.innerHTML = this.getModalContent(tool);

    this.container.appendChild(modal);
    this.modal = modal;

    this.setupModalEvents(tool, modal);
  }

  getModalContent(tool) {
    switch (tool) {
      case EDITING_TOOLS.FILL_GAP:
        return `
          <div class="modal-header">
            <h3>Fill Gap</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <p>AI will generate footage to bridge the gap between two clips.</p>
            ${modelSelectHTML('seedance-2.5-first-last-frame')}
            <div class="form-group">
              <label>Duration (seconds)</label>
              <input type="number" id="fill-gap-duration" value="3" min="1" max="10">
            </div>
            <div class="form-group">
              <label>Prompt</label>
              <input type="text" id="fill-gap-prompt" placeholder="Describe the transition...">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel">Cancel</button>
            <button class="btn-generate">Generate</button>
          </div>
        `;

      case EDITING_TOOLS.EXTEND_CLIP:
        return `
          <div class="modal-header">
            <h3>Extend Clip</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <p>Generate additional footage before or after a clip.</p>
            ${modelSelectHTML('seedance-2.5-first-last-frame')}
            <div class="form-group">
              <label>Direction</label>
              <select id="extend-direction">
                <option value="after">Extend After</option>
                <option value="before">Extend Before</option>
                <option value="both">Both Sides</option>
              </select>
            </div>
            <div class="form-group">
              <label>Duration (seconds)</label>
              <input type="number" id="extend-duration" value="2" min="1" max="5">
            </div>
            <div class="form-group">
              <label>Prompt</label>
              <input type="text" id="extend-prompt" placeholder="Describe the extension...">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel">Cancel</button>
            <button class="btn-generate">Generate</button>
          </div>
        `;

      case EDITING_TOOLS.GENERATE_MUSIC:
        return `
          <div class="modal-header">
            <h3>Generate Music</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <p>Create music based on your video content.</p>
            <div class="form-group">
              <label>Genre</label>
              <select id="music-genre">
                <option value="cinematic">Cinematic</option>
                <option value="upbeat">Upbeat</option>
                <option value="ambient">Ambient</option>
                <option value="electronic">Electronic</option>
                <option value="orchestral">Orchestral</option>
              </select>
            </div>
            <div class="form-group">
              <label>Mood</label>
              <select id="music-mood">
                <option value="energetic">Energetic</option>
                <option value="calm">Calm</option>
                <option value="dramatic">Dramatic</option>
                <option value="melancholic">Melancholic</option>
              </select>
            </div>
            <div class="form-group">
              <label>Style</label>
              <input type="text" id="music-style" placeholder="e.g. lo-fi, synthwave, acoustic..." />
            </div>
            <div class="form-group">
              <label>Tempo</label>
              <select id="music-tempo">
                <option value="slow">Slow</option>
                <option value="medium" selected>Medium</option>
                <option value="fast">Fast</option>
              </select>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="music-instrumental" checked />
                Instrumental only
              </label>
            </div>
            <div class="form-group">
              <label>Duration mode</label>
              <select id="music-duration-mode">
                <option value="selected">Match selected clip</option>
                <option value="timeline">Match timeline</option>
                <option value="custom" selected>Custom seconds</option>
              </select>
            </div>
            <div class="form-group" id="music-duration-custom-group">
              <label>Duration (seconds)</label>
              <input type="number" id="music-duration" value="30" min="10" max="180">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel">Cancel</button>
            <button class="btn-generate">Generate</button>
          </div>
        `;

      case EDITING_TOOLS.SAM3_MASKING:
        return `
          <div class="modal-header">
            <h3>SAM3 Masking</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <p>Segment objects in your video using AI.</p>
            <div class="form-group">
              <label>Prompt Type</label>
              <select id="mask-prompt-type">
                <option value="text">Text Prompt</option>
                <option value="box">Bounding Box</option>
                <option value="click">Click Segmentation</option>
              </select>
            </div>
            <div class="form-group">
              <label>Text Prompt</label>
              <input type="text" id="mask-text-prompt" placeholder="Describe the object to segment...">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel">Cancel</button>
            <button class="btn-generate">Segment</button>
          </div>
        `;

      default:
        return '<p>Unknown tool</p>';
    }
  }

  setupModalEvents(tool, modal) {
    modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
    modal.querySelector('.btn-cancel').addEventListener('click', () => this.closeModal());
    modal.querySelector('.btn-generate').addEventListener('click', () => this.executeTool(tool));

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal();
    });
  }

  async executeTool(tool) {
    const generateBtn = this.modal.querySelector('.btn-generate');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
      let result;
      switch (tool) {
        case EDITING_TOOLS.FILL_GAP:
          result = await this.executeFillGap();
          break;
        case EDITING_TOOLS.EXTEND_CLIP:
          result = await this.executeExtendClip();
          break;
        case EDITING_TOOLS.GENERATE_MUSIC:
          result = await this.executeGenerateMusic();
          break;
        case EDITING_TOOLS.SAM3_MASKING:
          result = await this.executeSAM3Masking();
          break;
      }

      this.showSuccess(result);
    } catch (error) {
      this.showError(error.message);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate';
    }
  }

  async executeFillGap() {
    const duration = parseInt(this.modal.querySelector('#fill-gap-duration').value);
    const model = this.modal.querySelector('#fill-extend-model')?.value || 'seedance-2.5-first-last-frame';

    const selectedClips = this.getSelectedClips();
    if (selectedClips.length < 2) {
      throw new Error('Please select at least two clips with a gap between them.');
    }

    const first = selectedClips[0];
    const second = selectedClips[1];
    const trackId = first.trackId || first.track || first._trackId;
    const gapStart = first.end ?? first.endTime ?? (first.startTime ?? 0) + (first.duration ?? 0);
    const gapEnd = second.start ?? second.startTime ?? 0;
    const prompt = this.modal.querySelector('#fill-gap-prompt')?.value || `Generate footage to fill a ${duration} second gap`;

    const result = await fillGap(this.timelineState.getState(), trackId, gapStart, gapEnd, {
      duration,
      prompt,
      model,
    });

    return result;
  }

  async executeExtendClip() {
    const direction = this.modal.querySelector('#extend-direction').value;
    const duration = parseInt(this.modal.querySelector('#extend-duration').value);
    const model = this.modal.querySelector('#fill-extend-model')?.value || 'seedance-2.5-first-last-frame';

    const selectedClip = this.getSelectedClips()[0];
    if (!selectedClip) {
      throw new Error('Please select a clip to extend.');
    }

    const clipId = selectedClip.id;
    const prompt = this.modal.querySelector('#extend-prompt')?.value ||
      `Generate footage to extend clip ${direction}`;

    const result = await extendClip(this.timelineState.getState(), clipId, direction, {
      duration,
      prompt,
      model,
    });

    return result;
  }

  async executeGenerateMusic() {
    const genre = this.modal.querySelector('#music-genre').value;
    const mood = this.modal.querySelector('#music-mood').value;
    const style = this.modal.querySelector('#music-style')?.value?.trim() || '';
    const tempo = this.modal.querySelector('#music-tempo')?.value || 'medium';
    const instrumental = this.modal.querySelector('#music-instrumental')?.checked ?? true;
    const durationMode = this.modal.querySelector('#music-duration-mode')?.value || 'custom';
    const customDuration = parseInt(this.modal.querySelector('#music-duration').value, 10);

    const selectedClip = this.getSelectedClips()[0];
    const videoContext = this.buildVideoContext(selectedClip);
    const duration = this.resolveMusicDuration(durationMode, customDuration, selectedClip);

    const prompt = this.buildMusicPrompt({ genre, mood, style, tempo, instrumental, videoContext });

    const result = await AiMuAPI.generateMusic({
      prompt,
      genre,
      mood,
      style: style || undefined,
      duration,
      instrumental,
    });

    const audioClip = this.createAudioClipFromResult(result, duration);
    this.timelineState.addAudioTrack(audioClip);

    return { success: true, audioClip };
  }

  async executeSAM3Masking() {
    const promptType = this.getMaskPromptType();
    const textPrompt = this.getMaskTextPrompt();
    const points = this.getMaskClickPoint();
    const box = this.getMaskBox();

    const selectedClip = this.getSelectedClips()[0];
    if (!selectedClip) {
      throw new Error('Please select a clip to apply masking.');
    }

    const imageData = await this.extractFrameFromClip(selectedClip);
    const prompts = { type: promptType, prompt: textPrompt };
    if (points) prompts.points = points;
    if (box) prompts.box = box;

    const result = await AiMuAPI.applySAM3Segmentation(imageData, prompts);

    this.applyMaskToClip(selectedClip, result);

    const maskUrl = result.mask || result.mask_url || result.url;
    window.dispatchEvent(new CustomEvent('sam3-mask-applied', {
      detail: { maskUrl, clipId: selectedClip.id }
    }));

    return { success: true, maskUrl, clipId: selectedClip.id };
  }

  buildVideoContext(selectedClip) {
    if (!selectedClip) return '';
    const clipName = selectedClip.name || selectedClip.src || 'selected scene';
    if (selectedClip.type === 'video') {
      return `Music for video scene: ${clipName}`;
    }
    return `Music for clip: ${clipName}`;
  }

  resolveMusicDuration(mode, customDuration, selectedClip) {
    const DEFAULT_DURATION = 30;
    if (mode === 'selected' && selectedClip) {
      return Math.max(10, Math.round((selectedClip.duration || selectedClip.end - selectedClip.start || DEFAULT_DURATION) * 100) / 100);
    }
    if (mode === 'timeline') {
      const tracks = this.timelineState._getTracks ? this.timelineState._getTracks() : (this.timelineState.tracks || []);
      let maxEnd = 0;
      tracks.forEach(track => {
        (track.items || []).forEach(clip => {
          const end = clip.end || (clip.start || 0) + (clip.duration || 0);
          if (end > maxEnd) maxEnd = end;
        });
      });
      return Math.max(10, Math.round(maxEnd * 100) / 100) || DEFAULT_DURATION;
    }
    return Math.max(10, Math.min(180, customDuration || DEFAULT_DURATION));
  }

  buildMusicPrompt({ genre, mood, style, tempo, instrumental, videoContext }) {
    const parts = [];
    if (videoContext) parts.push(videoContext);
    parts.push(`${genre} ${mood} music`);
    if (style) parts.push(`style: ${style}`);
    if (tempo) parts.push(`tempo: ${tempo}`);
    if (instrumental) parts.push('instrumental');
    return parts.join('. ') + '.';
  }

  getMaskPromptType() {
    if (!this.modal) return 'text';
    const el = this.modal.querySelector('#mask-prompt-type');
    return el ? el.value : 'text';
  }

  getMaskTextPrompt() {
    if (!this.modal) return '';
    const el = this.modal.querySelector('#mask-text-prompt');
    return el ? el.value : '';
  }

  getMaskClickPoint() {
    if (!this.modal) return null;
    const el = this.modal.querySelector('#mask-click-point');
    if (!el) return null;
    try { return JSON.parse(el.value || el.textContent || 'null'); }
    catch { return null; }
  }

  getMaskBox() {
    if (!this.modal) return null;
    const el = this.modal.querySelector('#mask-box');
    if (!el) return null;
    try { return JSON.parse(el.value || el.textContent || 'null'); }
    catch { return null; }
  }

  createClipFromResult(result, startTime, duration) {
    return {
      id: `clip-${Date.now()}`,
      type: 'video',
      source: result.url || result.video_url,
      startTime,
      duration,
      endTime: startTime + duration,
      tracks: ['video']
    };
  }

  createAudioClipFromResult(result, duration) {
    return {
      id: `audio-${Date.now()}`,
      type: 'audio',
      url: result.url,
      src: result.url,
      name: 'AI Generated Music',
      startTime: 0,
      duration: duration || result.duration || 30,
      endTime: duration || result.duration || 30,
      tracks: ['audio']
    };
  }

  extractFrameFromClip(clip) {
    return Promise.resolve(clip.source);
  }

  applyMaskToClip(clip, maskResult) {
    clip.mask = maskResult.mask;
    this.timelineState.updateClip(clip);
  }

  showSuccess(result) {
    const toast = document.createElement('div');
    toast.className = 'ai-tool-toast success';
    toast.textContent = result.success ? 'Successfully generated!' : 'Operation completed';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '10000';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
    this.closeModal();
  }

  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'ai-tool-toast error';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '10000';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  closeModal() {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
      this.modal = null;
    }
    this.currentTool = null;
  }

  destroy() {
    this.closeModal();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export function createAIEditingTools(timelineState, container) {
  return new AIEditingTools(timelineState).init(container);
}