/* eslint-disable */
import React from 'react';
import { PricingFocus } from "../vendored/compositions/pricing-focus";
// GENERATED from the RemotionUI docs usage example for "pricing-focus" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <PricingFocus tiers={[{ name: "Starter", price: "$0" }, { name: "Studio", price: "$29", featured: true }]}  {...__o}/>
    </div>
  );
}
