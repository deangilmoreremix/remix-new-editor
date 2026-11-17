import type { AutomationActionKind, FlowNode } from '../../types';
import type { CNode, CTone } from './layout';
import type { AddOption } from './FlowCanvas';
import { ACTION_LABEL, TRIGGER_LABEL } from '../../domain/automation';
import { describeNode, newAction, newCondition, newDelay, type Slot } from '../../domain/flow';

const ACTION_ICON: Record<AutomationActionKind, string> = { label: 'tag', tag: 'tag', 'stop-campaign': 'x', 'create-task': 'check', 'create-deal': 'briefcase', webhook: 'plug', 'ai-draft': 'sparkles', unsubscribe: 'x', notify: 'bell' };
const ACTION_TONE: Partial<Record<AutomationActionKind, CTone>> = { 'create-task': 'purple', 'create-deal': 'acc', unsubscribe: 'warn', 'stop-campaign': 'warn', 'ai-draft': 'purple' };

export function flowToCanvas(n: FlowNode): CNode {
  const d = describeNode(n);
  const slotNode = (c: FlowNode | null | undefined) => (c ? flowToCanvas(c) : null);
  if (n.kind === 'condition') return { id: n.id, kind: 'condition', icon: 'branch', tone: 'warn', title: d.title, subtitle: d.subtitle, slots: [{ slot: 'yes', label: 'Yes', node: slotNode(n.yes) }, { slot: 'no', label: 'No', node: slotNode(n.no) }] };
  if (n.kind === 'delay') return { id: n.id, kind: 'delay', icon: 'clock', title: d.title, slots: [{ slot: 'next', node: slotNode(n.next) }] };
  if (n.kind === 'trigger') return { id: n.id, kind: 'start', icon: 'zap', tone: 'acc', title: n.trigger ? TRIGGER_LABEL[n.trigger] : d.title, subtitle: d.subtitle, slots: [{ slot: 'next', node: slotNode(n.next) }] };
  return { id: n.id, kind: 'step', icon: n.action ? ACTION_ICON[n.action] : 'zap', tone: n.action ? ACTION_TONE[n.action] : undefined, title: d.title, subtitle: d.subtitle, slots: [{ slot: 'next', node: slotNode(n.next) }] };
}

export const FLOW_ADD_OPTIONS: AddOption[] = [
  { kind: 'condition', label: 'If / else', icon: 'branch' }, { kind: 'delay', label: 'Wait (delay)', icon: 'clock' },
  ...(Object.keys(ACTION_LABEL) as AutomationActionKind[]).map(k => ({ kind: `action:${k}`, label: ACTION_LABEL[k], icon: ACTION_ICON[k] })),
];
export function nodeForKind(kind: string): FlowNode {
  if (kind === 'condition') return newCondition();
  if (kind === 'delay') return newDelay(60);
  return newAction(kind.replace('action:', '') as AutomationActionKind, '');
}
export function edgesOnPath(path: string[], branches: Record<string, 'yes' | 'no'>): Set<string> {
  const out = new Set<string>(); for (let i = 0; i < path.length - 1; i++) out.add(`${path[i]}:${(branches[path[i]] ?? 'next') as Slot}`); return out;
}
