// Contact Importer Modal - Vanilla JS version
export default class ContactImporterModal {
  constructor(options = {}) {
    this.onClose = options.onClose || (() => {});
    this.onContactsImported = options.onContactsImported || (() => {});
    this.container = null;
    this.overlay = null;
    this.step = 1; // 1: Upload, 2: Preview
    this.contacts = [];
    this.file = null;
  }

  // Show the modal
  show() {
    this.render();
    document.body.appendChild(this.overlay);
    document.body.style.overflow = 'hidden';
  }

  // Hide the modal
  hide() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
      document.body.style.overflow = '';
    }
    this.onClose();
  }

  // Render the modal
  render() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Create modal container
    this.container = document.createElement('div');
    this.container.className = 'modal-container contact-importer-modal';

    if (this.step === 1) {
      this.renderUploadStep();
    } else if (this.step === 2) {
      this.renderPreviewStep();
    }

    this.overlay.appendChild(this.container);
  }

  // Render upload step
  renderUploadStep() {
    this.container.innerHTML = `
      <div class="modal-header">
        <h2>Import Contacts</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').modal.hide()">&times;</button>
      </div>

      <div class="modal-body">
        <div class="upload-area">
          <div class="upload-icon">📁</div>
          <h3>Upload CSV File</h3>
          <p>Drag and drop your CSV file here, or click to browse</p>
          <input type="file" id="contact-file" accept=".csv" style="display: none;">
          <button class="btn btn-primary" onclick="document.getElementById('contact-file').click()">Browse Files</button>
          <p class="upload-info">Supported format: CSV with headers</p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').modal.hide()">Cancel</button>
      </div>
    `;

    // Add event listeners
    const fileInput = this.container.querySelector('#contact-file');
    fileInput.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files[0]);
    });

    // Store reference for close button
    this.overlay.modal = this;
  }

  // Render preview step
  renderPreviewStep() {
    const previewContacts = this.contacts.slice(0, 5);

    this.container.innerHTML = `
      <div class="modal-header">
        <h2>Import Contacts - Preview</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').modal.hide()">&times;</button>
      </div>

      <div class="modal-body">
        <div class="import-summary">
          <p>Found ${this.contacts.length} contacts in your CSV file.</p>
          <p>Preview of first 5 contacts:</p>
        </div>

        <div class="contacts-preview">
          <div class="contact-header">
            ${Object.keys(this.contacts[0] || {}).map(key => `<span>${key}</span>`).join('')}
          </div>
          ${previewContacts.map(contact => `
            <div class="contact-row">
              ${Object.values(contact).map(value => `<span>${value}</span>`).join('')}
            </div>
          `).join('')}
        </div>

        ${this.contacts.length > 5 ? `<p class="more-contacts">...and ${this.contacts.length - 5} more contacts</p>` : ''}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').modal.goBack()">Back</button>
        <button class="btn btn-primary" onclick="this.closest('.modal-overlay').modal.importContacts()">Import Contacts</button>
      </div>
    `;

    // Store reference for buttons
    this.overlay.modal = this;
  }

  // Handle file selection
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

      this.contacts = parsedContacts;
      this.step = 2;
      this.render();
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Error parsing CSV file. Please check the format.');
    }
  }

  // Parse CSV text
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

  // Go back to upload step
  goBack() {
    this.step = 1;
    this.contacts = [];
    this.file = null;
    this.render();
  }

  // Import the contacts
  importContacts() {
    if (this.contacts.length === 0) {
      alert('No contacts to import.');
      return;
    }

    this.onContactsImported(this.contacts);
    this.hide();
  }
}