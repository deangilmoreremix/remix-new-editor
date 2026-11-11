/* eslint-disable */
import React from 'react';
import { SvgMaskReveal } from "../vendored/primitives/svg-mask-reveal";
const __Stub = (label) => function Stub() { return (<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 72, fontWeight: 700, textShadow: '0 4px 24px rgba(0,0,0,.45)' }}>{label.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>); };
const YourContent = __Stub("YourContent");
// GENERATED from the RemotionUI docs usage example for "svg-mask-reveal" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SvgMaskReveal
        shape="squircle"
        origin={{ x: 0.32, y: 0.36 }}
        durationInFrames={90}
        rotation={40}
       {...__o}>
        <YourContent />
      </SvgMaskReveal>
    </div>
  );
}
