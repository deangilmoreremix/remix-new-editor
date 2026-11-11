/* eslint-disable */
import React from 'react';
import { LineChartDraw } from "../vendored/primitives/line-chart-draw";
// GENERATED from the RemotionUI docs usage example for "line-chart-draw" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <LineChartDraw
        points={[
          { x: 0, y: 12000, label: "Jan" },
          { x: 1, y: 24000, label: "Feb" },
        ]}
       {...__o}/>
    </div>
  );
}
