import React from 'react';
import { createRoot } from 'react-dom/client';
import HeatmapsSection from '/home/user/wt-stage7/src/lib/editor/projectLibrary/analytics/HeatmapsSection.jsx';
const client = { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  rpc: async (name, args) => { window.__calls.push([name, args]); return { data: window.__rpc[name], error: null }; } };
window.__calls = [];
window.mount = () => createRoot(document.getElementById('root')).render(
  <div className="sv-analytics sv-editor"><HeatmapsSection client={client} video={{ id: 'vidA000001', title: 'Promo' }} projectName="Promo" now={new Date()} /></div>);
