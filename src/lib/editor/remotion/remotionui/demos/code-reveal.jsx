/* eslint-disable */
import React from 'react';
import { CodeReveal } from "../vendored/scenes/code-reveal";
// GENERATED from the RemotionUI docs usage example for "code-reveal" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const source = "export function render(scene) {\n  const frame = useCurrentFrame();\n  const t = interpolate(frame, [0, 30], [0, 1]);\n  return scene(t);\n}";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <CodeReveal title="pipeline.ts" code={source} highlightedLines={[4, 5]}  {...__o}/>
    </div>
  );
}
