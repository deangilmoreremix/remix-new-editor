/* eslint-disable */
import React from 'react';
import { ArrowAnnotate } from "../vendored/primitives/arrow-annotate";
// GENERATED from the RemotionUI docs usage example for "arrow-annotate" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ArrowAnnotate
        from={{ x: 0.08, y: 0.16 }}
        to={{ x: 0.82, y: 0.74 }}
        bow={0.28}
        label="this one"
        durationInFrames={70}
        exitAtInFrames={92}
       {...__o}/>
    </div>
  );
}
