/* eslint-disable */
import React from 'react';
import { StackedAreaChart } from "../vendored/primitives/stacked-area-chart";
// GENERATED from the RemotionUI docs usage example for "stacked-area-chart" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <StackedAreaChart
        series={[
          { label: "Reels", values: [140, 210, 300, 430, 520] },
          { label: "Ads", values: [90, 130, 210, 300, 340] },
        ]}
        labels={["Jan", "Mar", "May", "Jul", "Aug"]}
        durationInFrames={62}
       {...__o}/>
    </div>
  );
}
