/* eslint-disable */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries } from '@remotion/transitions';
import { useVideoConfig } from '../shim';
import { transitionZoomThrough } from "../vendored/primitives/zoom-through";
const Scene = ({ a, text, color }) => (<AbsoluteFill style={{ background: color, color: '#fff', fontFamily: 'system-ui,sans-serif', fontSize: 120, fontWeight: 800, alignItems: 'center', justifyContent: 'center' }}>{text}</AbsoluteFill>);
export function Demo({ textA = 'Scene A', textB = 'Scene B', colorA = '#2563eb', colorB = '#f97316' }) {
  const { durationInFrames } = useVideoConfig();
  const half = Math.max(60, Math.floor(durationInFrames * 0.62));
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={half}><Scene a text={textA} color={colorA} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition {...transitionZoomThrough({ maxScale: 2.4 })} />
      <TransitionSeries.Sequence durationInFrames={half}><Scene text={textB} color={colorB} /></TransitionSeries.Sequence>
    </TransitionSeries>
  );
}
