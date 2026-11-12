/* eslint-disable */
import React from 'react';
import { HeatmapGrid } from "../vendored/primitives/heatmap-grid";
// GENERATED from the RemotionUI docs usage example for "heatmap-grid" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const weeks = Array.from({ length: 7 }, (_, r) => Array.from({ length: 20 }, (_, c) => ((r * 7 + c * 13) % 10) / 10));
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <HeatmapGrid
        cells={weeks}
        rowLabels={["Mon", "", "Wed", "", "Fri", "", "Sun"]}
        columnStaggerInFrames={3.4}
       {...__o}/>
    </div>
  );
}
