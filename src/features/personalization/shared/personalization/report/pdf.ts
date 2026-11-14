/**
 * A minimal PDF 1.4 writer (Stage 11): pages, text in the standard Helvetica fonts, rectangles and lines, a correct cross-reference
 * table. No dependency. Pure and deterministic (the creation date is a parameter).
 *
 * Limit, stated plainly: the standard fonts cover Western European text (WinAnsi). Characters outside it (for example Chinese or Arabic
 * names) cannot be shown; they are replaced with "?" and counted in `replacedChars` so the caller can tell the owner.
 */
export interface Color { r: number; g: number; b: number }
export const rgb = (hex: string): Color => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 })

// Helvetica / Helvetica-Bold glyph widths for ASCII 32..126, in 1/1000 em (Adobe core-14 metrics).
const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]

// WinAnsi (Windows-1252) code points above 0x7F that differ from Latin-1: 0x80..0x9F.
const CP1252: Record<number, number> = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f }
/** One WinAnsi byte per character; anything the standard fonts cannot show becomes "?". */
export function toWinAnsi(text: string): { bytes: number[]; replaced: number } {
  const bytes: number[] = []; let replaced = 0
  for (const ch of String(text ?? '').normalize('NFC')) {
    const c = ch.codePointAt(0)!
    if (c === 0x09 || c === 0x0a || c === 0x0d) bytes.push(0x20)
    else if (c >= 0x20 && c <= 0x7e) bytes.push(c)
    else if (c >= 0xa0 && c <= 0xff) bytes.push(c)
    else if (CP1252[c] !== undefined) bytes.push(CP1252[c])
    else if (c >= 0x300 && c <= 0x36f) continue // a stray combining mark
    else { bytes.push(0x3f); replaced += 1 }
  }
  return { bytes, replaced }
}
/** Approximate width in points. Accented letters use their base letter's width. */
export function textWidth(text: string, size: number, bold = false): number {
  const w = bold ? W_BOLD : W_REG; let total = 0
  for (const b of toWinAnsi(text).bytes) total += (b >= 32 && b <= 126 ? w[b - 32] : b >= 0xc0 ? 600 : 556)
  return (total * size) / 1000
}
/** Cuts a string to fit a width, ending with "…" ("..." in the standard fonts). */
export function fit(text: string, size: number, maxWidth: number, bold = false): string {
  if (textWidth(text, size, bold) <= maxWidth) return text
  const chars = [...text]; while (chars.length > 1 && textWidth(chars.join('') + '...', size, bold) > maxWidth) chars.pop()
  return chars.join('').trimEnd() + '...'
}

const pdfNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''))
function pdfString(bytes: number[]): string {
  let out = '('
  for (const b of bytes) out += b === 0x28 || b === 0x29 || b === 0x5c ? `\\${String.fromCharCode(b)}` : b < 32 || b > 126 ? `\\${b.toString(8).padStart(3, '0')}` : String.fromCharCode(b)
  return out + ')'
}

export interface TextOpts { size?: number; bold?: boolean; color?: Color; align?: 'left' | 'right' | 'center' }
export interface RectOpts { fill?: Color; stroke?: Color; lineWidth?: number }
export class PdfPage {
  readonly ops: string[] = []
  constructor(readonly width: number, readonly height: number, private readonly counter: { replaced: number }) {}
  /** y is measured from the TOP of the page (the natural way to lay out a report). */
  text(x: number, y: number, text: string, o: TextOpts = {}): void {
    const size = o.size ?? 10; const { bytes, replaced } = toWinAnsi(text); this.counter.replaced += replaced
    const w = textWidth(text, size, o.bold); const left = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x
    const c = o.color ?? { r: 0.1, g: 0.1, b: 0.12 }
    this.ops.push(`BT /${o.bold ? 'F2' : 'F1'} ${pdfNum(size)} Tf ${pdfNum(c.r)} ${pdfNum(c.g)} ${pdfNum(c.b)} rg ${pdfNum(left)} ${pdfNum(this.height - y)} Td ${pdfString(bytes)} Tj ET`)
  }
  rect(x: number, y: number, w: number, h: number, o: RectOpts = {}): void {
    if (w <= 0 || h <= 0) return
    const parts: string[] = []
    if (o.fill) parts.push(`${pdfNum(o.fill.r)} ${pdfNum(o.fill.g)} ${pdfNum(o.fill.b)} rg`)
    if (o.stroke) parts.push(`${pdfNum(o.stroke.r)} ${pdfNum(o.stroke.g)} ${pdfNum(o.stroke.b)} RG ${pdfNum(o.lineWidth ?? 0.5)} w`)
    parts.push(`${pdfNum(x)} ${pdfNum(this.height - y - h)} ${pdfNum(w)} ${pdfNum(h)} re ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'}`)
    this.ops.push(parts.join(' '))
  }
  line(x1: number, y1: number, x2: number, y2: number, o: { color?: Color; width?: number } = {}): void {
    const c = o.color ?? { r: 0.8, g: 0.8, b: 0.82 }
    this.ops.push(`${pdfNum(c.r)} ${pdfNum(c.g)} ${pdfNum(c.b)} RG ${pdfNum(o.width ?? 0.5)} w ${pdfNum(x1)} ${pdfNum(this.height - y1)} m ${pdfNum(x2)} ${pdfNum(this.height - y2)} l S`)
  }
  polyline(points: Array<[number, number]>, o: { color?: Color; width?: number } = {}): void {
    if (points.length < 2) return
    const c = o.color ?? { r: 0.1, g: 0.3, b: 0.8 }
    this.ops.push(`${pdfNum(c.r)} ${pdfNum(c.g)} ${pdfNum(c.b)} RG ${pdfNum(o.width ?? 1.5)} w ${points.map(([x, y], i) => `${pdfNum(x)} ${pdfNum(this.height - y)} ${i ? 'l' : 'm'}`).join(' ')} S`)
  }
}

