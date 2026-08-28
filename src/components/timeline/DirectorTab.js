/**
 * Director Tab — Ported from CineGen for Timeline Studio
 *
 * Features:
 * 1.1 Script import (.txt/.md/.fountain/.fdx)
 * 1.2 LLM script breakdown (characters/locations/props/vehicles)
 * 1.3 Breakdown rail with element cards
 * 1.4 Scene navigation (All scenes / per-scene filter)
 * 1.5 Shotlist compiler (timed beats, coverage targets)
 * 1.6 CINEDANCE/Oneiric prompt compilation
 * 1.7 Look Bible builder (genre, film refs, mood board)
 * 1.8 Look Bible LLM rewrite
 * 1.9 Generate page (production console + prompt stack)
 * 1.10 Takes management (Full/Shot, native/held)
 * 1.11 Shot grammar chips
 * 1.12 Camera Life slider
 * 1.13 Blocking maps
 * 1.14 Director's notes per-scene
 * 1.15 Director's notes per-clip
 * 1.16 Per-scene shotlisting
 * 1.17 Lens locks (diagonal FOV)
 * 1.18 Acting tasks
 * 1.19 Dialogue discipline
 * 1.20 Paper slate naming
 * 1.21 Full-take shot ruler
 * 1.22 Setup page (Clip length/Aspect/Resolution)
 * 1.23 Style prefix
 * 1.24 Coverage section
 * 1.25 Reset to original
 */

import { cineGenAPI } from '../../lib/cinegen/cinegenAPI.js';

const CINEDANCE_TEMPLATE = {
  SCENE_CONTEXT: '',
  ACTIVE_REFERENCES: '',
  LOCATION_MAP: '',
  FORMAT_MODE: '',
  SEGMENTS: [],
  DIALOGUE: '',
  AUDIO: '',
  STYLE: '',
  POSITIVE_LOCKS: ''
};

const LENS_PRESETS = [
  { fov: 8, label: 'Extreme Telephoto', description: 'Compressed space, flattened depth' },
  { fov: 18, label: 'Telephoto', description: 'Isolated subject, blurred background' },
  { fov: 29, label: 'Short Telephoto', description: 'Natural portrait perspective' },
  { fov: 47, label: 'Standard', description: 'Human eye perspective' },
  { fov: 84, label: 'Wide', description: 'Expanded space, deep focus' },
  { fov: 107, label: 'Ultra Wide', description: 'Exaggerated depth, immersive' }
];

const SHOT_SIZES = [
  { id: 'ELS', label: 'Extreme Long Shot', desc: 'Environment dominates' },
  { id: 'LS', label: 'Long Shot', desc: 'Full body + environment' },
  { id: 'MS', label: 'Medium Shot', desc: 'Waist up' },
  { id: 'MCU', label: 'Medium Close-Up', desc: 'Chest up' },
  { id: 'CU', label: 'Close-Up', desc: 'Face fills frame' },
  { id: 'ECU', label: 'Extreme Close-Up', desc: 'Eyes, details' }
];

const CAMERA_ANGLES = [
  { id: 'eye', label: 'Eye Level', desc: 'Neutral perspective' },
  { id: 'low', label: 'Low Angle', desc: 'Subject appears powerful' },
  { id: 'high', label: 'High Angle', desc: 'Subject appears vulnerable' },
  { id: 'dutch', label: 'Dutch Angle', desc: 'Disorientation, tension' },
  { id: 'pov', label: "POV", desc: "Subject's perspective" },
  { id: 'birds', label: "Bird's Eye", desc: 'God view, overview' }
];

const COVERAGE_TYPES = ['Master', 'Singles', 'OTS', 'Two-Shot', 'Insert', 'Cutaway'];

export class DirectorTab {
  constructor(container, state, callbacks = {}) {
    this.container = container;
    this.state = state;
    this.callbacks = callbacks;
    this.script = '';
    this.scenes = [];
    this.elements = { characters: [], locations: [], props: [], vehicles: [] };
    this.clips = [];
    this.lookBible = { genre: '', filmRefs: [], moodBoard: [], notes: '' };
    this.setup = { clipLength: 20, aspect: '16:9', resolution: '1080p', generateAudio: false };
    this.activeSceneId = null;
    this.selectedClipId = null;
    this.activeTab = 'script'; // script | breakdown | shotlist | lookbible | generate
    // 1.25 Reset to original — snapshot of first shotlist compile
    this._originalShotlistSnapshot = null;
    this._originalClips = null;
    // 1.13 Blocking maps — stored per scene
    this.blockingMaps = {};
    // 1.18 Acting tasks — stored per character per scene
    this.actingTasks = {};
    this._render();
  }

