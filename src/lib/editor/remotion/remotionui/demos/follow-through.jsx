/* eslint-disable */
import React from 'react';
import { FollowThrough } from "../vendored/primitives/follow-through";
import { easyEase } from "../vendored/lib/ae-motion";
// GENERATED from the RemotionUI docs usage example for "follow-through" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <FollowThrough
        leader={[easyEase(0, [200, 300]), easyEase(30, [760, 240])]}
        links={12}
        damping={0.45}
        renderSpine={({ d }) => <path d={d} stroke="#e8b86d" strokeWidth={6} fill="none" />}
       {...__o}/>
    </div>
  );
}
