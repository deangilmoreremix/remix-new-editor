import { mountStudioChrome } from '../lib/studioChrome.js';
import { saveLeads, loadLeads, deleteLead, exportCSV, getCities, buildMessage, checkInstagram, generateMessage, generateBrief } from '../lib/leadFinderApi.js';
import { NICHES, getGroupedNiches } from '../lib/leadFinderCategories.js';

const ACCENT = '#c96a4a', ACCENT_DARK = '#b25a3c', BG = '#f7f5f1', BORDER = '#e7e2d8', BORDER2 = '#ddd6c8', INK2 = '#5d5b53', MUTED = '#8f8c81';
const STAGES = ['New','Contacted','Reply','Deal','Lost'];
const STAGE_COLORS = { New:{bg:'#ecf1f6',fg:'#3a5876'}, Contacted:{bg:'#f9efe0',fg:'#93601f'}, Reply:{bg:'#eaf2ea',fg:'#3c6845'}, Deal:{bg:'#d4edbc',fg:'#2d6a1e'}, Lost:{bg:'#f8ecea',fg:'#8c3f34'} };
const COUNTRIES = [{code:'GB',label:'United Kingdom'},{code:'US',label:'United States'},{code:'AU',label:'Australia'},{code:'CA',label:'Canada'},{code:'IE',label:'Ireland'},{code:'DE',label:'Germany'},{code:'FR',label:'France'},{code:'IN',label:'India'},{code:'JP',label:'Japan'},{code:'BR',label:'Brazil'},{code:'MX',label:'Mexico'},{code:'OTHER',label:'Other'}];
const LANGS = [{code:'en',label:'English'},{code:'hi',label:'Hindi'},{code:'hinglish',label:'Hinglish'},{code:'es',label:'Spanish'}];

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function loadSettings() { try { return JSON.parse(localStorage.getItem('leadfinder_settings')||'{}'); } catch { return {}; } }
function saveSettings(s) { localStorage.setItem('leadfinder_settings', JSON.stringify(s)); }

