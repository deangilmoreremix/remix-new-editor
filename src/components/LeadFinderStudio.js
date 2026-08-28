import { mountStudioChrome } from '../lib/studioChrome.js';
import { saveLeads, loadLeads, deleteLead, exportCSV, getCities, buildMessage, checkInstagram, generateMessage, generateBrief, searchLeads } from '../lib/leadFinderApi.js';
import { NICHES, getGroupedNiches } from '../lib/leadFinderCategories.js';
import { createStudioButton } from '../lib/studioButton.js';
import { createHeroSection } from '../lib/thumbnails.js';

// Inject scoped styles for custom select styling
(function injectLeadFinderSelectStyles() {
  if (document.getElementById('leadfinder-select-styles')) return;
  const style = document.createElement('style');
  style.id = 'leadfinder-select-styles';
  style.textContent = `
    .leadfinder-studio select {
      width: 100% !important;
      padding: 8px 32px 8px 12px !important;
      background: #1a1a1a !important;
      border: 1px solid rgba(255,255,255,0.10) !important;
      border-radius: 12px !important;
      color: #ffffff !important;
      font-size: 14px !important;
      appearance: none !important;
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      outline: none !important;
      transition: all 0.15s !important;
      cursor: pointer !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23a1a1aa' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E") !important;
      background-position: right 12px center !important;
      background-repeat: no-repeat !important;
      background-size: 16px 16px !important;
    }
    .leadfinder-studio select:focus {
      border-color: #d9ff00 !important;
      box-shadow: 0 0 0 1px rgba(217,255,0,0.3) !important;
    }
    .leadfinder-studio .select-arrow {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      transition: opacity 0.15s;
    }
    .leadfinder-studio select:focus + .select-arrow {
      opacity: 0;
    }
  `;
  document.head.appendChild(style);
})();

// ── Design tokens (neon yellow-green studio system) ──────────────────────────
const COLORS = {
  primary: '#d9ff00',
  primaryHover: '#c4e600',
  primarySubtle: 'rgba(217,255,0,0.12)',
  bg: '#050505',
  panel: '#0a0a0a',
  surface: '#111',
  surfaceLight: '#1a1a1a',
  card: '#141414',
  border: 'rgba(255,255,255,0.10)',
  borderSubtle: 'rgba(255,255,255,0.05)',
  text: '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted: '#52525b',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
};

const ACCENT = COLORS.primary, ACCENT_DARK = COLORS.primaryHover, BG = COLORS.bg, BORDER = COLORS.border, BORDER2 = COLORS.borderSubtle, INK2 = COLORS.textSecondary, MUTED = COLORS.textMuted;
const STAGES = ['New','Contacted','Reply','Deal','Lost'];
const STAGE_COLORS = { New:{bg:'rgba(59,130,246,0.15)',fg:'#60a5fa'}, Contacted:{bg:'rgba(245,158,11,0.15)',fg:'#fbbf24'}, Reply:{bg:'rgba(217,255,0,0.12)',fg:'#d9ff00'}, Deal:{bg:'rgba(34,197,94,0.15)',fg:'#4ade80'}, Lost:{bg:'rgba(239,68,68,0.15)',fg:'#f87171'} };
const COUNTRIES = [{code:'GB',label:'United Kingdom'},{code:'US',label:'United States'},{code:'AU',label:'Australia'},{code:'CA',label:'Canada'},{code:'IE',label:'Ireland'},{code:'DE',label:'Germany'},{code:'FR',label:'France'},{code:'IN',label:'India'},{code:'JP',label:'Japan'},{code:'BR',label:'Brazil'},{code:'MX',label:'Mexico'},{code:'OTHER',label:'Other'}];
const LANGS = [{code:'en',label:'English'},{code:'hi',label:'Hindi'},{code:'hinglish',label:'Hinglish'},{code:'es',label:'Spanish'}];

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function loadSettings() { try { return JSON.parse(localStorage.getItem('leadfinder_settings')||'{}'); } catch { return {}; } }
function saveSettings(s) { localStorage.setItem('leadfinder_settings', JSON.stringify(s)); }
function showToast(message, type) { const toast = document.createElement('div'); toast.className = 'fixed bottom-5 left-5 px-4 py-2 rounded-lg text-sm font-medium z-50'; toast.style.background = type === 'error' ? COLORS.error : type === 'success' ? COLORS.success : COLORS.primary; toast.style.color = '#000'; toast.textContent = message; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); document.body.appendChild(toast); setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000); }

const SELECT_CHEVRON = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23a1a1aa\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")';
function createStudioSelect(options, ariaLabel, placeholder, onSelect) {
  const wrapper = document.createElement('div');
  wrapper.className = 'relative';
  
  // Hidden native select for form semantics
  const select = document.createElement('select');
  select.setAttribute('aria-label', ariaLabel);
  select.style.cssText = 'position: absolute; opacity: 0; width: 100%; height: 100%; top: 0; left: 0; cursor: pointer; z-index: 10;';
  
  const opt = document.createElement('option'); opt.value = ''; opt.textContent = placeholder || 'Select...'; select.appendChild(opt);
  for (const o of options) { const option = document.createElement('option'); option.value = o.value; option.textContent = o.label; select.appendChild(option); }
  
  // Custom trigger button
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm text-white text-left flex items-center justify-between transition-all hover:border-white/20';
  trigger.setAttribute('aria-label', ariaLabel);
  trigger.innerHTML = `<span class="truncate">${placeholder || 'Select...'}</span><svg width="16" height="16" viewBox="0 0 20 20" fill="none" class="shrink-0"><path stroke="#a1a1aa" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 8l4 4 4-4"/></svg>`;
  
  // Dropdown menu
  const menu = document.createElement('div');
  menu.className = 'absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden z-50 hidden shadow-2xl';
  
  const updateTrigger = (value, label) => {
    trigger.querySelector('span').textContent = label;
    select.value = value;
    if (onSelect) onSelect(value, label);
  };
  
  const openMenu = () => {
    // Close other dropdowns
    document.querySelectorAll('.studio-dropdown-menu').forEach(m => m.classList.add('hidden'));
    menu.classList.remove('hidden');
    trigger.style.borderColor = '#d9ff00';
    trigger.style.boxShadow = '0 0 0 1px rgba(217,255,0,0.3)';
  };
  
  const closeMenu = () => {
    menu.classList.add('hidden');
    trigger.style.borderColor = 'rgba(255,255,255,0.10)';
    trigger.style.boxShadow = 'none';
  };
  
  trigger.onclick = (e) => {
    e.stopPropagation();
    if (menu.classList.contains('hidden')) { openMenu(); } else { closeMenu(); }
  };
  
  for (const o of options) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'w-full px-3 py-2 text-xs font-bold text-left hover:bg-white/10 transition-colors text-white';
    item.textContent = o.label;
    item.onclick = (e) => {
      e.stopPropagation();
      updateTrigger(o.value, o.label);
      closeMenu();
      trigger.focus();
    };
    menu.appendChild(item);
  }
  
  // Close on outside click
  const closeHandler = (e) => {
    if (!wrapper.contains(e.target)) {
      closeMenu();
      document.removeEventListener('click', closeHandler);
    }
  };
  menu.addEventListener('transitionend', () => {
    if (!menu.classList.contains('hidden')) {
      document.addEventListener('click', closeHandler);
    }
  });
  
  wrapper.appendChild(select);
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  
  return { wrapper, select, trigger, updateTrigger, openMenu, closeMenu };
}

