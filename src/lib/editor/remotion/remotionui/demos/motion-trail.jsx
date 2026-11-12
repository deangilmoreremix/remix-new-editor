/* eslint-disable */
import React from 'react';
import { MotionTrail } from "../vendored/primitives/motion-trail";
const __Stub = (label) => function Stub() { return (<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 72, fontWeight: 700, textShadow: '0 4px 24px rgba(0,0,0,.45)' }}>{label.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>); };
const TheMovingThing = __Stub("TheMovingThing");
// GENERATED from the RemotionUI docs usage example for "motion-trail" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <MotionTrail count={6} gapInFrames={3} {...__o}>
        <TheMovingThing />
      </MotionTrail>
    </div>
  );
}
