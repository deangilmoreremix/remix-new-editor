/* eslint-disable */
import React from 'react';
import { NewsTickerBar } from "../vendored/scenes/news-ticker-bar";
// GENERATED from the RemotionUI docs usage example for "news-ticker-bar" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <NewsTickerBar
        flag="Breaking"
        headlines={["Registry crosses 165 components", "CLI adds batch install"]}
        strapline="Live from the newsroom"
        timestamp="21:04"
       {...__o}/>
    </div>
  );
}
