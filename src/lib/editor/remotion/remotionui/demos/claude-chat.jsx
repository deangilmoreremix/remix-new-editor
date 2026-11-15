/* eslint-disable */
import React from 'react';
import { ClaudeChat } from "../vendored/scenes/claude-chat";
// GENERATED from the RemotionUI docs usage example for "claude-chat" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <ClaudeChat prompt="Draft a launch tweet for our new release"  {...__o}/>
    </div>
  );
}
