/**
 * A standards-shaped .eml file (RFC 5322 + MIME multipart/alternative) so the owner can open the exact email in a mail client, or
 * hand it to another tool. Pure. Headers are folded and non-ASCII is encoded (RFC 2047); bodies are base64 in 76-column lines.
 */
const b64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s); let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
const wrap76 = (s: string) => (s.match(/.{1,76}/g) ?? ['']).join('\r\n')
const asciiOnly = (s: string) => /^[\x20-\x7e]*$/.test(s)
/** Header values may not contain line breaks: that is how header injection works. */
const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()
export const encodeWord = (s: string): string => (asciiOnly(s) ? clean(s) : `=?UTF-8?B?${b64(clean(s))}?=`)
const mailbox = (name: string, address: string) => (name ? `${asciiOnly(name) ? `"${clean(name).replace(/["\\]/g, '')}"` : encodeWord(name)} <${clean(address)}>` : clean(address))

export interface EmlInput {
  from: { name: string; address: string }
  to: string
  replyTo?: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
  date?: Date
  messageId?: string
  boundary?: string
}

export function buildEml(m: EmlInput): string {
  const boundary = m.boundary ?? `=_outreach_${Math.abs([...m.subject].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`
  const head: string[] = [
    `From: ${mailbox(m.from.name, m.from.address)}`,
    `To: ${clean(m.to)}`,
    ...(m.replyTo ? [`Reply-To: ${clean(m.replyTo)}`] : []),
    `Subject: ${encodeWord(m.subject)}`,
    `Date: ${(m.date ?? new Date()).toUTCString()}`,
    ...(m.messageId ? [`Message-ID: ${clean(m.messageId)}`] : []),
    'MIME-Version: 1.0',
    ...Object.entries(m.headers ?? {}).filter(([k]) => /^[A-Za-z][A-Za-z0-9-]*$/.test(k)).map(([k, v]) => `${k}: ${clean(v)}`),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
  const part = (type: string, body: string) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', wrap76(b64(body))].join('\r\n')
  return `${head.join('\r\n')}\r\n\r\n${part('text/plain', m.text)}\r\n${part('text/html', m.html)}\r\n--${boundary}--\r\n`
}
