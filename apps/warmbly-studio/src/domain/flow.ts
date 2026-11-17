import type { Automation, AutomationActionKind, AutomationCondition, AutomationTrigger, FlowNode } from '../types';
import { ACTION_LABEL, TRIGGER_LABEL, conditionsHold, type AutomationContext } from './automation';

let n = 0;
export const flowId = () => `fn_${Date.now().toString(36)}${(++n).toString(36)}`;
export type Slot = 'next' | 'yes' | 'no';

export const newTrigger = (trigger: AutomationTrigger = 'reply-received'): FlowNode => ({ id: flowId(), kind: 'trigger', trigger, next: null });
export const newCondition = (): FlowNode => ({ id: flowId(), kind: 'condition', conditions: [{ field: 'label', op: 'equals', value: '' }], yes: null, no: null });
export const newAction = (action: AutomationActionKind = 'tag', value = ''): FlowNode => ({ id: flowId(), kind: 'action', action, value, next: null });
export const newDelay = (delayMinutes = 60): FlowNode => ({ id: flowId(), kind: 'delay', delayMinutes, next: null });

export function children(node: FlowNode): { slot: Slot; node: FlowNode | null }[] {
  return node.kind === 'condition' ? [{ slot: 'yes', node: node.yes ?? null }, { slot: 'no', node: node.no ?? null }] : [{ slot: 'next', node: node.next ?? null }];
}
export function walk(root: FlowNode, fn: (n: FlowNode, parent: FlowNode | null, slot: Slot | null) => void, parent: FlowNode | null = null, slot: Slot | null = null) {
  fn(root, parent, slot); for (const c of children(root)) if (c.node) walk(c.node, fn, root, c.slot);
}
export const findNode = (root: FlowNode, id: string): FlowNode | null => { let f: FlowNode | null = null; walk(root, x => { if (x.id === id) f = x; }); return f; };
export const countNodes = (root: FlowNode) => { let c = 0; walk(root, () => c++); return c; };

const clone = <T,>(x: T): T => structuredClone(x);
function mapNode(root: FlowNode, id: string, fn: (n: FlowNode) => FlowNode | null): FlowNode {
  if (root.id === id) return fn(root) ?? root;
  const r = { ...root };
  if (r.kind === 'condition') { if (r.yes) r.yes = mapChild(r.yes, id, fn); if (r.no) r.no = mapChild(r.no, id, fn); }
  else if (r.next) r.next = mapChild(r.next, id, fn);
  return r;
}
function mapChild(c: FlowNode, id: string, fn: (n: FlowNode) => FlowNode | null): FlowNode | null {
  if (c.id === id) return fn(c);
  return mapNode(c, id, fn);
}

export function updateNode(root: FlowNode, id: string, patch: Partial<FlowNode>): FlowNode {
  return mapNode(root, id, n => ({ ...n, ...patch }));
}
/** Insert `node` into `slot` of `parentId`. Whatever was there continues after the new node (on its Yes branch for conditions). */
export function insertAt(root: FlowNode, parentId: string, slot: Slot, node: FlowNode): FlowNode {
  return mapNode(root, parentId, p => {
    const existing = slot === 'next' ? p.next ?? null : slot === 'yes' ? p.yes ?? null : p.no ?? null;
    const ins = clone(node);
    if (existing) { if (ins.kind === 'condition') ins.yes = existing; else ins.next = existing; }
    return slot === 'next' ? { ...p, next: ins } : slot === 'yes' ? { ...p, yes: ins } : { ...p, no: ins };
  });
}
/** Remove a node, splicing its continuation (a condition keeps its Yes branch). The trigger cannot be removed. */
export function removeNode(root: FlowNode, id: string): FlowNode {
  if (root.id === id) return root;
  const out = clone(root);
  const visit = (p: FlowNode): boolean => {
    for (const c of children(p)) {
      if (!c.node) continue;
      if (c.node.id === id) {
        const repl = c.node.kind === 'condition' ? c.node.yes ?? null : c.node.next ?? null;
        if (c.slot === 'next') p.next = repl; else if (c.slot === 'yes') p.yes = repl; else p.no = repl;
        return true;
      }
      if (visit(c.node)) return true;
    }
    return false;
  };
  visit(out); return out;
}

