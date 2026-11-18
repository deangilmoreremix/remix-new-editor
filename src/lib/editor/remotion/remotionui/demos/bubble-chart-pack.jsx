/* eslint-disable */
import React from 'react';
import { BubbleChartPack } from "../vendored/primitives/bubble-chart-pack";
// GENERATED from the RemotionUI docs usage example for "bubble-chart-pack" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <BubbleChartPack
        bubbles={[
          { label: "Atoms", value: 42 },
          { label: "Blocks", value: 31 },
          { label: "Signals", value: 26 },
        ]}
        staggerInFrames={12}
       {...__o}/>
    </div>
  );
}
