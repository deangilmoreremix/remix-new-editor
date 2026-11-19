// src/components/outreach/OutreachWelcome.js
//
// The SmartVideo welcome in Video Outreach: five short questions, one per screen, with a progress bar,
// Back and Skip. Every answer is handed to onChange (saved straight away by the caller), so leaving
// half-way picks up at the same question next time. Answers and options: src/lib/outreach/onboarding.js.
import { GOALS, TEAM_SIZES, VOLUMES, SOURCES, ONBOARDING_STEPS, cleanOnboarding, workReady, normalizeWebsite } from '../../lib/outreach/onboarding.js';

const el = (tag, cls = '', txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
};
const svg = (paths, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  camera: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/>',
  sparkles: '<path d="M10 3.5 11.8 8.2 16.5 10l-4.7 1.8L10 16.5l-1.8-4.7L3.5 10l4.7-1.8z"/><path d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M15.5 14.6c2.4.1 4.2 1.6 4.8 4.4"/>',
  group: '<circle cx="8" cy="9" r="2.6"/><circle cx="16" cy="9" r="2.6"/><path d="M3 18.5c.5-2.6 2.4-4 5-4s4.5 1.4 5 4"/><path d="M11 18.5c.5-2.6 2.4-4 5-4s4.5 1.4 5 4"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2.2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  building: '<path d="M4 21V9l8-5 8 5v12"/><path d="M9.5 21v-5.5h5V21"/><path d="M3 21h18"/>',
  back: '<path d="m14.5 6-6 6 6 6"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  academy: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2V11"/><path d="M21.5 9v5"/>',
};
const LOGO = `<div class="grid h-8 w-8 place-items-center rounded-lg bg-white p-1.5">${svg('<path d="M12 2 2 7l10 5 10-5-10-5Z" fill="black" stroke="none"/><path d="m2 17 10 5 10-5" stroke="black" stroke-width="2"/><path d="m2 12 10 5 10-5" stroke="black" stroke-width="2"/>', 22)}</div>`;

// Outlined, never filled (like the studios' prompt bar); chosen = light lime tint, like Personalize.
const CARD = 'text-left rounded-2xl border bg-white/[0.02] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';
const card = (on) => `${CARD} ${on ? 'border-primary/45 bg-primary/[0.07]' : 'border-white/10 hover:border-primary/35 hover:bg-white/[0.04]'}`;
const INPUT = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-primary/50';

/**
 * mountOutreachWelcome(host, { name, initial, onChange(answers), onFinish(answers), onAcademy() }) -> { destroy }
 */
