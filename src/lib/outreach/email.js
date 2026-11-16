// src/lib/outreach/email.js
//
// The email each contact gets: subject and body written once with {{firstname}}, {{company}}
// and {{link}}, and a thumbnail of the video that links to their page (as in Sendspark).
// Sending goes through the user's own mail: Copy email (rich HTML for Gmail/Outlook), Open in
// mail app (mailto), or a mail-merge CSV. Nothing here sends mail from our servers.
import { fillTemplate, contactValues, DEFAULT_EMAIL } from './draft.js';

export { DEFAULT_EMAIL };

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const safeHttps = (url) => {
  try { const u = new URL(String(url)); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : ''; } catch { return ''; }
};

// Stands in for {{link}} while the rest is filled (fillTemplate would drop an unknown token).
const LINK_MARK = '\u0000LINK\u0000';
const LINK_TOKEN = /\{\{\s*link\s*\}\}/gi;

/**
 * One contact's email. `link` is their personal page; `thumbnailUrl` their thumbnail image.
 * @returns {{ to, subject, text, html }}
 */
export function emailFor({ email = DEFAULT_EMAIL, fallbacks = {}, contact = {}, link = '', thumbnailUrl = '' }) {
  const values = contactValues(contact);
  // fillTemplate treats {{link}} as an unknown token; protect it first.
  const fill = (t) => fillTemplate(String(t || '').replace(LINK_TOKEN, LINK_MARK), values, fallbacks);
  // fillTemplate collapses whitespace, so fill each line on its own to keep paragraphs.
  const lines = String(email.body || '').split(/\r?\n/).map((line) => fill(line));
  const href = safeHttps(link);
  const subject = fill(email.subject).split(LINK_MARK).join(href);
  const text = lines.join('\n').split(LINK_MARK).join(href);
  const thumb = safeHttps(thumbnailUrl);
  const linkHtml = href ? `<a href="${esc(href)}">${esc(href)}</a>` : '';
  const paragraphs = lines.join('\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const body = paragraphs.map((p) => {
    // A paragraph that is only the link becomes the thumbnail (with a text link under it).
    if (p === LINK_MARK && thumb && href) {
      return `<p><a href="${esc(href)}"><img src="${esc(thumb)}" alt="Play the video" width="480" style="display:block;max-width:100%;border-radius:12px;border:0"></a></p><p>${linkHtml}</p>`;
    }
    return `<p>${esc(p).replace(/\n/g, '<br>').split(LINK_MARK).join(linkHtml)}</p>`;
  }).join('\n');
  const thumbFirst = thumb && href && !paragraphs.includes(LINK_MARK)
    ? `<p><a href="${esc(href)}"><img src="${esc(thumb)}" alt="Play the video" width="480" style="display:block;max-width:100%;border-radius:12px;border:0"></a></p>\n`
    : '';
  return { to: contact.email || '', subject, text, html: `<div>${thumbFirst}${body}</div>` };
}

/** A mailto: address that opens the email in the user's mail app (plain text). */
export function mailtoUrl({ to, subject, text }) {
  const q = new URLSearchParams({ subject, body: text }).toString().replace(/\+/g, '%20');
  return `mailto:${encodeURIComponent(to || '')}?${q}`;
}

const csvCell = (v) => {
  const s = String(v ?? '');
  // Cells starting with = + - @ would run as formulas in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Mail-merge CSV: one row per contact with the finished subject, body, link and thumbnail. */
export function mailMergeCsv(rows) {
  const head = ['Email', 'First Name', 'Last Name', 'Company', 'Subject', 'Body', 'HTML', 'Link', 'Thumbnail'];
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push([r.to, r.contact?.firstName, r.contact?.lastName, r.contact?.company, r.subject, r.text, r.html, r.link, r.thumbnailUrl].map(csvCell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** The clickable thumbnail alone (Copy GIF): the image linked to the contact's page. */
export function thumbnailHtml({ link, thumbnailUrl, width = 480 }) {
  const href = safeHttps(link);
  const src = safeHttps(thumbnailUrl);
  if (!href || !src) return '';
  return `<a href="${esc(href)}"><img src="${esc(src)}" alt="Play the video" width="${Number(width) || 480}" style="display:block;max-width:100%;border-radius:12px;border:0"></a>`;
}

/**
 * Embed code for email and outreach tools: the clickable thumbnail plus a text link under it,
 * for inboxes that block images. Email clients don't play video, so the page plays it.
 */
export function embedSnippet({ link, thumbnailUrl, name = '' }) {
  const href = safeHttps(link);
  if (!href) return '';
  const label = name ? `Watch the video for ${name}` : 'Watch the video';
  return `<div class="video-embed">${thumbnailHtml({ link, thumbnailUrl })}<p style="margin:8px 0 0"><a href="${esc(href)}">${esc(label)} &#9654;</a></p></div>`;
}

/** Open Gmail with the email ready to send (to, subject and the plain-text body). */
export function gmailUrl({ to = '', subject = '', text = '' }) {
  const u = new URL('https://mail.google.com/mail/');
  u.searchParams.set('view', 'cm');
  u.searchParams.set('fs', '1');
  if (to) u.searchParams.set('to', to);
  u.searchParams.set('su', subject);
  u.searchParams.set('body', text);
  return u.toString();
}

/** A short LinkedIn message with the contact's link (LinkedIn shows the video page's preview). */
export function linkedinMessage({ contact = {}, link = '', fallbacks = {} }) {
  const name = String(contact.firstName || '').trim() || fallbacks.firstname || 'there';
  const company = String(contact.company || '').trim();
  return `Hi ${name}, I recorded a quick video${company ? ` for ${company}` : ' for you'}: ${link}`;
}
