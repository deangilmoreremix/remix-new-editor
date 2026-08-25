// PersonalizeModal.jsx
// BaseModal subclass: "Personalize for a contact" pop-up modal.
//
// Available in every video/image creation module (VideoStudio, ImageStudio,
// CinemaStudio, CharacterStudio, etc.). Replaces the legacy inline popover
// with a proper themed modal dialog.
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
// Token replacement at generation time is the host's responsibility
// (see `replaceTokensInPrompt` exported from ./personalize/personalizePopover.js).
//
// Usage:
//   const modal = new PersonalizeModal({ appId, getTextarea, onApply });
//   modal.open();
//   // or for a trigger button:
//   mountPersonalizeTrigger({ controlsContainer, getTextarea, appId });

import { BaseModal } from './BaseModal.jsx';
import {
  insertTokenAtCursor,
  replaceTokensInPrompt,
  getSelectedContactId,
  setSelectedContactId,
} from '../personalize/personalizePopover.js';

const CONTACTS_KEY = 'remix_contacts';
const PROFILES_KEY = 'remix_contact_profiles';

const TOKEN_LABELS = {
  firstName: 'firstName',
  lastName: 'lastName',
  fullName: 'fullName',
  company: 'company',
  companyName: 'companyName',
  title: 'title',
  email: 'email',
  location: 'location',
  industry: 'industry',
  companySummary: 'companySummary',
  painPoint: 'painPoint',
  product: 'product',
  service: 'service',
  interest: 'interest',
  buyingSignal: 'buyingSignal',
  tone: 'tone',
  intelligenceSummary: 'summary',
  brandColor: 'brandColor',
  logoUrl: 'logoUrl',
  avatarUrl: 'avatarUrl',
  github: 'github',
  linkedin: 'linkedin',
  twitter: 'twitter',
  website: 'website',
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

export class PersonalizeModal extends BaseModal {
  constructor(options = {}) {
    super({
      title: '🎯 Personalize for a contact',
      size: 'medium',
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
  }

  open() {
    super.open();
    // Wire all event handlers now that the DOM exists.
    this._wireEvents();
    this._refreshContactsList();
    this._refreshProfileSummary();
  }

  setBodyContent(html) {
    // Ensure parent updates and we re-wire events.
    super.setBodyContent(html);
    this._wireEvents();
  }

  renderBody() {
    return `
      <div class="personalize-modal">
        <div class="pm-discover-row">
          <input id="pm-input" type="text" placeholder="@username, email, or website" class="pm-input" />
          <button id="pm-discover" class="pm-btn pm-btn-primary">Discover</button>
        </div>
        <div id="pm-status" class="pm-status hidden"></div>
        <div id="pm-error" class="pm-error hidden"></div>

        <div class="pm-section">
          <div class="pm-section-label">Existing contacts</div>
          <div id="pm-contacts-list" class="pm-contacts-list">
            <div class="pm-empty">No contacts yet — paste a username above and click Discover.</div>
          </div>
        </div>

        <div id="pm-profile-summary" class="pm-profile hidden">
          <div class="pm-profile-header">
            <div id="pm-avatar" class="pm-avatar">?</div>
            <div class="pm-profile-meta">
              <div id="pm-name" class="pm-name"></div>
              <div id="pm-company" class="pm-company"></div>
              <div id="pm-pain" class="pm-pain"></div>
            </div>
          </div>
          <div id="pm-discovered" class="pm-discovered"></div>

          <div class="pm-section">
            <div class="pm-section-label">Insert into prompt (click a token)</div>
            <div id="pm-tokens" class="pm-tokens"></div>
          </div>
        </div>
      </div>

      <style>
        .personalize-modal { display: flex; flex-direction: column; gap: 16px; }
        .pm-discover-row { display: flex; gap: 8px; }
        .pm-input {
          flex: 1; background: rgba(0,0,0,0.5); border: 1px solid var(--border);
          border-radius: 8px; padding: 8px 12px; color: #fff; font-size: 14px;
        }
        .pm-input::placeholder { color: var(--dim); }
        .pm-input:focus { outline: none; border-color: var(--cyan); }
        .pm-btn {
          padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700;
          cursor: pointer; border: 1px solid transparent; transition: all 150ms ease;
        }
        .pm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pm-btn-primary { background: #fff; color: #000; }
        .pm-btn-primary:hover:not(:disabled) { background: #e5e5e5; }
        .pm-btn-secondary { background: rgba(255,255,255,0.05); color: #d1d5db; border-color: rgba(255,255,255,0.1); }
        .pm-btn-secondary:hover { background: rgba(255,255,255,0.1); }
        .pm-status { font-size: 12px; color: var(--muted); }
        .pm-error { font-size: 12px; color: var(--danger); }
        .pm-section { display: flex; flex-direction: column; gap: 8px; }
        .pm-section-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
        .pm-contacts-list { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; }
        .pm-empty { font-size: 12px; color: var(--dim); padding: 8px 0; }
        .pm-contact-row {
          display: flex; align-items: center; gap: 8px; width: 100%;
          text-align: left; padding: 8px 10px; border-radius: 8px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer; transition: background 150ms ease;
        }
        .pm-contact-row:hover { background: rgba(255,255,255,0.08); }
        .pm-contact-avatar {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: var(--muted);
        }
        .pm-contact-meta { flex: 1; min-width: 0; }
        .pm-contact-name { font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pm-contact-sub { font-size: 10px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pm-profile { display: flex; flex-direction: column; gap: 12px; padding: 12px; background: rgba(34,211,238,0.05); border: 1px solid rgba(34,211,238,0.1); border-radius: 12px; }
        .pm-profile-header { display: flex; align-items: flex-start; gap: 10px; }
        .pm-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #fff;
        }
        .pm-profile-meta { flex: 1; min-width: 0; }
        .pm-name { font-size: 14px; font-weight: 700; color: #fff; }
        .pm-company { font-size: 12px; color: var(--muted); }
        .pm-pain { font-size: 12px; color: var(--muted); margin-top: 4px; }
        .pm-discovered { display: flex; flex-direction: column; gap: 6px; }
        .pm-discovered-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .pm-discovered-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; min-width: 56px; }
        .pm-discovered-value { color: var(--text); }
        .pm-swatch { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); }
        .pm-chip { display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.05); color: var(--muted); margin-right: 4px; }
        .pm-chip-primary { background: rgba(34,211,238,0.1); border-color: rgba(34,211,238,0.2); color: var(--cyan); }
        .pm-tokens { display: flex; flex-wrap: wrap; gap: 6px; }
        .pm-token {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 8px; border-radius: 6px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          font-size: 10px; font-family: monospace; color: var(--muted);
          cursor: pointer; transition: all 150ms ease;
        }
        .pm-token:hover { background: rgba(34,211,238,0.15); border-color: rgba(34,211,238,0.3); color: var(--cyan); }
        .pm-token-preview { color: var(--dim); max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      </style>
    `;
  }

  // ─── Event wiring ────────────────────────────────────────────────────────
  _wireEvents() {
    if (!this.overlay) return;
    const $ = (sel) => this.overlay.querySelector(sel);

    const input = $('#pm-input');
    const discoverBtn = $('#pm-discover');
    if (discoverBtn) discoverBtn.onclick = (e) => { e.stopPropagation(); this._handleDiscover(); };
    if (input) input.onkeydown = (e) => { if (e.key === 'Enter') this._handleDiscover(); };

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
        row.className = 'pm-contact-row';
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
    const id = getSelectedContactId();
    const summary = this.overlay.querySelector('#pm-profile-summary');
    const applyBtn = this.overlay.querySelector('[data-personalize-action="apply"]');
    if (!summary) return;

    if (!id) {
      summary.classList.add('hidden');
      if (applyBtn) applyBtn.disabled = true;
      return;
    }
    const profile = _getProfile(id);
    const contact = _getContact(id);
    if (contact) {
      summary.classList.remove('hidden');
      this.overlay.querySelector('#pm-avatar').textContent = (contact.name || '?')[0]?.toUpperCase();
      this.overlay.querySelector('#pm-name').textContent = contact.name;
      this.overlay.querySelector('#pm-company').textContent = contact.company || contact.email || '';
      const pp = profile?.intelligence?.painPoints?.[0] || '';
      this.overlay.querySelector('#pm-pain').textContent = pp ? `Pain point: ${pp}` : (profile?.intelligence?.summary || '');
      this._renderDiscoveredContent(profile);
      this._renderTokenChips(profile);
      if (applyBtn) applyBtn.disabled = false;
    } else {
      summary.classList.add('hidden');
      if (applyBtn) applyBtn.disabled = true;
    }
  }

  _renderDiscoveredContent(profile) {
    const el = this.overlay?.querySelector('#pm-discovered');
    if (!el) return;
    el.innerHTML = '';
    const intel = profile?.intelligence || {};
    const company = profile?.company || {};
    const brand = profile?.brand || {};
    const social = profile?.social || {};
    const website = profile?.website || {};
    const assets = profile?.assets || {};
    const rows = [];

    const colors = brand.colors || {};
    const swatches = [colors.primary, colors.secondary, colors.accent].filter(Boolean);
    if (swatches.length) {
      rows.push(`
        <div class="pm-discovered-row">
          <span class="pm-discovered-label">Brand</span>
          <div style="display:flex;align-items:center;gap:6px;">
            ${swatches.map(c => `<span title="${escapeHtml(c)}" style="background:${escapeHtml(c)}" class="pm-swatch"></span>`).join('')}
            <span class="pm-discovered-value" style="color:var(--muted);font-size:10px;">${swatches.length} color${swatches.length > 1 ? 's' : ''}</span>
          </div>
        </div>`);
    }
    if (intel.tone) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Tone</span><span class="pm-chip">${escapeHtml(intel.tone)}</span></div>`);
    }
    if (company.industry) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Industry</span><span class="pm-discovered-value">${escapeHtml(company.industry)}</span></div>`);
    }
    if (intel.painPoints?.length) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Pain</span><div>${intel.painPoints.slice(0, 3).map(p => `<span class="pm-chip">${escapeHtml(p)}</span>`).join('')}</div></div>`);
    }
    if (intel.products?.length) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Products</span><div>${intel.products.slice(0, 3).map(p => `<span class="pm-chip pm-chip-primary">${escapeHtml(p)}</span>`).join('')}</div></div>`);
    }
    const socialLinks = [
      social.github ? { label: 'GitHub', url: social.github } : null,
      social.linkedin ? { label: 'LinkedIn', url: social.linkedin } : null,
      social.twitter ? { label: social.twitter.includes('x.com') ? 'X' : 'Twitter', url: social.twitter } : null,
      social.website ? { label: 'Website', url: social.website } : null,
      website.url ? { label: 'Site', url: website.url } : null,
    ].filter(Boolean);
    if (socialLinks.length) {
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Links</span><div>${socialLinks.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="pm-discovered-value" style="color:var(--cyan);text-decoration:underline dotted;">${escapeHtml(l.label)}</a>`).join(' ')}</div></div>`);
    }
    if (assets.avatar?.[0] || assets.logos?.[0]) {
      const imgs = [
        assets.avatar?.[0] && `<img src="${escapeHtml(assets.avatar[0])}" class="pm-avatar" style="width:32px;height:32px;" />`,
        assets.logos?.[0] && `<img src="${escapeHtml(assets.logos[0])}" style="height:32px;padding:2px 6px;background:rgba(255,255,255,0.05);border-radius:4px;border:1px solid rgba(255,255,255,0.1);object-fit:contain;" />`,
      ].filter(Boolean).join('');
      rows.push(`<div class="pm-discovered-row"><span class="pm-discovered-label">Assets</span><div style="display:flex;gap:6px;">${imgs}</div></div>`);
    }
    el.innerHTML = rows.length
      ? rows.join('')
      : '<div style="font-size:11px;color:var(--muted);">No enrichment yet — click Discover to run Maigret, GitHub, and website intelligence.</div>';
  }

  _renderTokenChips(profile) {
    const el = this.overlay?.querySelector('#pm-tokens');
    if (!el) return;
    el.innerHTML = '';
    const vars = profile?.variables || {};
    const tokens = Object.entries(vars).filter(([, v]) => v && typeof v === 'string');
    if (!tokens.length) {
      el.innerHTML = '<div style="font-size:10px;color:var(--muted);">No tokens yet — discover a contact to populate tokens.</div>';
      return;
    }
    tokens.forEach(([key, value]) => {
      const chip = document.createElement('button');
      const label = TOKEN_LABELS[key] || key;
      const preview = String(value).length > 18 ? String(value).slice(0, 16) + '…' : value;
      chip.className = 'pm-token';
      chip.title = `Insert {{${label}}} — current value: ${value}`;
      chip.innerHTML = `<span>{{${escapeHtml(label)}}}</span><span class="pm-token-preview">${escapeHtml(preview)}</span>`;
      chip.onclick = (e) => {
        e.stopPropagation();
        const ta = this.getTextarea?.();
        insertTokenAtCursor(ta, `{{${label}}}`);
      };
      el.appendChild(chip);
    });
  }

  _setSelectedContact(contactId) {
    setSelectedContactId(contactId || null);
    this._refreshProfileSummary();
    window.dispatchEvent(new CustomEvent('remix:contact-changed', { detail: { contactId } }));
  }

  // ─── Discover flow ───────────────────────────────────────────────────────
  async _handleDiscover() {
    const input = this.overlay.querySelector('#pm-input');
    const statusEl = this.overlay.querySelector('#pm-status');
    const errorEl = this.overlay.querySelector('#pm-error');
    const btn = this.overlay.querySelector('#pm-discover');
    const value = input.value.trim();
    errorEl.classList.add('hidden');
    statusEl.classList.add('hidden');
    if (!value) {
      errorEl.textContent = 'Enter a username, email, or website URL';
      errorEl.classList.remove('hidden');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Discovering...';
    statusEl.textContent = 'Scanning public profiles...';
    statusEl.classList.remove('hidden');

    try {
      const session = await getSession();
      let scanData = null;

      // 1) Maigret scan via /api/personalizer/scan
      try {
        if (session) {
          const res = await fetch('/api/personalizer/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ targetName: value, options: { top: 500, isParsingEnabled: true } }),
          });
          const data = await res.json();
          if (res.ok) scanData = data.scanData;
        }
      } catch {}

      // 2) GitHub lookup
      statusEl.textContent = 'Discovering GitHub profile...';
      try {
        const ghRes = await fetch(`https://api.github.com/users/${encodeURIComponent(value.replace(/^@/, '').split(' ')[0])}`, {
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
      } catch {}

      // 3) Website crawl
      statusEl.textContent = 'Crawling website...';
      try {
        const websiteUrl = value.startsWith('http') ? value : `https://${value.replace(/^@/, '').replace(/\s+/g, '')}.com`;
        const webRes = await fetch(websiteUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (webRes.ok) {
          const html = await webRes.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (!scanData) scanData = { platforms: [], summary: '', confidence: 0 };
          scanData.website = { url: websiteUrl, title: titleMatch?.[1]?.trim() };
        }
      } catch {}

      // 4) OpenAI enrichment
      statusEl.textContent = 'Extracting intelligence...';
      let intelligence = {};
      if (session) {
        try {
          const enrichRes = await fetch('/api/personalizer/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              appId: this.appId,
              mode: 'lead-summary',
              targetName: value,
              targetCompany: scanData?.platforms?.[0]?.ids_data?.company,
              manualNotes: '',
              scanResults: scanData,
            }),
          });
          if (enrichRes.ok) {
            const data = await enrichRes.json();
            intelligence = data.output?.metadata || {};
          }
        } catch {}
      }

      // 5) Persist contact + profile
      const name = scanData?.platforms?.[0]?.ids_data?.name
        || (value.includes('@') ? value.split('@')[0] : value.replace(/^@/, ''));
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
        sourceId: scanData?.platforms?.find(p => p.platform === 'github')?.username || value,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const variables = {
        firstName, lastName, fullName: name,
        company: contact.company,
        email: value.includes('@') ? value : '',
        industry: intelligence.industry || '',
        painPoint: intelligence.painPoints?.[0] || '',
        tone: intelligence.tone || 'professional',
        avatarUrl: contact.avatarUrl,
      };
      const profile = {
        id: contactId,
        contact: { name, firstName, lastName, email: contact.email, company: contact.company, location: contact.location, avatarUrl: contact.avatarUrl },
        company: { name: contact.company },
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
          tone: intelligence.tone,
        },
        campaign: {},
        history: { discoveries: [{ source: 'personalize-modal', timestamp: new Date().toISOString(), success: true }], generations: [], interactions: [] },
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
      statusEl.textContent = `✓ Discovered ${contact.name}${contact.company ? ` at ${contact.company}` : ''}`;
      this._refreshContactsList();
      this._refreshProfileSummary();
      setTimeout(() => statusEl.classList.add('hidden'), 3000);
    } catch (err) {
      errorEl.textContent = err.message || 'Discovery failed';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Discover';
    }
  }

  _handleApply() {
    const id = getSelectedContactId();
    const profile = id ? _getProfile(id) : null;
    if (profile) {
      // Replace {{tokens}} in the host textarea.
      const ta = this.getTextarea?.();
      if (ta) {
        ta.value = replaceTokensInPrompt(ta.value, profile);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      this.onApply({ contactId: id, profile });
    }
    this.close();
  }

  // ─── Public helpers ──────────────────────────────────────────────────────
  getActiveProfile() {
    const id = getSelectedContactId();
    return id ? _getProfile(id) : null;
  }

  refresh() {
    this._refreshContactsList();
    this._refreshProfileSummary();
  }
}

export default PersonalizeModal;
