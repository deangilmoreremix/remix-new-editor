// [remix] Rows of the bulk link table: one per contact, joined with that contact's business assets and its link.
// Pure (no network): the hook fetches, this decides. Each contact only ever gets its OWN business's assets.
// @ts-expect-error plain JS
import { planBulkLinks, mergeAssetVariables, assetVariablesChanged } from '../../../lib/editor/publish/bulkLinks.js';
// @ts-expect-error plain JS
import { businessKey, assignmentsToVariables } from '../../../lib/personalization/businessAssetStore.js';
// @ts-expect-error plain JS
import { contactName } from '../../../lib/editor/personalize/perContact.js';
import { businessFromProfile, type LibAsset } from './personalize-writeback';

export interface Recipient { id: string; token: string; label?: string | null; contact_ref?: string | null; variables?: Record<string, string>; status: 'active' | 'revoked'; expires_at?: string | null; created_at?: string }
export interface BusinessRef { id: string; business_key: string; name: string }
export interface AssignmentRow { business_id: string; slot: string; asset_id: string | null; manual: boolean }
export type PlanStatus = 'ready' | 'missing-assets' | 'already-linked' | 'invalid';
export type LinkStatus = 'none' | 'active' | 'revoked' | 'expired';
export interface BulkRow {
  contactId: string; name: string; businessName: string; businessId: string | null;
  plan: { status: PlanStatus; missingSlots: string[]; variables: Record<string, string> };
  recipient: Recipient | null; linkStatus: LinkStatus;
  /** the business's assets changed since this link was made: "Refresh from library" would update it */
  stale: boolean;
}

export const linkStatusOf = (r: Recipient | null, now = Date.now()): LinkStatus =>
  !r ? 'none' : r.status === 'revoked' ? 'revoked' : r.expires_at && Date.parse(r.expires_at) <= now ? 'expired' : 'active';

export function buildBulkRows(p: {
  contacts: Array<Record<string, any>>; businesses: BusinessRef[]; assets: Array<LibAsset & { business_id: string }>;
  assignments: AssignmentRow[]; recipients: Recipient[]; requiredSlots: string[]; neededTokens?: Set<string> | null; now?: number;
}): BulkRow[] {
  const byKey = new Map(p.businesses.map((b) => [b.business_key, b]));
  const assetsByBusiness: Record<string, Record<string, string>> = {};
  for (const b of p.businesses) {
    assetsByBusiness[b.id] = assignmentsToVariables(p.assignments.filter((a) => a.business_id === b.id), p.assets.filter((a) => a.business_id === b.id));
  }
  const live = (r: Recipient) => linkStatusOf(r, p.now) === 'active';
  const mine = (id: string) => p.recipients.filter((r) => r.contact_ref === id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const infos = p.contacts.map((c) => {
    const info = businessFromProfile(c as never);
    const biz = info ? byKey.get(businessKey(info)) ?? null : null;
    return { c, info, biz };
  });
  const plan = planBulkLinks({
    contacts: infos.map(({ c, biz }) => ({ id: c.id, name: contactName(c), businessId: biz?.id, variables: c.variables ?? {} })),
    assetsByBusiness, requiredSlots: p.requiredSlots, neededTokens: p.neededTokens ?? null,
    existing: p.recipients.filter((r) => r.contact_ref && live(r)).map((r) => ({ contactId: r.contact_ref, status: 'active' })),
  }) as Array<{ status: PlanStatus; missingSlots: string[]; variables: Record<string, string> }>;
  return infos.map(({ c, info, biz }, i) => {
    const links = mine(c.id);
    const recipient = links.find(live) ?? links[0] ?? null;
    const status = linkStatusOf(recipient, p.now);
    const merged = recipient && status === 'active' ? mergeAssetVariables(recipient.variables ?? {}, plan[i].variables) : null;
    return {
      contactId: c.id, name: contactName(c), businessName: info?.name ?? '', businessId: biz?.id ?? null,
      plan: plan[i], recipient, linkStatus: status,
      stale: !!(merged && assetVariablesChanged(recipient!.variables ?? {}, merged)),
    };
  });
}

export const summarize = (rows: BulkRow[]) => ({
  total: rows.length,
  ready: rows.filter((r) => r.plan.status === 'ready').length,
  missing: rows.filter((r) => r.plan.status === 'missing-assets').length,
  linked: rows.filter((r) => r.linkStatus === 'active').length,
  revoked: rows.filter((r) => r.linkStatus === 'revoked').length,
  stale: rows.filter((r) => r.stale).length,
});
