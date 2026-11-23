import React from 'react';
import { Composition } from 'remotion';
import { V1Hero, V1_TOTAL } from './V1Hero';

export const Root: React.FC = () => (
  <Composition id="V1Hero" component={V1Hero} durationInFrames={V1_TOTAL} fps={30} width={1920} height={1080} defaultProps={{ bgm: true }} />
);
