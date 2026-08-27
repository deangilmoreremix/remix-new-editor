/**
 * UI/UX Features — Ported from CineGen for Timeline Studio
 *
 * Features:
 * 7.1 Project Manager (home page)
 * 7.2 Settings page (API key config)
 * 7.3 Header Assistant (right drawer chat)
 * 7.4 Export page (dedicated settings + progress)
 * 7.5 Copy "Copied" feedback
 * 7.6 Command palette (Space to open)
 * 7.7 Workflow save/load
 * 7.8 Workflow history (undo/redo for canvas)
 */

export class UIFeatures {
  constructor(state, callbacks = {}) {
    this.state = state;
    this.callbacks = callbacks;
    this.projects = this._loadProjects();
    this.settings = this._loadSettings();
    this.commandPaletteOpen = false;
    this.headerAssistantOpen = false;
    this.workflowHistory = [];
    this.workflowIndex = -1;
  }

  // === 7.1 Project Manager ===
  _loadProjects() {
    try {
      const stored = localStorage.getItem('cinegen-projects');
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return [];
  }

  _saveProjects() {
    try {
      localStorage.setItem('cinegen-projects', JSON.stringify(this.projects));
    } catch (e) { /* ignore */ }
  }

  createProject(name, description = '') {
    const project = {
      id: `project-${Date.now()}`,
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timeline: null
    };
    this.projects.push(project);
    this._saveProjects();
    return project;
  }

  deleteProject(projectId) {
    this.projects = this.projects.filter(p => p.id !== projectId);
    this._saveProjects();
  }

  getProjects() {
    return this.projects;
  }

  // === 7.2 Settings Page ===
  _loadSettings() {
    try {
      const stored = localStorage.getItem('cinegen-settings');
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return {
      apiKeys: {
        fal: '',
        kie: '',
        openai: '',
        anthropic: '',
        gemini: ''
      },
      defaultResolution: '1080p',
      defaultFrameRate: 30,
      proxyPlayback: false,
      autoSave: true
    };
  }

  _saveSettings() {
    try {
      localStorage.setItem('cinegen-settings', JSON.stringify(this.settings));
    } catch (e) { /* ignore */ }
  }

  setAPIKey(provider, key) {
    if (this.settings.apiKeys.hasOwnProperty(provider)) {
      this.settings.apiKeys[provider] = key;
      this._saveSettings();
    }
  }

  getAPIKey(provider) {
    return this.settings.apiKeys[provider] || '';
  }

  getSettings() {
    return { ...this.settings };
  }

  updateSettings(updates) {
    Object.assign(this.settings, updates);
    this._saveSettings();
  }

  // === 7.3 Header Assistant ===
  toggleHeaderAssistant() {
    this.headerAssistantOpen = !this.headerAssistantOpen;
    return this.headerAssistantOpen;
  }

  isHeaderAssistantOpen() {
    return this.headerAssistantOpen;
  }

  // === 7.4 Export Page ===
  getExportSettings() {
    return {
      resolutions: ['720p (Draft)', '1080p (Standard)', '4K (High Quality)'],
      frameRates: [24, 30, 60],
      aspectRatios: ['16:9', '4:3', '21:9', '1:1', '9:16'],
      formats: ['MP4', 'WebM', 'GIF'],
      qualities: ['Draft', 'Good', 'Better', 'Best']
    };
  }

  // === 7.5 Copy "Copied" Feedback ===
  async copyWithFeedback(text, buttonEl) {
    try {
      await navigator.clipboard.writeText(text);
      if (buttonEl) {
        const original = buttonEl.textContent;
        buttonEl.textContent = 'Copied';
        buttonEl.classList.add('copied');
        setTimeout(() => {
          buttonEl.textContent = original;
          buttonEl.classList.remove('copied');
        }, 2000);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // === 7.6 Command Palette ===
  toggleCommandPalette() {
    this.commandPaletteOpen = !this.commandPaletteOpen;
    return this.commandPaletteOpen;
  }

  isCommandPaletteOpen() {
    return this.commandPaletteOpen;
  }

  getCommandPaletteItems() {
    return [
      { id: 'new-project', label: 'New Project', icon: '📄', category: 'File' },
      { id: 'open-project', label: 'Open Project', icon: '📂', category: 'File' },
      { id: 'save-project', label: 'Save Project', icon: '💾', category: 'File' },
      { id: 'import-media', label: 'Import Media', icon: '📥', category: 'File' },
      { id: 'export-video', label: 'Export Video', icon: '🎬', category: 'Export' },
      { id: 'generate-video', label: 'Generate AI Video', icon: '🤖', category: 'AI' },
      { id: 'fill-gap', label: 'Fill Gap', icon: '🔗', category: 'AI' },
      { id: 'extend-clip', label: 'Extend Clip', icon: '➡️', category: 'AI' },
      { id: 'add-subtitles', label: 'Add Subtitles', icon: '🌐', category: 'Edit' },
      { id: 'detect-scenes', label: 'Detect Scenes', icon: '🎬', category: 'Edit' },
      { id: 'color-correct', label: 'Color Correction', icon: '🎨', category: 'Edit' },
      { id: 'audio-sync', label: 'Audio Sync', icon: '🔊', category: 'Edit' },
      { id: 'director-mode', label: 'Open Director', icon: '🎬', category: 'Workflow' },
      { id: 'storyboard', label: 'Storyboarder', icon: '🎞️', category: 'Workflow' },
      { id: 'settings', label: 'Settings', icon: '⚙️', category: 'App' }
    ];
  }

  // === 7.7 Workflow Save/Load ===
  saveWorkflow(name, data) {
    const workflows = this._loadWorkflows();
    const workflow = {
      id: `workflow-${Date.now()}`,
      name,
      data,
      createdAt: Date.now()
    };
    workflows.push(workflow);
    try {
      localStorage.setItem('cinegen-workflows', JSON.stringify(workflows));
    } catch (e) { /* ignore */ }
    return workflow;
  }

  _loadWorkflows() {
    try {
      const stored = localStorage.getItem('cinegen-workflows');
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return [];
  }

  loadWorkflow(workflowId) {
    const workflows = this._loadWorkflows();
    return workflows.find(w => w.id === workflowId) || null;
  }

  deleteWorkflow(workflowId) {
    const workflows = this._loadWorkflows().filter(w => w.id !== workflowId);
    try {
      localStorage.setItem('cinegen-workflows', JSON.stringify(workflows));
    } catch (e) { /* ignore */ }
  }

  getWorkflows() {
    return this._loadWorkflows();
  }

  // === 7.8 Workflow History ===
  pushWorkflowState(data) {
    // Remove any future states if we're not at the end
    this.workflowHistory = this.workflowHistory.slice(0, this.workflowIndex + 1);
    this.workflowHistory.push(JSON.parse(JSON.stringify(data)));

    // Limit history to 50 entries
    if (this.workflowHistory.length > 50) {
      this.workflowHistory.shift();
    }
    this.workflowIndex = this.workflowHistory.length - 1;
  }

  undoWorkflow() {
    if (this.workflowIndex > 0) {
      this.workflowIndex--;
      return this.workflowHistory[this.workflowIndex];
    }
    return null;
  }

  redoWorkflow() {
    if (this.workflowIndex < this.workflowHistory.length - 1) {
      this.workflowIndex++;
      return this.workflowHistory[this.workflowIndex];
    }
    return null;
  }

  canUndo() {
    return this.workflowIndex > 0;
  }

  canRedo() {
    return this.workflowIndex < this.workflowHistory.length - 1;
  }
}

export default UIFeatures;
