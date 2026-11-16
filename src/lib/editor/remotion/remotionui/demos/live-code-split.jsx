/* eslint-disable */
import React from 'react';
import { LiveCodeSplit } from "../vendored/compositions/live-code-split";
// GENERATED from the RemotionUI docs usage example for "live-code-split" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const sourceCode = "export function render(scene) {\n  const frame = useCurrentFrame();\n  const t = interpolate(frame, [0, 30], [0, 1]);\n  return scene(t);\n}";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <LiveCodeSplit code={sourceCode}  {...__o}/>
    </div>
  );
}
