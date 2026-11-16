/* eslint-disable */
import React from 'react';
import { SearchResultsPopulate } from "../vendored/scenes/search-results-populate";
// GENERATED from the RemotionUI docs usage example for "search-results-populate" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <SearchResultsPopulate
        query="transition between scenes"
        results={[
          { title: "Slide transition", detail: "docs/transitions/slide", score: 0.64 },
          { title: "Cross-fade two compositions", detail: "docs/transitions/fade", score: 0.98 },
        ]}
        holdSeconds={4}
       {...__o}/>
    </div>
  );
}
