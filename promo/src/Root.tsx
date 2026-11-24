import React from 'react';
import { Composition } from 'remotion';
import { V1Hero, V1_TOTAL } from './V1Hero';
import { CursorTour, CURSOR_TOUR_DURATION } from './shots/CursorTour';
import { HubShot, HUB_DURATION } from './shots/HubShot';
import { ZoomShot, ZOOM_DURATION } from './shots/ZoomShot';
import { TiltShot, TILT_DURATION } from './shots/TiltShot';
import { DealShot, DEAL_DURATION } from './shots/DealShot';
import { BacklotShot, BACKLOT_DURATION } from './shots/BacklotShot';
import { QuadShot, QUAD_DURATION } from './shots/QuadShot';
import { CarouselShot, CAROUSEL_DURATION } from './shots/CarouselShot';
import { V2Feature, V2_TOTAL } from './V2Feature';
import { V3Clip } from './V3Clips';
import { V3_DURATION, EngineId } from './timeline3';

export const Root: React.FC = () => (
  <>
    <Composition id="V1Hero" component={V1Hero} durationInFrames={V1_TOTAL} fps={30} width={1920} height={1080} defaultProps={{ bgm: true }} />
    <Composition id="S-CursorTour" component={CursorTour} durationInFrames={CURSOR_TOUR_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="S-Hub" component={HubShot} durationInFrames={HUB_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="S-Zoom" component={ZoomShot} durationInFrames={ZOOM_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="S-Tilt" component={TiltShot} durationInFrames={TILT_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="S-Deal" component={DealShot} durationInFrames={DEAL_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="S-Backlot" component={BacklotShot} durationInFrames={BACKLOT_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="S-Quad" component={QuadShot} durationInFrames={QUAD_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="S-Carousel" component={CarouselShot} durationInFrames={CAROUSEL_DURATION} fps={30} width={1920} height={1080} />
    <Composition id="V2Feature" component={V2Feature} durationInFrames={V2_TOTAL} fps={30} width={1920} height={1080} defaultProps={{ bgm: true }} />
    <Composition id="V3-create" component={V3Clip} durationInFrames={V3_DURATION} fps={30} width={1920} height={1080} defaultProps={{ id: 'create' as EngineId, bgm: true }} />
    <Composition id="V3-enhance" component={V3Clip} durationInFrames={V3_DURATION} fps={30} width={1920} height={1080} defaultProps={{ id: 'enhance' as EngineId, bgm: true }} />
    <Composition id="V3-produce" component={V3Clip} durationInFrames={V3_DURATION} fps={30} width={1920} height={1080} defaultProps={{ id: 'produce' as EngineId, bgm: true }} />
    <Composition id="V3-localize" component={V3Clip} durationInFrames={V3_DURATION} fps={30} width={1920} height={1080} defaultProps={{ id: 'localize' as EngineId, bgm: true }} />
    <Composition id="V3-automate" component={V3Clip} durationInFrames={V3_DURATION} fps={30} width={1920} height={1080} defaultProps={{ id: 'automate' as EngineId, bgm: true }} />
    <Composition id="V3-scale" component={V3Clip} durationInFrames={V3_DURATION} fps={30} width={1920} height={1080} defaultProps={{ id: 'scale' as EngineId, bgm: true }} />
  </>
);