export function mountOutreachWelcome(host, { name = '', initial = null, onChange = () => {}, onFinish = () => {}, onAcademy = null } = {}) {
  let a = cleanOnboarding(initial || {});
  const root = el('div', 'absolute inset-0 z-40 flex flex-col overflow-y-auto bg-app-bg text-white');
  root.setAttribute('data-outreach-welcome', '');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Welcome to SmartVideo');
  const bar = el('div', 'h-[3px] w-full shrink-0 bg-white/[0.06]');
  const fill = el('div', 'h-full bg-primary transition-all duration-300');
  bar.appendChild(fill);
  const head = el('div', 'grid shrink-0 grid-cols-3 items-center px-6 py-5 md:px-12');
  const body = el('div', 'mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 pb-24 pt-6 md:pt-14');
  root.append(bar, head, body);
  host.appendChild(root);

  const change = (patch) => { a = cleanOnboarding({ ...a, ...patch }); onChange(a); };
  const go = (step) => { change({ step }); paint(); root.scrollTop = 0; };
  const next = () => (a.step >= ONBOARDING_STEPS ? finish() : go(a.step + 1));
  function finish() { change({ completedAt: new Date().toISOString() }); destroy(); onFinish(a); }

  function header() {
    head.replaceChildren();
    const left = el('div', 'justify-self-start');
    if (a.step === 1) {
      const logo = el('div', 'flex items-center gap-2.5');
      logo.innerHTML = `${LOGO}<span class="text-lg font-extrabold tracking-tight">SmartVideo</span>`;
      left.appendChild(logo);
    } else {
      const back = el('button', 'flex items-center gap-1 rounded-lg px-1 py-1 text-sm text-white/60 hover:text-white');
      back.type = 'button';
      back.setAttribute('data-welcome-back', '');
      back.innerHTML = `${svg(ICONS.back, 16)}<span>Back</span>`;
      back.addEventListener('click', () => go(a.step - 1));
      left.appendChild(back);
    }
    const mid = el('div', 'justify-self-center text-[13px] text-white/50', `Step ${a.step} of ${ONBOARDING_STEPS}`);
    const right = el('div', 'justify-self-end');
    if (a.step !== 4) {
      const skip = el('button', 'rounded-lg px-1 py-1 text-sm text-white/60 hover:text-white', 'Skip');
      skip.type = 'button';
      skip.setAttribute('data-welcome-skip', '');
      skip.addEventListener('click', next);
      right.appendChild(skip);
    }
    head.append(left, mid, right);
    fill.style.width = `${(a.step / ONBOARDING_STEPS) * 100}%`;
  }

  const titles = (t, sub) => {
    const h = el('h1', 'text-center text-3xl font-extrabold tracking-tight md:text-[34px]', t);
    const p = el('p', 'mt-3 text-center text-[15px] text-white/55', sub);
    body.append(h, p);
  };

  function step1() {
    titles(`Welcome${name ? `, ${name}` : ''}. What do you want to do first?`, 'We set up Video Outreach for your choice. You can do both later.');
    const grid = el('div', 'mt-10 grid w-full max-w-4xl gap-5 md:grid-cols-2');
    GOALS.forEach((g) => {
      const b = el('button', `${card(a.goal === g.id)} flex flex-col gap-4 p-8`);
      b.type = 'button';
      b.setAttribute('data-welcome-goal', g.id);
      b.setAttribute('aria-pressed', String(a.goal === g.id));
      const icon = el('div', 'grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary');
      icon.innerHTML = svg(g.id === 'personal' ? ICONS.camera : ICONS.sparkles, 24);
      const tags = el('div', 'mt-auto flex flex-wrap gap-2 pt-6');
      g.tags.forEach((t) => tags.appendChild(el('span', 'rounded-full bg-white/[0.07] px-3 py-1 text-xs font-semibold text-white/75', t)));
      b.append(icon, el('div', 'text-xl font-bold', g.title), el('p', 'text-[15px] leading-relaxed text-white/60', g.text), tags);
      b.addEventListener('click', () => { change({ goal: g.id }); next(); });
      grid.appendChild(b);
    });
    body.appendChild(grid);
    if (onAcademy) {
      const help = el('button', 'mt-9 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-5 py-3 text-sm font-semibold text-white/85 hover:border-primary/45 hover:bg-primary/[0.14] hover:text-white');
      help.type = 'button';
      help.setAttribute('data-welcome-academy', '');
      help.innerHTML = `<span class="text-primary">${svg(ICONS.academy, 16)}</span><span>Not sure? Learn it in the SmartVideo Academy</span>`;
      help.addEventListener('click', () => onAcademy());
      body.appendChild(help);
    }
  }

  function step2() {
    titles('Who else on your team might use SmartVideo?', 'We use this to suggest the right plan and set up sharing for your team.');
    const list = el('div', 'mt-10 flex w-full max-w-xl flex-col gap-3');
    TEAM_SIZES.forEach((t) => {
      const b = el('button', `${card(a.team === t.id)} flex items-center gap-4 px-5 py-4 text-[16px] font-semibold`);
      b.type = 'button';
      b.setAttribute('data-welcome-team', t.id);
      b.setAttribute('aria-pressed', String(a.team === t.id));
      b.innerHTML = `<span class="text-primary">${svg(ICONS[t.icon])}</span>`;
      b.appendChild(el('span', '', t.label));
      b.addEventListener('click', () => { change({ team: t.id }); next(); });
      list.appendChild(b);
    });
    body.appendChild(list);
  }

  function step3() {
    titles('How many videos do you expect to send per month?', 'A guess is fine. It helps us suggest the right plan.');
    const grid = el('div', 'mt-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3');
    VOLUMES.forEach((v) => {
      const b = el('button', `${card(a.volume === v.id)} px-4 py-6 text-center text-[17px] font-semibold`, v.label);
      b.type = 'button';
      b.setAttribute('data-welcome-volume', v.id);
      b.setAttribute('aria-pressed', String(a.volume === v.id));
      b.addEventListener('click', () => { change({ volume: v.id }); next(); });
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  function step4() {
    titles('Tell us where you work', 'We use your company and website for your sample video, your scripts and your landing pages.');
    const form = el('form', 'mt-10 flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-7');
    form.setAttribute('data-welcome-work', '');
    const input = (label, key, ph, type = 'text') => {
      const wrap = el('label', 'flex flex-col gap-2');
      wrap.appendChild(el('span', 'text-[13px] font-semibold text-white/80', label));
      const i = el('input', INPUT);
      i.type = type; i.name = key; i.placeholder = ph; i.value = a[key] || '';
      i.autocomplete = key === 'company' ? 'organization' : key === 'jobTitle' ? 'organization-title' : 'url';
      i.addEventListener('input', () => { a = cleanOnboarding({ ...a, [key]: i.value }); ok.disabled = !workReady(a); });
      i.addEventListener('change', () => change({ [key]: i.value }));
      wrap.appendChild(i);
      return { wrap, i };
    };
    const company = input('Company name', 'company', 'For example: Acme Inc.');
    const site = input('Website', 'website', 'For example: acme.com');
    const job = input('Job title', 'jobTitle', 'For example: Account Executive');
    const hint = el('p', 'min-h-[1rem] text-xs text-amber-300');
    site.i.addEventListener('blur', () => { hint.textContent = site.i.value.trim() && !normalizeWebsite(site.i.value) ? 'Enter a web address, like acme.com.' : ''; });
    const ok = el('button', 'mt-1 rounded-xl border border-white/[0.12] border-l-2 border-l-primary bg-transparent px-5 py-3.5 text-[15px] font-bold text-white hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35', 'Continue');
    ok.type = 'submit';
    ok.disabled = !workReady(a);
    form.append(company.wrap, site.wrap, job.wrap, hint, ok);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!workReady(a)) return;
      change({ company: company.i.value, website: normalizeWebsite(site.i.value), jobTitle: job.i.value });
      next();
    });
    body.appendChild(form);
    setTimeout(() => (a.company ? site.i : company.i).focus?.(), 0);
  }

  function step5() {
    titles('Finally, how did you hear about us?', 'It helps us find more teams like yours. One click and you are in. Your first video is next.');
    const wrap = el('div', 'mt-10 flex w-full max-w-4xl flex-wrap justify-center gap-3');
    SOURCES.forEach((s) => {
      const on = a.heard === s.id;
      const b = el('button', `rounded-full border px-5 py-3 text-[15px] font-semibold transition-colors ${on ? 'border-primary/45 bg-primary/[0.08]' : 'border-white/10 hover:border-primary/35 hover:bg-white/[0.04]'}`, s.label);
      b.type = 'button';
      b.setAttribute('data-welcome-heard', s.id);
      b.addEventListener('click', () => { change({ heard: s.id, heardOther: '' }); finish(); });
      wrap.appendChild(b);
    });
    const other = el('form', 'flex items-center gap-2 rounded-full border border-dashed border-white/20 py-1.5 pl-5 pr-1.5 focus-within:border-primary/50');
    const i = el('input', 'w-48 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none');
    i.placeholder = 'Something else…';
    i.setAttribute('aria-label', 'Something else');
    i.value = a.heard === 'other' ? a.heardOther : '';
    const send = el('button', 'grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/70 hover:border-primary/40 hover:text-white disabled:opacity-40');
    send.type = 'submit';
    send.setAttribute('aria-label', 'Send');
    send.innerHTML = svg(ICONS.arrow, 16);
    other.append(i, send);
    other.addEventListener('submit', (e) => { e.preventDefault(); if (!i.value.trim()) { i.focus(); return; } change({ heard: 'other', heardOther: i.value }); finish(); });
    wrap.appendChild(other);
    body.appendChild(wrap);
  }

  const STEP_VIEWS = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5 };
  function paint() { header(); body.replaceChildren(); STEP_VIEWS[a.step](); }
  function destroy() { root.remove(); }
  paint();
  return { destroy, get answers() { return a; } };
}
