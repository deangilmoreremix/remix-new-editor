/* eslint-disable */
import React from 'react';
import { PerspectiveMarquee } from "../vendored/primitives/perspective-marquee";
// GENERATED from the RemotionUI docs usage example for "perspective-marquee" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <PerspectiveMarquee text="Depth scroll" speed={10} floorTilt={70} perspective={640}  {...__o}/>
    </div>
  );
}
