/* eslint-disable */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries } from '@remotion/transitions';
import { useVideoConfig } from '../shim';
import { transitionGridPixelateWipe } from "../vendored/primitives/grid-pixelate-wipe";
const Scene = ({ a }) => (<AbsoluteFill style={{ background: a ? 'linear-gradient(135deg,#1d4ed8,#7c3aed)' : 'linear-gradient(135deg,#f97316,#ec4899)', color: '#fff', fontFamily: 'system-ui,sans-serif', fontSize: 120, fontWeight: 800, alignItems: 'center', justifyContent: 'center' }}>{a ? 'Scene A' : 'Scene B'}</AbsoluteFill>);
export function Demo() {
  const { durationInFrames } = useVideoConfig();
  const half = Math.max(60, Math.floor(durationInFrames * 0.62));
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={half}><Scene a /></TransitionSeries.Sequence>
      <TransitionSeries.Transition {...transitionGridPixelateWipe({ cols: 12, rows: 8 })} />
      <TransitionSeries.Sequence durationInFrames={half}><Scene /></TransitionSeries.Sequence>
    </TransitionSeries>
  );
}
