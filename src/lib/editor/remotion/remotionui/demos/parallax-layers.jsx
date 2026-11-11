/* eslint-disable */
import React from 'react';
import { ParallaxLayers } from "../vendored/primitives/parallax-layers";
const __Stub = (label) => function Stub() { return (<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 72, fontWeight: 700, textShadow: '0 4px 24px rgba(0,0,0,.45)' }}>{label.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>); };
const Sky = __Stub("Sky");
const Headline = __Stub("Headline");
const Foreground = __Stub("Foreground");
// GENERATED from the RemotionUI docs usage example for "parallax-layers" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ParallaxLayers
        travel={420}
        layers={[
          { content: <Sky />, depth: 0.2, blur: 2 },
          { content: <Headline />, depth: 0.55 },
          { content: <Foreground />, depth: 1, blur: 8 },
        ]}
       {...__o}/>
    </div>
  );
}
