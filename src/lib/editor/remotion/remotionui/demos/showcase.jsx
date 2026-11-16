/* eslint-disable */
import React from 'react';
import { Showcase } from "../vendored/compositions/showcase";
// GENERATED from the RemotionUI docs usage example for "showcase" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const source = "export function render(scene) {\n  const frame = useCurrentFrame();\n  const t = interpolate(frame, [0, 30], [0, 1]);\n  return scene(t);\n}";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <Showcase title="Product story" subtitle="Install source, compose scenes, render on your timeline" statValue={3} statLabel="Runtime dependencies"  {...__o}/>
    </div>
  );
}
