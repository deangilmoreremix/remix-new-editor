/* eslint-disable */
import React from 'react';
import { GaugeDial } from "../vendored/primitives/gauge-dial";
// GENERATED from the RemotionUI docs usage example for "gauge-dial" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <GaugeDial value={78} label="Render budget" unit="%" durationInFrames={70}  {...__o}/>
    </div>
  );
}
