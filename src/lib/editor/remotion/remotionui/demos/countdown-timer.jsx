/* eslint-disable */
import React from 'react';
import { CountdownTimer } from "../vendored/scenes/countdown-timer";
// GENERATED from the RemotionUI docs usage example for "countdown-timer" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <CountdownTimer from={5} label="Starting in" zeroLabel="Live"  {...__o}/>
    </div>
  );
}
