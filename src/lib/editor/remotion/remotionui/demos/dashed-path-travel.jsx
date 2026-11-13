/* eslint-disable */
import React from 'react';
import { DashedPathTravel } from "../vendored/primitives/dashed-path-travel";
// GENERATED from the RemotionUI docs usage example for "dashed-path-travel" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <DashedPathTravel
        waypoints={[
          { x: 20, y: 150 },
          { x: 90, y: 60 },
          { x: 280, y: 40 },
        ]}
        orient
        durationInFrames={86}
        exitAtInFrames={92}
       {...__o}/>
    </div>
  );
}
