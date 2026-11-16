/* eslint-disable */
import React from 'react';
import { MetricTicker } from "../vendored/scenes/metric-ticker";
// GENERATED from the RemotionUI docs usage example for "metric-ticker" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const metrics = [{ label: "Views", value: 124000 }, { label: "Watch time (h)", value: 8200 }, { label: "Subscribers", value: 3150 }];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <MetricTicker
        title="Channel momentum"
        metrics={[
          { label: "Views", value: 124000, delta: "+18%", trend: [62, 84, 96, 124] },
        ]}
       {...__o}/>
    </div>
  );
}
