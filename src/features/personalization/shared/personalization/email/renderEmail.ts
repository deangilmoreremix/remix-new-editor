/**
 * Renders an OutreachEmail to HTML + plain text (Stage 9). The renderer is imported on demand: @react-email/render pulls in
 * react-dom/server, which the editor does not otherwise need.
 */
import * as React from 'react'
import { OutreachEmailTemplate } from './OutreachEmailTemplate'
import { checkEmail, hasBlockingProblems, normalizeEmail, toPlainText, type EmailCheck, type OutreachEmail } from './emailModel'

export interface RenderedEmail { html: string; text: string; checks: EmailCheck[]; blocked: boolean; htmlBytes: number }

/** Gmail clips messages over ~102 KB; stay well under it. */
export const GMAIL_CLIP_BYTES = 102 * 1024

export async function renderEmail(input: OutreachEmail): Promise<RenderedEmail> {
  const email = normalizeEmail(input)
  const { render } = await import('@react-email/render')
  const html = await render(React.createElement(OutreachEmailTemplate, { email }))
  const text = toPlainText(email)
  const checks = checkEmail(email)
  const htmlBytes = new TextEncoder().encode(html).length
  if (htmlBytes > GMAIL_CLIP_BYTES * 0.8) checks.push({ id: 'html-heavy', level: 'warn', message: `The email is ${(htmlBytes / 1024).toFixed(0)} KB; Gmail cuts messages off at about 102 KB. Shorten the text.` })
  return { html, text, checks, blocked: hasBlockingProblems(checks), htmlBytes }
}

/** What an HTML email must NOT contain, checked on the rendered output (the template is trusted; merge values and URLs are not). */
export function htmlProblems(html: string): string[] {
  const out: string[] = []
  if (/<script\b/i.test(html)) out.push('contains a <script> tag')
  // Only real tags can carry a handler: escaped text (also inside quoted attribute values) such as "&lt;img onerror=…&gt;" is harmless and must not be flagged.
  const tags = (html.match(/<[a-z][^>]*>/gi) ?? []).map((t) => t.replace(/"[^"]*"/g, '""')).join('\n')
  if (/\son[a-z]+\s*=/i.test(tags)) out.push('contains an inline event handler')
  if (/(?:href|src)\s*=\s*["']\s*(?:javascript|data|vbscript):/i.test(html)) out.push('contains a javascript:/data: URL')
  if (/<iframe\b|<object\b|<embed\b|<form\b/i.test(html)) out.push('contains an iframe, object, embed or form')
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) if (!/\balt\s*=/.test(m[0])) out.push('has an image without alt text')
  for (const m of html.matchAll(/href\s*=\s*"([^"]*)"/gi)) { const h = m[1].replace(/&amp;/g, '&'); if (!/^(https?:|mailto:|#)/i.test(h)) out.push(`has a link that is not http(s): ${h.slice(0, 40)}`) }
  return [...new Set(out)]
}
