/**
 * The outreach sequence as a graph (Stage 10): who receives it, what is made for them, which email goes out, how long to wait and
 * whether the next step depends on what they did. PURE: validation, a day-by-day plan, and a simulator.
 *
 * What this is NOT: an automation engine. Nothing here sends, waits or watches anyone. The app has no always-on server, so the plan is
 * something the owner follows (or exports); a future scheduler could run it. The panel says so.
 */

export type FlowNodeType = 'audience' | 'personalize' | 'email' | 'wait' | 'condition' | 'end'
export type ConditionKind = 'watched' | 'clicked' | 'replied'
export interface FlowNode {
  id: string; type: FlowNodeType; x: number; y: number
  label?: string
  /** email: subject; personalize: what is made */
  subject?: string; make?: Array<'video' | 'gif' | 'thumbnail'>
  /** wait: days (1–30) */
  days?: number
  /** condition */
  kind?: ConditionKind
}
export type EdgeBranch = 'next' | 'yes' | 'no'
export interface FlowEdge { id: string; from: string; to: string; branch: EdgeBranch }
export interface OutreachFlow { version: 1; nodes: FlowNode[]; edges: FlowEdge[] }

export const MAX_NODES = 40
export const MAX_EMAILS = 12
export const WAIT_RANGE = [1, 30] as const
export const NODE_TITLES: Record<FlowNodeType, string> = { audience: 'Recipients', personalize: 'Make personalized files', email: 'Send email', wait: 'Wait', condition: 'Check what they did', end: 'End' }
export const CONDITION_TEXT: Record<ConditionKind, string> = { watched: 'watched the video', clicked: 'clicked the button', replied: 'replied' }

// eslint-disable-next-line no-control-regex
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, n) : '')
const fin = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d)
const TYPES: FlowNodeType[] = ['audience', 'personalize', 'email', 'wait', 'condition', 'end']

export function normalizeFlow(raw: unknown): OutreachFlow {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const ids = new Set<string>()
  const nodes: FlowNode[] = (Array.isArray(r.nodes) ? r.nodes : []).slice(0, MAX_NODES).flatMap((n: any) => {
    const id = str(n?.id, 40); if (!id || ids.has(id) || !TYPES.includes(n?.type)) return []
    ids.add(id)
    const node: FlowNode = { id, type: n.type, x: fin(n.x, -5000, 5000, 0), y: fin(n.y, -5000, 5000, 0) }
    if (str(n.label, 60)) node.label = str(n.label, 60)
    if (n.type === 'email') node.subject = str(n.subject, 100)
    if (n.type === 'personalize') node.make = (['video', 'gif', 'thumbnail'] as const).filter((m) => Array.isArray(n.make) && n.make.includes(m))
    if (n.type === 'wait') node.days = fin(n.days, WAIT_RANGE[0], WAIT_RANGE[1], 3)
    if (n.type === 'condition') node.kind = (['watched', 'clicked', 'replied'] as const).includes(n.kind) ? n.kind : 'watched'
    return [node]
  })
  const seen = new Set<string>()
  const edges: FlowEdge[] = (Array.isArray(r.edges) ? r.edges : []).slice(0, MAX_NODES * 2).flatMap((e: any) => {
    const from = str(e?.from, 40); const to = str(e?.to, 40); const branch: EdgeBranch = e?.branch === 'yes' || e?.branch === 'no' ? e.branch : 'next'
    const key = `${from}>${to}>${branch}`
    if (!ids.has(from) || !ids.has(to) || from === to || seen.has(key)) return []
    seen.add(key); return [{ id: str(e?.id, 60) || key, from, to, branch }]
  })
  return { version: 1, nodes, edges }
}

