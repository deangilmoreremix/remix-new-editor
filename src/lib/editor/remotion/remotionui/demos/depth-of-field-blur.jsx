/* eslint-disable */
import React from 'react';
import { DepthOfFieldBlur } from "../vendored/primitives/depth-of-field-blur";
const __Stub = (label) => function Stub() { return (<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 72, fontWeight: 700, textShadow: '0 4px 24px rgba(0,0,0,.45)' }}>{label.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>); };
const Background = __Stub("Background");
const Card = __Stub("Card");
const Foreground = __Stub("Foreground");
// GENERATED from the RemotionUI docs usage example for "depth-of-field-blur" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <DepthOfFieldBlur
        focusFrom={1}
        focusTo={0}
        layers={[
          { content: <Background />, depth: 1 },
          { content: <Card />, depth: 0.4 },
          { content: <Foreground />, depth: 0 },
        ]}
       {...__o}/>
    </div>
  );
}