export interface FlowStep { nodeId: string; kind: 'action' | 'delay'; action?: AutomationActionKind; value?: string; atMinutes: number }
export interface FlowRun { path: string[]; steps: FlowStep[]; branches: Record<string, 'yes' | 'no'> }
/** Follow the flow for a context, taking Yes/No at each condition. Delays accumulate into `atMinutes`. */
export function walkFlow(root: FlowNode, ctx: AutomationContext): FlowRun {
  const run: FlowRun = { path: [], steps: [], branches: {} }; let at = 0; let cur: FlowNode | null = root; let guard = 0;
  while (cur && guard++ < 200) {
    run.path.push(cur.id);
    if (cur.kind === 'condition') { const ok = conditionsHold(cur.conditions ?? [], ctx); run.branches[cur.id] = ok ? 'yes' : 'no'; cur = ok ? cur.yes ?? null : cur.no ?? null; continue; }
    if (cur.kind === 'delay') { at += cur.delayMinutes ?? 0; run.steps.push({ nodeId: cur.id, kind: 'delay', atMinutes: at }); }
    if (cur.kind === 'action' && cur.action) run.steps.push({ nodeId: cur.id, kind: 'action', action: cur.action, value: cur.value, atMinutes: at });
    cur = cur.next ?? null;
  }
  return run;
}

export function formatDelay(min: number): string {
  if (min % 1440 === 0) { const d = min / 1440; return `${d} day${d === 1 ? '' : 's'}`; }
  if (min % 60 === 0) { const h = min / 60; return `${h} hour${h === 1 ? '' : 's'}`; }
  return `${min} min`;
}
export function conditionText(cs: AutomationCondition[] = []): string {
  if (!cs.length) return 'Set a condition';
  const FIELD: Record<string, string> = { label: 'intent', body: 'reply', subject: 'subject', company: 'company' };
  return cs.map(c => `${FIELD[c.field] ?? c.field} ${c.op === 'equals' ? 'is' : c.op === 'contains' ? 'contains' : 'excludes'} ${c.value || '…'}`).join(' and ');
}
export function describeNode(n: FlowNode): { title: string; subtitle: string } {
  switch (n.kind) {
    case 'trigger': return { title: n.trigger ? TRIGGER_LABEL[n.trigger] : 'Choose a trigger', subtitle: 'Trigger · Starts this automation' };
    case 'condition': return { title: conditionText(n.conditions), subtitle: 'If / else · Checks the event' };
    case 'delay': return { title: `Wait ${formatDelay(n.delayMinutes ?? 0)}`, subtitle: 'Delay' };
    case 'action': return { title: n.action ? ACTION_LABEL[n.action] : 'Choose an action', subtitle: n.value ? `Action · ${n.value}` : 'Action' };
  }
}
export function validateFlow(root: FlowNode): string[] {
  const errs: string[] = []; let actions = 0;
  walk(root, node => {
    if (node.kind === 'condition') { if (!(node.conditions ?? []).length || (node.conditions ?? []).some(c => !c.value.trim())) errs.push('Every condition needs a value'); }
    if (node.kind === 'action') { actions++; if (!node.action) errs.push('Choose an action'); else if (['label', 'tag', 'create-task', 'notify'].includes(node.action) && !node.value?.trim()) errs.push(`${ACTION_LABEL[node.action]} needs a value`); }
    if (node.kind === 'delay' && !(node.delayMinutes && node.delayMinutes > 0)) errs.push('A delay must be longer than zero');
  });
  if (!actions) errs.push('Add at least one action');
  return [...new Set(errs)];
}
/** Migration from the old linear shape. */
export function linearToFlow(trigger: AutomationTrigger, conditions: AutomationCondition[], actions: { kind: AutomationActionKind; value?: string }[]): FlowNode {
  const root = newTrigger(trigger); let tail: FlowNode = root; let slot: Slot = 'next';
  const attach = (nd: FlowNode) => { const t = tail as FlowNode; if (slot === 'next') t.next = nd; else if (slot === 'yes') t.yes = nd; };
  if (conditions.length) { const c = newCondition(); c.conditions = conditions; attach(c); tail = c; slot = 'yes'; }
  for (const a of actions) { const nd = newAction(a.kind, a.value ?? ''); attach(nd); tail = nd; slot = 'next'; }
  return root;
}
export function normalizeAutomation(a: Automation & { conditions?: AutomationCondition[]; actions?: { kind: AutomationActionKind; value?: string }[] }): Automation {
  if (a.flow) return a;
  const { conditions = [], actions = [], ...rest } = a;
  return { ...rest, flow: linearToFlow(a.trigger, conditions, actions) } as Automation;
}
export function setTrigger(a: Automation, trigger: AutomationTrigger): Automation {
  return { ...a, trigger, flow: { ...a.flow, trigger } };
}
