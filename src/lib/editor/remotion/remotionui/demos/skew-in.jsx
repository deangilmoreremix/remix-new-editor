/* eslint-disable */
import React from 'react';
import { SkewIn } from "../vendored/primitives/skew-in";
// GENERATED from the RemotionUI docs usage example for "skew-in" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SkewIn skew={16} travel={72} durationInFrames={40} {...__o}>
        <h1>{__o.text1 ?? "Leans in, straightens up"}</h1>
      </SkewIn>
    </div>
  );
}
