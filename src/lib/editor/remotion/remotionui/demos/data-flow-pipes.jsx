/* eslint-disable */
import React from 'react';
import { DataFlowPipes } from "../vendored/scenes/data-flow-pipes";
// GENERATED from the RemotionUI docs usage example for "data-flow-pipes" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <DataFlowPipes stages={[{ label: "Ingest" }, { label: "Deliver" }]}  {...__o}/>
    </div>
  );
}
