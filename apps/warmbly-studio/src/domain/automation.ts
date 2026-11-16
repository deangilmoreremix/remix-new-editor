import type { Automation, AutomationAction, AutomationTrigger, Contact, Thread } from '../types';

export interface AutomationContext { trigger: AutomationTrigger; contact: Contact; thread?: Thread; label?: string }
export function matches(a: Automation, ctx: AutomationContext): boolean {
  if (!a.enabled || a.trigger !== ctx.trigger) return false;
  return a.conditions.every(c => {
    const hay = c.field === 'label' ? (ctx.label ?? ctx.thread?.label ?? '')
      : c.field === 'company' ? ctx.contact.company
      : c.field === 'subject' ? (ctx.thread?.subject ?? '')
      : (ctx.thread?.messages.at(-1)?.body ?? '');
    const h = hay.toLowerCase(), v = c.value.toLowerCase();
    return c.op === 'equals' ? h === v : c.op === 'contains' ? h.includes(v) : !h.includes(v);
  });
}
/** Returns the actions to execute for a context across all matching automations. */
export function planActions(automations: Automation[], ctx: AutomationContext): { automationId: string; action: AutomationAction }[] {
  return automations.filter(a => matches(a, ctx)).flatMap(a => a.actions.map(action => ({ automationId: a.id, action })));
}
export const TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  'reply-received': 'A reply is received', 'link-clicked': 'A link is clicked', 'email-opened': 'An email is opened',
  bounced: 'An email bounces', 'meeting-booked': 'A meeting is booked',
};
export const ACTION_LABEL: Record<AutomationAction['kind'], string> = {
  label: 'Label the thread', tag: 'Add tag to contact', 'stop-campaign': 'Stop the campaign for this contact',
  'create-task': 'Create a task', 'create-deal': 'Create a deal', webhook: 'Send webhook', 'ai-draft': 'Draft an AI reply', unsubscribe: 'Unsubscribe contact',
};

/** Rule-based reply classifier (the local stand-in for the AI classifier). */
export function classifyReply(body: string): Thread['label'] {
  const t = body.toLowerCase();
  if (/out of (the )?office|on vacation|auto-?reply|away until/.test(t)) return 'out-of-office';
  if (/not interested|no thanks|unsubscribe|remove me|stop emailing/.test(t)) return 'not-interested';
  if (/book|calendar|schedule|call (on|at)|tuesday|wednesday|thursday|friday|monday|\b\d{1,2}(am|pm)\b/.test(t)) return 'meeting-booked';
  if (/interested|sounds good|tell me more|love to|let'?s talk|send (me )?(more|details|pricing)/.test(t)) return 'interested';
  if (t.includes('?')) return 'question';
  return 'none';
}
/** Local AI-draft stand-in: a context-aware reply scaffold. */
export function draftReply(thread: Thread, contact: Contact, signature: string): string {
  const label = thread.label;
  const open = `Hi ${contact.firstName || 'there'},`;
  const body = label === 'interested' ? 'Great to hear! Here are two times that work on my side this week. Does either suit you?'
    : label === 'question' ? 'Good question. Short answer below, and happy to walk through it live if useful.'
    : label === 'not-interested' ? 'Understood, thanks for letting me know. I will close the loop on my side.'
    : label === 'out-of-office' ? 'Thanks. I will follow up when you are back.'
    : 'Thanks for getting back to me.';
  return `${open}\n\n${body}\n\n${signature}`;
}
