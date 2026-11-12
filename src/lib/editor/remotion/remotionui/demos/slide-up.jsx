/* eslint-disable */
import React from 'react';
import { SlideUp } from "../vendored/primitives/slide-up";
// GENERATED from the RemotionUI docs usage example for "slide-up" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SlideUp mask exit {...__o}>
        <h1>Title</h1>
      </SlideUp>
    </div>
  );
}
