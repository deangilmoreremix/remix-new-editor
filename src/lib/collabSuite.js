// Collab Suite is a separate application (see /collab-suite). SmartVideo only links out to it.
// Set VITE_COLLAB_SUITE_URL to wherever it is deployed; with no URL the entries are hidden.
const BASE = (import.meta.env.VITE_COLLAB_SUITE_URL || '').replace(/\/+$/, '');

const ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const APPS = [
  ['teamchat', 'Teamchat', 'Channels and team messaging'],
  ['calendar', 'Calendar', 'Plan events and schedules'],
  ['contacts', 'Contacts', 'People and companies'],
  ['meetings', 'Meetings', 'Video calls'],
  ['email', 'Email', 'Compose and manage mail'],
  ['signatures', 'Signatures', 'Draw and save your signature'],
];

export const COLLAB_APPS = BASE
  ? APPS.map(([id, name, description]) => ({ id: `collab-${id}`, name, description, icon: ICON, badge: 'Collab', href: `${BASE}/#/${id}` }))
  : [];
