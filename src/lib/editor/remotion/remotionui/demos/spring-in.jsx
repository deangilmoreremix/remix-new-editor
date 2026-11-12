/* eslint-disable */
import React from 'react';
import { SpringIn } from "../vendored/primitives/spring-in";
// GENERATED from the RemotionUI docs usage example for "spring-in" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SpringIn config="bouncy" durationInFrames={40} {...__o}>
        <div>Physical entrance</div>
      </SpringIn>
    </div>
  );
}
