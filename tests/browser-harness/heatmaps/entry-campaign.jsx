import React from 'react';
import { createRoot } from 'react-dom/client';
import HeatmapsSection from '__ROOT__/src/lib/editor/projectLibrary/analytics/HeatmapsSection.jsx';
// every rpc goes to the REAL Postgres (as owner A) through the Playwright-exposed bridge window.pgRpc
const client = { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  rpc: async (name, args) => { window.__calls.push([name, args]); return window.pgRpc(name, args); } };
window.__calls = [];
window.mount = (video) => createRoot(document.getElementById('root')).render(
  <div className="sv-analytics sv-editor"><HeatmapsSection client={client} video={{ id: video, title: 'Promo' }} projectName="Promo" now={new Date()} /></div>);
