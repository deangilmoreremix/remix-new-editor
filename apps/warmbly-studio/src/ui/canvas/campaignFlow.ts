import type { SequenceStep } from '../../types';
import type { CNode } from './layout';

export const STEP_OPTIONS = [
  { kind: 'email', label: 'Send an email', icon: 'mail' }, { kind: 'wait', label: 'Wait', icon: 'clock' },
  { kind: 'condition', label: 'Condition', icon: 'branch' }, { kind: 'task', label: 'Create a task', icon: 'check' },
];
const snippet = (s: string, n = 34) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/** Map the linear step list to a canvas tree. A condition continues on Yes and exits on No. */
export function stepsToCanvas(steps: SequenceStep[]): CNode {
  let emails = 0;
  const build = (i: number): CNode | null => {
    const s = steps[i]; if (!s) return null;
    const rest = () => build(i + 1);
    if (s.kind === 'wait') return { id: s.id, kind: 'delay', icon: 'clock', title: `${s.waitDays ?? 1} day${(s.waitDays ?? 1) === 1 ? '' : 's'}`, slots: [{ slot: 'next', node: rest() }] };
    if (s.kind === 'condition') return { id: s.id, kind: 'condition', icon: 'branch', tone: 'warn', title: `${s.negate ? 'Has not' : 'Has'} ${s.condition ?? 'opened'}`, subtitle: 'Condition · Continue if true',
      slots: [{ slot: 'yes', label: 'Yes', node: rest() }, { slot: 'no', label: 'No', node: { id: `${s.id}:exit`, kind: 'step', icon: 'x', tone: 'mute', title: 'Exit sequence', slots: [] } }] };
    if (s.kind === 'task') return { id: s.id, kind: 'step', icon: 'check', tone: 'purple', title: s.taskTitle || 'Create a task', subtitle: 'Task', slots: [{ slot: 'next', node: rest() }] };
    emails++;
    return { id: s.id, kind: 'step', icon: 'mail', title: emails === 1 ? 'Intro' : `Follow-up ${emails - 1}`, subtitle: `${emails === 1 ? 'First email' : 'Reply in thread'} · ${snippet(s.body ?? s.subject ?? '') || 'Empty'}`, slots: [{ slot: 'next', node: rest() }] };
  };
  return { id: 'start', kind: 'start', icon: 'flag', tone: 'good', title: 'Contact enters the campaign', subtitle: 'Start · First email right away', slots: [{ slot: 'next', node: build(0) }] };
}

/** Index in `steps` after which a new step should be inserted for a canvas parent id. */
export function insertIndex(steps: SequenceStep[], parentId: string): number {
  if (parentId === 'start') return 0;
  const i = steps.findIndex(s => s.id === parentId); return i < 0 ? steps.length : i + 1;
}
