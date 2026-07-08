// src/components/personalize/personalizePopover.js
//
// Self-contained "Personalize" inline popover that mounts inside any AI
// creation app (Video Studio, Image Studio, etc.). The popover is the UI
// surface that makes the discovered contact content VISIBLE to the user and
// gives them click-to-insert TOKEN buttons to COPY that content into the
// prompt textarea at the cursor.
//
// Responsibilities:
//   - Render a "Personalize" button + dropdown popover
//   - Discover a contact via Maigret + GitHub + website crawl
//   - Run server-side OpenAI enrichment (/api/personalizer/generate)
//   - Persist contact + profile to localStorage
//   - Show the discovered data (brand colors, pain points, products, tone,
//     social links, assets) as labelled rows inside the popover
//   - Render all profile variables as clickable token chips that insert
//     `{{token}}` placeholders into the prompt at the cursor
//   - Auto-open when `remix_open_personalize === 'true'` is set
//
// Returns a handle with `refresh()`, `getActiveProfile()`, and a DOM event
// `remix:contact-changed` dispatched on the window whenever the active
// contact changes (so the host can re-render its own UI).
//
// Token replacement at generation time is the host's responsibility —
// this module only handles insertion. See `replaceTokensInPrompt()`.

import { listContacts as _listContacts, getContact as _getContact, getProfile as _getProfile, setSelectedContactId, getSelectedContactId } from '../../lib/contactStore.js';

const POPOVER_HTML = `
  <div class="p-4 border-b border-white/5">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-white">Personalize for a contact</h3>
      <button id="pop-close" class="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="flex gap-2">
      <input id="pop-input" type="text" placeholder="@username, email, or website" class="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50" />
      <button id="pop-discover" class="px-3 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-gray-200 transition disabled:opacity-50">Discover</button>
    </div>
    <div id="pop-status" class="mt-2 text-xs text-secondary hidden"></div>
    <div id="pop-error" class="mt-2 text-xs text-red-400 hidden"></div>
  </div>
  <div class="p-4 border-b border-white/5">
    <div class="text-[10px] text-muted uppercase tracking-wider mb-2">Existing contacts</div>
    <div id="pop-contacts-list" class="space-y-1 max-h-32 overflow-y-auto custom-scrollbar"></div>
  </div>
  <div id="pop-profile-summary" class="hidden p-4 bg-primary/5 border-t border-primary/10 max-h-[60vh] overflow-y-auto custom-scrollbar">
    <div class="flex items-start gap-3">
      <div id="pop-avatar" class="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0"></div>
      <div class="min-w-0 flex-1">
        <div id="pop-name" class="text-sm font-bold text-white truncate"></div>
        <div id="pop-company" class="text-xs text-muted truncate"></div>
        <div id="pain-points" class="mt-2 text-xs text-secondary"></div>
      </div>
    </div>
    <div id="pop-discovered-content" class="mt-3 space-y-2"></div>
    <div class="mt-3 pt-3 border-t border-white/5">
      <div class="text-[10px] text-muted uppercase tracking-wider mb-2">Insert into prompt (click a token)</div>
      <div id="pop-tokens-list" class="flex flex-wrap gap-1.5"></div>
    </div>
    <div class="mt-3 flex gap-2">
      <button id="pop-apply" class="flex-1 px-3 py-2 bg-primary text-black rounded-lg text-xs font-bold hover:bg-primary-hover transition">Apply personalization</button>
      <button id="pop-clear" class="px-3 py-2 bg-white/5 text-gray-300 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition">Clear</button>
    </div>
  </div>
`;

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

/**
 * Insert a `{{token}}` placeholder at the textarea cursor.
 * @param {HTMLTextAreaElement} ta
 * @param {string} token - e.g. `{{firstName}}`
 */
export function insertTokenAtCursor(ta, token) {
  if (!ta) return;
  ta.focus();
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  const needsSpaceBefore = before.length && !/\s$/.test(before);
  const insertion = (needsSpaceBefore ? ' ' : '') + token + ' ';
  ta.value = before + insertion + after;
  const newPos = start + insertion.length;
  ta.setSelectionRange(newPos, newPos);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Replace `{{token}}` placeholders in a prompt with values from the
 * profile's `variables` map. Unresolved tokens are left in place so the
 * user can see what was missing.
 *
 * @param {string} prompt
 * @param {object} profile
 * @returns {string}
 */
export function replaceTokensInPrompt(prompt, profile) {
  if (!prompt || !profile) return prompt;
  const vars = profile.variables || {};
  if (!Object.keys(vars).length) return prompt;
  return prompt.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
    const v = vars[key];
    return v ? String(v) : match;
  });
}

