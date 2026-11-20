/**
 * The Studio composition rendered by the REAL Remotion Player (nothing from 'remotion' is mocked here, unlike
 * most tests in this folder). It exists because a mocked Remotion hid a crash: the composition read
 * `Internals.SequenceManager.Provider`, which the pinned Remotion version does not export, so the first real
 * render threw and the preview (and the in-browser render of it) showed only the error icon.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Player } from '@remotion/player';
import { PersonalizationComposition } from '../PersonalizationComposition';
import { applyDesignTemplate, createDefaultPreviewSettings } from '../presets';
import type { PreviewInputProps } from '../types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const biz = {
  businessName: 'Acme Roofing',
  headline: 'Spring roof check',
  offer: '10% off this month',
  cta: 'Book a free roof check',
  phone: '555 0100',
  website: 'acmeroofing.test',
};

describe('PersonalizationComposition in the real Remotion Player', () => {
  it('draws a design layer instead of the error state', async () => {
    const settings = { ...applyDesignTemplate(createDefaultPreviewSettings(), 'promo-cta', biz), showEndCard: false };
    const props: PreviewInputProps = {
      videoUrl: null,
      posterUrl: null,
      isImageSource: false,
      settings,
      brand: { ...biz, logoUrl: null, productUrl: null, serviceUrl: null },
      audioUrl: null,
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <Player
          component={PersonalizationComposition}
          inputProps={props}
          durationInFrames={settings.durationInFrames}
          compositionWidth={settings.width}
          compositionHeight={settings.height}
          fps={settings.fps}
          initialFrame={70}
          controls={false}
          acknowledgeRemotionLicense
        />,
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const text = host.textContent ?? '';
    expect(text).toContain('Spring roof check');
    expect(text).toContain('Book a free roof check');
    await act(async () => root.unmount());
  });
});
