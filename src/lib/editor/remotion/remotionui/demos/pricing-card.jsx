/* eslint-disable */
import React from 'react';
import { PricingCard } from "../vendored/scenes/pricing-card";
// GENERATED from the RemotionUI docs usage example for "pricing-card" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <PricingCard
        tier="Studio"
        badge="Most picked"
        price={32}
        period="/mo"
        note="Billed annually. Cancel whenever."
        features={["2,000 render minutes a month", "4K exports, no watermark", "9 team seats"]}
        ctaLabel="Start rendering"
        holdSeconds={3.4}
       {...__o}/>
    </div>
  );
}