/** A sensible starting sequence: recipients → make files → email → wait 3 days → if not watched, a short follow-up. */
export function defaultFlow(): OutreachFlow {
  return normalizeFlow({ nodes: [
    { id: 'n1', type: 'audience', x: 0, y: 0, label: 'Imported list' }, { id: 'n2', type: 'personalize', x: 0, y: 110, make: ['video', 'gif', 'thumbnail'] },
    { id: 'n3', type: 'email', x: 0, y: 220, subject: '{{firstName}}, a quick video for {{company}}' }, { id: 'n4', type: 'wait', x: 0, y: 330, days: 3 },
    { id: 'n5', type: 'condition', x: 0, y: 440, kind: 'watched' }, { id: 'n6', type: 'email', x: 160, y: 550, subject: 'Did you get a chance to watch, {{firstName}}?' }, { id: 'n7', type: 'end', x: -160, y: 550 }, { id: 'n8', type: 'end', x: 160, y: 660 },
  ], edges: [
    { from: 'n1', to: 'n2', branch: 'next' }, { from: 'n2', to: 'n3', branch: 'next' }, { from: 'n3', to: 'n4', branch: 'next' }, { from: 'n4', to: 'n5', branch: 'next' },
    { from: 'n5', to: 'n7', branch: 'yes' }, { from: 'n5', to: 'n6', branch: 'no' }, { from: 'n6', to: 'n8', branch: 'next' },
  ] })
}

export interface FlowIssue { level: 'error' | 'warn'; nodeId?: string; message: string }
const out = (f: OutreachFlow, id: string) => f.edges.filter((e) => e.from === id)

export function validateFlow(f: OutreachFlow): FlowIssue[] {
  const issues: FlowIssue[] = []; const add = (level: FlowIssue['level'], message: string, nodeId?: string) => issues.push({ level, message, nodeId })
  const starts = f.nodes.filter((n) => n.type === 'audience')
  if (f.nodes.length === 0) { add('error', 'The sequence is empty.'); return issues }
  if (starts.length !== 1) add('error', starts.length === 0 ? 'Add a Recipients step to start the sequence.' : 'There can be only one Recipients step.')
  if (f.edges.some((e) => f.nodes.find((n) => n.id === e.to)?.type === 'audience')) add('error', 'Nothing can lead into the Recipients step.', starts[0]?.id)
  // cycles (a loop would send forever)
  const state = new Map<string, 1 | 2>(); let cyc = false
  const dfs = (id: string) => { if (state.get(id) === 2) return; if (state.get(id) === 1) { cyc = true; return } state.set(id, 1); for (const e of out(f, id)) dfs(e.to); state.set(id, 2) }
  f.nodes.forEach((n) => dfs(n.id)); if (cyc) add('error', 'The sequence loops back on itself, which would send emails forever.')
  // reachability
  if (starts[0] && !cyc) {
    const reach = new Set<string>(); const q = [starts[0].id]
    while (q.length) { const id = q.pop()!; if (reach.has(id)) continue; reach.add(id); out(f, id).forEach((e) => q.push(e.to)) }
    for (const n of f.nodes) if (!reach.has(n.id)) add('error', `"${nodeTitle(n)}" is not connected to the start.`, n.id)
  }
  const emails = f.nodes.filter((n) => n.type === 'email'); if (emails.length > MAX_EMAILS) add('error', `At most ${MAX_EMAILS} emails per sequence.`)
  for (const n of f.nodes) {
    const o = out(f, n.id)
    if (n.type === 'end' && o.length) add('error', 'An End step cannot lead anywhere.', n.id)
    if (n.type === 'condition') { for (const b of ['yes', 'no'] as const) if (!o.some((e) => e.branch === b)) add('error', `"${nodeTitle(n)}" needs a "${b === 'yes' ? 'Yes' : 'No'}" path.`, n.id); if (o.some((e) => e.branch === 'next')) add('error', 'A check must lead out through Yes and No only.', n.id) }
    else if (n.type !== 'end') { if (o.length === 0) add('warn', `"${nodeTitle(n)}" leads nowhere; add an End step.`, n.id); if (o.length > 1) add('error', `"${nodeTitle(n)}" has more than one next step; use a check to split.`, n.id); if (o.some((e) => e.branch !== 'next')) add('error', `"${nodeTitle(n)}" can only have one plain next step.`, n.id) }
    if (n.type === 'email' && !n.subject) add('error', 'An email step needs a subject.', n.id)
    if (n.type === 'personalize' && !(n.make?.length)) add('error', 'Choose at least one thing to make.', n.id)
  }
  // an email before anything personalized exists, or a condition that needs an email first
  for (const n of f.nodes) if (n.type === 'condition' && !pathBefore(f, n.id).some((p) => p.type === 'email')) add('warn', 'This check comes before any email, so nobody could have done it yet.', n.id)
  for (const n of emails) if (!pathBefore(f, n.id).some((p) => p.type === 'personalize')) add('warn', 'This email goes out without personalized files being made first.', n.id)
  return issues
}
export const nodeTitle = (n: FlowNode) => n.label || (n.type === 'email' && n.subject ? `Email: ${n.subject}` : NODE_TITLES[n.type])
function pathBefore(f: OutreachFlow, id: string): FlowNode[] {
  const seen = new Set<string>(); const res: FlowNode[] = []; const q = [id]
  while (q.length) { const cur = q.pop()!; for (const e of f.edges.filter((x) => x.to === cur)) if (!seen.has(e.from)) { seen.add(e.from); const n = f.nodes.find((x) => x.id === e.from); if (n) { res.push(n); q.push(n.id) } } }
  return res
}

