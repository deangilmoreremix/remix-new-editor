/* eslint-disable */
import React from 'react';
import { ConnectorLines } from "../vendored/primitives/connector-lines";
// GENERATED from the RemotionUI docs usage example for "connector-lines" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const source = "export function render(scene) {\n  const frame = useCurrentFrame();\n  const t = interpolate(frame, [0, 30], [0, 1]);\n  return scene(t);\n}";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ConnectorLines
        anchors={[
          { id: "source", x: 0.12, y: 0.5 },
          { id: "parse", x: 0.44, y: 0.18 },
          { id: "output", x: 0.86, y: 0.5 },
        ]}
        edges={[
          { from: "source", to: "parse", shape: "curve", bow: 0.12, dot: true },
          { from: "parse", to: "output", shape: "curve", bow: 0.12, dot: true },
        ]}
       {...__o}/>
    </div>
  );
}
