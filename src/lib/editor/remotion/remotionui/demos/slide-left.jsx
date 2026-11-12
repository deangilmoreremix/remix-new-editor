/* eslint-disable */
import React from 'react';
import { SlideLeft } from "../vendored/primitives/slide-left";
// GENERATED from the RemotionUI docs usage example for "slide-left" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SlideLeft distance={60} from="left" {...__o}>
        <p>Slide in from the left</p>
      </SlideLeft>
    </div>
  );
}
