import React from 'react';
import { createRoot } from 'react-dom/client';
import AnalyticsTabView from './AnalyticsTabView.jsx';

/**
 * Mount the Analytics tab into a Projects detail panel. Returns a cleanup
 * function (the panel calls it when the tab or project changes).
 *   deps: { client, createPlayer?, now?, onPublish?, onOpenOpportunity?, onCreateFollowup? }
 */
export function mountAnalyticsTab(panel, ctx, deps) {
  panel.innerHTML = '';
  const host = document.createElement('div');
  panel.appendChild(host);
  const root = createRoot(host);
  root.render(
    <AnalyticsTabView
      client={deps.client}
      projectRow={ctx.project}
      createPlayer={deps.createPlayer}
      now={deps.now}
      onPublish={deps.onPublish}
      onOpenOpportunity={(id) => deps.onOpenOpportunity?.(id)}
      onCreateFollowup={deps.onCreateFollowup}
    />,
  );
  return () => { root.unmount(); host.remove(); };
}
