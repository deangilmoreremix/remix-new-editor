/* eslint-disable */
import React from 'react';
import { TeamGrid } from "../vendored/scenes/team-grid";
// GENERATED from the RemotionUI docs usage example for "team-grid" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <TeamGrid
        title="The people behind it"
        subtitle="Eight of us, four timezones."
        members={[
          { name: "Ada Okonjo", role: "Founder" },
          { name: "Piotr Nowak", role: "Rendering" },
          { name: "Dai Nakamura", role: "Design systems" },
        ]}
        columns={4}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
