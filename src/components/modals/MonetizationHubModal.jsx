import { BaseModal } from './BaseModal.jsx';
import { searchTracks, getTrackById } from '../../lib/monetizationCurriculum.js';
import { searchTemplates, getTemplateById } from '../../lib/businessTemplates.js';

export class MonetizationHubModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: 'Smart Video AI Monetization Hub',
      size: 'full',
      showFooter: false,
      ...options
    });

    this.tab = 'tracks';
    this.trackQuery = '';
    this.trackLevel = '';
    this.templateQuery = '';
    this.templateType = '';
    this.selectedTrackId = '';
    this.selectedTemplateId = '';
  }

  _bind() {
    const root = this.container;
    if (!root) return;

    root.querySelectorAll('[data-tab]').forEach(tab => {
      tab.onclick = () => { this.tab = tab.dataset.tab; this._refresh(); };
    });

    root.querySelectorAll('[data-track-search]').forEach(el => {
      el.oninput = (e) => { this.trackQuery = e.target.value; this._refresh(); };
    });

    root.querySelectorAll('[data-track-level]').forEach(el => {
      el.onchange = (e) => { this.trackLevel = e.target.value; this._refresh(); };
    });

    root.querySelectorAll('[data-select-track]').forEach(el => {
      el.onclick = () => { this.selectedTrackId = el.dataset.selectTrack; this._refresh(); };
    });

    root.querySelectorAll('[data-template-search]').forEach(el => {
      el.oninput = (e) => { this.templateQuery = e.target.value; this._refresh(); };
    });

    root.querySelectorAll('[data-template-type]').forEach(el => {
      el.onchange = (e) => { this.templateType = e.target.value; this._refresh(); };
    });

    root.querySelectorAll('[data-select-template]').forEach(el => {
      el.onclick = () => { this.selectedTemplateId = el.dataset.selectTemplate; this._refresh(); };
    });

    root.querySelectorAll('[data-action="copy-template"]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.copyTemplate;
        const tpl = getTemplateById(id);
        if (tpl) {
          navigator.clipboard.writeText(tpl.body).then(() => {
            const label = btn.querySelector('.copy-label');
            if (label) { const prev = label.textContent; label.textContent = 'Copied'; setTimeout(() => label.textContent = prev, 1200); }
          });
        }
      };
    });

    root.querySelectorAll("[data-action=\"download-template\"]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.downloadTemplate;
        const tpl = getTemplateById(id);
        if (tpl) {
          const blob = new Blob([tpl.body], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = tpl.title.replace(/\s+/g, "_").toLowerCase() + ".txt";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      };
    });
  }

  _refresh() {
    if (this.container) {
      this.render();
      this._bind();
    }
  }

  renderBody() {
    const tracks = searchTracks({ query: this.trackQuery, level: this.trackLevel });
    const templates = searchTemplates({ query: this.templateQuery, type: this.templateType });
    const selectedTrack = getTrackById(this.selectedTrackId);
    const selectedTemplate = getTemplateById(this.selectedTemplateId);

    return `
      <div class="monetization-root">
        <div class="monetization-tabs">
          <button type="button" data-tab="tracks" class="tab ${this.tab === 'tracks' ? 'active' : ''}">Tracks</button>
          <button type="button" data-tab="templates" class="tab ${this.tab === 'templates' ? 'active' : ''}">Templates</button>
        </div>
        ${this.tab === 'tracks' ? `
          <div class="monetization-split">
            <div class="monetization-catalog">
              <div class="monetization-controls">
                <input type="search" data-track-search placeholder="Search tracks..." value="${this.trackQuery}" />
                <select data-track-level>
                  <option value="">All Levels</option>
                  <option value="Beginner" ${this.trackLevel === 'Beginner' ? 'selected' : ''}>Beginner</option>
                  <option value="Intermediate" ${this.trackLevel === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
                  <option value="Advanced" ${this.trackLevel === 'Advanced' ? 'selected' : ''}>Advanced</option>
                </select>
              </div>
              <div class="monetization-list">
                ${tracks.length ? tracks.map(t => `
                  <div class="monetization-card ${this.selectedTrackId === t.id ? 'selected' : ''}" data-select-track="${t.id}">
                    <div class="monetization-title">${t.title}</div>
                    <div class="monetization-desc">${t.description}</div>
                    <div class="monetization-meta">${t.lessons} lessons · ${t.level}</div>
                  </div>
                `).join('') : '<div class="empty-state">No tracks match.</div>'}
              </div>
            </div>
            <div class="monetization-detail">
              ${selectedTrack ? `
                <div class="detail-title">${selectedTrack.title}</div>
                <div class="detail-meta">${selectedTrack.level} · ${selectedTrack.lessons} lessons</div>
                <div class="detail-desc">${selectedTrack.description}</div>
              ` : '<div class="empty-state">Select a track to preview.</div>'}
            </div>
          </div>
        ` : `
          <div class="monetization-split">
            <div class="monetization-catalog">
              <div class="monetization-controls">
                <input type="search" data-template-search placeholder="Search templates..." value="${this.templateQuery}" />
                <select data-template-type>
                  <option value="">All Types</option>
                  <option value="pricing" ${this.templateType === 'pricing' ? 'selected' : ''}>Pricing</option>
                  <option value="outreach" ${this.templateType === 'outreach' ? 'selected' : ''}>Outreach</option>
                  <option value="contract" ${this.templateType === 'contract' ? 'selected' : ''}>Contract</option>
                  <option value="invoice" ${this.templateType === 'invoice' ? 'selected' : ''}>Invoice</option>
                  <option value="script" ${this.templateType === 'script' ? 'selected' : ''}>Script</option>
                </select>
              </div>
              <div class="monetization-list">
                ${templates.length ? templates.map(t => `
                  <div class="monetization-card ${this.selectedTemplateId === t.id ? 'selected' : ''}" data-select-template="${t.id}">
                    <div class="monetization-title">${t.title}</div>
                    <div class="monetization-meta">${t.type}</div>
                  </div>
                `).join('') : '<div class="empty-state">No templates match.</div>'}
              </div>
            </div>
            <div class="monetization-detail">
              ${selectedTemplate ? `
                <div class="detail-title">${selectedTemplate.title}</div>
                <div class="detail-meta">${selectedTemplate.type}</div>
                <pre class="template-preview">${selectedTemplate.body}</pre>
                <div class="detail-actions">
                  <button type="button" class="modal-btn modal-btn-primary" data-action="copy-template" data-copy-template="${selectedTemplate.id}"><span class="copy-label">Copy</span></button>
                  <button type="button" class="modal-btn modal-btn-secondary" data-action="download-template" data-download-template="${selectedTemplate.id}"><span class="download-label">Download</span></button>
                </div>
              ` : '<div class="empty-state">Select a template to preview.</div>'}
            </div>
          </div>
        `}
      </div>
    `;
  }
}
