import { BaseModal } from './BaseModal.jsx';
import { apiKeyManager } from '../../lib/apiKeyManager.js';

// Reuse the same validation logic as the vanilla setup modal so the
// React settings tab rejects the same bad shapes (too short, whitespace,
// duplicated token) instead of silently failing inside apiKeyManager.
import { validateApiKeyFormat } from '../SettingsModal.js';

const TABS = ['General', 'API', 'Audio', 'Video', 'Keyboard', 'Export'];

const KEYBOARD_SHORTCUTS = {
  'Playback': [
    { action: 'Play/Pause', keys: ['Space'] },
    { action: 'Skip Forward', keys: ['→'] },
    { action: 'Skip Backward', keys: ['←'] },
    { action: 'Jump to Start', keys: ['Home'] },
    { action: 'Jump to End', keys: ['End'] }
  ],
  'Editing': [
    { action: 'Undo', keys: ['Ctrl', 'Z'] },
    { action: 'Redo', keys: ['Ctrl', 'Y'] },
    { action: 'Cut', keys: ['Ctrl', 'X'] },
    { action: 'Copy', keys: ['Ctrl', 'C'] },
    { action: 'Paste', keys: ['Ctrl', 'V'] },
    { action: 'Delete', keys: ['Delete'] },
    { action: 'Duplicate', keys: ['Ctrl', 'D'] }
  ],
  'Timeline': [
    { action: 'Zoom In', keys: ['+', '='] },
    { action: 'Zoom Out', keys: ['-'] },
    { action: 'Split Clip', keys: ['S'] },
    { action: 'Add Track', keys: ['Ctrl', 'T'] }
  ],
  'Export': [
    { action: 'Export', keys: ['Ctrl', 'E'] },
    { action: 'Quick Export', keys: ['Ctrl', 'Shift', 'E'] }
  ]
};

const VIDEO_RESOLUTIONS = [
  { id: '4k', label: '4K (3840×2160)', aspect: '16:9' },
  { id: '1080p', label: 'Full HD (1920×1080)', aspect: '16:9' },
  { id: '720p', label: 'HD (1280×720)', aspect: '16:9' },
  { id: '480p', label: 'SD (854×480)', aspect: '16:9' },
  { id: '9:16', label: 'Vertical (1080×1920)', aspect: '9:16' },
  { id: '1:1', label: 'Square (1080×1080)', aspect: '1:1' }
];

const AUDIO_SAMPLE_RATES = ['44.1 kHz', '48 kHz', '96 kHz'];

