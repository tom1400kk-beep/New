import { clamp } from "./rng";

// A coach's per-state recruiting-connection strength (0-100, baseline 50 =
// neutral). Lives on the Coach row, not the Team row, so it travels with the
// coach across jobs — a lifetime of relationships, not a program's ties.
export const PIPELINE_BASELINE = 50;

export function parsePipelineStates(json: string): Record<string, number> {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function pipelineScore(pipeline: Record<string, number>, state: string): number {
  return pipeline[state] ?? PIPELINE_BASELINE;
}

// A deeply built "pipeline" state (near 99) is worth roughly a 20% recruiting
// bump; a fully "gone cold" state (near 5) costs roughly 18%.
export function pipelineMultiplier(score: number): number {
  return clamp(1 + (score - PIPELINE_BASELINE) * 0.004, 0.8, 1.2);
}

export function seedPipeline(hometownState: string | null, almaMaterState: string | null): Record<string, number> {
  const pipeline: Record<string, number> = {};
  if (hometownState) pipeline[hometownState] = 75;
  if (almaMaterState) pipeline[almaMaterState] = Math.max(pipeline[almaMaterState] ?? 0, 65);
  return pipeline;
}

// Actively recruiting a prospect from a state strengthens that connection.
export function bumpPipelineState(pipeline: Record<string, number>, state: string): Record<string, number> {
  const current = pipelineScore(pipeline, state);
  return { ...pipeline, [state]: Math.round(clamp(current + 5, 5, 99)) };
}

// Every offseason, connections fade a little unless kept warm by recruiting
// there — this is what lets a pipeline state go cold if it's neglected.
export function decayPipeline(pipeline: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [state, score] of Object.entries(pipeline)) {
    next[state] = Math.round(clamp(score - 3, 5, 99));
  }
  return next;
}
