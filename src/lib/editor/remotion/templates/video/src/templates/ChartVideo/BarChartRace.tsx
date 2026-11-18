import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "../../../../shim";
import { palette, withAlpha } from "../../lib/colors";
import { INTER } from "../../lib/fonts";
import {
  ChartProps,
  chartSchema,
  globalMax,
  sampleChartData,
  valueAt,
} from "./sample-data";

export { chartSchema as barChartRaceSchema };
export const barChartRaceDefaultProps: ChartProps = sampleChartData;

// Timeline constants (see calculateMetadata below).
const INTRO = 18; // bars grow in from zero
const FRAMES_PER_STEP = 45; // time to travel between two data points
const HOLD = 45; // linger on the final standings

export const barChartRaceCalculateMetadata: CalculateMetadataFunction<
  ChartProps
> = ({ props }) => {
  const steps = Math.max(1, props.steps.length - 1);
  return { durationInFrames: INTRO + steps * FRAMES_PER_STEP + HOLD };
};

// Rank of series `index` at a whole step: how many series sit strictly above it
// (ties broken by original order so positions stay stable). 0 = top of chart.
const rankAtStep = (
  series: ChartProps["series"],
  step: number,
  index: number,
): number => {
  const mine = series[index].values[step] ?? 0;
  let rank = 0;
  for (let j = 0; j < series.length; j++) {
    if (j === index) continue;
    const other = series[j].values[step] ?? 0;
    if (other > mine || (other === mine && j < index)) rank++;
  }
  return rank;
};

const ease = Easing.inOut(Easing.ease);

export const BarChartRace: React.FC<ChartProps> = (props) => {
  const { title, steps, series } = props;
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const max = globalMax(props);
  const lastStep = Math.max(0, steps.length - 1);

  // Fractional step index the whole chart is currently at.
  const t = interpolate(
    frame,
    [INTRO, INTRO + lastStep * FRAMES_PER_STEP],
    [0, lastStep],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Bars grow from zero during the intro.
  const grow = spring({ frame, fps, config: { damping: 200 }, durationInFrames: INTRO });

  // Layout math.
  const marginTop = 210;
  const marginBottom = 90;
  const leftPad = 70;
  const labelWidth = 250;
  const marginRight = 190;
  const rowHeight = (height - marginTop - marginBottom) / series.length;
  const barH = Math.min(rowHeight * 0.6, 96);
  const rowWidth = width - leftPad * 2;
  const maxBarW = rowWidth - labelWidth - marginRight;

  const stepLow = Math.floor(t);
  const stepHigh = Math.min(lastStep, stepLow + 1);
  const frac = ease(t - stepLow);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.white }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: leftPad,
          fontFamily: INTER,
          fontWeight: 800,
          fontSize: 64,
          color: palette.ink,
        }}
      >
        {title}
      </div>

      {/* Current stage label, large and faint in the corner. */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: leftPad,
          fontFamily: INTER,
          fontWeight: 800,
          fontSize: 150,
          color: palette.zinc100,
          lineHeight: 1,
        }}
      >
        {steps[Math.round(t)] ?? ""}
      </div>

      {series.map((s, i) => {
        const value = valueAt(s.values, t) * grow;
        const rankLow = rankAtStep(series, stepLow, i);
        const rankHigh = rankAtStep(series, stepHigh, i);
        const rank = rankLow + (rankHigh - rankLow) * frac;

        const top = marginTop + rank * rowHeight + (rowHeight - barH) / 2;
        const barW = (value / max) * maxBarW;

        return (
          <div
            key={s.label}
            style={{
              position: "absolute",
              left: leftPad,
              top,
              width: rowWidth,
              height: barH,
              display: "flex",
              alignItems: "center",
            }}
          >
            {/* Series label */}
            <div
              style={{
                width: labelWidth,
                paddingRight: 24,
                textAlign: "right",
                fontFamily: INTER,
                fontWeight: 700,
                fontSize: 40,
                color: palette.zinc700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {s.label}
            </div>

            {/* Bar */}
            <div
              style={{
                width: barW,
                height: barH,
                backgroundColor: s.color,
                borderRadius: 12,
                boxShadow: `0 10px 24px ${withAlpha(s.color, 0.28)}`,
                flexShrink: 0,
              }}
            />

            {/* Value */}
            <div
              style={{
                marginLeft: 22,
                fontFamily: INTER,
                fontWeight: 700,
                fontSize: 40,
                color: palette.ink,
                whiteSpace: "nowrap",
              }}
            >
              {Math.round(value)}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
