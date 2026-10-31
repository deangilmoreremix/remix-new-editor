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
  inspectPromptTokens,
  getSelectedContactId,
  setSelectedContactId,
} from '../personalize/personalizePopover.js';
import { TOKEN_LABELS, buildVariables } from '../personalize/tokenSchema.js';
import { normalizeSocialIdentities, buildLegacySocialMap } from '../../lib/socialIdentity.js';
import { createPersonalizerHandoff, savePersonalizerHandoff } from '../../lib/personalizerHandoff.js';
import { navigate } from '../../lib/router.js';
import {
  addPersonalizationAsset,
  createPersonalizationAsset,
  ensurePersonalizationProfile,
  getAllPersonalizationAssets,
  normalizeBusinessProfile,
  movePersonalizationAsset,
  removePersonalizationAsset,
  setDiscoveredPersonalizationAssets,
  setPersonalizationGenerationOptions,
  updatePersonalizationAsset,
  updatePersonalizationBusiness,
} from '../../lib/personalization/personalizationProfile.js';
import {
  defaultRoleForDiscoveredCategory,
  discoverBusinessAssets,
  importDiscoveredAsset,
  persistPersonalizationAssetVersion,
} from '../../lib/personalization/assetDiscoveryService.js';
import { analyzePersonalizationImages } from '../../lib/personalization/visionService.js';
import {
  BUSINESS_DISCOVERY_NICHES,
  findBusinesses,
  researchBusiness,
} from '../../lib/personalization/businessDiscoveryService.js';
import { renderPersonalizationImageEditorPanel } from '../../lib/personalization/imageEditorPanel.js';
import { PersonalizationImageEditorController } from '../../lib/personalization/imageEditorController.js';
import { makePersonalizationAssetVideoReady } from '../../lib/personalization/videoReady.js';
import { buildPersonalizationContext } from '../../lib/personalization/studioContext.js';

const CONTACTS_KEY = 'remix_contacts';
const PROFILES_KEY = 'remix_contact_profiles';
const IMPORTED_IMAGE_ROLE_OPTIONS = Object.freeze([
  ['presenter_identity', 'Person / Presenter'],
  ['face_identity', 'Face Identity'],
  ['character_identity', 'Character Identity'],
  ['logo', 'Logo'],
  ['product_reference', 'Product / Service'],
  ['brand_reference', 'Brand Reference'],
  ['background_reference', 'Background Reference'],
  ['saved_reference', 'Saved Reference'],
  ['first_frame', 'First Frame'],
  ['last_frame', 'Last Frame'],
  ['cta_graphic', 'CTA Graphic'],
]);


const DISCOVERY_STEPS = [
  'Scanning public profiles...',
  'Looking up GitHub...',
  'Crawling website...',
  'Extracting intelligence...',
  'Finalizing profile...',
];

