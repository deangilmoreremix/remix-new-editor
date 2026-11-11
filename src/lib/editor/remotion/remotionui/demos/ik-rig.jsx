/* eslint-disable */
import React from 'react';
import { IkRig } from "../vendored/primitives/ik-rig";
// GENERATED from the RemotionUI docs usage example for "ik-rig" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <IkRig
        base={[640, 480]}
        lengths={[220, 200]}
        plot={{ d: "M300 260 C380 160 520 360 600 240", speed: 600, park: [700, 300] }}
       {...__o}/>
    </div>
  );
}