// ---------------------------------------------------------------- plan + simulation
export interface RecipientBehavior { watched?: boolean; clicked?: boolean; replied?: boolean; unsubscribed?: boolean }
export interface PlanStep { day: number; kind: 'make' | 'email' | 'check' | 'stop'; nodeId: string; text: string }

/** Walks the sequence for ONE recipient behaving as described. An unsubscribed or replied recipient never gets another email. */
export function simulate(f: OutreachFlow, who: RecipientBehavior = {}): { steps: PlanStep[]; emails: number; ended: 'end' | 'unsubscribed' | 'replied' | 'stopped' | 'invalid' } {
  const steps: PlanStep[] = []; if (validateFlow(f).some((i) => i.level === 'error')) return { steps, emails: 0, ended: 'invalid' }
  let cur: FlowNode | undefined = f.nodes.find((n) => n.type === 'audience'); let day = 0; let emails = 0; let guard = 0
  while (cur && guard++ < MAX_NODES + 2) {
    if (cur.type === 'personalize') steps.push({ day, kind: 'make', nodeId: cur.id, text: `Make ${(cur.make ?? []).join(', ')} for the recipient` })
    else if (cur.type === 'email') {
      if (who.unsubscribed) { steps.push({ day, kind: 'stop', nodeId: cur.id, text: 'Stopped: the recipient unsubscribed, so no email is sent.' }); return { steps, emails, ended: 'unsubscribed' } }
      if (who.replied) { steps.push({ day, kind: 'stop', nodeId: cur.id, text: 'Stopped: the recipient replied; follow up by hand.' }); return { steps, emails, ended: 'replied' } }
      emails += 1; steps.push({ day, kind: 'email', nodeId: cur.id, text: `Send email: ${cur.subject}` })
    } else if (cur.type === 'wait') day += cur.days ?? 0
    else if (cur.type === 'condition') {
      const yes = Boolean(who[cur.kind ?? 'watched']); steps.push({ day, kind: 'check', nodeId: cur.id, text: `Has the recipient ${CONDITION_TEXT[cur.kind ?? 'watched']}? ${yes ? 'Yes' : 'No'}` })
      const e = out(f, cur.id).find((x) => x.branch === (yes ? 'yes' : 'no')); cur = e && f.nodes.find((n) => n.id === e.to); continue
    } else if (cur.type === 'end') return { steps, emails, ended: 'end' }
    const e = out(f, cur.id)[0]; cur = e && f.nodes.find((n) => n.id === e.to)
  }
  return { steps, emails, ended: 'stopped' }
}

/** The plan as a CSV-ready table (spreadsheet-safe via toCsv at the call site). */
export function planRows(f: OutreachFlow): string[][] {
  const rows: string[][] = [['scenario', 'day', 'step', 'detail']]
  const scenarios: Array<[string, RecipientBehavior]> = [['watches the video', { watched: true }], ['does not watch', {}], ['replies', { replied: true }], ['unsubscribes', { unsubscribed: true }]]
  for (const [name, who] of scenarios) { const r = simulate(f, who); if (r.ended === 'invalid') return [['The sequence has errors; fix them first.']]; for (const s of r.steps) rows.push([name, String(s.day), s.kind, s.text]) }
  return rows
}
