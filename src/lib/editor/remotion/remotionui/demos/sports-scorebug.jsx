/* eslint-disable */
import React from 'react';
import { SportsScorebug } from "../vendored/scenes/sports-scorebug";
// GENERATED from the RemotionUI docs usage example for "sports-scorebug" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SportsScorebug
        away={{ abbr: "NOR", score: 66, color: "#7DD3E8" }}
        home={{ abbr: "VAL", score: 71, color: "#E8B86D", possession: true }}
        period="Q4"
        clockSeconds={154}
        changes={[{ side: "away", atSeconds: 1.1, points: 3 }]}
       {...__o}/>
    </div>
  );
}
