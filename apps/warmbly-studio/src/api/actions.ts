import type * as T from '../types';

export type Action =
  | { type: 'mailbox/add'; email: string; name: string; provider: T.Provider; dailyLimit?: number }
  | { type: 'mailbox/update'; id: T.ID; patch: Partial<Pick<T.Mailbox, 'name' | 'dailyLimit' | 'minGapMinutes' | 'status'>> }
  | { type: 'mailbox/remove'; id: T.ID }
  | { type: 'mailbox/warmup'; id: T.ID; enabled: boolean; target?: number }
  | { type: 'mailbox/verifyDns'; id: T.ID }
  | { type: 'contact/import'; rows: Omit<T.Contact, 'id' | 'createdAt'>[] }
  | { type: 'contact/update'; id: T.ID; patch: Partial<T.Contact> }
  | { type: 'contact/remove'; ids: T.ID[] }
  | { type: 'contact/tag'; ids: T.ID[]; tag: string; remove?: boolean }
  | { type: 'campaign/save'; campaign: T.Campaign }
  | { type: 'campaign/status'; id: T.ID; status: T.CampaignStatus }
  | { type: 'campaign/remove'; id: T.ID }
  | { type: 'campaign/duplicate'; id: T.ID }
  | { type: 'thread/update'; id: T.ID; patch: Partial<Pick<T.Thread, 'unread' | 'starred' | 'archived' | 'label' | 'draft'>> }
  | { type: 'thread/reply'; id: T.ID; body: string }
  | { type: 'thread/bulk'; ids: T.ID[]; patch: Partial<Pick<T.Thread, 'unread' | 'starred' | 'archived' | 'trashed' | 'spam' | 'snoozedUntil' | 'assigneeId'>> }
  | { type: 'thread/labels'; ids: T.ID[]; labelId: T.ID; remove?: boolean }
  | { type: 'thread/tags'; ids: T.ID[]; tag: string; remove?: boolean }
  | { type: 'thread/purge'; ids: T.ID[] }
  | { type: 'label/save'; label: T.Label }
  | { type: 'label/remove'; id: T.ID }
  | { type: 'draft/save'; draft: T.Draft }
  | { type: 'draft/delete'; id: T.ID }
  | { type: 'draft/send'; draft: T.Draft }
  | { type: 'deal/save'; deal: T.Deal }
  | { type: 'deal/move'; id: T.ID; stageId: T.ID }
  | { type: 'deal/close'; id: T.ID; status: 'won' | 'lost' | 'open' }
  | { type: 'deal/remove'; id: T.ID }
  | { type: 'task/save'; task: T.Task }
  | { type: 'task/toggle'; id: T.ID }
  | { type: 'task/remove'; id: T.ID }
  | { type: 'meeting/save'; meeting: T.Meeting }
  | { type: 'meeting/remove'; id: T.ID }
  | { type: 'automation/save'; automation: T.Automation }
  | { type: 'automation/toggle'; id: T.ID }
  | { type: 'automation/remove'; id: T.ID }
  | { type: 'webhook/save'; webhook: T.Webhook }
  | { type: 'webhook/remove'; id: T.ID }
  | { type: 'webhook/test'; id: T.ID }
  | { type: 'apikey/create'; name: string; scopes: string[] }
  | { type: 'apikey/revoke'; id: T.ID }
  | { type: 'integration/toggle'; id: string }
  | { type: 'suppression/add'; email: string }
  | { type: 'suppression/remove'; id: T.ID }
  | { type: 'template/save'; template: T.Template }
  | { type: 'template/remove'; id: T.ID }
  | { type: 'team/invite'; email: string; role: T.TeamMember['role'] }
  | { type: 'team/remove'; id: T.ID }
  | { type: 'settings/update'; patch: Partial<T.Workspace['settings']> }
  | { type: 'sim/tick'; now: string; rand?: number }
  | { type: 'sim/nextDay' };

/** The contract the studio talks to. Local adapter ships now; an HTTP adapter implements the same shape against the Warmbly API. */
export interface WarmblyAdapter {
  readonly kind: 'local' | 'remote';
  load(): Promise<T.Workspace>;
  dispatch(action: Action): Promise<T.Workspace>;
  subscribe(listener: (ws: T.Workspace) => void): () => void;
  /** Reset to a clean demo workspace (local only). */
  reset?(): Promise<T.Workspace>;
  /** Simulated "now" (local adapter fast-forwards time). */
  now(): Date;
}
