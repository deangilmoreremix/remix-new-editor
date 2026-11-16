/* eslint-disable */
import React from 'react';
import { LogoWall } from "../vendored/scenes/logo-wall";
// GENERATED from the RemotionUI docs usage example for "logo-wall" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <LogoWall
        eyebrow="Trusted by"
        title="Teams shipping with RemotionUI"
        logos={[
          { name: "Northstar", color: "#E8B86D" },
          { name: "Halcyon", color: "#7DD3E8" },
          { name: "Fernweh", color: "#9BD4A0" },
          { name: "Orbital", color: "#C99BE8" },
        ]}
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
