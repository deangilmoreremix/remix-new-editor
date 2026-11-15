/* eslint-disable */
import React from 'react';
import { FunnelChart } from "../vendored/primitives/funnel-chart";
// GENERATED from the RemotionUI docs usage example for "funnel-chart" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <FunnelChart
        stages={[
          { label: "Visited docs", value: 42800 },
          { label: "Ran the CLI", value: 18600 },
          { label: "Shipped it", value: 1750 },
        ]}
        staggerInFrames={15}
       {...__o}/>
    </div>
  );
}
