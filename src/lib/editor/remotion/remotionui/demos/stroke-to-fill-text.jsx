/* eslint-disable */
import React from 'react';
import { StrokeToFillText } from "../vendored/primitives/stroke-to-fill-text";
// GENERATED from the RemotionUI docs usage example for "stroke-to-fill-text" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const source = "export function render(scene) {\n  const frame = useCurrentFrame();\n  const t = interpolate(frame, [0, 30], [0, 1]);\n  return scene(t);\n}";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <StrokeToFillText
        text="Ship faster with source"
        strokeColor="#e8b86d"
        staggerInFrames={5}
       {...__o}/>
    </div>
  );
}
