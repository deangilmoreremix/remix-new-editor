/* eslint-disable */
import React from 'react';
import { WeatherCard } from "../vendored/scenes/weather-card";
// GENERATED from the RemotionUI docs usage example for "weather-card" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <WeatherCard
        place="Lisbon"
        temperature={24}
        condition="sun"
        conditionLabel="Clear, light breeze"
        forecast={[
          { label: "Sat", condition: "sun", high: 24, low: 14 },
          { label: "Sun", condition: "cloud", high: 22, low: 13 },
          { label: "Mon", condition: "rain", high: 18, low: 12 },
        ]}
       {...__o}/>
    </div>
  );
}
