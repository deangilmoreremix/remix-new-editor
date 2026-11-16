/* eslint-disable */
import React from 'react';
import { ShapeLayer } from "../vendored/primitives/shape-layer";
import { easyEase } from "../vendored/lib/ae-motion";
// GENERATED from the RemotionUI docs usage example for "shape-layer" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ShapeLayer
        shapes={[{ type: "star", points: 5, outerRadius: 160, innerRadius: 70 }]}
        operators={[
          { op: "repeater", copies: 12, scale: 0.88, rotation: 8, position: [0, 0] },
          { op: "trim", mode: "individual", end: 0.3, offset: [easyEase(0, 0), easyEase(90, 1)] },
          { op: "wiggle", size: 2, detail: 3 },
        ]}
        width={480}
        height={480}
       {...__o}/>
    </div>
  );
}
