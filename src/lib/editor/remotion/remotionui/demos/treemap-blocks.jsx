/* eslint-disable */
import React from 'react';
import { TreemapBlocks } from "../vendored/primitives/treemap-blocks";
// GENERATED from the RemotionUI docs usage example for "treemap-blocks" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <TreemapBlocks
        blocks={[
          { label: "Atoms", value: 46 },
          { label: "Blocks", value: 31 },
          { label: "Signals", value: 26 },
        ]}
        staggerInFrames={12}
       {...__o}/>
    </div>
  );
}
