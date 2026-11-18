/* eslint-disable */
import React from 'react';
import { CandlestickChart } from "../vendored/primitives/candlestick-chart";
// GENERATED from the RemotionUI docs usage example for "candlestick-chart" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <CandlestickChart
        candles={[{ open: 101, high: 106, low: 99, close: 104, label: "W1" }]}
        movingAverage={6}
        staggerInFrames={3.4}
       {...__o}/>
    </div>
  );
}
