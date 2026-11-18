/**
 * The timeline editor's List Builder / Personalizer / Lead Generator form, as landing-page sections.
 *
 * It is the SAME form: the page uses the timeline's own renderer (buildOptinForm / showOptinOverlay / showThanks / the
 * pointer designs) and its own settings schema (listBuilderFields), so every look, field, layout, pointer, skip,
 * after-submit and gate option works the same way on a page.
 *
 *  - Inline (default): the form is a section of the page.
 *  - Gate ("Require viewers to fill this out before the video plays" on): visitors see the form first, full screen,
 *    and can continue after sending it (or skipping, when the skip button is on). Remembered per visitor unless
 *    "Ask returning viewers every visit" is on. Never shown in the editor preview.
 *  - Personalizer: after the form is sent the page reloads with the answers as personal tokens (?firstname=...).
 *
 * The page config is PUBLIC. Webhooks, notification e-mails and the e-mail list are owner-only (the Leads tab, "Where
 * leads go") and are stripped from this config here, so they can never be published with the page.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { defaultListBuilder, normalizeListBuilder, listBuilderFields } from '../optin/listBuilder.js';
import { buildOptinForm, buildArrowHint, startPointer, showOptinOverlay, showThanks, ensureFormFont } from '../optin/addonOverlay.js';
import { renderAddonEditor } from '../optin/addonEditor.js';
import { usePage } from './context.js';
import { leadKindFor } from '../leadPipeline.js';

/** Keys that must never be published with a page: delivery targets and any private/internal value. */
const PRIVATE_KEY = /^(webhook|email|esp|_)/i;
const PUBLIC_PIXELS = ['fbPixelId', 'gaMeasurementId', 'tiktokPixelId', 'gtmId'];

/** The version of a form config that is safe to store in the public page: no webhooks, e-mail addresses or list ids. */
export function publicOptinConfig(config) {
  const src = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (PRIVATE_KEY.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/** An answer key the lead pipeline accepts and the e-mail-list step can read: "FIRST NAME" -> first_name. */
export const answerKey = (token) => String(token || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'field';

/** The answers exactly as the timeline saves them: keyed by the box tokens ("FIRST NAME"), empty ones dropped. */
export function rawAnswers(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) { const val = String(v ?? '').trim().slice(0, 2000); if (val && k) out[String(k).slice(0, 64)] = val; }
  return out;
}

/** Form answers keyed by lowercase names, used to map a Personalizer's answers to the page's tokens. */
export function leadPayload(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    const key = answerKey(k); const val = String(v ?? '').trim().slice(0, 1000);
    if (val && !(key in out)) out[key] = val;
  }
  return out;
}

/** Personalizer: the answers that become the page's personal tokens (first name, last name, company...). */
export function personalizerTokens(data) {
  const map = { first_name: 'firstname', firstname: 'firstname', name: 'firstname', last_name: 'lastname', lastname: 'lastname', company: 'company', business: 'company', role: 'role', title: 'role', city: 'city' };
  const out = {};
  for (const [k, v] of Object.entries(leadPayload(data))) if (map[k] && !out[map[k]]) out[map[k]] = v.slice(0, 80);
  return out;
}

const seenKey = (pageId) => `pk-optin-${String(pageId || 'page').replace(/[^A-Za-z0-9_-]/g, '')}`;
const remembered = (pageId) => { try { return globalThis.localStorage?.getItem(seenKey(pageId)) === '1'; } catch { return false; } };
const remember = (pageId) => { try { globalThis.localStorage?.setItem(seenKey(pageId), '1'); } catch { /* private mode: the form simply shows again */ } };

/** Safe, validated pixel ids from the form config (only digits / the official id shapes). */
export function pixelIds(config) {
  const ok = (v, re) => (re.test(String(v || '').trim()) ? String(v).trim() : '');
  return {
    fb: ok(config?.fbPixelId, /^\d{6,20}$/), ga: ok(config?.gaMeasurementId, /^G-[A-Z0-9]{4,14}$/),
    tiktok: ok(config?.tiktokPixelId, /^[A-Z0-9]{8,32}$/), gtm: ok(config?.gtmId, /^GTM-[A-Z0-9]{4,12}$/),
  };
}

function useFormConfig(config) {
  return useMemo(() => publicOptinConfig(normalizeListBuilder(config && typeof config === 'object' ? config : {})), [config]);
}

/** One submit handler for both the inline form and the gate: validate, save the lead, then run the after-submit step. */
function wireSubmit(form, { cfg, page, handlers, layer, onDone, preview }) {
  const status = form.querySelector('.addon-optin__status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const blank = Array.from(form.elements).find((el) => el.required && !String(el.value || '').trim());
    if (blank) { if (status) status.textContent = 'Please complete all fields.'; blank.focus?.({ preventScroll: true }); return; }
    if (preview) { if (status) status.textContent = 'Preview only: nothing is sent.'; return; }
    const data = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    const res = await (handlers?.onLead?.(rawAnswers(data), { kind: leadKindFor(cfg.kind) }) ?? { error: 'Form is not available' });
    if (res?.error) { if (btn) btn.disabled = false; if (status) status.textContent = 'Could not send. Please try again.'; return; }
    if (status) status.textContent = '';
    if (cfg.kind === 'personalizer') {
      try {
        const u = new URL(globalThis.location.href);
        Object.entries(personalizerTokens(data)).forEach(([k, v]) => u.searchParams.set(k, v));
        remember(page?.id);
        globalThis.location.assign(u.toString());
        return;
      } catch { /* fall through to the thank-you */ }
    }
    onDone?.(data);
    try { showThanks(layer, cfg, { allowRedirect: true }); } catch { /* cosmetic; the lead is saved */ }
  });
}

