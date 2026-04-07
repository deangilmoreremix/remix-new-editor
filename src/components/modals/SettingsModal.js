// SettingsModal - Modal for application and project settings

import BaseModal from './BaseModal.js';

export default class SettingsModal extends BaseModal {
  constructor(props = {}) {
    super(props);

    this.settings = props.settings || {};
    this.activeTab = 'general';
    this.tabs = {
      general: 'General',
      appearance: 'Appearance',
      audio: 'Audio',
      export: 'Export',
      account: 'Account',
      advanced: 'Advanced'
    };

    // Initialize default settings
    this.initializeDefaultSettings();
  }

  initializeDefaultSettings() {
    this.settings = {
      general: {
        autoSave: true,
        autoSaveInterval: 30,
        showWelcome: true,
        language: 'en',
        timezone: 'UTC'
      },
      appearance: {
        theme: 'light',
        fontSize: 'medium',
        showGrid: true,
        snapToGrid: true,
        gridSize: 20
      },
      audio: {
        defaultSampleRate: 44100,
        defaultBitDepth: 16,
        compressionLevel: 'medium',
        normalizeAudio: true,
        removeSilence: false
      },
      export: {
        defaultFormat: 'mp4',
        defaultResolution: '1920x1080',
        defaultFrameRate: 30,
        watermarkEnabled: false,
        watermarkText: '',
        includeSubtitles: true
      },
      account: {
        emailNotifications: true,
        usageReports: false,
        dataCollection: true,
        exportHistory: true
      },
      advanced: {
        enableExperimental: false,
        debugMode: false,
        performanceMonitoring: true,
        cacheSize: 500,
        maxUndoSteps: 50
      },
      ...this.settings
    };
  }

  getTitle() {
    return 'Settings';
  }

  renderBody() {
    return `
      <div class="settings-modal">
        <!-- Settings Tabs -->
        <div class="settings-tabs">
          ${Object.entries(this.tabs).map(([key, label]) => `
            <button class="settings-tab ${this.activeTab === key ? 'active' : ''}" data-tab="${key}">
              ${label}
            </button>
          `).join('')}
        </div>

        <!-- Settings Content -->
        <div class="settings-content">
          ${this.renderActiveTab()}
        </div>
      </div>
    `;
  }

  renderActiveTab() {
    switch (this.activeTab) {
      case 'general':
        return this.renderGeneralSettings();
      case 'appearance':
        return this.renderAppearanceSettings();
      case 'audio':
        return this.renderAudioSettings();
      case 'export':
        return this.renderExportSettings();
      case 'account':
        return this.renderAccountSettings();
      case 'advanced':
        return this.renderAdvancedSettings();
      default:
        return '<div class="settings-placeholder">Select a settings category</div>';
    }
  }

  renderGeneralSettings() {
    const s = this.settings.general;
    return `
      <div class="settings-section">
        <h3>General Settings</h3>

        <div class="setting-group">
          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.autoSave ? 'checked' : ''} data-setting="general.autoSave">
              Auto-save project
            </label>
            <p class="setting-description">Automatically save your work as you edit</p>
          </div>

          <div class="setting-item">
            <label for="auto-save-interval" class="setting-label">Auto-save interval (seconds)</label>
            <input type="number" id="auto-save-interval" class="setting-input" min="10" max="300" value="${s.autoSaveInterval}" data-setting="general.autoSaveInterval">
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.showWelcome ? 'checked' : ''} data-setting="general.showWelcome">
              Show welcome screen
            </label>
            <p class="setting-description">Display welcome screen on application start</p>
          </div>
        </div>

        <div class="setting-group">
          <h4>Localization</h4>
          <div class="setting-item">
            <label for="language" class="setting-label">Language</label>
            <select id="language" class="setting-select" data-setting="general.language">
              <option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option>
              <option value="es" ${s.language === 'es' ? 'selected' : ''}>Spanish</option>
              <option value="fr" ${s.language === 'fr' ? 'selected' : ''}>French</option>
              <option value="de" ${s.language === 'de' ? 'selected' : ''}>German</option>
            </select>
          </div>

          <div class="setting-item">
            <label for="timezone" class="setting-label">Timezone</label>
            <select id="timezone" class="setting-select" data-setting="general.timezone">
              <option value="UTC" ${s.timezone === 'UTC' ? 'selected' : ''}>UTC</option>
              <option value="America/New_York" ${s.timezone === 'America/New_York' ? 'selected' : ''}>Eastern Time</option>
              <option value="America/Chicago" ${s.timezone === 'America/Chicago' ? 'selected' : ''}>Central Time</option>
              <option value="America/Denver" ${s.timezone === 'America/Denver' ? 'selected' : ''}>Mountain Time</option>
              <option value="America/Los_Angeles" ${s.timezone === 'America/Los_Angeles' ? 'selected' : ''}>Pacific Time</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  renderAppearanceSettings() {
    const s = this.settings.appearance;
    return `
      <div class="settings-section">
        <h3>Appearance Settings</h3>

        <div class="setting-group">
          <div class="setting-item">
            <label for="theme" class="setting-label">Theme</label>
            <select id="theme" class="setting-select" data-setting="appearance.theme">
              <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
              <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
              <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>Auto (System)</option>
            </select>
          </div>

          <div class="setting-item">
            <label for="font-size" class="setting-label">Font Size</label>
            <select id="font-size" class="setting-select" data-setting="appearance.fontSize">
              <option value="small" ${s.fontSize === 'small' ? 'selected' : ''}>Small</option>
              <option value="medium" ${s.fontSize === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="large" ${s.fontSize === 'large' ? 'selected' : ''}>Large</option>
            </select>
          </div>
        </div>

        <div class="setting-group">
          <h4>Grid & Alignment</h4>
          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.showGrid ? 'checked' : ''} data-setting="appearance.showGrid">
              Show grid
            </label>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.snapToGrid ? 'checked' : ''} data-setting="appearance.snapToGrid">
              Snap to grid
            </label>
          </div>

