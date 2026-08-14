// PersonalizeModal.jsx
// BaseModal subclass: "Personalize for a contact" pop-up modal.
//
// Available in every video/image creation module. Replaces the legacy inline
// popover with a proper themed modal dialog that mirrors the GTM Boost modal
// design language (CSS variables, form grid, progress steps, structured
// results sections, per-studio theming).
//
// Flow:
//   1) Enter a username / email / website → click Discover
//   2) Runs Maigret scan + GitHub lookup + website crawl (best-effort)
//   3) Calls /api/personalizer/generate for server-side OpenAI enrichment
//   4) Persists contact + profile to localStorage
//   5) Shows discovered data (brand colors, tone, pain points, products,
//      social links, assets) and renders profile variables as clickable
//      token chips that insert `{{token}}` into the host app's prompt
//      textarea at the cursor.
//
// Usage:
//   const modal = new PersonalizeModal({ appId, getTextarea, onApply });
//   modal.open();

import { BaseModal } from './BaseModal.jsx';
import { openaiConfig } from '../../lib/config/openaiConfig.js';
import {
  insertTokenAtCursor,
  replaceTokensInPrompt,
  getSelectedContactId,
  setSelectedContactId,
} from '../personalize/personalizePopover.js';

const CONTACTS_KEY = 'remix_contacts';
const PROFILES_KEY = 'remix_contact_profiles';

const TOKEN_LABELS = {
  firstName: 'First Name',
  lastName: 'Last Name',
  fullName: 'Full Name',
  company: 'Company',
  companyName: 'Company Name',
  title: 'Title',
  email: 'Email',
  location: 'Location',
  industry: 'Industry',
  companySummary: 'Company Summary',
  painPoint: 'Pain Point',
  product: 'Product',
  service: 'Service',
  interest: 'Interest',
  buyingSignal: 'Buying Signal',
  tone: 'Tone',
  intelligenceSummary: 'Summary',
  brandColor: 'Brand Color',
  logoUrl: 'Logo',
  avatarUrl: 'Avatar',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  website: 'Website',
};

const DISCOVERY_STEPS = [
  'Scanning public profiles...',
  'Looking up GitHub...',
  'Crawling website...',
  'Extracting intelligence...',
  'Finalizing profile...',
];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _listContacts() {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); }
  catch { return []; }
}
function _getContact(id) { return _listContacts().find((c) => c.id === id); }
function _getProfile(id) {
  try {
    const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]');
    return profiles.find((p) => p.id === id) || null;
  } catch { return null; }
}

