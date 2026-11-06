// src/components/LeadFinderStudio.js
//
// Lead Finder page (route: #/leadfinder).
//
// The lead finder itself is the Personalization + Lead Finder modal ported
// from OpenHiggsBolt (src/features/personalization): "Find business" searches
// OpenStreetMap by niche + location, scores each prospect, and saves leads to
// Supabase through /api/personalization/leads. This page is the dark,
// on-brand entry point to it: it opens the modal at the Find-business step and
// lists the leads already saved, with their pipeline stage.

import { mountStudioChrome } from '../lib/studioChrome.js';
import { installPersonalizationApiAuth } from '../features/personalization/lib/apiAuth.ts';

const STAGES = ['New', 'Qualified', 'Shortlisted', 'Demo Created', 'Contacted', 'Responded', 'Converted', 'Not Interested'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function openLeadFinder(trigger) {
  const { openPersonalization } = await import('../features/personalization/mount.jsx');
  openPersonalization({ studioId: 'leadfinder', studioName: 'Lead Finder', title: 'Lead Finder', trigger });
}

async function fetchLeads() {
  const response = await fetch('/api/personalization/leads', { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) return { error: 'Sign in to see your saved leads.', leads: [] };
  if (response.status >= 500) return { error: 'Saved leads are not available right now. Please try again later.', leads: [] };
  if (!response.ok) return { error: payload?.error || 'Could not load saved leads.', leads: [] };
  return { error: null, leads: Array.isArray(payload?.leads) ? payload.leads : [] };
}

function safeHref(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function renderLeadRow(lead) {
  const business = lead?.business || {};
  const row = el('div', 'grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto] gap-2 md:gap-4 items-start md:items-center px-4 py-3 border-b border-white/5 last:border-b-0');

  const nameCol = el('div', 'min-w-0');
  const name = el('div', 'text-sm font-bold text-white truncate', business.name || 'Unnamed business');
  if (lead.starred) {
    const star = el('span', 'ml-1.5 text-primary', '★');
    star.setAttribute('aria-label', 'Starred');
    name.appendChild(star);
  }
  const meta = el('div', 'text-xs text-secondary truncate', [business.category || lead.niche, lead.location].filter(Boolean).join(' · '));
  nameCol.append(name, meta);

  const contactCol = el('div', 'min-w-0 text-xs text-secondary flex flex-col gap-0.5');
  if (business.address) contactCol.appendChild(el('span', 'truncate', business.address));
  const links = el('div', 'flex flex-wrap gap-x-3 gap-y-0.5');
  const website = safeHref(business.website);
  if (website) {
    const a = el('a', 'text-primary hover:underline truncate', website.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    a.href = website;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    links.appendChild(a);
  }
  if (business.phone) links.appendChild(el('span', 'text-white/70', business.phone));
  if (links.childNodes.length) contactCol.appendChild(links);

  const stage = STAGES.includes(lead.stage) ? lead.stage : 'New';
  const badge = el('span', 'justify-self-start md:justify-self-end inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap', stage);
  if (stage === 'Converted') badge.className += ' bg-primary/10 border border-primary/30 text-white border-primary/30';
  else if (stage === 'Not Interested') badge.className += ' border-white/10 text-muted';
  else badge.className += ' border-primary/40 bg-primary/10 text-primary';

  row.append(nameCol, contactCol, badge);
  return row;
}

export function LeadFinderStudio() {
  installPersonalizationApiAuth();

  const container = el('div', 'w-full h-full flex flex-col overflow-hidden bg-app-bg text-white');
  mountStudioChrome(container, { title: 'Lead Finder', currentRoute: 'leadfinder' });

  const scroll = el('div', 'flex-1 overflow-y-auto');
  const inner = el('div', 'max-w-5xl mx-auto w-full px-4 md:px-8 py-8 flex flex-col gap-6');
  scroll.appendChild(inner);
  container.appendChild(scroll);

  // Hero
  const hero = el('section', 'rounded-2xl border border-white/10 bg-panel-bg p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6');
  const heroText = el('div', 'flex-1 min-w-0');
  heroText.appendChild(el('div', 'text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary mb-2', 'Lead Finder'));
  heroText.appendChild(el('h1', 'text-2xl md:text-3xl font-black text-white mb-2', 'Find local businesses that need video'));
  heroText.appendChild(el('p', 'text-sm text-secondary max-w-xl',
    'Search a niche and location, review scored prospects, pull their real logos and photos from their website, and turn any of them into a personalized demo video.'));
  const heroActions = el('div', 'flex flex-col sm:flex-row gap-2 shrink-0');
  const findBtn = el('button', 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-5 py-3 text-sm font-bold text-white shadow-glow hover:bg-primary/20 transition-colors', 'Find businesses');
  findBtn.type = 'button';
  findBtn.addEventListener('click', () => openLeadFinder(findBtn));
  heroActions.appendChild(findBtn);
  const brandBtn = el('button', 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:border-primary/60 hover:text-primary transition-colors', '✦ Find My Brand');
  brandBtn.type = 'button';
  brandBtn.title = 'Paste a business website to pull its logo, photos and branding (free)';
  brandBtn.addEventListener('click', async () => {
    const { openFreeDiscovery } = await import('../features/personalization/mount.jsx');
    openFreeDiscovery({ trigger: brandBtn });
  });
  heroActions.appendChild(brandBtn);
  hero.append(heroText, heroActions);
  inner.appendChild(hero);

  // Saved leads
  const leadsSection = el('section', 'rounded-2xl border border-white/10 bg-panel-bg overflow-hidden');
  const leadsHeader = el('div', 'flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10');
  const leadsTitle = el('h2', 'text-sm font-extrabold uppercase tracking-wide text-white', 'Saved leads');
  const refreshBtn = el('button', 'rounded-lg px-3 py-1.5 text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors', 'Refresh');
  refreshBtn.type = 'button';
  leadsHeader.append(leadsTitle, refreshBtn);
  const leadsBody = el('div', '');
  leadsSection.append(leadsHeader, leadsBody);
  inner.appendChild(leadsSection);

  const showMessage = (text) => {
    leadsBody.replaceChildren(el('div', 'px-4 py-8 text-center text-sm text-secondary', text));
  };

  const load = async () => {
    showMessage('Loading saved leads…');
    try {
      const { error, leads } = await fetchLeads();
      if (error) return showMessage(error);
      if (!leads.length) return showMessage('No saved leads yet. Use “Find businesses” and save the prospects you like.');
      leadsTitle.textContent = `Saved leads (${leads.length})`;
      leadsBody.replaceChildren(...leads.map(renderLeadRow));
    } catch {
      showMessage('Could not load saved leads.');
    }
  };

  refreshBtn.addEventListener('click', load);
  load();

  return container;
}