          <div class="setting-item">
            <label for="grid-size" class="setting-label">Grid size (pixels)</label>
            <input type="number" id="grid-size" class="setting-input" min="5" max="100" value="${s.gridSize}" data-setting="appearance.gridSize">
          </div>
        </div>
      </div>
    `;
  }

  renderAudioSettings() {
    const s = this.settings.audio;
    return `
      <div class="settings-section">
        <h3>Audio Settings</h3>

        <div class="setting-group">
          <h4>Default Audio Properties</h4>
          <div class="setting-item">
            <label for="sample-rate" class="setting-label">Sample Rate (Hz)</label>
            <select id="sample-rate" class="setting-select" data-setting="audio.defaultSampleRate">
              <option value="22050" ${s.defaultSampleRate === 22050 ? 'selected' : ''}>22,050 Hz</option>
              <option value="44100" ${s.defaultSampleRate === 44100 ? 'selected' : ''}>44,100 Hz</option>
              <option value="48000" ${s.defaultSampleRate === 48000 ? 'selected' : ''}>48,000 Hz</option>
              <option value="96000" ${s.defaultSampleRate === 96000 ? 'selected' : ''}>96,000 Hz</option>
            </select>
          </div>

          <div class="setting-item">
            <label for="bit-depth" class="setting-label">Bit Depth</label>
            <select id="bit-depth" class="setting-select" data-setting="audio.defaultBitDepth">
              <option value="16" ${s.defaultBitDepth === 16 ? 'selected' : ''}>16-bit</option>
              <option value="24" ${s.defaultBitDepth === 24 ? 'selected' : ''}>24-bit</option>
              <option value="32" ${s.defaultBitDepth === 32 ? 'selected' : ''}>32-bit</option>
            </select>
          </div>
        </div>

        <div class="setting-group">
          <h4>Audio Processing</h4>
          <div class="setting-item">
            <label for="compression" class="setting-label">Compression Level</label>
            <select id="compression" class="setting-select" data-setting="audio.compressionLevel">
              <option value="low" ${s.compressionLevel === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${s.compressionLevel === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${s.compressionLevel === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.normalizeAudio ? 'checked' : ''} data-setting="audio.normalizeAudio">
              Normalize audio levels
            </label>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.removeSilence ? 'checked' : ''} data-setting="audio.removeSilence">
              Remove silence from recordings
            </label>
          </div>
        </div>
      </div>
    `;
  }

  renderExportSettings() {
    const s = this.settings.export;
    return `
      <div class="settings-section">
        <h3>Export Settings</h3>

        <div class="setting-group">
          <h4>Default Export Settings</h4>
          <div class="setting-item">
            <label for="export-format" class="setting-label">Format</label>
            <select id="export-format" class="setting-select" data-setting="export.defaultFormat">
              <option value="mp4" ${s.defaultFormat === 'mp4' ? 'selected' : ''}>MP4 (Recommended)</option>
              <option value="webm" ${s.defaultFormat === 'webm' ? 'selected' : ''}>WebM</option>
              <option value="mov" ${s.defaultFormat === 'mov' ? 'selected' : ''}>MOV</option>
              <option value="avi" ${s.defaultFormat === 'avi' ? 'selected' : ''}>AVI</option>
            </select>
          </div>

          <div class="setting-item">
            <label for="export-resolution" class="setting-label">Resolution</label>
            <select id="export-resolution" class="setting-select" data-setting="export.defaultResolution">
              <option value="1920x1080" ${s.defaultResolution === '1920x1080' ? 'selected' : ''}>1920x1080 (Full HD)</option>
              <option value="1280x720" ${s.defaultResolution === '1280x720' ? 'selected' : ''}>1280x720 (HD)</option>
              <option value="854x480" ${s.defaultResolution === '854x480' ? 'selected' : ''}>854x480 (SD)</option>
              <option value="3840x2160" ${s.defaultResolution === '3840x2160' ? 'selected' : ''}>3840x2160 (4K)</option>
            </select>
          </div>

          <div class="setting-item">
            <label for="frame-rate" class="setting-label">Frame Rate</label>
            <select id="frame-rate" class="setting-select" data-setting="export.defaultFrameRate">
              <option value="24" ${s.defaultFrameRate === 24 ? 'selected' : ''}>24 fps (Cinematic)</option>
              <option value="30" ${s.defaultFrameRate === 30 ? 'selected' : ''}>30 fps (Standard)</option>
              <option value="60" ${s.defaultFrameRate === 60 ? 'selected' : ''}>60 fps (Smooth)</option>
            </select>
          </div>
        </div>

        <div class="setting-group">
          <h4>Watermark & Branding</h4>
          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.watermarkEnabled ? 'checked' : ''} data-setting="export.watermarkEnabled">
              Enable watermark
            </label>
          </div>