function _safeUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(lower)) {
    if (!['http://', 'https://', 'mailto:', 'tel:'].some(p => lower.startsWith(p))) return null;
  }
  return trimmed;
}

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
    const { supabase } = await import('../../lib/supabase.js');
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string') return `rgba(217, 255, 0, ${alpha})`;
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return `rgba(217, 255, 0, ${alpha})`;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class PersonalizeModal extends BaseModal {
  constructor(options = {}) {
    const supportsHandoff = !!(options.studioId && (options.getAsset || options.getPersonalizableFields));
    const footerContent = supportsHandoff
      ? `
        <button class="modal-btn modal-btn-secondary" data-personalize-action="close">Close</button>
        <button class="modal-btn modal-btn-primary" data-personalize-action="apply" disabled>Apply personalization</button>
        <button class="modal-btn modal-btn-primary" data-personalize-action="send-to-personalizer" style="margin-left:8px;">Open in Personalizer</button>
      `
      : `
        <button class="modal-btn modal-btn-secondary" data-personalize-action="close">Close</button>
        <button class="modal-btn modal-btn-primary" data-personalize-action="apply" disabled>Apply personalization</button>
      `;

    super({
      title: '<span aria-hidden="true">🎯</span> Personalize for a contact',
      size: 'large',
      showFooter: true,
      footerContent,
      closable: true,
      ...options,
    });

    this.appId = options.appId || 'ai-video-agency';
    this.getTextarea = options.getTextarea || (() => null);
    this.onApply = options.onApply || (() => {});
    this.onClear = options.onClear || (() => {});
    this.appTheme = options.appTheme || 'cinema-template-studio';
    this.appColors = this._resolveAppColors(this.appTheme);

    // Handoff / advanced personalizer options
    this.studioId = options.studioId || '';
    this.studioName = options.studioName || '';
    this.returnRoute = options.returnRoute || '';
    this.getAsset = options.getAsset || (() => null);
    this.getProject = options.getProject || (() => null);
    this.getPersonalizableFields = options.getPersonalizableFields || (() => null);
    this.getPreview = options.getPreview || (() => null);
    this.onSendToPersonalizer = options.onSendToPersonalizer || (() => {});

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

    // Unified SmartVideo AI business/client + asset personalization state.
    // The durable source of truth remains the selected profile; these fields
    // only hold unsaved form state while the modal is open.
    this.businessDraft = null;
    this.businessSaveStatus = '';
    this.businessSearchResults = [];
    this.businessSearchStatus = '';
    this.businessSearchError = '';
    this.isSearchingBusinesses = false;
    this.isResearchingBusiness = false;
    this.businessSearchNiche = 'general-business';
    this.businessSearchRadius = 15;
    this.assetEditorAssetId = null;
    this.imageEditorSession = null;
    this.imageEditorController = new PersonalizationImageEditorController({
      onChange: (session, { render = true } = {}) => {
        this.imageEditorSession = session;
        if (render) this.refreshBody();
        else this._updateEditorBusyLabel();
      },
      onPreview: (dataUrl) => {
        const preview = this.overlay?.querySelector('[data-editor-preview]');
        if (preview && dataUrl) preview.src = dataUrl;
      },
    });
    this.isDiscoveringBusinessAssets = false;
    this.isAnalyzingBusinessAssets = false;
    this.isBatchVideoReady = false;
    this.isImportingBusinessAssets = false;
    this.assetDiscoveryStatus = '';
    this.assetDiscoveryError = '';
  }

  _resolveAppColors(theme) {
    try {
      const scheme = openaiConfig.getStudioColorScheme(theme);
      if (scheme && scheme.primary) return scheme;
    } catch {}
    return { primary: '#d9ff00', accent: '#c4e600', secondary: '#a1a1aa', onPrimary: '#000000' };
  }

  _activeTab() {
    if (this._forcedTab) return this._forcedTab;
    return this.lastScanData ? 'results' : 'discover';
  }

  open() {
    super.open();
    // Link the dialog to its descriptive subtitle for screen readers.
    // `this.overlay` IS the .modal-overlay element (BaseModal builds it as the
    // root node), so querySelector('.modal-overlay') would search descendants
    // only and always return null — set the attribute on the overlay directly.
    if (this.overlay) this.overlay.setAttribute('aria-describedby', 'pm-subtitle');
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

  handleKeyDown(e) {
    if (e.key === 'Escape' && this.imageEditorController?.session) {
      e.preventDefault();
      e.stopPropagation();
      this._closeAssetEditor();
      return;
    }
    super.handleKeyDown(e);
  }

  setBodyContent(html) {
    super.setBodyContent(html);
    this._wireEvents();
  }

  renderBody() {
    const primary = this.appColors.primary || '#d9ff00';
    const accent = this.appColors.accent || '#c4e600';
    const soft = hexToRgba(primary, 0.12);
    const softAccent = hexToRgba(accent, 0.12);
    const activeTab = this._activeTab();

    const tabAria = (tab) => {
      const selected = activeTab === tab ? 'true' : 'false';
      const tabIndex = activeTab === tab ? '0' : '-1';
      return `role="tab" id="pm-tab-${tab}" aria-selected="${selected}" aria-controls="pm-panel-${tab}" tabindex="${tabIndex}"`;
    };

    return `
      <div class="pm-modal ${this.darkMode ? 'pm-dark' : 'pm-light'}" data-theme="${this.darkMode ? 'dark' : 'light'}" style="--pm-primary: ${primary}; --pm-accent: ${accent}; --pm-on-primary: ${this.appColors.onPrimary || '#000000'}; --pm-soft: ${soft}; --pm-soft-accent: ${softAccent}; --pm-glow: ${hexToRgba(primary, 0.25)}; --app-primary: ${primary}; --app-accent: ${accent}; --app-on-primary: ${this.appColors.onPrimary || '#000000'}; --app-soft: ${soft}; --app-soft-accent: ${softAccent}; --app-glow: ${hexToRgba(primary, 0.25)};">
        <p id="pm-subtitle" class="pm-subtitle">Discover people and businesses, organize brand assets, edit media, and apply SmartVideo AI personalization without leaving your creation workflow.</p>

        <div class="pm-sr-only" role="status" aria-live="polite" id="pm-live"></div>

        ${this.errorMessage ? `<div class="pm-error" role="alert">⚠ ${escapeHtml(this.errorMessage)}</div>` : ''}

        <div class="pm-tabs" role="tablist" aria-label="Personalization sections">
          <button type="button" class="pm-tab ${activeTab === 'discover' ? 'pm-tab-active' : ''}" data-tab="discover" ${tabAria('discover')}>Discover</button>
          <button type="button" class="pm-tab ${activeTab === 'results' ? 'pm-tab-active' : ''}" data-tab="results" ${!this.lastScanData ? 'disabled' : ''} ${tabAria('results')}>Results</button>
          <button type="button" class="pm-tab ${activeTab === 'business' ? 'pm-tab-active' : ''}" data-tab="business" ${tabAria('business')}>Business / Client</button>
          <button type="button" class="pm-tab ${activeTab === 'assets' ? 'pm-tab-active' : ''}" data-tab="assets" ${tabAria('assets')}>Assets</button>
          <button type="button" class="pm-tab ${activeTab === 'history' ? 'pm-tab-active' : ''}" data-tab="history" ${tabAria('history')}>History</button>
        </div>

        <div class="pm-tab-panels">
          <div class="pm-tab-panel ${activeTab === 'discover' ? 'pm-tab-panel-active' : ''}" data-panel="discover" role="tabpanel" id="pm-panel-discover" aria-labelledby="pm-tab-discover" tabindex="0">
            ${this._renderDiscoverTab()}
          </div>
          <div class="pm-tab-panel ${activeTab === 'results' ? 'pm-tab-panel-active' : ''}" data-panel="results" role="tabpanel" id="pm-panel-results" aria-labelledby="pm-tab-results" tabindex="0">
            ${this.lastScanData ? this._renderResults() : '<div class="pm-empty">Run a discovery to see results here.</div>'}
          </div>
          <div class="pm-tab-panel ${activeTab === 'business' ? 'pm-tab-panel-active' : ''}" data-panel="business" role="tabpanel" id="pm-panel-business" aria-labelledby="pm-tab-business" tabindex="0">
            ${this._renderBusinessTab()}
          </div>
          <div class="pm-tab-panel ${activeTab === 'assets' ? 'pm-tab-panel-active' : ''}" data-panel="assets" role="tabpanel" id="pm-panel-assets" aria-labelledby="pm-tab-assets" tabindex="0">
            ${this._renderAssetsTab()}
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
          --pm-on-primary: ${this.appColors.onPrimary || '#000000'};
          --pm-soft: ${soft};
          --pm-soft-accent: ${softAccent};
          --pm-glow: ${hexToRgba(primary, 0.25)};
          --app-primary: ${primary};
          --app-accent: ${accent};
          --app-on-primary: ${this.appColors.onPrimary || '#000000'};
          --app-soft: ${soft};
          --app-soft-accent: ${softAccent};
          --app-glow: ${hexToRgba(primary, 0.25)};
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

        /* Partial resolution: some tokens still unresolved. */
        .pm-preview-pill-warn {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border-color: rgba(245, 158, 11, 0.45);
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
          color: var(--pm-on-primary, #000000);
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
          color: var(--pm-on-primary, #000000);
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
          color: var(--pm-on-primary, #000000);
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
          color: var(--pm-on-primary, #000000);
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

        /* Unified business/client profile */
        .pm-audience-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .pm-audience-card {
          appearance: none;
          text-align: left;
          border: 1px solid var(--border-color);
          background: var(--bg-panel);
          color: var(--text-primary);
          border-radius: var(--border-radius-lg);
          padding: 12px;
          cursor: pointer;
          font-family: var(--font-family);
          transition: all var(--transition-fast);
        }

        .pm-audience-card:hover,
        .pm-audience-card.active {
          border-color: var(--pm-primary);
          background: var(--pm-soft);
        }

        .pm-audience-title { font-size: 13px; font-weight: 700; }
        .pm-audience-copy { margin-top: 4px; font-size: 11px; line-height: 1.4; color: var(--text-muted); }

        .pm-business-search-grid {
          display: grid;
          grid-template-columns: minmax(150px, .9fr) minmax(220px, 1.4fr) minmax(110px, .6fr) auto;
          gap: 10px;
          align-items: end;
        }
        .pm-business-search-action { display:flex; align-items:flex-end; padding-bottom:1px; }
        .pm-business-results { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:10px; margin-top:12px; }
        .pm-business-result { border:1px solid var(--border-color); border-radius:12px; padding:11px; background:var(--bg-card); display:flex; flex-direction:column; gap:8px; }
        .pm-business-result-head { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; }
        .pm-business-result-head strong { display:block; font-size:11px; color:var(--text-primary); }
        .pm-business-result-head span:not(.pm-preview-pill) { display:block; margin-top:2px; font-size:9px; color:var(--text-muted); }
        .pm-business-result-meta { display:flex; flex-direction:column; gap:3px; font-size:9px; color:var(--text-secondary); line-height:1.35; overflow-wrap:anywhere; }

        .pm-business-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .pm-business-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pm-business-field.pm-span-2 { grid-column: 1 / -1; }
        .pm-business-field label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
        .pm-business-field textarea { min-height: 82px; resize: vertical; }

        .pm-business-save-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .pm-business-status { font-size: 11px; color: var(--pm-accent); }

        .pm-asset-role-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }

        .pm-asset-role-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 104px;
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          background: var(--bg-card);
        }

        .pm-asset-role-head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
        }

        .pm-asset-role-title { font-size: 12px; font-weight: 700; color: var(--text-primary); }
        .pm-asset-role-count {
          min-width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          background: var(--pm-soft);
          color: var(--pm-primary);
          border: 1px solid var(--pm-primary);
        }

        .pm-asset-role-copy { font-size: 10px; line-height: 1.4; color: var(--text-muted); }
        .pm-asset-thumbs { display: flex; gap: 6px; flex-wrap: wrap; }
        .pm-asset-thumb {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          object-fit: cover;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
        }

        @media (max-width: 720px) {
          .pm-audience-grid,
          .pm-business-grid,
          .pm-business-search-grid { grid-template-columns: 1fr; }
          .pm-business-field.pm-span-2 { grid-column: auto; }
        }

        .pm-asset-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .pm-discovered-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 12px;
        }

        .pm-discovered-card {
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          background: var(--bg-card);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .pm-discovered-card.rejected { opacity: 0.55; }
        .pm-discovered-image-wrap {
          position: relative;
          aspect-ratio: 16 / 10;
          background: #111;
          overflow: hidden;
        }
        .pm-discovered-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .pm-discovered-check {
          position: absolute;
          top: 8px;
          left: 8px;
          width: 18px;
          height: 18px;
          accent-color: var(--pm-primary);
        }
        .pm-discovered-badges {
          position: absolute;
          right: 8px;
          top: 8px;
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .pm-discovered-badge {
          padding: 3px 6px;
          border-radius: 999px;
          background: rgba(0,0,0,.72);
          color: #fff;
          font-size: 9px;
          font-weight: 700;
        }
        .pm-discovered-body {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pm-discovered-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .pm-discovered-row label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 9px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .pm-discovered-row select {
          min-width: 0;
          width: 100%;
          padding: 6px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: var(--bg-panel);
          color: var(--text-primary);
          font-size: 10px;
        }
        .pm-discovered-summary {
          font-size: 10px;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        .pm-discovered-footer {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .pm-discovered-source {
          font-size: 9px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pm-asset-thumb-button {
          appearance: none;
          border: 0;
          background: transparent;
          color: var(--text-muted);
          padding: 0;
          display: inline-flex;
          flex-direction: column;
          gap: 3px;
          align-items: center;
          cursor: pointer;
          font: inherit;
          font-size: 9px;
        }
        .pm-asset-thumb-button:hover .pm-asset-thumb { border-color: var(--pm-primary); }

        .pm-asset-role-card.drag-over {
          border-color: var(--pm-primary);
          box-shadow: 0 0 0 2px var(--pm-soft);
          background: var(--pm-soft);
        }
        .pm-asset-thumb-wrap {
          position:relative; display:inline-flex; flex-direction:column; align-items:center; gap:4px;
          max-width:120px;
        }
        .pm-asset-role-move {
          width:100%; max-width:120px; padding:3px 4px; border-radius:6px;
          border:1px solid var(--border-color); background:var(--bg-panel); color:var(--text-secondary);
          font:inherit; font-size:8px;
        }
        .pm-asset-role-move:focus { outline:2px solid var(--pm-primary); outline-offset:1px; }
        .pm-asset-delete {
          position:absolute; top:-5px; right:-5px; width:18px; height:18px; border-radius:999px;
          border:1px solid var(--border-color); background:var(--bg-app); color:var(--text-muted);
          cursor:pointer; font-size:13px; line-height:15px; padding:0;
        }
        .pm-asset-delete:hover { color:#fff; background:#ef4444; border-color:#ef4444; }
        .pm-asset-audio-chip {
          display:inline-flex; max-width:120px; align-items:center; gap:4px; padding:8px;
          border:1px solid var(--border-color); border-radius:8px; background:var(--bg-panel);
          color:var(--text-secondary); font-size:9px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }

        .pm-editor-shell {
          border: 1px solid var(--border-color);
          border-radius: 16px;
          background: var(--bg-card);
          overflow: hidden;
          box-shadow: 0 18px 50px rgba(0,0,0,.22);
        }
        .pm-editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-color);
        }
        .pm-editor-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
        .pm-editor-subtitle { margin-top: 3px; font-size: 10px; color: var(--text-muted); }
        .pm-editor-simple { display: flex; flex-direction: column; gap: 14px; padding: 14px; }
        .pm-editor-stage {
          position: relative;
          min-height: 320px;
          max-height: 58vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 12px;
          background:
            linear-gradient(45deg, rgba(255,255,255,.03) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255,255,255,.03) 25%, transparent 25%),
            #090b0d;
          background-size: 24px 24px;
          background-position: 0 0, 0 12px;
        }
        .pm-editor-stage > img { max-width: 100%; max-height: 58vh; object-fit: contain; display: block; }
        .pm-editor-busy {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: rgba(0,0,0,.58); color: #fff; font-size: 12px; font-weight: 700;
        }
        .pm-editor-progressive {
          position: absolute; left: 10px; bottom: 10px;
          background: rgba(0,0,0,.72); color: #fff; font-size: 9px;
          padding: 4px 7px; border-radius: 999px;
        }
        .pm-editor-safe-area { pointer-events:none; position:absolute; inset:7%; border:1px dashed rgba(41,211,242,.7); }
        .pm-editor-safe-v, .pm-editor-safe-h { position:absolute; background:rgba(41,211,242,.28); }
        .pm-editor-safe-v { top:0; bottom:0; width:1px; left:50%; }
        .pm-editor-safe-h { left:0; right:0; height:1px; top:50%; }
        .pm-editor-compare { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .pm-editor-compare figure { margin:0; padding:8px; border-radius:12px; background:#090b0d; }
        .pm-editor-compare img { width:100%; aspect-ratio:16/10; object-fit:contain; display:block; }
        .pm-editor-compare figcaption { margin-top:5px; text-align:center; font-size:9px; color:var(--text-muted); }
        .pm-editor-meta { display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:10px; color:var(--text-muted); }
        .pm-editor-good, .pm-editor-status { color:#22c55e; }
        .pm-editor-recommendation {
          display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
          border:1px solid rgba(41,211,242,.22); background:rgba(41,211,242,.04);
          border-radius:12px; padding:12px;
        }
        .pm-editor-recommendation strong { color:var(--text-primary); font-size:12px; }
        .pm-editor-recommendation p { margin:5px 0 0; color:var(--text-muted); font-size:10px; line-height:1.5; }
        .pm-editor-issue-row { display:flex; flex-wrap:wrap; gap:4px; margin-top:7px; }
        .pm-editor-issue-row span { padding:3px 6px; border-radius:999px; background:var(--bg-panel); font-size:9px; color:var(--text-muted); }
        .pm-editor-quick-actions { display:flex; flex-wrap:wrap; gap:7px; }
        .pm-editor-smart { border:1px solid var(--border-color); border-radius:12px; padding:12px; background:var(--bg-panel); }
        .pm-editor-smart > label { display:block; margin-bottom:7px; font-size:11px; font-weight:700; color:var(--text-primary); }
        .pm-editor-smart-row { display:flex; gap:8px; }
        .pm-editor-smart textarea {
          flex:1; min-height:76px; resize:vertical; border:1px solid var(--border-color); border-radius:10px;
          background:var(--bg-app); color:var(--text-primary); padding:9px; font:inherit; font-size:11px;
        }
        .pm-editor-versions { display:flex; gap:7px; overflow-x:auto; padding:2px; }
        .pm-editor-version {
          flex:0 0 90px; border:1px solid var(--border-color); border-radius:9px; padding:4px;
          background:var(--bg-panel); color:var(--text-muted); cursor:pointer; font:inherit; font-size:9px;
        }
        .pm-editor-version.active { border-color:var(--pm-primary); color:var(--text-primary); }
        .pm-editor-version img { width:100%; height:52px; object-fit:cover; border-radius:6px; display:block; margin-bottom:3px; }
        .pm-editor-note { border:1px solid var(--border-color); background:var(--bg-panel); border-radius:9px; padding:8px; font-size:9px; line-height:1.45; color:var(--text-muted); }
        .pm-editor-footer { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; border-top:1px solid var(--border-color); padding-top:12px; }
        .pm-editor-advanced { display:grid; grid-template-columns:170px minmax(0,1fr) 280px; min-height:620px; }
        .pm-editor-tool-sidebar, .pm-editor-right-panel { padding:12px; background:var(--bg-panel); }
        .pm-editor-tool-sidebar { border-right:1px solid var(--border-color); }
        .pm-editor-right-panel { border-left:1px solid var(--border-color); max-height:70vh; overflow:auto; }
        .pm-editor-advanced-stage { min-width:0; padding:12px; display:flex; flex-direction:column; gap:10px; }
        .pm-editor-sidebar-title { margin:10px 0 6px; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:var(--text-muted); }
        .pm-editor-group {
          width:100%; text-align:left; border:0; border-radius:8px; padding:8px; margin:1px 0;
          background:transparent; color:var(--text-secondary); cursor:pointer; font:inherit; font-size:10px; font-weight:650;
        }
        .pm-editor-group.active, .pm-small-btn.active { background:var(--pm-soft); color:var(--pm-primary); }
        .pm-editor-sidebar-separator { height:1px; background:var(--border-color); margin:10px 0; }
        .pm-editor-operation-list { display:flex; flex-direction:column; gap:6px; }
        .pm-editor-operation {
          width:100%; text-align:left; border:1px solid var(--border-color); background:var(--bg-card);
          border-radius:10px; padding:9px; color:var(--text-primary); cursor:pointer; font:inherit;
        }
        .pm-editor-operation strong { display:block; font-size:10px; }
        .pm-editor-operation span { display:block; margin-top:3px; color:var(--text-muted); font-size:9px; line-height:1.4; }
        .pm-editor-details { margin-top:9px; border:1px solid var(--border-color); border-radius:10px; background:var(--bg-card); padding:9px; }
        .pm-editor-details summary { cursor:pointer; font-size:10px; font-weight:700; color:var(--text-primary); }
        .pm-editor-detail-body { display:flex; flex-direction:column; gap:9px; margin-top:9px; }
        .pm-editor-control { display:flex; flex-direction:column; gap:4px; font-size:9px; color:var(--text-muted); }
        .pm-editor-control > span { display:flex; justify-content:space-between; gap:8px; }
        .pm-editor-control input[type="range"] { width:100%; accent-color:var(--pm-primary); }
        .pm-editor-control input[type="text"], .pm-editor-control select {
          width:100%; border:1px solid var(--border-color); border-radius:7px; background:var(--bg-panel); color:var(--text-primary); padding:6px; font-size:10px;
        }
        .pm-editor-button-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }
        .pm-editor-protections label { display:flex; gap:6px; align-items:center; font-size:10px; color:var(--text-secondary); }
        .pm-editor-mask-host { min-height:360px; }
        .pm-mask-toolbar {
          display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:8px;
          border:1px solid var(--border-color); border-radius:10px; background:var(--bg-panel);
        }
        .pm-mask-tools, .pm-mask-actions { display:flex; gap:5px; flex-wrap:wrap; }
        .pm-mask-tool.active { background:rgba(41,211,242,.12); color:#29d3f2; }
        .pm-mask-brush-label { margin-left:auto; display:flex; align-items:center; gap:6px; font-size:9px; color:var(--text-muted); }
        .pm-mask-brush-label input { width:90px; accent-color:#29d3f2; }
        .pm-mask-stage { position:relative; margin-top:8px; overflow:hidden; border-radius:10px; background:#000; }
        .pm-mask-image { width:100%; max-height:56vh; object-fit:contain; display:block; }
        .pm-mask-canvas { position:absolute; inset:0; width:100%; height:100%; touch-action:none; cursor:crosshair; opacity:.48; filter:drop-shadow(0 0 4px rgba(41,211,242,.8)); }
        .pm-mask-help { font-size:9px; line-height:1.4; color:var(--text-muted); margin:7px 0 0; }

        @media (max-width: 980px) {
          .pm-editor-advanced { grid-template-columns:1fr; }
          .pm-editor-tool-sidebar, .pm-editor-right-panel { border:0; border-bottom:1px solid var(--border-color); max-height:none; }
          .pm-editor-compare { grid-template-columns:1fr; }
        }
        @media (max-width: 720px) {
          .pm-editor-smart-row, .pm-editor-recommendation { flex-direction:column; }
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

        <div id="pm-preview-host">${this._renderPromptPreview()}</div>

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
        <div class="pm-preview">
          <div class="pm-preview-label">Prompt preview</div>
          <div class="pm-preview-empty">Open this modal from a studio with a prompt to preview how personalization resolves.</div>
        </div>
      `;
    }

    const contactId = getSelectedContactId();
    const profile = contactId ? _getProfile(contactId) : null;
    const resolved = profile ? replaceTokensInPrompt(raw, profile) : raw;
    const { resolved: hits, unresolved } = inspectPromptTokens(raw, profile);
    const totalTokens = hits.length + unresolved.length;

    // Status pill: report exactly how many tokens will personalize, and name
    // the ones that won't, so a raw {{token}} never reaches the model unnoticed.
    let pill;
    if (totalTokens === 0) {
      pill = `<span class="pm-preview-pill pm-preview-pill-muted">No tokens to personalize</span>`;
    } else if (!profile) {
      pill = `<span class="pm-preview-pill pm-preview-pill-muted">${totalTokens} token${totalTokens > 1 ? 's' : ''} — select a contact to resolve</span>`;
    } else if (unresolved.length === 0) {
      pill = `<span class="pm-preview-pill">All ${totalTokens} token${totalTokens > 1 ? 's' : ''} resolved for ${escapeHtml(profile.contact?.name || 'contact')}</span>`;
    } else {
      pill = `<span class="pm-preview-pill pm-preview-pill-warn">${hits.length}/${totalTokens} resolved — missing: ${escapeHtml(unresolved.slice(0, 3).join(', '))}${unresolved.length > 3 ? '…' : ''}</span>`;
    }

    return `
      <div class="pm-preview">
        <div class="pm-preview-header">
          <span class="pm-preview-label">Prompt preview</span>
          ${pill}
        </div>
        <pre class="pm-preview-text" tabindex="0">${escapeHtml(resolved)}</pre>
        <div class="pm-preview-actions">
          <button type="button" class="pm-action-btn pm-action-secondary" data-action="copy-preview">Copy ${profile ? 'personalized' : 'prompt'}</button>
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

  _selectedUnifiedProfile() {
    const profile = this._getSelectedProfile();
    return profile ? ensurePersonalizationProfile(profile) : null;
  }

  _currentBusinessDraft() {
    const profile = this._selectedUnifiedProfile();
    if (!profile) return null;
    return normalizeBusinessProfile(
      this.businessDraft || profile.personalization?.business || {},
      profile,
    );
  }

  _readBusinessDraftFromDom() {
    if (!this.overlay) return this.businessDraft;
    const read = (id, fallback = '') => {
      const el = this.overlay.querySelector('#' + id);
      return el ? String(el.value || '').trim() : fallback;
    };
    const current = this._currentBusinessDraft();
    if (!current) return null;
    this.businessDraft = {
      ...current,
      website: read('pm-business-website', current.website),
      name: read('pm-business-name', current.name),
      businessName: read('pm-business-business-name', current.businessName),
      industry: read('pm-business-industry', current.industry),
      location: read('pm-business-location', current.location),
      productService: read('pm-business-product-service', current.productService),
      offer: read('pm-business-offer', current.offer),
      ctaHeadline: read('pm-business-cta-headline', current.ctaHeadline),
      callToAction: read('pm-business-cta', current.callToAction),
      phone: read('pm-business-phone', current.phone),
      email: read('pm-business-email', current.email),
      brandDescription: read('pm-business-brand-description', current.brandDescription),
    };
    return this.businessDraft;
  }

  _renderBusinessTab() {
    const profile = this._selectedUnifiedProfile();
    if (!profile) {
      return '<div class="pm-empty">Select or discover a contact first. The business/client profile will attach to that existing SmartVideo personalization profile.</div>';
    }

    const b = this._currentBusinessDraft();
    const audiences = [
      { id: 'me', title: 'Me', copy: 'Personalize using your own identity and brand.' },
      { id: 'my-business', title: 'My Business', copy: 'Build reusable SmartVideo assets for your company.' },
      { id: 'client', title: 'Client', copy: 'Create and save a separate business profile for a customer.' },
    ];
    const field = (id, label, value, options = {}) => {
      const cls = options.full ? 'pm-business-field pm-span-2' : 'pm-business-field';
      const input = options.textarea
        ? `<textarea id="${id}" class="pm-input" placeholder="${escapeHtml(options.placeholder || '')}">${escapeHtml(value || '')}</textarea>`
        : `<input id="${id}" class="pm-input" type="${options.type || 'text'}" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(options.placeholder || '')}" />`;
      return `<div class="${cls}"><label for="${id}">${escapeHtml(label)}</label>${input}</div>`;
    };

    return `
      <div class="pm-form">
        <div class="pm-section">
          <div class="pm-section-label">Who is this for?</div>
          <div class="pm-audience-grid">
            ${audiences.map((a) => `
              <button type="button" class="pm-audience-card ${b.audience === a.id ? 'active' : ''}" data-audience="${a.id}" aria-pressed="${b.audience === a.id ? 'true' : 'false'}">
                <div class="pm-audience-title">${a.title}</div>
                <div class="pm-audience-copy">${a.copy}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="pm-section">
          <div class="pm-section-header">
            <span class="pm-section-label">Find a Business</span>
            <span class="pm-business-status">${escapeHtml(this.businessSearchStatus || '')}</span>
          </div>
          <div class="pm-preview-empty">
            Search nearby businesses with free OpenStreetMap + Overpass data. Nominatim resolves the location; no paid lead database is required.
          </div>
          ${this.businessSearchError ? `<div class="pm-error" role="alert">${escapeHtml(this.businessSearchError)}</div>` : ''}
          <div class="pm-business-search-grid">
            <label class="pm-business-field">
              <span>Business Type</span>
              <select id="pm-business-search-niche">
                ${BUSINESS_DISCOVERY_NICHES.map(([id, label]) => `<option value="${id}" ${this.businessSearchNiche === id ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
              </select>
            </label>
            <label class="pm-business-field">
              <span>Search Location</span>
              <input id="pm-business-search-location" class="pm-input" type="text" value="${escapeHtml(b.location || '')}" placeholder="Miami, FL or 33020" />
            </label>
            <label class="pm-business-field">
              <span>Radius</span>
              <select id="pm-business-search-radius">
                ${[5,10,15,25,50].map((miles) => `<option value="${miles}" ${Number(this.businessSearchRadius) === miles ? 'selected' : ''}>${miles} miles</option>`).join('')}
              </select>
            </label>
            <div class="pm-business-search-action">
              <button type="button" class="pm-btn pm-btn-primary" data-action="find-businesses" ${this.isSearchingBusinesses ? 'disabled' : ''}>
                ${this.isSearchingBusinesses ? 'Searching…' : 'Find Businesses'}
              </button>
            </div>
          </div>
          ${this.businessSearchResults.length ? `
            <div class="pm-business-results">
              ${this.businessSearchResults.map((business, index) => `
                <article class="pm-business-result">
                  <div class="pm-business-result-head">
                    <div>
                      <strong>${escapeHtml(business.name || 'Unnamed Business')}</strong>
                      <span>${escapeHtml(business.category || '')}</span>
                    </div>
                    <span class="pm-preview-pill pm-preview-pill-muted">Lead ${Math.round(Number(business.leadScore) || 0)}</span>
                  </div>
                  <div class="pm-business-result-meta">
                    ${business.address ? `<span>📍 ${escapeHtml(business.address)}</span>` : ''}
                    ${business.phone ? `<span>☎ ${escapeHtml(business.phone)}</span>` : ''}
                    ${business.website ? `<span>🌐 ${escapeHtml(business.website)}</span>` : '<span>Website not listed in OSM</span>'}
                  </div>
                  <div class="pm-asset-actions">
                    <button type="button" class="pm-small-btn" data-action="select-business-result" data-business-index="${index}">Use Business</button>
                    ${business.website ? `<button type="button" class="pm-small-btn" data-action="research-business-result" data-business-index="${index}" ${this.isResearchingBusiness ? 'disabled' : ''}>Research Website</button>` : ''}
                  </div>
                </article>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="pm-section">
          <div class="pm-section-header">
            <span class="pm-section-label">Business / Client Profile</span>
            <span class="pm-business-status">${escapeHtml(this.businessSaveStatus || '')}</span>
          </div>
          <div class="pm-business-grid">
            ${field('pm-business-website', 'Website', b.website, { full: true, placeholder: 'https://example.com' })}
            ${field('pm-business-name', 'Contact / Client Name', b.name)}
            ${field('pm-business-business-name', 'Business Name', b.businessName)}
            ${field('pm-business-industry', 'Industry', b.industry)}
            ${field('pm-business-location', 'Location', b.location)}
            ${field('pm-business-product-service', 'Product / Service', b.productService, { full: true })}
            ${field('pm-business-offer', 'Offer', b.offer, { full: true })}
            ${field('pm-business-cta-headline', 'CTA Headline', b.ctaHeadline)}
            ${field('pm-business-cta', 'Call To Action', b.callToAction)}
            ${field('pm-business-phone', 'Phone', b.phone, { type: 'tel' })}
            ${field('pm-business-email', 'Email', b.email, { type: 'email' })}
            ${field('pm-business-brand-description', 'Brand Description', b.brandDescription, { full: true, textarea: true, placeholder: 'Describe the brand, positioning, audience, tone, and important visual cues.' })}
          </div>
        </div>

        <div class="pm-business-save-row">
          <div class="pm-preview-empty">Saving updates the existing profile and immediately makes the new business/offer/CTA fields available as personalization tokens.</div>
          <button type="button" class="pm-btn pm-btn-primary" data-action="save-business-profile">Save business profile</button>
        </div>
      </div>
    `;
  }

  _assetRoleCard(title, description, items = [], uploadRole = null) {
    const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
    const thumbs = safeItems.slice(0, 4).map((asset) => {
      const url = typeof asset === 'string' ? asset : (asset.url || asset.originalUrl || '');
      if (!url) return '';
      if (typeof asset !== 'object' || !asset.id) {
        return uploadRole === 'audio_reference'
          ? `<span class="pm-asset-audio-chip">Audio</span>`
          : `<img class="pm-asset-thumb" src="${escapeHtml(url)}" alt="" loading="lazy" />`;
      }
      const preview = uploadRole === 'audio_reference'
        ? `<span class="pm-asset-audio-chip" title="${escapeHtml(asset.name || 'Audio reference')}">♫ ${escapeHtml(asset.name || 'Audio')}</span>`
        : `<button type="button" class="pm-asset-thumb-button" data-action="open-imported-asset-editor" data-asset-id="${escapeHtml(asset.id)}" title="Edit ${escapeHtml(asset.name || title)}"><img class="pm-asset-thumb" src="${escapeHtml(url)}" alt="" loading="lazy" /><span>Edit</span></button>`;
      const moveControl = uploadRole === 'audio_reference'
        ? ''
        : `<select class="pm-asset-role-move" data-imported-asset-role="${escapeHtml(asset.id)}" aria-label="Move ${escapeHtml(asset.name || title)} to another role">
            ${IMPORTED_IMAGE_ROLE_OPTIONS.map(([role, label]) => `<option value="${role}" ${asset.role === role ? 'selected' : ''}>${label}</option>`).join('')}
          </select>`;
      return `<span class="pm-asset-thumb-wrap">${preview}${moveControl}<button type="button" class="pm-asset-delete" data-action="delete-personalization-asset" data-asset-id="${escapeHtml(asset.id)}" aria-label="Delete ${escapeHtml(asset.name || title)}">×</button></span>`;
    }).join('');
    return `
      <div class="pm-asset-role-card" ${uploadRole ? `data-asset-drop-role="${escapeHtml(uploadRole)}"` : ''}>
        <div class="pm-asset-role-head">
          <span class="pm-asset-role-title">${escapeHtml(title)}</span>
          <span class="pm-asset-role-count">${safeItems.length}</span>
        </div>
        <div class="pm-asset-role-copy">${escapeHtml(description)}</div>
        ${thumbs ? `<div class="pm-asset-thumbs">${thumbs}</div>` : '<div class="pm-empty" style="padding:0;">No assets yet</div>'}
        ${uploadRole ? `<button type="button" class="pm-small-btn" data-action="upload-personalization-asset" data-upload-role="${escapeHtml(uploadRole)}">+ Upload</button>` : ''}
      </div>
    `;
  }

  _currentDiscoveredAssets() {
    const profile = this._selectedUnifiedProfile();
    return Array.isArray(profile?.personalization?.discoveredAssets)
      ? profile.personalization.discoveredAssets
      : [];
  }

  _renderDiscoveredAssetCard(asset) {
    const imageUrl = asset.editedUrl || asset.previewUrl || asset.sourceUrl || '';
    const categories = [
      'person', 'logo', 'product', 'service', 'completed_work', 'storefront',
      'office', 'branded_vehicle', 'team', 'brand', 'irrelevant',
    ];
    const roles = [
      ['presenter_identity', 'Person / Presenter'],
      ['face_identity', 'Face Identity'],
      ['character_identity', 'Character Identity'],
      ['logo', 'Logo'],
      ['product_reference', 'Product / Service'],
      ['brand_reference', 'Brand Reference'],
      ['background_reference', 'Background Reference'],
      ['saved_reference', 'Saved Reference'],
      ['first_frame', 'First Frame'],
      ['last_frame', 'Last Frame'],
      ['cta_graphic', 'CTA Graphic'],
    ];
    const categoryOptions = categories.map((category) =>
      `<option value="${category}" ${asset.category === category ? 'selected' : ''}>${category.replace(/_/g, ' ')}</option>`
    ).join('');
    const roleOptions = roles.map(([role, label]) =>
      `<option value="${role}" ${asset.assignedRole === role ? 'selected' : ''}>${label}</option>`
    ).join('');
    const vision = asset.visionAnalysis;
    const quality = vision?.qualityScore ?? asset.qualityScore;
    const relevance = vision?.relevanceScore ?? asset.relevanceScore;
    const badges = [
      asset.importedAssetId ? '<span class="pm-discovered-badge">Imported</span>' : '',
      asset.autoAssigned ? '<span class="pm-discovered-badge">Auto-assigned</span>' : '',
      asset.videoReady ? '<span class="pm-discovered-badge">Video Ready</span>' : '',
      vision ? '<span class="pm-discovered-badge">Vision</span>' : '',
      quality != null ? `<span class="pm-discovered-badge">Q ${Math.round(Number(quality) || 0)}</span>` : '',
      relevance != null ? `<span class="pm-discovered-badge">R ${Math.round(Number(relevance) || 0)}</span>` : '',
    ].filter(Boolean).join('');

    return `
      <div class="pm-discovered-card ${asset.rejected ? 'rejected' : ''}" data-discovered-card="${escapeHtml(asset.id)}">
        <div class="pm-discovered-image-wrap">
          <img class="pm-discovered-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(asset.altText || asset.category || 'Discovered business asset')}" loading="lazy" />
          <input
            class="pm-discovered-check"
            type="checkbox"
            data-discovered-select="${escapeHtml(asset.id)}"
            ${asset.selected && !asset.rejected ? 'checked' : ''}
            ${asset.rejected ? 'disabled' : ''}
            aria-label="Select discovered asset"
          />
          <div class="pm-discovered-badges">${badges}</div>
        </div>
        <div class="pm-discovered-body">
          <div class="pm-discovered-row">
            <label>
              Category
              <select data-discovered-category="${escapeHtml(asset.id)}" ${asset.rejected ? 'disabled' : ''}>
                ${categoryOptions}
              </select>
            </label>
            <label>
              Destination
              <select data-discovered-role="${escapeHtml(asset.id)}" ${asset.rejected ? 'disabled' : ''}>
                ${roleOptions}
              </select>
            </label>
          </div>
          ${vision?.summary ? `<div class="pm-discovered-summary">${escapeHtml(vision.summary)}</div>` : ''}
          ${vision?.issues?.length ? `<div class="pm-discovered-summary"><strong>Issues:</strong> ${escapeHtml(vision.issues.join(' • '))}</div>` : ''}
          ${asset.batchVideoReadyError ? `<div class="pm-error" role="alert">${escapeHtml(asset.batchVideoReadyError)}</div>` : ''}
          ${asset.importError ? `<div class="pm-error" role="alert">${escapeHtml(asset.importError)}</div>` : ''}
          <div class="pm-discovered-source" title="${escapeHtml(asset.sourceUrl || '')}">${escapeHtml(asset.sourceUrl || '')}</div>
          <div class="pm-discovered-footer">
            <button type="button" class="pm-small-btn" data-action="${asset.rejected ? 'restore-discovered' : 'reject-discovered'}" data-asset-id="${escapeHtml(asset.id)}">
              ${asset.rejected ? 'Restore' : 'Reject'}
            </button>
            ${asset.visionAnalysis ? '' : `<button type="button" class="pm-small-btn" data-action="analyze-one-asset" data-asset-id="${escapeHtml(asset.id)}">Vision</button>`}
            ${asset.importError ? `<button type="button" class="pm-small-btn" data-action="retry-discovered-import" data-asset-id="${escapeHtml(asset.id)}">Retry Import</button>` : ''}
            <button type="button" class="pm-small-btn" data-action="open-asset-editor" data-asset-id="${escapeHtml(asset.id)}" ${asset.rejected ? 'disabled' : ''}>Edit</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderAssetsTab() {
    const profile = this._selectedUnifiedProfile();
    if (!profile) {
      return '<div class="pm-empty">Select or discover a contact first. Assets are stored with that profile so they can be reused across studios.</div>';
    }

    const business = this._currentBusinessDraft() || profile.personalization?.business || {};
    const assets = profile.personalization.assets || {};
    const legacy = profile.assets || {};
    const discovered = this._currentDiscoveredAssets();
    const visibleDiscovered = discovered.filter((asset) => asset.category !== 'irrelevant');
    const selectedCount = visibleDiscovered.filter((asset) => asset.selected && !asset.rejected).length;

    const identities = assets.identities?.length
      ? assets.identities
      : (legacy.avatar || []).map((url) => ({ url }));
    const logos = assets.logos?.length
      ? assets.logos
      : (legacy.logos || []).map((url) => ({ url }));
    const products = assets.products?.length
      ? assets.products
      : (legacy.productImages || []).map((url) => ({ url }));
    const single = (value) => value ? [value] : [];

    const editorHtml = this.imageEditorSession
      ? renderPersonalizationImageEditorPanel(this.imageEditorSession)
      : '';

    return `
      <div class="pm-form">
        ${editorHtml}
        <div class="pm-section">
          <div class="pm-section-header">
            <span class="pm-section-label">Find Business Assets</span>
            <span class="pm-business-status">${escapeHtml(this.assetDiscoveryStatus || '')}</span>
          </div>
          <div class="pm-preview-empty">
            SmartVideo AI checks the business website with free/static discovery first. Vision analysis is a separate explicit action, so discovery itself does not spend OpenAI image-analysis credits.
          </div>
          ${this.assetDiscoveryError ? `<div class="pm-error" role="alert">${escapeHtml(this.assetDiscoveryError)}</div>` : ''}
          <div class="pm-asset-actions">
            <button type="button" class="pm-btn pm-btn-primary" data-action="discover-business-assets" ${!business.website || this.isDiscoveringBusinessAssets ? 'disabled' : ''}>
              ${this.isDiscoveringBusinessAssets ? 'Finding assets…' : 'Find Business Assets'}
            </button>
            <button type="button" class="pm-btn pm-btn-secondary" data-action="analyze-selected-assets" ${selectedCount === 0 || this.isAnalyzingBusinessAssets ? 'disabled' : ''}>
              ${this.isAnalyzingBusinessAssets ? 'Analyzing…' : `Analyze Selected with Vision (${selectedCount})`}
            </button>
            <button type="button" class="pm-btn pm-btn-secondary" data-action="video-ready-selected-assets" ${selectedCount === 0 || this.isBatchVideoReady ? 'disabled' : ''}>
              ${this.isBatchVideoReady ? 'Preparing…' : `Make Selected Video Ready (${selectedCount})`}
            </button>
            <button type="button" class="pm-btn pm-btn-secondary" data-action="import-selected-assets" ${selectedCount === 0 || this.isImportingBusinessAssets ? 'disabled' : ''}>
              ${this.isImportingBusinessAssets ? 'Importing…' : `Import Selected (${selectedCount})`}
            </button>
          </div>
          ${business.website ? `<div class="pm-preview-empty">Website: ${escapeHtml(business.website)}</div>` : '<div class="pm-preview-empty">Add a Website in Business / Client before running discovery.</div>'}
        </div>

        ${visibleDiscovered.length ? `
          <div class="pm-section">
            <div class="pm-section-header">
              <span class="pm-section-label">Discovered Asset Review</span>
              <span class="pm-preview-pill pm-preview-pill-muted">${visibleDiscovered.length} candidates</span>
            </div>
            <div class="pm-discovered-grid">
              ${visibleDiscovered.map((asset) => this._renderDiscoveredAssetCard(asset)).join('')}
            </div>
          </div>
        ` : ''}

        <div class="pm-section">
          <div class="pm-section-header">
            <span class="pm-section-label">Exact Brand Handling</span>
            <span class="pm-preview-pill pm-preview-pill-muted">Deterministic by default</span>
          </div>
          <div class="pm-preview-empty">
            Keep exact logos, CTA wording, phone numbers, and URLs out of generative redraws when fidelity matters. These settings travel with studio/Personalizer handoffs.
          </div>
          <div class="pm-business-grid">
            <label class="pm-business-field">
              <span>Logo Handling</span>
              <select data-generation-option="exactLogoHandling">
                <option value="final-overlay" ${profile.personalization.generationOptions?.exactLogoHandling !== 'ai-reference' ? 'selected' : ''}>Final exact overlay</option>
                <option value="ai-reference" ${profile.personalization.generationOptions?.exactLogoHandling === 'ai-reference' ? 'selected' : ''}>AI reference</option>
              </select>
            </label>
            <label class="pm-business-field">
              <span>CTA Handling</span>
              <select data-generation-option="exactCtaHandling">
                <option value="final-end-card" ${profile.personalization.generationOptions?.exactCtaHandling !== 'ai-generated' ? 'selected' : ''}>Final exact end card</option>
                <option value="ai-generated" ${profile.personalization.generationOptions?.exactCtaHandling === 'ai-generated' ? 'selected' : ''}>AI generated</option>
              </select>
            </label>
          </div>
        </div>

        <div class="pm-section">
          <div class="pm-section-header">
            <span class="pm-section-label">Reusable personalization assets</span>
            <span class="pm-preview-pill pm-preview-pill-muted">SmartVideo AI Asset Library</span>
          </div>
          <div class="pm-preview-empty">
            Imported assets use SmartVideo-controlled storage. Existing RNE avatar/logo/product assets remain visible for backward compatibility.
          </div>
        </div>

        <div class="pm-asset-role-grid">
          ${this._assetRoleCard('Person / Presenter', 'Face, body, side/profile, presenter and identity references.', identities, 'presenter_identity')}
          ${this._assetRoleCard('Logo', 'Primary and alternate brand logos.', logos, 'logo')}
          ${this._assetRoleCard('Products / Services', 'Products, services, completed work and marketing subjects.', products, 'product_reference')}
          ${this._assetRoleCard('Brand References', 'Brand imagery, environments and style references.', assets.brandReferences || [], 'brand_reference')}
          ${this._assetRoleCard('First Frame', 'Explicit opening-frame asset; never auto-assigned by discovery.', single(assets.firstFrame), 'first_frame')}
          ${this._assetRoleCard('Last Frame', 'Explicit ending-frame asset; never auto-assigned by discovery.', single(assets.lastFrame), 'last_frame')}
          ${this._assetRoleCard('CTA Graphic', 'Exact CTA/logo/phone/URL graphics for deterministic final use.', single(assets.ctaGraphic), 'cta_graphic')}
          ${this._assetRoleCard('Saved References', 'Reusable references available to compatible generation models.', assets.savedReferences || [], 'saved_reference')}
          ${this._assetRoleCard('Audio References', 'Reusable audio references for models that explicitly support reference audio.', assets.audio || [], 'audio_reference')}
        </div>
      </div>
    `;
  }

  async _uploadPersonalizationAssetFile(role, file) {
    const id = getSelectedContactId();
    let profile = id ? _getProfile(id) : null;
    if (!profile || !role || !file) return;

    const expectedAudio = role === 'audio_reference';
    const singletonRole = ['first_frame', 'last_frame', 'cta_graphic'].includes(role);
    if (!singletonRole) {
      const sameRoleCount = getAllPersonalizationAssets(profile).filter((asset) => asset?.role === role).length;
      if (sameRoleCount >= 10) {
        throw new Error('This asset section already has the maximum of 10 saved references.');
      }
    }
    if (expectedAudio && !String(file.type || '').startsWith('audio/')) {
      throw new Error('Audio Reference accepts audio files only.');
    }
    if (!expectedAudio && !String(file.type || '').startsWith('image/')) {
      throw new Error('This personalization asset role accepts image files only.');
    }

    this.assetDiscoveryError = '';
    this.assetDiscoveryStatus = `Uploading ${file.name}…`;
    this.refreshBody();

    try {
      const { uploadFileToStorage } = await import('../../lib/hybrid-supabase.js');
      const url = await uploadFileToStorage(file);
      if (!url) throw new Error('Upload returned no durable URL.');

      const asset = createPersonalizationAsset({
        role,
        name: file.name,
        url,
        originalUrl: url,
        sourceType: 'MANUAL_UPLOAD',
        sourceCategory:
          role === 'logo' ? 'logo'
          : role === 'product_reference' ? 'product'
          : role === 'presenter_identity' ? 'person'
          : role === 'brand_reference' ? 'brand'
          : null,
        mimeType: file.type || null,
      });

      profile = addPersonalizationAsset(profile, asset);
      profile.updatedAt = new Date().toISOString();
      profile.variables = buildVariables(profile, profile.variables || {});
      if (!this._persistSelectedProfile(profile)) {
        throw new Error('Could not save the uploaded asset to the selected profile.');
      }
      this.assetDiscoveryStatus = `✓ Uploaded ${file.name}`;
    } catch (error) {
      this.assetDiscoveryError = error?.message || 'Asset upload failed.';
      this.assetDiscoveryStatus = '';
      throw error;
    } finally {
      this.refreshBody();
    }
  }

  async _handleManualAssetUpload(role) {
    if (!role) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = role === 'audio_reference' ? 'audio/*' : 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      try {
        if (file) await this._uploadPersonalizationAssetFile(role, file);
      } catch {
        // Error is already surfaced in the Assets tab.
      } finally {
        cleanup();
      }
    };
    input.oncancel = cleanup;
    input.click();
  }

  _handleMovePersonalizationAsset(assetId, nextRole) {
    const id = getSelectedContactId();
    const profile = id ? _getProfile(id) : null;
    if (!profile || !assetId || !nextRole) return;

    try {
      const next = movePersonalizationAsset(profile, assetId, nextRole);
      next.updatedAt = new Date().toISOString();
      next.variables = buildVariables(next, next.variables || {});
      if (!this._persistSelectedProfile(next)) {
        throw new Error('Could not save the new asset role.');
      }
      if (this.assetEditorAssetId === assetId && this.imageEditorController.session) {
        this.imageEditorController.session.role = nextRole;
      }
      this.assetDiscoveryStatus = '✓ Asset moved to its new personalization role';
      this.assetDiscoveryError = '';
      this.refreshBody();
    } catch (error) {
      this.assetDiscoveryError = error?.message || 'Could not move the asset.';
      this.refreshBody();
    }
  }

  _handleDeletePersonalizationAsset(assetId) {
    const id = getSelectedContactId();
    const profile = id ? _getProfile(id) : null;
    if (!profile || !assetId) return;
    const next = removePersonalizationAsset(profile, assetId);
    next.updatedAt = new Date().toISOString();
    next.variables = buildVariables(next, next.variables || {});
    if (this._persistSelectedProfile(next)) {
      if (this.assetEditorAssetId === assetId) {
        this.assetEditorAssetId = null;
        this.imageEditorController.close();
      }
      this.assetDiscoveryStatus = '✓ Asset removed from this profile';
      this.refreshBody();
    }
  }

  _handleGenerationOptionChange(key, value) {
    const id = getSelectedContactId();
    const profile = id ? _getProfile(id) : null;
    if (!profile || !key) return;
    const next = setPersonalizationGenerationOptions(profile, { [key]: value });
    next.updatedAt = new Date().toISOString();
    if (this._persistSelectedProfile(next)) {
      this.assetDiscoveryStatus = '✓ Exact brand handling updated';
      this.refreshBody();
    }
  }

  _persistDiscoveredAssets(assets, status = '') {
    const id = getSelectedContactId();
    const profile = id ? _getProfile(id) : null;
    if (!profile) return false;
    const next = setDiscoveredPersonalizationAssets(profile, assets);
    next.updatedAt = new Date().toISOString();
    if (!this._persistSelectedProfile(next)) return false;
    if (status) this.assetDiscoveryStatus = status;
    return true;
  }

  _updateDiscoveredAsset(assetId, patch) {
    const assets = this._currentDiscoveredAssets().map((asset) =>
      asset.id === assetId ? { ...asset, ...(typeof patch === 'function' ? patch(asset) : patch) } : asset
    );
    this._persistDiscoveredAssets(assets);
    return assets;
  }

  async _handleDiscoverBusinessAssets() {
    const business = this._readBusinessDraftFromDom() || this._currentBusinessDraft();
    if (!business?.website) {
      this.assetDiscoveryError = 'Add a Website in Business / Client first.';
      this.refreshBody();
      return;
    }

    this.isDiscoveringBusinessAssets = true;
    this.assetDiscoveryError = '';
    this.assetDiscoveryStatus = 'Scanning website with free-first discovery…';
    this.refreshBody();

    try {
      const result = await discoverBusinessAssets({
        websiteUrl: business.website,
        maxPages: 6,
        maxImages: 60,
      });
      const candidates = result.discoveredAssets || [];
      this._persistDiscoveredAssets(candidates);
      this.assetDiscoveryStatus = `✓ Found ${candidates.length} review candidates across ${result.pagesCrawled || 0} page(s)`;
    } catch (error) {
      this.assetDiscoveryError = error?.message || 'Business asset discovery failed.';
      this.assetDiscoveryStatus = '';
    } finally {
      this.isDiscoveringBusinessAssets = false;
      this.refreshBody();
    }
  }

  async _analyzeAssetIds(assetIds) {
    const ids = new Set(assetIds || []);
    const assets = this._currentDiscoveredAssets().filter((asset) => ids.has(asset.id) && !asset.rejected);
    if (!assets.length) return;

    const business = this._currentBusinessDraft() || {};
    this.isAnalyzingBusinessAssets = true;
    this.assetDiscoveryError = '';
    this.assetDiscoveryStatus = `Analyzing ${assets.length} asset(s) with SmartVideo AI Vision…`;
    this.refreshBody();

    try {
      const analyses = await analyzePersonalizationImages({
        images: assets.map((asset) => ({
          id: asset.id,
          imageUrl: asset.editedUrl || asset.previewUrl || asset.sourceUrl,
          categoryHint: asset.category,
          roleHint: asset.assignedRole,
        })),
        businessContext: {
          businessName: business.businessName,
          industry: business.industry,
          productService: business.productService,
          brandDescription: business.brandDescription,
        },
      });
      const byId = new Map(analyses.map((analysis) => [analysis.id, analysis]));
      const next = this._currentDiscoveredAssets().map((asset) => {
        const analysis = byId.get(asset.id);
        if (!analysis) return asset;
        const oldDefaultRole = defaultRoleForDiscoveredCategory(asset.category);
        const category = analysis.confidence >= 75 ? analysis.category : asset.category;
        const assignedRole = asset.assignedRole === oldDefaultRole
          ? defaultRoleForDiscoveredCategory(category)
          : asset.assignedRole;
        return {
          ...asset,
          category,
          assignedRole,
          confidence: analysis.confidence,
          qualityScore: analysis.qualityScore,
          relevanceScore: analysis.relevanceScore,
          visionAnalysis: analysis,
          recommended: analysis.relevanceScore >= 65,
          selected: asset.selected && !analysis.duplicateLikely,
        };
      });
      this._persistDiscoveredAssets(next);
      this.assetDiscoveryStatus = `✓ Vision analyzed ${analyses.length} asset(s)`;
    } catch (error) {
      this.assetDiscoveryError = error?.message || 'Vision analysis failed.';
      this.assetDiscoveryStatus = '';
    } finally {
      this.isAnalyzingBusinessAssets = false;
      this.refreshBody();
    }
  }

  async _handleMakeSelectedVideoReady() {
    const selected = this._currentDiscoveredAssets().filter((asset) => asset.selected && !asset.rejected);
    if (!selected.length) return;

    const business = this._currentBusinessDraft() || {};
    this.isBatchVideoReady = true;
    this.assetDiscoveryError = '';
    let completed = 0;
    const updates = new Map();
    this.assetDiscoveryStatus = `Preparing 0/${selected.length} assets…`;
    this.refreshBody();

    try {
      for (const asset of selected) {
        this.assetDiscoveryStatus = `Preparing ${completed + 1}/${selected.length}: ${asset.altText || asset.category || 'asset'}…`;
        this.refreshBody();

        try {
          const result = await makePersonalizationAssetVideoReady({
            id: asset.id,
            url: asset.editedUrl || asset.previewUrl || asset.sourceUrl,
            originalUrl: asset.sourceUrl || asset.previewUrl,
            sourceCategory: asset.category,
            role: asset.assignedRole || defaultRoleForDiscoveredCategory(asset.category),
            visionAnalysis: asset.visionAnalysis || null,
          }, {
            businessContext: {
              businessName: business.businessName,
              industry: business.industry,
              productService: business.productService,
              brandDescription: business.brandDescription,
            },
          });

          const stored = await persistPersonalizationAssetVersion({
            sourceUrl: result.url,
            role: asset.assignedRole || defaultRoleForDiscoveredCategory(asset.category),
            name: `${asset.altText || asset.category || 'Business asset'} — Video Ready`,
          });

          updates.set(asset.id, {
            editedUrl: stored.url,
            stagedDurableUrl: stored.url,
            stagedRole: asset.assignedRole || defaultRoleForDiscoveredCategory(asset.category),
            stagedMimeType: stored.mimeType || 'image/png',
            videoReady: true,
            visionAnalysis: result.visionAnalysis || asset.visionAnalysis || null,
            visionValidation: result.visionValidation || null,
            editMetadata: result.editMetadata || null,
            batchVideoReadyError: null,
          });
          completed += 1;
        } catch (error) {
          updates.set(asset.id, {
            videoReady: false,
            batchVideoReadyError: error?.message || 'Video Ready preparation failed.',
            visionValidation: error?.validation || asset.visionValidation || null,
          });
        }
      }

      const next = this._currentDiscoveredAssets().map((asset) =>
        updates.has(asset.id) ? { ...asset, ...updates.get(asset.id) } : asset
      );
      this._persistDiscoveredAssets(next);
      const failed = selected.length - completed;
      this.assetDiscoveryStatus = failed
        ? `Prepared ${completed}/${selected.length}; ${failed} need review`
        : `✓ ${completed} selected assets are Video Ready`;
    } catch (error) {
      this.assetDiscoveryError = error?.message || 'Batch Video Ready failed.';
    } finally {
      this.isBatchVideoReady = false;
      this.refreshBody();
    }
  }

  async _importOneDiscoveredAsset(asset) {
    const id = getSelectedContactId();
    let profile = id ? _getProfile(id) : null;
    if (!profile || !asset) throw new Error('The selected personalization profile is unavailable.');

    try {
      const imported = await importDiscoveredAsset(asset, {
        role: asset.assignedRole || defaultRoleForDiscoveredCategory(asset.category),
        name: asset.altText || asset.category,
      });

      profile = addPersonalizationAsset(profile, imported);
      const discoveredState = this._currentDiscoveredAssets().map((candidate) =>
        candidate.id === asset.id
          ? { ...candidate, importedAssetId: imported.id, selected: false, importError: null }
          : candidate
      );
      profile = setDiscoveredPersonalizationAssets(profile, discoveredState);
      profile.updatedAt = new Date().toISOString();
      profile.variables = buildVariables(profile, profile.variables || {});

      if (!this._persistSelectedProfile(profile)) {
        throw new Error('The asset uploaded, but its profile record could not be saved.');
      }
      return imported;
    } catch (error) {
      const message = error?.message || 'Asset import failed.';
      this._updateDiscoveredAsset(asset.id, { importError: message });
      throw error;
    }
  }

  async _handleRetryDiscoveredImport(assetId) {
    const asset = this._currentDiscoveredAssets().find((candidate) => candidate.id === assetId);
    if (!asset) return;
    this.isImportingBusinessAssets = true;
    this.assetDiscoveryError = '';
    this.assetDiscoveryStatus = 'Retrying asset import…';
    this.refreshBody();
    try {
      await this._importOneDiscoveredAsset(asset);
      this.assetDiscoveryStatus = '✓ Asset imported successfully';
    } catch (error) {
      this.assetDiscoveryError = error?.message || 'Asset import retry failed.';
      this.assetDiscoveryStatus = '';
    } finally {
      this.isImportingBusinessAssets = false;
      this.refreshBody();
    }
  }

  async _handleImportSelectedAssets() {
    const selected = this._currentDiscoveredAssets().filter(
      (asset) => asset.selected && !asset.rejected && asset.category !== 'irrelevant'
    );
    if (!selected.length) return;

    this.isImportingBusinessAssets = true;
    this.assetDiscoveryError = '';
    this.assetDiscoveryStatus = `Importing ${selected.length} selected asset(s)…`;
    this.refreshBody();

    let importedCount = 0;
    const failures = [];
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const asset = selected[index];
        this.assetDiscoveryStatus = `Importing ${index + 1}/${selected.length}: ${asset.altText || asset.category || 'asset'}…`;
        this.refreshBody();
        try {
          await this._importOneDiscoveredAsset(asset);
          importedCount += 1;
        } catch (error) {
          failures.push({
            id: asset.id,
            message: error?.message || 'Import failed',
          });
        }
      }

      if (failures.length) {
        this.assetDiscoveryError = `${failures.length} asset(s) failed to import. Use Retry Import on the affected cards.`;
        this.assetDiscoveryStatus = importedCount
          ? `✓ Imported ${importedCount}/${selected.length}; ${failures.length} need retry`
          : '';
      } else {
        this.assetDiscoveryStatus = `✓ Imported ${importedCount} durable asset(s)`;
      }
    } finally {
      this.isImportingBusinessAssets = false;
      this.refreshBody();
    }
  }

  _updateEditorBusyLabel() {
    const busy = this.overlay?.querySelector('.pm-editor-busy');
    if (busy && this.imageEditorSession?.busyLabel) {
      busy.textContent = this.imageEditorSession.busyLabel;
    }
  }

  _editorBusinessContext() {
    const profile = this._selectedUnifiedProfile();
    const business = this._currentBusinessDraft() || profile?.personalization?.business || {};
    return {
      businessName: business.businessName || '',
      industry: business.industry || '',
      productService: business.productService || '',
      brandDescription: business.brandDescription || '',
      offer: business.offer || '',
      callToAction: business.callToAction || '',
    };
  }

  _findImportedPersonalizationAsset(assetId) {
    const profile = this._selectedUnifiedProfile();
    return getAllPersonalizationAssets(profile || {}).find((asset) => asset?.id === assetId) || null;
  }

  _openAssetEditor(assetId, source = 'discovered') {
    if (!assetId) return;
    let asset = null;
    let resolvedSource = source;

    if (source === 'imported') {
      asset = this._findImportedPersonalizationAsset(assetId);
    } else {
      const discovered = this._currentDiscoveredAssets().find((candidate) => candidate.id === assetId);
      if (discovered) {
        asset = {
          ...discovered,
          name: discovered.altText || discovered.category || 'Discovered Business Asset',
          role: discovered.assignedRole || defaultRoleForDiscoveredCategory(discovered.category),
          sourceCategory: discovered.category,
          url: discovered.editedUrl || discovered.previewUrl || discovered.sourceUrl,
          originalUrl: discovered.sourceUrl || discovered.previewUrl,
        };
      } else {
        asset = this._findImportedPersonalizationAsset(assetId);
        resolvedSource = 'imported';
      }
    }

    if (!asset) {
      this.assetDiscoveryError = 'Could not find the selected personalization asset.';
      this.refreshBody();
      return;
    }

    this._forcedTab = 'assets';
    this.assetEditorAssetId = assetId;
    this.imageEditorController.open(asset, {
      source: resolvedSource,
      businessContext: this._editorBusinessContext(),
    });
  }

  _closeAssetEditor() {
    this.assetEditorAssetId = null;
    this.imageEditorController.close();
  }

  _persistEditorAnalysis() {
    const session = this.imageEditorController.session;
    if (!session?.visionAnalysis) return;

    if (session.source === 'discovered') {
      this._updateDiscoveredAsset(session.assetId, {
        visionAnalysis: session.visionAnalysis,
        category: session.visionAnalysis.confidence >= 75
          ? session.visionAnalysis.category
          : session.category,
        qualityScore: session.visionAnalysis.qualityScore,
        relevanceScore: session.visionAnalysis.relevanceScore,
      });
      return;
    }

    const id = getSelectedContactId();
    const profile = id ? _getProfile(id) : null;
    if (!profile) return;
    const next = updatePersonalizationAsset(profile, session.assetId, {
      visionAnalysis: session.visionAnalysis,
      sourceCategory: session.category,
    });
    next.updatedAt = new Date().toISOString();
    this._persistSelectedProfile(next);
  }

  async _handleEditorAnalyze() {
    await this.imageEditorController.analyze();
    this._persistEditorAnalysis();
  }

  async _handleEditorOperation(operationId) {
    await this.imageEditorController.runOperation(operationId);
  }

  async _handleEditorSmartEdit() {
    await this.imageEditorController.smartEdit();
  }

  async _handleEditorVideoReady() {
    await this.imageEditorController.makeVideoReady();
  }

  async _handleEditorApplyLocal() {
    await this.imageEditorController.applyLocal();
  }

  async _handleEditorMask() {
    await this.imageEditorController.toggleMask();
  }

  _mountActiveEditorMask() {
    const session = this.imageEditorController.session;
    if (!session?.maskMode) return;
    const host = this.overlay?.querySelector('[data-editor-mask-host]');
    if (host) this.imageEditorController.mountMask(host);
  }

  _serializedEditorVersions(session) {
    return (session?.versions || []).map((version) => ({
      id: version.id,
      label: version.label,
      url: version.dataUrl,
      operation: version.operation,
      prompt: version.prompt || '',
      model: version.model || '',
      transparent: Boolean(version.transparent),
      videoReady: Boolean(version.videoReady),
      responseId: version.responseId || null,
      imageGenerationCallId: version.imageGenerationCallId || null,
      revisedPrompt: version.revisedPrompt || null,
      quality: version.quality || null,
      outputFormat: version.outputFormat || null,
      outputCompression: typeof version.outputCompression === 'number' ? version.outputCompression : null,
      inputFidelity: version.inputFidelity || null,
      visionValidation: version.visionValidation || null,
      createdAt: version.createdAt || new Date().toISOString(),
    }));
  }

  async _handleEditorApply() {
    const controller = this.imageEditorController;
    const session = controller.session;
    if (!session) return;

    const qa = await controller.validateCurrent();
    if (!qa.ok) return;

    try {
      session.busyLabel = 'Saving accepted edit versions…';
      this._updateEditorBusyLabel();
      await controller.persistVersions();
      const current = controller.currentVersion();
      if (!current?.dataUrl) throw new Error('No edited version is available to save.');

      const versions = this._serializedEditorVersions(session);
      const editMetadata = {
        operation: current.operation,
        prompt: current.prompt || '',
        model: current.model || '',
        responseId: current.responseId || null,
        imageGenerationCallId: current.imageGenerationCallId || null,
        revisedPrompt: current.revisedPrompt || null,
        quality: current.quality || null,
        outputFormat: current.outputFormat || session.outputFormat || null,
        outputCompression: typeof current.outputCompression === 'number'
          ? current.outputCompression
          : (typeof session.outputCompression === 'number' ? session.outputCompression : null),
        inputFidelity: current.inputFidelity || null,
        acceptedAt: new Date().toISOString(),
      };

      if (session.source === 'discovered') {
        this._updateDiscoveredAsset(session.assetId, {
          editedUrl: current.dataUrl,
          stagedDurableUrl: current.dataUrl,
          stagedRole: session.role,
          stagedMimeType: current.mimeType || null,
          videoReady: Boolean(current.videoReady),
          visionAnalysis: session.visionAnalysis || null,
          visionValidation: current.visionValidation || null,
          editMetadata,
          versions,
          selected: true,
        });
        this.assetDiscoveryStatus = '✓ Edited asset saved. Import it when you are ready to add it to the reusable library.';
      } else {
        const id = getSelectedContactId();
        const profile = id ? _getProfile(id) : null;
        if (!profile) throw new Error('The selected personalization profile is no longer available.');
        let next = updatePersonalizationAsset(profile, session.assetId, (asset) => ({
          ...asset,
          url: current.dataUrl,
          edited: current.dataUrl !== (asset.originalUrl || current.dataUrl),
          videoReady: Boolean(current.videoReady),
          hasTransparency: Boolean(current.transparent),
          visionAnalysis: session.visionAnalysis || asset.visionAnalysis || null,
          visionValidation: current.visionValidation || null,
          editMetadata,
          versions,
        }));
        next.updatedAt = new Date().toISOString();
        next.variables = buildVariables(next, next.variables || {});
        if (!this._persistSelectedProfile(next)) throw new Error('Could not save the edited asset profile.');
        this.assetDiscoveryStatus = '✓ Edited reusable asset saved';
      }

      this.assetEditorAssetId = null;
      controller.close();
    } catch (error) {
      session.busyLabel = '';
      session.error = error?.message || 'Could not save the edited asset.';
      this.refreshBody();
    }
  }

  async _handleFindBusinesses() {
    const location = this.overlay?.querySelector('#pm-business-search-location')?.value?.trim()
      || this._currentBusinessDraft()?.location
      || '';
    const niche = this.overlay?.querySelector('#pm-business-search-niche')?.value || this.businessSearchNiche;
    const radiusMiles = Number(this.overlay?.querySelector('#pm-business-search-radius')?.value || this.businessSearchRadius || 15);

    if (!location) {
      this.businessSearchError = 'Enter a city, ZIP code, or location first.';
      this.refreshBody();
      return;
    }

    this.businessSearchNiche = niche;
    this.businessSearchRadius = radiusMiles;
    this.isSearchingBusinesses = true;
    this.businessSearchError = '';
    this.businessSearchStatus = 'Searching OpenStreetMap…';
    this.refreshBody();

    try {
      const result = await findBusinesses({ niche, location, radiusMiles, limit: 20 });
      this.businessSearchResults = Array.isArray(result?.businesses) ? result.businesses : [];
      this.businessSearchStatus = `✓ Found ${this.businessSearchResults.length} businesses near ${result?.geocode?.displayName || location}`;
    } catch (error) {
      this.businessSearchResults = [];
      this.businessSearchError = error?.message || 'Business search failed.';
      this.businessSearchStatus = '';
    } finally {
      this.isSearchingBusinesses = false;
      this.refreshBody();
    }
  }

  _applyBusinessSearchResult(index) {
    const business = this.businessSearchResults[Number(index)];
    if (!business) return;
    const current = this._readBusinessDraftFromDom() || this._currentBusinessDraft() || {};
    this.businessDraft = {
      ...current,
      businessName: business.name || current.businessName || '',
      website: business.website || current.website || '',
      industry: business.category || current.industry || '',
      location: business.address || [business.city, business.region].filter(Boolean).join(', ') || current.location || '',
      phone: business.phone || current.phone || '',
      email: business.email || current.email || '',
    };
    this.businessSaveStatus = 'Business selected — save when ready';
    this.businessSearchError = '';
    this.refreshBody();
  }

  async _handleResearchBusiness(index) {
    const business = this.businessSearchResults[Number(index)];
    if (!business?.website) return;
    this.isResearchingBusiness = true;
    this.businessSearchError = '';
    this.businessSearchStatus = `Researching ${business.name || 'business'} website…`;
    this.refreshBody();
    try {
      const result = await researchBusiness({ websiteUrl: business.website });
      const research = result?.research || {};
      const current = this._currentBusinessDraft() || {};
      this.businessDraft = {
        ...current,
        businessName: business.name || current.businessName || research.title || '',
        website: research.finalUrl || business.website || current.website || '',
        industry: business.category || current.industry || '',
        location: business.address || current.location || research.contactInfo?.addresses?.[0] || '',
        phone: business.phone || research.contactInfo?.phones?.[0] || current.phone || '',
        email: business.email || research.contactInfo?.emails?.[0] || current.email || '',
        brandDescription: research.description || current.brandDescription || '',
      };
      this.businessSaveStatus = '✓ Website research applied — save when ready';
      this.businessSearchStatus = '✓ Free website research complete';
    } catch (error) {
      this.businessSearchError = error?.message || 'Business website research failed.';
      this.businessSearchStatus = '';
    } finally {
      this.isResearchingBusiness = false;
      this.refreshBody();
    }
  }

  _persistSelectedProfile(profile) {
    if (!profile?.id) return false;
    try {
      const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]');
      const idx = profiles.findIndex((p) => p.id === profile.id);
      if (idx >= 0) profiles[idx] = profile;
      else profiles.unshift(profile);
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      return true;
    } catch {
      return false;
    }
  }

  _handleAudienceChange(audience) {
    if (!['me', 'my-business', 'client'].includes(audience)) return;
    const draft = this._readBusinessDraftFromDom() || this._currentBusinessDraft();
    this.businessDraft = { ...draft, audience };
    this.businessSaveStatus = '';
    this.refreshBody();
  }

  _handleSaveBusinessProfile() {
    const id = getSelectedContactId();
    const profile = id ? _getProfile(id) : null;
    if (!profile) {
      this.errorMessage = 'Select or discover a contact before saving a business profile.';
      this.refreshBody();
      return;
    }

    const draft = this._readBusinessDraftFromDom();
    let next = updatePersonalizationBusiness(profile, draft || {});
    next.updatedAt = new Date().toISOString();
    next.variables = buildVariables(next, next.variables || {});
    if (!this._persistSelectedProfile(next)) {
      this.errorMessage = 'Could not save the business profile in this browser.';
      this.refreshBody();
      return;
    }

    this.businessDraft = null;
    this.businessSaveStatus = '✓ Saved';
    this.errorMessage = '';
    this._refreshProfileSummary();
    this.refreshBody();
    window.dispatchEvent(new CustomEvent('remix:contact-changed', { detail: { contactId: id } }));
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
        const safeUrl = _safeUrl(p.url);
        const label = p.platform || 'platform';
        return safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener" class="pm-platform-chip">${escapeHtml(label)}</a>` : escapeHtml(label);
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
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Links</span><div>${socialLinks.map(l => {
        const safe = _safeUrl(l.url);
        return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener" class="pm-link">${escapeHtml(l.label)}</a>` : escapeHtml(l.label);
      }).join(' ')}</div></div>`);
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
    //
    // The chip's `data-token` carries the *canonical camelCase key* — that is
    // the wire format `replaceTokensInPrompt` resolves and the backend writes.
    // The human label is display-only. Inserting the label here (the previous
    // behaviour) produced tokens like `{{First Name}}` that never resolved.
    const tokenEntries = Object.entries(variables).filter(([, v]) => v && typeof v === 'string');
    const tokensHtml = tokenEntries.length
      ? tokenEntries.map(([key, value]) => {
          const label = TOKEN_LABELS[key] || key;
          const preview = String(value).length > 18 ? String(value).slice(0, 16) + '…' : value;
          return `<button type="button" class="pm-token" data-token="${escapeHtml(key)}" aria-label="Insert ${escapeHtml(label)} token into prompt" title="Insert {{${escapeHtml(key)}}} — current value: ${escapeHtml(value)}"><span>${escapeHtml(label)}</span><span class="pm-token-preview">${escapeHtml(preview)}</span></button>`;
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
          if (action === 'send-to-personalizer') this._handleSendToPersonalizer();
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
            if (this._activeTab() === 'business' && btn.dataset.tab !== 'business') {
              this._readBusinessDraftFromDom();
            }
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

        scope.querySelectorAll('[data-action="find-businesses"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleFindBusinesses();
          };
        });

        scope.querySelectorAll('[data-action="select-business-result"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._applyBusinessSearchResult(btn.dataset.businessIndex);
          };
        });

        scope.querySelectorAll('[data-action="research-business-result"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleResearchBusiness(btn.dataset.businessIndex);
          };
        });

        scope.querySelectorAll('[data-generation-option]').forEach((select) => {
          select.onchange = () => {
            this._handleGenerationOptionChange(select.dataset.generationOption, select.value);
          };
        });

        scope.querySelectorAll('[data-imported-asset-role]').forEach((select) => {
          select.onchange = (e) => {
            e.stopPropagation();
            this._handleMovePersonalizationAsset(select.dataset.importedAssetRole, select.value);
          };
        });

        scope.querySelectorAll('[data-action="delete-personalization-asset"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleDeletePersonalizationAsset(btn.dataset.assetId);
          };
        });

        scope.querySelectorAll('[data-asset-drop-role]').forEach((card) => {
          card.ondragover = (e) => {
            e.preventDefault();
            card.classList.add('drag-over');
          };
          card.ondragleave = () => card.classList.remove('drag-over');
          card.ondrop = async (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (!file) return;
            try {
              await this._uploadPersonalizationAssetFile(card.dataset.assetDropRole, file);
            } catch {
              // Error already rendered.
            }
          };
        });

        scope.querySelectorAll('[data-action="upload-personalization-asset"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleManualAssetUpload(btn.dataset.uploadRole);
          };
        });

        scope.querySelectorAll('[data-action="discover-business-assets"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleDiscoverBusinessAssets();
          };
        });

        scope.querySelectorAll('[data-action="analyze-selected-assets"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const ids = this._currentDiscoveredAssets()
              .filter((asset) => asset.selected && !asset.rejected)
              .map((asset) => asset.id);
            this._analyzeAssetIds(ids);
          };
        });

        scope.querySelectorAll('[data-action="analyze-one-asset"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._analyzeAssetIds([btn.dataset.assetId]);
          };
        });

        scope.querySelectorAll('[data-action="video-ready-selected-assets"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleMakeSelectedVideoReady();
          };
        });

        scope.querySelectorAll('[data-action="retry-discovered-import"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleRetryDiscoveredImport(btn.dataset.assetId);
          };
        });

        scope.querySelectorAll('[data-action="import-selected-assets"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleImportSelectedAssets();
          };
        });

        scope.querySelectorAll('[data-discovered-select]').forEach((input) => {
          input.onchange = () => {
            this._updateDiscoveredAsset(input.dataset.discoveredSelect, { selected: input.checked });
            this.refreshBody();
          };
        });

        scope.querySelectorAll('[data-discovered-category]').forEach((select) => {
          select.onchange = () => {
            const id = select.dataset.discoveredCategory;
            const current = this._currentDiscoveredAssets().find((asset) => asset.id === id);
            if (!current) return;
            const wasDefault = current.assignedRole === defaultRoleForDiscoveredCategory(current.category);
            this._updateDiscoveredAsset(id, {
              category: select.value,
              assignedRole: wasDefault ? defaultRoleForDiscoveredCategory(select.value) : current.assignedRole,
              visionAnalysis: null,
            });
            this.refreshBody();
          };
        });

        scope.querySelectorAll('[data-discovered-role]').forEach((select) => {
          select.onchange = () => {
            this._updateDiscoveredAsset(select.dataset.discoveredRole, { assignedRole: select.value });
            this.refreshBody();
          };
        });

        scope.querySelectorAll('[data-action="reject-discovered"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._updateDiscoveredAsset(btn.dataset.assetId, { rejected: true, selected: false });
            this.refreshBody();
          };
        });

        scope.querySelectorAll('[data-action="restore-discovered"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._updateDiscoveredAsset(btn.dataset.assetId, { rejected: false });
            this.refreshBody();
          };
        });

        scope.querySelectorAll('[data-action="open-asset-editor"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._openAssetEditor(btn.dataset.assetId, 'discovered');
          };
        });

        scope.querySelectorAll('[data-action="open-imported-asset-editor"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._openAssetEditor(btn.dataset.assetId, 'imported');
          };
        });

        scope.querySelectorAll('[data-audience]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleAudienceChange(btn.dataset.audience);
          };
        });

        scope.querySelectorAll('[data-action="save-business-profile"]').forEach((btn) => {
          btn.onclick = (e) => {
            e.stopPropagation();
            this._handleSaveBusinessProfile();
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
            this._insertToken(chip);
          };
        });

        this._bindImageEditorActions(scope);
      }
    }

  _bindImageEditorActions(scope) {
    const controller = this.imageEditorController;
    const session = controller?.session;
    if (!scope || !session) return;

    scope.querySelectorAll('[data-editor-action]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.editorAction;
        if (action === 'close') this._closeAssetEditor();
        else if (action === 'analyze') this._handleEditorAnalyze();
        else if (action === 'video-ready') this._handleEditorVideoReady();
        else if (action === 'smart-edit') this._handleEditorSmartEdit();
        else if (action === 'compare') controller.toggleCompare();
        else if (action === 'safe-area') controller.toggleSafeArea();
        else if (action === 'advanced') controller.setMode('advanced');
        else if (action === 'simple') controller.setMode('simple');
        else if (action === 'revert-original') controller.revertOriginal();
        else if (action === 'undo') controller.undo();
        else if (action === 'redo') controller.redo();
        else if (action === 'mask') this._handleEditorMask();
        else if (action === 'apply-local') this._handleEditorApplyLocal();
        else if (action === 'apply') this._handleEditorApply();
      };
    });

    scope.querySelectorAll('[data-editor-operation]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this._handleEditorOperation(btn.dataset.editorOperation);
      };
    });

    scope.querySelectorAll('[data-editor-version]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        controller.chooseVersion(Number(btn.dataset.editorVersion));
      };
    });

    scope.querySelectorAll('[data-editor-group]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        controller.setGroup(btn.dataset.editorGroup);
      };
    });

    const smartPrompt = scope.querySelector('[data-editor-smart-prompt]');
    if (smartPrompt) {
      smartPrompt.oninput = () => {
        controller.setSmartPrompt(smartPrompt.value);
        const run = scope.querySelector('[data-editor-action="smart-edit"]');
        if (run) run.disabled = !smartPrompt.value.trim() || Boolean(session.busyLabel);
      };
    }

    scope.querySelectorAll('[data-editor-setting]').forEach((select) => {
      select.onchange = () => controller.setSetting(select.dataset.editorSetting, select.value);
    });

    scope.querySelectorAll('[data-editor-protection]').forEach((input) => {
      input.onchange = () => controller.setProtection(input.dataset.editorProtection, input.checked);
    });

    scope.querySelectorAll('[data-editor-local]').forEach((input) => {
      input.oninput = () => {
        const key = input.dataset.editorLocal;
        controller.setLocalControl(key, Number(input.value));
        const value = scope.querySelector(`[data-editor-local-value="${key}"]`);
        if (value) value.textContent = `${input.value}${input.dataset.editorSuffix || ''}`;
      };
    });

    scope.querySelectorAll('[data-editor-local-select]').forEach((select) => {
      select.onchange = () => controller.setLocalControl(select.dataset.editorLocalSelect, select.value);
    });

    scope.querySelectorAll('[data-editor-local-text]').forEach((input) => {
      input.oninput = () => controller.setLocalControl(input.dataset.editorLocalText, input.value);
    });

    scope.querySelectorAll('[data-editor-local-action]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.editorLocalAction;
        const controls = controller.session?.localControls;
        if (!controls) return;
        if (action === 'rotate') {
          controller.setLocalControl('rotation', (Number(controls.rotation) + 90) % 360);
        } else if (action === 'flipX') {
          const next = !controls.flipX;
          controller.setLocalControl('flipX', next);
          btn.classList.toggle('active', next);
        } else if (action === 'flipY') {
          const next = !controls.flipY;
          controller.setLocalControl('flipY', next);
          btn.classList.toggle('active', next);
        }
      };
    });

    this._mountActiveEditorMask();
  }

  /**
   * Insert a token chip's canonical `{{key}}` at the host textarea's cursor.
   * `data-token` holds the canonical camelCase key; the visible chip text is
   * the human label, so announcements use the label for clarity.
   */
  _insertToken(chip) {
    const key = chip?.dataset?.token;
    if (!key) return;
    const label = TOKEN_LABELS[key] || key;
    const ta = this.getTextarea?.();
    if (ta) {
      insertTokenAtCursor(ta, `{{${key}}}`);
      this._announce(`Inserted ${label} token into prompt`);
      // Keep the live prompt preview in sync with the edit we just made.
      this._refreshPromptPreview();
    } else {
      this.errorMessage = 'No prompt textarea available in this studio.';
      this.refreshBody();
    }
  }

  /** Re-render just the prompt preview panel, preserving the rest of the DOM. */
  _refreshPromptPreview() {
    const host = this.overlay?.querySelector('#pm-preview-host');
    if (!host) return;
    host.innerHTML = this._renderPromptPreview();
    host.querySelectorAll('[data-action="copy-preview"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this._handleCopyPreview();
      };
    });
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
        if (contact.avatarUrl && _safeUrl(contact.avatarUrl)) {
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
        this._insertToken(chip);
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
    this.businessDraft = null;
    this.businessSaveStatus = '';
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

      // 4) AI enrichment — asks the backend for *structured* intelligence
      // (industry / painPoints / products / services / tone / brandColors)
      // rather than prose, and passes the scan payload plus the scanId so the
      // server can link the generation to the persisted scan.
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
              scanId: this.lastScanId || undefined,
              scanResults: scanData,
            }),
          });
          if (enrichRes.ok) {
            const data = await enrichRes.json();
            // `intelligence` is the structured block; fall back to metadata for
            // older server builds that only returned generation metadata.
            intelligence = data.intelligence || data.output?.intelligence || data.output?.metadata || {};
          } else {
            console.warn('[PersonalizeModal] Enrichment returned', enrichRes.status);
          }
        } catch (err) {
          console.warn('[PersonalizeModal] AI enrichment failed:', err);
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
        // The contacts list renders `email || company`, and the profile token
        // map reads contact.email — it was never populated before.
        email: value.includes('@') ? value : '',
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

      const email = value.includes('@') ? value : '';
      const githubEntry = scanData?.platforms?.find(p => p.platform === 'github');
      const platformIds = scanData?.platforms?.map(p => p.ids_data).filter(Boolean) || [];
      const firstOf = (field) => platformIds.find(d => d?.[field])?.[field] || '';

      // Collect avatars/logos from every platform that surfaced one, not just
      // the first, so the assets block and {{avatarUrl}} have real coverage.
      const avatarUrls = [
        contact.avatarUrl,
        ...platformIds.map(d => d?.avatar_url).filter(Boolean),
      ].filter(Boolean);

      const socialFor = (platform) => scanData?.platforms?.find(p => p.platform === platform)?.url || '';

      // Build the nested profile first, then derive the flat token map from it
      // via the shared schema. This guarantees every token the chips can show
      // is actually resolvable, instead of the 11 hand-picked fields the modal
      // used to write (which left industry/product/service/etc. empty).
      const rawSocialProfiles = scanData?.platforms || [];
      const socialProfiles = normalizeSocialIdentities(rawSocialProfiles);
      const legacySocialMap = buildLegacySocialMap(socialProfiles);

      const profile = {
        id: contactId,
        contact: {
          name,
          firstName,
          lastName,
          email,
          company: contact.company,
          title: contact.title || firstOf('title'),
          location: contact.location,
          avatarUrl: contact.avatarUrl,
        },
        company: {
          name: intelligence.company?.name || contact.company,
          domain: intelligence.company?.domain || '',
          industry: intelligence.company?.industry || intelligence.industry || '',
          size: intelligence.company?.size || '',
          summary: intelligence.company?.summary || intelligence.companySummary || '',
        },
        brand: { colors: intelligence.brand?.colors || intelligence.brandColors || {} },
        social: {
          github: githubEntry?.url || socialFor('github') || legacySocialMap.github || '',
          linkedin: socialFor('linkedin') || legacySocialMap.linkedin || '',
          twitter: socialFor('twitter') || socialFor('x') || legacySocialMap.twitter || legacySocialMap.x || '',
          website: scanData?.website?.url || legacySocialMap.website || '',
        },
        socialProfiles,
        website: scanData?.website || {},
        assets: {
          avatar: [...new Set(avatarUrls)],
          logos: [...new Set((intelligence.assets?.logos || []).filter(Boolean))],
          productImages: [],
          icons: [],
          videos: [],
        },
        intelligence: {
          summary: intelligence.summary || scanData?.summary || '',
          painPoints: intelligence.painPoints || [],
          products: intelligence.products || [],
          services: intelligence.services || [],
          interests: intelligence.interests || [],
          buyingSignals: intelligence.buyingSignals || [],
          tone: intelligence.tone || 'professional',
        },
        campaign: {},
        history: { discoveries: [{ source: 'personalize-modal', timestamp: new Date().toISOString(), success: true, data: scanData }], generations: [], interactions: [] },
        variables: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add the non-breaking unified SmartVideo AI personalization extension.
      const unifiedProfile = ensurePersonalizationProfile(profile);
      Object.assign(profile, unifiedProfile);

      // Derive the complete token map from the profile via the shared schema.
      profile.variables = buildVariables(profile, {
        firstName,
        lastName,
        fullName: name,
        email,
      });

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
      const personalization = buildPersonalizationContext(profile);
      this.onApply({ contactId: id, profile, personalization });
      window.dispatchEvent(new CustomEvent('remix:personalization-applied', {
        detail: { contactId: id, profile, personalization, studioId: this.studioId || '' },
      }));
    }
    this.close();
  }

  _handleSendToPersonalizer() {
    const contactId = getSelectedContactId();
    const profile = contactId ? _getProfile(contactId) : null;

    let asset = null;
    let project = null;
    let personalizableFields = null;
    let preview = null;

    try {
      asset = this.getAsset?.() || null;
      project = this.getProject?.() || null;
      personalizableFields = this.getPersonalizableFields?.() || null;
      preview = this.getPreview?.() || null;
    } catch {
      // Adapter failure must not block handoff.
    }

    // If the studio did not supply a fully-formed asset via getAsset(),
    // synthesize one from the personalizable fields plus the current textarea.
    if (!asset && personalizableFields) {
      const ta = this.getTextarea?.();
      asset = {
        id: 'studio-current',
        type: 'prompt',
        title: ta?.value?.trim()?.slice(0, 80) || 'Studio Content',
        previewUrl: preview || undefined,
        fields: personalizableFields,
        metadata: { source: 'personalize-modal-fallback' },
      };
    }

    if (asset && profile) {
      const personalization = buildPersonalizationContext(profile);
      const ta = this.getTextarea?.();
      asset = {
        ...asset,
        fields: Array.isArray(asset.fields) ? asset.fields : [],
        metadata: {
          ...(asset.metadata || {}),
          personalization,
          personalizedPrompt: ta?.value ? replaceTokensInPrompt(ta.value, profile) : undefined,
        },
      };
    }

    if (asset) {
      const stripBlob = (value) => {
        if (typeof value === 'string') return value.startsWith('blob:') ? '' : value;
        if (Array.isArray(value)) return value.map(stripBlob).filter(Boolean);
        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value)
              .map(([key, nested]) => [key, stripBlob(nested)])
              .filter(([, nested]) => nested !== '' && nested !== undefined)
          );
        }
        return value;
      };
      asset = stripBlob(asset);
    }

    if (!asset) {
      this.errorMessage = 'This studio does not support sending content to Personalizer yet.';
      this.refreshBody();
      return;
    }

    const handoff = createPersonalizerHandoff({
      studioId: this.studioId,
      studioName: this.studioName,
      route: window.location.hash.replace(/^#/, '') || undefined,
      project,
      asset,
      selectedProfileId: contactId || undefined,
      returnRoute: this.returnRoute || undefined,
    });

    const saved = savePersonalizerHandoff(handoff);
    if (!saved) {
      this.errorMessage = 'Failed to save handoff. Please try again.';
      this.refreshBody();
      return;
    }

    this.onSendToPersonalizer({ contactId, profile, handoff });
    this.close();

    try {
      navigate('personalizer');
    } catch {
      window.location.hash = '#/personalizer';
    }
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
      if (this._activeTab() === 'business' && next.dataset.tab !== 'business') {
        this._readBusinessDraftFromDom();
      }
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

  /**
   * Re-render the modal body in place.
   *
   * This is called on every state change (tab switch, discovery step, toggle),
   * so it must not steal focus or re-register global listeners. It therefore
   * refreshes BaseModal's cached `focusableElements` directly rather than
   * calling `setupAccessibility()`, which would also auto-focus the first
   * element and add a duplicate document keydown handler.
   *
   * Focus and caret position are preserved across the re-render so typing in
   * the discover field isn't interrupted.
   */
  refreshBody() {
    if (!this.overlay) return;
    const body = this.overlay.querySelector('.modal-body');
    if (!body) return;

    // Remember where the user was.
    const active = document.activeElement;
    const activeId = active && body.contains(active) ? active.id : null;
    const selStart = activeId && 'selectionStart' in active ? active.selectionStart : null;
    const selEnd = activeId && 'selectionEnd' in active ? active.selectionEnd : null;

    body.innerHTML = this.renderBody();
    this._wireEvents();

    // Recompute the focus trap's element list without side effects; the cached
    // list would otherwise point at nodes we just detached, breaking Tab.
    if (this.content) {
      this.focusableElements = Array.from(
        this.content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.disabled);
    }

    // Put the user back where they were.
    if (activeId) {
      const restored = body.querySelector(`#${CSS.escape(activeId)}`);
      if (restored) {
        restored.focus();
        if (selStart !== null && typeof restored.setSelectionRange === 'function') {
          try { restored.setSelectionRange(selStart, selEnd); } catch {}
        }
      }
    }
  }
}

export default PersonalizeModal;
