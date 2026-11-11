/* eslint-disable */
import React from 'react';
import { PathDraw } from "../vendored/primitives/path-draw";
// GENERATED from the RemotionUI docs usage example for "path-draw" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <PathDraw d={["M 20 180 L 100 20 L 180 180", "M 60 120 L 140 120"]} durationInFrames={60}  {...__o}/>
    </div>
  );
}
