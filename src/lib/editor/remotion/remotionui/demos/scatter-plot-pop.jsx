/* eslint-disable */
import React from 'react';
import { ScatterPlotPop } from "../vendored/primitives/scatter-plot-pop";
// GENERATED from the RemotionUI docs usage example for "scatter-plot-pop" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ScatterPlotPop
        points={[{ x: 4, y: 24, weight: 0.8 }, { x: 11, y: 39 }]}
        xLabel="Scenes per project"
        staggerInFrames={3}
       {...__o}/>
    </div>
  );
}
