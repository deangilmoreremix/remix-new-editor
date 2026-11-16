/* eslint-disable */
import React from 'react';
import { GlowPulse } from "../vendored/primitives/glow-pulse";
const __Stub = (label) => function Stub() { return (<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 72, fontWeight: 700, textShadow: '0 4px 24px rgba(0,0,0,.45)' }}>{label.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>); };
const CtaPill = __Stub("CtaPill");
// GENERATED from the RemotionUI docs usage example for "glow-pulse" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <GlowPulse mode="beat" periodInFrames={36} {...__o}>
        <CtaPill />
      </GlowPulse>
    </div>
  );
}
