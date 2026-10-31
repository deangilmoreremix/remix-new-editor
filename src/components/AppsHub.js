import { navigate } from '../lib/router.js';
import { getStudioThumbnail, createThumbnailImg } from '../lib/thumbnails.js';
import { muapi } from '../lib/muapi.js';
import { showToast } from '../lib/loading.js';
import { TEMPLATE_APPS, ECOSYSTEM_APPS } from '../data/upstreamApps.js';

const CORE_STUDIOS = [
  { id: 'image', name: 'Image Studio', description: 'Generate images with 20+ AI models', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>', badge: '20+ models', color: 'bg-primary/10 text-primary border-primary/20' },
  { id: 'video', name: 'Video Studio', description: 'Create AI videos from text and images', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>', badge: '15+ models', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { id: 'cinema', name: 'Cinema Studio', description: 'Cinematic shots with camera controls', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>', badge: '6 cameras', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { id: 'animate', name: 'Animate Studio', description: 'Animate images and create motion graphics', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>', badge: 'Motion', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
];

const TOOL_STUDIOS = [
  { id: 'storyboard', name: 'Storyboard Studio', description: 'Multi-frame generation for sequences', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="6" height="8" rx="1"/><rect x="9" y="3" width="6" height="8" rx="1"/><rect x="16" y="3" width="6" height="8" rx="1"/><rect x="2" y="13" width="6" height="8" rx="1"/><rect x="9" y="13" width="6" height="8" rx="1"/><rect x="16" y="13" width="6" height="8" rx="1"/></svg>', badge: 'Frames', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  { id: 'effects', name: 'Effects Studio', description: 'Apply 350+ visual effects', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>', badge: '350+ effects', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { id: 'edit', name: 'Edit Studio', description: 'Remove objects, backgrounds, reframe', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>', badge: '9 tools', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  { id: 'upscale', name: 'Upscale Suite', description: 'AI upscale and enhance images', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>', badge: '3 methods', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { id: 'character', name: 'Character Studio', description: 'Consistent character generation', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', badge: 'Face ID', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { id: 'commercial', name: 'Commercial Studio', description: 'Product photography and ads', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>', badge: 'Ads', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { id: 'viral', name: 'Smart Video Viral', description: 'AI-powered viral video generation', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>', badge: 'Viral', color: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' },
];

const AI_APPS = [
  { id: 'audio', name: 'Audio Studio', description: 'Generate music, speech, and sound effects', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>', badge: 'AI Audio', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { id: 'avatar', name: 'Avatar Studio', description: 'AI avatars and lip sync video generation', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 11v2"/><path d="M8 13h8"/></svg>', badge: 'AI Avatars', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  { id: 'training', name: 'Training Studio', description: 'Train custom LoRA models from your images', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>', badge: 'LoRA', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { id: 'videotools', name: 'Video Tools', description: 'Upscale, edit, translate, and enhance videos', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>', badge: 'Video Tools', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  { id: 'chat', name: 'Chat Studio', description: 'AI-powered text generation and conversation', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>', badge: 'LLM', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { id: 'lipsync', name: 'Lip Sync', description: 'Animate portraits or sync lips to audio with AI', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>', badge: 'Lip Sync', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { id: 'personalizer', name: 'Personalizer', description: 'Personalize templates and assets with your data', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>', badge: 'Personalize', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  { id: 'video-agent', name: 'Video Agent', description: 'AI-powered video production assistant', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>', badge: 'Agent', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { id: 'ai-vfx', name: 'AI VFX', description: 'AI-powered visual effects and compositing', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l2.39 6.95H22l-6.19 4.5L18.18 22 12 17.5 5.82 22l2.37-8.55L2 8.95h7.61L12 2z"/><circle cx="12" cy="12" r="3"/></svg>', badge: 'VFX', color: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' },
  { id: 'brand', name: 'Brand Studio', description: 'Brand-consistent content generation', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>', badge: 'Brand', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
];

export function AppsHub() {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-y-auto bg-app-bg';

  const inner = document.createElement('div');
  inner.className = 'w-full px-4 md:px-8 py-8 md:py-12';

  const heroSection = document.createElement('div');
  heroSection.className = 'mb-10 animate-fade-in-up flex flex-col items-center text-center';
  // Upstream Explore Apps layout: badge pill, large hero, three step cards.
  heroSection.innerHTML = `
    <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider mb-5">
      <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> Explore apps
    </span>
    <h1 class="text-4xl md:text-5xl font-black text-white tracking-tight mb-3">Every creative tool, one place</h1>
    <p class="text-white/50 text-sm md:text-base max-w-xl mb-8">Studios, effects, editors and AI apps. Pick one and start creating.</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-4xl text-left">
      ${[
        ['1', 'Choose an app', 'Image, video, cinema, audio and more — each studio is tuned for one job.'],
        ['2', 'Create', 'Describe what you want, pick a model and press Generate.'],
        ['3', 'Keep it', 'Results land in your Library, ready to edit, render or publish.'],
      ].map(([n, t, d]) => `
        <div class="rounded-2xl p-6 bg-[#111]/80 border border-white/10">
          <div class="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center mb-3">${n}</div>
          <div class="text-sm font-bold text-white mb-1">${t}</div>
          <div class="text-xs text-white/50 leading-relaxed">${d}</div>
        </div>`).join('')}
    </div>
  `;
  inner.appendChild(heroSection);

  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'mb-8 animate-fade-in-up flex justify-center';
  searchWrapper.style.animationDelay = '0.1s';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search tools and templates...';
  searchInput.className = 'w-full max-w-md bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';
  searchWrapper.appendChild(searchInput);
  inner.appendChild(searchWrapper);

  const recentRow = createRecentRow();
  if (recentRow) inner.appendChild(recentRow);

  inner.appendChild(createSection('Core Studios', CORE_STUDIOS.map(s => ({
    ...s,
    thumbnail: getStudioThumbnail(s.id),
    onClick: () => { saveRecent(s.id, s.name); navigate(s.id); },
  })), true));

  inner.appendChild(createSection('Tools & Editors', TOOL_STUDIOS.map(s => ({
    ...s,
    thumbnail: getStudioThumbnail(s.id),
    onClick: () => { saveRecent(s.id, s.name); navigate(s.id); },
  })), true));

  inner.appendChild(createSection('AI Apps', AI_APPS.map(s => ({
    ...s,
    thumbnail: getStudioThumbnail(s.id),
    onClick: () => { saveRecent(s.id, s.name); navigate(s.id); },
  })), true));

  const noResults = document.createElement('div');
  noResults.className = 'hidden text-center py-16 text-white/50 text-sm';
  inner.appendChild(noResults);

  // Upstream Explore Apps: revenue-ready template apps (GitHub + demo links)
  // and the wider MuAPI ecosystem (request access).
  inner.appendChild(createTemplateSection('Revenue-ready templates', 'Fork, add your MuAPI key, deploy — Stripe is pre-wired.', TEMPLATE_APPS, null));
  inner.appendChild(createTemplateSection('MuAPI ecosystem apps', 'Ask for a template and we\'ll send you the details.', ECOSYSTEM_APPS, (app) => openInterestModal(app)));
  const comingSoon = document.createElement('div');
  comingSoon.className = 'flex justify-center pb-10';
  comingSoon.innerHTML = '<div class="inline-flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/5"><span class="block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span><span class="text-[9px] font-black text-white/40 uppercase tracking-widest">MuAPI ecosystem — more templates coming soon</span></div>';
  inner.appendChild(comingSoon);

  container.appendChild(inner);

  searchInput.oninput = () => {
    const q = searchInput.value.trim().toLowerCase();
    let total = 0;
    container.querySelectorAll('[data-app-section]').forEach(section => {
      let visible = 0;
      section.querySelectorAll('[data-searchable]').forEach(el => {
        const match = el.dataset.searchable.toLowerCase().includes(q);
        el.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      // Hide whole sections with no matches and keep their counts honest.
      section.style.display = visible ? '' : 'none';
      const count = section.querySelector('[data-app-count]');
      if (count) count.textContent = String(visible);
      total += visible;
    });
    noResults.textContent = `No apps match “${searchInput.value.trim()}”.`;
    noResults.classList.toggle('hidden', total > 0);
  };

  return container;
}

function createSection(title, items, isStudio = false) {
  const section = document.createElement('div');
  section.className = 'mb-10 animate-fade-in-up';

  const heading = document.createElement('h2');
  heading.className = 'text-lg font-bold text-white mb-4 flex items-center gap-2';
  heading.innerHTML = `${title} <span class="text-xs font-medium text-muted" data-app-count>${items.length}</span>`;
  section.dataset.appSection = '';
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = isStudio
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
    : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all group overflow-hidden';
    card.dataset.searchable = `${item.name} ${item.description || ''}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    if (item.thumbnail) {
      const heroHeight = isStudio ? 'h-32' : 'h-20';
      const heroWrapper = document.createElement('div');
      heroWrapper.className = `thumb-hero ${heroHeight}`;

      const skeleton = document.createElement('div');
      skeleton.className = `thumb-skeleton absolute inset-0`;
      heroWrapper.appendChild(skeleton);

      const img = createThumbnailImg(item.thumbnail, item.name, 'absolute inset-0');
      heroWrapper.appendChild(img);
      card.appendChild(heroWrapper);
    }

    const content = document.createElement('div');
    content.className = 'p-3';
    content.innerHTML = `
      <div class="flex items-start gap-3 mb-1">
        <div class="w-8 h-8 rounded-lg ${item.color || 'bg-white/5 text-secondary border-white/10'} border flex items-center justify-center shrink-0">
          ${item.icon || ''}
        </div>
        <div class="min-w-0">
          <div class="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">${item.name}</div>
          ${item.description ? `<div class="text-[11px] text-muted mt-0.5 line-clamp-2">${item.description}</div>` : ''}
        </div>
      </div>
      ${item.badge ? `<div class="text-[10px] font-bold text-muted mt-1 ml-11">${item.badge}</div>` : ''}
    `;
    card.appendChild(content);

    card.onclick = item.onClick;
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.onClick();
      }
    };
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

const KNOWN_APP_IDS = new Set([...CORE_STUDIOS, ...TOOL_STUDIOS, ...AI_APPS].map((s) => s.id));

function createRecentRow() {
  try {
    const recent = JSON.parse(localStorage.getItem('recent_tools') || '[]');
    if (recent.length === 0) return null;

    const section = document.createElement('div');
    section.className = 'mb-8 animate-fade-in-up';

    const heading = document.createElement('h2');
    heading.className = 'text-sm font-bold text-muted uppercase tracking-wider mb-3';
    heading.textContent = 'Recently Used';
    section.appendChild(heading);

    const row = document.createElement('div');
    row.className = 'flex gap-2 overflow-x-auto no-scrollbar pb-2';

    recent.slice(0, 8).forEach(r => {
      const chip = document.createElement('button');
      chip.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-white hover:bg-white/10 transition-all whitespace-nowrap';
      chip.textContent = r.name;
      chip.onclick = () => {
        // Studio ids like 'video-agent' or 'ai-vfx' contain dashes too, so only
        // ids that aren't a known app are treated as templates.
        if (KNOWN_APP_IDS.has(r.id)) navigate(r.id);
        else navigate(`template/${r.id}`);
      };
      row.appendChild(chip);
    });

    section.appendChild(row);
    return section;
  } catch { return null; }
}

function saveRecent(id, name) {
  try {
    const recent = JSON.parse(localStorage.getItem('recent_tools') || '[]');
    const filtered = recent.filter(r => r.id !== id);
    filtered.unshift({ id, name });
    localStorage.setItem('recent_tools', JSON.stringify(filtered.slice(0, 12)));
  } catch { /* ignore */ }
}


const LINK_BTN = 'flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all border';

/** A grid of external apps. `onRequest` set → both buttons open the access modal; otherwise real links. */
function createTemplateSection(title, subtitle, apps, onRequest) {
  const section = document.createElement('div');
  section.className = 'mb-10 animate-fade-in-up';
  section.dataset.appSection = '';

  const heading = document.createElement('h2');
  heading.className = 'text-lg font-bold text-white mb-1 flex items-center gap-2';
  heading.innerHTML = `${title} <span class="text-xs font-medium text-muted" data-app-count>${apps.length}</span>`;
  const sub = document.createElement('p');
  sub.className = 'text-xs text-white/40 mb-4';
  sub.textContent = subtitle;
  section.append(heading, sub);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
  apps.forEach((app) => {
    const card = document.createElement('div');
    card.className = 'group bg-[#0a0a0a] border border-white/5 rounded-lg flex flex-col overflow-hidden transition-all duration-300 hover:border-white/10 hover:bg-[#0f0f0f]';
    card.dataset.searchable = `${app.name} ${app.description || ''} ${app.category || ''}`;

    const thumb = document.createElement('div');
    thumb.className = 'relative h-40 w-full overflow-hidden bg-white/5';
    if (app.thumbnail) {
      const img = document.createElement('img');
      img.src = app.thumbnail;
      img.alt = app.name;
      img.loading = 'lazy';
      img.className = 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-110';
      img.onerror = () => { img.remove(); thumb.classList.add('bg-gradient-to-br', 'from-primary/10', 'to-purple-600/10'); };
      thumb.appendChild(img);
    }
    card.appendChild(thumb);

    const body = document.createElement('div');
    body.className = 'p-4 flex flex-col flex-1 gap-3';
    const name = document.createElement('h3');
    name.className = 'text-sm font-bold text-white truncate';
    name.textContent = app.name;
    const cat = document.createElement('p');
    cat.className = 'text-[10px] text-white/40 font-bold uppercase tracking-widest';
    cat.textContent = app.category || 'Template';
    const desc = document.createElement('p');
    desc.className = 'text-xs text-white/50 leading-relaxed line-clamp-2 min-h-[2.5rem]';
    desc.textContent = app.description || '';
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-2 pt-1';

    const mk = (label, href) => {
      const el = document.createElement(onRequest ? 'button' : 'a');
      if (onRequest) { el.type = 'button'; el.onclick = () => onRequest(app); }
      else { el.href = href || '#'; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
      el.className = `${LINK_BTN} ${label === 'GitHub' ? 'bg-white/5 text-white border-white/5 hover:bg-white/10' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'}`;
      el.textContent = label;
      return el;
    };
    actions.append(mk('GitHub', app.repo), mk('Demo', app.hosted));
    body.append(name, cat, desc, actions);
    card.appendChild(body);
    grid.appendChild(card);
  });
  section.appendChild(grid);
  return section;
}

function openInterestModal(app) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center px-6';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" data-close></div>
    <div class="relative bg-[#0a0a0a] border border-white/10 w-full max-w-md rounded-2xl p-8 space-y-6 shadow-2xl" role="dialog" aria-modal="true">
      <div class="flex flex-col items-center text-center space-y-3">
        <h2 class="text-2xl font-black text-white uppercase tracking-tight" data-title></h2>
        <p class="text-sm font-medium text-white/40 leading-relaxed px-4" data-body></p>
      </div>
      <div class="space-y-3">
        <button type="button" data-submit class="w-full py-4 bg-primary text-black rounded-md text-sm font-black uppercase tracking-widest disabled:opacity-50">Get Template</button>
        <button type="button" data-close class="w-full py-4 bg-white/5 border border-white/10 text-white/60 rounded-md text-sm font-bold uppercase tracking-widest hover:bg-white/10">Maybe Later</button>
      </div>
    </div>`;
  overlay.querySelector('[data-title]').textContent = `Deploy ${app.name}`;
  overlay.querySelector('[data-body]').textContent = `Enter your details and we'll send you the ${app.name} template along with setup instructions so you can deploy and start earning immediately.`;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  const submit = overlay.querySelector('[data-submit]');
  submit.addEventListener('click', async () => {
    submit.disabled = true;
    submit.textContent = 'Sending details…';
    try {
      await muapi.registerAppInterest(app.name);
      showToast("Got it! We'll send you the template details shortly.", 'success');
      setTimeout(close, 1200);
    } catch (err) {
      submit.disabled = false;
      submit.textContent = 'Get Template';
      const needsKey = /key|auth|401|403/i.test(err.message || '');
      showToast(needsKey ? 'Add your MuAPI key first, then try again.' : 'Failed to register interest. Please try again later.', 'error', 5000);
    }
  });
  document.body.appendChild(overlay);
}
