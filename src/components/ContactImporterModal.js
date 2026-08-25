// Contact Importer Modal - Vanilla JS version
export default class ContactImporterModal {
  constructor(options = {}) {
    this.onClose = options.onClose || (() => {});
    this.onContactsImported = options.onContactsImported || (() => {});
    this.onConfirm = options.onConfirm || (() => {});
    this.container = null;
    this.overlay = null;
    this.step = 1;
    this.contacts = [];
    this.file = null;
    this.importSource = null;
    this.csvHeaders = [];
    this.csvData = [];
    this.selectedMapping = {};
    this.previewContacts = [];
    this.isImporting = false;
    this.importProgress = 0;
    this.tags = [];
    this.newTag = '';
  }

  show() {
    this.render();
    document.body.appendChild(this.overlay);
    document.body.style.overflow = 'hidden';
  }

  hide() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
      document.body.style.overflow = '';
    }
    this.onClose();
  }

  render() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    this.container = document.createElement('div');
    this.container.className = 'modal-container contact-importer-modal';

    if (this.step === 1) {
      this.renderSourceStep();
    } else if (this.step === 2) {
      this.renderMappingStep();
    } else if (this.step === 3) {
      this.renderReviewStep();
    } else if (this.step === 4) {
      this.renderImportingStep();
    }

    this.overlay.appendChild(this.container);
  }

  renderSourceStep() {
    this.container.innerHTML = `
      <div class="modal-header">
        <h2>Import Contacts</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').modal.hide()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="importer-container">
          <div class="importer-progress">
            <div class="progress-step active completed">
              <span class="step-number">1</span>
              <span class="step-label">Source</span>
            </div>
            <div class="progress-line"></div>
            <div class="progress-step">
              <span class="step-number">2</span>
              <span class="step-label">Map Fields</span>
            </div>
            <div class="progress-line"></div>
            <div class="progress-step">
              <span class="step-number">3</span>
              <span class="step-label">Review</span>
            </div>
          </div>
          <div class="importer-content">
            <div class="source-selection">
              <h3 class="step-title">Choose Import Source</h3>
              <p class="step-description">Select where you want to import contacts from</p>
              <div class="source-options">
                <button class="source-card ${this.importSource === 'csv' ? 'selected' : ''}" data-source="csv" onclick="this.closest('.modal-overlay').modal.selectSource('csv')">
                  <div class="source-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <h4>CSV File</h4>
                  <p>Import from a CSV or TXT file</p>
                </button>
                <button class="source-card ${this.importSource === 'google' ? 'selected' : ''}" data-source="google" onclick="this.closest('.modal-overlay').modal.selectSource('google')">
                  <div class="source-icon google">
                    <svg width="32" height="32" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  </div>
                  <h4>Google Contacts</h4>
                  <p>Import from Google account</p>
                </button>
                <button class="source-card ${this.importSource === 'outlook' ? 'selected' : ''}" data-source="outlook" onclick="this.closest('.modal-overlay').modal.selectSource('outlook')">
                  <div class="source-icon outlook">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#0078D4"><path d="M1 9.75V17h8v-7H1v-3.25zm10.5-3.5c0-.28.22-.5.5-.5h2.25c.28 0 .5.22.5.5v5.25c0 .28-.22.5-.5.5H12v3.5H6.5V7.5h5zm0 4.75H12v3.5h-.5V12zm-5 3v-1.75c0-.28.22-.5.5-.5H12V17H6.5z"/></svg>
                  </div>
                  <h4>Outlook</h4>
                  <p>Import from Microsoft Outlook</p>
                </button>
              </div>
              ${this.importSource === 'csv' ? `
                <div class="csv-upload">
                  <div class="upload-zone">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p>Drag & drop your CSV file here or</p>
                    <button class="modal-btn modal-btn-primary browse-btn" onclick="document.getElementById('contact-file').click()">Browse Files</button>
                    <input type="file" id="contact-file" accept=".csv,.txt" style="display:none" onchange="this.closest('.modal-overlay').modal.handleFileSelect(event.target.files[0])" />
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary modal-cancel" onclick="this.closest('.modal-overlay').modal.hide()">Cancel</button>
          <button class="modal-btn modal-btn-primary next-btn" ${!this.importSource ? 'disabled' : ''} onclick="this.closest('.modal-overlay').modal.nextStep()">Continue</button>
        </div>
      </div>
    `;
    this.overlay.modal = this;
  }

  renderMappingStep() {
    this.container.innerHTML = `
      <div class="modal-header">
        <h2>Import Contacts - Map Fields</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').modal.hide()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="importer-container">
          <div class="importer-progress">
            <div class="progress-step active completed">
              <span class="step-number">1</span>
              <span class="step-label">Source</span>
            </div>
            <div class="progress-line active"></div>
            <div class="progress-step active">
              <span class="step-number">2</span>
              <span class="step-label">Map Fields</span>
            </div>
            <div class="progress-line"></div>
            <div class="progress-step">
              <span class="step-number">3</span>
              <span class="step-label">Review</span>
            </div>
          </div>
          <div class="importer-content">
            <div class="mapping-step">
              <h3 class="step-title">Map Fields</h3>
              <p class="step-description">Match your file fields to contact properties</p>
              <div class="field-mapping">
                ${['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Tags'].map((field) => `
                  <div class="mapping-row">
                    <div class="csv-field">
                      <span class="field-label">${field}</span>
                      ${['First Name', 'Last Name', 'Email'].includes(field) ? '<span class="required-badge">Required</span>' : ''}
                    </div>
                    <div class="mapping-arrow">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </div>
                    <div class="contact-field">
                      <select class="field-select" data-csv="${field}" onchange="this.closest('.modal-overlay').modal.updateMapping(this)">
                        <option value="">Select field...</option>
                        <option value="firstName">First Name</option>
                        <option value="lastName">Last Name</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="company">Company</option>
                      </select>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="tag-section">
                <h4>Add Tags</h4>
                <div class="tags-input">
                  <div class="current-tags">
                    ${this.tags.map(tag => `<span class="tag">${tag}<button class="tag-remove" data-tag="${tag}" onclick="this.closest('.modal-overlay').modal.removeTag('${tag}')">&times;</button></span>`).join('')}
                  </div>
                  <input type="text" class="tag-input-field" placeholder="Add a tag..." value="${this.newTag}" onchange="this.closest('.modal-overlay').modal.addTag(this.value)" onkeydown="if(event.key==='Enter'){this.closest('.modal-overlay').modal.addTag(this.value);event.preventDefault();}" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary back-btn" onclick="this.closest('.modal-overlay').modal.prevStep()">Back</button>
          <button class="modal-btn modal-btn-primary next-btn" onclick="this.closest('.modal-overlay').modal.nextStep()">Continue</button>
        </div>
      </div>
    `;
    this.overlay.modal = this;
  }

  renderReviewStep() {
    this.container.innerHTML = `
      <div class="modal-header">
        <h2>Import Contacts - Review</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').modal.hide()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="importer-container">
          <div class="importer-progress">
            <div class="progress-step active completed">
              <span class="step-number">1</span>
              <span class="step-label">Source</span>
            </div>
            <div class="progress-line active"></div>
            <div class="progress-step active completed">
              <span class="step-number">2</span>
              <span class="step-label">Map Fields</span>
            </div>
            <div class="progress-line active"></div>
            <div class="progress-step active">
              <span class="step-number">3</span>
              <span class="step-label">Review</span>
            </div>
          </div>
          <div class="importer-content">
            <div class="review-step">
              <h3 class="step-title">Review Import</h3>
              <p class="step-description">Review your contacts before importing</p>
              <div class="import-summary">
                <div class="summary-stat">
                  <span class="stat-value">${this.previewContacts.length}</span>
                  <span class="stat-label">Contacts</span>
                </div>
                <div class="summary-stat">
                  <span class="stat-value">${this.tags.length}</span>
                  <span class="stat-label">Tags</span>
                </div>
                <div class="summary-stat">
                  <span class="stat-value">${this.importSource}</span>
                  <span class="stat-label">Source</span>
                </div>
              </div>
              <div class="contacts-preview">
                <div class="preview-header">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Company</span>
                </div>
                ${this.previewContacts.map(contact => `
                  <div class="preview-row">
                    <span>${contact.firstName || ''} ${contact.lastName || ''}</span>
                    <span>${contact.email || ''}</span>
                    <span>${contact.company || ''}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary back-btn" onclick="this.closest('.modal-overlay').modal.prevStep()">Back</button>
          <button class="modal-btn modal-btn-primary import-btn" onclick="this.closest('.modal-overlay').modal.startImport()">Import ${this.previewContacts.length} Contacts</button>
        </div>
      </div>
    `;
    this.overlay.modal = this;
  }

  renderImportingStep() {
    this.container.innerHTML = `
      <div class="modal-header">
        <h2>Import Contacts</h2>
      </div>
      <div class="modal-body">
        <div class="importing-step">
          <div class="import-progress">
            <div class="progress-circle">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"/>
                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#progressGradient)" stroke-width="8"
                        stroke-dasharray="${2 * Math.PI * 45}"
                        stroke-dashoffset="${2 * Math.PI * 45 * (1 - this.importProgress / 100)}"
                        transform="rotate(-90 50 50)"/>
                <defs>
                  <linearGradient id="progressGradient">
                    <stop offset="0%" stop-color="#22d3ee"/>
                    <stop offset="100%" stop-color="#34d399"/>
                  </linearGradient>
                </defs>
              </svg>
              <span class="progress-text">${Math.round(this.importProgress)}%</span>
            </div>
            <h3>Importing Contacts...</h3>
            <p>Please wait while we import your contacts</p>
          </div>
        </div>
      </div>
    `;
    this.overlay.modal = this;
  }

  selectSource(source) {
    this.importSource = source;
    if (source === 'google' || source === 'outlook') {
      this.previewContacts = [
        { firstName: 'John', lastName: 'Smith', email: 'john.smith@example.com', phone: '+1 555-0101', company: 'Acme Corp' },
        { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@example.com', phone: '+1 555-0102', company: 'Tech Solutions' },
        { firstName: 'Michael', lastName: 'Williams', email: 'm.williams@example.com', phone: '+1 555-0103', company: 'Global Inc' }
      ];
    }
    this.render();
  }

  nextStep() {
    if (this.step === 1) {
      if (!this.importSource) return;
      if (this.importSource === 'csv' && !this.file) {
        alert('Please select a CSV file first.');
        return;
      }
    }
    this.step++;
    this.render();
  }

  prevStep() {
    this.step--;
    this.render();
  }

  updateMapping(select) {
    this.selectedMapping[select.dataset.csv] = select.value;
  }

  addTag(tag) {
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
      this.newTag = '';
      this.render();
    }
  }

  removeTag(tag) {
    this.tags = this.tags.filter(t => t !== tag);
    this.render();
  }

  startImport() {
    this.step = 4;
    this.isImporting = true;
    this.importProgress = 0;
    this.render();

    const interval = setInterval(() => {
      this.importProgress += 5;
      if (this.importProgress >= 100) {
        clearInterval(interval);
        this.isImporting = false;
        this.onConfirm({
          action: 'importComplete',
          contacts: this.previewContacts,
          tags: this.tags,
          source: this.importSource
        });
        this.onContactsImported(this.previewContacts);
        this.hide();
      } else {
        this.render();
      }
    }, 100);
  }

  async handleFileSelect(file) {
    if (!file) return;
    this.file = file;
    try {
      const text = await file.text();
      const parsedContacts = this.parseCSV(text);
      if (parsedContacts.length === 0) {
        alert('No valid contacts found in the CSV file.');
        return;
      }
      this.previewContacts = parsedContacts.slice(0, 5);
      this.csvData = parsedContacts;
      this.step = 2;
      this.render();
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Error parsing CSV file. Please check the format.');
    }
  }

  parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const contact = {};
      headers.forEach((header, index) => {
        contact[header] = values[index] || '';
      });
      return contact;
    });
    return rows.filter(contact => Object.values(contact).some(value => value.trim() !== ''));
  }

  goBack() {
    this.step = 1;
    this.contacts = [];
    this.file = null;
    this.render();
  }

  importContacts() {
    if (this.contacts.length === 0) {
      alert('No contacts to import.');
      return;
    }
    this.onContactsImported(this.contacts);
    this.hide();
  }
}