/** The timeline's form styles size everything from the layer's pixel size (--ovl-w / --ovl-h); keep them current. */
function trackLayerSize(layer) {
  const set = () => { layer.style.setProperty('--ovl-w', `${layer.clientWidth || globalThis.innerWidth || 800}px`); layer.style.setProperty('--ovl-h', `${layer.clientHeight || globalThis.innerHeight || 450}px`); };
  set();
  const ro = typeof globalThis.ResizeObserver === 'function' ? new globalThis.ResizeObserver(set) : null;
  ro?.observe(layer);
  globalThis.addEventListener?.('resize', set);
  return () => { ro?.disconnect(); globalThis.removeEventListener?.('resize', set); };
}

/** Inline form (and the editor preview of a gate). */
export function ListBuilderForm({ config, kind }) {
  const { page, handlers, preview, tokens } = usePage();
  const cfg0 = useFormConfig(config);
  const cfg = kind && !config?.kind ? { ...cfg0, kind } : cfg0;
  const host = useRef(null);
  const key = JSON.stringify(cfg) + (preview ? '|p' : '|v');

  useEffect(() => {
    const el = host.current; if (!el) return undefined;
    el.replaceChildren();
    const layer = document.createElement('div'); layer.className = 'addon-overlay-layer pk-optin-layer';
    layer.style.cssText = 'position:relative;width:100%;height:460px;border-radius:16px;overflow:hidden;';
    const untrack = trackLayerSize(layer);
    ensureFormFont?.(cfg.fontFamily);
    const prefill = { 'FIRST NAME': tokens?.firstname || '', 'LAST NAME': tokens?.lastname || '', COMPANY: tokens?.company || '' };
    const wrap = document.createElement('div'); wrap.className = 'addon-overlay addon-overlay--optin pk-optin'; wrap.dataset.kind = cfg.kind || 'list-builder';
    const form = buildOptinForm(cfg, { prefill, compact: (el.clientWidth || 800) < 480 });
    wrap.appendChild(form);
    let stop = () => {};
    const hint = buildArrowHint(cfg);
    if (hint && !preview) { wrap.appendChild(hint); requestAnimationFrame?.(() => { if (wrap.isConnected) stop = startPointer(hint, form, cfg); }); }
    layer.appendChild(wrap);
    wireSubmit(form, { cfg, page, handlers, layer, preview, onDone: () => { wrap.style.display = 'none'; } });
    form.querySelector('.skip-button')?.addEventListener('click', () => { wrap.style.display = 'none'; });
    el.appendChild(layer);
    return () => { stop(); untrack(); el.replaceChildren(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="pk-section pk-optin-section" aria-label={cfg.caption || 'Sign up'}>
      {preview && cfg.enabled ? <p className="pk-optin-note" style={{ fontSize: 12, opacity: 0.7, margin: '0 0 6px' }}>Viewers see this form first, full screen, before the video plays{cfg.enableSkipButton ? ' (they can skip it)' : ''}.</p> : null}
      <div ref={host} data-testid="optin-host" />
    </section>
  );
}

/** The gate: full-screen form shown once per visitor before the page (and its video) can be used. Public page only. */
export function OptinGate({ config }) {
  const { page, handlers, preview } = usePage();
  const cfg = useFormConfig(config);
  const key = JSON.stringify(cfg);
  useEffect(() => {
    if (preview || !cfg.enabled || !page?.id) return undefined;
    if (!cfg.askEveryVisit && remembered(page.id)) return undefined;
    const layer = document.createElement('div');
    layer.setAttribute('data-pk-gate', '1'); layer.className = 'addon-overlay-layer';
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483000;';
    document.body.appendChild(layer);
    const untrack = trackLayerSize(layer);
    ensureFormFont?.(cfg.fontFamily);
    let wrap = null;
    const finish = () => { if (!cfg.askEveryVisit) remember(page.id); };
    wrap = showOptinOverlay(layer, cfg, {
      prefill: {}, allowRedirect: true, name: 'list-builder',
      onSubmit: async (data) => {
        const res = await (handlers?.onLead?.(rawAnswers(data), { kind: leadKindFor(cfg.kind) }) ?? { error: 'Form is not available' });
        if (res?.error) throw new Error('Could not send. Please try again.');
        finish();
        if (cfg.kind === 'personalizer') {
          const u = new URL(globalThis.location.href);
          Object.entries(personalizerTokens(data)).forEach(([k, v]) => u.searchParams.set(k, v));
          globalThis.location.assign(u.toString());
        }
        setTimeout(() => layer.remove(), 1600);
        return '';
      },
      onSkip: () => { finish(); layer.remove(); },
    });
    return () => { untrack(); wrap?.remove(); layer.remove(); };
  }, [key, preview, page?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Facebook / Google / TikTok / Tag Manager: loaded on the public page only, from the ids set in the form. */
export function PixelLoader({ config }) {
  const { preview } = usePage();
  const ids = useMemo(() => pixelIds(config), [config]);
  useEffect(() => {
    if (preview) return;
    const add = (src, attrs = {}) => { const s = document.createElement('script'); s.async = true; s.src = src; Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v)); document.head.appendChild(s); };
    if (ids.gtm) { globalThis.dataLayer = globalThis.dataLayer || []; globalThis.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' }); add(`https://www.googletagmanager.com/gtm.js?id=${ids.gtm}`); }
    if (ids.ga) { globalThis.dataLayer = globalThis.dataLayer || []; globalThis.gtag = function gtag() { globalThis.dataLayer.push(arguments); }; globalThis.gtag('js', new Date()); globalThis.gtag('config', ids.ga); add(`https://www.googletagmanager.com/gtag/js?id=${ids.ga}`); }
    if (ids.fb) { add('https://connect.facebook.net/en_US/fbevents.js', { 'data-pixel': ids.fb }); globalThis.fbq = globalThis.fbq || function fbq() { (globalThis.fbq.queue = globalThis.fbq.queue || []).push(arguments); }; globalThis.fbq('init', ids.fb); globalThis.fbq('track', 'PageView'); }
    if (ids.tiktok) { add(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${ids.tiktok}&lib=ttq`); }
  }, [ids, preview]);
  return null;
}

// ------------------------------------------------------------------------------------- editor field

/** The form settings the page editor shows: the timeline's own schema, minus the owner-only delivery tabs. */
export function pageOptinFields(config) {
  return listBuilderFields(config)
    .filter((f) => f.tab !== 'Integrations' || PUBLIC_PIXELS.includes(f.key))
    .filter((f) => !PRIVATE_KEY.test(f.key))
    .map((f) => (PUBLIC_PIXELS.includes(f.key) ? { ...f, tab: 'Tracking' } : f));
}

/** Puck custom field: the timeline's List Builder settings panel (tabs: Text, Styles, Fields, Pointer, Tracking). */
export function optinConfigField(label, kind = 'list-builder') {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange }) => {
      const box = useRef(null); // eslint-disable-line react-hooks/rules-of-hooks
      const latest = useRef(onChange); latest.current = onChange; // eslint-disable-line react-hooks/rules-of-hooks
      useEffect(() => { // eslint-disable-line react-hooks/rules-of-hooks
        if (!box.current) return undefined;
        const start = normalizeListBuilder(value && typeof value === 'object' && Object.keys(value).length ? value : defaultListBuilder(kind));
        const ed = renderAddonEditor(box.current, {
          options: start, idPrefix: 'pkopt', fieldsFor: (o) => pageOptinFields(o), services: {},
          onChange: (next) => { latest.current(publicOptinConfig(next)); },
        });
        return () => ed?.destroy?.();
      }, []); // the editor keeps its own state; Puck re-mounts the field when another section is selected
      return (
        // The timeline's settings panel is built for a dark surface (light labels); Puck's sidebar is white, so it gets its own dark card.
        <div className="pk-optin-editor" style={{ background: '#1b1d26', color: '#e8eaf2', borderRadius: 12, padding: 12, margin: '4px 0 12px' }}>
          <p style={{ fontSize: 12, margin: '0 0 8px', opacity: 0.8, color: '#e8eaf2' }}>{label}. Webhooks, e-mail notifications and your e-mail list are set in the Leads tab (they stay private).</p>
          <style>{'.pk-optin-editor .addon-tab{color:#e8eaf2;background:#2a2d3a;border:1px solid #3a3e50;border-radius:6px;padding:3px 8px;margin:0 3px 4px 0;cursor:pointer}.pk-optin-editor .addon-tab.active{background:#22d3ee;color:#04141a;border-color:#22d3ee;font-weight:700}'}</style>
          <div ref={box} />
        </div>
      );
    },
  };
}

export { defaultListBuilder };
