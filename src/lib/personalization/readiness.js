// src/lib/personalization/readiness.js
//
// "Ready to export?": one checklist from the checks the timeline already has
// (missing images, broken images, unreviewed AI images, per-contact AI clips)
// plus the layout check and how many images could still be prepared. Pure:
// the async image probe and the layout report are passed in by the caller.
import { contactImageGaps, describeBrokenImages } from './imageReadiness.js';
import { describeClipGaps } from './aiContactClips.js';
import { unreviewedAiImages } from './aiContactImages.js';

const SEVERITY_ORDER = { blocker: 0, warning: 1, info: 2 };
// A review note (e.g. readability not measured yet) is optional, not a reason to hold the export.
const FROM_LAYOUT = { critical: 'blocker', adjust: 'warning', review: 'info' };

/**
 * @param {object} args
 * @param {object} args.project        the timeline state (tracks)
 * @param {object[]} args.contacts     contact profiles
 * @param {string[]} [args.keys]       image tokens the project uses
 * @param {{ issues: object[] }} [args.layoutReport]  from checkTimelineLayout
 * @param {object[]} [args.broken]     from findBrokenImages (undefined = not checked yet)
 * @param {number} [args.preparable]   images that could still get a transparent background
 * @returns {{ status: 'ready'|'needs-attention'|'blocked', items: object[], counts: object }}
 */
export function buildReadiness({ project, contacts = [], keys = [], layoutReport, broken, preparable = 0 } = {}) {
  const items = [];
  const push = (item) => items.push({ contactId: null, ...item });

  contactImageGaps(project, contacts).forEach((gap) => push({
    id: `missing:${gap.id}`,
    severity: 'warning',
    kind: 'missing-image',
    contactId: gap.id ?? null,
    contactName: gap.name,
    message: `${gap.name} has no ${gap.missing.join(' or ')}, so their video shows nothing there.`,
    fix: { type: 'open-personalize', label: 'Add it' },
  }));

  unreviewedAiImages(keys, contacts).forEach((u, i) => push({
    id: `unreviewed:${u.contactName}:${u.label}:${i}`,
    severity: 'warning',
    kind: 'unreviewed-ai-image',
    contactName: u.contactName,
    message: `${u.contactName}'s AI-made ${u.label} hasn't been reviewed.`,
    fix: { type: 'open-personalize', label: 'Review' },
  }));

  describeClipGaps(project, contacts).forEach((message, i) => push({
    id: `clip:${i}`, severity: 'warning', kind: 'missing-ai-clip', message, fix: null,
  }));

  if (Array.isArray(broken)) {
    describeBrokenImages(broken).forEach((message, i) => push({
      id: `broken:${i}`, severity: 'warning', kind: 'broken-image', message, fix: { type: 'open-personalize', label: 'Replace' },
    }));
  }

  (layoutReport?.issues || []).forEach((issue, i) => push({
    id: `layout:${issue.code}:${issue.layerId || i}`,
    severity: FROM_LAYOUT[issue.severity] || 'warning',
    kind: 'layout',
    message: issue.message,
    fix: issue.layerId ? { type: 'show-layer', layerId: issue.layerId, label: 'Show' } : null,
    fixable: Boolean(issue.fixable),
  }));

  if (preparable > 0) push({
    id: 'prepare',
    severity: 'info',
    kind: 'preparable',
    message: `${preparable} contact image${preparable === 1 ? '' : 's'} still ha${preparable === 1 ? 's' : 've'} a background (optional).`,
    fix: { type: 'prepare-all', label: 'Prepare' },
  });

  items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const counts = {
    blockers: items.filter((i) => i.severity === 'blocker').length,
    warnings: items.filter((i) => i.severity === 'warning').length,
    info: items.filter((i) => i.severity === 'info').length,
    imagesChecked: Array.isArray(broken),
  };
  return { status: counts.blockers ? 'blocked' : counts.warnings ? 'needs-attention' : 'ready', items, counts };
}
