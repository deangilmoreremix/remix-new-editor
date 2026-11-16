/* eslint-disable */
import React from 'react';
import { ProgressBar } from "../vendored/primitives/progress-bar";
// GENERATED from the RemotionUI docs usage example for "progress-bar" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ProgressBar progress={0.75} label="Rendering" showValue segments={4}  {...__o}/>
    </div>
  );
}
