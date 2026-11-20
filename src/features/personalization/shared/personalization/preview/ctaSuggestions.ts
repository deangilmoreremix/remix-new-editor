/**
 * Suggested end-card / call-to-action lines built ONLY from contact details the
 * business actually has. Nothing is invented: a suggestion exists only when its
 * field is present and well formed. Pure (no React), so the wizard, the editor
 * and tests share one source of truth.
 */

import { describeHours } from '../../../../../../netlify/functions/_personalization/src/server/businessEnrichment/openingHours';

export interface CtaInput {
  phone?: string
  website?: string
  email?: string
  /** Instagram profile URL or @handle. */
  instagram?: string
  /** Raw opening-hours text as published by the business. */
  openingHours?: string
}

export interface CtaSuggestion {
  id: 'call' | 'visit' | 'email' | 'instagram' | 'hours'
  label: string
  text: string
  /** Which field the line was built from (shown to the user). */
  source: string
}

const MAX_HOURS = 60;
const MAX_EMAIL = 60;
const RESERVED_IG = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'tv', 'about', 'directory']);

export function instagramHandle(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  let candidate: string | null = null;
  if (value.startsWith('@')) candidate = value.slice(1);
  else {
    const m = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i.exec(value);
    candidate = m ? m[1] : null;
  }
  if (!candidate) return null;
  if (RESERVED_IG.has(candidate.toLowerCase())) return null;
  return /^[A-Za-z0-9._]{1,30}$/.test(candidate) ? candidate : null;
}

function displayHost(website: string): string | null {
  const value = website.trim();
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./i, '');
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

function validPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && /^[\d\s()+.\-x]+$/i.test(phone.trim());
}

export function buildCtaSuggestions(input: CtaInput): CtaSuggestion[] {
  const out: CtaSuggestion[] = [];
  const phone = input.phone?.trim();
  if (phone && validPhone(phone)) {
    out.push({ id: 'call', label: 'Call', text: `Call ${phone}`, source: 'Phone number' });
  }
  const host = input.website ? displayHost(input.website) : null;
  if (host) out.push({ id: 'visit', label: 'Visit website', text: `Visit ${host}`, source: 'Website' });
  const email = input.email?.trim();
  if (email && email.length <= MAX_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    out.push({ id: 'email', label: 'Email', text: `Email ${email}`, source: 'Email address' });
  }
  const handle = instagramHandle(input.instagram);
  if (handle) out.push({ id: 'instagram', label: 'Instagram', text: `Follow @${handle}`, source: 'Instagram profile' });
  const hours = input.openingHours?.trim();
  if (hours && hours.length <= MAX_HOURS && !/[<>]/.test(hours)) {
    // Readable wording when the hours parse cleanly; otherwise the business's own text, unchanged.
    const readable = describeHours(hours);
    out.push({ id: 'hours', label: 'Opening hours', text: readable ? `Open ${readable}` : `Open ${hours}`, source: 'Opening hours' });
  }
  return out;
}

/**
 * Extra end-card contact line: email and @handle, only when present and valid.
 * Reuses the same validators as the CTA suggestions so both agree on what is real.
 */
export function endCardExtraLine(input: { email?: string; instagram?: string; cta?: string }): string {
  const cta = (input.cta ?? '').toLowerCase();
  const parts: string[] = [];
  const email = input.email?.trim();
  if (email && email.length <= MAX_EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !cta.includes(email.toLowerCase())) parts.push(email);
  const handle = instagramHandle(input.instagram);
  // Not repeated when the call to action already says it (e.g. "Follow @handle").
  if (handle && !cta.includes(`@${handle}`.toLowerCase())) parts.push(`@${handle}`);
  return parts.join('   ·   ');
}

/**
 * "4.8 ★ · 120 reviews" from a rating the business's own page publishes (normalised to a 5-star scale).
 * Returns '' for anything implausible, so no line is ever shown from bad data.
 */
export function ratingLine(rating: { value: number; count: number; best: number } | null | undefined): string {
  if (!rating || !(rating.best > 0) || !(rating.value > 0) || rating.value > rating.best) return '';
  if (!Number.isInteger(rating.count) || rating.count < 1) return '';
  const stars = Math.round((rating.value / rating.best) * 5 * 10) / 10;
  return `${stars.toFixed(1)} ★ · ${rating.count} ${rating.count === 1 ? 'review' : 'reviews'}`;
}
