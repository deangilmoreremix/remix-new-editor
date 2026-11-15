/* eslint-disable */
import React from 'react';
import { EffectorField } from "../vendored/primitives/effector-field";
// GENERATED from the RemotionUI docs usage example for "effector-field" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <EffectorField
        layout={{ mode: "grid", columns: 24, rows: 12, spacing: 26 }}
        effectors={[
          {
            fields: [{ shape: "spherical", center: ({ time }) => [Math.cos(time) * 200, 0], radius: 160 }],
            position: [0, 0, 120],
            scale: 1.5,
            color: "#e8b86d",
          },
        ]}
        tilt={50}
       {...__o}/>
    </div>
  );
}