export function LeadFinderStudio() {
  const container = document.createElement('div'); container.className = 'w-full h-full flex flex-col overflow-hidden'; container.style.background = BG; container.style.fontFamily = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",sans-serif';
  mountStudioChrome(container, { title: 'Smart Video Lead Finder', currentRoute: 'leadfinder' });
  let leads = [], filteredLeads = [], selectedId = null, settings = loadSettings(), boardViewActive = false;
  const content = document.createElement('div'); content.className = 'flex-1 flex flex-col overflow-hidden'; container.appendChild(content);

  // Search bar
  const searchBar = document.createElement('div'); searchBar.className = 'bg-white border-b px-5 py-3 flex gap-3 items-end flex-wrap'; searchBar.style.borderColor = BORDER;
  const nicheField = document.createElement('div'); nicheField.className = 'flex flex-col gap-1';
  const nicheLabel = document.createElement('label'); nicheLabel.className = 'text-[10px] uppercase tracking-wider font-semibold'; nicheLabel.style.color = MUTED; nicheLabel.textContent = 'Trade';
  const nicheSelect = document.createElement('select'); nicheSelect.className = 'px-2.5 py-1.5 border rounded-lg text-sm bg-white'; nicheSelect.style.borderColor = BORDER2;
  const grouped = getGroupedNiches(); const optAll = document.createElement('option'); optAll.value = ''; optAll.textContent = 'All trades...'; nicheSelect.appendChild(optAll);
  for (const [seg, niches] of Object.entries(grouped)) { const og = document.createElement('optgroup'); og.label = seg; for (const n of niches) { const o = document.createElement('option'); o.value = n; o.textContent = n; og.appendChild(o); } nicheSelect.appendChild(og); }
  nicheField.append(nicheLabel, nicheSelect);
  const countryField = document.createElement('div'); countryField.className = 'flex flex-col gap-1';
  const countryLabel = document.createElement('label'); countryLabel.className = 'text-[10px] uppercase tracking-wider font-semibold'; countryLabel.style.color = MUTED; countryLabel.textContent = 'Country';
  const countrySelect = document.createElement('select'); countrySelect.className = 'px-2.5 py-1.5 border rounded-lg text-sm bg-white'; countrySelect.style.borderColor = BORDER2;
  for (const c of COUNTRIES) { const o = document.createElement('option'); o.value = c.code; o.textContent = c.label; countrySelect.appendChild(o); } countrySelect.value = 'GB';
  countryField.append(countryLabel, countrySelect);
  const cityField = document.createElement('div'); cityField.className = 'flex flex-col gap-1 flex-1 min-w-[180px]';
  const cityLabel = document.createElement('label'); cityLabel.className = 'text-[10px] uppercase tracking-wider font-semibold'; cityLabel.style.color = MUTED; cityLabel.textContent = 'City / Town';
  const citySelect = document.createElement('select'); citySelect.className = 'px-2.5 py-1.5 border rounded-lg text-sm bg-white'; citySelect.style.borderColor = BORDER2;
  const cityOther = document.createElement('input'); cityOther.type = 'text'; cityOther.placeholder = 'Type a city name...'; cityOther.className = 'px-2.5 py-1.5 border rounded-lg text-sm w-full'; cityOther.style.borderColor = BORDER2; cityOther.style.display = 'none';
  const refreshCities = async () => { const code = countrySelect.value; if (code === 'OTHER' || !code) { cityOther.style.display = 'block'; citySelect.style.display = 'none'; return; } cityOther.style.display = 'none'; citySelect.style.display = 'block'; citySelect.innerHTML = '<option>Loading...</option>'; try { const r = await getCities(code); citySelect.innerHTML = '<option value="">Select a town...</option><option value="__type__">Other — type a name...</option>'; for (const c of r.cities||[]) { const o = document.createElement('option'); o.value = c; o.textContent = c; citySelect.appendChild(o); } } catch { citySelect.innerHTML = '<option>Error loading</option><option value="__type__">Other</option>'; } };
  countrySelect.onchange = refreshCities; citySelect.onchange = () => { if (citySelect.value === '__type__') { cityOther.style.display = 'block'; cityOther.focus(); } else cityOther.style.display = 'none'; };
  cityField.append(cityLabel, citySelect, cityOther);
  const modeField = document.createElement('div'); modeField.className = 'flex flex-col gap-1';
  const modeLabel = document.createElement('label'); modeLabel.className = 'text-[10px] uppercase tracking-wider font-semibold'; modeLabel.style.color = MUTED; modeLabel.textContent = 'Mode';
  const modeSelect = document.createElement('select'); modeSelect.className = 'px-2.5 py-1.5 border rounded-lg text-sm bg-white'; modeSelect.style.borderColor = BORDER2;
  for (const [v,l] of [['no_website','No website'],['bad_website','Bad website'],['all','Both']]) { const o = document.createElement('option'); o.value = v; o.textContent = l; modeSelect.appendChild(o); }
  modeField.append(modeLabel, modeSelect);
  const searchBtn = document.createElement('button'); searchBtn.className = 'px-5 py-1.5 rounded-lg text-sm font-semibold text-white'; searchBtn.style.background = ACCENT; searchBtn.textContent = 'Find Businesses';
  const settingsBtn = document.createElement('button'); settingsBtn.className = 'px-3 py-1.5 rounded-lg text-sm font-medium border bg-white'; settingsBtn.style.borderColor = BORDER2; settingsBtn.style.color = INK2; settingsBtn.textContent = '⚙ Settings';
  const statusLine = document.createElement('div'); statusLine.className = 'w-full text-xs mt-1'; statusLine.style.color = INK2; statusLine.textContent = 'Pick a trade, country, and city, then hit Find Businesses.';
  searchBar.append(nicheField, countryField, cityField, modeField, searchBtn, settingsBtn, statusLine); content.appendChild(searchBar);

  // Main area
  const mainArea = document.createElement('div'); mainArea.className = 'flex-1 flex overflow-hidden'; content.appendChild(mainArea);
  const listPanel = document.createElement('div'); listPanel.className = 'flex-1 flex flex-col overflow-hidden'; listPanel.style.borderRight = `1px solid ${BORDER}`; mainArea.appendChild(listPanel);
  const filtersBar = document.createElement('div'); filtersBar.className = 'px-4 py-2 flex gap-2 items-center flex-wrap bg-white border-b'; filtersBar.style.borderColor = BORDER;
  const stageFilterSel = document.createElement('select'); stageFilterSel.className = 'text-xs px-2 py-1 border rounded bg-white'; stageFilterSel.style.borderColor = BORDER2; stageFilterSel.innerHTML = '<option value="">All stages</option>' + STAGES.map(s=>`<option value="${s}">${s}</option>`).join('');
  const starFilterBtn = document.createElement('button'); starFilterBtn.className = 'text-xs px-2 py-1 border rounded bg-white'; starFilterBtn.style.borderColor = BORDER2; starFilterBtn.textContent = '★ Starred';
  let starredMode = false;
  const exportCsvBtn = document.createElement('button'); exportCsvBtn.className = 'text-xs px-2 py-1 border rounded bg-white'; exportCsvBtn.style.borderColor = BORDER2; exportCsvBtn.textContent = '⬇ Export CSV';
  const boardToggleBtn = document.createElement('button'); boardToggleBtn.className = 'text-xs px-2 py-1 border rounded bg-white'; boardToggleBtn.style.borderColor = BORDER2; boardToggleBtn.textContent = 'Board view';
  const countLabel = document.createElement('span'); countLabel.className = 'text-xs ml-auto'; countLabel.style.color = MUTED;
  filtersBar.append(stageFilterSel, starFilterBtn, exportCsvBtn, boardToggleBtn, countLabel); listPanel.appendChild(filtersBar);
  const listContainer = document.createElement('div'); listContainer.className = 'flex-1 overflow-y-auto p-3 space-y-2'; listPanel.appendChild(listContainer);
  const boardContainer = document.createElement('div'); boardContainer.className = 'flex-1 overflow-x-auto p-4 hidden'; boardContainer.style.background = '#fafaf7'; listPanel.appendChild(boardContainer);
  const detailPanel = document.createElement('div'); detailPanel.className = 'w-[420px] flex-shrink-0 overflow-y-auto bg-white'; mainArea.appendChild(detailPanel);

  // Stats panel
  const statsPanel = document.createElement('div'); statsPanel.className = 'fixed bottom-5 right-5 w-[260px] rounded-xl overflow-hidden z-50'; statsPanel.style.background = '#fff'; statsPanel.style.border = `1px solid ${BORDER}`; statsPanel.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
  const statsHeader = document.createElement('div'); statsHeader.className = 'px-4 py-3 font-bold text-sm text-white cursor-pointer flex justify-between items-center'; statsHeader.style.background = ACCENT; statsHeader.innerHTML = '<span>My outreach</span><span class="text-xs">▼</span>'; statsPanel.appendChild(statsHeader);
  const statsBody = document.createElement('div'); statsBody.className = 'p-4'; statsPanel.appendChild(statsBody);
  let statsOpen = true; statsHeader.onclick = () => { statsOpen = !statsOpen; statsBody.style.display = statsOpen ? 'block' : 'none'; statsHeader.querySelector('span:last-child').textContent = statsOpen ? '▼' : '▶'; };
  container.appendChild(statsPanel);

  // Settings modal
  const settingsOverlay = document.createElement('div'); settingsOverlay.className = 'fixed inset-0 z-[200] flex items-center justify-center'; settingsOverlay.style.background = 'rgba(0,0,0,0.4)'; settingsOverlay.style.display = 'none';
  const settingsModal = document.createElement('div'); settingsModal.className = 'bg-white rounded-2xl p-6 w-[480px] max-h-[85vh] overflow-y-auto'; settingsModal.style.boxShadow = '0 20px 60px rgba(0,0,0,0.2)'; settingsOverlay.appendChild(settingsModal);
  const settingsTitle = document.createElement('div'); settingsTitle.className = 'text-lg font-bold mb-4'; settingsTitle.textContent = 'Smart Video Lead Finder Settings'; settingsModal.appendChild(settingsTitle);
  function sf(label, type, key, ph) { const w = document.createElement('div'); w.className = 'mb-3'; const l = document.createElement('label'); l.className = 'text-[10px] uppercase tracking-wider font-semibold block mb-1'; l.style.color = MUTED; l.textContent = label; const i = document.createElement(type==='select'?'select':'input'); i.className = 'w-full px-2.5 py-1.5 border rounded-lg text-sm'; i.style.borderColor = BORDER2; if (type!=='select') { i.type = type; i.placeholder = ph||''; i.value = settings[key]||''; } w.append(l,i); return {w,i}; }
  const nameF = sf('Your name','text','name','Your name'); const portF = sf('Portfolio link','text','portfolio','https://...'); const turnF = sf('Turnaround time','text','turnaround','5 days');
  const langF = sf('Message language','select','lang'); for (const l of LANGS) { const o = document.createElement('option'); o.value = l.code; o.textContent = l.label; langF.i.appendChild(o); } langF.i.value = settings.lang||'en';
  const aiF = sf('AI provider','select','ai_provider'); for (const p of [{code:'none',label:'None (templates only)'},{code:'openai',label:'OpenAI'},{code:'anthropic',label:'Anthropic'}]) { const o = document.createElement('option'); o.value = p.code; o.textContent = p.label; aiF.i.appendChild(o); } aiF.i.value = settings.ai_provider||'none';
  const openaiF = sf('OpenAI API key','password','openai_api_key','sk-...'); const anthropicF = sf('Anthropic API key','password','anthropic_api_key','sk-ant-...');
  settingsModal.append(nameF.w, portF.w, turnF.w, langF.w, aiF.w, openaiF.w, anthropicF.w);
  const sbr = document.createElement('div'); sbr.className = 'flex gap-2 justify-end mt-5';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'px-4 py-1.5 rounded-lg text-sm font-medium border bg-white'; cancelBtn.style.borderColor = BORDER2; cancelBtn.textContent = 'Cancel'; cancelBtn.onclick = () => { settingsOverlay.style.display = 'none'; };
  const saveBtn2 = document.createElement('button'); saveBtn2.className = 'px-4 py-1.5 rounded-lg text-sm font-semibold text-white'; saveBtn2.style.background = ACCENT; saveBtn2.textContent = 'Save';
  saveBtn2.onclick = () => { settings = { name:nameF.i.value.trim(), portfolio:portF.i.value.trim(), turnaround:turnF.i.value.trim()||'5 days', lang:langF.i.value, ai_provider:aiF.i.value, openai_api_key:openaiF.i.value.trim(), anthropic_api_key:anthropicF.i.value.trim() }; saveSettings(settings); settingsOverlay.style.display = 'none'; };
  sbr.append(cancelBtn, saveBtn2); settingsModal.appendChild(sbr); container.appendChild(settingsOverlay);
  settingsBtn.onclick = () => { nameF.i.value=settings.name||''; portF.i.value=settings.portfolio||''; turnF.i.value=settings.turnaround||'5 days'; langF.i.value=settings.lang||'en'; aiF.i.value=settings.ai_provider||'none'; openaiF.i.value=settings.openai_api_key||''; anthropicF.i.value=settings.anthropic_api_key||''; settingsOverlay.style.display = 'flex'; };

  // Brief modal
  const briefOverlay = document.createElement('div'); briefOverlay.className = 'fixed inset-0 z-[200] flex items-center justify-center'; briefOverlay.style.background = 'rgba(0,0,0,0.4)'; briefOverlay.style.display = 'none';
  const briefModal = document.createElement('div'); briefModal.className = 'bg-white rounded-2xl p-6 w-[600px] max-h-[80vh] overflow-y-auto'; briefModal.style.boxShadow = '0 20px 60px rgba(0,0,0,0.2)'; briefOverlay.appendChild(briefModal);
  const briefTitle = document.createElement('div'); briefTitle.className = 'text-lg font-bold mb-2'; briefModal.appendChild(briefTitle);
  const briefTabs = document.createElement('div'); briefTabs.className = 'flex gap-2 mb-4';
  const briefTabQuick = document.createElement('button'); briefTabQuick.className = 'text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100'; briefTabQuick.textContent = '⚡ Quick brief';
  const briefTabAI = document.createElement('button'); briefTabAI.className = 'text-xs font-semibold px-3 py-1.5 rounded-full border'; briefTabAI.textContent = '✨ AI brief';
  briefTabs.append(briefTabQuick, briefTabAI); briefModal.appendChild(briefTabs);
  const briefContent = document.createElement('pre'); briefContent.className = 'text-xs p-4 rounded-lg whitespace-pre-wrap font-sans max-h-[50vh] overflow-y-auto'; briefContent.style.background = BG; briefContent.style.border = `1px solid ${BORDER}`; briefContent.textContent = 'Generating...'; briefModal.appendChild(briefContent);
  const briefBtnRow = document.createElement('div'); briefBtnRow.className = 'flex gap-2 mt-4';
  const briefCopy = document.createElement('button'); briefCopy.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg text-white'; briefCopy.style.background = ACCENT; briefCopy.textContent = 'Copy Brief';
  briefCopy.onclick = () => { navigator.clipboard.writeText(briefContent.textContent).then(()=>{briefCopy.textContent='Copied!';setTimeout(()=>briefCopy.textContent='Copy Brief',1500);}); };
  const briefClose = document.createElement('button'); briefClose.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg border'; briefClose.textContent = 'Close'; briefClose.onclick = () => { briefOverlay.style.display = 'none'; };
  briefBtnRow.append(briefCopy, briefClose); briefModal.appendChild(briefBtnRow); container.appendChild(briefOverlay);

  function chip(e, bg, fg) { const el = document.createElement('span'); el.className = 'text-[10px] font-semibold px-1.5 py-0.5 rounded-full'; el.style.background = bg; el.style.color = fg; el.textContent = e; return el; }
  function secH(text) { const h = document.createElement('div'); h.className = 'text-[10px] uppercase tracking-wider font-semibold mt-1'; h.style.color = MUTED; h.textContent = text; return h; }

  function applyFilters() { filteredLeads = leads.filter(l => { if (stageFilterSel.value && l.stage !== stageFilterSel.value) return false; if (starredMode && !l.starred) return false; return true; }); renderList(); }

  function renderList() { listContainer.innerHTML = ''; if (!filteredLeads.length) { const e = document.createElement('div'); e.className = 'text-center py-12 text-sm'; e.style.color = MUTED; e.textContent = leads.length === 0 ? 'No leads yet. Run a search above.' : 'No leads match filters.'; listContainer.appendChild(e); countLabel.textContent = '0 leads'; return; } countLabel.textContent = `${filteredLeads.length} lead${filteredLeads.length!==1?'s':''}`; for (const l of filteredLeads) listContainer.appendChild(renderCard(l)); }

  function renderCard(l) {
    const card = document.createElement('div'); card.className = `bg-white border rounded-xl p-3 cursor-pointer ${selectedId===l.id?'bg-[#fbf1ec]':''}`; card.style.borderColor = selectedId===l.id ? ACCENT : BORDER;
    const top = document.createElement('div'); top.className = 'flex justify-between items-start gap-2';
    const nw = document.createElement('div'); nw.className = 'min-w-0 flex-1'; const nr = document.createElement('div'); nr.className = 'flex items-center gap-1.5';
    const star = document.createElement('button'); star.className = `text-base leading-none border-none bg-transparent cursor-pointer ${l.starred?'text-amber-500':'text-[#ddd6c8]'}`; star.textContent = '★'; star.onclick = e => { e.stopPropagation(); toggleStar(l.id); };
    const name = document.createElement('span'); name.className = 'font-semibold text-[14.5px] truncate'; name.textContent = l.name; nr.append(star, name);
    const meta = document.createElement('div'); meta.className = 'text-xs mt-0.5 truncate'; meta.style.color = MUTED; meta.textContent = `${l.niche} · ${l.city}`; nw.append(nr, meta);
    const sc = document.createElement('div'); sc.className = 'text-right shrink-0'; const sv = document.createElement('div'); sv.className = 'text-lg font-bold leading-none'; sv.style.color = ACCENT; sv.textContent = l.score;
    const sb = document.createElement('span'); sb.className = 'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1'; const c = STAGE_COLORS[l.stage]||STAGE_COLORS.New; sb.style.background = c.bg; sb.style.color = c.fg; sb.textContent = l.stage; sc.append(sv, sb);
    top.append(nw, sc);
    const chips = document.createElement('div'); chips.className = 'flex gap-1.5 mt-2 flex-wrap';
    if (l.phone) chips.appendChild(chip('📞','#eaf2ea','#3c6845')); if (l.email) chips.appendChild(chip('✉','#ecf1f6','#3a5876')); if (l.whatsapp) chips.appendChild(chip('💬','#d4edbc','#2d6a1e')); if (l.socials?.instagram) chips.appendChild(chip('📸','#f0edf5','#5c4d84')); if (l.socials?.facebook) chips.appendChild(chip('📘','#ecf1f6','#3a5876')); if (l.activity>=2) chips.appendChild(chip('✓ fresh','#eaf2ea','#3c6845'));
    card.append(top, chips); card.onclick = () => { selectedId = l.id; renderList(); if (boardViewActive) renderBoard(); renderDetail(l); }; return card;
  }

  function renderBoard() { boardContainer.innerHTML = ''; boardContainer.className = 'flex-1 overflow-x-auto p-4 flex gap-3'; boardContainer.style.background = '#fafaf7'; const cols = document.createElement('div'); cols.className = 'flex gap-3 min-w-max';
    for (const stage of STAGES) { const col = document.createElement('div'); col.className = 'w-[200px] flex-shrink-0'; col.dataset.stage = stage; const h = document.createElement('div'); h.className = 'text-xs font-semibold px-2 py-1.5 rounded-t-lg text-white'; h.style.background = (STAGE_COLORS[stage]||STAGE_COLORS.New).fg; const stageLeads = leads.filter(l=>l.stage===stage); h.textContent = `${stage} (${stageLeads.length})`; col.appendChild(h); const body = document.createElement('div'); body.className = 'bg-white rounded-b-lg border border-t-0 p-2 space-y-2 min-h-[100px]'; body.style.borderColor = BORDER;
      body.ondragover = e => { e.preventDefault(); body.style.background = '#fbf1ec'; }; body.ondragleave = () => { body.style.background = '#fff'; };
      body.ondrop = e => { e.preventDefault(); body.style.background = '#fff'; const id = e.dataTransfer.getData('text/plain'); const lead = leads.find(l=>l.id===id); if (lead) { lead.stage = stage; persistLead(lead); renderBoard(); renderStats(); } };
      for (const l of stageLeads) { const card = document.createElement('div'); card.className = 'bg-gray-50 rounded-lg p-2 cursor-pointer border'; card.style.borderColor = BORDER; card.draggable = true; card.innerHTML = `<div class="text-xs font-semibold truncate">${l.name}</div><div class="text-[10px] mt-0.5" style="color:${MUTED}">${l.niche}</div>`;
        card.ondragstart = e => { e.dataTransfer.setData('text/plain', l.id); card.style.opacity = '0.5'; }; card.ondragend = () => { card.style.opacity = '1'; };
        card.onclick = () => { selectedId = l.id; renderDetail(l); }; body.appendChild(card); }
      col.appendChild(body); cols.appendChild(col); }
    boardContainer.appendChild(cols);
  }

  function renderDetail(lead) {
    detailPanel.innerHTML = '';
    if (!lead) { const e = document.createElement('div'); e.className = 'flex items-center justify-center h-full text-sm px-6 text-center'; e.style.color = MUTED; e.textContent = 'Select a lead to see details.'; detailPanel.appendChild(e); return; }
    const wrap = document.createElement('div'); wrap.className = 'p-4 space-y-4';
    const header = document.createElement('div'); header.className = 'flex justify-between items-start'; header.innerHTML = `<div><div class="text-lg font-bold">${lead.name}</div><div class="text-xs" style="color:${MUTED}">${lead.niche} · ${lead.city}${lead.country?', '+lead.country:''}${lead.owner?' · Run by '+lead.owner:''}</div></div><div class="text-2xl font-bold" style="color:${ACCENT}">${lead.score}</div>`; wrap.appendChild(header);
    if (lead.reason) { const r = document.createElement('div'); r.className = 'text-xs italic px-3 py-2 rounded-lg'; r.style.color = '#a08a6e'; r.style.background = '#f9efe0'; r.textContent = lead.reason; wrap.appendChild(r); }
    const sr = document.createElement('div'); sr.className = 'flex gap-1.5 flex-wrap';
    for (const stage of STAGES) { const b = document.createElement('button'); b.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer'; const c = STAGE_COLORS[stage]; if (lead.stage===stage) { b.style.background=c.bg; b.style.color=c.fg; b.style.borderColor=c.fg; } else { b.style.background='#fff'; b.style.color=MUTED; b.style.borderColor=BORDER2; } b.textContent = stage; b.onclick = () => { lead.stage=stage; persistLead(lead); renderList(); if(boardViewActive) renderBoard(); renderDetail(lead); renderStats(); }; sr.appendChild(b); } wrap.appendChild(sr);
    wrap.appendChild(secH('Contact')); const cb = document.createElement('div'); cb.className = 'space-y-1.5 text-sm';
    if (lead.phone) cb.append(cr('Phone',lead.phone,`tel:${lead.phone}`)); if (lead.email) cb.append(cr('Email',lead.email,`mailto:${lead.email}`)); if (lead.whatsapp) cb.append(cr('WhatsApp',lead.whatsapp.replace('https://wa.me/',''),lead.whatsapp)); if (lead.address) cb.append(cr('Address',lead.address,lead.maps_pin||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address+' '+lead.city)}`)); if (lead.opening_hours) cb.append(cr('Hours',lead.opening_hours)); if (lead.owner) cb.append(cr('Owner/Operator',lead.owner));
    for (const [kind,url] of Object.entries(lead.socials||{})) { if (kind==='instagram') cb.append(renderInstaBtn(lead,url)); else cb.append(cr(kind[0].toUpperCase()+kind.slice(1),url,url)); }
    wrap.appendChild(cb);
    if (lead.maps_verify||lead.maps_pin||lead.maps_street) { wrap.appendChild(secH('Verify on Maps')); const mr = document.createElement('div'); mr.className = 'flex gap-2 flex-wrap'; if (lead.maps_verify) mr.append(ml('Search',lead.maps_verify)); if (lead.maps_pin) mr.append(ml('Pin',lead.maps_pin)); if (lead.maps_street) mr.append(ml('Street View',lead.maps_street)); if (lead.osm_url) mr.append(ml('OSM',lead.osm_url)); wrap.appendChild(mr); }
    
    // ── ENHANCED MESSAGE PANEL ────────────────────────────────────────────
    wrap.appendChild(secH('Outreach Message'));
    const msgTabs = document.createElement('div'); msgTabs.className = 'flex gap-1 mb-2';
    const kinds = [['fb','DM'],['email','Email'],['call','Call'],['follow','Follow-up']]; let activeKind = 'fb';
    const preview = document.createElement('pre'); preview.className = 'text-xs p-3 rounded-lg whitespace-pre-wrap font-sans max-h-[200px] overflow-y-auto'; preview.style.background = BG; preview.style.border = `1px solid ${BORDER}`;
    function renderMsg() { preview.textContent = buildMessage(lead, activeKind, settings.name||'Your Name', settings.portfolio||'', settings.lang||'en'); }
    for (const [k,label] of kinds) { const t = document.createElement('button'); t.className = `text-[11px] font-semibold px-2.5 py-1 rounded-full border ${k===activeKind?'text-white':'bg-white'}`; t.style.background = k===activeKind?ACCENT:'#fff'; t.style.color = k===activeKind?'#fff':MUTED; t.style.borderColor = k===activeKind?ACCENT:BORDER2; t.textContent = label; t.onclick = () => { activeKind=k; renderMsg(); }; msgTabs.appendChild(t); } renderMsg();
    const copyMsgBtn = document.createElement('button'); copyMsgBtn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg text-white mt-2'; copyMsgBtn.style.background = ACCENT; copyMsgBtn.textContent = 'Copy Message';
    copyMsgBtn.onclick = () => { navigator.clipboard.writeText(buildMessage(lead,activeKind,settings.name||'Your Name',settings.portfolio||'',settings.lang||'en')).then(()=>{copyMsgBtn.textContent='Copied!';setTimeout(()=>copyMsgBtn.textContent='Copy Message',1500);}); };
    const aiBtnRow = document.createElement('div'); aiBtnRow.className = 'flex gap-2 mt-2';
    const aiBtn = document.createElement('button'); aiBtn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg border'; aiBtn.style.borderColor=BORDER2; aiBtn.style.color=INK2; aiBtn.textContent='✨ Rewrite with AI';
    aiBtn.onclick = async () => { aiBtn.disabled=true; aiBtn.textContent='Rewriting...'; try { const r = await generateMessage(lead.id,{kind:activeKind,lang:settings.lang||'en',use_ai:true,name:settings.name||'Your Name',portfolio:settings.portfolio||''}); if(r.ok) preview.textContent=r.message; else aiBtn.textContent='⚠ '+(r.error||'Failed'); } catch(e) { aiBtn.textContent='⚠ '+e.message; } finally { setTimeout(()=>{aiBtn.disabled=false;aiBtn.textContent='✨ Rewrite with AI';},2000); } };
    const briefBtn = document.createElement('button'); briefBtn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg border'; briefBtn.style.borderColor=BORDER2; briefBtn.style.color=INK2; briefBtn.textContent='📋 Business Brief';
    briefBtn.onclick = () => { 
      briefTitle.textContent = `Business Brief — ${lead.name}`;
      briefContent.textContent = 'Generating...';
      briefOverlay.style.display = 'flex';
      // Quick brief by default
      generateBrief(lead.id, { use_ai: false, scrape_site: true }).then(r => {
        if (r.ok) { briefContent.textContent = r.brief; briefCopy.dataset.source = r.source; }
        else briefContent.textContent = 'Error: ' + (r.error?.message || 'Failed');
      }).catch(e => { briefContent.textContent = 'Error: ' + e.message; });
    };
    aiBtnRow.append(aiBtn, briefBtn); wrap.append(msgTabs, preview, copyMsgBtn, aiBtnRow);
    
    // Brief tab handlers
    briefTabQuick.onclick = () => { briefTabQuick.style.background = '#e7e2d8'; briefTabQuick.style.borderColor = 'transparent'; briefTabAI.style.background = '#fff'; briefTabAI.style.borderColor = BORDER2; generateBrief(lead.id,{use_ai:false,scrape_site:true}).then(r=>{if(r.ok)briefContent.textContent=r.brief;}); };
    briefTabAI.onclick = () => { briefTabAI.style.background = '#e7e2d8'; briefTabAI.style.borderColor = 'transparent'; briefTabQuick.style.background = '#fff'; briefTabQuick.style.borderColor = BORDER2; briefContent.textContent='Generating AI brief...'; generateBrief(lead.id,{use_ai:true,scrape_site:true}).then(r=>{if(r.ok)briefContent.textContent=r.brief;else briefContent.textContent='⚠ '+(r.error?.message||'No AI key configured');}); };

    wrap.appendChild(secH('Notes')); const notes = document.createElement('textarea'); notes.className = 'w-full text-sm border rounded-lg p-2 resize-y min-h-[60px]'; notes.style.borderColor=BORDER2; notes.value=lead.notes||''; notes.placeholder='Add notes about this lead...'; notes.oninput=debounce(()=>{lead.notes=notes.value;persistLead(lead);},500); wrap.appendChild(notes);
    const delBtn = document.createElement('button'); delBtn.className='text-xs font-semibold px-3 py-1.5 rounded-lg border text-red-600 bg-white'; delBtn.style.borderColor='#fca5a5'; delBtn.textContent='Delete lead'; delBtn.onclick=()=>{if(confirm(`Delete "${lead.name}"?`)){deleteLead(lead.id).then(()=>{leads=leads.filter(l=>l.id!==lead.id);selectedId=null;applyFilters();if(boardViewActive)renderBoard();renderDetail(null);renderStats();});}}; wrap.appendChild(delBtn);
    detailPanel.appendChild(wrap);
  }

  function cr(label, value, href) { const row = document.createElement('div'); row.className = 'flex items-center gap-2'; const l = document.createElement('span'); l.className = 'text-[10px] font-semibold w-20 shrink-0'; l.style.color=MUTED; l.textContent=label; const v = document.createElement('span'); v.className='text-sm truncate flex-1'; if (href) { const a=document.createElement('a'); a.href=href; a.target='_blank'; a.rel='noopener'; a.className='hover:underline truncate'; a.style.color=ACCENT; a.textContent=value; v.appendChild(a); } else v.textContent=value; row.append(l,v); return row; }
  function ml(label,url) { const a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.className='text-[11px] font-semibold px-2.5 py-1.5 rounded-full'; a.style.background='#ecf1f6'; a.style.color='#3a5876'; a.textContent=label; return a; }
  function renderInstaBtn(lead, url) { const row = document.createElement('div'); row.className = 'flex items-center gap-2'; const l = document.createElement('span'); l.className='text-[10px] font-semibold w-20 shrink-0'; l.style.color=MUTED; l.textContent='Instagram'; row.appendChild(l); const a = document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.className='text-sm truncate flex-1 hover:underline'; a.style.color=ACCENT; a.textContent=url.split('/').pop(); row.appendChild(a); const btn = document.createElement('button'); btn.className='text-[10px] font-semibold px-2 py-0.5 rounded border'; btn.style.borderColor=BORDER2; btn.style.color=MUTED; btn.textContent='Check'; const status = document.createElement('span'); status.className='text-[10px] ml-1';
  btn.onclick = async () => { btn.disabled=true; btn.textContent='...'; try { const r = await checkInstagram([url]); const res = r.results?.[url]; if (res) { status.textContent = res.status; status.style.color = res.status==='active'?'#3c6845':res.status==='dormant'?'#8c3f34':MUTED; btn.textContent='Checked'; } } catch { btn.textContent='Error'; } finally { setTimeout(()=>{btn.disabled=false;btn.textContent='Recheck';},2000); } };
  row.append(btn, status); return row; }

  function toggleStar(id) { const l = leads.find(x=>x.id===id); if (l) { l.starred=!l.starred; persistLead(l); renderList(); if(boardViewActive) renderBoard(); if(selectedId===id) renderDetail(l); renderStats(); } }
  function persistLead(l) { saveLeads([l]).catch(()=>{}); }
  function renderStats() { const sl=leads.filter(l=>l.starred).length, ro=leads.filter(l=>['Contacted','Reply','Deal','Lost'].includes(l.stage)).length, rp=leads.filter(l=>['Reply','Deal'].includes(l.stage)).length, dw=leads.filter(l=>l.stage==='Deal').length, wr=ro>0?Math.round((dw/ro)*100):0; statsBody.innerHTML=''; const g=document.createElement('div'); g.className='grid grid-cols-2 gap-2.5 mb-3';
    function si(label,value) { const i=document.createElement('div'); i.className='text-center'; const v=document.createElement('div'); v.className='text-lg font-bold'; v.style.color=ACCENT; v.textContent=value; const l=document.createElement('div'); l.className='text-[10px] mt-0.5'; l.style.color=MUTED; l.textContent=label; i.append(v,l); return i; }
    g.append(si('Shortlisted',sl),si('Reached',ro),si('Replies',rp),si('Won',dw)); statsBody.appendChild(g);
    const wr2=document.createElement('div'); wr2.className='flex justify-between text-xs mb-1'; wr2.innerHTML=`<span style="color:${MUTED}">Win rate</span><span class="font-semibold">${wr}%</span>`; statsBody.appendChild(wr2);
    const pb=document.createElement('div'); pb.className='h-1.5 rounded-full overflow-hidden'; pb.style.background='#eee'; const pf=document.createElement('div'); pf.className='h-full rounded-full'; pf.style.background=ACCENT; pf.style.width=`${leads.length?Math.round((ro/leads.length)*100):0}%`; pb.appendChild(pf); statsBody.appendChild(pb); }

  async function doSearch() {
    const niche = nicheSelect.value; let city = ''; if (citySelect.value==='__type__'||countrySelect.value==='OTHER') city=cityOther.value.trim(); else city=citySelect.value;
    const country = COUNTRIES.find(c=>c.code===countrySelect.value)?.label||''; const mode = modeSelect.value;
    if (!city) { statusLine.textContent='⚠ Please enter a city.'; statusLine.style.color='#8c3f34'; return; }
    searchBtn.disabled=true; searchBtn.textContent='Searching...'; statusLine.style.color='#3a5876'; statusLine.textContent='Searching OpenStreetMap...';
    const sn = niche||'Restaurant'; const tags = NICHES[sn]||[['amenity','restaurant']]; const place = city+(country&&country!=='Other'?', '+country:'');
    try { const r = await searchLeads({niche:sn,place,mode,limit:60,tagPairs:tags}); const ids=new Set(leads.map(l=>l.id)); const nl=r.leads.filter(l=>!ids.has(l.id)); leads=[...nl,...leads]; saveLeads(nl).catch(()=>{}); applyFilters(); renderStats(); statusLine.style.color='#3c6845'; statusLine.textContent=`✓ Found ${r.found} leads (${nl.length} new). Scanned ${r.scanned} businesses.`; }
    catch(e) { statusLine.style.color='#8c3f34'; statusLine.textContent=`✗ ${e.message}`; } finally { searchBtn.disabled=false; searchBtn.textContent='Find Businesses'; }
  }
  searchBtn.onclick=doSearch; cityOther.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
  stageFilterSel.onchange=()=>applyFilters();
  starFilterBtn.onclick=()=>{starredMode=!starredMode;starFilterBtn.className=starredMode?'text-xs px-2 py-1 border rounded bg-amber-50 text-amber-700 border-amber-500':'text-xs px-2 py-1 border rounded bg-white';starFilterBtn.style.borderColor=starredMode?undefined:BORDER2;applyFilters();};
  exportCsvBtn.onclick=async()=>{try{await exportCSV();}catch(e){statusLine.textContent=`✗ Export failed: ${e.message}`;statusLine.style.color='#8c3f34';}};
  boardToggleBtn.onclick=()=>{boardViewActive=!boardViewActive;if(boardViewActive){listContainer.classList.add('hidden');boardContainer.classList.remove('hidden');boardToggleBtn.classList.add('bg-gray-100');renderBoard();}else{listContainer.classList.remove('hidden');boardContainer.classList.add('hidden');boardToggleBtn.classList.remove('bg-gray-100');}};

  refreshCities(); loadLeads().then(r=>{if(r?.leads?.length){leads=r.leads;applyFilters();renderStats();}}).catch(()=>{});
  renderList(); renderDetail(null); renderStats(); return container;
}
