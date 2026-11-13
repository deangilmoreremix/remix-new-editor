// Pure helpers for personalized-video campaigns (Phase 1). No network here:
// generation/upload wiring lands in later phases.

const TOKEN_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function normalizeKey(key) {
  return String(key || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Minimal RFC4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeKey);
  return rows.slice(1).map(r =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]).filter(([h]) => h)),
  );
}

/** Replace {{token}} with contact values; unknown tokens are reported, not silently blanked. */
export function renderScript(template, contact = {}) {
  const missing = new Set();
  const text = String(template || '').replace(TOKEN_RE, (_, k) => {
    const v = contact[normalizeKey(k)];
    if (v === undefined || v === '') { missing.add(normalizeKey(k)); return ''; }
    return v;
  });
  return { text: text.replace(/\s{2,}/g, ' ').trim(), missing: [...missing] };
}

export const SCRIPT_TOKENS = ['first_name', 'last_name', 'company', 'job_title', 'industry', 'website'];