export function LeadFinderStudio() {
  const container = document.createElement('div'); container.className = 'leadfinder-studio w-full h-full flex flex-col overflow-hidden animate-fade-in-up'; container.style.background = BG; container.style.fontFamily = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",sans-serif'; container.style.color = COLORS.text;
  mountStudioChrome(container, { title: 'Smart Video Lead Finder', currentRoute: 'leadfinder' });
  let leads = [], filteredLeads = [], selectedId = null, settings = loadSettings(), boardViewActive = false;
  const content = document.createElement('div'); content.className = 'flex-1 flex flex-col overflow-hidden'; container.appendChild(content);

  // ── Hero Section ───────────────────────────────────────────────────────────
  const heroWrapper = document.createElement('div'); heroWrapper.className = 'flex flex-col items-center mb-2 md:mb-4 w-full';
  const hero = createHeroSection('leadfinder', 'h-32 md:h-44 mb-3');
  if (hero) {
    const heroContent = document.createElement('div'); heroContent.className = 'absolute bottom-0 left-0 right-0 p-5 z-10';
    heroContent.innerHTML = `
      <div class="mb-2 text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">Lead Finder</div>
      <h1 class="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
        Smart Video Lead Finder
      </h1>
      <p class="text-white/60 text-sm font-medium mt-1">Discover and connect with your next client</p>
    `;
    hero.appendChild(heroContent);
    heroWrapper.appendChild(hero);
    content.appendChild(heroWrapper);
  }

  // ── Search Bar (glass prompt bar) ─────────────────────────────────────────
  const searchBar = document.createElement('div'); searchBar.className = 'w-full max-w-3xl mx-auto bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 md:p-5 flex flex-col gap-3 shadow-3xl mb-3 animate-fade-in-up';
  const searchRow = document.createElement('div'); searchRow.className = 'flex flex-wrap items-end gap-3';

  // City refresh helper - must be defined before country select onChange uses it
  const refreshCities = async () => {
    const code = countrySelect.value;
    if (code === 'OTHER' || !code) { cityOther.style.display = 'block'; citySelect.style.display = 'none'; return; }
    cityOther.style.display = 'none'; citySelect.style.display = 'block';
    citySelect.disabled = true; citySelect.innerHTML = '<option>Loading cities...</option>';
    try {
      const r = await getCities(code);
      citySelect.innerHTML = '<option value="">Select a town...</option><option value="__type__">Other — type a name...</option>';
      for (const c of r.cities||[]) { const o = document.createElement('option'); o.value = c; o.textContent = c; citySelect.appendChild(o); }
    } catch (err) {
      citySelect.innerHTML = '<option value="__type__">Error loading — type a name</option>';
      statusLine.textContent = '⚠ Could not load cities. Try typing manually.'; statusLine.style.color = COLORS.warning;
      setTimeout(() => { statusLine.textContent = 'Pick a trade, country, and city, then Find Businesses.'; statusLine.style.color = COLORS.textSecondary; }, 4000);
    } finally { citySelect.disabled = false; }
  };

  // Trade field
  const nicheField = document.createElement('div'); nicheField.className = 'flex flex-col gap-1 flex-1 min-w-[160px]';
  const nicheLabel = document.createElement('label'); nicheLabel.className = 'text-[10px] uppercase tracking-wider font-semibold'; nicheLabel.style.color = COLORS.textSecondary; nicheLabel.textContent = 'Trade';
  const grouped = getGroupedNiches(); const nicheOptions = [{value:'',label:'All trades...'}]; for (const [seg, niches] of Object.entries(grouped)) { for (const n of niches) nicheOptions.push({value:n,label:n}); }
  const { wrapper: nicheWrapper, select: nicheSelect } = createStudioSelect(nicheOptions, 'Select trade', 'All trades...');
  const optAll = nicheSelect.querySelector('option'); if(optAll) optAll.value = '';
  nicheField.append(nicheLabel, nicheWrapper);

  // Country field
  const countryField = document.createElement('div'); countryField.className = 'flex flex-col gap-1 min-w-[140px]';
  const countryLabel = document.createElement('label'); countryLabel.className = 'text-[10px] uppercase tracking-wider font-semibold'; countryLabel.style.color = COLORS.textSecondary; countryLabel.textContent = 'Country';
  const countryOptions = COUNTRIES.map(c => ({value:c.code,label:c.label}));
  const { wrapper: countryWrapper, select: countrySelect, updateTrigger: updateCountry } = createStudioSelect(countryOptions, 'Select country', 'Select country...');
  updateCountry('GB', 'United Kingdom');
  countryField.append(countryLabel, countryWrapper);

  // City field
  const cityField = document.createElement('div'); cityField.className = 'flex flex-col gap-1 flex-1 min-w-[180px]';
  const cityLabel = document.createElement('label'); cityLabel.className = 'text-[10px] uppercase tracking-wider font-semibold'; cityLabel.style.color = COLORS.textSecondary; cityLabel.textContent = 'City / Town';
  const { wrapper: citySelectWrapper, select: citySelect } = createStudioSelect([{value:'',label:'Select a town...'}], 'Select city', 'Select a town...');
  const cityOther = document.createElement('input'); cityOther.type = 'text'; cityOther.placeholder = 'Type a city name...'; cityOther.className = 'w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all'; cityOther.style.display = 'none'; cityOther.setAttribute('aria-label', 'Type a city name');
  cityField.append(cityLabel, citySelectWrapper, cityOther);

  countrySelect.onchange = refreshCities; citySelect.onchange = () => { if (citySelect.value === '__type__') { cityOther.style.display = 'block'; cityOther.focus(); } else cityOther.style.display = 'none'; };

  // Mode field
  const modeField = document.createElement('div'); modeField.className = 'flex flex-col gap-1 min-w-[140px]';
  const modeLabel = document.createElement('label'); modeLabel.className = 'text-[10px] uppercase tracking-wider font-semibold'; modeLabel.style.color = COLORS.textSecondary; modeLabel.textContent = 'Mode';
  const modeOptions = [{value:'no_website',label:'No website'},{value:'bad_website',label:'Bad website'},{value:'all',label:'Both'}];
  const { wrapper: modeWrapper, select: modeSelect } = createStudioSelect(modeOptions, 'Select search mode', 'Select mode...');
  modeField.append(modeLabel, modeWrapper);

  // Action buttons
  const actions = document.createElement('div'); actions.className = 'flex items-center gap-2 ml-auto';
  const settingsBtn = createStudioButton({ text: 'Settings', emoji: '⚙', variant: 'secondary', ariaLabel: 'Settings' });
  const searchBtn = createStudioButton({ text: 'Find Businesses', variant: 'primary', ariaLabel: 'Find businesses' });
  actions.append(searchBtn, settingsBtn);

  const statusLine = document.createElement('div'); statusLine.className = 'w-full text-xs'; statusLine.style.color = COLORS.textSecondary; statusLine.textContent = 'Pick a trade, country, and city, then Find Businesses.';
  searchRow.append(nicheField, countryField, cityField, modeField, actions);
  searchBar.append(searchRow, statusLine); content.appendChild(searchBar);

  // ── Main Area ─────────────────────────────────────────────────────────────
  const mainArea = document.createElement('div'); mainArea.className = 'flex-1 flex overflow-hidden'; content.appendChild(mainArea);

  // List panel
  const listPanel = document.createElement('div'); listPanel.className = 'flex-1 flex flex-col overflow-hidden'; listPanel.style.borderRight = `1px solid ${BORDER}`; mainArea.appendChild(listPanel);

  // Filters bar
  const filtersBar = document.createElement('div'); filtersBar.className = 'px-4 py-2 flex items-center gap-2 flex-wrap bg-[#111] border-b border-white/5';
  const { wrapper: stageFilterWrapper, select: stageFilterSel } = createStudioSelect(STAGES.map(s => ({value:s,label:s})), 'Filter by stage', 'All stages');
  const starFilterBtn = createStudioButton({ text: '★ Starred', variant: 'secondary', ariaLabel: 'Toggle starred filter' });
  let starredMode = false;
  const exportCsvBtn = createStudioButton({ text: '⬇ Export CSV', variant: 'secondary', ariaLabel: 'Export leads to CSV' });
  const boardToggleBtn = createStudioButton({ text: 'Board view', variant: 'secondary', ariaLabel: 'Toggle board view' });
  const countLabel = document.createElement('span'); countLabel.className = 'text-xs ml-auto'; countLabel.style.color = COLORS.textSecondary;
  filtersBar.append(stageFilterWrapper, starFilterBtn, exportCsvBtn, boardToggleBtn, countLabel); listPanel.appendChild(filtersBar);

  const listContainer = document.createElement('div'); listContainer.className = 'flex-1 overflow-y-auto p-3 space-y-2'; listPanel.appendChild(listContainer);
  const boardContainer = document.createElement('div'); boardContainer.className = 'flex-1 overflow-x-auto p-4 hidden'; boardContainer.style.background = COLORS.surface; listPanel.appendChild(boardContainer);

  // Detail panel
  const detailPanel = document.createElement('div'); detailPanel.className = 'w-[420px] flex-shrink-0 overflow-y-auto'; detailPanel.style.background = COLORS.panel; mainArea.appendChild(detailPanel);

  // ── Stats Panel ───────────────────────────────────────────────────────────
  const statsPanel = document.createElement('div'); statsPanel.className = 'fixed bottom-5 right-5 w-[260px] rounded-xl overflow-hidden z-50'; statsPanel.style.background = COLORS.panel; statsPanel.style.border = `1px solid ${BORDER}`; statsPanel.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
  const statsHeader = document.createElement('div'); statsHeader.className = 'px-4 py-3 font-bold text-sm text-black cursor-pointer flex justify-between items-center'; statsHeader.style.background = COLORS.primary; statsHeader.innerHTML = '<span>My outreach</span><span class="text-xs">▼</span>'; statsPanel.appendChild(statsHeader);
  const statsBody = document.createElement('div'); statsBody.className = 'p-4'; statsPanel.appendChild(statsBody);
  let statsOpen = true; statsHeader.onclick = () => { statsOpen = !statsOpen; statsBody.style.display = statsOpen ? 'block' : 'none'; statsHeader.querySelector('span:last-child').textContent = statsOpen ? '▼' : '▶'; };
  container.appendChild(statsPanel);

  // ── Settings Modal ────────────────────────────────────────────────────────
  const settingsOverlay = document.createElement('div'); settingsOverlay.className = 'fixed inset-0 z-[200] flex items-center justify-center'; settingsOverlay.style.background = 'rgba(0,0,0,0.7)'; settingsOverlay.style.backdropFilter = 'blur(4px)'; settingsOverlay.style.display = 'none';
  const settingsModal = document.createElement('div'); settingsModal.className = 'bg-[#1a1a1a] rounded-2xl p-6 w-[480px] max-h-[85vh] overflow-y-auto'; settingsModal.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)'; settingsOverlay.appendChild(settingsModal);
  const settingsTitle = document.createElement('div'); settingsTitle.className = 'text-lg font-bold mb-4'; settingsTitle.style.color = COLORS.text; settingsTitle.textContent = 'Smart Video Lead Finder Settings'; settingsModal.appendChild(settingsTitle);
  function sf(label, type, key, ph) { const w = document.createElement('div'); w.className = 'mb-3'; const l = document.createElement('label'); l.className = 'text-[10px] uppercase tracking-wider font-semibold block mb-1'; l.style.color = COLORS.textSecondary; l.textContent = label; const i = document.createElement(type==='select'?'select':'input'); if (type==='select') { i.setAttribute('aria-label', label); } else { i.className = 'w-full px-3 py-2 bg-[#111] border border-white/10 rounded-xl text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary transition-all'; i.type = type; i.placeholder = ph||''; i.value = settings[key]||''; } w.append(l,i); return {w,i}; }
  const nameF = sf('Your name','text','name','Your name'); const portF = sf('Portfolio link','text','portfolio','https://...'); const turnF = sf('Turnaround time','text','turnaround','5 days');
  const langF = sf('Message language','select','lang'); for (const l of LANGS) { const o = document.createElement('option'); o.value = l.code; o.textContent = l.label; langF.i.appendChild(o); } langF.i.value = settings.lang||'en';
  const aiF = sf('AI provider','select','ai_provider'); for (const p of [{code:'none',label:'None (templates only)'},{code:'openai',label:'OpenAI'},{code:'anthropic',label:'Anthropic'}]) { const o = document.createElement('option'); o.value = p.code; o.textContent = p.label; aiF.i.appendChild(o); } aiF.i.value = settings.ai_provider||'none';
  const openaiF = sf('OpenAI API key','password','openai_api_key','sk-...'); const anthropicF = sf('Anthropic API key','password','anthropic_api_key','sk-ant-...');
  settingsModal.append(nameF.w, portF.w, turnF.w, langF.w, aiF.w, openaiF.w, anthropicF.w);
  const sbr = document.createElement('div'); sbr.className = 'flex gap-2 justify-end mt-5';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'px-4 py-2 rounded-lg text-sm font-medium border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all'; cancelBtn.textContent = 'Cancel'; cancelBtn.onclick = () => { settingsOverlay.style.display = 'none'; };
  const saveBtn2 = document.createElement('button'); saveBtn2.className = 'px-4 py-2 rounded-lg text-sm font-bold text-black bg-[#d9ff00] hover:bg-white transition-all'; saveBtn2.textContent = 'Save'; saveBtn2.setAttribute('aria-label', 'Save settings');
  saveBtn2.onclick = () => { settings = { name:nameF.i.value.trim(), portfolio:portF.i.value.trim(), turnaround:turnF.i.value.trim()||'5 days', lang:langF.i.value, ai_provider:aiF.i.value, openai_api_key:openaiF.i.value.trim(), anthropic_api_key:anthropicF.i.value.trim() }; saveSettings(settings); settingsOverlay.style.display = 'none'; showToast('Settings saved','success'); };
  sbr.append(cancelBtn, saveBtn2); settingsModal.appendChild(sbr); container.appendChild(settingsOverlay);
  settingsBtn.onclick = () => { nameF.i.value=settings.name||''; portF.i.value=settings.portfolio||''; turnF.i.value=settings.turnaround||'5 days'; langF.i.value=settings.lang||'en'; aiF.i.value=settings.ai_provider||'none'; openaiF.i.value=settings.openai_api_key||''; anthropicF.i.value=settings.anthropic_api_key||''; settingsOverlay.style.display = 'flex'; setTimeout(() => cancelBtn.focus(), 50); };
  settingsOverlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { settingsOverlay.style.display = 'none'; settingsBtn.focus(); } });

  // ── Brief Modal ───────────────────────────────────────────────────────────
  const briefOverlay = document.createElement('div'); briefOverlay.className = 'fixed inset-0 z-[200] flex items-center justify-center'; briefOverlay.style.background = 'rgba(0,0,0,0.7)'; briefOverlay.style.backdropFilter = 'blur(4px)'; briefOverlay.style.display = 'none';
  const briefModal = document.createElement('div'); briefModal.className = 'bg-[#1a1a1a] rounded-2xl p-6 w-[600px] max-h-[80vh] overflow-y-auto'; briefModal.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)'; briefOverlay.appendChild(briefModal);
  const briefTitle = document.createElement('div'); briefTitle.className = 'text-lg font-bold mb-2'; briefTitle.style.color = COLORS.text; briefModal.appendChild(briefTitle);
  const briefTabs = document.createElement('div'); briefTabs.className = 'flex gap-2 mb-4';
  const briefTabQuick = document.createElement('button'); briefTabQuick.className = 'text-xs font-semibold px-3 py-1.5 rounded-full bg-[#d9ff00] text-black transition-all'; briefTabQuick.textContent = '⚡ Quick brief';
  const briefTabAI = document.createElement('button'); briefTabAI.className = 'text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10 text-white transition-all hover:bg-white/10'; briefTabAI.textContent = '✨ AI brief';
  briefTabs.append(briefTabQuick, briefTabAI); briefModal.appendChild(briefTabs);
  const briefContent = document.createElement('pre'); briefContent.className = 'text-xs p-4 rounded-lg whitespace-pre-wrap font-sans max-h-[50vh] overflow-y-auto bg-[#111] border border-white/5'; briefContent.textContent = 'Generating...'; briefModal.appendChild(briefContent);
  const briefBtnRow = document.createElement('div'); briefBtnRow.className = 'flex gap-2 mt-4';
  const briefCopy = document.createElement('button'); briefCopy.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg text-black bg-[#d9ff00] hover:bg-white transition-all'; briefCopy.textContent = 'Copy Brief'; briefCopy.setAttribute('aria-label', 'Copy brief to clipboard');
  briefCopy.onclick = () => { navigator.clipboard.writeText(briefContent.textContent).then(()=>{briefCopy.textContent='Copied!';setTimeout(()=>briefCopy.textContent='Copy Brief',1500);}); };
  const briefClose = document.createElement('button'); briefClose.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-all'; briefClose.textContent = 'Close'; briefClose.onclick = () => { briefOverlay.style.display = 'none'; };
  briefBtnRow.append(briefCopy, briefClose); briefModal.appendChild(briefBtnRow); container.appendChild(briefOverlay);

  // ── Helper Functions ──────────────────────────────────────────────────────
  function chip(e, bg, fg) { const el = document.createElement('span'); el.className = 'text-[10px] font-semibold px-1.5 py-0.5 rounded-full'; el.style.background = bg; el.style.color = fg; el.textContent = e; return el; }
  function secH(text) { const h = document.createElement('div'); h.className = 'text-[10px] uppercase tracking-wider font-semibold mt-1'; h.style.color = COLORS.textSecondary; h.textContent = text; return h; }

  function applyFilters() { filteredLeads = leads.filter(l => { if (stageFilterSel.value && l.stage !== stageFilterSel.value) return false; if (starredMode && !l.starred) return false; return true; }); renderList(); }

  function renderList() { listContainer.innerHTML = ''; if (!filteredLeads.length) { const e = document.createElement('div'); e.className = 'text-center py-12 text-sm'; e.style.color = COLORS.textSecondary; e.textContent = leads.length === 0 ? 'No leads yet. Run a search above.' : 'No leads match filters.'; listContainer.appendChild(e); countLabel.textContent = '0 leads'; return; } countLabel.textContent = `${filteredLeads.length} lead${filteredLeads.length!==1?'s':''}`; for (const l of filteredLeads) listContainer.appendChild(renderCard(l)); }

  function renderCard(l) {
    const card = document.createElement('div'); card.className = `bg-[#141414] border border-white/10 rounded-xl p-3 cursor-pointer transition-all ${selectedId===l.id?'border-primary':''}`; card.style.background = selectedId===l.id ? COLORS.primarySubtle : COLORS.card;
    const top = document.createElement('div'); top.className = 'flex justify-between items-start gap-2';
    const nw = document.createElement('div'); nw.className = 'min-w-0 flex-1'; const nr = document.createElement('div'); nr.className = 'flex items-center gap-1.5';
    const star = document.createElement('button'); star.className = `text-base leading-none border-none bg-transparent cursor-pointer ${l.starred?'text-amber-400':'text-white/30'} hover:text-amber-400 transition-colors`; star.textContent = '★'; star.setAttribute('aria-label', l.starred ? 'Unstar lead' : 'Star lead'); star.onclick = e => { e.stopPropagation(); toggleStar(l.id); };
    const name = document.createElement('span'); name.className = 'font-semibold text-[14.5px] truncate'; name.style.color = COLORS.text; name.textContent = l.name; nr.append(star, name);
    const meta = document.createElement('div'); meta.className = 'text-xs mt-0.5 truncate'; meta.style.color = COLORS.textMuted; meta.textContent = `${l.niche} · ${l.city}`; nw.append(nr, meta);
    const sc = document.createElement('div'); sc.className = 'text-right shrink-0'; const sv = document.createElement('div'); sv.className = 'text-lg font-bold leading-none'; sv.style.color = ACCENT; sv.textContent = l.score;
    const sb = document.createElement('span'); sb.className = 'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1'; const c = STAGE_COLORS[l.stage]||STAGE_COLORS.New; sb.style.background = c.bg; sb.style.color = c.fg; sb.textContent = l.stage; sc.append(sv, sb);
    top.append(nw, sc);
    const chips = document.createElement('div'); chips.className = 'flex gap-1.5 mt-2 flex-wrap';
    if (l.phone) chips.appendChild(chip('📞','rgba(34,197,94,0.15)','#4ade80')); if (l.email) chips.appendChild(chip('✉','rgba(59,130,246,0.15)','#60a5fa')); if (l.whatsapp) chips.appendChild(chip('💬','rgba(34,197,94,0.15)','#4ade80')); if (l.socials?.instagram) chips.appendChild(chip('📸','rgba(168,85,247,0.15)','#c084fc')); if (l.socials?.facebook) chips.appendChild(chip('📘','rgba(59,130,246,0.15)','#60a5fa')); if (l.activity>=2) chips.appendChild(chip('✓ fresh','rgba(34,197,94,0.15)','#4ade80'));
    card.append(top, chips); card.onclick = () => { selectedId = l.id; renderList(); if (boardViewActive) renderBoard(); renderDetail(l); }; card.setAttribute('tabindex', '0'); card.setAttribute('role', 'button'); card.setAttribute('aria-label', `View details for ${l.name}`); card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } }; card.onmouseenter = () => { if (selectedId !== l.id) card.style.background = '#1a1a1a'; }; card.onmouseleave = () => { if (selectedId !== l.id) card.style.background = COLORS.card; }; return card;
  }

  function renderBoard() { boardContainer.innerHTML = ''; boardContainer.className = 'flex-1 overflow-x-auto p-4 flex gap-3'; boardContainer.style.background = COLORS.surface; const cols = document.createElement('div'); cols.className = 'flex gap-3 min-w-max';
    for (const stage of STAGES) { const col = document.createElement('div'); col.className = 'w-[200px] flex-shrink-0'; col.dataset.stage = stage; const h = document.createElement('div'); h.className = 'text-xs font-semibold px-2 py-1.5 rounded-t-lg text-black'; h.style.background = (STAGE_COLORS[stage]||STAGE_COLORS.New).fg; const stageLeads = leads.filter(l=>l.stage===stage); h.textContent = `${stage} (${stageLeads.length})`; col.appendChild(h); const body = document.createElement('div'); body.className = 'bg-[#111] rounded-b-lg border border-t-0 border-white/10 p-2 space-y-2 min-h-[100px]'; body.style.borderColor = BORDER;
      body.ondragover = e => { e.preventDefault(); body.style.background = COLORS.primarySubtle; }; body.ondragleave = () => { body.style.background = COLORS.surface; };
      body.ondrop = e => { e.preventDefault(); body.style.background = COLORS.surface; const id = e.dataTransfer.getData('text/plain'); const lead = leads.find(l=>l.id===id); if (lead) { lead.stage = stage; persistLead(lead); renderBoard(); renderStats(); } };
      for (const l of stageLeads) { const card = document.createElement('div'); card.className = 'bg-[#141414] rounded-lg p-2 cursor-pointer border border-white/10 transition-all'; card.draggable = true; card.innerHTML = `<div class="text-xs font-semibold truncate text-white">${l.name}</div><div class="text-[10px] mt-0.5 text-white/50">${l.niche}</div>`;
        card.ondragstart = e => { e.dataTransfer.setData('text/plain', l.id); card.style.opacity = '0.5'; }; card.ondragend = () => { card.style.opacity = '1'; };
        card.onmouseenter = () => { card.style.background = '#1a1a1a'; }; card.onmouseleave = () => { card.style.background = COLORS.card; };
        card.onclick = () => { selectedId = l.id; renderDetail(l); }; body.appendChild(card); }
      col.appendChild(body); cols.appendChild(col); }
    boardContainer.appendChild(cols);
  }

  function renderDetail(lead) {
    detailPanel.innerHTML = '';
    if (!lead) { const e = document.createElement('div'); e.className = 'flex items-center justify-center h-full text-sm px-6 text-center'; e.style.color = COLORS.textSecondary; e.textContent = 'Select a lead to see details.'; detailPanel.appendChild(e); return; }
    const wrap = document.createElement('div'); wrap.className = 'p-4 space-y-4';
    const header = document.createElement('div'); header.className = 'flex justify-between items-start'; header.innerHTML = `<div><div class="text-lg font-bold text-white">${lead.name}</div><div class="text-xs text-white/60">${lead.niche} · ${lead.city}${lead.country?', '+lead.country:''}${lead.owner?' · Run by '+lead.owner:''}</div></div><div class="text-2xl font-bold" style="color:${ACCENT}">${lead.score}</div>`; wrap.appendChild(header);
    if (lead.reason) { const r = document.createElement('div'); r.className = 'text-xs italic px-3 py-2 rounded-lg'; r.style.color = COLORS.textSecondary; r.style.background = COLORS.primarySubtle; r.textContent = lead.reason; wrap.appendChild(r); }
    const sr = document.createElement('div'); sr.className = 'flex gap-1.5 flex-wrap';
    for (const stage of STAGES) { const b = document.createElement('button'); b.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer transition-all'; const c = STAGE_COLORS[stage]; if (lead.stage===stage) { b.style.background=c.bg; b.style.color=c.fg; b.style.borderColor=c.fg; } else { b.style.background='#111'; b.style.color=COLORS.textSecondary; b.style.borderColor=BORDER2; } b.textContent = stage; b.onclick = () => { lead.stage=stage; persistLead(lead); renderList(); if(boardViewActive) renderBoard(); renderDetail(lead); renderStats(); }; sr.appendChild(b); } wrap.appendChild(sr);
    wrap.appendChild(secH('Contact')); const cb = document.createElement('div'); cb.className = 'space-y-1.5 text-sm';
    if (lead.phone) cb.append(cr('Phone',lead.phone,`tel:${lead.phone}`)); if (lead.email) cb.append(cr('Email',lead.email,`mailto:${lead.email}`)); if (lead.whatsapp) cb.append(cr('WhatsApp',lead.whatsapp.replace('https://wa.me/',''),lead.whatsapp)); if (lead.address) cb.append(cr('Address',lead.address,lead.maps_pin||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address+' '+lead.city)}`)); if (lead.opening_hours) cb.append(cr('Hours',lead.opening_hours)); if (lead.owner) cb.append(cr('Owner/Operator',lead.owner));
    for (const [kind,url] of Object.entries(lead.socials||{})) { if (kind==='instagram') cb.append(renderInstaBtn(lead,url)); else cb.append(cr(kind[0].toUpperCase()+kind.slice(1),url,url)); }
    wrap.appendChild(cb);
    if (lead.maps_verify||lead.maps_pin||lead.maps_street) { wrap.appendChild(secH('Verify on Maps')); const mr = document.createElement('div'); mr.className = 'flex gap-2 flex-wrap'; if (lead.maps_verify) mr.append(ml('Search',lead.maps_verify)); if (lead.maps_pin) mr.append(ml('Pin',lead.maps_pin)); if (lead.maps_street) mr.append(ml('Street View',lead.maps_street)); if (lead.osm_url) mr.append(ml('OSM',lead.osm_url)); wrap.appendChild(mr); }
    
    // ── Message Panel ────────────────────────────────────────────────────────
    wrap.appendChild(secH('Outreach Message'));
    const msgTabs = document.createElement('div'); msgTabs.className = 'flex gap-1 mb-2';
    const kinds = [['fb','DM'],['email','Email'],['call','Call'],['follow','Follow-up']]; let activeKind = 'fb';
    const preview = document.createElement('pre'); preview.className = 'text-xs p-3 rounded-lg whitespace-pre-wrap font-sans max-h-[200px] overflow-y-auto bg-[#111] border border-white/5';
    function renderMsg() { preview.textContent = buildMessage(lead, activeKind, settings.name||'Your Name', settings.portfolio||'', settings.lang||'en'); }
    for (const [k,label] of kinds) { const t = document.createElement('button'); t.className = `text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all`; t.setAttribute('aria-label', `Show ${label} message`); if (k===activeKind) { t.style.background=COLORS.primary; t.style.color='#000'; t.style.borderColor=COLORS.primary; } else { t.style.background='#111'; t.style.color=COLORS.textSecondary; t.style.borderColor=BORDER2; } t.textContent = label; t.onclick = () => { activeKind=k; renderMsg(); }; msgTabs.appendChild(t); } renderMsg();
    const copyMsgBtn = document.createElement('button'); copyMsgBtn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg text-black bg-[#d9ff00] hover:bg-white transition-all mt-2'; copyMsgBtn.textContent = 'Copy Message';
    copyMsgBtn.onclick = () => { navigator.clipboard.writeText(buildMessage(lead,activeKind,settings.name||'Your Name',settings.portfolio||'',settings.lang||'en')).then(()=>{copyMsgBtn.textContent='Copied!';setTimeout(()=>copyMsgBtn.textContent='Copy Message',1500);}); };
    const aiBtnRow = document.createElement('div'); aiBtnRow.className = 'flex gap-2 mt-2';
    const aiBtn = document.createElement('button'); aiBtn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-all'; aiBtn.textContent='✨ Rewrite with AI'; aiBtn.setAttribute('aria-label', 'Rewrite message with AI');
    aiBtn.onclick = async () => { aiBtn.disabled=true; aiBtn.textContent='Rewriting...'; try { const r = await generateMessage(lead.id,{kind:activeKind,lang:settings.lang||'en',use_ai:true,name:settings.name||'Your Name',portfolio:settings.portfolio||''}); if(r.ok) preview.textContent=r.message; else aiBtn.textContent='⚠ '+(r.error||'Failed'); } catch(e) { aiBtn.textContent='⚠ '+e.message; } finally { setTimeout(()=>{aiBtn.disabled=false;aiBtn.textContent='✨ Rewrite with AI';},2000); } };
    const briefBtn = document.createElement('button'); briefBtn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-all'; briefBtn.textContent='📋 Business Brief';
  briefBtn.onclick = () => { 
    briefTitle.textContent = `Business Brief — ${lead.name}`;
    briefContent.textContent = 'Generating...';
    briefOverlay.style.display = 'flex';
    setTimeout(() => briefTabQuick.focus(), 50);
    generateBrief(lead.id, { use_ai: false, scrape_site: true }).then(r => {
      if (r.ok) { briefContent.textContent = r.brief; briefCopy.dataset.source = r.source; }
      else briefContent.textContent = 'Error: ' + (r.error?.message || 'Failed');
    }).catch(e => { briefContent.textContent = 'Error: ' + e.message; });
  };
  briefOverlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { briefOverlay.style.display = 'none'; briefBtn.focus(); } });
    aiBtnRow.append(aiBtn, briefBtn); wrap.append(msgTabs, preview, copyMsgBtn, aiBtnRow);
    
    // Brief tab handlers
    briefTabQuick.onclick = () => { briefTabQuick.style.background = COLORS.primary; briefTabQuick.style.borderColor = COLORS.primary; briefTabAI.style.background = '#111'; briefTabAI.style.borderColor = BORDER2; briefTabQuick.style.color = '#000'; briefTabAI.style.color = COLORS.textSecondary; generateBrief(lead.id,{use_ai:false,scrape_site:true}).then(r=>{if(r.ok)briefContent.textContent=r.brief;}); };
    briefTabAI.onclick = () => { briefTabAI.style.background = COLORS.primary; briefTabAI.style.borderColor = COLORS.primary; briefTabQuick.style.background = '#111'; briefTabQuick.style.borderColor = BORDER2; briefTabAI.style.color = '#000'; briefTabQuick.style.color = COLORS.textSecondary; briefContent.textContent='Generating AI brief...'; generateBrief(lead.id,{use_ai:true,scrape_site:true}).then(r=>{if(r.ok)briefContent.textContent=r.brief;else briefContent.textContent='⚠ '+(r.error?.message||'No AI key configured');}); };

    wrap.appendChild(secH('Notes')); const notes = document.createElement('textarea'); notes.className = 'w-full text-sm border border-white/10 rounded-xl p-2 resize-y min-h-[60px] bg-[#111] text-white'; notes.value=lead.notes||''; notes.placeholder='Add notes about this lead...'; notes.oninput=debounce(()=>{lead.notes=notes.value;persistLead(lead);},500); wrap.appendChild(notes);
    const delBtn = document.createElement('button'); delBtn.className='text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-all'; delBtn.textContent='Delete lead'; delBtn.setAttribute('aria-label', `Delete ${lead.name}`); delBtn.onclick=()=>{if(confirm(`Delete "${lead.name}"?`)){deleteLead(lead.id).then(()=>{leads=leads.filter(l=>l.id!==lead.id);selectedId=null;applyFilters();if(boardViewActive)renderBoard();renderDetail(null);renderStats();showToast('Lead deleted','success');}).catch(()=>showToast('Failed to delete lead','error'));}}; wrap.appendChild(delBtn);
    detailPanel.appendChild(wrap);
  }

  function cr(label, value, href) { const row = document.createElement('div'); row.className = 'flex items-center gap-2'; const l = document.createElement('span'); l.className = 'text-[10px] font-semibold w-20 shrink-0'; l.style.color=COLORS.textSecondary; l.textContent=label; const v = document.createElement('span'); v.className='text-sm truncate flex-1'; if (href) { const a=document.createElement('a'); a.href=href; a.target='_blank'; a.rel='noopener'; a.className='hover:underline truncate transition-colors'; a.style.color=ACCENT; a.textContent=value; v.appendChild(a); } else v.textContent=value; row.append(l,v); return row; }
  function ml(label,url) { const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.className='text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-all'; a.style.background='rgba(59,130,246,0.15)'; a.style.color='#60a5fa'; a.textContent=label; a.onmouseenter=()=>a.style.background='rgba(59,130,246,0.25)'; a.onmouseleave=()=>a.style.background='rgba(59,130,246,0.15)'; return a; }
  function renderInstaBtn(lead, url) { const row = document.createElement('div'); row.className = 'flex items-center gap-2'; const l = document.createElement('span'); l.className='text-[10px] font-semibold w-20 shrink-0'; l.style.color=COLORS.textSecondary; l.textContent='Instagram'; row.appendChild(l); const a = document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.className='text-sm truncate flex-1 hover:underline transition-colors'; a.style.color=ACCENT; a.textContent=url.split('/').pop(); row.appendChild(a); const btn = document.createElement('button'); btn.className='text-[10px] font-semibold px-2 py-0.5 rounded border border-white/10 transition-all hover:bg-white/10'; btn.style.color=COLORS.textSecondary; btn.textContent='Check'; btn.setAttribute('aria-label', 'Check Instagram activity'); const status = document.createElement('span'); status.className='text-[10px] ml-1';
  btn.onclick = async () => { btn.disabled=true; btn.textContent='...'; try { const r = await checkInstagram([url]); const res = r.results?.[url]; if (res) { status.textContent = res.status; status.style.color = res.status==='active'?'#4ade80':res.status==='dormant'?'#f87171':COLORS.textMuted; btn.textContent='Checked'; } } catch { btn.textContent='Error'; } finally { setTimeout(()=>{btn.disabled=false;btn.textContent='Recheck';},2000); } };
  row.append(btn, status); return row; }

  function toggleStar(id) { const l = leads.find(x=>x.id===id); if (l) { l.starred=!l.starred; persistLead(l); renderList(); if(boardViewActive) renderBoard(); if(selectedId===id) renderDetail(l); renderStats(); } }
  function persistLead(l) { saveLeads([l]).catch(()=>{}); }
  function renderStats() { const sl=leads.filter(l=>l.starred).length, ro=leads.filter(l=>['Contacted','Reply','Deal','Lost'].includes(l.stage)).length, rp=leads.filter(l=>['Reply','Deal'].includes(l.stage)).length, dw=leads.filter(l=>l.stage==='Deal').length, wr=ro>0?Math.round((dw/ro)*100):0; statsBody.innerHTML=''; const g=document.createElement('div'); g.className='grid grid-cols-2 gap-2.5 mb-3';
    function si(label,value) { const i=document.createElement('div'); i.className='text-center'; const v=document.createElement('div'); v.className='text-lg font-bold'; v.style.color=ACCENT; v.textContent=value; const l=document.createElement('div'); l.className='text-[10px] mt-0.5'; l.style.color=COLORS.textSecondary; l.textContent=label; i.append(v,l); return i; }
    g.append(si('Shortlisted',sl),si('Reached',ro),si('Replies',rp),si('Won',dw)); statsBody.appendChild(g);
    const wr2=document.createElement('div'); wr2.className='flex justify-between text-xs mb-1'; wr2.innerHTML=`<span style="color:${COLORS.textSecondary}">Win rate</span><span class="font-semibold">${wr}%</span>`; statsBody.appendChild(wr2);
    const pb=document.createElement('div'); pb.className='h-1.5 rounded-full overflow-hidden'; pb.style.background='#111'; const pf=document.createElement('div'); pf.className='h-full rounded-full'; pf.style.background=ACCENT; pf.style.width=`${leads.length?Math.round((ro/leads.length)*100):0}%`; pb.appendChild(pf); statsBody.appendChild(pb); }

  async function doSearch() {
    const niche = nicheSelect.value; let city = ''; if (citySelect.value==='__type__'||countrySelect.value==='OTHER') city=cityOther.value.trim(); else city=citySelect.value;
    const country = COUNTRIES.find(c=>c.code===countrySelect.value)?.label||''; const mode = modeSelect.value;
    if (!city) { statusLine.textContent='⚠ Please enter a city.'; statusLine.style.color=COLORS.error; showToast('Please enter a city name', 'error'); return; }
    searchBtn.disabled=true; searchBtn.textContent='Searching...'; searchBtn.style.opacity = '0.7'; statusLine.style.color=COLORS.primary; statusLine.textContent='Searching OpenStreetMap...';
    const sn = niche||'Restaurant'; const tags = NICHES[sn]||[['amenity','restaurant']]; const place = city+(country&&country!=='Other'?', '+country:'');
    try { const r = await searchLeads({niche:sn,place,mode,limit:60,tagPairs:tags}); const ids=new Set(leads.map(l=>l.id)); const nl=r.leads.filter(l=>!ids.has(l.id)); leads=[...nl,...leads]; saveLeads(nl).catch(()=>{}); applyFilters(); renderStats(); statusLine.style.color=COLORS.success; statusLine.textContent=`✓ Found ${r.found} leads (${nl.length} new). Scanned ${r.scanned} businesses.`; showToast(`Found ${nl.length} new leads`, 'success'); }
    catch(e) { statusLine.style.color=COLORS.error; statusLine.textContent=`✗ ${e.message}`; showToast(e.message, 'error'); } finally { searchBtn.disabled=false; searchBtn.textContent='Find Businesses'; searchBtn.style.opacity = '1'; }
  }
  searchBtn.onclick=doSearch; cityOther.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
  stageFilterSel.onchange=()=>applyFilters();
  starFilterBtn.onclick = () => { starredMode = !starredMode; starFilterBtn.setAttribute('aria-pressed', String(starredMode)); starFilterBtn.className = starredMode ? 'text-xs px-3 py-1.5 rounded-lg bg-[#d9ff00]/20 text-[#d9ff00] border border-[#d9ff00] transition-all' : 'text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-all'; applyFilters(); };
  exportCsvBtn.onclick = async () => { try { await exportCSV(); showToast('Leads exported to CSV', 'success'); } catch (e) { statusLine.textContent = `✗ Export failed: ${e.message}`; statusLine.style.color = COLORS.error; showToast('Export failed', 'error'); } };
  boardToggleBtn.onclick = () => { boardViewActive = !boardViewActive; boardToggleBtn.setAttribute('aria-pressed', String(boardViewActive)); if (boardViewActive) { listContainer.classList.add('hidden'); boardContainer.classList.remove('hidden'); boardToggleBtn.className = 'text-xs px-3 py-1.5 bg-[#d9ff00]/20 text-[#d9ff00] border border-[#d9ff00] rounded-lg transition-all'; renderBoard(); } else { listContainer.classList.remove('hidden'); boardContainer.classList.add('hidden'); boardToggleBtn.className = 'text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-all'; } };

  refreshCities(); loadLeads().then(r=>{if(r?.leads?.length){leads=r.leads;applyFilters();renderStats();}}).catch(()=>{});
  renderList(); renderDetail(null); renderStats(); return container;
}
