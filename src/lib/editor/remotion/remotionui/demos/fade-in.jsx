/* eslint-disable */
import React from 'react';
import { FadeIn } from "../vendored/primitives/fade-in";
// GENERATED from the RemotionUI docs usage example for "fade-in" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <FadeIn durationInFrames={30} exit {...__o}>
        <div>Hello world</div>
      </FadeIn>
    </div>
  );
}
