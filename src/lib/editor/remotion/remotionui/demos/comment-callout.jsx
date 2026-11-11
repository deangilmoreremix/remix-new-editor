/* eslint-disable */
import React from 'react';
import { CommentCallout } from "../vendored/scenes/comment-callout";
// GENERATED from the RemotionUI docs usage example for "comment-callout" (src/lib/remotionui/docs-usage.json)
export function Demo(__o) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 96, fontWeight: 700 }}>
      <CommentCallout
        author="Mina Lee"
        handle="@minamakes"
        body="Can you turn this into a quick video breakdown?"
        highlight="a quick video breakdown"
        reply="Dropping it Thursday, here's the short version."
       {...__o}/>
    </div>
  );
}
