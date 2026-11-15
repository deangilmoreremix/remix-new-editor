/* eslint-disable */
import React from 'react';
import { EcosystemOrbit } from "../vendored/compositions/ecosystem-orbit";
// GENERATED from the RemotionUI docs usage example for "ecosystem-orbit" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <EcosystemOrbit centerLabel="Your product" satellites={["GitHub", "Vercel", "Stripe"]}  {...__o}/>
    </div>
  );
}