export class SettingsModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Settings',
      size: 'large',
      showFooter: false,
      ...options
    });

    this.activeTab = 'General';
    this.generalSettings = {
      theme: 'dark',
      language: 'en',
      autoSave: true,
      autoSaveInterval: 5,
      showTooltips: true,
      showWaveform: true
    };
    this.audioSettings = {
      inputDevice: 'default',
      outputDevice: 'default',
      sampleRate: '48 kHz',
      normalizeAudio: true,
      noiseReduction: false,
      echoCancellation: true
    };
    this.videoSettings = {
      gpuAcceleration: true,
      hardwareDecoding: true,
      previewQuality: 'high',
      renderQuality: 'high',
      defaultResolution: '1080p'
    };
    this.exportSettings = {
      format: 'mp4',
      codec: 'h264',
      quality: 'high',
      audioBitrate: '320 kbps',
      videoBitrate: '10 Mbps'
    };
    this.apiSettings = {
      muapiKey: apiKeyManager.getMuapiKey() || '',
      openAIKey: apiKeyManager.getOpenAIKey() || '',
      videoDBKey: apiKeyManager.getVideoDBKey() || '',
    };
  }

  renderBody() {
    return `
      <div class="settings-container">
        <div class="settings-sidebar">
          <nav class="settings-nav">
            ${TABS.map(tab => `
              <button class="nav-item ${this.activeTab === tab ? 'active' : ''}" data-tab="${tab}" data-tooltip="${tab} settings">
                ${this.getTabIcon(tab)}
                <span>${tab}</span>
              </button>
            `).join('')}
          </nav>
        </div>

        <div class="settings-content">
          <div class="settings-panel" data-panel="General" style="display: ${this.activeTab === 'General' ? 'block' : 'none'}">
            <div class="settings-section">
              <h3>Appearance</h3>
              <div class="setting-row">
                <label class="setting-label">Theme</label>
                <div class="theme-options">
                  <button class="theme-btn ${this.generalSettings.theme === 'dark' ? 'active' : ''}" data-theme="dark" data-tooltip="Use dark theme">
                    <span class="theme-preview dark"></span>
                    <span>Dark</span>
                  </button>
                  <button class="theme-btn ${this.generalSettings.theme === 'light' ? 'active' : ''}" data-theme="light" data-tooltip="Use light theme">
                    <span class="theme-preview light"></span>
                    <span>Light</span>
                  </button>
                  <button class="theme-btn ${this.generalSettings.theme === 'system' ? 'active' : ''}" data-theme="system" data-tooltip="Match system theme">
                    <span class="theme-preview system"></span>
                    <span>System</span>
                  </button>
                </div>
              </div>
              <div class="setting-row">
                <label class="setting-label">Language</label>
                <select class="setting-select" data-tooltip="Select your preferred language">
                  <option value="en" selected>English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>
            </div>

            <div class="settings-section">
              <h3>Editor</h3>
              <div class="setting-row">
                <label class="setting-label">Auto-Save</label>
                <label class="toggle-switch">
                  <input type="checkbox" ${this.generalSettings.autoSave ? 'checked' : ''} data-tooltip="Automatically save your project" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              ${this.generalSettings.autoSave ? `
                <div class="setting-row sub-setting">
                  <label class="setting-label">Auto-Save Interval</label>
                  <select class="setting-select compact" data-tooltip="How often to auto-save">
                    <option value="1" ${this.generalSettings.autoSaveInterval === 1 ? 'selected' : ''}>1 minute</option>
                    <option value="3" ${this.generalSettings.autoSaveInterval === 3 ? 'selected' : ''}>3 minutes</option>
                    <option value="5" ${this.generalSettings.autoSaveInterval === 5 ? 'selected' : ''}>5 minutes</option>
                    <option value="10" ${this.generalSettings.autoSaveInterval === 10 ? 'selected' : ''}>10 minutes</option>
                  </select>
                </div>
              ` : ''}
              <div class="setting-row">
                <label class="setting-label">Show Tooltips</label>
                <label class="toggle-switch">
                  <input type="checkbox" ${this.generalSettings.showTooltips ? 'checked' : ''} data-tooltip="Show helpful tooltips on hover" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <label class="setting-label">Show Waveform</label>
                <label class="toggle-switch">
                  <input type="checkbox" ${this.generalSettings.showWaveform ? 'checked' : ''} data-tooltip="Display audio waveform in timeline" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div class="settings-panel" data-panel="API" style="display: ${this.activeTab === 'API' ? 'block' : 'none'}">
            <div class="settings-section">
              <h3>OpenAI</h3>
              <div class="setting-row">
                <label class="setting-label">Muapi API Key</label>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <input type="password" id="settings-muapi-key" class="setting-select" placeholder="sk-... (Muapi key)" value="${this.escapeHtml(this.apiSettings.muapiKey || '')}" style="padding-right:80px;" />
                  <span id="settings-muapi-error" style="font-size:12px; color:var(--color-danger); display:none;"></span>
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span id="settings-muapi-status" style="font-size:12px; color: ${apiKeyManager.hasMuapiKey() ? 'var(--color-success)' : 'var(--text-muted)'};">${apiKeyManager.hasMuapiKey() ? '✓ Key saved' : 'No key set'}</span>
                    <div style="display:flex; gap:8px;">
                      <button type="button" class="text-btn" id="settings-muapi-clear" data-tooltip="Remove your saved Muapi key" ${!apiKeyManager.hasMuapiKey() ? 'disabled' : ''}>Clear</button>
                      <button type="button" class="modal-btn modal-btn-primary" id="settings-muapi-save">Save Key</button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="setting-row">
                <label class="setting-label">OpenAI API Key</label>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <input type="password" id="settings-openai-key" class="setting-select" placeholder="sk-..." value="${this.escapeHtml(this.apiSettings.openAIKey || '')}" style="padding-right:80px;" />
                  <span id="settings-openai-error" style="font-size:12px; color:var(--color-danger); display:none;"></span>
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span id="settings-openai-status" style="font-size:12px; color: ${apiKeyManager.hasOpenAIKey() ? 'var(--color-success)' : 'var(--text-muted)'};">${apiKeyManager.hasOpenAIKey() ? '✓ Key saved' : 'No key set'}</span>
                    <div style="display:flex; gap:8px;">
                      <button type="button" class="text-btn" id="settings-openai-clear" data-tooltip="Remove your saved OpenAI key" ${!apiKeyManager.hasOpenAIKey() ? 'disabled' : ''}>Clear</button>
                      <button type="button" class="modal-btn modal-btn-primary" id="settings-openai-save">Save Key</button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="setting-row">
                <label class="setting-label">VideoDB API Key</label>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <input type="password" id="settings-videodb-key" class="setting-select" placeholder="VideoDB access token" value="${this.escapeHtml(this.apiSettings.videoDBKey || '')}" style="padding-right:80px;" />
                  <span id="settings-videodb-error" style="font-size:12px; color:var(--color-danger); display:none;"></span>
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span id="settings-videodb-status" style="font-size:12px; color: ${apiKeyManager.hasVideoDBKey() ? 'var(--color-success)' : 'var(--text-muted)'};">${apiKeyManager.hasVideoDBKey() ? '✓ Key saved' : 'No key set'}</span>
                    <div style="display:flex; gap:8px;">
                      <button type="button" class="text-btn" id="settings-videodb-clear" data-tooltip="Remove your saved VideoDB key" ${!apiKeyManager.hasVideoDBKey() ? 'disabled' : ''}>Clear</button>
                      <button type="button" class="modal-btn modal-btn-primary" id="settings-videodb-save">Save Key</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="setting-row" style="margin-top:8px;">
                <label class="setting-label">Usage</label>
                <p style="margin:0; font-size:12px; color:var(--text-secondary); line-height:1.5;">
                  Your OpenAI key is stored locally in this browser and forwarded securely to the thumbnail studio.
                  If no key is set, the server’s shared OpenAI key is used as a fallback.
                </p>
              </div>
            </div>
          </div>

          <div class="settings-panel" data-panel="Audio" style="display: ${this.activeTab === 'Audio' ? 'block' : 'none'}">
            <div class="settings-section">
              <h3>Audio Devices</h3>
              <div class="setting-row">
                <label class="setting-label">Input Device</label>
                <select class="setting-select" data-tooltip="Select audio input device">
                  <option value="default" selected>System Default</option>
                  <option value="builtin">Built-in Microphone</option>
                  <option value="usb">External USB Microphone</option>
                </select>
              </div>
              <div class="setting-row">
                <label class="setting-label">Output Device</label>
                <select class="setting-select" data-tooltip="Select audio output device">
                  <option value="default" selected>System Default</option>
                  <option value="speakers">Built-in Speakers</option>
                  <option value="headphones">Headphones</option>
                </select>
              </div>
              <div class="setting-row">
                <label class="setting-label">Sample Rate</label>
                <select class="setting-select" data-tooltip="Select audio sample rate">
                  ${AUDIO_SAMPLE_RATES.map(rate => `
                    <option value="${rate}" ${this.audioSettings.sampleRate === rate ? 'selected' : ''}>${rate}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="settings-section">
              <h3>Audio Processing</h3>
              <div class="setting-row">
                <label class="setting-label">Normalize Audio</label>
                <label class="toggle-switch">
                  <input type="checkbox" ${this.audioSettings.normalizeAudio ? 'checked' : ''} data-tooltip="Normalize audio levels automatically" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <label class="setting-label">Noise Reduction</label>
                <label class="toggle-switch">
                  <input type="checkbox" ${this.audioSettings.noiseReduction ? 'checked' : ''} data-tooltip="Reduce background noise" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <label class="setting-label">Echo Cancellation</label>
                <label class="toggle-switch">
                  <input type="checkbox" ${this.audioSettings.echoCancellation ? 'checked' : ''} data-tooltip="Cancel audio echo" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div class="settings-panel" data-panel="Video" style="display: ${this.activeTab === 'Video' ? 'block' : 'none'}">
            <div class="settings-section">
              <h3>Performance</h3>
              <div class="setting-row">
                <label class="setting-label">GPU Acceleration</label>
                <label class="toggle-switch">
                  <input type="checkbox" ${this.videoSettings.gpuAcceleration ? 'checked' : ''} data-tooltip="Enable GPU hardware acceleration" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="setting-row">
                <label class="setting-label">Hardware Decoding</label>
                <label class="toggle-switch">
                  <input type="checkbox" ${this.videoSettings.hardwareDecoding ? 'checked' : ''} data-tooltip="Use hardware video decoding" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div class="settings-section">
              <h3>Quality</h3>
              <div class="setting-row">
                <label class="setting-label">Preview Quality</label>
                <select class="setting-select" data-tooltip="Set preview playback quality">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high" selected>High</option>
                </select>
              </div>
              <div class="setting-row">
                <label class="setting-label">Render Quality</label>
                <select class="setting-select" data-tooltip="Set final render quality">
                  <option value="standard">Standard</option>
                  <option value="high" selected>High</option>
                  <option value="maximum">Maximum</option>
                </select>
              </div>
              <div class="setting-row">
                <label class="setting-label">Default Resolution</label>
                <select class="setting-select" data-tooltip="Set default project resolution">
                  ${VIDEO_RESOLUTIONS.map(res => `
                    <option value="${res.id}" ${this.videoSettings.defaultResolution === res.id ? 'selected' : ''}>${res.label}</option>
                  `).join('')}
                </select>
              </div>
            </div>
          </div>

          <div class="settings-panel" data-panel="Keyboard" style="display: ${this.activeTab === 'Keyboard' ? 'block' : 'none'}">
            <div class="settings-section">
              <div class="shortcuts-header">
                <h3>Keyboard Shortcuts</h3>
                <button class="text-btn" data-tooltip="Reset all shortcuts to default values">Reset to Defaults</button>
              </div>
              ${Object.entries(KEYBOARD_SHORTCUTS).map(([category, shortcuts]) => `
                <div class="shortcut-category">
                  <h4>${category}</h4>
                  <div class="shortcut-list">
                    ${shortcuts.map(shortcut => `
                      <div class="shortcut-row">
                        <span class="shortcut-action">${shortcut.action}</span>
                        <div class="shortcut-keys">
                          ${shortcut.keys.map(key => `<kbd class="key">${key}</kbd>`).join('')}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="settings-panel" data-panel="Export" style="display: ${this.activeTab === 'Export' ? 'block' : 'none'}">
            <div class="settings-section">
              <h3>Video Format</h3>
              <div class="format-options">
                <button class="format-btn ${this.exportSettings.format === 'mp4' ? 'active' : ''}" data-format="mp4" data-tooltip="MP4 - Most compatible format">
                  <span class="format-icon">🎬</span>
                  <span class="format-name">MP4</span>
                  <span class="format-desc">Most compatible</span>
                </button>
                <button class="format-btn ${this.exportSettings.format === 'webm' ? 'active' : ''}" data-format="webm" data-tooltip="WebM - Smaller file size">
                  <span class="format-icon">🌐</span>
                  <span class="format-name">WebM</span>
                  <span class="format-desc">Smaller size</span>
                </button>
                <button class="format-btn ${this.exportSettings.format === 'mov' ? 'active' : ''}" data-format="mov" data-tooltip="MOV - Professional quality">
                  <span class="format-icon">🍎</span>
                  <span class="format-name">MOV</span>
                  <span class="format-desc">Pro quality</span>
                </button>
              </div>
            </div>

            <div class="settings-section">
              <h3>Quality Presets</h3>
              <div class="quality-options">
                <button class="quality-btn ${this.exportSettings.quality === 'low' ? 'active' : ''}" data-quality="low" data-tooltip="Low quality - ~50 MB/min">
                  <span class="quality-label">Low</span>
                  <span class="quality-size">~50 MB/min</span>
                </button>
                <button class="quality-btn ${this.exportSettings.quality === 'medium' ? 'active' : ''}" data-quality="medium" data-tooltip="Medium quality - ~100 MB/min">
                  <span class="quality-label">Medium</span>
                  <span class="quality-size">~100 MB/min</span>
                </button>
                <button class="quality-btn ${this.exportSettings.quality === 'high' ? 'active' : ''}" data-quality="high" data-tooltip="High quality - ~200 MB/min">
                  <span class="quality-label">High</span>
                  <span class="quality-size">~200 MB/min</span>
                </button>
                <button class="quality-btn ${this.exportSettings.quality === 'max' ? 'active' : ''}" data-quality="max" data-tooltip="Maximum quality - ~500 MB/min">
                  <span class="quality-label">Maximum</span>
                  <span class="quality-size">~500 MB/min</span>
                </button>
              </div>
            </div>

            <div class="settings-section">
              <h3>Advanced</h3>
              <div class="setting-row">
                <label class="setting-label">Audio Bitrate</label>
                <select class="setting-select" data-tooltip="Select audio bitrate for export">
                  <option value="128">128 kbps</option>
                  <option value="192">192 kbps</option>
                  <option value="256">256 kbps</option>
                  <option value="320" selected>320 kbps</option>
                </select>
              </div>
              <div class="setting-row">
                <label class="setting-label">Video Bitrate</label>
                <select class="setting-select" data-tooltip="Select video bitrate for export">
                  <option value="5">5 Mbps</option>
                  <option value="10" selected>10 Mbps</option>
                  <option value="20">20 Mbps</option>
                  <option value="50">50 Mbps</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer settings-footer">
        <div class="footer-left">
          <button class="modal-btn modal-btn-secondary" data-action="reset" data-tooltip="Reset all settings to defaults">
            Reset All Settings
          </button>
        </div>
        <div class="footer-right">
          <button class="modal-btn modal-btn-secondary modal-cancel" data-tooltip="Cancel and close">Cancel</button>
          <button class="modal-btn modal-btn-primary" data-action="save" data-tooltip="Save your settings">
            Save Settings
          </button>
        </div>
      </div>
    `;
  }

  getTabIcon(tab) {
    const icons = {
      'General': '⚙',
      'API': '🔑',
      'Audio': '🔊',
      'Video': '🎥',
      'Keyboard': '⌨',
      'Export': '📤'
    };
    return `<span class="tab-icon">${icons[tab]}</span>`;
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  setupEventListeners() {
    super.setupEventListeners();

    this.overlay.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        this.activeTab = item.dataset.tab;
        if (this.activeTab === 'API') {
          this._syncApiFieldsFromManager();
        }
        this.updateBody(this.renderBody());
        this.setupEventListeners();
      });
    });

    this.overlay.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.generalSettings.theme = btn.dataset.theme;
        this.updateBody(this.renderBody());
        this.setupEventListeners();
      });
    });

    this.overlay.querySelectorAll('.toggle-switch input').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const section = e.target.closest('.settings-panel');
        if (section) {
          const label = e.target.closest('.setting-row')?.querySelector('.setting-label')?.textContent;
          if (label) {
            if (label.includes('Auto-Save')) this.generalSettings.autoSave = e.target.checked;
            else if (label.includes('Tooltip')) this.generalSettings.showTooltips = e.target.checked;
            else if (label.includes('Waveform')) this.generalSettings.showWaveform = e.target.checked;
            else if (label.includes('GPU')) this.videoSettings.gpuAcceleration = e.target.checked;
            else if (label.includes('Hardware')) this.videoSettings.hardwareDecoding = e.target.checked;
            else if (label.includes('Normalize')) this.audioSettings.normalizeAudio = e.target.checked;
            else if (label.includes('Noise')) this.audioSettings.noiseReduction = e.target.checked;
            else if (label.includes('Echo')) this.audioSettings.echoCancellation = e.target.checked;
          }
        }
      });
    });

    this.overlay.querySelector('#settings-muapi-save')?.addEventListener('click', () => {
      this._persistMuapiKey();
    });
    this.overlay.querySelector('#settings-muapi-clear')?.addEventListener('click', () => {
      this.apiSettings.muapiKey = '';
      apiKeyManager.clearMuapiKey();
      this._syncMuapiKeyField();
    });
    this.overlay.querySelector('#settings-muapi-key')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._persistMuapiKey();
      }
    });

    this.overlay.querySelector('#settings-openai-save')?.addEventListener('click', () => {
      this._persistOpenAIKey();
    });
    this.overlay.querySelector('#settings-openai-clear')?.addEventListener('click', () => {
      this.apiSettings.openAIKey = '';
      apiKeyManager.clearOpenAIKey();
      this._syncOpenAIKeyField();
    });
    this.overlay.querySelector('#settings-openai-key')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._persistOpenAIKey();
      }
    });

    this.overlay.querySelector('#settings-videodb-save')?.addEventListener('click', () => {
      this._persistVideoDBKey();
    });
    this.overlay.querySelector('#settings-videodb-clear')?.addEventListener('click', () => {
      this.apiSettings.videoDBKey = '';
      apiKeyManager.clearVideoDBKey();
      this._syncVideoDBKeyField();
    });
    this.overlay.querySelector('#settings-videodb-key')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._persistVideoDBKey();
      }
    });

    this.overlay.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.exportSettings.format = btn.dataset.format;
        this.updateBody(this.renderBody());
        this.setupEventListeners();
      });
    });

    this.overlay.querySelectorAll('.quality-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.exportSettings.quality = btn.dataset.quality;
        this.updateBody(this.renderBody());
        this.setupEventListeners();
      });
    });

    this.overlay.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      this.generalSettings = { theme: 'dark', language: 'en', autoSave: true, autoSaveInterval: 5, showTooltips: true, showWaveform: true };
      this.audioSettings = { inputDevice: 'default', outputDevice: 'default', sampleRate: '48 kHz', normalizeAudio: true, noiseReduction: false, echoCancellation: true };
      this.videoSettings = { gpuAcceleration: true, hardwareDecoding: true, previewQuality: 'high', renderQuality: 'high', defaultResolution: '1080p' };
      this.exportSettings = { format: 'mp4', codec: 'h264', quality: 'high', audioBitrate: '320 kbps', videoBitrate: '10 Mbps' };
      this.apiSettings = { muapiKey: '', openAIKey: '', videoDBKey: '' };
      this._syncMuapiKeyField();
      this._syncOpenAIKeyField();
      this._syncVideoDBKeyField();
      this.updateBody(this.renderBody());
      this.setupEventListeners();
    });

    this.overlay.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
      await Promise.all([
        this._persistMuapiKey(),
        this._persistOpenAIKey(),
        this._persistVideoDBKey(),
      ]);
      this.onConfirm({
        action: 'settingsSaved',
        general: this.generalSettings,
        audio: this.audioSettings,
        video: this.videoSettings,
        export: this.exportSettings,
        api: this.apiSettings
      });
      this.close();
    });
  }

  _syncApiFieldsFromManager() {
    // Refresh local state from the single source of truth so values saved
    // in the vanilla onboarding modal are reflected here too.
    this.apiSettings.muapiKey = apiKeyManager.getMuapiKey() || '';
    this.apiSettings.openAIKey = apiKeyManager.getOpenAIKey() || '';
    this.apiSettings.videoDBKey = apiKeyManager.getVideoDBKey() || '';
  }

  _syncOpenAIKeyField() {
    const input = this.overlay?.querySelector('#settings-openai-key');
    const status = this.overlay?.querySelector('#settings-openai-status');
    const clearBtn = this.overlay?.querySelector('#settings-openai-clear');
    const errorEl = this.overlay?.querySelector('#settings-openai-error');
    if (input) input.value = this.apiSettings.openAIKey || '';
    if (status) {
      const hasKey = apiKeyManager.hasOpenAIKey();
      status.textContent = hasKey ? '✓ Key saved' : 'No key set';
      status.style.color = hasKey ? 'var(--color-success)' : 'var(--text-muted)';
    }
    if (clearBtn) clearBtn.disabled = !apiKeyManager.hasOpenAIKey();
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
  }

  _syncMuapiKeyField() {
    const input = this.overlay?.querySelector('#settings-muapi-key');
    const status = this.overlay?.querySelector('#settings-muapi-status');
    const clearBtn = this.overlay?.querySelector('#settings-muapi-clear');
    const errorEl = this.overlay?.querySelector('#settings-muapi-error');
    if (input) input.value = this.apiSettings.muapiKey || '';
    if (status) {
      const hasKey = apiKeyManager.hasMuapiKey();
      status.textContent = hasKey ? '✓ Key saved' : 'No key set';
      status.style.color = hasKey ? 'var(--color-success)' : 'var(--text-muted)';
    }
    if (clearBtn) clearBtn.disabled = !apiKeyManager.hasMuapiKey();
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
  }

  _syncVideoDBKeyField() {
    const input = this.overlay?.querySelector('#settings-videodb-key');
    const status = this.overlay?.querySelector('#settings-videodb-status');
    const clearBtn = this.overlay?.querySelector('#settings-videodb-clear');
    const errorEl = this.overlay?.querySelector('#settings-videodb-error');
    if (input) input.value = this.apiSettings.videoDBKey || '';
    if (status) {
      const hasKey = apiKeyManager.hasVideoDBKey();
      status.textContent = hasKey ? '✓ Key saved' : 'No key set';
      status.style.color = hasKey ? 'var(--color-success)' : 'var(--text-muted)';
    }
    if (clearBtn) clearBtn.disabled = !apiKeyManager.hasVideoDBKey();
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
  }

  async _persistOpenAIKey() {
    const input = this.overlay?.querySelector('#settings-openai-key');
    const value = input?.value?.trim() || '';
    const errorEl = this.overlay?.querySelector('#settings-openai-error');

    // Validate format before hitting storage — matches the vanilla setup modal.
    const fmtErr = validateApiKeyFormat(value, 'OpenAI API Key');
    if (fmtErr) {
      if (errorEl) {
        errorEl.textContent = fmtErr;
        errorEl.style.display = 'block';
      }
      return;
    }

    try {
      if (value) {
        await apiKeyManager.setOpenAIKey(value, true);
      } else {
        apiKeyManager.clearOpenAIKey();
      }
      this.apiSettings.openAIKey = value;
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Failed to save key: ' + (err.message || 'Unknown error');
        errorEl.style.display = 'block';
      }
      console.error('[SettingsModal] Failed to save OpenAI key:', err);
    }
    this._syncOpenAIKeyField();
  }

  async _persistMuapiKey() {
    const input = this.overlay?.querySelector('#settings-muapi-key');
    const value = input?.value?.trim() || '';
    const errorEl = this.overlay?.querySelector('#settings-muapi-error');

    const fmtErr = validateApiKeyFormat(value, 'Muapi API Key');
    if (fmtErr) {
      if (errorEl) {
        errorEl.textContent = fmtErr;
        errorEl.style.display = 'block';
      }
      return;
    }

    try {
      if (value) {
        await apiKeyManager.setMuapiKey(value, true);
      } else {
        apiKeyManager.clearMuapiKey();
      }
      this.apiSettings.muapiKey = value;
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Failed to save key: ' + (err.message || 'Unknown error');
        errorEl.style.display = 'block';
      }
      console.error('[SettingsModal] Failed to save Muapi key:', err);
    }
    this._syncMuapiKeyField();
  }

  async _persistVideoDBKey() {
    const input = this.overlay?.querySelector('#settings-videodb-key');
    const value = input?.value?.trim() || '';
    const errorEl = this.overlay?.querySelector('#settings-videodb-error');

    const fmtErr = validateApiKeyFormat(value, 'VideoDB API Key');
    if (fmtErr) {
      if (errorEl) {
        errorEl.textContent = fmtErr;
        errorEl.style.display = 'block';
      }
      return;
    }

    try {
      if (value) {
        await apiKeyManager.setVideoDBKey(value, true);
      } else {
        apiKeyManager.clearVideoDBKey();
      }
      this.apiSettings.videoDBKey = value;
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Failed to save key: ' + (err.message || 'Unknown error');
        errorEl.style.display = 'block';
      }
      console.error('[SettingsModal] Failed to save VideoDB key:', err);
    }
    this._syncVideoDBKeyField();
  }
}

export default SettingsModal;