/**
 * Mount the Personalize inline popover into `controlsContainer`.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.controlsContainer - the flex row that holds model/aspect/etc. buttons
 * @param {string} [opts.label] - button label, default "Personalize"
 * @param {string} [opts.tooltip] - button tooltip
 * @param {() => HTMLTextAreaElement|null} opts.getTextarea - returns the prompt textarea (looked up lazily)
 * @param {string} [opts.appId] - app id passed to /api/personalizer/generate
 * @returns {{ button: HTMLButtonElement, refresh: () => void, getActiveProfile: () => object|null, popover: HTMLDivElement }}
 */
export function mountPersonalizePopover({ controlsContainer, label = 'Personalize', tooltip = 'Personalize with a discovered contact', getTextarea, appId = 'ai-video-agency' }) {
  const button = document.createElement('button');
  button.id = 'v-contact-btn';
  button.className = 'flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap';
  button.setAttribute('data-tooltip', tooltip);
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-60 text-secondary"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    <span id="v-contact-btn-label" class="text-xs font-bold text-white group-hover:text-primary transition-colors">${label}</span>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" class="opacity-20 group-hover:opacity-100 transition-opacity"><path d="M6 9l6 6 6-6"/></svg>
  `;

  const popover = document.createElement('div');
  popover.className = 'hidden absolute bottom-full mb-2 left-0 w-[420px] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden';
  popover.style.cssText = 'box-shadow: 0 20px 60px rgba(0,0,0,0.6);';
  popover.innerHTML = POPOVER_HTML;

  button.style.position = 'relative';
  button.appendChild(popover);
  controlsContainer.appendChild(button);

  // ===== Open / close =====
  button.onclick = (e) => {
    e.stopPropagation();
    popover.classList.toggle('hidden');
    if (!popover.classList.contains('hidden')) {
      refreshContactsList();
      refreshProfileSummary();
    }
  };

  document.addEventListener('click', (e) => {
    if (!button.contains(e.target)) popover.classList.add('hidden');
  });

  popover.querySelector('#pop-close').onclick = (e) => {
    e.stopPropagation();
    popover.classList.add('hidden');
  };

  // ===== Render functions =====

  function refreshContactsList() {
    const list = popover.querySelector('#pop-contacts-list');
    list.innerHTML = '';
    try {
      const contacts = _listContacts();
      if (contacts.length === 0) {
        list.innerHTML = '<div class="text-xs text-muted py-2">No contacts yet. Paste a username above and click Discover.</div>';
        return;
      }
      contacts.slice(0, 8).forEach((c) => {
        const row = document.createElement('button');
        row.className = 'w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/10 border border-white/5 transition flex items-center gap-2';
        row.innerHTML = `
          <div class="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-secondary">${(c.name || '?')[0]?.toUpperCase()}</div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-bold text-white truncate">${escapeHtml(c.name)}</div>
            <div class="text-[10px] text-muted truncate">${escapeHtml(c.email || c.company || '')}</div>
          </div>
        `;
        row.onclick = () => {
          setSelectedContact(c.id);
          popover.classList.add('hidden');
        };
        list.appendChild(row);
      });
    } catch {}
  }

  function refreshProfileSummary() {
    const id = getSelectedContactId();
    const summary = popover.querySelector('#pop-profile-summary');
    const btnLabel = button.querySelector('#v-contact-btn-label');

    if (!id) {
      summary.classList.add('hidden');
      btnLabel.textContent = label;
      return;
    }

    const profile = _getProfile(id);
    const contact = _getContact(id);

    if (contact) {
      summary.classList.remove('hidden');
      popover.querySelector('#pop-avatar').textContent = (contact.name || '?')[0]?.toUpperCase();
      popover.querySelector('#pop-name').textContent = contact.name;
      popover.querySelector('#pop-company').textContent = contact.company || contact.email || '';
      const pp = profile?.intelligence?.painPoints?.[0] || '';
      popover.querySelector('#pain-points').textContent = pp ? `Pain point: ${pp}` : (profile?.intelligence?.summary || '');

      renderDiscoveredContent(profile);
      renderTokenChips(profile);

      btnLabel.textContent = contact.name;
    } else {
      summary.classList.add('hidden');
      btnLabel.textContent = label;
    }
  }

  function renderDiscoveredContent(profile) {
    const el = popover.querySelector('#pop-discovered-content');
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
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-muted uppercase tracking-wider w-14 shrink-0">Brand</span>
          <div class="flex items-center gap-1.5">
            ${swatches.map(c => `<span title="${escapeHtml(c)}" style="background:${escapeHtml(c)}" class="w-4 h-4 rounded-full border border-white/20"></span>`).join('')}
            <span class="text-[10px] text-muted ml-1">${swatches.length} color${swatches.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      `);
    }

    if (intel.tone) {
      rows.push(`<div class="flex items-center gap-2"><span class="text-[10px] text-muted uppercase tracking-wider w-14 shrink-0">Tone</span><span class="text-[11px] text-white px-2 py-0.5 rounded-md bg-white/5 border border-white/10">${escapeHtml(intel.tone)}</span></div>`);
    }

    if (company.industry) {
      rows.push(`<div class="flex items-center gap-2"><span class="text-[10px] text-muted uppercase tracking-wider w-14 shrink-0">Industry</span><span class="text-[11px] text-secondary">${escapeHtml(company.industry)}</span></div>`);
    }

    if (intel.painPoints?.length) {
      rows.push(`
        <div class="flex items-start gap-2">
          <span class="text-[10px] text-muted uppercase tracking-wider w-14 shrink-0 mt-0.5">Pain</span>
          <div class="flex flex-wrap gap-1">
            ${intel.painPoints.slice(0, 3).map(p => `<span class="text-[10px] text-secondary bg-white/[0.03] border border-white/5 px-1.5 py-0.5 rounded">${escapeHtml(p)}</span>`).join('')}
          </div>
        </div>
      `);
    }

    if (intel.products?.length) {
      rows.push(`
        <div class="flex items-start gap-2">
          <span class="text-[10px] text-muted uppercase tracking-wider w-14 shrink-0 mt-0.5">Products</span>
          <div class="flex flex-wrap gap-1">
            ${intel.products.slice(0, 3).map(p => `<span class="text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">${escapeHtml(p)}</span>`).join('')}
          </div>
        </div>
      `);
    }

    const socialLinks = [
      social.github ? { label: 'GitHub', url: social.github } : null,
      social.linkedin ? { label: 'LinkedIn', url: social.linkedin } : null,
      social.twitter ? { label: social.twitter.includes('x.com') ? 'X' : 'Twitter', url: social.twitter } : null,
      social.website ? { label: 'Website', url: social.website } : null,
      website.url ? { label: 'Site', url: website.url } : null,
    ].filter(Boolean);
    if (socialLinks.length) {
      rows.push(`
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] text-muted uppercase tracking-wider w-14 shrink-0">Links</span>
          ${socialLinks.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="text-[10px] text-secondary hover:text-primary underline decoration-dotted">${escapeHtml(l.label)}</a>`).join(' ')}
        </div>
      `);
    }

    if (assets.avatar?.[0] || assets.logos?.[0]) {
      const imgs = [
        assets.avatar?.[0] && `<img src="${escapeHtml(assets.avatar[0])}" class="w-8 h-8 rounded-full border border-white/10 object-cover" />`,
        assets.logos?.[0] && `<img src="${escapeHtml(assets.logos[0])}" class="h-8 px-1.5 bg-white/5 rounded border border-white/10 object-contain" />`,
      ].filter(Boolean).join('');
      rows.push(`
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-muted uppercase tracking-wider w-14 shrink-0">Assets</span>
          <div class="flex items-center gap-2">${imgs}</div>
        </div>
      `);
    }

    el.innerHTML = rows.length
      ? rows.join('')
      : '<div class="text-[11px] text-muted">No enrichment yet — click Discover to run Maigret, GitHub, and website intelligence.</div>';
  }

  function renderTokenChips(profile) {
    const el = popover.querySelector('#pop-tokens-list');
    if (!el) return;
    el.innerHTML = '';

    const vars = profile?.variables || {};
    const tokens = Object.entries(vars).filter(([, v]) => v && typeof v === 'string');

    if (!tokens.length) {
      el.innerHTML = '<div class="text-[10px] text-muted">No tokens yet — discover a contact to populate tokens.</div>';
      return;
    }

    tokens.forEach(([key, value]) => {
      const chip = document.createElement('button');
      const label = TOKEN_LABELS[key] || key;
      const preview = String(value).length > 18 ? String(value).slice(0, 16) + '…' : value;
      chip.className = 'group inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-primary/15 border border-white/10 hover:border-primary/30 text-[10px] font-mono text-secondary hover:text-primary transition';
      chip.title = `Insert {{${label}}} — current value: ${value}`;
      chip.innerHTML = `<span>{{${escapeHtml(label)}}}</span><span class="text-muted group-hover:text-primary/60 max-w-[80px] truncate">${escapeHtml(preview)}</span>`;
      chip.onclick = (e) => {
        e.stopPropagation();
        const ta = getTextarea?.();
        insertTokenAtCursor(ta, `{{${label}}}`);
      };
      el.appendChild(chip);
    });
  }

  function setSelectedContact(contactId) {
    setSelectedContactId(contactId || null);
    refreshProfileSummary();
    window.dispatchEvent(new CustomEvent('remix:contact-changed', { detail: { contactId } }));
  }

  // ===== Discover handler =====
  popover.querySelector('#pop-discover').onclick = async (e) => {
    e.stopPropagation();
    const input = popover.querySelector('#pop-input').value.trim();
    const statusEl = popover.querySelector('#pop-status');
    const errorEl = popover.querySelector('#pop-error');
    const btn = popover.querySelector('#pop-discover');

    errorEl.classList.add('hidden');
    statusEl.classList.add('hidden');

    if (!input) {
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
      try {
        if (session) {
          const res = await fetch('/api/personalizer/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ targetName: input, options: { top: 500, isParsingEnabled: true } }),
          });
          const data = await res.json();
          if (res.ok) scanData = data.scanData;
        }
      } catch {}

      statusEl.textContent = 'Discovering GitHub profile...';
      try {
        const ghRes = await fetch(`https://api.github.com/users/${encodeURIComponent(input.replace(/^@/, '').split(' ')[0])}`, {
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

      statusEl.textContent = 'Crawling website...';
      let websiteText = null;
      try {
        const websiteUrl = input.startsWith('http') ? input : `https://${input.replace(/^@/, '').replace(/\s+/g, '')}.com`;
        const webRes = await fetch(websiteUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (webRes.ok) {
          const html = await webRes.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (!scanData) scanData = { platforms: [], summary: '', confidence: 0 };
          scanData.website = { url: websiteUrl, title: titleMatch?.[1]?.trim() };
          websiteText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
        }
      } catch {}

      statusEl.textContent = 'Extracting intelligence...';
      let intelligence = {};
      if (session) {
        try {
          const enrichRes = await fetch('/api/personalizer/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              appId,
              mode: 'lead-summary',
              targetName: input,
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

      const name = scanData?.platforms?.[0]?.ids_data?.name
        || (input.includes('@') ? input.split('@')[0] : input.replace(/^@/, ''));
      const contactId = crypto.randomUUID();
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
        sourceId: scanData?.platforms?.find(p => p.platform === 'github')?.username || input,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const variables = {
        firstName,
        lastName,
        fullName: name,
        company: contact.company,
        email: input.includes('@') ? input : '',
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
        history: { discoveries: [{ source: 'inline-popover', timestamp: new Date().toISOString(), success: true }], generations: [], interactions: [] },
        variables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const contacts = JSON.parse(localStorage.getItem('remix_contacts') || '[]');
      contacts.unshift(contact);
      localStorage.setItem('remix_contacts', JSON.stringify(contacts));

      const profiles = JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]');
      profiles.unshift(profile);
      localStorage.setItem('remix_contact_profiles', JSON.stringify(profiles));

      setSelectedContact(contactId);

      statusEl.textContent = `✓ Discovered ${contact.name}${contact.company ? ` at ${contact.company}` : ''}`;
      refreshContactsList();
      refreshProfileSummary();

      setTimeout(() => statusEl.classList.add('hidden'), 3000);
    } catch (err) {
      errorEl.textContent = err.message || 'Discovery failed';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Discover';
    }
  };

  popover.querySelector('#pop-apply').onclick = (e) => {
    e.stopPropagation();
    popover.classList.add('hidden');
  };

  popover.querySelector('#pop-clear').onclick = (e) => {
    e.stopPropagation();
    setSelectedContact(null);
    refreshContactsList();
  };

  function getActiveProfile() {
    const id = getSelectedContactId();
    if (!id) return null;
    return _getProfile(id);
  }

  function refresh() {
    refreshProfileSummary();
  }

  // Auto-open if requested (e.g., from AIVideoCreator or another AI app)
  if (typeof localStorage !== 'undefined' && localStorage.getItem('remix_open_personalize') === 'true') {
    localStorage.removeItem('remix_open_personalize');
    setTimeout(() => {
      popover.classList.remove('hidden');
      popover.querySelector('#pop-input')?.focus();
      refreshContactsList();
      refreshProfileSummary();
    }, 100);
  } else {
    refresh();
  }

  return { button, popover, refresh, getActiveProfile };
}
