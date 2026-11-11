/* eslint-disable */
import React from 'react';
import { InfiniteMarquee } from "../vendored/primitives/infinite-marquee";
// GENERATED from the RemotionUI docs usage example for "infinite-marquee" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <InfiniteMarquee text="Scrolling band" speed={2} direction="left" fade={0.08}  {...__o}/>
    </div>
  );
}
