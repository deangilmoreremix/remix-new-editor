/**
 * List Builder / Lead Generator options for the form that is already part of a design.
 *
 * Every design's form (hero form, contact band, the extension heroes) is one component, LeadForm. These options add the
 * timeline editor's List Builder / Personalizer / Lead Generator behaviour to THAT form, in the design's own look:
 *   form type, the gate (full-screen before the page is used) with a skip button, what happens after sending (message,
 *   thank-you button, redirect), a privacy link, a pointer (arrow + bubble) at the form, tracking ids, and a few look overrides.
 * More boxes, box types (text / e-mail / phone / number / date / dropdown / message), required flags and hints are the
 * form's own "Form fields" list. Webhooks, notification e-mails and the e-mail list are owner-only (Leads tab).
 *
 * `formOptions` is optional and absent from existing designs, so saved pages and designs are unchanged until it is used.
 */
import React, { useEffect, useState } from 'react';
import { personalizerTokens, leadPayload } from './optinForm.jsx';

export const FORM_KINDS = [
  { label: 'Lead Generator (boxes are optional unless marked required)', value: 'lead-generator' },
  { label: 'List Builder (every box is required)', value: 'list-builder' },
  { label: 'Personalizer (the page is personalized with the answers)', value: 'personalizer' },
];
export const AFTER_ACTIONS = [
  { label: 'Show the thank-you message', value: 'message' },
  { label: 'Show a thank-you button', value: 'button' },
  { label: 'Open another page (https link)', value: 'redirect' },
];
const yesNo = (label) => ({ type: 'radio', label, options: [{ label: 'Yes', value: true }, { label: 'No', value: false }] });
const T = (label) => ({ type: 'text', label });

export const FORM_OPTION_DEFAULTS = {
  kind: 'lead-generator', gate: false, skip: false, skipText: 'Skip', askEveryVisit: false,
  afterAction: 'message', afterUrl: '', afterButtonText: 'Continue',
  privacyLink: '', privacyLinkText: 'Privacy policy',
  pointer: false, pointerText: 'Fill out your details to continue', pointerSeconds: 6,
  fbPixelId: '', gaMeasurementId: '', tiktokPixelId: '', gtmId: '',
  buttonColor: '', boxRadius: '',
};

/** The Puck field shown inside the form's own component: "Lead form options". */
export const formOptionsField = () => ({
  type: 'object',
  label: 'Lead form options (List Builder / Lead Generator)',
  objectFields: {
    kind: { type: 'radio', label: 'Form type', options: FORM_KINDS },
    gate: yesNo('Show this form full screen before the page is used'),
    skip: yesNo('Let visitors skip the form (when it is shown full screen)'),
    skipText: T('Skip button text'),
    askEveryVisit: yesNo('Ask returning visitors every visit'),
    afterAction: { type: 'radio', label: 'After the form is sent', options: AFTER_ACTIONS },
    afterUrl: T('Thank-you button / redirect link (https)'),
    afterButtonText: T('Thank-you button text'),
    privacyLink: T('Privacy policy link (https)'),
    privacyLinkText: T('Privacy policy link text'),
    pointer: yesNo('Show a pointer (arrow and bubble) at the form'),
    pointerText: T('Pointer bubble text'),
    pointerSeconds: { type: 'number', label: 'Pointer shows for (seconds, 0 = until clicked)', min: 0, max: 30 },
    fbPixelId: T('Facebook Pixel id'),
    gaMeasurementId: T('Google Analytics 4 id (G-XXXXXXXXXX)'),
    tiktokPixelId: T('TikTok Pixel id'),
    gtmId: T('Google Tag Manager id (GTM-XXXXXXX)'),
    buttonColor: T('Button colour override (#hex, empty = the design)'),
    boxRadius: { type: 'number', label: 'Box corner radius override (px, empty = the design)', min: 0, max: 40 },
  },
});

const HEX = /^#[0-9a-f]{3,8}$/i;
const https = (v) => (/^https:\/\/\S{3,500}$/i.test(String(v || '').trim()) ? String(v).trim() : '');

