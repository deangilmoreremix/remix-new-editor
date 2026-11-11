/* eslint-disable */
import React from 'react';
import { DonutChart } from "../vendored/primitives/donut-chart";
// GENERATED from the RemotionUI docs usage example for "donut-chart" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <DonutChart
        segments={[
          { label: "Direct", value: 4820 },
          { label: "Search", value: 3140 },
          { label: "Social", value: 1960 },
        ]}
        totalLabel="Sessions"
        staggerInFrames={16}
       {...__o}/>
    </div>
  );
}
