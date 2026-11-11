/* eslint-disable */
import React from 'react';
import { AiGenerationCanvas } from "../vendored/compositions/ai-generation-canvas";
// GENERATED from the RemotionUI docs usage example for "ai-generation-canvas" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <AiGenerationCanvas
        prompt="Generate a revenue dashboard for this launch"
        accentColor="#e8b86d"
        cardCount={4}
       {...__o}/>
    </div>
  );
}
