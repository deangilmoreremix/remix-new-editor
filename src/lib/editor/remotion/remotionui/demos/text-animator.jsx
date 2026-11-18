/* eslint-disable */
import React from 'react';
import { TextAnimator } from "../vendored/primitives/text-animator";
import { easyEase } from "../vendored/lib/ae-motion";
// GENERATED from the RemotionUI docs usage example for "text-animator" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <TextAnimator
        text="Every letter keeps its own clock"
        animators={[
          {
            properties: { position: [0, 60], opacity: 0, blur: 12 },
            selectors: [{ shape: "ramp-up", start: 0, end: 0.3, offset: [easyEase(0, -0.3), easyEase(45, 1)] }],
          },
        ]}
       {...__o}/>
    </div>
  );
}