async function getSession() {
  try {
    const { createClient } = await import('../../lib/supabase.js');
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string') return `rgba(59, 130, 246, ${alpha})`;
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return `rgba(59, 130, 246, ${alpha})`;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class PersonalizeModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: '<span aria-hidden="true">🎯</span> Personalize for a contact',
      size: 'large',
      showFooter: true,
      footerContent: `
        <button class="modal-btn modal-btn-secondary" data-personalize-action="close">Close</button>
        <button class="modal-btn modal-btn-primary" data-personalize-action="apply" disabled>Apply personalization</button>
      `,
      closable: true,
      ...options,
    });

    this.appId = options.appId || 'ai-video-agency';
    this.getTextarea = options.getTextarea || (() => null);
    this.onApply = options.onApply || (() => {});
    this.onClear = options.onClear || (() => {});
    this.appTheme = options.appTheme || 'cinema-template-studio';
    this.appColors = this._resolveAppColors(this.appTheme);

    // Discovery state
    this.isDiscovering = false;
    this.discoveryStep = 0;
    this.discoveryStatus = '';
    this.errorMessage = '';

    // Selected contact
    this.selectedContactId = null;

    // Auto-timeline
    this.isGeneratingTimeline = false;

    // Advanced Maigret options
    this.showAdvanced = false;
    this.usernames = '';
    this.topSites = 500;
    this.timeoutSec = 15;
    this.tags = '';
    this.excludedTags = '';
    this.proxy = '';
    this.torProxy = '';
    this.i2pProxy = '';
    this.enableCloudflareBypass = false;
    this.retries = 1;
    this.disableRecursion = false;
    this.permute = false;
    this.checkDomains = false;
    this.keywords = '';
    this.parseUrl = '';
    this.allSites = false;
    this.useCookies = false;

    // Last scan id for exports
    this.lastScanId = null;

    // AI analysis state
    this.isAnalyzing = false;
    this.analysisResult = null;
    this.analysisError = '';

    // Scan warnings from backend (censorship, captcha, etc.)
    this.scanWarnings = [];

    // Scan mode (fast = top N, full = all 2500 with CF bypass)
    this.scanMode = 'fast';

    // Settings panel (collapsible)
    this.showSettings = false;

    // Persisted settings (loaded from /api/personalizer/settings)
    this.userSettings = {
      default_top: 500,
      default_timeout_ms: 15000,
      permute_enabled: false,
      disable_recursion: false,
      check_domains: false,
      proxy: '',
      tor_proxy: 'socks5://127.0.0.1:9050',
      i2p_proxy: 'http://127.0.0.1:4444',
      dark_mode: true,
    };

    // Dark/light theme for the modal body
    this.darkMode = true;

    // Multi-username input
    this.multiUsernameInput = '';

    // Scan history
    this.scanHistory = [];
    this.showHistory = false;
    this._forcedTab = null;

    // Last scan result data (for graph/table)
    this.lastScanData = null;

    // Settings are loaded asynchronously when the modal opens
    this._settingsLoaded = false;
  }

  _resolveAppColors(theme) {
    try {
      const scheme = openaiConfig.getStudioColorScheme(theme);
      if (scheme && scheme.primary) return scheme;
    } catch {}
    return { primary: '#d9ff00', accent: '#a855f7', secondary: '#64748b' };
  }

  _activeTab() {
    if (this._forcedTab) return this._forcedTab;
    return this.lastScanData ? 'results' : 'discover';
  }

  open() {
    super.open();
    // Link the dialog to its descriptive subtitle for screen readers.
    const dialog = this.overlay?.querySelector('.modal-overlay');
    if (dialog) dialog.setAttribute('aria-describedby', 'pm-subtitle');
    this._wireEvents();
    this._refreshContactsList();
    this._refreshProfileSummary();
    this._loadSettings();
    this._loadHistory();
    // Discover-first: move focus into the input after BaseModal's initial focus.
    setTimeout(() => {
      const input = this.overlay?.querySelector('#pm-input');
      if (input && document.activeElement !== input) input.focus();
    }, 80);
  }

  setBodyContent(html) {
    super.setBodyContent(html);
    this._wireEvents();
  }

  renderBody() {
    const primary = this.appColors.primary || '#d9ff00';
    const accent = this.appColors.accent || '#a855f7';
    const soft = hexToRgba(primary, 0.12);
    const softAccent = hexToRgba(accent, 0.12);
    const activeTab = this._activeTab();

    const tabAria = (tab) => {
      const selected = activeTab === tab ? 'true' : 'false';
      const tabIndex = activeTab === tab ? '0' : '-1';
      return `role="tab" id="pm-tab-${tab}" aria-selected="${selected}" aria-controls="pm-panel-${tab}" tabindex="${tabIndex}"`;
    };

    return `
      <div class="pm-modal ${this.darkMode ? 'pm-dark' : 'pm-light'}" data-theme="${this.darkMode ? 'dark' : 'light'}" style="--pm-primary: ${primary}; --pm-accent: ${accent}; --pm-soft: ${soft}; --pm-soft-accent: ${softAccent};">
        <p id="pm-subtitle" class="pm-subtitle">Discover a contact, view Maigret intelligence, and insert personalized tokens into your prompt.</p>

        <div class="pm-sr-only" role="status" aria-live="polite" id="pm-live"></div>

        ${this.errorMessage ? `<div class="pm-error" role="alert">⚠ ${escapeHtml(this.errorMessage)}</div>` : ''}

        <div class="pm-tabs" role="tablist" aria-label="Personalization sections">
          <button type="button" class="pm-tab ${activeTab === 'discover' ? 'pm-tab-active' : ''}" data-tab="discover" ${tabAria('discover')}>Discover</button>
          <button type="button" class="pm-tab ${activeTab === 'results' ? 'pm-tab-active' : ''}" data-tab="results" ${!this.lastScanData ? 'disabled' : ''} ${tabAria('results')}>Results</button>
          <button type="button" class="pm-tab ${activeTab === 'history' ? 'pm-tab-active' : ''}" data-tab="history" ${tabAria('history')}>History</button>
        </div>

        <div class="pm-tab-panels">
          <div class="pm-tab-panel ${activeTab === 'discover' ? 'pm-tab-panel-active' : ''}" data-panel="discover" role="tabpanel" id="pm-panel-discover" aria-labelledby="pm-tab-discover" tabindex="0">
            ${this._renderDiscoverTab()}
          </div>
          <div class="pm-tab-panel ${activeTab === 'results' ? 'pm-tab-panel-active' : ''}" data-panel="results" role="tabpanel" id="pm-panel-results" aria-labelledby="pm-tab-results" tabindex="0">
            ${this.lastScanData ? this._renderResults() : '<div class="pm-empty">Run a discovery to see results here.</div>'}
          </div>
          <div class="pm-tab-panel ${activeTab === 'history' ? 'pm-tab-panel-active' : ''}" data-panel="history" role="tabpanel" id="pm-panel-history" aria-labelledby="pm-tab-history" tabindex="0">
            ${this._renderHistory()}
          </div>
        </div>

        <div class="pm-section">
          <div class="pm-section-header">
            <span class="pm-section-label">Existing contacts</span>
            ${this.selectedContactId ? `<button type="button" class="pm-clear-btn" data-action="clear-contact">Clear</button>` : ''}
          </div>
          <div id="pm-contacts-list" class="pm-contacts-list">
            <div class="pm-empty">No contacts yet — paste a username above and click Discover.</div>
          </div>
        </div>

        <div id="pm-profile-summary" class="pm-profile ${this.selectedContactId ? '' : 'hidden'}">
          ${this.selectedContactId ? this._renderProfileContent() : ''}
        </div>
      </div>

      <style>
        .pm-modal {
          --pm-primary: ${primary};
          --pm-accent: ${accent};
          --pm-soft: ${soft};
          --pm-soft-accent: ${softAccent};
          color: var(--text-primary);
          font-family: var(--font-family);
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: pm-fade-in 280ms ease-out;
        }

        @keyframes pm-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Tabs */
        .pm-tabs {
          display: flex;
          flex-direction: row;
          border-bottom: 1px solid var(--border-color);
          gap: 4px;
        }

        .pm-tab {
          appearance: none;
          border: none;
          background: transparent;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-family);
        }

        .pm-tab:hover:not(:disabled) {
          color: var(--text-primary);
        }

        .pm-tab-active {
          color: var(--pm-primary);
          border-bottom-color: var(--pm-primary);
        }

        .pm-tab:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pm-tab-panels {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .pm-tab-panel {
          display: none;
        }

        .pm-tab-panel-active {
          display: block;
          animation: pm-fade-in 280ms ease-out;
        }

        /* Form */
        .pm-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-section > label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }

        .pm-form textarea,
        .pm-form select,
        .pm-form input {
          width: 100%;
          min-height: 40px;
          padding: 10px 12px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          color: var(--text-primary);
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
        }

        .pm-form textarea::placeholder,
        .pm-form input::placeholder {
          color: var(--text-muted);
        }

        .pm-form textarea:focus,
        .pm-form select:focus,
        .pm-form input:focus {
          border-color: var(--pm-primary);
          background: var(--bg-card);
          box-shadow: 0 0 0 3px var(--pm-soft);
        }

        .pm-form .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        /* Accessible field label + hint */
        .pm-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pm-form-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }

        .pm-form-hint {
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.01em;
          text-transform: none;
          color: var(--text-muted);
        }

        /* Live prompt preview */
        .pm-preview {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 14px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
        }

        .pm-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .pm-preview-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--pm-accent);
        }

        .pm-preview-pill {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: var(--border-radius-full);
          background: var(--pm-soft);
          color: var(--pm-primary);
          border: 1px solid var(--pm-primary);
        }

        .pm-preview-pill-muted {
          background: var(--bg-card);
          color: var(--text-muted);
          border-color: var(--border-color);
        }

        .pm-preview-text {
          margin: 0;
          font-family: 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
          font-size: 12px;
          line-height: 1.55;
          color: var(--text-primary);
          background: var(--bg-app, #0b0f17);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          padding: 10px 12px;
          max-height: 160px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .pm-preview-empty {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .pm-preview-actions {
          display: flex;
          gap: 8px;
        }

        /* Toggle advanced */
        .pm-toggle-advanced {
          appearance: none;
          border: 1px solid var(--border-color);
          background: var(--bg-panel);
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 36px;
          padding: 8px 14px;
          border-radius: var(--border-radius-md);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-family);
        }

        .pm-toggle-advanced:hover {
          background: var(--bg-card);
          color: var(--text-primary);
          border-color: var(--pm-primary);
        }

        /* Advanced options panel */
        .pm-advanced-options {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
        }

        .pm-form .option-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pm-form .checkbox-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .pm-form .checkbox-group label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 8px 12px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-full);
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .pm-form .checkbox-group label:hover {
          background: var(--pm-soft);
          border-color: var(--pm-primary);
          color: var(--text-primary);
        }

        .pm-form .checkbox-group label:has(input:checked) {
          color: var(--pm-accent);
          border-color: var(--pm-accent);
          background: var(--pm-soft-accent);
        }

        /* Buttons */
        .pm-btn {
          appearance: none;
          border: 1px solid transparent;
          background: transparent;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 40px;
          padding: 10px 16px;
          border-radius: var(--border-radius-md);
          font-family: var(--font-family);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .pm-btn-primary {
          background: var(--pm-primary);
          color: #03131a;
        }

        .pm-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px var(--pm-soft);
        }

        .pm-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .pm-btn-secondary {
          background: var(--bg-panel);
          color: var(--text-primary);
          border-color: var(--border-color);
        }

        .pm-btn-secondary:hover {
          border-color: var(--pm-primary);
          background: var(--pm-soft);
          color: var(--pm-primary);
        }

        /* Progress */
        .pm-progress {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px 16px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
        }

        .pm-progress-bar {
          width: 100%;
          height: 6px;
          background: var(--bg-card);
          border-radius: var(--border-radius-full);
          overflow: hidden;
        }

        .pm-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--pm-primary), var(--pm-accent));
          border-radius: var(--border-radius-full);
          transition: width 0.4s ease;
        }

        .pm-progress-steps {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pm-progress-step {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
          transition: color var(--transition-fast);
        }

        .pm-progress-step.active { color: var(--text-primary); }
        .pm-progress-step.done { color: var(--pm-accent); }

        .pm-progress-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--border-color);
          flex-shrink: 0;
          transition: background var(--transition-fast);
        }

        .pm-progress-step.active .pm-progress-dot {
          background: var(--pm-primary);
          box-shadow: 0 0 0 3px var(--pm-soft);
        }

        .pm-progress-step.done .pm-progress-dot {
          background: var(--pm-accent);
        }

        /* Error */
        .pm-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--border-radius-md);
          color: #fca5a5;
          font-size: 13px;
        }

        .pm-subtitle {
          margin: -4px 0 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-secondary);
          max-width: 56ch;
        }

        /* Visually hidden but available to assistive tech */
        .pm-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* Visible focus ring for keyboard users (2026 a11y best practice) */
        .pm-tab:focus-visible,
        .pm-token:focus-visible,
        .pm-contact-row:focus-visible,
        .pm-history-view:focus-visible,
        .pm-export-btn:focus-visible,
        .pm-action-btn:focus-visible,
        .pm-icon-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--bg-app, #0b0f17), 0 0 0 4px var(--pm-primary);
          border-radius: var(--border-radius-md);
        }

        .pm-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pm-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .pm-section-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
        }

        .pm-clear-btn {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          background: transparent;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-full);
          padding: 4px 10px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .pm-clear-btn:hover {
          border-color: rgba(239, 68, 68, 0.4);
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.08);
        }

        .pm-contacts-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 160px;
          overflow-y: auto;
        }

        .pm-empty {
          font-size: 12px;
          color: var(--text-muted);
          padding: 8px 0;
        }

        .pm-contact-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          text-align: left;
          padding: 8px 10px;
          border-radius: var(--border-radius-md);
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer;
          transition: all var(--transition-fast) ease;
          font-family: var(--font-family);
        }

        .pm-contact-row:hover {
          background: var(--pm-soft);
          border-color: var(--pm-primary);
        }

        .pm-contact-row.active {
          background: var(--pm-soft);
          border-color: var(--pm-primary);
        }

        .pm-contact-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          flex-shrink: 0;
          background: var(--pm-soft);
          border: 1px solid var(--pm-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: var(--pm-primary);
        }

        .pm-contact-meta { flex: 1; min-width: 0; }

        .pm-contact-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pm-contact-sub {
          font-size: 10px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Profile */
        .pm-profile {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 14px;
          background: var(--pm-soft);
          border: 1px solid var(--pm-primary);
          border-radius: var(--border-radius-lg);
        }

        .pm-profile-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .pm-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          flex-shrink: 0;
          background: var(--pm-soft);
          border: 1px solid var(--pm-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          color: var(--pm-primary);
          overflow: hidden;
        }

        .pm-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pm-profile-meta { flex: 1; min-width: 0; }

        .pm-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pm-company {
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pm-pain {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Discovered content */
        .pm-discovered {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pm-discovered-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12px;
        }

        .pm-discovered-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          min-width: 56px;
          flex-shrink: 0;
          padding-top: 1px;
        }

        .pm-discovered-value {
          color: var(--text-primary);
          word-break: break-word;
        }

        .pm-swatch {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.2);
          flex-shrink: 0;
        }

        .pm-chip {
          display: inline-block;
          font-size: 10px;
          padding: 2px 8px;
          border-radius: var(--border-radius-full);
          background: var(--pm-soft);
          border: 1px solid var(--pm-primary);
          color: var(--pm-primary);
          white-space: nowrap;
        }

        .pm-chip-accent {
          background: var(--pm-soft-accent);
          border-color: var(--pm-accent);
          color: var(--pm-accent);
        }

        .pm-link {
          color: var(--pm-accent);
          text-decoration: underline dotted;
          cursor: pointer;
        }

        .pm-link:hover { text-decoration: underline; }

        .pm-assets {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pm-asset-img {
          height: 32px;
          padding: 2px 6px;
          background: rgba(255,255,255,0.05);
          border-radius: var(--border-radius-sm);
          border: 1px solid rgba(255,255,255,0.1);
          object-fit: contain;
        }

        /* Scan results card */
        .pm-scan-card {
          padding: 12px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pm-scan-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .pm-scan-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .pm-confidence {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: var(--border-radius-full);
          background: var(--pm-soft);
          color: var(--pm-primary);
        }

        .pm-platforms {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .pm-platform-chip {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: var(--border-radius-full);
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          text-decoration: none;
          transition: all var(--transition-fast);
        }

        .pm-platform-chip:hover {
          border-color: var(--pm-primary);
          color: var(--pm-primary);
        }

        .pm-export-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        .pm-export-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }

        .pm-export-btn {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: var(--border-radius-full);
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-family);
        }

        .pm-export-btn:hover {
          border-color: var(--pm-accent);
          color: var(--pm-accent);
          background: var(--pm-soft-accent);
        }

        .pm-analysis {
          padding: 12px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-primary);
          white-space: pre-wrap;
        }

        .pm-warnings {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 8px;
        }

        .pm-warning {
          padding: 8px 12px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: var(--border-radius-md);
          color: #fbbf24;
          font-size: 12px;
        }

        /* Results */
        .pm-results {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 14px;
          background: var(--bg-card);
          border: 1px solid var(--pm-primary);
          border-radius: var(--border-radius-lg);
        }

        .pm-results-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .pm-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 8px;
        }

        .pm-stat {
          padding: 10px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          text-align: center;
        }

        .pm-stat-value {
          font-size: 18px;
          font-weight: 700;
          color: var(--pm-primary);
        }

        .pm-stat-label {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* Graph */
        .pm-graph {
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          padding: 8px;
          max-height: 280px;
          overflow: auto;
        }

        .pm-graph svg { display: block; }
        .pm-graph-fallback {
          font-size: 11px;
          color: var(--text-muted);
          padding: 8px;
        }
        .pm-graph-list { list-style: none; padding: 0; margin: 0; font-size: 11px; }
        .pm-graph-edge { padding: 3px 0; color: var(--text-secondary); }
        .pm-graph-edge strong { color: var(--pm-primary); }

        /* Results table */
        .pm-results-table-wrap {
          max-height: 280px;
          overflow: auto;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
        }

        .pm-results-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .pm-results-table th,
        .pm-results-table td {
          padding: 8px 10px;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-primary);
        }

        .pm-results-table th {
          background: var(--bg-panel);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .pm-results-table tr:hover { background: var(--pm-soft); }
        .pm-results-table-favicon {
          width: 16px;
          height: 16px;
          vertical-align: middle;
          border-radius: 3px;
        }
        .pm-results-table-tags { display: flex; flex-wrap: wrap; gap: 4px; }

        .pm-extractions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pm-extraction-card {
          padding: 10px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
        }

        .pm-extraction-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }

        .pm-extraction-rows {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .pm-extraction-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
        }

        .pm-extraction-key {
          font-weight: 600;
          color: var(--text-muted);
          min-width: 100px;
          flex-shrink: 0;
          text-transform: capitalize;
        }

        .pm-extraction-value {
          color: var(--text-primary);
          word-break: break-word;
        }

        /* Tokens */
        .pm-tokens {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .pm-token {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-radius: var(--border-radius-md);
          background: var(--pm-soft);
          border: 1px solid var(--pm-primary);
          font-size: 11px;
          font-family: 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;
          color: var(--pm-primary);
          cursor: pointer;
          transition: all var(--transition-fast) ease;
        }

        .pm-token:hover {
          background: var(--pm-soft-accent);
          border-color: var(--pm-accent);
          color: var(--pm-accent);
          transform: translateY(-1px);
        }

        .pm-token-preview {
          color: var(--text-muted);
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 10px;
        }

        /* Actions */
        .pm-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .pm-action-btn {
          appearance: none;
          border: 1px solid transparent;
          background: transparent;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 36px;
          padding: 8px 14px;
          border-radius: var(--border-radius-md);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast) ease;
          font-family: var(--font-family);
        }

        .pm-action-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--bg-app), 0 0 0 4px var(--pm-primary);
        }

        .pm-action-primary {
          background: var(--pm-primary);
          color: #03131a;
        }

        .pm-action-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px var(--pm-soft);
        }

        .pm-action-secondary {
          background: var(--bg-panel);
          color: var(--text-primary);
          border-color: var(--border-color);
        }

        .pm-action-secondary:hover {
          border-color: var(--pm-primary);
          background: var(--pm-soft);
          color: var(--pm-primary);
        }

        .pm-action-accent {
          background: var(--pm-accent);
          color: #03131a;
        }

        .pm-action-accent:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px var(--pm-soft-accent);
        }

        .pm-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        /* Advanced options */
        .pm-advanced {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
        }

        .pm-advanced-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .pm-advanced-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-secondary);
          min-width: 120px;
          padding-top: 8px;
          flex-shrink: 0;
        }

        .pm-advanced-field { flex: 1; min-width: 0; }

        .pm-advanced-checks {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .pm-input-sm {
          padding: 8px 10px;
          font-size: 13px;
        }

        .pm-check {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-primary);
          cursor: pointer;
        }

        .pm-check input[type="checkbox"] {
          accent-color: var(--pm-primary);
          width: 14px;
          height: 14px;
          cursor: pointer;
        }

        /* Multi-username input */
        .pm-textarea {
          resize: vertical;
          min-height: 72px;
          font-family: var(--font-family);
          line-height: 1.5;
        }
        .pm-discover-input-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .pm-discover-actions { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
        .pm-discover-meta { display: flex; justify-content: flex-end; }
        .pm-username-count { font-size: 10px; color: var(--text-muted); font-weight: 600; }
        .pm-icon-btn {
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 600;
          background: var(--bg-panel);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-family);
          white-space: nowrap;
        }
        .pm-icon-btn:hover {
          border-color: var(--pm-primary);
          color: var(--pm-primary);
          background: var(--pm-soft);
        }

        /* Mode row */
        .pm-mode-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          padding: 10px 12px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
        }
        .pm-mode-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }
        .pm-radio {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-primary);
          cursor: pointer;
        }
        .pm-radio input[type="radio"] { accent-color: var(--pm-primary); cursor: pointer; }

        /* Settings panel */
        .pm-settings-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 14px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
        }
        .pm-settings-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pm-settings-group-title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--pm-accent);
        }
        .pm-settings-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pm-settings-field {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-secondary);
        }
        .pm-settings-field input[type="number"] {
          width: 72px;
          padding: 6px 8px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          color: var(--text-primary);
          font-size: 12px;
          font-family: var(--font-family);
        }
        .pm-settings-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 4px;
        }

        /* History */
        .pm-history-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 240px;
          overflow-y: auto;
          padding: 10px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
        }
        .pm-history-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          font-size: 12px;
        }
        .pm-history-row:hover { border-color: var(--pm-primary); }
        .pm-history-meta { flex: 1; min-width: 0; }
        .pm-history-name {
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pm-history-sub {
          font-size: 10px;
          color: var(--text-muted);
          display: flex;
          gap: 8px;
        }
        .pm-history-view {
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          background: var(--pm-soft);
          color: var(--pm-primary);
          border: 1px solid var(--pm-primary);
          border-radius: var(--border-radius-full);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .pm-history-view:hover {
          background: var(--pm-primary);
          color: #03131a;
        }

        @media (max-width: 640px) {
          .pm-modal { gap: 16px; }
          .pm-form .form-grid { grid-template-columns: 1fr; }
          .pm-discover-row { flex-direction: column; }
          .pm-discover-actions { flex-direction: row; flex-wrap: wrap; }
          .pm-actions { flex-direction: column; align-items: stretch; }
          .pm-action-btn { width: 100%; justify-content: center; }
          .pm-mode-row { flex-direction: column; align-items: flex-start; }
          .pm-settings-grid { grid-template-columns: 1fr; }
          .pm-tabs { flex-wrap: wrap; }
          .pm-advanced-row { flex-direction: column; gap: 4px; }
          .pm-advanced-label { min-width: auto; padding-top: 0; }
          .pm-advanced-checks { flex-direction: column; gap: 6px; }
        }

        .pm-modal.pm-light {
          --text-primary: #1a1a1a;
          --text-secondary: #4b5563;
          --text-muted: #6b7280;
          --bg-app: #ffffff;
          --bg-panel: #f9fafb;
          --bg-card: #ffffff;
          --border-color: #e5e7eb;
        }

        /* Respect users who prefer reduced motion (2026 a11y baseline) */
        @media (prefers-reduced-motion: reduce) {
          .pm-modal,
          .pm-tab-panel-active,
          .pm-progress-fill,
          .pm-btn,
          .pm-action-btn,
          .pm-toggle-advanced,
          .pm-contact-row,
          .pm-token,
          .pm-icon-btn {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      </style>
    `;
  }
  _renderProgress() {
    const active = Math.min(this.discoveryStep, DISCOVERY_STEPS.length - 1);
    const pct = ((active + 1) / DISCOVERY_STEPS.length) * 100;
    const stepsHtml = DISCOVERY_STEPS.map((label, i) => {
      const state = i < active ? 'done' : i === active ? 'active' : 'pending';
      return `<div class="pm-progress-step ${state}"><span class="pm-progress-dot"></span>${label}</div>`;
    }).join('');

    return `
      <div class="pm-progress" role="status" aria-live="polite" aria-label="Discovery progress">
        <div class="pm-progress-bar">
          <div class="pm-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="pm-progress-steps">${stepsHtml}</div>
      </div>
    `;
  }

  _parseUsernames(value) {
    if (!value) return [];
    return String(value)
      .split(/[\s,;]+/)
      .map((u) => u.trim().replace(/^@/, ''))
      .filter((u) => u.length > 0);
  }

  _renderDiscoverTab() {
    return `
      <div class="pm-form">
        <div class="pm-form-group">
          <label for="pm-input" class="pm-form-label">
            Username, email, or website
            <span class="pm-form-hint">One per line or comma / space separated — up to 10</span>
          </label>
          <div class="pm-discover-row">
            <div class="pm-discover-input-wrap">
              <textarea id="pm-input" placeholder="@username1, @username2, email@x.com or website.com — one per line or comma/space separated" class="pm-input pm-textarea" rows="3" autocomplete="off" aria-describedby="pm-username-count">${escapeHtml(this.multiUsernameInput)}</textarea>
              <div class="pm-discover-meta">
                <span id="pm-username-count" class="pm-username-count" aria-live="polite">${this._parseUsernames(this.multiUsernameInput).length} username(s) detected</span>
              </div>
            </div>
            <div class="pm-discover-actions">
              <button id="pm-discover" class="pm-btn pm-btn-primary" ${this.isDiscovering ? 'disabled' : ''}>${this.isDiscovering ? 'Discovering…' : 'Discover'}</button>
              <button type="button" class="pm-icon-btn" data-action="toggle-theme" aria-label="Toggle dark / light mode" title="Toggle dark / light mode"><span aria-hidden="true">${this.darkMode ? '☀' : '🌙'}</span></button>
            </div>
          </div>
        </div>

        <div class="pm-mode-row" role="radiogroup" aria-label="Scan check mode">
          <span class="pm-mode-label">Check mode:</span>
          <label class="pm-radio">
            <input type="radio" name="pm-scan-mode" value="fast" ${this.scanMode === 'fast' ? 'checked' : ''} />
            <span>Fast check (top ${this.topSites} sites)</span>
          </label>
          <label class="pm-radio">
            <input type="radio" name="pm-scan-mode" value="full" ${this.scanMode === 'full' ? 'checked' : ''} />
            <span>Full check (all 2500 sites + Cloudflare bypass)</span>
          </label>
        </div>

        <button type="button" class="pm-toggle-advanced" data-action="toggle-advanced" aria-expanded="${this.showAdvanced ? 'true' : 'false'}">
          ${this.showAdvanced ? 'Hide advanced options' : 'Advanced options'}
        </button>

        ${this.showAdvanced ? this._renderAdvancedOptions() : ''}

        ${this.isDiscovering ? this._renderProgress() : ''}

        ${this._renderPromptPreview()}

        <button type="button" class="pm-icon-btn" data-action="toggle-settings" aria-label="Open personalizer settings" title="Settings" style="align-self:flex-start;"><span aria-hidden="true">⚙</span> Settings</button>
        ${this.showSettings ? this._renderSettings() : ''}
      </div>
    `;
  }

  _renderPromptPreview() {
    const ta = typeof this.getTextarea === 'function' ? this.getTextarea() : null;
    const raw = ta && ta.value ? ta.value : '';
    if (!raw) {
      return `
        <div class="pm-preview" aria-hidden="true">
          <div class="pm-preview-label">Prompt preview</div>
          <div class="pm-preview-empty">Open this modal from a studio with a prompt to preview how personalization resolves.</div>
        </div>
      `;
    }

    const contactId = getSelectedContactId();
    const profile = contactId ? _getProfile(contactId) : null;
    const resolved = profile ? replaceTokensInPrompt(raw, profile) : raw;
    const hasTokens = /\{\{[^}]+\}\}/.test(raw);
    const isResolved = resolved === raw;

    return `
      <div class="pm-preview">
        <div class="pm-preview-header">
          <span class="pm-preview-label">Prompt preview</span>
          ${profile ? `<span class="pm-preview-pill">Personalized for ${escapeHtml(profile.contact?.name || 'contact')}</span>` : (hasTokens ? `<span class="pm-preview-pill pm-preview-pill-muted">No contact selected — showing raw tokens</span>` : `<span class="pm-preview-pill pm-preview-pill-muted">No tokens to personalize</span>`)}
        </div>
        <pre class="pm-preview-text" tabindex="0">${escapeHtml(isResolved ? raw : resolved)}</pre>
        <div class="pm-preview-actions">
          <button type="button" class="pm-action-btn pm-action-secondary" data-action="copy-preview">Copy ${isResolved ? 'personalized' : 'prompt'}</button>
        </div>
      </div>
    `;
  }

  _renderSettings() {
    const s = this.userSettings;
    return `
      <div class="pm-settings-panel">
        <div class="pm-settings-group">
          <span class="pm-settings-group-title">General</span>
          <div class="pm-settings-row">
            <label class="pm-settings-field">
              Timeout (sec)
              <input type="number" id="pm-set-timeout" min="5" max="60" value="${Math.round((s.default_timeout_ms || 15000) / 1000)}" />
            </label>
            <label class="pm-settings-field">
              Sites (fast check)
              <input type="number" id="pm-set-top" min="1" max="2500" value="${s.default_top || 500}" />
            </label>
          </div>
        </div>

        <div class="pm-settings-group">
          <span class="pm-settings-group-title">Advanced</span>
          <div class="pm-advanced-checks">
            <label class="pm-check"><input type="checkbox" id="pm-set-permute" ${s.permute_enabled ? 'checked' : ''} /> Enable username permutations</label>
            <label class="pm-check"><input type="checkbox" id="pm-set-norecursion" ${s.disable_recursion ? 'checked' : ''} /> Disable recursive search</label>
            <label class="pm-check"><input type="checkbox" id="pm-set-noparse" ${this.disableInfoExtraction ? 'checked' : ''} /> Disable info extraction</label>
            <label class="pm-check"><input type="checkbox" id="pm-set-domains" ${s.check_domains ? 'checked' : ''} /> Check domains</label>
          </div>
        </div>

        <div class="pm-settings-group">
          <span class="pm-settings-group-title">Proxy URLs</span>
          <div class="pm-settings-row">
            <label class="pm-settings-field" style="flex:1;">
              HTTP/SOCKS
              <input type="text" id="pm-set-proxy" value="${escapeHtml(s.proxy || '')}" placeholder="socks5://user:pass@host:1080" class="pm-input pm-input-sm" style="flex:1;" />
            </label>
          </div>
          <div class="pm-settings-row">
            <label class="pm-settings-field" style="flex:1;">
              Tor
              <input type="text" id="pm-set-tor" value="${escapeHtml(s.tor_proxy || 'socks5://127.0.0.1:9050')}" placeholder="socks5://127.0.0.1:9050" class="pm-input pm-input-sm" style="flex:1;" />
            </label>
          </div>
          <div class="pm-settings-row">
            <label class="pm-settings-field" style="flex:1;">
              I2P
              <input type="text" id="pm-set-i2p" value="${escapeHtml(s.i2p_proxy || 'http://127.0.0.1:4444')}" placeholder="http://127.0.0.1:4444" class="pm-input pm-input-sm" style="flex:1;" />
            </label>
          </div>
        </div>

        <div class="pm-settings-actions">
          <button type="button" class="pm-action-btn pm-action-secondary" data-action="settings-reset">Reset</button>
          <button type="button" class="pm-action-btn pm-action-primary" data-action="settings-save">Save settings</button>
        </div>
      </div>
    `;
  }

  _renderHistory() {
    if (!this.scanHistory || this.scanHistory.length === 0) {
      return `
        <div class="pm-history-list">
          <div class="pm-empty">No past scans yet.</div>
        </div>
      `;
    }
    const rows = this.scanHistory.map((h) => {
      const date = h.scannedAt ? new Date(h.scannedAt).toLocaleString() : '';
      const sitesFound = h.sitesFound ?? 0;
      const confidence = h.confidence ? Math.round(h.confidence * 100) + '%' : '—';
      return `
        <div class="pm-history-row">
          <div class="pm-history-meta">
            <div class="pm-history-name">${escapeHtml(h.targetName || '(unnamed)')}</div>
            <div class="pm-history-sub">
              <span>${escapeHtml(date)}</span>
              <span>${sitesFound} sites</span>
              <span>${confidence}</span>
            </div>
          </div>
          <button type="button" class="pm-history-view" data-action="history-view" data-scan-id="${escapeHtml(h.id)}">View</button>
        </div>
      `;
    }).join('');
    return `<div class="pm-history-list">${rows}</div>`;
  }

  _renderResults() {
    if (!this.lastScanData) return '';
    const data = this.lastScanData;
    const platforms = Array.isArray(data.platforms) ? data.platforms : [];
    const sitesChecked = data.sitesChecked ?? data.top ?? 0;
    const sitesFound = data.sitesFound ?? platforms.length;
    const confidence = data.confidence ? Math.round(data.confidence * 100) : null;
    const duration = data.duration ?? null;

    return `
      <div class="pm-results">
        <div class="pm-results-title">
          <span>Scan results</span>
          <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(data.targetName || data.usernames?.join(', ') || '')}</span>
        </div>

        <div class="pm-stats">
          <div class="pm-stat"><div class="pm-stat-value">${sitesChecked}</div><div class="pm-stat-label">Sites checked</div></div>
          <div class="pm-stat"><div class="pm-stat-value">${sitesFound}</div><div class="pm-stat-label">Sites found</div></div>
          <div class="pm-stat"><div class="pm-stat-value">${confidence !== null ? confidence + '%' : '—'}</div><div class="pm-stat-label">Confidence</div></div>
          <div class="pm-stat"><div class="pm-stat-value">${duration !== null ? duration + 's' : '—'}</div><div class="pm-stat-label">Duration</div></div>
        </div>

        ${this._renderGraph()}

        <div>
          <div class="pm-section-label" style="margin-bottom:6px;">Found platforms (${platforms.length})</div>
          ${this._renderResultsTable()}
        </div>

        ${this._renderExtractionDetails()}

        ${this.lastScanId ? this._renderExportButtons() : ''}

        ${this._renderWarnings()}

        <div class="pm-section" style="margin-top:12px;">
          <div class="pm-section-header">
            <span class="pm-section-label">AI analysis</span>
            <button type="button" class="pm-action-btn pm-action-secondary" data-action="run-analysis" ${this.isAnalyzing ? 'disabled' : ''}>
              ${this.isAnalyzing ? 'Analyzing…' : '🔍 Run investigation summary'}
            </button>
          </div>
          ${this.analysisResult ? `<div class="pm-analysis">${escapeHtml(this.analysisResult).replace(/\n/g, '<br>')}</div>` : ''}
          ${this.analysisError ? `<div class="pm-error" role="alert">⚠ ${escapeHtml(this.analysisError)}</div>` : ''}
        </div>
      </div>
    `;
  }

  _renderGraph() {
    const data = this.lastScanData;
    const graph = data?.graph;
    if (!graph || (!graph.nodes?.length && !graph.edges?.length)) {
      return `
        <div>
          <div class="pm-section-label" style="margin-bottom:6px;">Graph</div>
          <div class="pm-graph"><div class="pm-graph-fallback">No graph data for this scan.</div></div>
        </div>
      `;
    }

    // Simple SVG force-style layout: arrange nodes on a circle, draw edges as lines
    const W = 480;
    const H = 220;
    const nodes = graph.nodes || [];
    const edges = graph.edges || [];
    const n = nodes.length;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - 30;
    const positioned = nodes.map((node, i) => {
      if (n === 1) return { ...node, x: cx, y: cy };
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { ...node, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    const byId = Object.fromEntries(positioned.map((p) => [p.id, p]));

    const nodeColor = (type) => {
      if (type === 'person' || type === 'user') return 'var(--pm-primary)';
      if (type === 'platform' || type === 'site') return 'var(--pm-accent)';
      return 'var(--text-secondary)';
    };

    const edgeSvg = edges.map((e) => {
      const a = byId[e.source];
      const b = byId[e.target];
      if (!a || !b) return '';
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--border-color)" stroke-width="1" />`;
    }).join('');

    const nodeSvg = positioned.map((p) => {
      const label = (p.label || p.id || '').slice(0, 16);
      const color = nodeColor(p.type);
      return `
        <g>
          <circle cx="${p.x}" cy="${p.y}" r="6" fill="${color}" stroke="var(--bg-app)" stroke-width="2" />
          <text x="${p.x + 10}" y="${p.y + 4}" fill="var(--text-secondary)" font-size="10" font-family="var(--font-family)">${escapeHtml(label)}</text>
        </g>
      `;
    }).join('');

    return `
      <div>
        <div class="pm-section-label" style="margin-bottom:6px;">Graph</div>
        <div class="pm-graph">
          <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${edgeSvg}${nodeSvg}</svg>
        </div>
      </div>
    `;
  }

  _renderResultsTable() {
    const platforms = this.lastScanData?.platforms || [];
    if (platforms.length === 0) {
      return '<div class="pm-empty" style="padding:8px;">No platforms found.</div>';
    }
    const rows = platforms.map((p) => {
      const platform = p.platform || 'site';
      const url = p.url || '#';
      let favicon = '';
      try {
        const host = new URL(url).hostname;
        favicon = `<img class="pm-results-table-favicon" src="https://www.google.com/s2/favicons?domain=${host}&sz=32" alt="" onerror="this.style.visibility='hidden'" />`;
      } catch {
        favicon = '<span style="display:inline-block;width:16px;height:16px;"></span>';
      }
      const tagsRaw = p.tags || (p.tags_all ? Object.keys(p.tags_all).slice(0, 3) : []);
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.slice(0, 3).map((t) => `<span class="pm-chip">${escapeHtml(String(t))}</span>`).join('')
        : '';
      return `
        <tr>
          <td>${favicon}</td>
          <td>${escapeHtml(platform)}</td>
          <td><a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="pm-link">${escapeHtml(url)}</a></td>
          <td><div class="pm-results-table-tags">${tags}</div></td>
        </tr>
      `;
    }).join('');
    return `
      <div class="pm-results-table-wrap">
        <table class="pm-results-table">
          <thead>
            <tr><th></th><th>Platform</th><th>URL</th><th>Tags</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  _renderExtractionDetails() {
    const platforms = this.lastScanData?.platforms || [];
    const withDetails = platforms.filter(p => p.ids_data && Object.keys(p.ids_data).length > 0);
    if (!withDetails.length) return '';

    const sections = withDetails.map(p => {
      const ids = p.ids_data || {};
      const rows = Object.entries(ids)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => {
          const display = typeof v === 'string' && v.length > 80 ? v.slice(0, 78) + '…' : v;
          return `<div class="pm-extraction-row"><span class="pm-extraction-key">${escapeHtml(k)}</span><span class="pm-extraction-value">${escapeHtml(String(display))}</span></div>`;
        }).join('');
      if (!rows) return '';
      return `
        <div class="pm-extraction-card">
          <div class="pm-extraction-title">${escapeHtml(p.platform || 'site')}</div>
          <div class="pm-extraction-rows">${rows}</div>
        </div>
      `;
    }).join('');

    return `
      <div>
        <div class="pm-section-label" style="margin-bottom:6px;">Extracted personal info</div>
        <div class="pm-extractions">${sections}</div>
      </div>
    `;
  }

  _renderExportButtons() {
    if (!this.lastScanId) return '';
    const formats = [
      { key: 'json', label: 'JSON' },
      { key: 'csv', label: 'CSV' },
      { key: 'md', label: 'Markdown' },
      { key: 'html', label: 'HTML' },
      { key: 'txt', label: 'TXT' },
      { key: 'pdf', label: 'PDF' },
      { key: 'graph', label: 'Graph' },
      { key: 'xmind', label: 'XMind' },
      { key: 'neo4j', label: 'Neo4j' },
    ];
    return `
      <div class="pm-export-row">
        <span class="pm-export-label">Export</span>
        ${formats.map((f) => `
          <button type="button" class="pm-export-btn" data-export="${f.key}" data-scan-id="${escapeHtml(this.lastScanId)}">${f.label}</button>
        `).join('')}
      </div>
    `;
  }

  _renderWarnings() {
    const warnings = this.scanWarnings || [];
    if (!warnings.length) return '';
    return `
      <div class="pm-warnings">
        <div class="pm-section-label" style="margin-bottom:6px;color:#f59e0b;">Warnings</div>
        ${warnings.map(w => `<div class="pm-warning">⚠ ${escapeHtml(w)}</div>`).join('')}
      </div>
    `;
  }

  async _handleAnalysis() {
    if (!this.lastScanId) return;
    this.isAnalyzing = true;
    this.analysisResult = null;
    this.analysisError = '';
    this.refreshBody();

    try {
      const session = await getSession();
      if (!session) {
        this.analysisError = 'Sign in to run AI analysis.';
        this.isAnalyzing = false;
        this.refreshBody();
        return;
      }

      const res = await fetch('/api/personalizer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ scanId: this.lastScanId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Analysis failed (${res.status})`);

      this.analysisResult = data.analysisSummary || 'No analysis generated.';
    } catch (err) {
      this.analysisError = err.message || 'Analysis failed';
    } finally {
      this.isAnalyzing = false;
      this.refreshBody();
    }
  }

  _renderAdvancedOptions() {
    const row = (label, input) => `
      <div class="pm-advanced-row">
        <label class="pm-advanced-label">${escapeHtml(label)}</label>
        <div class="pm-advanced-field">${input}</div>
      </div>
    `;

    return `
      <div class="pm-advanced">
        ${row('Top sites', `<input type="number" id="pm-opt-top" value="${this.topSites}" min="1" max="2500" class="pm-input pm-input-sm" />`)}
        ${row('Timeout (sec)', `<input type="number" id="pm-opt-timeout" value="${this.timeoutSec}" min="5" max="60" class="pm-input pm-input-sm" />`)}
        ${row('Tags (comma-separated)', `<input type="text" id="pm-opt-tags" value="${escapeHtml(this.tags)}" placeholder="photo, dating, us" class="pm-input pm-input-sm" />`)}
        ${row('Keywords', `<input type="text" id="pm-opt-keywords" value="${escapeHtml(this.keywords)}" placeholder="python, rust" class="pm-input pm-input-sm" />`)}
        ${row('Proxy (HTTP/SOCKS)', `<input type="text" id="pm-opt-proxy" value="${escapeHtml(this.proxy)}" placeholder="socks5://127.0.0.1:1080" class="pm-input pm-input-sm" />`)}
        ${row('Tor proxy', `<input type="text" id="pm-opt-tor" value="${escapeHtml(this.torProxy)}" placeholder="socks5://127.0.0.1:9050" class="pm-input pm-input-sm" />`)}
        ${row('I2P proxy', `<input type="text" id="pm-opt-i2p" value="${escapeHtml(this.i2pProxy)}" placeholder="http://127.0.0.1:4444" class="pm-input pm-input-sm" />`)}
        ${row('Parse URL', `<input type="text" id="pm-opt-parse" value="${escapeHtml(this.parseUrl)}" placeholder="https://..." class="pm-input pm-input-sm" />`)}
        <div class="pm-advanced-row">
          <label class="pm-advanced-label"></label>
          <div class="pm-advanced-field pm-advanced-checks">
            <label class="pm-check"><input type="checkbox" id="pm-opt-all-sites" ${this.allSites ? 'checked' : ''} /> All sites</label>
            <label class="pm-check"><input type="checkbox" id="pm-opt-cloudflare" ${this.enableCloudflareBypass ? 'checked' : ''} /> Cloudflare bypass</label>
            <label class="pm-check"><input type="checkbox" id="pm-opt-permute" ${this.permute ? 'checked' : ''} /> Permute usernames</label>
            <label class="pm-check"><input type="checkbox" id="pm-opt-domains" ${this.checkDomains ? 'checked' : ''} /> Check domains</label>
            <label class="pm-check"><input type="checkbox" id="pm-opt-recursion" ${this.disableRecursion ? 'checked' : ''} /> Disable recursion</label>
            <label class="pm-check"><input type="checkbox" id="pm-opt-cookies" ${this.useCookies ? 'checked' : ''} /> Use cookies</label>
          </div>
        </div>
      </div>
    `;
  }

  _renderProfileContent() {
    const profile = this._getSelectedProfile();
    const contact = this._getSelectedContact();
    if (!profile || !contact) return '';

    const intel = profile?.intelligence || {};
    const company = profile?.company || {};
    const brand = profile?.brand || {};
    const social = profile?.social || {};
    const website = profile?.website || {};
    const assets = profile?.assets || {};
    const variables = profile?.variables || {};
    const scanData = profile?.history?.discoveries?.find((d) => d.source === 'maigret' && d.success)?.data || null;

    const platforms = scanData?.platforms || [];
    const confidence = scanData?.confidence ? Math.round(scanData.confidence * 100) : null;
    const colors = brand.colors || {};
    const swatches = [colors.primary, colors.secondary, colors.accent].filter(Boolean);

    const rows = [];

    // Scan results summary
    if (platforms.length) {
      const platformChips = platforms.slice(0, 8).map((p) => {
        const url = p.url || '#';
        const label = p.platform || 'platform';
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="pm-platform-chip">${escapeHtml(label)}</a>`;
      }).join('');

      const exportButtons = this.lastScanId ? this._renderExportButtons() : '';

      rows.push(`
        <div class="pm-scan-card">
          <div class="pm-scan-header">
            <span class="pm-scan-title">Maigret scan results</span>
            ${confidence !== null ? `<span class="pm-confidence">${confidence}% match</span>` : ''}
          </div>
          <div class="pm-platforms">${platformChips}</div>
          ${exportButtons}
        </div>
      `);
    }

    // Brand colors
    if (swatches.length) {
      rows.push(`
        <div class="pm-discovered-row">
          <span class="pm-discovered-label">Brand</span>
          <div style="display:flex;align-items:center;gap:6px;">
            ${swatches.map(c => `<span title="${escapeHtml(c)}" style="background:${escapeHtml(c)}" class="pm-swatch"></span>`).join('')}
            <span style="color:var(--text-muted);font-size:10px;">${swatches.length} color${swatches.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      `);
    }

    // Tone
    if (intel.tone) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Tone</span><span class="pm-chip">${escapeHtml(intel.tone)}</span></div>`);
    }

    // Industry
    if (company.industry) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Industry</span><span class="pm-discovered-value">${escapeHtml(company.industry)}</span></div>`);
    }

    // Pain points
    if (intel.painPoints?.length) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Pain</span><div>${intel.painPoints.slice(0, 3).map(p => `<span class="pm-chip">${escapeHtml(p)}</span>`).join('')}</div></div>`);
    }

    // Products
    if (intel.products?.length) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Products</span><div>${intel.products.slice(0, 3).map(p => `<span class="pm-chip pm-chip-accent">${escapeHtml(p)}</span>`).join('')}</div></div>`);
    }

    // Social links
    const socialLinks = [
      social.github ? { label: 'GitHub', url: social.github } : null,
      social.linkedin ? { label: 'LinkedIn', url: social.linkedin } : null,
      social.twitter ? { label: social.twitter.includes('x.com') ? 'X' : 'Twitter', url: social.twitter } : null,
      social.website ? { label: 'Website', url: social.website } : null,
      website.url ? { label: 'Site', url: website.url } : null,
    ].filter(Boolean);

    if (socialLinks.length) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Links</span><div>${socialLinks.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="pm-link">${escapeHtml(l.label)}</a>`).join(' ')}</div></div>`);
    }

    // Assets
    if (assets.avatar?.[0] || assets.logos?.[0]) {
      const imgs = [
        assets.avatar?.[0] && `<img src="${escapeHtml(assets.avatar[0])}" class="pm-asset-img" />`,
        assets.logos?.[0] && `<img src="${escapeHtml(assets.logos[0])}" class="pm-asset-img" />`,
      ].filter(Boolean).join('');
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Assets</span><div class="pm-assets">${imgs}</div></div>`);
    }

    // Summary
    if (intel.summary) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Summary</span><span class="pm-discovered-value">${escapeHtml(intel.summary)}</span></div>`);
    }

    const discoveredHtml = rows.length
      ? rows.join('')
      : '<div style="font-size:11px;color:var(--text-muted);">No enrichment yet — click Discover to run Maigret, GitHub, and website intelligence.</div>';

    // Tokens
    const tokenEntries = Object.entries(variables).filter(([, v]) => v && typeof v === 'string');
    const tokensHtml = tokenEntries.length
      ? tokenEntries.map(([key, value]) => {
          const label = TOKEN_LABELS[key] || key;
          const preview = String(value).length > 18 ? String(value).slice(0, 16) + '…' : value;
          return `<button type="button" class="pm-token" data-token="${escapeHtml(label)}" aria-label="Insert ${escapeHtml(label)} token into prompt" title="Insert {${escapeHtml(label)}} — current value: ${escapeHtml(value)}"><span>{${escapeHtml(label)}}</span><span class="pm-token-preview">${escapeHtml(preview)}</span></button>`;
        }).join('')
      : '<div style="font-size:10px;color:var(--text-muted);">No tokens yet — discover a contact to populate tokens.</div>';

    return `
      <div class="pm-profile-header">
        <div id="pm-avatar" class="pm-avatar">?</div>
        <div class="pm-profile-meta">
          <div id="pm-name" class="pm-name"></div>
          <div id="pm-company" class="pm-company"></div>
          <div id="pm-pain" class="pm-pain"></div>
        </div>
      </div>

      <div class="pm-section">
        <div class="pm-section-label">Discovered intelligence</div>
        <div id="pm-discovered" class="pm-discovered">${discoveredHtml}</div>
      </div>

      <div class="pm-section">
        <div class="pm-section-header">
          <span class="pm-section-label">Insert into prompt (click a token)</span>
          <div class="pm-actions">
            <button type="button" class="pm-action-btn pm-action-secondary" data-action="auto-timeline" ${this.isGeneratingTimeline ? 'disabled' : ''}>
              ${this.isGeneratingTimeline ? 'Generating…' : '🎬 Auto-generate timeline'}
            </button>
          </div>
        </div>
        <div id="pm-tokens" class="pm-tokens">${tokensHtml}</div>
      </div>
    `;
  }

  _getSelectedContact() {
    const id = getSelectedContactId();
    return id ? _getContact(id) : null;
  }

  _getSelectedProfile() {
    const id = getSelectedContactId();
    return id ? _getProfile(id) : null;
  }

  // ─── Event wiring ────────────────────────────────────────────────────────
  _wireEvents() {
    if (!this.overlay) return;
    const $ = (sel) => this.overlay.querySelector(sel);

    const input = $('#pm-input');
    const discoverBtn = $('#pm-discover');
    if (discoverBtn) discoverBtn.onclick = (e) => { e.stopPropagation(); this._handleDiscover(); };
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          this._handleDiscover();
        }
      };
      input.oninput = (e) => {
        this.multiUsernameInput = e.target.value;
        const count = this._parseUsernames(this.multiUsernameInput).length;
        const countEl = $('#pm-username-count');
        if (countEl) countEl.textContent = `${count} username(s) detected`;
      };
    }

    // Scan mode radio buttons
    this.overlay.querySelectorAll('input[name="pm-scan-mode"]').forEach((r) => {
      r.onchange = (e) => {
        this.scanMode = e.target.value;
        // Reflect mode into advanced options so backend receives correct values
        if (this.scanMode === 'full') {
          this.topSites = 2500;
          this.enableCloudflareBypass = true;
        }
      };
    });

    // Footer buttons
    const footer = this.overlay.querySelector('.modal-footer');
    if (footer) {
      footer.querySelectorAll('[data-personalize-action]').forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const action = btn.dataset.personalizeAction;
          if (action === 'close') this.close();
          if (action === 'apply') this._handleApply();
        };
      });
    }

      // Body actions
      const scope = this.overlay.querySelector('.modal-body');
      if (scope) {
        scope.querySelectorAll('[role="tab"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            if (btn.disabled) return;
            this._forcedTab = btn.dataset.tab;
            this.refreshBody();
            this._announce(`Showing ${btn.dataset.tab} tab`);
          };
          btn.onkeydown = (e) => this._handleTabKeydown(e);
        });

        scope.querySelectorAll('[data-action="toggle-advanced"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this.showAdvanced = !this.showAdvanced;
            this.refreshBody();
          };
        });

        scope.querySelectorAll('[data-action="toggle-settings"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this.showSettings = !this.showSettings;
            if (this.showSettings && !this._settingsLoaded) this._loadSettings();
            this.refreshBody();
          };
        });

        scope.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this.darkMode = !this.darkMode;
            try { localStorage.setItem('remix:pm-dark', this.darkMode ? '1' : '0'); } catch {}
            this.refreshBody();
            this._saveSettings({ dark_mode: this.darkMode });
          };
        });

        scope.querySelectorAll('[data-action="copy-preview"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleCopyPreview();
          };
        });

        scope.querySelectorAll('[data-action="settings-save"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleSaveSettings();
          };
        });

        scope.querySelectorAll('[data-action="settings-reset"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this.userSettings = {
              default_top: 500,
              default_timeout_ms: 15000,
              permute_enabled: false,
              disable_recursion: false,
              check_domains: false,
              proxy: '',
              tor_proxy: 'socks5://127.0.0.1:9050',
              i2p_proxy: 'http://127.0.0.1:4444',
              dark_mode: this.darkMode,
            };
            this.topSites = 500;
            this.timeoutSec = 15;
            this.refreshBody();
            this._saveSettings(this.userSettings);
          };
        });

        scope.querySelectorAll('[data-action="history-view"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._loadScanById(btn.dataset.scanId);
          };
        });

        scope.querySelectorAll('[data-action="clear-contact"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._clearContact();
          };
        });

        scope.querySelectorAll('[data-action="auto-timeline"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleAutoTimeline();
          };
        });

        scope.querySelectorAll('.pm-token').forEach((chip) => {
          chip.onclick = (e) => {
            e.stopPropagation();
            const token = chip.dataset.token;
            const ta = this.getTextarea?.();
            if (ta) {
              insertTokenAtCursor(ta, `{{${token}}}`);
              this._announce(`Inserted ${token} token into prompt`);
            } else {
              this.errorMessage = 'No prompt textarea available in this studio.';
              this.refreshBody();
            }
          };
        });
      }
    }

  _clearContact() {
    setSelectedContactId(null);
    this.selectedContactId = null;
    this.errorMessage = '';
    this._refreshContactsList();
    this._refreshProfileSummary();
    window.dispatchEvent(new CustomEvent('remix:contact-changed', { detail: { contactId: null } }));
  }

  _readAdvancedOptions() {
    const get = (id, fallback) => {
      const el = this.overlay?.querySelector(`#${id}`);
      if (!el) return fallback;
      if (el.type === 'checkbox') return el.checked;
      return el.value.trim();
    };
    this.topSites = Math.min(2500, Math.max(1, parseInt(get('pm-opt-top', '500'), 10) || 500));
    this.timeoutSec = Math.min(60, Math.max(5, parseInt(get('pm-opt-timeout', '15'), 10) || 15));
    this.tags = get('pm-opt-tags', '');
    this.keywords = get('pm-opt-keywords', '');
    this.proxy = get('pm-opt-proxy', '');
    this.torProxy = get('pm-opt-tor', '');
    this.i2pProxy = get('pm-opt-i2p', '');
    this.parseUrl = get('pm-opt-parse', '');
    this.allSites = get('pm-opt-all-sites', false);
    this.enableCloudflareBypass = get('pm-opt-cloudflare', false);
    this.permute = get('pm-opt-permute', false);
    this.checkDomains = get('pm-opt-domains', false);
    this.disableRecursion = get('pm-opt-recursion', false);
    this.useCookies = get('pm-opt-cookies', false);
    const retriesRaw = get('pm-opt-retries', '1');
    this.retries = Math.min(5, Math.max(0, parseInt(retriesRaw, 10) || 1));
  }

  _refreshContactsList() {
    if (!this.overlay) return;
    const list = this.overlay.querySelector('#pm-contacts-list');
    if (!list) return;
    list.innerHTML = '';
    try {
      const contacts = _listContacts();
      if (contacts.length === 0) {
        list.innerHTML = '<div class="pm-empty">No contacts yet — paste a username above and click Discover.</div>';
        return;
      }
      contacts.slice(0, 8).forEach((c) => {
        const row = document.createElement('button');
        row.className = 'pm-contact-row' + (c.id === this.selectedContactId ? ' active' : '');
        row.innerHTML = `
          <div class="pm-contact-avatar">${(c.name || '?')[0]?.toUpperCase()}</div>
          <div class="pm-contact-meta">
            <div class="pm-contact-name">${escapeHtml(c.name)}</div>
            <div class="pm-contact-sub">${escapeHtml(c.email || c.company || '')}</div>
          </div>
        `;
        row.onclick = () => this._setSelectedContact(c.id);
        list.appendChild(row);
      });
    } catch {}
  }

  _refreshProfileSummary() {
    if (!this.overlay) return;
    const summary = this.overlay.querySelector('#pm-profile-summary');
    const applyBtn = this.overlay.querySelector('[data-personalize-action="apply"]');
    if (!summary) return;

    if (!this.selectedContactId) {
      summary.classList.add('hidden');
      summary.innerHTML = '';
      if (applyBtn) applyBtn.disabled = true;
      return;
    }

    const contact = _getContact(this.selectedContactId);
    const profile = _getProfile(this.selectedContactId);

    if (contact) {
      summary.classList.remove('hidden');
      const avatarEl = this.overlay.querySelector('#pm-avatar');
      const nameEl = this.overlay.querySelector('#pm-name');
      const companyEl = this.overlay.querySelector('#pm-company');
      const painEl = this.overlay.querySelector('#pm-pain');

      if (avatarEl) {
        if (contact.avatarUrl) {
          avatarEl.innerHTML = `<img src="${escapeHtml(contact.avatarUrl)}" alt="" />`;
        } else {
          avatarEl.textContent = (contact.name || '?')[0]?.toUpperCase();
        }
      }
      if (nameEl) nameEl.textContent = contact.name;
      if (companyEl) companyEl.textContent = contact.company || contact.email || '';

      const pp = profile?.intelligence?.painPoints?.[0] || profile?.intelligence?.summary || '';
      if (painEl) painEl.textContent = pp ? `Pain point: ${pp}` : (profile?.intelligence?.summary || '');

      const content = this._renderProfileContent();
      summary.innerHTML = content;
      if (applyBtn) applyBtn.disabled = false;

      // Re-bind token clicks and actions inside the refreshed content
      this._bindProfileActions();
    } else {
      summary.classList.add('hidden');
      summary.innerHTML = '';
      if (applyBtn) applyBtn.disabled = true;
    }
  }

  _bindProfileActions() {
    if (!this.overlay) return;
    const scope = this.overlay.querySelector('.modal-body');
    if (!scope) return;

    scope.querySelectorAll('.pm-token').forEach((chip) => {
      chip.onclick = (e) => {
        e.stopPropagation();
        const token = chip.dataset.token;
        const ta = this.getTextarea?.();
        if (ta) {
          insertTokenAtCursor(ta, `{{${token}}}`);
          this._announce(`Inserted ${token} token into prompt`);
        } else {
          this.errorMessage = 'No prompt textarea available in this studio.';
          this.refreshBody();
        }
      };
    });

    scope.querySelectorAll('[data-action="auto-timeline"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this._handleAutoTimeline();
      };
    });

    scope.querySelectorAll('[data-action="clear-contact"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this._clearContact();
      };
    });

    scope.querySelectorAll('[data-export]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this._handleExport(btn.dataset.export, btn.dataset.scanId);
      };
    });

    scope.querySelectorAll('[data-action="run-analysis"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this._handleAnalysis();
      };
    });
  }

  async _loadSettings() {
    try {
      const session = await getSession();
      if (!session) {
        // Fall back to localStorage
        try {
          const raw = localStorage.getItem('remix:pm-settings');
          if (raw) this.userSettings = { ...this.userSettings, ...JSON.parse(raw) };
        } catch {}
        try {
          const dark = localStorage.getItem('remix:pm-dark');
          if (dark !== null) this.darkMode = dark === '1';
        } catch {}
        this._settingsLoaded = true;
        return;
      }
      const res = await fetch('/api/personalizer/settings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.settings) {
        this.userSettings = { ...this.userSettings, ...data.settings };
        this.topSites = this.userSettings.default_top || 500;
        this.timeoutSec = Math.round((this.userSettings.default_timeout_ms || 15000) / 1000);
        this.darkMode = this.userSettings.dark_mode !== false;
        // Mirror into localStorage as fallback
        try { localStorage.setItem('remix:pm-settings', JSON.stringify(this.userSettings)); } catch {}
        try { localStorage.setItem('remix:pm-dark', this.darkMode ? '1' : '0'); } catch {}
      }
    } catch (err) {
      console.warn('[PersonalizeModal] Failed to load settings:', err);
    } finally {
      this._settingsLoaded = true;
    }
  }

  async _saveSettings(partial = {}) {
    const next = { ...this.userSettings, ...partial };
    // Always cache locally
    try { localStorage.setItem('remix:pm-settings', JSON.stringify(next)); } catch {}
    try {
      const session = await getSession();
      if (!session) return;
      await fetch('/api/personalizer/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ settings: next }),
      });
    } catch (err) {
      console.warn('[PersonalizeModal] Failed to save settings:', err);
    }
  }

  async _handleSaveSettings() {
    if (!this.overlay) return;
    const get = (id, fallback) => {
      const el = this.overlay.querySelector(`#${id}`);
      if (!el) return fallback;
      if (el.type === 'checkbox') return el.checked;
      return el.value.trim();
    };
    const top = Math.min(2500, Math.max(1, parseInt(get('pm-set-top', '500'), 10) || 500));
    const timeoutMs = Math.min(60000, Math.max(5000, parseInt(get('pm-set-timeout', '15'), 10) * 1000 || 15000));
    const permute_enabled = get('pm-set-permute', false);
    const disable_recursion = get('pm-set-norecursion', false);
    const disableInfoExtraction = get('pm-set-noparse', false);
    const check_domains = get('pm-set-domains', false);
    const proxy = get('pm-set-proxy', '');
    const tor_proxy = get('pm-set-tor', '');
    const i2p_proxy = get('pm-set-i2p', '');

    this.topSites = top;
    this.timeoutSec = Math.round(timeoutMs / 1000);
    this.permute = permute_enabled;
    this.disableRecursion = disable_recursion;
    this.disableInfoExtraction = disableInfoExtraction;
    this.checkDomains = check_domains;
    this.proxy = proxy;
    this.torProxy = tor_proxy;
    this.i2pProxy = i2p_proxy;

    this.userSettings = {
      ...this.userSettings,
      default_top: top,
      default_timeout_ms: timeoutMs,
      permute_enabled,
      disable_recursion,
      check_domains,
      proxy,
      tor_proxy,
      i2p_proxy,
      dark_mode: this.darkMode,
    };

    this.discoveryStatus = '✓ Settings saved';
    await this._saveSettings(this.userSettings);
    this.refreshBody();
  }

  async _loadHistory() {
    try {
      const session = await getSession();
      if (!session) return;
      const res = await fetch('/api/personalizer/scans?limit=20', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      this.scanHistory = Array.isArray(data?.data) ? data.data : [];
      if (this.showHistory || this._activeTab() === 'history') this.refreshBody();
    } catch (err) {
      console.warn('[PersonalizeModal] Failed to load history:', err);
    }
  }

  async _loadScanById(scanId) {
    if (!scanId) return;
    try {
      const session = await getSession();
      if (!session) {
        this.errorMessage = 'Sign in to view scans.';
        this.refreshBody();
        return;
      }
      // Fetch as JSON export to read scan data
      const res = await fetch(`/api/personalizer/export/${encodeURIComponent(scanId)}?format=json`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Failed to load scan (${res.status})`);
      const scanData = await res.json();
      this.lastScanId = scanId;
      this.lastScanData = {
        ...scanData,
        targetName: scanData.targetName,
        sitesChecked: scanData.platforms?.length ?? 0,
        sitesFound: scanData.platforms?.length ?? 0,
        confidence: scanData.confidence || 0,
        platforms: scanData.platforms || [],
        graph: scanData.graph || null,
        warnings: scanData.warnings || [],
      };
      this._forcedTab = 'results';
      this.refreshBody();
    } catch (err) {
      this.errorMessage = err.message || 'Failed to load scan';
      this.refreshBody();
    }
  }

  async _handleExport(format, scanId) {
    if (!format || !scanId) return;
    try {
      const session = await getSession();
      if (!session) {
        this.errorMessage = 'Sign in to export reports.';
        this.refreshBody();
        return;
      }
      const res = await fetch(`/api/personalizer/export/${encodeURIComponent(scanId)}?format=${encodeURIComponent(format)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maigret-${scanId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      this.errorMessage = err.message || 'Export failed';
      this.refreshBody();
    }
  }

  _setSelectedContact(contactId) {
    this.selectedContactId = contactId || null;
    setSelectedContactId(contactId || null);
    this._refreshContactsList();
    this._refreshProfileSummary();
    window.dispatchEvent(new CustomEvent('remix:contact-changed', { detail: { contactId } }));
  }

  // ─── Discover flow ───────────────────────────────────────────────────────
  async _handleDiscover() {
    const input = this.overlay.querySelector('#pm-input');
    const btn = this.overlay.querySelector('#pm-discover');
    const raw = input?.value?.trim() || this.multiUsernameInput;
    const value = raw?.trim();
    this.errorMessage = '';

    if (!value) {
      this.errorMessage = 'Enter a username, email, or website URL';
      this.refreshBody();
      return;
    }

    this.multiUsernameInput = raw;
    const usernames = this._parseUsernames(value);
    if (usernames.length === 0) {
      this.errorMessage = 'Enter at least one valid username';
      this.refreshBody();
      return;
    }

    this.isDiscovering = true;
    this.discoveryStep = 0;
    this.discoveryStatus = DISCOVERY_STEPS[0];
    this.lastScanId = null;
    this.lastScanData = null;
    this.refreshBody();

    const session = await getSession();
    let scanData = null;
    const primaryUsername = usernames[0];

    try {
      // 1) Maigret scan via /api/personalizer/scan (multi-username)
      this.discoveryStep = 0;
      this.discoveryStatus = DISCOVERY_STEPS[0];
      this.refreshBody();
      this._readAdvancedOptions();
      try {
        if (session) {
          // Apply scan mode: full = 2500 sites + CF bypass
          const isFull = this.scanMode === 'full';
          const top = isFull ? 2500 : (this.allSites ? 2500 : this.topSites);
          const enableCF = isFull || this.enableCloudflareBypass;
          const res = await fetch('/api/personalizer/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              targetName: usernames.length === 1 ? usernames[0] : usernames.join(', '),
              targetNames: usernames.length > 1 ? usernames : undefined,
              options: {
                top,
                isParsingEnabled: !this.disableInfoExtraction,
                timeoutMs: this.timeoutSec * 1000,
                tags: this.tags || undefined,
                keywords: this.keywords || undefined,
                proxy: this.proxy || undefined,
                torProxy: this.torProxy || undefined,
                i2pProxy: this.i2pProxy || undefined,
                retries: this.retries,
                noRecursion: this.disableRecursion,
                disableRecursive: this.disableRecursion,
                permute: this.permute || this.userSettings.permute_enabled,
                enablePermutations: this.permute || this.userSettings.permute_enabled,
                checkDomains: this.checkDomains || this.userSettings.check_domains,
                withDomains: this.checkDomains || this.userSettings.check_domains,
                parseUrl: this.parseUrl || undefined,
                enableCloudflareBypass: enableCF,
                useCache: true,
              },
            }),
          });
          const data = await res.json();
          if (res.ok) {
            scanData = data.scanData || data;
            this.lastScanId = data.scanId || null;
          }
        }
      } catch (err) {
        console.warn('[PersonalizeModal] Maigret scan failed:', err);
      }

      // 2) GitHub lookup
      this.discoveryStep = 1;
      this.discoveryStatus = DISCOVERY_STEPS[1];
      this.refreshBody();
      try {
        const ghUsername = this._extractGitHubUsername(primaryUsername);
        if (ghUsername) {
          const ghRes = await fetch(`https://api.github.com/users/${encodeURIComponent(ghUsername)}`, {
            headers: { 'User-Agent': 'remix-new-editor-personalizer' },
          });
          if (ghRes.ok) {
            const user = await ghRes.json();
            if (!scanData) scanData = { platforms: [], summary: '', confidence: 0 };
            scanData.platforms = scanData.platforms || [];
            const existingGh = scanData.platforms.findIndex(p => p.platform === 'github');
            const ghEntry = {
              platform: 'github',
              url: user.html_url,
              username: user.login,
              status: 'found',
              ids_data: { bio: user.bio, company: user.company, location: user.location, avatar_url: user.avatar_url },
            };
            if (existingGh >= 0) scanData.platforms[existingGh] = ghEntry;
            else scanData.platforms.push(ghEntry);
            if (user.bio && !scanData.summary) scanData.summary = user.bio;
          }
        }
      } catch (err) {
        console.warn('[PersonalizeModal] GitHub lookup failed:', err);
      }

      // 3) Website crawl
      this.discoveryStep = 2;
      this.discoveryStatus = DISCOVERY_STEPS[2];
      this.refreshBody();
      try {
        const websiteUrl = this._guessWebsiteUrl(primaryUsername);
        if (websiteUrl) {
          const webRes = await fetch(websiteUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; remix-new-editor/1.0)' } });
          if (webRes.ok) {
            const html = await webRes.text();
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
            if (!scanData) scanData = { platforms: [], summary: '', confidence: 0 };
            scanData.website = { url: websiteUrl, title: titleMatch?.[1]?.trim(), description: descMatch?.[1]?.trim() };
          }
        }
      } catch (err) {
        console.warn('[PersonalizeModal] Website crawl failed:', err);
      }

      // 4) OpenAI enrichment
      this.discoveryStep = 3;
      this.discoveryStatus = DISCOVERY_STEPS[3];
      this.refreshBody();
      let intelligence = {};
      if (session) {
        try {
          const enrichRes = await fetch('/api/personalizer/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              appId: this.appId,
              mode: 'lead-summary',
              targetName: primaryUsername,
              targetCompany: scanData?.platforms?.[0]?.ids_data?.company,
              manualNotes: '',
              scanResults: scanData,
            }),
          });
          if (enrichRes.ok) {
            const data = await enrichRes.json();
            intelligence = data.output?.metadata || {};
          }
        } catch (err) {
          console.warn('[PersonalizeModal] OpenAI enrichment failed:', err);
        }
      }

      // 5) Persist contact + profile
      this.discoveryStep = 4;
      this.discoveryStatus = DISCOVERY_STEPS[4];
      this.refreshBody();

      const name = this._guessName(scanData, primaryUsername);
      const contactId = (crypto.randomUUID && crypto.randomUUID()) || `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const firstName = name.split(' ')[0] || name;
      const lastName = name.split(' ').slice(1).join(' ');

      const contact = {
        id: contactId,
        userId: 'local-user',
        name,
        firstName,
        lastName,
        company: scanData?.platforms?.[0]?.ids_data?.company || scanData?.website?.title || '',
        title: '',
        location: scanData?.platforms?.[0]?.ids_data?.location || '',
        avatarUrl: scanData?.platforms?.[0]?.ids_data?.avatar_url || '',
        source: 'github',
        sourceId: scanData?.platforms?.find(p => p.platform === 'github')?.username || primaryUsername,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Stash the latest scan data so the results panel can render
      this.lastScanData = {
        ...(scanData || {}),
        targetName: usernames.length === 1 ? usernames[0] : usernames.join(', '),
        usernames,
        sitesChecked: scanData?.top ?? scanData?.sitesChecked ?? 0,
        sitesFound: scanData?.platforms?.length ?? scanData?.sitesFound ?? 0,
        confidence: scanData?.confidence ?? 0,
        duration: scanData?.duration ?? null,
        graph: scanData?.graph || null,
        platforms: scanData?.platforms || [],
        warnings: scanData?.warnings || [],
      };

      const variables = {
        firstName, lastName, fullName: name,
        company: contact.company,
        email: value.includes('@') ? value : '',
        industry: intelligence.industry || '',
        painPoint: intelligence.painPoints?.[0] || '',
        product: intelligence.products?.[0] || '',
        service: intelligence.services?.[0] || '',
        tone: intelligence.tone || 'professional',
        avatarUrl: contact.avatarUrl,
      };

      const profile = {
        id: contactId,
        contact: { name, firstName, lastName, email: contact.email, company: contact.company, location: contact.location, avatarUrl: contact.avatarUrl },
        company: { name: contact.company, industry: intelligence.industry },
        brand: { colors: intelligence.brandColors || {} },
        social: {
          github: scanData?.platforms?.find(p => p.platform === 'github')?.url,
          website: scanData?.website?.url,
        },
        website: scanData?.website || {},
        assets: { avatar: contact.avatarUrl ? [contact.avatarUrl] : [] },
        intelligence: {
          summary: scanData?.summary || intelligence.summary,
          painPoints: intelligence.painPoints,
          products: intelligence.products,
          services: intelligence.services,
          tone: intelligence.tone,
        },
        campaign: {},
        history: { discoveries: [{ source: 'personalize-modal', timestamp: new Date().toISOString(), success: true, data: scanData }], generations: [], interactions: [] },
        variables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const contacts = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
      contacts.unshift(contact);
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
      const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]');
      profiles.unshift(profile);
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));

      this._setSelectedContact(contactId);
      this.discoveryStatus = `✓ Discovered ${contact.name}${contact.company ? ` at ${contact.company}` : ''}`;
      this.isDiscovering = false;
      this.discoveryStep = DISCOVERY_STEPS.length;
      this.refreshBody();
      setTimeout(() => {
        const statusEl = this.overlay?.querySelector('.pm-progress');
        if (statusEl) statusEl.style.display = 'none';
      }, 2500);
    } catch (err) {
      this.errorMessage = err.message || 'Discovery failed';
      this.isDiscovering = false;
      this.refreshBody();
    } finally {
      this.isDiscovering = false;
      const statusEl = this.overlay?.querySelector('.pm-progress');
      if (statusEl) statusEl.style.display = 'none';
    }
  }

  _handleApply() {
    const id = getSelectedContactId();
    const profile = id ? _getProfile(id) : null;
    if (profile) {
      const ta = this.getTextarea?.();
      if (ta) {
        ta.value = replaceTokensInPrompt(ta.value, profile);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      this.onApply({ contactId: id, profile });
    }
    this.close();
  }

  async _handleAutoTimeline() {
    const id = getSelectedContactId();
    const profile = id ? _getProfile(id) : null;
    if (!profile) {
      this.errorMessage = 'Select a contact first.';
      this.refreshBody();
      return;
    }

    this.isGeneratingTimeline = true;
    this.refreshBody();

    try {
      const session = await getSession();
      if (!session) {
        this.errorMessage = 'Sign in to generate a timeline.';
        this.isGeneratingTimeline = false;
        this.refreshBody();
        return;
      }

      const res = await fetch(`/api/intelligence/auto-timeline/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Timeline generation failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      const scenes = data.scenes || [];

      if (!scenes.length) {
        this.errorMessage = 'No timeline scenes generated. Add more intelligence to the contact first.';
      } else {
        // Dispatch event so TimelineEditorPage can pick it up
        window.dispatchEvent(new CustomEvent('remix:auto-timeline', { detail: { contactId: id, scenes } }));
        this.discoveryStatus = `✓ Generated ${scenes.length} timeline scenes`;
      }
    } catch (err) {
      this.errorMessage = err.message || 'Timeline generation failed';
    } finally {
      this.isGeneratingTimeline = false;
      this.refreshBody();
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  _extractGitHubUsername(value) {
    if (!value) return null;
    const trimmed = value.trim().replace(/^@/, '');
    if (trimmed.includes('@')) return trimmed.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
    if (trimmed.includes('github.com')) {
      const parts = trimmed.split('/').filter(Boolean);
      return parts[parts.length - 1] || null;
    }
    return trimmed.split(/\s+/)[0].replace(/[^a-zA-Z0-9_-]/g, '') || null;
  }

  _guessWebsiteUrl(value) {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed.startsWith('http')) return trimmed;
    if (trimmed.includes('@')) {
      const domain = trimmed.split('@')[1].split('/')[0];
      return domain ? `https://${domain}` : null;
    }
    const candidate = trimmed.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    if (candidate.length > 3) return `https://${candidate}.com`;
    return null;
  }

  _guessName(scanData, value) {
    if (!scanData?.platforms?.length) {
      if (value.includes('@')) return value.split('@')[0].replace(/[^a-zA-Z0-9 ]/g, '').trim() || value;
      return value.replace(/[^a-zA-Z0-9 ]/g, '').trim() || value;
    }
    const first = scanData.platforms.find(p => p.ids_data?.name)?.ids_data?.name;
    if (first) return first;
    const bioName = scanData.platforms.find(p => p.ids_data?.bio)?.ids_data?.bio;
    if (bioName) return bioName.split(' ').slice(0, 2).join(' ');
    return value.replace(/[^a-zA-Z0-9 ]/g, '').trim() || value;
  }

  _announce(message) {
    const live = this.overlay?.querySelector('#pm-live');
    if (live) live.textContent = message;
  }

  _handleTabKeydown(e) {
    const tabs = Array.from(this.overlay.querySelectorAll('[role="tab"]')).filter((t) => !t.disabled);
    const idx = tabs.indexOf(document.activeElement);
    if (idx === -1) return;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(idx + 1) % tabs.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(idx - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) {
      e.preventDefault();
      this._forcedTab = next.dataset.tab;
      this.refreshBody();
      this.overlay.querySelector(`#pm-tab-${next.dataset.tab}`)?.focus();
      this._announce(`Showing ${next.dataset.tab} tab`);
    }
  }

  async _handleCopyPreview() {
    const ta = typeof this.getTextarea === 'function' ? this.getTextarea() : null;
    const raw = ta && ta.value ? ta.value : '';
    if (!raw) return;
    const contactId = getSelectedContactId();
    const profile = contactId ? _getProfile(contactId) : null;
    const text = profile ? replaceTokensInPrompt(raw, profile) : raw;
    try {
      await navigator.clipboard.writeText(text);
      this._announce(profile ? 'Copied personalized prompt to clipboard' : 'Copied prompt to clipboard');
    } catch {
      this._announce('Copy failed — select the text manually');
    }
  }

  refreshBody() {
    if (!this.overlay) return;
    const body = this.overlay.querySelector('.modal-body');
    if (body) body.innerHTML = this.renderBody();
    this._wireEvents();
  }
}

export default PersonalizeModal;
