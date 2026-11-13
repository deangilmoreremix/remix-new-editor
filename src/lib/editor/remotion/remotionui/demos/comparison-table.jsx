/* eslint-disable */
import React from 'react';
import { ComparisonTable } from "../vendored/scenes/comparison-table";
// GENERATED from the RemotionUI docs usage example for "comparison-table" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ComparisonTable
        title="What you get"
        columns={["Free", "Studio", "Scale"]}
        rows={[
          { label: "Render minutes", cells: ["60", "2,000", "Unlimited"] },
          { label: "4K exports", cells: [false, true, true] },
          { label: "Priority queue", cells: [false, false, true] },
        ]}
        highlightColumn={1}
        highlightLabel="Most picked"
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
