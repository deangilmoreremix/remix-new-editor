/* eslint-disable */
import React from 'react';
import { AnimatedBarChart } from "../vendored/scenes/animated-bar-chart";
// GENERATED from the RemotionUI docs usage example for "animated-bar-chart" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <AnimatedBarChart
        title="Views by format"
        data={[{ label: "Shorts", value: 124000, delta: "+32%" }]}
        highlightLabel="Shorts"
       {...__o}/>
    </div>
  );
}
