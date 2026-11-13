import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "../../../../shim";
import { palette } from "../../lib/colors";
import { INTER } from "../../lib/fonts";
import { ChartProps, chartSchema, globalMax, sampleChartData } from "./sample-data";

export { chartSchema as lineChartSchema };
export const lineChartDefaultProps: ChartProps = sampleChartData;

const STAGGER = 12; // frames each successive line waits before drawing
const HOLD = 45; // linger after everything is drawn

const drawFramesFor = (steps: number): number => 60 + steps * 8;

export const lineChartCalculateMetadata: CalculateMetadataFunction<
  ChartProps
> = ({ props }) => {
  const draw = drawFramesFor(props.steps.length);
  const total = draw + (props.series.length - 1) * STAGGER + HOLD;
  return { durationInFrames: total };
};

export const LineChart: React.FC<ChartProps> = (props) => {
  const { title, steps, series } = props;
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const max = globalMax(props);
  const lastStep = Math.max(1, steps.length - 1);
  const draw = drawFramesFor(steps.length);

  // Plot rectangle.
  const left = 130;
  const right = width - 90;
  const top = 210;
  const bottom = height - 130;
  const plotW = right - left;
  const plotH = bottom - top;

  const pointFor = (values: number[], i: number): { x: number; y: number } => ({
    x: left + (i / lastStep) * plotW,
    y: bottom - ((values[i] ?? 0) / max) * plotH,
  });

  const gridLevels = [0, 0.25, 0.5, 0.75, 1];

  return (
    <AbsoluteFill style={{ backgroundColor: palette.white }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left,
          fontFamily: INTER,
          fontWeight: 800,
          fontSize: 60,
          color: palette.ink,
        }}
      >
        {title}
      </div>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          top: 96,
          right: 90,
          display: "flex",
          gap: 28,
        }}
      >
        {series.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                backgroundColor: s.color,
              }}
            />
            <span
              style={{
                fontFamily: INTER,
                fontWeight: 600,
                fontSize: 30,
                color: palette.zinc600,
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        {/* Horizontal gridlines + axis value labels */}
        {gridLevels.map((level) => {
          const y = bottom - level * plotH;
          return (
            <g key={level}>
              <line
                x1={left}
                y1={y}
                x2={right}
                y2={y}
                stroke={palette.zinc200}
                strokeWidth={2}
              />
              <text
                x={left - 20}
                y={y + 10}
                textAnchor="end"
                fontFamily={INTER}
                fontSize={26}
                fontWeight={500}
                fill={palette.zinc400}
              >
                {Math.round(level * max)}
              </text>
            </g>
          );
        })}

        {/* X-axis step labels */}
        {steps.map((label, i) => (
          <text
            key={label + i}
            x={left + (i / lastStep) * plotW}
            y={bottom + 44}
            textAnchor="middle"
            fontFamily={INTER}
            fontSize={28}
            fontWeight={500}
            fill={palette.zinc500}
          >
            {label}
          </text>
        ))}

        {/* One drawn path per series */}
        {series.map((s, si) => {
          const start = si * STAGGER;
          const progress = interpolate(frame, [start, start + draw], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const d = s.values
            .map((_, i) => {
              const p = pointFor(s.values, i);
              return `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
            })
            .join(" ");

          // Moving marker at the leading edge of the drawn line.
          const idx = progress * lastStep;
          const i0 = Math.floor(idx);
          const i1 = Math.min(lastStep, i0 + 1);
          const f = idx - i0;
          const a = pointFor(s.values, i0);
          const b = pointFor(s.values, i1);
          const dotX = a.x + (b.x - a.x) * f;
          const dotY = a.y + (b.y - a.y) * f;
          const areaOpacity = interpolate(progress, [0.85, 1], [0, 0.1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <g key={s.label}>
              {/* Faint area fill that appears once the line is fully drawn */}
              <path
                d={`${d} L ${right.toFixed(2)} ${bottom.toFixed(2)} L ${left.toFixed(
                  2,
                )} ${bottom.toFixed(2)} Z`}
                fill={s.color}
                opacity={areaOpacity}
              />
              {/* The line itself, revealed with the pathLength dash trick:
                  normalize length to 1, then slide the dash offset 1 → 0. */}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - progress}
              />
              {progress > 0 && progress < 1 ? (
                <circle
                  cx={dotX}
                  cy={dotY}
                  r={10}
                  fill={palette.white}
                  stroke={s.color}
                  strokeWidth={5}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
