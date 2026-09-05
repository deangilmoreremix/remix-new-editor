import { AiMuAPI } from './aiMuapi.js';

export class RetakePanel {
  constructor(timelineState, container) {
    this.timelineState = timelineState;
    this.container = container;
    this.selectedClipId = null;
    this.selectedTakeIndex = null;
    this.comparing = false;
    this.panel = null;
  }

  init() {
    this.panel = document.createElement('div');
    this.panel.className = 'retake-panel';
    this.panel.innerHTML = `
      <div class="retake-panel__header">
        <h3>Retakes</h3>
        <button class="retake-panel__close">×</button>
      </div>
      <div class="retake-panel__body">
        <div class="retake-panel__empty">Select a clip to view retakes</div>
      </div>
    `;
    this.container.appendChild(this.panel);
    this.bindEvents();
    return this;
  }

  bindEvents() {
    this.panel.querySelector('.retake-panel__close').addEventListener('click', () => this.hide());
  }

  showForClip(clipId) {
    this.selectedClipId = clipId;
    this.selectedTakeIndex = null;
    this.comparing = false;
    this.renderBody();
    this.panel.style.display = 'block';
  }

  hide() {
    this.panel.style.display = 'none';
    this.selectedClipId = null;
  }

  getRetakes() {
    const state = this.timelineState.getState();
    if (!this.selectedClipId) return [];
    for (const track of state.tracks || []) {
      const clip = track.clips?.find(c => c.id === this.selectedClipId || c.id === Number(this.selectedClipId));
      if (clip) return clip.retakes || [];
    }
    return [];
  }

  addTake(clipId, takeData) {
    const state = this.timelineState.getState();
    for (const track of state.tracks || []) {
      const clip = track.clips?.find(c => c.id === clipId || c.id === Number(clipId));
      if (clip) {
        if (!Array.isArray(clip.retakes)) clip.retakes = [];
        const take = {
          id: `take-${Date.now()}`,
          createdAt: Date.now(),
          ...takeData,
        };
        clip.retakes.push(take);
        this.timelineState.setState({ project: state.project });
        if (this.selectedClipId === clipId) this.renderBody();
        return take;
      }
    }
    return null;
  }

  selectTake(takeId) {
    this.selectedTakeIndex = takeId;
    const retakes = this.getRetakes();
    const take = retakes.find(t => t.id === takeId);
    if (!take) return;
    const state = this.timelineState.getState();
    for (const track of state.tracks || []) {
      const clip = track.clips?.find(c => c.id === this.selectedClipId || c.id === Number(this.selectedClipId));
      if (clip) {
        Object.assign(clip, { source: take.url || take.src, thumbnail: take.thumbnail });
        this.timelineState.setState({ project: state.project });
        this.renderBody();
      }
    }
  }

  deleteTake(takeId) {
    const state = this.timelineState.getState();
    for (const track of state.tracks || []) {
      const clip = track.clips?.find(c => c.id === this.selectedClipId || c.id === Number(this.selectedClipId));
      if (clip && clip.retakes) {
        clip.retakes = clip.retakes.filter(t => t.id !== takeId);
        this.timelineState.setState({ project: state.project });
        if (this.selectedTakeIndex === takeId) this.selectedTakeIndex = null;
        this.renderBody();
      }
    }
  }

  toggleCompare(takeId) {
    this.comparing = !this.comparing;
    this.selectedTakeIndex = this.comparing ? takeId : null;
    this.renderBody();
  }

  renderBody() {
    const body = this.panel.querySelector('.retake-panel__body');
    const retakes = this.getRetakes();

    if (!this.selectedClipId) {
      body.innerHTML = '<div class="retake-panel__empty">Select a clip to view retakes</div>';
      return;
    }

    if (retakes.length === 0) {
      body.innerHTML = `
        <div class="retake-panel__empty">No retakes yet</div>
        <div class="retake-panel__actions">
          <button class="retake-panel__btn retake-panel__btn--primary" id="retake-generate-btn">Generate Take</button>
        </div>
      `;
      body.querySelector('#retake-generate-btn')?.addEventListener('click', () => this.generateTake());
      return;
    }

    const listItems = retakes.map((take, idx) => {
      const isSelected = this.selectedTakeIndex === take.id;
      return `
        <div class="retake-panel__item ${isSelected ? 'retake-panel__item--active' : ''}" data-take-id="${take.id}">
          <div class="retake-panel__item-meta">
            <span class="retake-panel__take-num">Take ${idx + 1}</span>
            <span class="retake-panel__take-date">${new Date(take.createdAt).toLocaleTimeString()}</span>
          </div>
          <div class="retake-panel__item-actions">
            <button class="retake-panel__icon-btn retake-panel__compare-btn" data-take-id="${take.id}" title="Compare">⇔</button>
            <button class="retake-panel__icon-btn retake-panel__select-btn" data-take-id="${take.id}" title="Use this take">✓</button>
            <button class="retake-panel__icon-btn retake-panel__delete-btn" data-take-id="${take.id}" title="Delete">×</button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="retake-panel__list">${listItems}</div>
      <div class="retake-panel__actions">
        <button class="retake-panel__btn retake-panel__btn--primary" id="retake-generate-btn">Generate Take</button>
      </div>
    `;

    body.querySelector('#retake-generate-btn')?.addEventListener('click', () => this.generateTake());
    body.querySelectorAll('.retake-panel__select-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectTake(btn.dataset.takeId));
    });
    body.querySelectorAll('.retake-panel__delete-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteTake(btn.dataset.takeId));
    });
    body.querySelectorAll('.retake-panel__compare-btn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleCompare(btn.dataset.takeId));
    });
  }

  async generateTake() {
    const clipId = this.selectedClipId;
    if (!clipId) return;

    const generateBtn = this.panel.querySelector('#retake-generate-btn');
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
    }

    try {
      const state = this.timelineState.getState();
      let clip = null;
      let trackId = null;
      for (const track of state.tracks || []) {
        clip = track.clips?.find(c => c.id === clipId || c.id === Number(clipId));
        if (clip) { trackId = track.id; break; }
      }
      if (!clip) throw new Error('Clip not found');

      const prompt = `Regenerate take for clip: ${clip.name || clipId}`;
      const result = await AiMuAPI.generateVideo(prompt, 'seedance-2.5-first-last-frame', {
        firstFrameUrl: clip.thumbnail,
        duration: (clip.end - clip.start) || 5,
      });

      this.addTake(clipId, {
        url: result.url || result.video_url,
        src: result.url || result.video_url,
        thumbnail: result.thumbnail || clip.thumbnail,
        prompt,
        model: 'seedance-2.5-first-last-frame',
      });
    } catch (err) {
      console.error('Retake generation failed:', err);
      const toast = document.createElement('div');
      toast.className = 'ai-tool-toast error';
      toast.textContent = err.message || 'Failed to generate take';
      toast.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:8px;z-index:10000;background:#ef4444;color:#fff;';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    } finally {
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Take';
      }
    }
  }

  destroy() {
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
  }
}

export function createRetakePanel(timelineState, container) {
  return new RetakePanel(timelineState, container).init();
}
