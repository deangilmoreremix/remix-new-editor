// [remix] Sample content for the Leads and Analytics tabs before a video is published, so those tabs show the layout
// they will have. Everything here is illustrative: it is always labelled "Sample data" and is never stored or counted.
import type { LeadForm, LeadRow } from './leads';

const daysAgo = (d: number, h = 10) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

export const SAMPLE_FORMS: LeadForm[] = [
  { key: 'list-builder', label: 'List Builder', short: 'List Builder', tone: 'wall' },
  { key: 'sample-lead-form', label: 'Lead Generator · 0:45', short: 'Lead Generator', tone: 'lead' },
];

export const SAMPLE_LEADS: LeadRow[] = [
  { id: 's1', kind: 'list-builder', clipId: 'list-builder', createdAt: daysAgo(0, 2), data: { 'FIRST NAME': 'Maya', EMAIL: 'maya@example.com' }, source: { referrer: 'youtube.com' } },
  { id: 's2', kind: 'lead-form', clipId: 'sample-lead-form', createdAt: daysAgo(1, 5), data: { 'FIRST NAME': 'Jordan', EMAIL: 'jordan@example.com' }, source: { utm: { source: 'newsletter', campaign: 'launch' } } },
  { id: 's3', kind: 'list-builder', clipId: 'list-builder', createdAt: daysAgo(3), data: { 'FIRST NAME': 'Sam', EMAIL: 'sam@example.com' }, source: { referrer: 'linkedin.com' } },
  { id: 's4', kind: 'lead-form', clipId: 'sample-lead-form', createdAt: daysAgo(6, 1), data: { 'FIRST NAME': 'Priya', EMAIL: 'priya@example.com' } },
];

export const SAMPLE_VIEWS = 120;

/** Headline numbers and a retention curve (share of viewers still watching at each tenth of the video). */
export const SAMPLE_ANALYTICS = {
  cards: [
    ['Plays', '1,284'], ['Unique viewers', '902'], ['Avg. watch time', '1:12'], ['Avg. % watched', '64%'],
    ['Completion rate', '41%'], ['Button clicks', '176'], ['Leads', '58'], ['Lead conversion', '4.5%'],
  ] as [string, string][],
  retention: [100, 91, 82, 76, 70, 63, 55, 49, 44, 41],
};