/** Complete, safe options from whatever is stored. Never throws. */
export function normalizeOptions(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const d = FORM_OPTION_DEFAULTS;
  const text = (v, fb, max = 80) => { const s = typeof v === 'string' ? v.trim().slice(0, max) : ''; return s || fb; };
  const radius = Number(o.boxRadius);
  return {
    kind: ['lead-generator', 'list-builder', 'personalizer'].includes(o.kind) ? o.kind : d.kind,
    gate: o.gate === true, skip: o.skip === true, skipText: text(o.skipText, d.skipText, 30), askEveryVisit: o.askEveryVisit === true,
    afterAction: ['message', 'button', 'redirect'].includes(o.afterAction) ? o.afterAction : d.afterAction,
    afterUrl: https(o.afterUrl), afterButtonText: text(o.afterButtonText, d.afterButtonText, 40),
    privacyLink: https(o.privacyLink), privacyLinkText: text(o.privacyLinkText, d.privacyLinkText, 40),
    pointer: o.pointer === true, pointerText: text(o.pointerText, d.pointerText, 80), pointerSeconds: Number.isFinite(Number(o.pointerSeconds)) ? Math.max(0, Math.min(30, Number(o.pointerSeconds))) : d.pointerSeconds,
    fbPixelId: text(o.fbPixelId, '', 20), gaMeasurementId: text(o.gaMeasurementId, '', 14), tiktokPixelId: text(o.tiktokPixelId, '', 32), gtmId: text(o.gtmId, '', 12),
    buttonColor: HEX.test(String(o.buttonColor || '').trim()) ? String(o.buttonColor).trim() : '',
    boxRadius: o.boxRadius !== '' && o.boxRadius != null && Number.isFinite(radius) ? Math.max(0, Math.min(40, radius)) : null,
  };
}

/** Whether any option is on (so an untouched form costs nothing extra). */
export const hasTracking = (o) => !!(o.fbPixelId || o.gaMeasurementId || o.tiktokPixelId || o.gtmId);

/** List Builder makes every box required; the other types follow each box's own setting. */
export const fieldRequired = (f, kind) => kind === 'list-builder' || !!f.required;

/** Where a visitor goes after sending: nothing extra, a thank-you button, or a redirect (https only). */
export const afterSubmitPlan = (o, rootForm = { action: 'message', url: '' }) => {
  if (o.afterAction === 'button' && o.afterUrl) return { action: 'button', url: o.afterUrl, text: o.afterButtonText };
  if (o.afterAction === 'redirect' && o.afterUrl) return { action: 'redirect', url: o.afterUrl, text: '' };
  if (rootForm.action === 'redirect' && /^https:/i.test(rootForm.url || '')) return { action: 'redirect', url: rootForm.url, text: '' };
  return { action: 'message', url: '', text: '' };
};

/** Personalizer: the page reloads with the visitor's answers as personal tokens. Returns true when it navigated. */
export function personalizePage(data, { assign = (u) => globalThis.location.assign(u), href = globalThis.location?.href } = {}) {
  const tokens = personalizerTokens(leadPayload(data));
  if (!Object.keys(tokens).length) return false;
  try {
    const u = new URL(href);
    Object.entries(tokens).forEach(([k, v]) => u.searchParams.set(k, v));
    assign(u.toString());
    return true;
  } catch { return false; }
}

const seenKey = (pageId) => `pk-form-${String(pageId || 'page').replace(/[^A-Za-z0-9_-]/g, '')}`;
export const gateSeen = (pageId) => { try { return globalThis.localStorage?.getItem(seenKey(pageId)) === '1'; } catch { return false; } };
export const markGateSeen = (pageId) => { try { globalThis.localStorage?.setItem(seenKey(pageId), '1'); } catch { /* the gate simply shows again */ } };

/** An arrow and a bubble pointing at the form, in the page's accent colour; hides itself after N seconds or on click. */
export function PointerHint({ text, seconds }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!seconds) return undefined;
    const id = setTimeout(() => setOn(false), seconds * 1000);
    return () => clearTimeout(id);
  }, [seconds]);
  if (!on) return null;
  return (
    <button type="button" className="pk-pointer" onClick={() => setOn(false)} aria-label={text}>
      <span className="pk-pointer-bubble">{text}</span>
      <svg className="pk-pointer-arrow" viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M12 3v14.2l5.6-5.6L19 13l-7 7-7-7 1.4-1.4 5.6 5.6V3z" /></svg>
    </button>
  );
}
