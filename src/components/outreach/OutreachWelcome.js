// src/components/outreach/OutreachWelcome.js
//
// The SmartVideo welcome in Video Outreach: five short questions, one per screen, with a progress bar,
// Back and Skip. Every answer is handed to onChange (saved straight away by the caller), so leaving
// half-way picks up at the same question next time. Answers and options: src/lib/outreach/onboarding.js.
import { el, svg, ICONS, LOGO, card, INPUT } from '../onboarding/ui.js';
import { GOALS, TEAM_SIZES, VOLUMES, SOURCES, ONBOARDING_STEPS, cleanOnboarding, workReady, normalizeWebsite } from '../../lib/outreach/onboarding.js';

/**
 * mountOutreachWelcome(host, { name, initial, onChange(answers), onFinish(answers), onAcademy() }) -> { destroy }
 */
export function mountOutreachWelcome(host, { name = '', initial = null, onChange = () => {}, onFinish = () => {}, onAcademy = null, skipAnswered = false } = {}) {
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
  // skipAnswered: the app-wide onboarding already asked team, volume, company and source, so moving forward
  // jumps over questions that have an answer (Back still shows them).
  const answered = (s) => (s === 2 && !!a.team) || (s === 3 && !!a.volume) || (s === 4 && workReady(a)) || (s === 5 && !!a.heard);
  const next = () => {
    let s = a.step + 1;
    if (skipAnswered) while (s <= ONBOARDING_STEPS && answered(s)) s += 1;
    return s > ONBOARDING_STEPS ? finish() : go(s);
  };
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
