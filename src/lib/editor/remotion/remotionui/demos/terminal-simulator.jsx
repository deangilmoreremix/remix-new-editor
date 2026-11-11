/* eslint-disable */
import React from 'react';
import { TerminalSimulator } from "../vendored/scenes/terminal-simulator";
// GENERATED from the RemotionUI docs usage example for "terminal-simulator" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <TerminalSimulator command="pnpm build" summary="done in 4.2s"  {...__o}/>
    </div>
  );
}
