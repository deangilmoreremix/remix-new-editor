/* eslint-disable */
import React from 'react';
import { RotateIn } from "../vendored/primitives/rotate-in";
// GENERATED from the RemotionUI docs usage example for "rotate-in" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <RotateIn axis="x" degrees={-24} origin="bottom" {...__o}>
        <div>{__o.text1 ?? "Hinge into place"}</div>
      </RotateIn>
    </div>
  );
}
