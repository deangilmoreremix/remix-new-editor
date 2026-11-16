export type ID = string;
export type ISODate = string;

export type Provider = 'gmail' | 'microsoft' | 'smtp';
export type MailboxStatus = 'connected' | 'warming' | 'paused' | 'error';

export interface Mailbox {
  id: ID; email: string; name: string; provider: Provider; status: MailboxStatus;
  dailyLimit: number; sentToday: number; minGapMinutes: number;
  warmup: { enabled: boolean; startedAt?: ISODate; day: number; target: number; sentToday: number; replyRate: number };
  health: number; // 0-100
  spf: boolean; dkim: boolean; dmarc: boolean;
  createdAt: ISODate;
}

export interface Contact {
  id: ID; email: string; firstName: string; lastName: string; company: string; title: string;
  phone?: string; tags: string[]; ownerId?: ID; status: 'lead' | 'active' | 'customer' | 'unsubscribed' | 'bounced';
  fields: Record<string, string>; createdAt: ISODate;
}

export type StepKind = 'email' | 'wait' | 'condition' | 'task';
export interface SequenceStep {
  id: ID; kind: StepKind;
  subject?: string; body?: string;          // email
  waitDays?: number;                          // wait
  condition?: 'opened' | 'clicked' | 'replied'; // condition: continue only if NOT met when `negate`
  negate?: boolean;
  taskTitle?: string;                         // task
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';
export interface Campaign {
  id: ID; name: string; status: CampaignStatus; mailboxIds: ID[]; contactIds: ID[]; steps: SequenceStep[];
  schedule: { days: number[]; startHour: number; endHour: number; timezone: string };
  stopOnReply: boolean; trackOpens: boolean; trackClicks: boolean; dailyCap: number;
  createdAt: ISODate;
}

export type EventType = 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'complaint' | 'unsubscribed';
export interface CampaignEvent { id: ID; campaignId: ID; contactId: ID; mailboxId: ID; type: EventType; stepId?: ID; at: ISODate }

export interface Message {
  id: ID; threadId: ID; direction: 'in' | 'out'; from: string; to: string; subject: string; body: string; at: ISODate;
}
export type ThreadLabel = 'interested' | 'not-interested' | 'meeting-booked' | 'out-of-office' | 'question' | 'none';
export interface Thread {
  id: ID; mailboxId: ID; contactId: ID; campaignId?: ID; subject: string; messages: Message[];
  unread: boolean; starred: boolean; archived: boolean; label: ThreadLabel; updatedAt: ISODate; draft?: string;
}

export interface Stage { id: ID; name: string; probability: number }
export interface Deal { id: ID; title: string; contactId: ID; stageId: ID; value: number; closeDate?: ISODate; status: 'open' | 'won' | 'lost'; createdAt: ISODate }
export interface Task { id: ID; title: string; contactId?: ID; dealId?: ID; due?: ISODate; done: boolean }
export interface Meeting { id: ID; title: string; contactId: ID; at: ISODate; durationMin: number; notes?: string }

export type AutomationTrigger = 'reply-received' | 'link-clicked' | 'email-opened' | 'bounced' | 'meeting-booked';
export type AutomationActionKind = 'label' | 'tag' | 'stop-campaign' | 'create-task' | 'create-deal' | 'webhook' | 'ai-draft' | 'unsubscribe';
export interface AutomationCondition { field: 'label' | 'subject' | 'body' | 'company'; op: 'contains' | 'equals' | 'not-contains'; value: string }
export interface AutomationAction { id: ID; kind: AutomationActionKind; value?: string }
export interface Automation {
  id: ID; name: string; enabled: boolean; trigger: AutomationTrigger;
  conditions: AutomationCondition[]; actions: AutomationAction[]; runs: number; createdAt: ISODate;
}

export interface Webhook { id: ID; url: string; events: string[]; secret: string; enabled: boolean; lastStatus?: number }
export interface ApiKey { id: ID; name: string; prefix: string; createdAt: ISODate; lastUsedAt?: ISODate; scopes: string[] }
export interface IntegrationState { id: string; name: string; connected: boolean; detail?: string }

export interface SuppressionEntry { id: ID; email: string; reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual'; at: ISODate }
export interface TeamMember { id: ID; name: string; email: string; role: 'owner' | 'admin' | 'member'; online: boolean }
export interface Template { id: ID; name: string; subject: string; body: string }

export interface Workspace {
  mailboxes: Mailbox[]; contacts: Contact[]; campaigns: Campaign[]; events: CampaignEvent[]; threads: Thread[];
  stages: Stage[]; deals: Deal[]; tasks: Task[]; meetings: Meeting[]; automations: Automation[];
  webhooks: Webhook[]; apiKeys: ApiKey[]; integrations: IntegrationState[]; suppression: SuppressionEntry[];
  team: TeamMember[]; templates: Template[];
  settings: { workspaceName: string; timezone: string; trackingDomain: string; unsubscribeFooter: string; signature: string };
}
