/* eslint-disable */
import React from 'react';
import { PieSliceReveal } from "../vendored/primitives/pie-slice-reveal";
// GENERATED from the RemotionUI docs usage example for "pie-slice-reveal" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <PieSliceReveal
        slices={[
          { label: "Pro", value: 44 },
          { label: "Team", value: 26 },
          { label: "Free", value: 18 },
        ]}
        staggerInFrames={18}
       {...__o}/>
    </div>
  );
}
