/* eslint-disable */
import React from 'react';
import { SplitScreen } from "../vendored/scenes/split-screen";
// GENERATED from the RemotionUI docs usage example for "split-screen" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  const svg = (a, b) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='960' height='1080'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='960' height='1080' fill='url(#g)'/></svg>`);
  const before = svg("#1d4ed8", "#7c3aed");
  const after = svg("#f97316", "#ec4899");
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SplitScreen left={{ src: before }} right={{ src: after }}  {...__o}/>
    </div>
  );
}
