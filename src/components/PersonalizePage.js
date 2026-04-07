// Personalize Page component - vanilla JS version
export default class PersonalizePage {
  constructor(options = {}) {
    this.performanceService = options.performanceService;
    this.router = options.router;
    this.mode = 'sendspark'; // 'sendspark', 'overlay', 'ai-generated', 'landing-pages'
    this.activeTab = 'contacts';
    this.contacts = [];
    this.generatedVideos = [];
  }

  render() {
    const container = document.createElement('div');
    container.className = 'personalize-page';

    container.innerHTML = `
      <div class="video-personalization-page">
        <div class="hub-sidebar">
          <div class="sidebar-header">
            <h2 class="hub-title">Video Personalizer</h2>
            <p class="hub-subtitle">Create personalized videos at scale</p>
          </div>

          <div class="sidebar-navigation">
            <button class="nav-item active" data-tab="contacts">
              <span class="nav-icon">👥</span>
              <span class="nav-label">Import Contacts</span>
            </button>

            <button class="nav-item" data-tab="sendspark-workflow">
              <span class="nav-icon">⚡</span>
              <span class="nav-label">Sendspark Workflow</span>
            </button>

            <button class="nav-item" data-tab="landing-builder">
              <span class="nav-icon">🌐</span>
              <span class="nav-label">Landing Page Builder</span>
            </button>
          </div>
        </div>

        <div class="hub-main">
          <div class="tab-content">
            <div class="contacts-section" id="contacts-tab">
              <div class="section-header">
                <h2 class="section-title">Contact Management</h2>
                <p class="section-subtitle">Import and manage contacts for personalized video generation</p>
              </div>

              <div class="contacts-content">
                <div class="upload-area">
                  <div class="upload-icon">📁</div>
                  <h3>Upload Contacts CSV</h3>
                  <p>Drag and drop your CSV file here, or click to browse</p>
                  <input type="file" id="contacts-file" accept=".csv" style="display: none;">
                  <button class="btn-upload" onclick="document.getElementById('contacts-file').click()">Browse Files</button>
                </div>

                <div class="contacts-list" id="contacts-list">
                  <p class="empty-state">No contacts imported yet. Upload a CSV file to get started.</p>
                </div>
              </div>
            </div>

            <div class="workflow-section" id="sendspark-workflow-tab" style="display: none;">
              <div class="section-header">
                <h2 class="section-title">Sendspark Workflow</h2>
                <p class="section-subtitle">Complete AI-powered video creation workflow</p>
              </div>

              <div class="workflow-content">
                <div class="workflow-step">
                  <h3>1. Script Creation</h3>
                  <textarea placeholder="Enter your video script here..." rows="4"></textarea>
                </div>

                <div class="workflow-step">
                  <h3>2. AI Avatar Selection</h3>
                  <div class="avatar-grid">
                    <div class="avatar-option selected">👨‍💼 Professional</div>
                    <div class="avatar-option">👩‍💻 Tech Expert</div>
                    <div class="avatar-option">🎭 Presenter</div>
                  </div>
                </div>

                <div class="workflow-step">
                  <h3>3. Generate Videos</h3>
                  <button class="btn-generate">Generate Personalized Videos</button>
                  <div class="progress-indicator" id="generation-progress" style="display: none;">
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span>Generating videos...</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="landing-builder-section" id="landing-builder-tab" style="display: none;">
              <div class="section-header">
                <h2 class="section-title">Landing Page Builder</h2>
                <p class="section-subtitle">Create shareable landing pages for your videos</p>
              </div>

              <div class="landing-builder-content">
                <p>Landing page builder coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    return container;
  }

  afterRender() {
    this.addEventListeners();
  }

  addEventListeners() {
    // Tab navigation
    const navItems = this.container.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // File upload
    const fileInput = this.container.querySelector('#contacts-file');
    fileInput.addEventListener('change', (e) => {
      this.handleFileUpload(e.target.files[0]);
    });

    // Generate videos button
    const generateBtn = this.container.querySelector('.btn-generate');
    generateBtn.addEventListener('click', () => {
      this.generateVideos();
    });
  }

  switchTab(tabId) {
    // Update active tab in navigation
    const navItems = this.container.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.tab === tabId) {
        item.classList.add('active');
      }
    });

    // Show/hide tab content
    const tabs = this.container.querySelectorAll('[id$="-tab"]');
    tabs.forEach(tab => {
      tab.style.display = tab.id === `${tabId}-tab` ? 'block' : 'none';
    });

    this.activeTab = tabId;
  }

  async handleFileUpload(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const contacts = this.parseCSV(text);

      this.contacts = contacts;
      this.updateContactsList();

      // Track analytics
      if (window.analyticsService) {
        window.analyticsService.trackEvent('contacts_imported', { count: contacts.length });
      }

      alert(`Successfully imported ${contacts.length} contacts!`);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Error parsing CSV file. Please check the format.');
    }
  }

  parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
      const values = line.split(',');
      const contact = {};
      headers.forEach((header, index) => {
        contact[header] = values[index]?.trim() || '';
      });
      return contact;
    });
  }

  updateContactsList() {
    const contactsList = this.container.querySelector('#contacts-list');

    if (this.contacts.length === 0) {
      contactsList.innerHTML = '<p class="empty-state">No contacts imported yet. Upload a CSV file to get started.</p>';
      return;
    }

    const contactsHTML = `
      <div class="contacts-summary">
        <h4>${this.contacts.length} Contacts Imported</h4>
        <div class="contacts-preview">
          ${this.contacts.slice(0, 5).map(contact => `
            <div class="contact-item">
              <span>${contact.firstName || 'N/A'} ${contact.lastName || ''}</span>
              <span>${contact.email || 'N/A'}</span>
            </div>
          `).join('')}
          ${this.contacts.length > 5 ? `<p>...and ${this.contacts.length - 5} more</p>` : ''}
        </div>
      </div>
    `;

    contactsList.innerHTML = contactsHTML;
  }

  async generateVideos() {
    if (this.contacts.length === 0) {
      alert('Please import contacts first!');
      return;
    }

    const progressIndicator = this.container.querySelector('#generation-progress');
    const progressFill = progressIndicator.querySelector('.progress-fill');
    const generateBtn = this.container.querySelector('.btn-generate');

    // Show progress
    progressIndicator.style.display = 'block';
    generateBtn.disabled = true;

    // Simulate video generation
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 100) progress = 100;

      progressFill.style.width = `${progress}%`;

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          this.onGenerationComplete();
        }, 500);
      }
    }, 500);

    // Track analytics
    if (window.analyticsService) {
      window.analyticsService.trackEvent('videos_generated', {
        count: this.contacts.length,
        mode: this.mode
      });
    }
  }

  onGenerationComplete() {
    const progressIndicator = this.container.querySelector('#generation-progress');
    const generateBtn = this.container.querySelector('.btn-generate');

    progressIndicator.style.display = 'none';
    generateBtn.disabled = false;

    alert(`Successfully generated ${this.contacts.length} personalized videos!`);

    // Switch to results view or show download options
    this.showGenerationResults();
  }

  showGenerationResults() {
    // This would show download links, preview videos, etc.
    console.log('Video generation completed');
  }

  destroy() {
    // Clean up event listeners if needed
  }
}