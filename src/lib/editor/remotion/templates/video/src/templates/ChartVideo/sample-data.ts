import { z } from "zod";
import { zColor } from "@remotion/zod-types";

// One data shape, two visualizations. `values` is a time series: one number
// per entry in `steps` (so `values.length === steps.length`). The bar-chart
// race reads across the steps as time; the line chart draws each series as a
// path over the same axis.
export const chartSeriesSchema = z.object({
  label: z.string(),
  color: zColor(),
  values: z.array(z.number()),
});

export const chartSchema = z.object({
  title: z.string(),
  // Axis / stage labels — quarters, months, years, whatever the steps mean.
  steps: z.array(z.string()).min(2).max(24),
  series: z.array(chartSeriesSchema).min(1).max(6),
});

export type ChartProps = z.infer<typeof chartSchema>;
export type ChartSeries = z.infer<typeof chartSeriesSchema>;

// Sample dataset: monthly active users (thousands) for four products.
export const sampleChartData: ChartProps = {
  title: "Monthly Active Users by Product",
  steps: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  series: [
    { label: "Morph", color: "#2563EB", values: [12, 19, 28, 41, 63, 88] },
    { label: "Norden", color: "#0EA5E9", values: [30, 34, 39, 47, 55, 61] },
    { label: "Fenris", color: "#8B5CF6", values: [8, 15, 26, 33, 38, 52] },
    { label: "Atlas", color: "#F59E0B", values: [44, 42, 40, 43, 46, 49] },
  ],
};

// Largest value across every series and step — a stable axis maximum so bars
// and lines don't rescale distractingly frame to frame.
export const globalMax = (props: ChartProps): number =>
  Math.max(
    1,
    ...props.series.flatMap((s) => s.values),
  );

// Value of `series` at a fractional step index `t` (linear between whole
// steps). Pure and deterministic — safe to call per frame.
export const valueAt = (values: number[], t: number): number => {
  if (values.length === 0) return 0;
  const clamped = Math.max(0, Math.min(values.length - 1, t));
  const low = Math.floor(clamped);
  const high = Math.min(values.length - 1, low + 1);
  const frac = clamped - low;
  return values[low] + (values[high] - values[low]) * frac;
};
