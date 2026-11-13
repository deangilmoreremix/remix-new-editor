/* eslint-disable */
import React from 'react';
import { OrgChartBuild } from "../vendored/scenes/org-chart-build";
// GENERATED from the RemotionUI docs usage example for "org-chart-build" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <OrgChartBuild
        title="How the team is wired"
        nodes={[
          { name: "Ada Okonjo", role: "Founder" },
          { name: "Piotr Nowak", role: "Engineering", parent: 0 },
          { name: "Dai Nakamura", role: "Design", parent: 0 },
          { name: "Sam Rhodes", role: "Infrastructure", parent: 1 },
        ]}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
