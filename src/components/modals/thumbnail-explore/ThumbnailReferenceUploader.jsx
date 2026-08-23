/**
 * ThumbnailReferenceUploader.jsx
 *
 * Handles reference image uploads with drag-and-drop, file input,
 * preview thumbnails, and remove functionality.
 */

export class ThumbnailReferenceUploader {
  constructor(options = {}) {
    this.template = options.template || null;
    this.appColors = options.appColors || { primary: '#d9ff00', accent: '#c4e600' };
    this.references = options.references || [];
    this.onChange = options.onChange || (() => {});
    this._dragOver = false;
  }

  get primary() { return this.appColors.primary; }
  get accent() { return this.appColors.accent; }

  hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  getSoft() { return this.hexToRgba(this.primary, 0.12); }
  getSoftAccent() { return this.hexToRgba(this.accent, 0.12); }

  render() {
    if (!this.template) return '';
    const t = this.template;
    const typeLabel = t.referenceType === 'person' ? 'person photo' : t.referenceType === 'product' ? 'product image' : 'image';
    const canAddMore = this.references.length < t.maxReferences;

    return `
      <div class="thumbnail-reference-uploader" style="--app-primary:${this.primary};--app-accent:${this.accent};--app-soft:${this.getSoft()};--app-soft-accent:${this.getSoftAccent()}">
        <div class="reference-previews">
          ${this.references.map((ref, idx) => `
            <div class="reference-preview-item">
              <img src="${ref.url || ref}" alt="Reference ${idx + 1}" class="reference-preview-img" />
              <button type="button" class="reference-remove" data-action="remove-ref" data-index="${idx}" aria-label="Remove reference ${idx + 1}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
          `).join('')}
          ${canAddMore ? `
            <div class="reference-dropzone ${this._dragOver ? 'drag-over' : ''}"
                 role="button"
                 tabindex="0"
                 aria-label="Upload ${typeLabel}"
                 data-action="upload-ref">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span class="dropzone-text">Drop ${typeLabel} here</span>
              <span class="dropzone-hint">or click to browse</span>
            </div>
            <input type="file" class="reference-file-input" accept="image/*" data-action="file-input" aria-hidden="true" />
          ` : ''}
        </div>
        <p class="reference-hint">
          ${t.referenceType === 'person' ? 'Upload a clear face photo for best results.' : t.referenceType === 'product' ? 'Upload product images from different angles.' : 'Upload reference images to guide generation.'}
          ${this.references.length >= t.minReferences ? ' <span class="ref-met">Minimum met.</span>' : ` <span class="ref-required">(${t.minReferences - this.references.length} more required)</span>`}
        </p>
      </div>
    `;
  }

  attachListeners(container) {
    if (!container) return;

    container.addEventListener('click', (e) => {
      const dropzone = e.target.closest('[data-action="upload-ref"]');
      const removeBtn = e.target.closest('[data-action="remove-ref"]');

      if (removeBtn) {
        const index = parseInt(removeBtn.getAttribute('data-index'), 10);
        const newRefs = this.references.filter((_, i) => i !== index);
        this.references = newRefs;
        this.onChange(newRefs);
        this.rerender();
      }

      if (dropzone) {
        const input = container.querySelector('.reference-file-input');
        if (input) input.click();
      }
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      this._dragOver = true;
      const dropzone = container.querySelector('.reference-dropzone');
      if (dropzone) dropzone.classList.add('drag-over');
    });

    container.addEventListener('dragleave', (e) => {
      this._dragOver = false;
      const dropzone = container.querySelector('.reference-dropzone');
      if (dropzone) dropzone.classList.remove('drag-over');
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      this._dragOver = false;
      const dropzone = container.querySelector('.reference-dropzone');
      if (dropzone) dropzone.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        this.handleFiles(files);
      }
    });

    const fileInput = container.querySelector('.reference-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter((f) => f.type.startsWith('image/'));
        if (files.length) {
          this.handleFiles(files);
        }
        fileInput.value = '';
      });
    }
  }

  handleFiles(files) {
    const remaining = this.template.maxReferences - this.references.length;
    const toProcess = files.slice(0, remaining);
    toProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newRefs = [...this.references, { url: e.target.result, file }];
        this.references = newRefs.slice(0, this.template.maxReferences);
        this.onChange(this.references);
        this.rerender();
      };
      reader.readAsDataURL(file);
    });
  }

  rerender() {
    const container = document.querySelector('.thumbnail-reference-uploader');
    if (container) {
      container.outerHTML = this.render();
      const newContainer = document.querySelector('.thumbnail-reference-uploader');
      if (newContainer) this.attachListeners(newContainer);
    }
  }
}

export default ThumbnailReferenceUploader;
