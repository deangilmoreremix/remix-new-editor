/* eslint-disable */
import React from 'react';
import { HookCard } from "../vendored/scenes/hook-card";
// GENERATED from the RemotionUI docs usage example for "hook-card" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const before = "const total = items.map((i) => i.price).reduce((a, b) => a + b, 0);";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <HookCard
        kicker="Creator insight"
        headline="Make the first second count"
        emphasis="first second"
        subtitle="Hook viewers before they scroll"
       {...__o}/>
    </div>
  );
}
