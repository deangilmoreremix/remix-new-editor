/**
 * Adapter for the upstream `pixel-candlestick-ohlc` template.
 *
 * Upstream: `src/components/pixel-candlestick-ohlc/PixelCandlestickOhlc.tsx`
 * (MIT, © 2026 Trimora Inc. / RenderComp).
 *
 * An 8-bit candlestick chart: candles pop in column by column while the
 * header price counts along. The series is the upstream's deterministic
 * seeded random walk — ILLUSTRATIVE, not market data (the customer cannot
 * supply OHLC data, and the upstream offers no way to pass a series).
 *
 * The header "ticker" slot shows the business name in the 5x7 bitmap font
 * (2 internal px per dot, so it is cut to 16 characters to stay clear of the
 * price readout). The panel is a deep shade of the brand primary, the grid a
 * mid shade, the header the brand accent; bull/bear bodies keep the upstream's
 * conventional green/red so the chart still reads as up/down.
 */

import React from 'react'
import { PixelCandlestickOhlc } from '../../_upstream/pixel-candlestick-ohlc/PixelCandlestickOhlc'
import { DesignStage, pickColor, slotText, type DesignAdapterProps } from '../shared'
import { bitmapSafe, ensureDark, ensureLight, hex6, mix } from './shared'

export const CANDLESTICK_TICKER_MAX = 16

export const PixelCandlestickOhlcDesign: React.FC<DesignAdapterProps> = (props) => {
  const primary = hex6(props.colors?.primary, '#29d3f2')
  const accent = ensureLight(hex6(pickColor([props.colors?.accent, props.colors?.primary]), '#28c98b'), 0.35)
  const background = ensureDark(mix(primary, '#000000', 0.88), 0.025)
  const grid = ensureLight(mix(primary, '#000000', 0.45), 0.06)

  const ticker = bitmapSafe(slotText(props, 'businessName', ['headline']), CANDLESTICK_TICKER_MAX)

  return (
    <DesignStage designId="pixel-candlestick-ohlc" props={props}>
      <PixelCandlestickOhlc
        backgroundColor={background}
        gridColor={grid}
        bullColor="#2ee06a"
        bearColor="#ff4d5e"
        accentColor={accent}
        candleCount={24}
        volatility={0.5}
        cycleSpeed={6}
        ticker={ticker}
      />
    </DesignStage>
  )
}

export default PixelCandlestickOhlcDesign