export interface PdfInfo { title?: string; author?: string; subject?: string; created?: Date }
export class PdfDoc {
  readonly pages: PdfPage[] = []
  private readonly counter = { replaced: 0 }
  constructor(readonly size: { width: number; height: number } = { width: 595.28, height: 841.89 }) {}
  addPage(): PdfPage { const p = new PdfPage(this.size.width, this.size.height, this.counter); this.pages.push(p); return p }
  /** How many times a character had to be replaced while drawing (a repeated header counts each time it is drawn); > 0 means "some text shows ?". */
  get replacedChars(): number { return this.counter.replaced }

  build(info: PdfInfo = {}): Uint8Array {
    if (this.pages.length === 0) this.addPage()
    const enc = new TextEncoder(); const chunks: Uint8Array[] = []; const offsets: number[] = []; let pos = 0
    const push = (s: string | Uint8Array) => { const b = typeof s === 'string' ? enc.encode(s) : s; chunks.push(b); pos += b.length }
    const n = this.pages.length
    // object numbers: 1 catalog, 2 pages, 3 font F1, 4 font F2, 5 info, then per page: page object, content stream
    const pageObj = (i: number) => 6 + i * 2; const contentObj = (i: number) => 7 + i * 2
    const total = 5 + n * 2
    const obj = (id: number, body: string | Uint8Array) => { offsets[id] = pos; push(`${id} 0 obj\n`); push(body); push('\nendobj\n') }
    push('%PDF-1.4\n%âãÏÓ\n')
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
    obj(2, `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${n} >>`)
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    const d = info.created ?? new Date(0); const p2 = (v: number) => String(v).padStart(2, '0')
    const date = `D:${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`
    // Document-information strings are PDFDocEncoding or UTF-16BE with a byte-order mark; UTF-16BE shows every character correctly.
    const meta = (v: string | undefined) => { const t = String(v ?? ''); let hex = 'FEFF'; for (let i = 0; i < t.length; i += 1) hex += t.charCodeAt(i).toString(16).padStart(4, '0'); return `<${hex}>` }
    obj(5, `<< /Title ${meta(info.title)} /Author ${meta(info.author)} /Subject ${meta(info.subject)} /Creator ${meta('SmartVideo')} /Producer ${meta('SmartVideo report writer')} /CreationDate (${date}) >>`)
    this.pages.forEach((p, i) => {
      obj(pageObj(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNum(p.width)} ${pdfNum(p.height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj(i)} 0 R >>`)
      const stream = enc.encode(p.ops.join('\n'))
      offsets[contentObj(i)] = pos; push(`${contentObj(i)} 0 obj\n<< /Length ${stream.length} >>\nstream\n`); push(stream); push('\nendstream\nendobj\n')
    })
    const xref = pos
    push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`)
    for (let id = 1; id <= total; id += 1) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
    push(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
    const out = new Uint8Array(pos); let at = 0; for (const c of chunks) { out.set(c, at); at += c.length }
    return out
  }
}