          <div class="setting-item">
            <label for="watermark-text" class="setting-label">Watermark Text</label>
            <input type="text" id="watermark-text" class="setting-input" value="${s.watermarkText}" data-setting="export.watermarkText" placeholder="Your watermark text">
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.includeSubtitles ? 'checked' : ''} data-setting="export.includeSubtitles">
              Include subtitles/captions
            </label>
          </div>
        </div>
      </div>
    `;
  }

  renderAccountSettings() {
    const s = this.settings.account;
    return `
      <div class="settings-section">
        <h3>Account Settings</h3>

        <div class="setting-group">
          <h4>Notifications</h4>
          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.emailNotifications ? 'checked' : ''} data-setting="account.emailNotifications">
              Email notifications
            </label>
            <p class="setting-description">Receive email updates about your projects</p>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.usageReports ? 'checked' : ''} data-setting="account.usageReports">
              Usage reports
            </label>
            <p class="setting-description">Receive monthly usage and performance reports</p>
          </div>
        </div>

        <div class="setting-group">
          <h4>Data & Privacy</h4>
          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.dataCollection ? 'checked' : ''} data-setting="account.dataCollection">
              Allow analytics data collection
            </label>
            <p class="setting-description">Help improve the application by sharing anonymous usage data</p>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.exportHistory ? 'checked' : ''} data-setting="account.exportHistory">
              Keep export history
            </label>
            <p class="setting-description">Store history of your video exports for easy access</p>
          </div>
        </div>

        <div class="setting-group">
          <h4>Account Actions</h4>
          <div class="setting-item">
            <button class="btn btn-secondary" id="export-settings">Export Settings</button>
            <button class="btn btn-secondary" id="import-settings">Import Settings</button>
            <button class="btn btn-danger" id="reset-settings">Reset to Defaults</button>
          </div>
        </div>
      </div>
    `;
  }

  renderAdvancedSettings() {
    const s = this.settings.advanced;
    return `
      <div class="settings-section">
        <h3>Advanced Settings</h3>
        <div class="warning-notice">
          ⚠️ These settings are for advanced users. Changing them may affect application performance or stability.
        </div>

        <div class="setting-group">
          <h4>Experimental Features</h4>
          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.enableExperimental ? 'checked' : ''} data-setting="advanced.enableExperimental">
              Enable experimental features
            </label>
            <p class="setting-description">Try new features that are still in development</p>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.debugMode ? 'checked' : ''} data-setting="advanced.debugMode">
              Debug mode
            </label>
            <p class="setting-description">Enable detailed logging and debugging information</p>
          </div>
        </div>

        <div class="setting-group">
          <h4>Performance & Storage</h4>
          <div class="setting-item">
            <label class="setting-label">
              <input type="checkbox" ${s.performanceMonitoring ? 'checked' : ''} data-setting="advanced.performanceMonitoring">
              Performance monitoring
            </label>
            <p class="setting-description">Monitor application performance and memory usage</p>
          </div>

          <div class="setting-item">
            <label for="cache-size" class="setting-label">Cache size (MB)</label>
            <input type="number" id="cache-size" class="setting-input" min="100" max="2000" value="${s.cacheSize}" data-setting="advanced.cacheSize">
          </div>

          <div class="setting-item">
            <label for="undo-steps" class="setting-label">Max undo steps</label>
            <input type="number" id="undo-steps" class="setting-input" min="10" max="200" value="${s.maxUndoSteps}" data-setting="advanced.maxUndoSteps">
          </div>
        </div>

        <div class="setting-group">
          <h4>Developer Tools</h4>
          <div class="setting-item">
            <button class="btn btn-secondary" id="clear-cache">Clear Application Cache</button>
            <button class="btn btn-secondary" id="export-logs">Export Debug Logs</button>
          </div>
        </div>
      </div>
    `;
  }

  mounted() {
    super.mounted();
    this.setupSettingsEventListeners();
  }

  setupSettingsEventListeners() {
    // Tab switching
    const tabs = this.overlay.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
      this.addEventListener(tab, 'click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    // Setting changes
    const inputs = this.overlay.querySelectorAll('input, select');
    inputs.forEach(input => {
      this.addEventListener(input, 'change', (e) => {
        this.updateSetting(e.target);
      });
      this.addEventListener(input, 'input', (e) => {
        this.updateSetting(e.target);
      });
    });

    // Action buttons
    const actionBtns = this.overlay.querySelectorAll('#export-settings, #import-settings, #reset-settings, #clear-cache, #export-logs');
    actionBtns.forEach(btn => {
      this.addEventListener(btn, 'click', (e) => {
        this.handleAction(e.target.id);
      });
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update tab buttons
    const tabs = this.overlay.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Update content
    const content = this.overlay.querySelector('.settings-content');
    if (content) {
      content.innerHTML = this.renderActiveTab();
      this.setupSettingsEventListeners();
    }
  }

  updateSetting(element) {
    const settingPath = element.dataset.setting;
    if (!settingPath) return;

    const [category, key] = settingPath.split('.');
    let value;

    if (element.type === 'checkbox') {
      value = element.checked;
    } else if (element.type === 'number') {
      value = parseFloat(element.value);
    } else {
      value = element.value;
    }

    if (!this.settings[category]) {
      this.settings[category] = {};
    }

    this.settings[category][key] = value;

    // Emit change event
    if (this.props.onSettingChange) {
      this.props.onSettingChange(settingPath, value);
    }
  }

  handleAction(actionId) {
    switch (actionId) {
      case 'export-settings':
        this.exportSettings();
        break;
      case 'import-settings':
        this.importSettings();
        break;
      case 'reset-settings':
        this.resetSettings();
        break;
      case 'clear-cache':
        this.clearCache();
        break;
      case 'export-logs':
        this.exportLogs();
        break;
    }
  }

  exportSettings() {
    const dataStr = JSON.stringify(this.settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = 'video-editor-settings.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedSettings = JSON.parse(e.target.result);
            this.settings = { ...this.settings, ...importedSettings };
            this.updateUIFromSettings();
            alert('Settings imported successfully!');
          } catch (error) {
            alert('Error importing settings: Invalid JSON file');
          }
        };
        reader.readAsText(file);
      }
    };

    input.click();
  }

  resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      this.initializeDefaultSettings();
      this.updateUIFromSettings();
      alert('Settings reset to defaults');
    }
  }

  clearCache() {
    if (confirm('Clear application cache? This will remove temporary files and may require reloading some assets.')) {
      // Implement cache clearing
      localStorage.clear();
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
      alert('Cache cleared successfully');
    }
  }

  exportLogs() {
    // Implement log export
    const logs = [
      'Application logs would be exported here',
      'This is a placeholder for the actual log export functionality'
    ];

    const dataStr = logs.join('\n');
    const dataUri = 'data:text/plain;charset=utf-8,'+ encodeURIComponent(dataStr);

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'debug-logs.txt');
    linkElement.click();
  }

  updateUIFromSettings() {
    // Refresh the current tab to show updated settings
    const content = this.overlay.querySelector('.settings-content');
    if (content) {
      content.innerHTML = this.renderActiveTab();
      this.setupSettingsEventListeners();
    }
  }

  handleConfirm() {
    // Save settings (could persist to localStorage or send to server)
    localStorage.setItem('video-editor-settings', JSON.stringify(this.settings));

    this.onConfirm(this.settings);
    this.close();
  }

  // Public API
  getSettings() {
    return { ...this.settings };
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.updateUIFromSettings();
  }

  getSetting(category, key) {
    return this.settings[category]?.[key];
  }

  setSetting(category, key, value) {
    if (!this.settings[category]) {
      this.settings[category] = {};
    }
    this.settings[category][key] = value;
  }
}