/* eslint-disable */
import React from 'react';
import { RadarChart } from "../vendored/primitives/radar-chart";
// GENERATED from the RemotionUI docs usage example for "radar-chart" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <RadarChart
        axes={["Speed", "Polish", "Reuse", "Docs", "Types", "Motion"]}
        series={[
          { label: "Before", values: [42, 38, 24, 30, 46, 34] },
          { label: "After", values: [88, 92, 84, 78, 90, 86] },
        ]}
        maxValue={100}
       {...__o}/>
    </div>
  );
}