  _render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="director-tab">
        <div class="director-header">
          <h2 class="director-title">🎬 Director</h2>
          <div class="director-tabs">
            <button class="director-tab-btn active" data-tab="script">Script</button>
            <button class="director-tab-btn" data-tab="breakdown">Breakdown</button>
            <button class="director-tab-btn" data-tab="shotlist">Shotlist</button>
            <button class="director-tab-btn" data-tab="lookbible">Look Bible</button>
            <button class="director-tab-btn" data-tab="generate">Generate</button>
          </div>
        </div>
        <div class="director-body" id="directorBody"></div>
      </div>
    `;
    this._wireEvents();
    this._renderTab('script');
  }

  _wireEvents() {
    this.container.querySelectorAll('.director-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.director-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this._renderTab(this.activeTab);
      });
    });
  }

  _renderTab(tab) {
    const body = this.container.querySelector('#directorBody');
    if (!body) return;
    switch (tab) {
      case 'script': this._renderScriptTab(body); break;
      case 'breakdown': this._renderBreakdownTab(body); break;
      case 'shotlist': this._renderShotlistTab(body); break;
      case 'lookbible': this._renderLookBibleTab(body); break;
      case 'generate': this._renderGenerateTab(body); break;
    }
  }

  // === SCRIPT TAB (1.1) ===
  _renderScriptTab(container) {
    container.innerHTML = `
      <div class="director-script-tab">
        <div class="script-toolbar">
          <button class="dir-btn primary" id="uploadScript">📄 Upload Script</button>
          <button class="dir-btn" id="pasteScript">📋 Paste Script</button>
          <select id="scriptFormat" class="dir-select">
            <option value="auto">Auto-detect format</option>
            <option value="txt">Plain Text (.txt)</option>
            <option value="md">Markdown (.md)</option>
            <option value="fountain">Fountain (.fountain)</option>
            <option value="fdx">Final Draft (.fdx)</option>
          </select>
        </div>
        <textarea id="scriptInput" class="script-input" placeholder="Paste your script here or upload a file...

Supported formats: .txt, .md, .fountain, .fdx (Final Draft)

Example:
FADE IN:

SCENE 1 - INT. COFFEE SHOP - DAY

PETER (30s, tired eyes) sits alone at a corner table. Rain streaks the window.

PETER
(whispering)
She said she'd be here by noon.

A WOMAN (20s, red coat) enters, scanning the room."></textarea>
        <div class="script-actions">
          <button class="dir-btn primary" id="runBreakdown">🔍 Run Breakdown</button>
          <span class="script-status" id="scriptStatus"></span>
        </div>
        <div class="script-scenes" id="scriptScenes"></div>
      </div>
    `;

    container.querySelector('#uploadScript')?.addEventListener('click', () => this._uploadScript());
    container.querySelector('#pasteScript')?.addEventListener('click', () => {
      const input = container.querySelector('#scriptInput');
      if (input) input.focus();
    });
    container.querySelector('#runBreakdown')?.addEventListener('click', () => this._runBreakdown());
  }

  _uploadScript() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.fountain,.fdx';
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.script = ev.target?.result || '';
        const scriptInput = this.container.querySelector('#scriptInput');
        if (scriptInput) scriptInput.value = this.script;
        this._updateStatus(`Loaded: ${file.name} (${this.script.length} chars)`);
      };
      reader.readAsText(file);
    });
    input.click();
  }

  // === BREAKDOWN TAB (1.2, 1.3, 1.4) ===
  _renderBreakdownTab(container) {
    const allElements = [
      ...this.elements.characters,
      ...this.elements.locations,
      ...this.elements.props,
      ...this.elements.vehicles
    ];

    container.innerHTML = `
      <div class="director-breakdown-tab">
        <div class="breakdown-layout">
          <div class="breakdown-scene-nav">
            <h4>Scenes</h4>
            <button class="scene-nav-btn active" data-scene="all">All Scenes</button>
            ${this.scenes.map(s => `<button class="scene-nav-btn" data-scene="${s.id}">${s.heading}</button>`).join('')}
          </div>
          <div class="breakdown-rail">
            <h4>Elements <span class="count">(${allElements.length})</span></h4>
            <div class="breakdown-categories">
              <div class="element-category">
                <h5>Characters (${this.elements.characters.length})</h5>
                ${this.elements.characters.map(el => this._renderElementCard(el)).join('')}
              </div>
              <div class="element-category">
                <h5>Locations (${this.elements.locations.length})</h5>
                ${this.elements.locations.map(el => this._renderElementCard(el)).join('')}
              </div>
              <div class="element-category">
                <h5>Props (${this.elements.props.length})</h5>
                ${this.elements.props.map(el => this._renderElementCard(el)).join('')}
              </div>
              <div class="element-category">
                <h5>Vehicles (${this.elements.vehicles.length})</h5>
                ${this.elements.vehicles.map(el => this._renderElementCard(el)).join('')}
              </div>
            </div>
            ${allElements.length === 0 ? '<p class="empty-state">Run breakdown to extract elements from your script.</p>' : ''}
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.scene-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.scene-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeSceneId = btn.dataset.scene === 'all' ? null : btn.dataset.scene;
        this._filterBreakdownByScene(this.activeSceneId);
      });
    });
  }

  _renderElementCard(el) {
    return `
      <div class="element-card" data-element="${el.id}">
        <div class="element-card-ref">${el.refImage || ''}</div>
        <div class="element-card-info">
          <span class="element-name">${el.name}</span>
          <span class="element-tag">@${el.tag}</span>
          ${el.location ? `<span class="element-pill">${el.location}</span>` : ''}
        </div>
        <div class="element-card-actions">
          <button class="mini-btn" data-action="assign">Assign</button>
          <button class="mini-btn" data-action="create">Create Element</button>
          <button class="mini-btn dismiss" data-action="dismiss">✕</button>
        </div>
      </div>
    `;
  }

  _filterBreakdownByScene(sceneId) {
    const cards = this.container.querySelectorAll('.element-card');
    cards.forEach(card => {
      if (!sceneId) {
        card.style.display = 'flex';
      } else {
        const elScene = card.dataset.scenes || '';
        card.style.display = elScene.includes(sceneId) ? 'flex' : 'none';
      }
    });
  }

  // === SHOTLIST TAB (1.5, 1.6, 1.11, 1.16, 1.23, 1.24) ===
  _renderShotlistTab(container) {
    container.innerHTML = `
      <div class="director-shotlist-tab">
        <div class="shotlist-toolbar">
          <button class="dir-btn primary" id="compileShotlist">⚡ Compile Shotlist</button>
          <button class="dir-btn" id="perSceneShotlist">Per-Scene Shotlist</button>
          <button class="dir-btn" id="resetShotlist" ${!this._originalShotlistSnapshot ? 'disabled' : ''}>↶ Reset to Original</button>
          <div class="shotlist-totals" id="shotlistTotals">${this.clips.length} clips · ${this.clips.reduce((sum, c) => sum + (c.shots?.length || 0), 0)} shots · ${this.clips.reduce((sum, c) => sum + (c.duration || 0), 0)}s</div>
        </div>
        <div class="shotlist-asset-registry" id="assetRegistry"></div>
        <div class="shotlist-style-prefix">
          <h4>Style Prefix</h4>
          <textarea id="stylePrefix" class="dir-textarea" placeholder="Cinematic style prefix applied to all shots...">${this.lookBible.notes || ''}</textarea>
          <button class="dir-btn small" id="copyStylePrefix">📋 Copy</button>
        </div>
        <div class="shotlist-scenes" id="shotlistScenes">
          ${this.scenes.map(scene => this._renderSceneShotlist(scene)).join('')}
        </div>
      </div>
    `;

    container.querySelector('#compileShotlist')?.addEventListener('click', () => this._compileShotlist());
    container.querySelector('#perSceneShotlist')?.addEventListener('click', () => this._perSceneShotlist());
    container.querySelector('#resetShotlist')?.addEventListener('click', () => this._resetToOriginal());
    container.querySelector('#copyStylePrefix')?.addEventListener('click', () => {
      const prefix = container.querySelector('#stylePrefix')?.value || '';
      navigator.clipboard.writeText(prefix).then(() => this._showCopiedFeedback());
    });

    // Wire blocking map buttons
    container.querySelectorAll('[data-action="createBlocking"]').forEach(btn => {
      btn.addEventListener('click', () => this._createBlockingMap(btn.dataset.scene));
    });

    // Wire acting tasks save buttons
    container.querySelectorAll('[data-action="saveActing"]').forEach(btn => {
      btn.addEventListener('click', () => this._saveActingTasks(btn.dataset.scene));
    });

    // Wire acting tasks input persistence
    container.querySelectorAll('[data-char]').forEach(input => {
      input.addEventListener('change', () => {
        const sceneId = input.closest('.shotlist-scene')?.dataset.scene;
        if (sceneId) this._saveActingTasks(sceneId);
      });
    });
  }

  _renderSceneShotlist(scene) {
    const sceneClips = this.clips.filter(c => c.sceneId === scene.id);
    return `
      <div class="shotlist-scene" data-scene="${scene.id}">
        <div class="shotlist-scene-header">
          <h4>${scene.heading}</h4>
          <div class="shotlist-scene-meta">
            <input type="text" class="dir-input small" placeholder="Scene event" value="${scene.event || ''}" />
            <input type="text" class="dir-input small" placeholder="Physical action" value="${scene.physicalAction || ''}" />
          </div>
        </div>
        <div class="shotlist-clips">
          ${sceneClips.length > 0 ? sceneClips.map(clip => this._renderClipRow(clip)).join('') : '<p class="empty-state">No clips yet. Run Compile Shotlist.</p>'}
        </div>
        <div class="shotlist-scene-notes">
          <textarea class="dir-textarea small" placeholder="Director's notes for this scene..."></textarea>
          <button class="dir-btn small" data-action="applyNotes">Apply Notes with LLM</button>
        </div>
        <!-- 1.13 Blocking Maps -->
        <div class="shotlist-blocking">
          <h5>Blocking Map</h5>
          ${this._renderBlockingMap(scene.id)}
          <button class="dir-btn small" data-action="createBlocking" data-scene="${scene.id}">+ Create Blocking Map</button>
        </div>
        <!-- 1.18 Acting Tasks -->
        <div class="shotlist-acting">
          <h5>Acting Tasks</h5>
          ${this._renderActingTasks(scene.id)}
          <button class="dir-btn small" data-action="saveActing" data-scene="${scene.id}">Save Acting Tasks</button>
        </div>
      </div>
    `;
  }

  _renderClipRow(clip) {
    return `
      <div class="shotlist-clip" data-clip="${clip.id}">
        <div class="shotlist-clip-header">
          <input type="checkbox" class="queue-check" ${clip.queued ? 'checked' : ''} />
          <span class="clip-id">${clip.id}</span>
          <span class="clip-title">${clip.title || 'Untitled'}</span>
          <span class="clip-duration">${clip.duration || this.setup.clipLength}s</span>
          <span class="clip-shots-pill">${clip.shots?.length || 0} shots</span>
          <button class="mini-btn" data-action="copyPrompt">📋 Copy Prompt</button>
        </div>
        <div class="shotlist-clip-body" hidden>
          <div class="shot-grammar" id="shotGrammar-${clip.id}">
            ${this._renderShotGrammar(clip)}
          </div>
          <div class="compiled-prompt">
            <h5>Compiled Prompt (CINEDANCE)</h5>
            <pre class="prompt-text">${this._compileCINEDANCE(clip)}</pre>
          </div>
        </div>
      </div>
    `;
  }

  _renderShotGrammar(clip) {
    return `
      <div class="grammar-section">
        <label>Shot Size</label>
        <div class="grammar-chips">
          ${SHOT_SIZES.map(s => `<button class="grammar-chip ${clip.shotSize === s.id ? 'active' : ''}" data-size="${s.id}" title="${s.desc}">${s.label}</button>`).join('')}
        </div>
      </div>
      <div class="grammar-section">
        <label>Camera Angle</label>
        <div class="grammar-chips">
          ${CAMERA_ANGLES.map(a => `<button class="grammar-chip ${clip.angle === a.id ? 'active' : ''}" data-angle="${a.id}" title="${a.desc}">${a.label}</button>`).join('')}
        </div>
      </div>
      <div class="grammar-section">
        <label>Lens</label>
        <select class="dir-select" data-lens>
          ${LENS_PRESETS.map(l => `<option value="${l.fov}" ${clip.lens === l.fov ? 'selected' : ''}>${l.label} (${l.fov}°)</option>`).join('')}
        </select>
      </div>
      <div class="grammar-section">
        <label>Camera Life</label>
        <input type="range" min="0" max="100" value="${clip.cameraLife || 0}" class="life-slider" data-life />
        <span class="life-value">${clip.cameraLife || 0}%</span>
      </div>
    `;
  }

  // === LOOK BIBLE TAB (1.7, 1.8) ===
  _renderLookBibleTab(container) {
    container.innerHTML = `
      <div class="director-lookbible-tab">
        <div class="lookbible-layout">
          <div class="lookbible-left">
            <div class="lookbible-genre">
              <h4>Genre</h4>
              <div class="genre-chips">
                ${['Drama', 'Thriller', 'Comedy', 'Sci-Fi', 'Horror', 'Romance', 'Action', 'Documentary'].map(g =>
                `<button class="genre-chip ${this.lookBible.genre === g ? 'active' : ''}" data-genre="${g}">${g}</button>`
              ).join('')}
              </div>
            </div>
            <div class="lookbible-filmrefs">
              <h4>Film References</h4>
              <input type="text" class="dir-input" id="filmRefInput" placeholder="Enter film title..." />
              <button class="dir-btn small" id="addFilmRef">Add</button>
              <div class="film-ref-list" id="filmRefList">
                ${this.lookBible.filmRefs.map(ref => `<span class="film-ref-chip">${ref} <button class="remove">✕</button></span>`).join('')}
              </div>
            </div>
            <div class="lookbible-moodboard">
              <h4>Mood Board <span class="count">(${this.lookBible.moodBoard.length}/6)</span></h4>
              <div class="mood-board-grid" id="moodBoard">
                ${this.lookBible.moodBoard.map((img, i) => `<div class="mood-item"><img src="${img}" /><button class="remove">✕</button></div>`).join('')}
                ${this.lookBible.moodBoard.length < 6 ? '<button class="mood-add" id="addMoodImage">+ Add Image</button>' : ''}
              </div>
            </div>
          </div>
          <div class="lookbible-right">
            <div class="lookbible-notes-header">
              <h4>Look Notes</h4>
              <button class="dir-btn small" id="rewriteLookBible">✨ Rewrite with LLM</button>
              <button class="dir-btn small" id="updateFromRefs">Update from Refs</button>
            </div>
            <textarea id="lookNotes" class="dir-textarea large" placeholder="Look notes describe the visual style, palette, lighting, and mood for every clip in this project. They compile into the STYLE block of each CINEDANCE prompt.">${this.lookBible.notes || ''}</textarea>
          </div>
        </div>
      </div>
    `;

    this._wireLookBibleEvents(container);
  }

  _wireLookBibleEvents(container) {
    container.querySelectorAll('.genre-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        this.lookBible.genre = btn.dataset.genre;
        container.querySelectorAll('.genre-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    container.querySelector('#addFilmRef')?.addEventListener('click', () => {
      const input = container.querySelector('#filmRefInput');
      if (input?.value) {
        this.lookBible.filmRefs.push(input.value);
        input.value = '';
        this._renderTab('lookbible');
      }
    });

    container.querySelector('#addMoodImage')?.addEventListener('click', () => {
      if (this.lookBible.moodBoard.length >= 6) return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const url = URL.createObjectURL(file);
          this.lookBible.moodBoard.push(url);
          this._renderTab('lookbible');
        }
      });
      input.click();
    });

    container.querySelector('#rewriteLookBible')?.addEventListener('click', () => this._rewriteLookBible());
    container.querySelector('#updateFromRefs')?.addEventListener('click', () => this._updateNotesFromRefs());
  }

  // === GENERATE TAB (1.9, 1.10, 1.12, 1.13, 1.21) ===
  _renderGenerateTab(container) {
    const selectedClip = this.clips.find(c => c.id === this.selectedClipId) || this.clips[0];

    container.innerHTML = `
      <div class="director-generate-tab">
        <div class="generate-layout">
          <div class="generate-console">
            <div class="generate-title-row">
              <h4>${selectedClip?.id || 'No Clip'}</h4>
              <div class="generate-actions">
                <button class="dir-btn accent" id="generateThis">⚡ Generate ${selectedClip?.id || ''}</button>
                <span class="divider">|</span>
                <button class="dir-btn" id="queueTick">☐</button>
                <span class="queued-count">Queued · ${this.clips.filter(c => c.queued).length}</span>
              </div>
            </div>
            <div class="generate-viewer">
              <div class="viewer-16x9" id="generateViewer">
                <span class="viewer-placeholder">16:9 Preview</span>
              </div>
            </div>
            <div class="generate-takes" id="generateTakes">
              <div class="takes-group">
                <h5>Full Multishot</h5>
                <div class="take-chips" id="fullTakes"></div>
              </div>
              ${selectedClip?.shots?.map((s, i) => `
                <div class="takes-group">
                  <h5>S${i + 1} · ${s.size || 'MS'} · ${s.duration || 5}s</h5>
                  <div class="take-chips" id="shotTakes${i}"></div>
                </div>
              `).join('') || ''}
            </div>
            <div class="generate-shot-ruler" id="shotRuler"></div>
          </div>
          <div class="generate-prompt-stack">
            <div class="prompt-stack-section open">
              <h5>Director's Notes</h5>
              <textarea class="dir-textarea" placeholder="Notes for this clip..."></textarea>
            </div>
            <div class="prompt-stack-section">
              <h5>Prompt</h5>
              <div class="prompt-block">${this._compileCINEDANCE(selectedClip)}</div>
            </div>
            <div class="prompt-stack-section">
              <h5>Edit Body</h5>
              <textarea class="dir-textarea tall" readonly>${this._compileCINEDANCE(selectedClip)}</textarea>
            </div>
            <div class="prompt-stack-section">
              <h5>Camera</h5>
              <div class="prompt-block">${selectedClip?.camera || 'No camera specified'}</div>
            </div>
            <div class="prompt-stack-section">
              <h5>Shots</h5>
              <div class="prompt-block">${selectedClip?.shots?.map((s, i) => `S${i + 1}: ${s.size} - ${s.action}`).join('\n') || 'No shots defined'}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._wireGenerateEvents(container);
  }

  // === CINEDANCE COMPILATION (1.6) ===
  _compileCINEDANCE(clip) {
    if (!clip) return 'No clip selected';

    const blocks = [];

    // SCENE CONTEXT
    const scene = this.scenes.find(s => s.id === clip.sceneId);
    if (scene) {
      blocks.push(`SCENE CONTEXT\n${scene.event || scene.heading || 'Scene ' + scene.id}`);
      if (scene.physicalAction) {
        blocks.push(`\nPHYSICAL ACTION\n${scene.physicalAction}`);
      }
    }

    // ACTIVE REFERENCES
    const refs = this._getActiveReferences(clip);
    if (refs.length) {
      blocks.push(`\nACTIVE REFERENCES\n${refs.map(r => `@${r.tag}: ${r.description || '100% matches the reference'}`).join('\n')}`);
    }

    // LOCATION MAP
    if (clip.locationMap) {
      blocks.push(`\nLOCATION MAP\n${clip.locationMap}`);
    }

    // FORMAT MODE
    blocks.push(`\nFORMAT MODE\n${clip.formatMode || 'ONE CONTINUOUS UNBROKEN TAKE — a cut is a failed take'}`);

    // SEGMENTS
    if (clip.shots?.length) {
      clip.shots.forEach((shot, i) => {
        blocks.push(`\nSEGMENT ${i + 1} — ${shot.size || 'MS'}\nLENS: ${this._getLensLabel(shot.lens)}\nACTION TASK: ${shot.action || 'Character performs action'}`);
        if (shot.dialogue) {
          blocks.push(`DIALOGUE\n${shot.dialogue}`);
        }
      });
    }

    // DIALOGUE
    if (clip.dialogue) {
      blocks.push(`\nDIALOGUE\n${clip.dialogue}`);
    }

    // AUDIO (1.19 Dialogue discipline)
    if (clip.dialogue) {
      blocks.push(`\nAUDIO LOCK\nOnly scripted lines spoken. Lips still when silent. Listeners say nothing. Ambient ducks under dialogue.`);
    }

    // STYLE
    if (this.lookBible.notes) {
      blocks.push(`\nSTYLE\n${this.lookBible.notes}`);
    }

    // POSITIVE LOCS
    if (clip.positiveLocks) {
      blocks.push(`\nPOSITIVE LOCKS\n${clip.positiveLocks}`);
    }

    return blocks.join('\n');
  }

  _getActiveReferences(clip) {
    const refs = [];
    const allElements = [...this.elements.characters, ...this.elements.locations];
    (clip.elementIds || []).forEach(id => {
      const el = allElements.find(e => e.id === id);
      if (el) refs.push(el);
    });
    return refs;
  }

  _getLensLabel(fov) {
    const lens = LENS_PRESETS.find(l => l.fov === fov);
    return lens ? `${lens.label} (${lens.fov}°)` : 'Standard (47°)';
  }

  // === ACTIONS ===
  async _runBreakdown() {
    const input = this.container.querySelector('#scriptInput');
    if (!input?.value) {
      this._updateStatus('Please enter a script first');
      return;
    }
    this.script = input.value;
    this._updateStatus('Running LLM breakdown...');

    // Parse scenes from script (regex for structure)
    this.scenes = this._parseScenes(this.script);

    try {
      // Use LLM to extract detailed elements
      const prompt = `Analyze this screenplay and extract all production elements. Return JSON only:

{
  "characters": [{"name": "...", "description": "...", "age": "...", "gender": "..."}],
  "locations": [{"name": "...", "interior_exterior": "...", "time_of_day": "...", "description": "..."}],
  "props": [{"name": "...", "description": "...", "quantity": 1}],
  "vehicles": [{"name": "...", "description": "..."}],
  "costumes": [{"character": "...", "description": "..."}],
  "sfx": [{"description": "...", "type": "practical|vfx|sound"}]
}

Screenplay:
${this.script.substring(0, 8000)}`;

      const result = await cineGenAPI.callLLM(prompt, { maxOutputTokens: 4000 });

      if (result.text) {
        try {
          // Parse JSON from response
          const jsonMatch = result.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            this.elements = {
              characters: data.characters?.map((c, i) => ({
                id: `char-${i}`,
                name: c.name || 'Unknown',
                tag: (c.name || 'unknown').toLowerCase().replace(/\s+/g, '-'),
                description: c.description || c.age || '',
                refImage: ''
              })) || [],
              locations: data.locations?.map((l, i) => ({
                id: `loc-${i}`,
                name: l.name || 'Unknown',
                tag: (l.name || 'unknown').toLowerCase().replace(/\s+/g, '-'),
                description: l.description || '',
                refImage: ''
              })) || [],
              props: data.props?.map((p, i) => ({
                id: `prop-${i}`,
                name: p.name || 'Unknown',
                tag: (p.name || 'unknown').toLowerCase().replace(/\s+/g, '-'),
                description: p.description || '',
                refImage: ''
              })) || [],
              vehicles: data.vehicles?.map((v, i) => ({
                id: `veh-${i}`,
                name: v.name || 'Unknown',
                tag: (v.name || 'unknown').toLowerCase().replace(/\s+/g, '-'),
                description: v.description || '',
                refImage: ''
              })) || []
            };
          }
        } catch (parseErr) {
          // Fallback to regex extraction
          this.elements = this._extractElements(this.script);
        }
      }
    } catch (error) {
      // Fallback to regex extraction on API error
      console.warn('LLM breakdown failed, using regex fallback:', error.message);
      this.elements = this._extractElements(this.script);
      this._updateStatus(`Breakdown complete (regex fallback): ${this.scenes.length} scenes, ${this.elements.characters.length} characters`);
    }

    this._updateStatus(`Found ${this.scenes.length} scenes, ${this.elements.characters.length} characters, ${this.elements.locations.length} locations`);
    this._renderTab('breakdown');
  }

  _parseScenes(script) {
    const scenes = [];
    const scenePattern = /(?:SCENE\s+(\d+)|EXT\.|INT\.)(.+?)(?=(?:SCENE\s+\d+|EXT\.|INT\.)|$)/gis;
    let match;
    let idx = 0;
    while ((match = scenePattern.exec(script)) !== null) {
      scenes.push({
        id: `scene-${idx + 1}`,
        number: match[1] || String(idx + 1),
        heading: match[0].trim().split('\n')[0],
        body: match[0].trim(),
        event: '',
        physicalAction: ''
      });
      idx++;
    }
    if (scenes.length === 0 && script.trim()) {
      scenes.push({ id: 'scene-1', number: '1', heading: 'Full Script', body: script.trim(), event: '', physicalAction: '' });
    }
    return scenes;
  }

  _extractElements(script) {
    const elements = { characters: [], locations: [], props: [], vehicles: [] };

    // Extract characters (ALL CAPS names followed by parenthetical)
    const charPattern = /^([A-Z][A-Z\s]+)(?:\s*\((.+?)\))?$/gm;
    const foundChars = new Set();
    let match;
    while ((match = charPattern.exec(script)) !== null) {
      const name = match[1].trim();
      if (name.length > 1 && name.length < 30 && !['SCENE', 'EXT', 'INT', 'FADE', 'CUT', 'DISSOLVE'].includes(name) && !foundChars.has(name)) {
        foundChars.add(name);
        elements.characters.push({
          id: `char-${name.toLowerCase().replace(/\s+/g, '-')}`,
          name,
          tag: name.toLowerCase().replace(/\s+/g, ''),
          description: match[2] || '',
          refImage: ''
        });
      }
    }

    // Extract locations (INT./EXT. lines)
    const locPattern = /(?:INT\.|EXT\.)\s*(.+?)(?:\s*-\s*(.+?))?$/gm;
    const foundLocs = new Set();
    while ((match = locPattern.exec(script)) !== null) {
      const loc = match[1].trim();
      if (!foundLocs.has(loc)) {
        foundLocs.add(loc);
        elements.locations.push({
          id: `loc-${loc.toLowerCase().replace(/\s+/g, '-')}`,
          name: loc,
          tag: loc.toLowerCase().replace(/\s+/g, ''),
          description: match[2] || '',
          refImage: ''
        });
      }
    }

    return elements;
  }

  _compileShotlist() {
    if (this.scenes.length === 0) {
      this._updateStatus('Run breakdown first');
      return;
    }

    // 1.25 Save snapshot for reset
    this._saveShotlistSnapshot();

    this.clips = [];
    this.scenes.forEach((scene, sceneIdx) => {
      const clipCount = Math.max(1, Math.ceil((scene.body.length || 200) / 200));
      for (let i = 0; i < clipCount; i++) {
        const clipId = `${String.fromCharCode(65 + sceneIdx)}${String(i + 1).padStart(2, '0')}`;
        this.clips.push({
          id: clipId,
          sceneId: scene.id,
          title: `${scene.heading} — Shot ${i + 1}`,
          duration: this.setup.clipLength,
          shots: [
            { size: 'MS', lens: 47, action: 'Character performs main action', dialogue: '' }
          ],
          formatMode: 'ONE CONTINUOUS UNBROKEN TAKE',
          queued: false,
          cameraLife: 0,
          elementIds: []
        });
      }
    });

    this._updateStatus(`Compiled ${this.clips.length} clips from ${this.scenes.length} scenes`);
    this._renderTab('shotlist');
  }

  _perSceneShotlist() {
    this._compileShotlist();
  }

  async _rewriteLookBible() {
    const genre = this.lookBible.genre || 'cinematic';
    const refs = this.lookBible.filmRefs.length ? this.lookBible.filmRefs.join(', ') : '';
    const existing = this.lookBible.notes || '';

    this._updateStatus('Generating look notes with LLM...');

    try {
      const prompt = `You are a cinematographer writing look notes for a ${genre} film. ${refs ? `Visual references: ${refs}.` : ''}

${existing ? `Current notes to refine:\n${existing}` : ''}

Write 2-3 paragraphs describing:
1. Color palette and grading approach
2. Lighting style and motivation
3. Lens choices and depth of field
4. Camera movement philosophy

Be specific and actionable for a DP. Use cinematic terminology.`;

      const result = await cineGenAPI.callLLM(prompt, { maxOutputTokens: 1000 });

      if (result.text) {
        this.lookBible.notes = result.text;
        const notesEl = this.container.querySelector('#lookNotes');
        if (notesEl) notesEl.value = result.text;
        this._updateStatus('Look notes generated by LLM');
      }
    } catch (error) {
      // Fallback to template
      const refsText = refs ? ` influenced by ${refs}` : '';
      this.lookBible.notes = `${genre} palette with controlled contrast. Warm highlights, cool shadows. Naturalistic lighting with motivated sources. Shallow depth of field for intimate coverage, deep focus for establishing. Camera movement is deliberate — dolly and tracking only, no handheld unless scene demands it.${refsText}`;
      const notesEl = this.container.querySelector('#lookNotes');
      if (notesEl) notesEl.value = this.lookBible.notes;
      this._updateStatus('Look notes generated (template fallback)');
    }
  }

  _updateNotesFromRefs() {
    if (this.lookBible.filmRefs.length === 0) return;
    const refText = `Visual references: ${this.lookBible.filmRefs.join(', ')}. Match palette, lighting quality, and camera language.`;
    const notesEl = this.container.querySelector('#lookNotes');
    if (notesEl) {
      notesEl.value = notesEl.value ? `${notesEl.value}\n\n${refText}` : refText;
      this.lookBible.notes = notesEl.value;
    }
  }

  _wireGenerateEvents(container) {
    container.querySelector('#generateThis')?.addEventListener('click', () => {
      this._updateStatus('Generating... (requires AI backend)');
    });

    container.querySelectorAll('.prompt-stack-section h5').forEach(h5 => {
      h5.addEventListener('click', () => {
        h5.parentElement.classList.toggle('open');
      });
    });
  }

  _showCopiedFeedback() {
    this._updateStatus('Copied to clipboard');
    setTimeout(() => this._updateStatus(''), 2000);
  }

  // === 1.13 Blocking Maps ===
  _renderBlockingMap(sceneId) {
    const scene = this.scenes.find(s => s.id === sceneId);
    if (!scene) return '';
    const map = this.blockingMaps[sceneId];
    if (!map) return '<p class="empty-state">No blocking map for this scene. Create one from a set frame.</p>';

    return `
      <div class="blocking-map">
        <div class="blocking-map-canvas">
          <svg viewBox="0 0 400 300" class="blocking-svg">
            <rect x="0" y="0" width="400" height="300" fill="#1a1a2e" />
            ${map.actors?.map((actor, i) => {
              const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
              const color = colors[i % colors.length];
              return `
                <circle cx="${actor.x}" cy="${actor.y}" r="12" fill="${color}" opacity="0.8" />
                <text x="${actor.x}" y="${actor.y + 4}" text-anchor="middle" fill="white" font-size="10">${actor.name}</text>
                ${actor.moveTo ? `<line x1="${actor.x}" y1="${actor.y}" x2="${actor.moveTo.x}" y2="${actor.moveTo.y}" stroke="${color}" stroke-width="2" stroke-dasharray="4" /><circle cx="${actor.moveTo.x}" cy="${actor.moveTo.y}" r="8" fill="none" stroke="${color}" stroke-width="2" />` : ''}
              `;
            }).join('') || ''}
          </svg>
        </div>
        <div class="blocking-map-legend">
          ${map.actors?.map((actor, i) => {
            const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
            return `<span class="legend-item"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span>${actor.name}</span>`;
          }).join('') || ''}
        </div>
      </div>
    `;
  }

  _createBlockingMap(sceneId) {
    const scene = this.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Extract characters from scene body
    const chars = this.elements.characters.filter(c =>
      scene.body.toUpperCase().includes(c.name.toUpperCase())
    );

    // Generate positions in a semi-circle (theater-style blocking)
    const actors = chars.slice(0, 6).map((char, i) => {
      const angle = (Math.PI / (chars.length + 1)) * (i + 1);
      const x = 200 + Math.cos(angle) * 120;
      const y = 200 + Math.sin(angle) * 80;
      return {
        name: char.name,
        x: Math.round(x),
        y: Math.round(y),
        moveTo: null
      };
    });

    this.blockingMaps[sceneId] = {
      actors,
      createdAt: Date.now()
    };

    this._updateStatus(`Blocking map created for ${scene.heading}`);
    this._renderTab('shotlist');
  }

  // === 1.18 Acting Tasks ===
  _renderActingTasks(sceneId) {
    const scene = this.scenes.find(s => s.id === sceneId);
    if (!scene) return '';

    const chars = this.elements.characters.filter(c =>
      scene.body.toUpperCase().includes(c.name.toUpperCase())
    );

    if (chars.length === 0) return '<p class="empty-state">No characters found in this scene.</p>';

    return `
      <div class="acting-tasks">
        ${chars.map(char => {
          const key = `${sceneId}-${char.id}`;
          const tasks = this.actingTasks[key] || {};
          return `
            <div class="acting-task-card">
              <h5>${char.name}</h5>
                <div class="acting-field">
                  <label>Scene Direction</label>
                  <input type="text" class="dir-input" data-field="direction" data-char="${char.id}" value="${tasks.direction || ''}" placeholder="What is ${char.name} doing..." />
                </div>
                <div class="acting-fields-grid">
                  <div class="acting-field">
                    <label>Motive</label>
                    <input type="text" class="dir-input small" data-field="motive" data-char="${char.id}" value="${tasks.motive || ''}" placeholder="Why..." />
                  </div>
                  <div class="acting-field">
                    <label>Goal</label>
                    <input type="text" class="dir-input small" data-field="goal" data-char="${char.id}" value="${tasks.goal || ''}" placeholder="What they want..." />
                  </div>
                  <div class="acting-field">
                    <label>Obstacle</label>
                    <input type="text" class="dir-input small" data-field="obstacle" data-char="${char.id}" value="${tasks.obstacle || ''}" placeholder="What blocks them..." />
                  </div>
                  <div class="acting-field">
                    <label>Tactic</label>
                    <input type="text" class="dir-input small" data-field="tactic" data-char="${char.id}" value="${tasks.tactic || ''}" placeholder="How they pursue it..." />
                  </div>
                </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _saveActingTasks(sceneId) {
    const inputs = this.container.querySelectorAll(`[data-char]`);
    inputs.forEach(input => {
      const charId = input.dataset.char;
      const field = input.dataset.field;
      const key = `${sceneId}-${charId}`;
      if (!this.actingTasks[key]) this.actingTasks[key] = {};
      this.actingTasks[key][field] = input.value;
    });
    this._updateStatus('Acting tasks saved');
  }

  // === 1.25 Reset to Original ===
  _saveShotlistSnapshot() {
    if (!this._originalShotlistSnapshot) {
      this._originalClips = JSON.parse(JSON.stringify(this.clips));
      this._originalShotlistSnapshot = {
        clips: JSON.parse(JSON.stringify(this.clips)),
        timestamp: Date.now()
      };
    }
  }

  _resetToOriginal() {
    if (!this._originalClips) {
      this._updateStatus('No original snapshot to reset to');
      return;
    }
    this.clips = JSON.parse(JSON.stringify(this._originalClips));
    this._updateStatus('Reset to original shotlist');
    this._renderTab('shotlist');
  }

  _updateStatus(msg) {
    const el = this.container?.querySelector('#scriptStatus');
    if (el) el.textContent = msg;
    if (this.callbacks.onStatus) this.callbacks.onStatus(msg);
  }

  destroy() {
    // Cleanup
  }
}

export default DirectorTab;
