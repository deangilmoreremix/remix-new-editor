/* eslint-disable */
import React from 'react';
import { SimulatedCursor } from "../vendored/primitives/simulated-cursor";
// GENERATED from the RemotionUI docs usage example for "simulated-cursor" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SimulatedCursor
        points={[
          { x: 20, y: 60, frame: 0 },
          { x: 70, y: 40, frame: 30, target: 96, label: "Render" },
        ]}
        clickFrames={[32]}
       {...__o}/>
    </div>
  );
}
