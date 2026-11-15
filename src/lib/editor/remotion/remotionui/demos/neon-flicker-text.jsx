/* eslint-disable */
import React from 'react';
import { NeonFlickerText } from "../vendored/primitives/neon-flicker-text";
import { random } from "../shim";
// GENERATED from the RemotionUI docs usage example for "neon-flicker-text" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <NeonFlickerText text="Open all night" order="random" glowColor="#f472b6"  {...__o}/>
    </div>
  );
}
