/* eslint-disable */
import React from 'react';
import { BadgeStamp } from "../vendored/primitives/badge-stamp";
// GENERATED from the RemotionUI docs usage example for "badge-stamp" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <BadgeStamp
        label="APPROVED"
        ringText="REMOTIONUI"
        ringTextBottom="VERIFIED BUILD"
        sublabel="2026"
        delayInFrames={14}
        exitAtInFrames={92}
       {...__o}/>
    </div>
  );
}
