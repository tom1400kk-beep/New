// A user-set lineup preference: one starter per position (any player can
// fill any slot — enables small-ball, e.g. starting a second guard over a
// center) plus an explicit bench order. Any slot left null/unfilled falls
// back to auto-selecting the best remaining available player, exactly like
// AI teams already do — see buildRotation in engine/simulate.ts.
export interface DepthChart {
  pg: string | null;
  sg: string | null;
  sf: string | null;
  pf: string | null;
  c: string | null;
  bench: string[];
}

export const EMPTY_DEPTH_CHART: DepthChart = { pg: null, sg: null, sf: null, pf: null, c: null, bench: [] };

export function parseDepthChart(json: string): DepthChart {
  if (!json) return EMPTY_DEPTH_CHART;
  try {
    const parsed = JSON.parse(json);
    return {
      pg: typeof parsed.pg === "string" ? parsed.pg : null,
      sg: typeof parsed.sg === "string" ? parsed.sg : null,
      sf: typeof parsed.sf === "string" ? parsed.sf : null,
      pf: typeof parsed.pf === "string" ? parsed.pf : null,
      c: typeof parsed.c === "string" ? parsed.c : null,
      bench: Array.isArray(parsed.bench) ? parsed.bench.filter((x: unknown): x is string => typeof x === "string") : [],
    };
  } catch {
    return EMPTY_DEPTH_CHART;
  }
}

export function serializeDepthChart(chart: DepthChart): string {
  return JSON.stringify({
    pg: chart.pg ?? null, sg: chart.sg ?? null, sf: chart.sf ?? null, pf: chart.pf ?? null, c: chart.c ?? null,
    bench: Array.isArray(chart.bench) ? chart.bench.filter((x) => typeof x === "string") : [],
  });
}

// Flattens into the ordered 9-slot rotation preference buildRotation expects:
// [starters..., bench...]. Nulls/duplicates are fine — buildRotation skips
// them and backfills from the best remaining available players.
export function depthChartOrder(chart: DepthChart): (string | null)[] {
  return [chart.pg, chart.sg, chart.sf, chart.pf, chart.c, ...chart.bench];
}
