/* eslint-disable */
import React from 'react';
import { ComparisonBars } from "../vendored/primitives/comparison-bars";
// GENERATED from the RemotionUI docs usage example for "comparison-bars" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const before = "const total = items.map((i) => i.price).reduce((a, b) => a + b, 0);";
  const after = "const total = sum(items, (i) => i.price);";
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ComparisonBars
        rows={[
          { label: "Time to first cut", before: 240, after: 96 },
          { label: "Renders / week", before: 120, after: 310 },
        ]}
        seriesLabels={["Before", "After"]}
        staggerInFrames={18}
       {...__o}/>
    </div>
  );
}
