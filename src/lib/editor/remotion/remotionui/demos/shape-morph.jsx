/* eslint-disable */
import React from 'react';
import { ShapeMorph } from "../vendored/primitives/shape-morph";
// GENERATED from the RemotionUI docs usage example for "shape-morph" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ShapeMorph
        shapes={["circle", "squircle", "triangle", "diamond"]}
        size={300}
        durationInFrames={96}
        exitAtInFrames={92}
       {...__o}/>
    </div>
  );
}
