/**
 * LeadGeneratorModal.jsx
 * Lead generation modal for capturing and managing leads from video content
 * Following Timeline Design System with consistent styling
 */

import { BaseModal } from './BaseModal.jsx';
import { supabase } from '../../lib/supabase.js';
import { submitLead } from '../../lib/editor/addons/leadClient.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Input id -> lead property. (The old handler derived the key from the id
// and wrote "Firstname" / "Jobtitle", so those fields were never saved.)
const FIELD_MAP = {
  'first-name': 'firstName',
  'last-name': 'lastName',
  email: 'email',
  phone: 'phone',
  company: 'company',
  'job-title': 'jobTitle',
};

export class LeadGeneratorModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: '📋 Lead Generator',
      size: 'large',
      showFooter: true,
      footerContent: `
        <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
        <button class="modal-btn modal-btn-primary" data-action="save">Save Lead</button>
      `,
      ...options
    });

    this.lead = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      jobTitle: '',
      source: 'video',
      notes: '',
      tags: []
    };
    this.status = { text: '', kind: '' };
    this.availableTags = ['Hot Lead', 'Cold Lead', 'Follow Up', 'Qualified', 'Demo Scheduled', 'Customer'];
  }

  renderBody() {
    return `
      <div class="lead-generator">
        <div class="lead-form-section">
          <h4>Contact Information</h4>
          <div class="form-grid">
            <div class="form-group">
              <label for="first-name">First Name</label>
              <input type="text" id="first-name" class="text-input" placeholder="John" value="${esc(this.lead.firstName)}">
            </div>
            <div class="form-group">
              <label for="last-name">Last Name</label>
              <input type="text" id="last-name" class="text-input" placeholder="Smith" value="${esc(this.lead.lastName)}">
            </div>
            <div class="form-group full-width">
              <label for="email">Email *</label>
              <input type="email" id="email" class="text-input" placeholder="john@company.com" value="${esc(this.lead.email)}" required>
            </div>
            <div class="form-group">
              <label for="phone">Phone</label>
              <input type="tel" id="phone" class="text-input" placeholder="+1 555-1234" value="${esc(this.lead.phone)}">
            </div>
            <div class="form-group">
              <label for="company">Company</label>
              <input type="text" id="company" class="text-input" placeholder="Acme Corp" value="${esc(this.lead.company)}">
            </div>
            <div class="form-group full-width">
              <label for="job-title">Job Title</label>
              <input type="text" id="job-title" class="text-input" placeholder="Marketing Manager" value="${esc(this.lead.jobTitle)}">
            </div>
          </div>
        </div>

        <div class="lead-source-section">
          <h4>Lead Source</h4>
          <div class="source-options">
            <label class="source-option ${this.lead.source === 'video' ? 'selected' : ''}">
              <input type="radio" name="source" value="video" ${this.lead.source === 'video' ? 'checked' : ''}>
              <span class="source-icon">🎬</span>
              <span>Video</span>
            </label>
            <label class="source-option ${this.lead.source === 'landing_page' ? 'selected' : ''}">
              <input type="radio" name="source" value="landing_page" ${this.lead.source === 'landing_page' ? 'checked' : ''}>
              <span class="source-icon">🏠</span>
              <span>Landing Page</span>
            </label>
            <label class="source-option ${this.lead.source === 'email' ? 'selected' : ''}">
              <input type="radio" name="source" value="email" ${this.lead.source === 'email' ? 'checked' : ''}>
              <span class="source-icon">📧</span>
              <span>Email Campaign</span>
            </label>
            <label class="source-option ${this.lead.source === 'social' ? 'selected' : ''}">
              <input type="radio" name="source" value="social" ${this.lead.source === 'social' ? 'checked' : ''}>
              <span class="source-icon">📱</span>
              <span>Social Media</span>
            </label>
          </div>
        </div>

        <div class="lead-tags-section">
          <h4>Tags</h4>
          <div class="tags-container">
            ${this.availableTags.map(tag => `
              <button class="tag-btn ${this.lead.tags.includes(tag) ? 'selected' : ''}" data-tag="${tag}">
                ${tag}
              </button>
            `).join('')}
          </div>
        </div>

        <p class="lead-status lead-status--${this.status.kind || 'idle'}" id="lead-status" role="status" aria-live="polite">${esc(this.status.text)}</p>

        <div class="lead-notes-section">
          <h4>Notes</h4>
          <textarea id="notes" class="form-textarea" placeholder="Add notes about this lead..." rows="3">${esc(this.lead.notes)}</textarea>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    super.setupEventListeners();

    // Form inputs
    const inputIds = ['first-name', 'last-name', 'email', 'phone', 'company', 'job-title'];
    inputIds.forEach(id => {
      const input = this.content.querySelector(`#${id}`);
      if (input) {
        input.addEventListener('input', (e) => {
          this.lead[FIELD_MAP[id]] = e.target.value;
        });
      }
    });

    // Notes
    const notesInput = this.content.querySelector('#notes');
    if (notesInput) {
      notesInput.addEventListener('input', (e) => {
        this.lead.notes = e.target.value;
      });
    }

    // Source options
    this.content.querySelectorAll('input[name="source"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.lead.source = e.target.value;
      });
    });

    // Tag buttons
    this.content.querySelectorAll('.tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tag = e.currentTarget.dataset.tag;
        if (this.lead.tags.includes(tag)) {
          this.lead.tags = this.lead.tags.filter(t => t !== tag);
        } else {
          this.lead.tags.push(tag);
        }
        this.render();
        this.setupEventListeners();
      });
    });

    // Footer buttons
    this.content.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      this.close();
    });

    this.content.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      this.handleSave();
    });
  }

  setStatus(text, kind) {
    this.status = { text, kind };
    const el = this.content?.querySelector('#lead-status');
    if (el) {
      el.textContent = text;
      el.className = `lead-status lead-status--${kind || 'idle'}`;
    }
  }

  /** The lead as one answer-per-field object (same shape the video forms submit). */
  toLeadData() {
    const l = this.lead;
    const entries = {
      EMAIL: l.email,
      'FIRST NAME': l.firstName,
      'LAST NAME': l.lastName,
      PHONE: l.phone,
      COMPANY: l.company,
      'JOB TITLE': l.jobTitle,
      SOURCE: l.source,
      TAGS: (l.tags || []).join(', '),
      NOTES: l.notes,
    };
    return Object.fromEntries(Object.entries(entries).filter(([, v]) => String(v ?? '').trim()));
  }

  async handleSave() {
    const email = String(this.lead.email || '').trim();
    if (!EMAIL_RE.test(email)) {
      this.setStatus('Enter a valid email address to save this lead.', 'error');
      this.content?.querySelector('#email')?.focus();
      return;
    }
    this.setStatus('Saving…', 'idle');
    // Stored in public.video_leads through the lead-capture edge function, the
    // same pipeline as the List Builder / Lead Generator forms. (The old code
    // called "lead-processor" and "email-service", which don't exist.)
    const res = await submitLead(supabase, {
      projectId: null,
      clipId: 'manual',
      kind: 'lead-form',
      data: this.toLeadData(),
      preview: false,
    });
    if (res.error) {
      this.setStatus(`Couldn't save this lead: ${res.error}`, 'error');
      this.onError?.(res.error);
      return;
    }
    if (!res.stored) {
      this.setStatus('Not saved — sign in to store leads.', 'error');
      return;
    }
    this.onComplete?.({ ...this.lead, email, id: Date.now(), createdAt: new Date().toISOString() });
    this.close();
  }
}
